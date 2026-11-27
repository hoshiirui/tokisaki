"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { deleteSession, saveSession } from "@/app/actions";
import { formatCode } from "@/lib/claim";
import { docPreviewUrl, isGoogleDocUrl, longDate } from "@/lib/dates";
import type { OwnerSession } from "@/lib/types";

type Props = {
  date: string;
  /** Kosong untuk sesi baru. */
  session?: OwnerSession;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  onCancel?: () => void;
};

/** Detail satu sesi: client, jam, lokasi, catatan, planning Google Docs, dan kode klaim. */
export default function OwnerSessionForm({ date, session, onSaved, onDeleted, onCancel }: Props) {
  const uid = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [docUrl, setDocUrl] = useState(session?.docUrl ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Iframe baru dimuat saat modal dibuka, supaya dokumen tidak diambil dari Google sebelum diminta.
  const [previewOpen, setPreviewOpen] = useState(false);
  const docOk = isGoogleDocUrl(docUrl.trim());
  // Pratinjau hanya untuk tautan yang sudah tersimpan, agar iframe tidak dimuat ulang setiap kali mengetik.
  const savedDoc = session?.docUrl ?? "";
  const previewSrc = docPreviewUrl(savedDoc);
  const unsavedDoc = docOk && docUrl.trim() !== savedDoc;
  const id = (n: string) => `${uid}-${n}`;

  function copyCode() {
    if (!session) return;
    navigator.clipboard
      ?.writeText(formatCode(session.claimCode))
      .then(() => setCopied(true))
      .catch(() => setError("Tidak bisa menyalin otomatis. Pilih kodenya lalu salin manual."));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (name: string) => String(fd.get(name) ?? "").trim();
    setError("");
    startTransition(async () => {
      try {
        const res = await saveSession({
          id: session?.id,
          date,
          title: text("title"),
          client: text("client"),
          contact: text("contact"),
          time: text("time"),
          location: text("location"),
          notes: text("notes"),
          docUrl: docUrl.trim(),
          email: text("email"),
        });
        if (res.ok) onSaved(res.id);
        else setError(res.error);
      } catch {
        setError("Perubahan belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  function remove() {
    if (!session) return;
    setError("");
    startTransition(async () => {
      try {
        const res = await deleteSession(session.id);
        if (res.ok) onDeleted();
        else setError(res.error);
      } catch {
        setError("Sesi belum terhapus. Coba lagi sebentar lagi.");
      }
    });
  }

  return (
    <>
      <form className="form sform" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor={id("title")}>Judul sesi</label>
          <input id={id("title")} name="title" type="text" maxLength={80} placeholder="Contoh: Wisuda Rina" defaultValue={session?.title ?? ""} />
          <p className="muted">Judul ini tampil di kartu sesi milik client di Client Portal.</p>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor={id("client")}>Nama client</label>
            <input id={id("client")} name="client" type="text" maxLength={80} defaultValue={session?.client ?? ""} />
          </div>
          <div className="field">
            <label htmlFor={id("contact")}>Kontak</label>
            <input id={id("contact")} name="contact" type="text" maxLength={80} defaultValue={session?.contact ?? ""} />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor={id("time")}>Jam sesi</label>
            <input id={id("time")} name="time" type="text" maxLength={40} placeholder="09.00 – 12.00" defaultValue={session?.time ?? ""} />
          </div>
          <div className="field">
            <label htmlFor={id("location")}>Lokasi</label>
            <input id={id("location")} name="location" type="text" maxLength={120} defaultValue={session?.location ?? ""} />
          </div>
        </div>
        <div className="field">
          <label htmlFor={id("notes")}>Catatan</label>
          <textarea id={id("notes")} name="notes" maxLength={1500} defaultValue={session?.notes ?? ""} />
        </div>

        <div className="group">
          <h3>Akses client <span className="lock">Hanya pemilik</span></h3>
          {session ? (
            <div className="codebox">
              <div>
                <span className="lab">Kode klaim</span>
                <code className="code">{formatCode(session.claimCode)}</code>
              </div>
              <button type="button" className="btn ghost" onClick={copyCode}>{copied ? "Tersalin" : "Salin kode"}</button>
            </div>
          ) : (
            <p className="muted">Kode klaim dibuat otomatis setelah sesi ini disimpan.</p>
          )}
          <p className="muted">
            Client memasukkan kode ini di Client Portal untuk menambahkan sesi ke akunnya. Beberapa orang bisa memakai
            kode yang sama untuk satu sesi bersama.
            {session ? ` Sudah ${session.memberCount} orang terhubung.` : ""}
          </p>
          <div className="field">
            <label htmlFor={id("email")}>Email Google client (opsional)</label>
            <input id={id("email")} name="email" type="email" maxLength={120} placeholder="nama@gmail.com" />
            <p className="muted">Jika diisi, email ini langsung bisa melihat sesinya tanpa kode.</p>
          </div>
          {session ? (
            <div className="actions">
              <Link className="btn ghost" href={`/client-portal/${session.id}`}>Kelola galeri dan anggota</Link>
            </div>
          ) : null}
        </div>

        <div className="group">
          <h3>Planning di Google Docs <span className="lock">Hanya pemilik</span></h3>
          <div className="field">
            <label htmlFor={id("doc")}>Tautan dokumen</label>
            <input
              id={id("doc")}
              type="url"
              placeholder="https://docs.google.com/document/d/..."
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
            />
          </div>
          <div className="actions">
            <a className="btn ghost" href="https://docs.new" target="_blank" rel="noopener noreferrer">Buat dokumen baru</a>
            {docOk ? (
              <a className="btn ghost" href={docUrl.trim()} target="_blank" rel="noopener noreferrer">Buka planning</a>
            ) : null}
            {previewSrc ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setPreviewOpen(true);
                  dialogRef.current?.showModal();
                }}
              >
                Tampilkan pratinjau
              </button>
            ) : null}
          </div>
          {unsavedDoc ? <p className="muted">Klik Simpan sesi untuk menampilkan pratinjau dokumen ini.</p> : null}
        </div>

        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="actions">
          <button type="submit" className="btn" disabled={pending}>{pending ? "Menyimpan…" : session ? "Simpan sesi" : "Tambah sesi"}</button>
          {onCancel ? <button type="button" className="btn ghost" disabled={pending} onClick={onCancel}>Batal</button> : null}
          {session ? (
            confirmDelete ? (
              <>
                <button type="button" className="btn danger" disabled={pending} onClick={remove}>Ya, hapus sesi ini</button>
                <button type="button" className="btn ghost" disabled={pending} onClick={() => setConfirmDelete(false)}>Batal</button>
              </>
            ) : (
              <button type="button" className="btn ghost" disabled={pending} onClick={() => setConfirmDelete(true)}>Hapus sesi</button>
            )
          ) : null}
        </div>
        {confirmDelete ? (
          <p className="muted">
            Sesi, pilihan foto, dan daftar anggotanya dihapus dari website. Foto di Google Drive tidak ikut terhapus.
          </p>
        ) : null}
      </form>

      {previewSrc ? (
        <dialog
          ref={dialogRef}
          className="doc-dialog"
          aria-labelledby={id("dlg")}
          onClose={() => setPreviewOpen(false)}
          onClick={(e) => {
            // Klik di area gelap di luar kotak menutup modal.
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <div className="doc-dialog-head">
            <h3 id={id("dlg")}>Planning {session?.title || longDate(date)}</h3>
            <div className="actions">
              <a className="btn ghost" href={savedDoc} target="_blank" rel="noopener noreferrer">Buka di Google Docs</a>
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>Tutup</button>
            </div>
          </div>
          {previewOpen ? (
            <iframe
              className="doc-frame"
              src={previewSrc}
              title={`Pratinjau planning ${session?.title || longDate(date)}`}
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          ) : null}
          <p className="muted doc-dialog-note">
            Pratinjau hanya tampil jika browser ini sedang login ke akun Google yang punya akses ke dokumen. Jika kosong,
            pakai Buka di Google Docs.
          </p>
        </dialog>
      ) : null}
    </>
  );
}
