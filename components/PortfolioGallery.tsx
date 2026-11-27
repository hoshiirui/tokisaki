"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { setAlbumCover } from "@/app/portfolio-actions";

type Props = {
  albumId: string;
  title: string;
  fileIds: string[];
  coverId: string;
  owner: boolean;
};

const src = (albumId: string, id: string, size: number) => `/api/portfolio/${id}?album=${albumId}&s=${size}`;

/**
 * Galeri album: hanya untuk dilihat. Tidak ada tombol unduh, klik kanan dan seret gambar dimatikan,
 * dan yang dimuat hanya gambar berukuran tampilan.
 */
export default function PortfolioGallery({ albumId, title, fileIds, coverId, owner }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => setOpen((i) => (i === null ? i : Math.min(fileIds.length - 1, Math.max(0, i + delta)))),
    [fileIds.length],
  );

  useEffect(() => {
    if (open === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  function show(i: number) {
    setOpen(i);
    setMsg("");
    dialogRef.current?.showModal();
  }

  function makeCover(id: string) {
    setMsg("");
    startTransition(async () => {
      try {
        const res = await setAlbumCover(albumId, id);
        setMsg(res.ok ? "Thumbnail album diganti." : res.error);
        if (res.ok) router.refresh();
      } catch {
        setMsg("Thumbnail belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  const current = open !== null ? fileIds[open] : null;
  const noMenu = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <>
      <div className="pgrid" onContextMenu={noMenu}>
        {fileIds.map((id, i) => (
          <button key={id} type="button" className="pitem" aria-label={`Lihat foto ${i + 1} dari ${fileIds.length}`} onClick={() => show(i)}>
            <img src={src(albumId, id, 640)} alt="" loading="lazy" draggable={false} />
            {owner && id === coverId ? <span className="pbadge">Thumbnail</span> : null}
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="doc-dialog photo-dialog"
        aria-label={`Foto album ${title}`}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        onContextMenu={noMenu}
      >
        <div className="doc-dialog-head">
          <h3>{title}{open !== null ? <span className="muted"> · {open + 1} / {fileIds.length}</span> : null}</h3>
          <div className="actions">
            {owner && current ? (
              <button type="button" className="btn ghost" disabled={pending || current === coverId} onClick={() => makeCover(current)}>
                {current === coverId ? "Thumbnail album" : "Jadikan thumbnail"}
              </button>
            ) : null}
            <button type="button" className="btn ghost" disabled={open === null || open <= 0} onClick={() => go(-1)}>Sebelumnya</button>
            <button type="button" className="btn ghost" disabled={open === null || open >= fileIds.length - 1} onClick={() => go(1)}>Berikutnya</button>
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>Tutup</button>
          </div>
        </div>
        <div
          className="photo-stage static"
          onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            const end = e.changedTouches[0]?.clientX;
            if (start === null || end === undefined) return;
            if (end - start > 60) go(-1);
            else if (start - end > 60) go(1);
          }}
        >
          {current ? <img src={src(albumId, current, 1600)} alt={`Foto ${open! + 1} dari ${fileIds.length}`} draggable={false} /> : null}
        </div>
        {msg ? <p className="muted doc-dialog-note" role="status">{msg}</p> : null}
      </dialog>
    </>
  );
}
