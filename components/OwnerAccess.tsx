"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { addMember, regenerateClaimCode, removeMember } from "@/app/portal-actions";
import { formatCode } from "@/lib/claim";

type Member = { email: string; source: "kode" | "email" | "pemilik" };

const SOURCE: Record<Member["source"], string> = {
  kode: "lewat kode",
  email: "ditambahkan pemilik",
  pemilik: "pemilik",
};

/** Kode klaim sesi dan daftar orang yang sudah punya akses. */
export default function OwnerAccess({ id, claimCode, members }: { id: string; claimCode: string; members: Member[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [email, setEmail] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError("");
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          after?.();
          router.refresh();
        } else setError(res.error ?? "Gagal menyimpan. Coba lagi sebentar lagi.");
      } catch {
        setError("Perubahan belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  function copy() {
    navigator.clipboard
      ?.writeText(formatCode(claimCode))
      .then(() => setCopied(true))
      .catch(() => setError("Tidak bisa menyalin otomatis. Pilih kodenya lalu salin manual."));
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    run(() => addMember(id, email), () => setEmail(""));
  }

  return (
    <div className="opanel access">
      <div className="codebox">
        <div>
          <span className="lab">Kode klaim</span>
          <code className="code">{formatCode(claimCode)}</code>
        </div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={copy}>{copied ? "Tersalin" : "Salin kode"}</button>
          {confirmNew ? (
            <>
              <button
                type="button"
                className="btn danger"
                disabled={pending}
                onClick={() => run(async () => regenerateClaimCode(id), () => { setConfirmNew(false); setCopied(false); })}
              >
                Ya, buat kode baru
              </button>
              <button type="button" className="btn ghost" disabled={pending} onClick={() => setConfirmNew(false)}>Batal</button>
            </>
          ) : (
            <button type="button" className="btn ghost" disabled={pending} onClick={() => setConfirmNew(true)}>Buat kode baru</button>
          )}
        </div>
      </div>
      <p className="muted">
        Bagikan kode ini ke client. Beberapa orang bisa memakai kode yang sama untuk satu sesi bersama. Membuat kode baru
        mematikan kode lama, tetapi orang yang sudah klaim tetap punya akses.
      </p>

      <h3>Anggota sesi <span className="lock">{members.length}</span></h3>
      {members.length === 0 ? (
        <p className="muted">Belum ada yang mengklaim sesi ini.</p>
      ) : (
        <ul className="members">
          {members.map((m) => (
            <li key={m.email}>
              <span className="members-main">
                <strong>{m.email}</strong>
                <span className="muted">{SOURCE[m.source]}</span>
              </span>
              <button type="button" className="btn ghost" disabled={pending} onClick={() => run(() => removeMember(id, m.email))}>
                Hapus akses
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="claim-row" onSubmit={onAdd}>
        <label className="sr-only" htmlFor="add-member">Email anggota baru</label>
        <input id="add-member" type="email" placeholder="Tambah anggota lewat email (opsional)" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className="btn ghost" disabled={pending || !email.trim()}>Tambah</button>
      </form>
      {error ? <p className="err" role="alert">{error}</p> : null}
    </div>
  );
}
