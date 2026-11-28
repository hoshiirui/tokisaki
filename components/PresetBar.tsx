"use client";

import { useEffect, useRef, useState } from "react";
import { PRESETS } from "@/lib/presets";
import { buildPlan, processRows } from "@/lib/preset-engine";

type Props = {
  sid: string;
  photo: { id: string; name: string };
  /** URL pratinjau hasil preset (atau null untuk foto asli). */
  onPreview: (url: string | null) => void;
};

/** Piksel maksimum untuk hasil unduhan. Batas canvas iOS Safari sekitar 16,7 juta piksel. */
const MAX_PIXELS = 16_000_000;
const PREVIEW_SIDE = 1600;

const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));
const toBlob = (c: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", quality));

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Foto belum bisa dimuat.");
  return createImageBitmap(await res.blob(), { imageOrientation: "from-image" });
}

/** Menerapkan preset ke bitmap pada ukuran tertentu dan mengembalikan canvas hasilnya. */
async function render(bmp: ImageBitmap, w: number, h: number, presetId: string, amount: number, onProgress?: (f: number) => void, isStale?: () => boolean) {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error("Preset tidak dikenal.");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Browser ini belum mendukung preset.");
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const plan = buildPlan(preset);
  const step = Math.max(8, Math.floor(400_000 / w));
  for (let y = 0; y < h; y += step) {
    if (isStale?.()) return null;
    processRows(img.data, w, h, y, Math.min(h, y + step), plan, amount);
    onProgress?.(Math.min(1, (y + step) / h));
    await yieldToBrowser();
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export default function PresetBar({ sid, photo, onPreview }: Props) {
  const [presetId, setPresetId] = useState("");
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const urlRef = useRef<string | null>(null);
  const runRef = useRef(0);
  const bitmapRef = useRef<{ id: string; bmp: ImageBitmap } | null>(null);

  const url = (id: string, size?: number) => `/api/drive/${id}?session=${sid}${size ? `&s=${size}` : ""}`;

  function setPreview(next: string | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    onPreview(next);
  }

  // Pratinjau: dirender ulang saat foto, preset, atau intensitas berubah.
  useEffect(() => {
    const run = ++runRef.current;
    const stale = () => run !== runRef.current;
    if (!presetId) {
      setPreview(null);
      setError("");
      return;
    }
    setPreview(null);
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        if (bitmapRef.current?.id !== photo.id) {
          bitmapRef.current?.bmp.close();
          bitmapRef.current = null;
          const bmp = await loadBitmap(url(photo.id, PREVIEW_SIDE));
          if (stale()) return bmp.close();
          bitmapRef.current = { id: photo.id, bmp };
        }
        const bmp = bitmapRef.current!.bmp;
        const scale = Math.min(1, PREVIEW_SIDE / Math.max(bmp.width, bmp.height));
        const canvas = await render(bmp, Math.round(bmp.width * scale), Math.round(bmp.height * scale), presetId, amount / 100, undefined, stale);
        if (!canvas || stale()) return;
        const blob = await toBlob(canvas, 0.9);
        if (!blob || stale()) return;
        setPreview(URL.createObjectURL(blob));
      } catch (e) {
        if (!stale()) setError(e instanceof Error ? e.message : "Pratinjau gagal dibuat.");
      } finally {
        if (!stale()) setBusy(false);
      }
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, amount, photo.id]);

  useEffect(
    () => () => {
      runRef.current++;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      bitmapRef.current?.bmp.close();
    },
    [],
  );

  async function download() {
    if (!presetId || working) return;
    setWorking(true);
    setProgress(0);
    setError("");
    try {
      const bmp = await loadBitmap(url(photo.id));
      const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (bmp.width * bmp.height)));
      const canvas = await render(bmp, Math.max(1, Math.round(bmp.width * scale)), Math.max(1, Math.round(bmp.height * scale)), presetId, amount / 100, setProgress);
      bmp.close();
      if (!canvas) return;
      const blob = await toBlob(canvas, 0.92);
      if (!blob) throw new Error("Foto belum bisa disimpan. Coba lagi.");
      const a = document.createElement("a");
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = `${photo.name.replace(/\.[^.]+$/, "")}-${presetId}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unduhan gagal. Coba lagi.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="preset-bar">
      <div className="preset-row" role="group" aria-label="Preset warna">
        <button type="button" className={presetId === "" ? "chip on" : "chip"} aria-pressed={presetId === ""} onClick={() => setPresetId("")}>
          Asli
        </button>
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={presetId === p.id ? "chip on" : "chip"} aria-pressed={presetId === p.id} onClick={() => setPresetId(p.id)} title={p.feel}>
            {p.name}
          </button>
        ))}
      </div>
      {presetId ? (
        <div className="preset-row preset-actions">
          <label className="preset-amount">
            <span>Intensitas {amount}%</span>
            <input type="range" min={10} max={100} step={5} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <button type="button" className="btn accent" disabled={working || busy} onClick={() => void download()}>
            {working ? `Menyiapkan… ${Math.round(progress * 100)}%` : "Unduh dengan preset"}
          </button>
          <span className="muted preset-note" aria-live="polite">
            {busy ? "Membuat pratinjau…" : error ? "" : "Pratinjau kecil. Hasil unduhan memakai resolusi penuh (maks. 16 MP), data EXIF tidak ikut."}
          </span>
        </div>
      ) : null}
      {error ? <p className="err" role="alert">{error}</p> : null}
    </div>
  );
}
