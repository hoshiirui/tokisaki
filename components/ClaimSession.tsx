"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { claimSession } from "@/app/portal-actions";

/** Client memasukkan kode dari fotografer untuk menambahkan sesi ke akunnya. */
export default function ClaimSession({ prominent = false }: { prominent?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        const res = await claimSession(code);
        if (res.ok) {
          setCode("");
          router.push(`/client-portal/${res.id}`);
        } else setError(res.error);
      } catch {
        setError("Kode belum bisa diproses. Coba lagi sebentar lagi.");
      }
    });
  }

  return (
    <form className={prominent ? "claim prominent" : "claim"} onSubmit={onSubmit}>
      <div className="claim-text">
        <strong>Punya kode sesi?</strong>
        <span className="muted">Masukkan kode dari fotografer untuk menambahkan sesimu ke akun ini.</span>
      </div>
      <div className="claim-row">
        <label className="sr-only" htmlFor="claim-code">Kode sesi</label>
        <input
          id="claim-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          placeholder="XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button type="submit" className="btn" disabled={pending || !code.trim()}>{pending ? "Memeriksa…" : "Klaim sesi"}</button>
      </div>
      {error ? <p className="err" role="alert">{error}</p> : null}
    </form>
  );
}
