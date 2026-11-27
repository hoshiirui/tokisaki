"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { deleteAlbum, saveAlbum } from "@/app/portfolio-actions";
import { driveFolderUrl } from "@/lib/dates";

type Props = {
  album?: {
    id: string;
    title: string;
    description: string;
    eventDate: string | null;
    driveFolderId: string;
    published: boolean;
  };
};

/** Form album portfolio untuk pemilik: dipakai untuk album baru dan untuk mengubah album. */
export default function AlbumForm({ album }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (n: string) => String(fd.get(n) ?? "").trim();
    setError("");
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await saveAlbum({
          id: album?.id,
          title: text("title"),
          description: text("description"),
          eventDate: text("eventDate"),
          driveFolder: text("driveFolder"),
          published: fd.get("published") === "on",
        });
        if (!res.ok) return setError(res.error);
        if (album) {
          setSaved(true);
          router.refresh();
        } else router.push(`/portfolio/${res.id}`);
      } catch {
        setError("Perubahan belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  function remove() {
    if (!album) return;
    setError("");
    startTransition(async () => {
      try {
        const res = await deleteAlbum(album.id);
        if (res.ok) router.push("/portfolio");
        else setError(res.error);
      } catch {
        setError("Album belum terhapus. Coba lagi sebentar lagi.");
      }
    });
  }

  return (
    <form className="form opanel" onSubmit={onSubmit} onChange={() => setSaved(false)}>
      <div className="field">
        <label htmlFor="al-title">Judul album</label>
        <input id="al-title" name="title" type="text" maxLength={80} required placeholder="Contoh: Wisuda Universitas" defaultValue={album?.title ?? ""} />
      </div>
      <div className="two">
        <div className="field">
          <label htmlFor="al-date">Tanggal acara (opsional)</label>
          <input id="al-date" name="eventDate" type="date" defaultValue={album?.eventDate ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="al-folder">Folder foto di Google Drive</label>
          <input
            id="al-folder"
            name="driveFolder"
            type="url"
            placeholder="https://drive.google.com/drive/folders/..."
            defaultValue={album?.driveFolderId ? driveFolderUrl(album.driveFolderId) : ""}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="al-desc">Deskripsi (opsional)</label>
        <textarea id="al-desc" name="description" maxLength={600} defaultValue={album?.description ?? ""} />
      </div>
      <label className="check" htmlFor="al-pub">
        <input id="al-pub" name="published" type="checkbox" defaultChecked={album?.published ?? false} />
        <span>Tampilkan album ini di halaman Portfolio. Jika tidak dicentang, hanya kamu yang bisa melihatnya (draf).</span>
      </label>
      <p className="muted">
        Folder harus berada di dalam folder Drive yang sudah dibagikan ke service account. Foto hanya bisa dilihat
        pengunjung, tidak diunduh.
      </p>
      {error ? <p className="err" role="alert">{error}</p> : null}
      <div className="actions">
        <button type="submit" className="btn" disabled={pending}>{pending ? "Menyimpan…" : album ? "Simpan album" : "Buat album"}</button>
        {saved ? <span className="muted" role="status">Tersimpan.</span> : null}
        {album ? (
          confirmDelete ? (
            <>
              <button type="button" className="btn danger" disabled={pending} onClick={remove}>Ya, hapus album</button>
              <button type="button" className="btn ghost" disabled={pending} onClick={() => setConfirmDelete(false)}>Batal</button>
            </>
          ) : (
            <button type="button" className="btn ghost" disabled={pending} onClick={() => setConfirmDelete(true)}>Hapus album</button>
          )
        ) : null}
      </div>
      {confirmDelete ? <p className="muted">Album dihapus dari portfolio. Foto di Google Drive tidak ikut terhapus.</p> : null}
    </form>
  );
}
