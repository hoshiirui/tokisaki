"use client";

import { useState } from "react";
import { listRawPhotos } from "@/app/portal-actions";
import PhotoGallery from "@/components/PhotoGallery";
import ZipButton from "@/components/ZipButton";

type Photo = { id: string; name: string };
type Tab = "edited" | "raw";

type Props = {
  sid: string;
  edited: Photo[];
  editedFailed: boolean;
  selectedIds: string[];
  hasRaw: boolean;
};

/**
 * Sesi Selesai: tab Hasil edit (langsung dimuat) dan Foto asli (daftar dan thumbnail
 * baru diminta ke server saat tab dibuka pertama kali).
 */
export default function SessionTabs({ sid, edited, editedFailed, selectedIds, hasRaw }: Props) {
  const [tab, setTab] = useState<Tab>("edited");
  const [raw, setRaw] = useState<Photo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadRaw() {
    setLoading(true);
    setError("");
    try {
      const res = await listRawPhotos(sid);
      if (res.ok) setRaw(res.files);
      else setError(res.error);
    } catch {
      setError("Foto asli belum bisa dimuat. Coba lagi sebentar lagi.");
    } finally {
      setLoading(false);
    }
  }

  function open(next: Tab) {
    setTab(next);
    if (next === "raw" && raw === null && !loading) void loadRaw();
  }

  return (
    <>
      <div className="tabbar">
      <div className="tabs" role="tablist" aria-label="Jenis foto">
        <button
          type="button"
          role="tab"
          id="tab-edited"
          aria-selected={tab === "edited"}
          aria-controls="panel-edited"
          className={tab === "edited" ? "tab on" : "tab"}
          onClick={() => open("edited")}
        >
          Hasil edit <span className="tab-count">{edited.length}</span>
        </button>
        {hasRaw ? (
          <button
            type="button"
            role="tab"
            id="tab-raw"
            aria-selected={tab === "raw"}
            aria-controls="panel-raw"
            className={tab === "raw" ? "tab on" : "tab"}
            onClick={() => open("raw")}
          >
            Foto asli (JPG)
            {raw ? <span className="tab-count">{raw.length}</span> : null}
          </button>
        ) : null}
      </div>
        <p className="tab-hint">
          {tab === "edited"
            ? "Klik foto untuk memperbesar dan mengunduh."
            : "Foto yang kamu pilih untuk diedit diberi nomor."}
        </p>
      </div>

      <div className="zip-row">
        {tab === "edited" ? (
          edited.length > 0 ? <ZipButton sid={sid} kind="edited" count={edited.length} /> : null
        ) : (
          <ZipButton sid={sid} kind="raw" count={raw?.length} />
        )}
      </div>

      <div role="tabpanel" id="panel-edited" aria-labelledby="tab-edited" hidden={tab !== "edited"}>
        {editedFailed ? (
          <p className="lede">Foto hasil edit belum bisa dimuat. Coba muat ulang beberapa saat lagi.</p>
        ) : edited.length === 0 ? (
          <p className="lede">Foto hasil edit belum tersedia.</p>
        ) : (
          <PhotoGallery sid={sid} files={edited} mode="edited" />
        )}
      </div>

      {hasRaw ? (
        <div role="tabpanel" id="panel-raw" aria-labelledby="tab-raw" hidden={tab !== "raw"}>
          {loading ? (
            <p className="lede" aria-live="polite">Memuat foto asli…</p>
          ) : error ? (
            <>
              <p className="err" role="alert">{error}</p>
              <button type="button" className="btn ghost" onClick={() => void loadRaw()}>Coba lagi</button>
            </>
          ) : raw && raw.length === 0 ? (
            <p className="lede">Belum ada foto asli di folder sesi ini.</p>
          ) : raw ? (
            <PhotoGallery sid={sid} files={raw} mode="view" initialSelected={selectedIds} download />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
