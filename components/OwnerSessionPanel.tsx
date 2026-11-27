"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveSessionAdmin } from "@/app/portal-actions";
import { driveFolderUrl } from "@/lib/dates";

type Props = {
  id: string;
  stage: "" | "proses" | "selesai";
  driveFolderId: string;
  editedFolderId: string;
  maxSelect: number;
};

export default function OwnerSessionPanel({ id, stage, driveFolderId, editedFolderId, maxSelect }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (n: string) => String(fd.get(n) ?? "").trim();
    setError("");
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await saveSessionAdmin({
          id,
          stage: text("stage") as Props["stage"],
          driveFolder: text("driveFolder"),
          editedFolder: text("editedFolder"),
          maxSelect: Number(text("maxSelect")) || 20,
        });
        if (res.ok) {
          setSaved(true);
          router.refresh();
        } else setError(res.error);
      } catch {
        setError("Perubahan belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  return (
    <form className="form opanel" onSubmit={onSubmit} onChange={() => setSaved(false)}>
      <div className="two">
        <div className="field">
          <label htmlFor="op-stage">Tahap</label>
          <select id="op-stage" name="stage" defaultValue={stage}>
            <option value="">Menunggu pilihan client</option>
            <option value="proses">Diproses</option>
            <option value="selesai">Selesai</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="op-max">Maks. foto dipilih</label>
          <input id="op-max" name="maxSelect" type="number" min={1} max={200} defaultValue={maxSelect} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="op-raw">Folder foto asli (untuk dipilih client)</label>
        <input id="op-raw" name="driveFolder" type="url" placeholder="https://drive.google.com/drive/folders/..." defaultValue={driveFolderId ? driveFolderUrl(driveFolderId) : ""} />
      </div>
      <div className="field">
        <label htmlFor="op-edited">Folder foto hasil edit</label>
        <input id="op-edited" name="editedFolder" type="url" placeholder="https://drive.google.com/drive/folders/..." defaultValue={editedFolderId ? driveFolderUrl(editedFolderId) : ""} />
      </div>
      <p className="muted">
        Tahap Selesai membuka foto hasil edit untuk client, jadi folder edit harus sudah ditautkan. Memilih Menunggu
        pilihan client membuka kembali pilihan foto; pilihan sebelumnya tetap tersimpan.
      </p>
      {error ? <p className="err" role="alert">{error}</p> : null}
      <div className="actions">
        <button type="submit" className="btn" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
        {saved ? <span className="muted" role="status">Tersimpan.</span> : null}
        {driveFolderId ? <a className="btn ghost" href={driveFolderUrl(driveFolderId)} target="_blank" rel="noopener noreferrer">Buka folder asli di Drive</a> : null}
        {editedFolderId ? <a className="btn ghost" href={driveFolderUrl(editedFolderId)} target="_blank" rel="noopener noreferrer">Buka folder edit di Drive</a> : null}
      </div>
    </form>
  );
}
