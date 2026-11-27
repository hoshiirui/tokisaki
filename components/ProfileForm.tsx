"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveProfile } from "@/app/user-actions";

type Props = {
  email: string;
  initialName: string;
  initialContact: string;
  /** onboarding: setelah login pertama, lalu lanjut ke `next`. edit: halaman profil biasa. */
  mode: "onboarding" | "edit";
  next?: string;
};

export default function ProfileForm({ email, initialName, initialContact, mode, next = "/client-portal" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await saveProfile({
          displayName: String(fd.get("displayName") ?? ""),
          contact: String(fd.get("contact") ?? ""),
        });
        if (!res.ok) return setError(res.error);
        if (mode === "onboarding") router.push(next);
        else {
          setSaved(true);
          router.refresh();
        }
      } catch {
        setError("Profil belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  return (
    <form className="form opanel profile-form" onSubmit={onSubmit} onChange={() => setSaved(false)}>
      <div className="field">
        <label htmlFor="pf-email">Akun Google</label>
        <input id="pf-email" type="email" value={email} readOnly disabled />
      </div>
      <div className="field">
        <label htmlFor="pf-name">Nama tampilan</label>
        <input id="pf-name" name="displayName" type="text" required minLength={2} maxLength={40} autoComplete="nickname" defaultValue={initialName} />
        <p className="muted">Nama ini tampil di menu dan terlihat oleh fotografer.</p>
      </div>
      <div className="field">
        <label htmlFor="pf-contact">Kontak (opsional)</label>
        <input id="pf-contact" name="contact" type="text" maxLength={80} placeholder="Nomor WhatsApp atau Instagram" autoComplete="off" defaultValue={initialContact} />
        <p className="muted">Hanya terlihat oleh fotografer, untuk menghubungi kamu soal sesi.</p>
      </div>
      {error ? <p className="err" role="alert">{error}</p> : null}
      <div className="actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Menyimpan…" : mode === "onboarding" ? "Lanjutkan" : "Simpan profil"}
        </button>
        {saved ? <span className="muted" role="status">Tersimpan.</span> : null}
      </div>
    </form>
  );
}
