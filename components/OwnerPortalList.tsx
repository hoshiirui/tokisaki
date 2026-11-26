"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { shortDate } from "@/lib/dates";

export type OwnerItem = {
  date: string;
  title: string;
  clientName: string;
  clientEmail: string;
  location: string;
  status: "upcoming" | "preparing" | "choose" | "processing" | "done";
  selectionCount: number;
  maxSelect: number;
  hasEdited: boolean;
};

const LABEL: Record<OwnerItem["status"], string> = {
  upcoming: "Akan datang",
  preparing: "Foto disiapkan",
  choose: "Pilih foto",
  processing: "Diproses",
  done: "Selesai",
};
// Urutan "perlu tindakan dulu": Diproses menunggu diedit, lalu seterusnya sampai Selesai.
const STATUS_ORDER: OwnerItem["status"][] = ["processing", "choose", "preparing", "upcoming", "done"];
const SORTS = [
  { v: "newest", label: "Tanggal terbaru" },
  { v: "oldest", label: "Tanggal terlama" },
  { v: "client", label: "Nama client (A–Z)" },
  { v: "status", label: "Status (perlu tindakan dulu)" },
] as const;
type Sort = (typeof SORTS)[number]["v"];
const PAGE = 40;

function shift(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export default function OwnerPortalList({ items, today }: { items: OwnerItem[]; today: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OwnerItem["status"] | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((x) => {
      if (from && x.date < from) return false;
      if (to && x.date > to) return false;
      if (!needle) return true;
      return [x.title, x.clientName, x.clientEmail, x.location, x.date, shortDate(x.date)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, q, from, to]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: filtered.length };
    for (const x of filtered) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [filtered]);

  const shown = useMemo(() => {
    const list = status === "all" ? [...filtered] : filtered.filter((x) => x.status === status);
    list.sort((a, b) => {
      if (sort === "oldest") return a.date.localeCompare(b.date);
      if (sort === "client") return (a.clientName || "~").localeCompare(b.clientName || "~", "id") || b.date.localeCompare(a.date);
      if (sort === "status") return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.date.localeCompare(a.date);
      return b.date.localeCompare(a.date);
    });
    return list;
  }, [filtered, status, sort]);

  const dirty = q || status !== "all" || from || to || sort !== "newest";
  const month = today.slice(0, 7);
  const presets = [
    { label: "Bulan ini", from: `${month}-01`, to: `${month}-31` },
    { label: "30 hari terakhir", from: shift(today, -30), to: today },
    { label: "Tahun ini", from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` },
  ];

  function reset() {
    setQ("");
    setStatus("all");
    setFrom("");
    setTo("");
    setSort("newest");
    setLimit(PAGE);
  }

  return (
    <>
      <div className="ofilters">
        <div className="field ofield-q">
          <label htmlFor="o-q">Cari</label>
          <input
            id="o-q"
            type="text"
            placeholder="Nama client, email, judul sesi, lokasi, tanggal"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
          />
        </div>
        <div className="field">
          <label htmlFor="o-from">Dari tanggal</label>
          <input id="o-from" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setLimit(PAGE); }} />
        </div>
        <div className="field">
          <label htmlFor="o-to">Sampai tanggal</label>
          <input id="o-to" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setLimit(PAGE); }} />
        </div>
        <div className="field">
          <label htmlFor="o-sort">Urutkan</label>
          <select id="o-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="ochips" role="group" aria-label="Filter status">
        <button type="button" className={status === "all" ? "chip on" : "chip"} aria-pressed={status === "all"} onClick={() => { setStatus("all"); setLimit(PAGE); }}>
          Semua <span className="tab-count">{counts.all}</span>
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            className={status === s ? "chip on" : "chip"}
            aria-pressed={status === s}
            onClick={() => { setStatus(s); setLimit(PAGE); }}
          >
            {LABEL[s]} <span className="tab-count">{counts[s] ?? 0}</span>
          </button>
        ))}
        <span className="ochips-sep" aria-hidden="true" />
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className={from === p.from && to === p.to ? "chip on" : "chip"}
            onClick={() => { setFrom(p.from); setTo(p.to); setLimit(PAGE); }}
          >
            {p.label}
          </button>
        ))}
        {dirty ? <button type="button" className="chip reset" onClick={reset}>Reset</button> : null}
      </div>

      <p className="muted" aria-live="polite">
        Menampilkan {Math.min(limit, shown.length)} dari {shown.length} sesi
        {shown.length !== items.length ? ` (total ${items.length})` : ""}
      </p>

      {shown.length === 0 ? (
        <p className="lede">Tidak ada sesi yang cocok dengan pencarian atau filter ini.</p>
      ) : (
        <ul className="orows">
          {shown.slice(0, limit).map((x) => (
            <li key={x.date}>
              <Link href={`/client-portal/${x.date}`} className="orow">
                <span className="orow-date">{shortDate(x.date)}<small>{x.date.slice(0, 4)}</small></span>
                <span className="orow-main">
                  <strong>{x.title || "Sesi foto"}</strong>
                  <span className="muted">
                    {[x.clientName, x.clientEmail, x.location].filter(Boolean).join(" · ") || "Belum ada data client"}
                  </span>
                </span>
                <span className="orow-pick" title="Foto yang dipilih client">
                  {x.selectionCount > 0 ? `${x.selectionCount}/${x.maxSelect} dipilih` : "Belum memilih"}
                  {x.hasEdited ? <small>folder edit ✓</small> : null}
                </span>
                <span className={`pill s-${x.status}`}>{LABEL[x.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {shown.length > limit ? (
        <div className="actions">
          <button type="button" className="btn ghost" onClick={() => setLimit(limit + PAGE)}>Tampilkan lebih banyak</button>
        </div>
      ) : null}
    </>
  );
}
