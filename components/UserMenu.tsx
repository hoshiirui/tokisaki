"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

type Props = {
  name: string;
  email: string;
  owner: boolean;
  /** Pengguna lama yang belum pernah mengisi profil. */
  needsProfile: boolean;
  /** Server action keluar, diteruskan dari server. */
  signOutAction: () => Promise<void>;
};

/** Nama pengguna di navbar dengan menu: profil, tema terang atau gelap, dan keluar. */
export default function UserMenu({ name, email, owner, needsProfile, signOutAction }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: Theme) {
    setTheme(next);
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Penyimpanan browser diblokir: tema tetap berlaku sampai halaman ditutup.
    }
  }

  return (
    <div className="dd" ref={ref}>
      <button type="button" className="dd-btn user-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="avatar" aria-hidden="true">{(name.trim()[0] ?? "?").toUpperCase()}</span>
        <span className="user-name">{name}</span>
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="dd-panel user-panel">
          <div className="dd-head">
            <strong>{name}</strong>
            <span className="muted">{email}</span>
            {owner ? <span className="docmark">Pemilik</span> : null}
          </div>
          <Link href="/profil" className="dd-item">
            Profil saya
            {needsProfile ? <span className="docmark">Lengkapi</span> : null}
          </Link>
          <div className="dd-row">
            <span className="dd-label" id="theme-label">Tampilan</span>
            <div className="seg-theme" role="group" aria-labelledby="theme-label">
              <button type="button" aria-pressed={theme === "light"} onClick={() => pick("light")}>Terang</button>
              <button type="button" aria-pressed={theme === "dark"} onClick={() => pick("dark")}>Gelap</button>
            </div>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="dd-item dd-out">Keluar</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
