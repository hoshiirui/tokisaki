"use client";

import { useEffect, useState } from "react";
import { listSessionPhotos } from "@/app/portal-actions";
import PhotoGallery from "@/components/PhotoGallery";

type Photo = { id: string; name: string };
type Tab = "selection" | "edited" | "raw";
type Lazy = { files: Photo[] | null; loading: boolean; error: string };

type Props = {
  date: string;
  selection: Photo[];
  hasRaw: boolean;
  hasEdited: boolean;
  defaultTab: Tab;
};

/** Galeri pemilik: pilihan client (langsung), hasil edit dan foto asli (diminta saat tab dibuka). */
export default function OwnerGallery({ date, selection, hasRaw, hasEdited, defaultTab }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [lazy, setLazy] = useState<Record<"raw" | "edited", Lazy>>({
    raw: { files: null, loading: false, error: "" },
    edited: { files: null, loading: false, error: "" },
  });
  const [copied, setCopied] = useState(false);
  const selectedIds = selection.map((s) => s.id);

  async function load(kind: "raw" | "edited") {
    setLazy((l) => ({ ...l, [kind]: { files: null, loading: true, error: "" } }));
    try {
      const res = await listSessionPhotos(date, kind);
      setLazy((l) => ({ ...l, [kind]: res.ok ? { files: res.files, loading: false, error: "" } : { files: null, loading: false, error: res.error } }));
    } catch {
      setLazy((l) => ({ ...l, [kind]: { files: null, loading: false, error: "Foto belum bisa dimuat. Coba lagi sebentar lagi." } }));
    }
  }

  function open(next: Tab) {
    setTab(next);
    if (next !== "selection") {
      const st = lazy[next];
      if (st.files === null && !st.loading) void load(next);
    }
  }

  // Tab awal (hasil edit atau foto asli) dimuat sekali saat pertama tampil.
  useEffect(() => {
    if (defaultTab !== "selection") void load(defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyNames() {
    navigator.clipboard
      ?.writeText(selection.map((s) => s.name).join("\n"))
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  }

  const hint =
    tab === "selection"
      ? "Foto yang dipilih client untuk diedit, sesuai urutan pilih."
      : tab === "edited"
        ? "Klik foto untuk memperbesar dan mengunduh."
        : "Foto pilihan client diberi nomor.";

  function panel(kind: "raw" | "edited") {
    const st = lazy[kind];
    return (
      <div role="tabpanel" hidden={tab !== kind}>
        {st.loading ? (
          <p className="lede" aria-live="polite">Memuat foto…</p>
        ) : st.error ? (
          <>
            <p className="err" role="alert">{st.error}</p>
            <button type="button" className="btn ghost" onClick={() => void load(kind)}>Coba lagi</button>
          </>
        ) : st.files && st.files.length === 0 ? (
          <p className="lede">Folder ini belum berisi foto.</p>
        ) : st.files ? (
          <PhotoGallery date={date} files={st.files} mode="view" initialSelected={kind === "raw" ? selectedIds : []} download />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="tabbar">
        <div className="tabs" role="tablist" aria-label="Isi sesi">
          <button type="button" role="tab" aria-selected={tab === "selection"} className={tab === "selection" ? "tab on" : "tab"} onClick={() => open("selection")}>
            Pilihan client <span className="tab-count">{selection.length}</span>
          </button>
          {hasEdited ? (
            <button type="button" role="tab" aria-selected={tab === "edited"} className={tab === "edited" ? "tab on" : "tab"} onClick={() => open("edited")}>
              Hasil edit {lazy.edited.files ? <span className="tab-count">{lazy.edited.files.length}</span> : null}
            </button>
          ) : null}
          {hasRaw ? (
            <button type="button" role="tab" aria-selected={tab === "raw"} className={tab === "raw" ? "tab on" : "tab"} onClick={() => open("raw")}>
              Foto asli (JPG) {lazy.raw.files ? <span className="tab-count">{lazy.raw.files.length}</span> : null}
            </button>
          ) : null}
        </div>
        <p className="tab-hint">{hint}</p>
      </div>

      <div role="tabpanel" hidden={tab !== "selection"}>
        {selection.length === 0 ? (
          <p className="lede">Client belum mengirim pilihan foto.</p>
        ) : (
          <>
            <div className="actions" style={{ marginBottom: 16 }}>
              <button type="button" className="btn ghost" onClick={copyNames}>{copied ? "Tersalin" : "Salin nama file"}</button>
            </div>
            {hasRaw ? (
              <PhotoGallery date={date} files={selection} mode="view" initialSelected={selectedIds} download />
            ) : (
              <ul className="selnames">{selection.map((s) => <li key={s.id}>{s.name}</li>)}</ul>
            )}
          </>
        )}
      </div>
      {hasEdited ? panel("edited") : null}
      {hasRaw ? panel("raw") : null}
    </>
  );
}
