"use client";

import { useState, useTransition, type FormEvent } from "react";
import { saveSettings } from "@/app/actions";
import type { Settings } from "@/lib/types";

type Props = {
  settings: Settings;
  onSaved: () => void;
  onClose: () => void;
};

export default function SettingsForm({ settings, onSaved, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (name: string) => String(fd.get(name) ?? "").trim();
    const input = {
      studio: text("studio"),
      tagline: text("tagline"),
      whatsapp: text("whatsapp"),
      showInfoDefault: fd.get("showInfoDefault") === "on",
    };
    setError("");
    startTransition(async () => {
      try {
        const res = await saveSettings(input);
        if (res.ok) onSaved();
        else setError(res.error);
      } catch {
        setError("Pengaturan belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  return (
    <>
      <h2>Pengaturan halaman</h2>
      <form className="form" onSubmit={onSubmit}>
        <div className="two">
          <div className="field">
            <label htmlFor="s-studio">Nama studio</label>
            <input id="s-studio" name="studio" type="text" maxLength={60} defaultValue={settings.studio} />
          </div>
          <div className="field">
            <label htmlFor="s-wa">Nomor WhatsApp (dengan kode negara)</label>
            <input id="s-wa" name="whatsapp" type="tel" placeholder="6281234567890" defaultValue={settings.whatsapp} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="s-tagline">Kalimat pembuka untuk client</label>
          <input id="s-tagline" name="tagline" type="text" maxLength={140} defaultValue={settings.tagline} />
        </div>
        <label className="check" htmlFor="s-show">
          <input id="s-show" name="showInfoDefault" type="checkbox" defaultChecked={settings.showInfoDefault} />
          <span>Tampilkan info singkat ke client secara default untuk tanggal yang terbooking.</span>
        </label>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="actions">
          <button type="submit" className="btn" disabled={pending}>{pending ? "Menyimpan…" : "Simpan pengaturan"}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Tutup</button>
        </div>
      </form>
    </>
  );
}
