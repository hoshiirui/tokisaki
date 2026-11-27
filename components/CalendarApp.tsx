"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStatus, OwnerSession, PublicDay, Settings } from "@/lib/types";
import { DOW, MONTHS, key, longDate, shortDate } from "@/lib/dates";
import OwnerDay from "./OwnerDay";
import SettingsForm from "./SettingsForm";

const LABEL: Record<DayStatus, string> = {
  available: "Tersedia",
  booked: "Terbooking",
  blocked: "Tidak tersedia",
};

type Props = {
  settings: Settings;
  days: PublicDay[];
  sessions: OwnerSession[] | null;
  isOwner: boolean;
};

function dotClass(s: DayStatus) {
  return s === "available" ? "dot" : `dot ${s}`;
}

export default function CalendarApp({ settings, days, sessions, isOwner }: Props) {
  // Tanggal "hari ini" dihitung di browser agar sesuai zona waktu pengunjung dan tidak memicu mismatch hydration.
  const [today, setToday] = useState<string | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [ownerMode, setOwnerMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const n = new Date();
    setToday(key(n.getFullYear(), n.getMonth(), n.getDate()));
    setView({ y: n.getFullYear(), m: n.getMonth() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  // Satu tanggal bisa punya beberapa sesi.
  const sessionMap = useMemo(() => {
    const m = new Map<string, OwnerSession[]>();
    for (const x of sessions ?? []) m.set(x.date, [...(m.get(x.date) ?? []), x]);
    return m;
  }, [sessions]);

  function sessionNames(list: OwnerSession[] | undefined): string {
    if (!list?.length) return "";
    const first = list[0].client || list[0].title;
    return list.length > 1 ? `${first || "Sesi"} +${list.length - 1}` : first;
  }
  const owner = isOwner && ownerMode;

  const statusOf = (k: string): DayStatus => dayMap.get(k)?.status ?? "available";
  const isPast = (k: string) => today !== null && k < today;

  function shift(n: number) {
    if (!view) return;
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  function select(k: string) {
    setSelected(k);
    if (window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() =>
        document.getElementById("panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      );
    }
  }

  const upcoming = useMemo(() => {
    if (!today) return [];
    return days.filter((d) => d.status === "booked" && d.date >= today).slice(0, 8);
  }, [days, today]);

  function renderGrid() {
    if (!view) return <div className="grid-skeleton" aria-hidden="true" />;
    const first = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
    const count = new Date(view.y, view.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(<div key={`b${i}`} />);
    for (let d = 1; d <= count; d++) {
      const k = key(view.y, view.m, d);
      const st = statusOf(k);
      const day = dayMap.get(k);
      const list = sessionMap.get(k);
      let label = LABEL[st];
      if (owner && st !== "available") label = sessionNames(list) || day?.info || LABEL[st];
      const cls = ["cell", st, isPast(k) ? "past" : "", k === today ? "today" : ""].filter(Boolean).join(" ");
      cells.push(
        <button
          key={k}
          type="button"
          className={cls}
          aria-pressed={k === selected}
          aria-label={`${longDate(k)}, ${LABEL[st]}`}
          onClick={() => select(k)}
        >
          <span className="num">{d}</span>
          <span className="state">
            <i className={dotClass(st)} />
            <span className="tag">{label}</span>
            {owner && list?.some((x) => x.docUrl) ? <span className="docmark">Docs</span> : null}
          </span>
        </button>,
      );
    }
    return (
      <div className="grid">
        {DOW.map((d) => (
          <div className="dow" key={d}>{d}</div>
        ))}
        {cells}
      </div>
    );
  }

  function waLink(k: string) {
    const digits = settings.whatsapp.replace(/\D/g, "");
    if (!digits) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(`Halo, saya ingin booking sesi foto pada ${longDate(k)}.`)}`;
  }

  function renderClientPanel(k: string) {
    const st = statusOf(k);
    const day = dayMap.get(k);
    const link = waLink(k);
    return (
      <>
        <h2>{longDate(k)}</h2>
        <span className={`pill ${st === "available" ? "" : st}`}>
          <i className={dotClass(st)} />
          {LABEL[st]}
        </span>
        <div className="body">
          {st === "available" ? (
            isPast(k) ? (
              <p>Tanggal ini sudah lewat.</p>
            ) : (
              <>
                <p>Tanggal ini masih tersedia untuk sesi foto.</p>
                {link ? (
                  <div className="actions">
                    <a className="btn accent" href={link} target="_blank" rel="noopener noreferrer">
                      Booking lewat WhatsApp
                    </a>
                  </div>
                ) : (
                  <p className="muted">Hubungi studio untuk memesan tanggal ini.</p>
                )}
              </>
            )
          ) : day?.showInfo && day.info ? (
            <>
              <p className="info">{day.info}</p>
              <p className="muted">Informasi dari studio.</p>
            </>
          ) : (
            <p>{st === "booked" ? "Tanggal ini sudah terbooking." : "Studio tidak menerima sesi di tanggal ini."}</p>
          )}
        </div>
      </>
    );
  }

  function renderPanel() {
    if (!selected) {
      return (
        <div className="empty">
          <h2>Pilih tanggal</h2>
          <p>
            {owner
              ? "Klik tanggal di kalender untuk mengatur status, info untuk client, dan sesi-sesi di tanggal itu."
              : "Klik tanggal di kalender untuk melihat apakah sesi masih tersedia."}
          </p>
        </div>
      );
    }
    if (!owner) return renderClientPanel(selected);
    return (
      <OwnerDay
        key={selected}
        date={selected}
        day={dayMap.get(selected)}
        sessions={sessionMap.get(selected) ?? []}
        defaultShow={settings.showInfoDefault}
        past={isPast(selected)}
        onToast={setToast}
      />
    );
  }

  return (
    <>
      <header className="top wrap">
        <div>
          <p className="eyebrow">{settings.studio}</p>
          <h1>Jadwal sesi foto</h1>
          {settings.tagline ? <p className="lede">{settings.tagline}</p> : null}
        </div>
        {isOwner ? (
          <div className="owner-bar">
            <div className="seg" role="group" aria-label="Tampilan halaman">
              <button type="button" aria-pressed={ownerMode} onClick={() => setOwnerMode(true)}>Pemilik</button>
              <button type="button" aria-pressed={!ownerMode} onClick={() => setOwnerMode(false)}>Lihat sebagai client</button>
            </div>
            {owner ? (
              <button type="button" className="btn ghost" onClick={() => setShowSettings((v) => !v)}>Pengaturan</button>
            ) : null}
          </div>
        ) : null}
      </header>

      {owner && showSettings ? (
        <section className="settings wrap">
          <SettingsForm
            settings={settings}
            onSaved={() => setToast("Pengaturan tersimpan")}
            onClose={() => setShowSettings(false)}
          />
        </section>
      ) : null}

      <div className="layout wrap">
        <section>
          <div className="cal-head">
            <h2>{view ? `${MONTHS[view.m]} ${view.y}` : " "}</h2>
            <div className="nav">
              <button type="button" aria-label="Bulan sebelumnya" onClick={() => shift(-1)}>{"‹"}</button>
              <button
                type="button"
                onClick={() => {
                  const n = new Date();
                  setView({ y: n.getFullYear(), m: n.getMonth() });
                }}
              >
                Hari ini
              </button>
              <button type="button" aria-label="Bulan berikutnya" onClick={() => shift(1)}>{"›"}</button>
            </div>
          </div>
          <ul className="legend">
            <li><i className="dot" />Tersedia</li>
            <li><i className="dot booked" />Terbooking</li>
            <li><i className="dot blocked" />Tidak tersedia</li>
          </ul>
          {renderGrid()}

          {owner ? (
            <div className="upcoming">
              <h3>Booking mendatang</h3>
              {upcoming.length === 0 ? (
                <p className="muted">Belum ada booking. Klik tanggal di kalender, pilih Terbooking, lalu simpan.</p>
              ) : (
                <ul>
                  {upcoming.map((d) => {
                    const list = sessionMap.get(d.date);
                    const what = [sessionNames(list), d.info].filter(Boolean).join(" · ") || "Terbooking";
                    return (
                      <li key={d.date}>
                        <button
                          type="button"
                          onClick={() => {
                            const [y, m] = d.date.split("-").map(Number);
                            setView({ y, m: m - 1 });
                            select(d.date);
                          }}
                        >
                          <span className="d">{shortDate(d.date)}</span>
                          <span className="w">{what}</span>
                          {list?.some((x) => x.docUrl) ? <span className="docmark">Docs</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </section>

        <aside className="panel" id="panel" aria-live="polite">
          {renderPanel()}
        </aside>
      </div>

      {toast ? (
        <div id="toast" role="status">{toast}</div>
      ) : null}
    </>
  );
}
