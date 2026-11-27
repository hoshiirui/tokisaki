"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as RPointerEvent } from "react";
import { saveSelection } from "@/app/portal-actions";

type Photo = { id: string; name: string };

const MAX_ZOOM = 6;
const CLICK_ZOOM = 2.5;
type View = { s: number; x: number; y: number };
const FIT: View = { s: 1, x: 0, y: 0 };

type Props = {
  /** ID sesi, dipakai untuk memeriksa akses saat foto diminta. */
  sid: string;
  files: Photo[];
  /** select: client memilih; view: hanya melihat (pilihan ditandai); edited: foto hasil edit */
  mode: "select" | "view" | "edited";
  initialSelected?: string[];
  max?: number;
  /** Tampilkan tombol Unduh di dalam tampilan perbesar. */
  download?: boolean;
};

export default function PhotoGallery({ sid, files, mode, initialSelected = [], max = 20, download = false }: Props) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [zoom, setZoom] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const zoomRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Zoom: s = skala (1 = pas di layar), x/y = geseran dalam piksel dari tengah.
  const stageRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>(FIT);
  const [view, setViewState] = useState<View>(FIT);
  const [hiRes, setHiRes] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; s: number } | null>(null);

  const setView = useCallback((v: View) => {
    viewRef.current = v;
    setViewState(v);
    if (v.s > 1) setHiRes(true);
  }, []);

  /** Ubah skala ke ns dengan titik (cx, cy) relatif ke tengah kotak foto tetap di tempatnya. */
  const zoomTo = useCallback(
    (ns: number, cx: number, cy: number) => {
      const el = stageRef.current;
      if (!el) return;
      const { s, x, y } = viewRef.current;
      const next = Math.min(MAX_ZOOM, Math.max(1, ns));
      if (next === 1) return setView(FIT);
      const k = next / s;
      const limX = (el.clientWidth * (next - 1)) / 2;
      const limY = (el.clientHeight * (next - 1)) / 2;
      setView({
        s: next,
        x: Math.max(-limX, Math.min(limX, cx - (cx - x) * k)),
        y: Math.max(-limY, Math.min(limY, cy - (cy - y) * k)),
      });
    },
    [setView],
  );

  function centerOf(clientX: number, clientY: number) {
    const r = stageRef.current?.getBoundingClientRect();
    return r ? { cx: clientX - (r.left + r.width / 2), cy: clientY - (r.top + r.height / 2) } : { cx: 0, cy: 0 };
  }

  function onPointerDown(e: RPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: viewRef.current.s };
      drag.current = null;
    }
  }

  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const { cx, cy } = centerOf((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomTo(pinch.current.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d), cx, cy);
      return;
    }
    const d = drag.current;
    const el = stageRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 4) d.moved = true;
    const { s } = viewRef.current;
    if (s <= 1 || !d.moved) return;
    const limX = (el.clientWidth * (s - 1)) / 2;
    const limY = (el.clientHeight * (s - 1)) / 2;
    setView({
      s,
      x: Math.max(-limX, Math.min(limX, d.vx + dx)),
      y: Math.max(-limY, Math.min(limY, d.vy + dy)),
    });
  }

  function onPointerUp(e: RPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    if (d && pointers.current.size === 0) {
      drag.current = null;
      if (!d.moved && e.type === "pointerup") {
        // Ketuk atau klik: zoom in ke titik itu, atau kembali pas jika sudah zoom.
        if (viewRef.current.s > 1) setView(FIT);
        else {
          const { cx, cy } = centerOf(e.clientX, e.clientY);
          zoomTo(CLICK_ZOOM, cx, cy);
        }
      }
    }
  }

  // Roda mouse atau trackpad: zoom ke arah kursor. Harus listener asli agar bisa mencegah scroll halaman.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const r = el!.getBoundingClientRect();
      zoomTo(viewRef.current.s * Math.exp(-e.deltaY * 0.0018), e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  // Ganti foto: kembali ke tampilan pas.
  useEffect(() => {
    setView(FIT);
    setHiRes(false);
  }, [zoom, setView]);

  const src = (id: string, size?: number) => `/api/drive/${id}?session=${sid}${size ? `&s=${size}` : ""}`;

  function toggle(id: string) {
    setError("");
    if (selectedSet.has(id)) {
      setSelected(selected.filter((x) => x !== id));
      return;
    }
    if (selected.length >= max) {
      setError(`Maksimal ${max} foto. Lepas satu foto untuk memilih yang lain.`);
      return;
    }
    setSelected([...selected, id]);
  }

  function openZoom(i: number) {
    setZoom(i);
    zoomRef.current?.showModal();
  }

  useEffect(() => {
    if (zoom === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setZoom((z) => (z === null ? z : Math.min(files.length - 1, z + 1)));
      if (e.key === "ArrowLeft") setZoom((z) => (z === null ? z : Math.max(0, z - 1)));
      if (e.key === "+" || e.key === "=") zoomTo(viewRef.current.s * 1.5, 0, 0);
      if (e.key === "-") zoomTo(viewRef.current.s / 1.5, 0, 0);
      if (e.key === "0") setView(FIT);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, files.length, zoomTo, setView]);

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const res = await saveSelection(sid, selected);
        confirmRef.current?.close();
        if (!res.ok) setError(res.error);
      } catch {
        confirmRef.current?.close();
        setError("Pilihan belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  const current = zoom !== null ? files[zoom] : null;

  return (
    <>
      <ul className="photos">
        {files.map((f, i) => {
          const order = selected.indexOf(f.id) + 1;
          return (
            <li key={f.id} className={order && mode !== "edited" ? "photo on" : "photo"}>
              <button
                type="button"
                className="photo-main"
                aria-pressed={mode === "select" ? order > 0 : undefined}
                aria-label={mode === "select" ? `${order ? "Lepas" : "Pilih"} ${f.name}` : `Perbesar ${f.name}`}
                onClick={() => (mode === "select" ? toggle(f.id) : openZoom(i))}
              >
                <img src={src(f.id, 480)} alt={f.name} loading="lazy" />
                {mode !== "edited" && order ? <span className="photo-order">{order}</span> : null}
              </button>
              {mode === "select" ? (
                <button type="button" className="photo-zoom" onClick={() => openZoom(i)} aria-label={`Perbesar ${f.name}`}>
                  Perbesar
                </button>
              ) : null}
              <span className="photo-name">{f.name}</span>
            </li>
          );
        })}
      </ul>

      {mode === "select" ? (
        <div className="pickbar">
          <div className="pickbar-inner wrap">
            <span aria-live="polite">
              <strong>{selected.length}</strong>/{max} dipilih
              {error ? <span className="err"> {error}</span> : null}
            </span>
            <button
              type="button"
              className="btn"
              disabled={selected.length === 0 || pending}
              onClick={() => confirmRef.current?.showModal()}
            >
              Kirim pilihan
            </button>
          </div>
        </div>
      ) : null}

      <dialog
        ref={zoomRef}
        className="doc-dialog photo-dialog"
        aria-label="Foto diperbesar"
        onClose={() => setZoom(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="doc-dialog-head">
          <h3>{current?.name ?? ""}</h3>
          <div className="actions">
            {mode === "select" && current ? (
              <button type="button" className="btn ghost" onClick={() => toggle(current.id)}>
                {selectedSet.has(current.id) ? "Lepas pilihan" : "Pilih foto ini"}
              </button>
            ) : null}
            {(mode === "edited" || download) && current ? (
              <a className="btn ghost" href={`${src(current.id)}&download=1`}>Unduh</a>
            ) : null}
            <button type="button" className="btn ghost" disabled={zoom === null || zoom <= 0} onClick={() => setZoom((z) => (z === null ? z : Math.max(0, z - 1)))}>
              Sebelumnya
            </button>
            <button type="button" className="btn ghost" disabled={zoom === null || zoom >= files.length - 1} onClick={() => setZoom((z) => (z === null ? z : Math.min(files.length - 1, z + 1)))}>
              Berikutnya
            </button>
            <button type="button" className="btn" onClick={() => zoomRef.current?.close()}>Tutup</button>
          </div>
        </div>
        <div
          ref={stageRef}
          className={view.s > 1 ? "photo-stage zoomed" : "photo-stage"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {current ? (
            <img
              src={src(current.id, hiRes ? 2048 : 1600)}
              alt={current.name}
              draggable={false}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
            />
          ) : null}
          <div className="zoom-ctrl" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Zoom out" disabled={view.s <= 1} onClick={() => zoomTo(view.s / 1.5, 0, 0)}>−</button>
            <button type="button" aria-label="Pas di layar" onClick={() => setView(FIT)}>{Math.round(view.s * 100)}%</button>
            <button type="button" aria-label="Zoom in" disabled={view.s >= MAX_ZOOM} onClick={() => zoomTo(view.s * 1.5, 0, 0)}>+</button>
          </div>
        </div>
        {mode === "select" && error ? <p className="err doc-dialog-note">{error}</p> : null}
      </dialog>

      <dialog ref={confirmRef} className="confirm-dialog" aria-labelledby="confirm-title">
        <h3 id="confirm-title">Kirim {selected.length} foto?</h3>
        <p className="lede">
          Setelah dikirim, pilihan dikunci dan status sesi berubah menjadi Diproses. Pastikan semua foto yang ingin
          diedit sudah dipilih.
        </p>
        <div className="actions">
          <button type="button" className="btn" disabled={pending} onClick={submit}>
            {pending ? "Mengirim…" : "Ya, kirim"}
          </button>
          <button type="button" className="btn ghost" disabled={pending} onClick={() => confirmRef.current?.close()}>
            Batal
          </button>
        </div>
      </dialog>
    </>
  );
}
