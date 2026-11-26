"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const ITEMS = [
  { href: "/", label: "Home" },
  { href: "/kalender", label: "Kalender" },
  { href: "/pricelist", label: "Pricelist" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/client-portal", label: "Client Portal" },
];

type Props = {
  brand: string;
  /** Tombol Login atau Keluar, dirender di server. */
  auth: ReactNode;
};

export default function NavLinks({ brand, auth }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Menu ponsel menutup sendiri setelah pindah halaman.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="site-nav" aria-label="Menu utama">
      <Link href="/" className="brand">{brand}</Link>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="nav-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Tutup" : "Menu"}
      </button>
      <div id="nav-menu" className={open ? "nav-menu open" : "nav-menu"}>
        <ul>
          {ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="nav-auth">{auth}</div>
      </div>
    </nav>
  );
}
