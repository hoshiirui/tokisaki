"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getNotifications, getUnreadCount, markNotificationsRead, type NotificationItem } from "@/app/user-actions";

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.round((t - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 60) return "baru saja";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Lonceng notifikasi: jumlah belum dibaca, daftar terbaru, dan tandai dibaca. */
export default function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await getNotifications();
      if (res.ok) {
        setItems(res.items);
        setUnread(res.unread);
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Jumlah belum dibaca disegarkan tiap menit selama tab terlihat.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        setUnread(await getUnreadCount());
      } catch {
        // Diam saja; percobaan berikutnya menyusul.
      }
    }, 60_000);
    return () => clearInterval(id);
  }, []);

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

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void load();
  }

  async function openItem(n: NotificationItem) {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      setUnread((u) => Math.max(0, u - 1));
      void markNotificationsRead([n.id]).catch(() => undefined);
    }
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    setUnread(0);
    try {
      await markNotificationsRead();
    } catch {
      void load();
    }
  }

  return (
    <div className="dd" ref={ref}>
      <button
        type="button"
        className="dd-btn bell-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
        onClick={toggle}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 ? <span className="bell-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="dd-panel bell-panel">
          <div className="dd-head dd-head-row">
            <strong>Notifikasi</strong>
            {unread > 0 ? <button type="button" className="linklike" onClick={() => void readAll()}>Tandai semua dibaca</button> : null}
          </div>
          {loading && !items ? (
            <p className="muted dd-empty">Memuat…</p>
          ) : failed && !items ? (
            <p className="muted dd-empty">Notifikasi belum bisa dimuat. <button type="button" className="linklike" onClick={() => void load()}>Coba lagi</button></p>
          ) : items && items.length === 0 ? (
            <p className="muted dd-empty">Belum ada notifikasi. Kabar tentang sesimu akan muncul di sini.</p>
          ) : (
            <ul className="notifs">
              {(items ?? []).map((n) => (
                <li key={n.id}>
                  <button type="button" className={n.read ? "notif" : "notif unread"} onClick={() => void openItem(n)}>
                    {!n.read ? <span className="notif-dot" aria-label="Belum dibaca" /> : <span className="notif-dot off" aria-hidden="true" />}
                    <span className="notif-main">
                      <strong>{n.title}</strong>
                      {n.body ? <span>{n.body}</span> : null}
                      <small className="muted">{timeAgo(n.createdAt)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
