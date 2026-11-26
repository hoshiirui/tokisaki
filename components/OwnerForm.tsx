"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { saveDay, type SaveDayInput } from "@/app/actions";
import { docPreviewUrl, driveFolderUrl, isGoogleDocUrl, longDate } from "@/lib/dates";
import type { DayStatus, PrivateDay, PublicDay } from "@/lib/types";

const OPTIONS: { value: DayStatus; label: string }[] = [
  { value: "available", label: "Tersedia" },
  { value: "booked", label: "Terbooking" },
  { value: "blocked", label: "Tidak tersedia" },
];

type Props = {
  date: string;
  day?: PublicDay;
  priv?: PrivateDay;
  defaultShow: boolean;
  past: boolean;
  onSaved: () => void;
};

export default function OwnerForm({ date, day, priv, defaultShow, past, onSaved }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [docUrl, setDocUrl] = useState(priv?.docUrl ?? "");
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Iframe baru dimuat saat modal dibuka, supaya dokumen tidak diambil dari Google sebelum diminta.
  const [previewOpen, setPreviewOpen] = useState(false);
  const docOk = isGoogleDocUrl(docUrl.trim());
  // Pratinjau hanya untuk tautan yang sudah tersimpan, agar iframe tidak dimuat ulang setiap kali mengetik.
  const savedDoc = priv?.docUrl ?? "";
  const previewSrc = docPreviewUrl(savedDoc);
  const unsavedDoc = docOk && docUrl.trim() !== savedDoc;
  const status: DayStatus = day?.status ?? "available";
  const showInfo = day ? day.showInfo : defaultShow;
  const [copied, setCopied] = useState(false);
  const selectionNames = (priv?.selection ?? []).map((s) => s.name).join("\n");

  function copySelection() {
    navigator.clipboard
      ?.writeText(selectionNames)
      .then(() => setCopied(true))
      .catch(() => setError("Tidak bisa menyalin otomatis. Pilih teksnya lalu salin manual."));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (name: string) => String(fd.get(name) ?? "").trim();
    const input: SaveDayInput = {
      date,
      status: text("status") as DayStatus,
      info: text("info"),
      showInfo: fd.get("showInfo") === "on",
      client: text("client"),
      clientEmail: text("clientEmail"),
      contact: text("contact"),
      time: text("time"),
      location: text("location"),
      notes: text("notes"),
      docUrl: docUrl.trim(),
      driveFolder: text("driveFolder"),
      editedFolder: text("editedFolder"),
      maxSelect: Number(text("maxSelect")) || 20,
      stage: text("stage") as SaveDayInput["stage"],
    };
    setError("");
    startTransition(async () => {
      try {
        const res = await saveDay(input);
        if (res.ok) onSaved();
        else setError(res.error);
      } catch {
        setError("Perubahan belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  return (
    <>
      <h2>{longDate(date)}</h2>
      <p className="muted">
        {past ? "Tanggal ini sudah lewat." : "Atur apa yang dilihat client dan simpan detail untuk dirimu sendiri."}
      </p>
      <form className="form" onSubmit={onSubmit}>
        <div className="field">
          <span className="lab" id="statusLab">Status tanggal</span>
          <div className="radios" role="radiogroup" aria-labelledby="statusLab">
            {OPTIONS.map((o) => (
              <label key={o.value}>
                <input type="radio" name="status" value={o.value} defaultChecked={o.value === status} />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-info">Info untuk client</label>
          <input id="f-info" name="info" type="text" maxLength={80} placeholder="Contoh: Prewedding, sesi pagi" defaultValue={day?.info ?? ""} />
        </div>
        <label className="check" htmlFor="f-show">
          <input id="f-show" name="showInfo" type="checkbox" defaultChecked={showInfo} />
          <span>Tampilkan info ini ke client. Jika tidak dicentang, client hanya melihat &quot;Sudah terbooking&quot;.</span>
        </label>

        <div className="group">
          <h3>Detail sesi <span className="lock">Hanya pemilik</span></h3>
          <div className="two">
            <div className="field">
              <label htmlFor="p-client">Nama client</label>
              <input id="p-client" name="client" type="text" maxLength={80} defaultValue={priv?.client ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="p-contact">Kontak</label>
              <input id="p-contact" name="contact" type="text" maxLength={80} defaultValue={priv?.contact ?? ""} />
            </div>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="p-time">Jam sesi</label>
              <input id="p-time" name="time" type="text" maxLength={40} placeholder="09.00 – 12.00" defaultValue={priv?.time ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="p-location">Lokasi</label>
              <input id="p-location" name="location" type="text" maxLength={120} defaultValue={priv?.location ?? ""} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="p-email">Email Google client</label>
            <input id="p-email" name="clientEmail" type="email" maxLength={120} placeholder="nama@gmail.com" defaultValue={priv?.clientEmail ?? ""} />
            <p className="muted">Client yang login dengan email ini bisa melihat sesinya di menu Login.</p>
          </div>
          <div className="field">
            <label htmlFor="p-notes">Catatan</label>
            <textarea id="p-notes" name="notes" maxLength={1500} defaultValue={priv?.notes ?? ""} />
          </div>
        </div>

        <div className="group">
          <h3>Galeri client (Google Drive) <span className="lock">Hanya pemilik</span></h3>
          <div className="field">
            <label htmlFor="p-drive">Folder foto untuk dipilih client</label>
            <input
              id="p-drive"
              name="driveFolder"
              type="url"
              placeholder="https://drive.google.com/drive/folders/..."
              defaultValue={priv?.driveFolderId ? driveFolderUrl(priv.driveFolderId) : ""}
            />
          </div>
          <div className="field">
            <label htmlFor="p-edited">Folder foto hasil edit</label>
            <input
              id="p-edited"
              name="editedFolder"
              type="url"
              placeholder="https://drive.google.com/drive/folders/..."
              defaultValue={priv?.editedFolderId ? driveFolderUrl(priv.editedFolderId) : ""}
            />
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="p-max">Maks. foto dipilih</label>
              <input id="p-max" name="maxSelect" type="number" min={1} max={200} defaultValue={priv?.maxSelect ?? 20} />
            </div>
            <div className="field">
              <label htmlFor="p-stage">Tahap</label>
              <select id="p-stage" name="stage" defaultValue={priv?.stage ?? ""}>
                <option value="">Menunggu pilihan client</option>
                <option value="proses">Diproses</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
          </div>
          <p className="muted">
            Foto hasil edit baru terlihat oleh client setelah tahap Selesai. Tahap berubah ke Diproses otomatis saat
            client mengirim pilihan. Pilih Menunggu pilihan client untuk membuka kembali pilihan.
          </p>
          {selectionNames ? (
            <div className="field">
              <label htmlFor="p-sel">Pilihan client ({priv?.selection.length} foto)</label>
              <textarea id="p-sel" readOnly rows={6} defaultValue={selectionNames} />
              <div className="actions">
                <button type="button" className="btn ghost" onClick={copySelection}>
                  {copied ? "Tersalin" : "Salin nama file"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="group">
          <h3>Planning di Google Docs <span className="lock">Hanya pemilik</span></h3>
          <div className="field">
            <label htmlFor="p-doc">Tautan dokumen</label>
            <input
              id="p-doc"
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
          </div>
          <p className="muted">
            Planning dibuka dan diedit langsung di Google Docs. Tempel tautannya di sini setelah dokumen dibuat.
          </p>
          {previewSrc ? (
            <div className="actions">
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
            </div>
          ) : null}
          {unsavedDoc ? <p className="muted">Klik Simpan untuk menampilkan pratinjau dokumen ini.</p> : null}
        </div>

        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="actions">
          <button type="submit" className="btn" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </form>

      {previewSrc ? (
        <dialog
          ref={dialogRef}
          className="doc-dialog"
          aria-labelledby="doc-dialog-title"
          onClose={() => setPreviewOpen(false)}
          onClick={(e) => {
            // Klik di area gelap di luar kotak menutup modal.
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <div className="doc-dialog-head">
            <h3 id="doc-dialog-title">Planning {longDate(date)}</h3>
            <div className="actions">
              <a className="btn ghost" href={savedDoc} target="_blank" rel="noopener noreferrer">Buka di Google Docs</a>
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>Tutup</button>
            </div>
          </div>
          {previewOpen ? (
            <iframe
              className="doc-frame"
              src={previewSrc}
              title={`Pratinjau planning ${longDate(date)}`}
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
