"use client";

import { useState } from "react";
import { longDate } from "@/lib/dates";
import type { OwnerSession, PublicDay } from "@/lib/types";
import OwnerDayForm from "./OwnerDayForm";
import OwnerSessionForm from "./OwnerSessionForm";

type Props = {
  date: string;
  day?: PublicDay;
  sessions: OwnerSession[];
  defaultShow: boolean;
  past: boolean;
  onToast: (msg: string) => void;
};

/** Panel pemilik untuk satu tanggal: status tanggal, lalu daftar sesi (bisa lebih dari satu). */
export default function OwnerDay({ date, day, sessions, defaultShow, past, onToast }: Props) {
  // Satu sesi langsung terbuka; dengan beberapa sesi, semuanya tertutup sampai dipilih.
  const [openId, setOpenId] = useState<string | null>(sessions.length === 1 ? sessions[0].id : null);

  return (
    <>
      <h2>{longDate(date)}</h2>
      <p className="muted">
        {past ? "Tanggal ini sudah lewat." : "Atur apa yang dilihat client, lalu tambahkan sesi di tanggal ini."}
      </p>

      <OwnerDayForm key={JSON.stringify(day ?? null)} date={date} day={day} defaultShow={defaultShow} onSaved={() => onToast(`Status tersimpan: ${longDate(date)}`)} />

      <div className="group sessions">
        <h3>Sesi di tanggal ini <span className="lock">{sessions.length}</span></h3>
        {sessions.length === 0 && openId !== "new" ? (
          <p className="muted">Belum ada sesi. Tambahkan sesi untuk menyimpan detail client, planning, dan galeri foto.</p>
        ) : null}

        <ul className="slist">
          {sessions.map((s) => {
            const open = openId === s.id;
            return (
              <li key={s.id} className={open ? "sitem open" : "sitem"}>
                <button
                  type="button"
                  className="shead"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : s.id)}
                >
                  <span className="shead-main">
                    <strong>{s.title || s.client || "Sesi tanpa judul"}</strong>
                    <span className="muted">
                      {[s.client && s.title ? s.client : "", s.time, s.location].filter(Boolean).join(" · ") || "Belum ada detail"}
                    </span>
                  </span>
                  <span className="shead-side">
                    {s.memberCount > 0 ? <span className="docmark">{s.memberCount} orang</span> : null}
                    <span aria-hidden="true">{open ? "−" : "+"}</span>
                  </span>
                </button>
                {open ? (
                  <div className="sbody">
                    <OwnerSessionForm
                      key={`${s.id}|${JSON.stringify(s)}`}
                      date={date}
                      session={s}
                      onSaved={() => onToast(`Sesi tersimpan: ${s.title || s.client || longDate(date)}`)}
                      onDeleted={() => {
                        setOpenId(null);
                        onToast("Sesi dihapus");
                      }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {openId === "new" ? (
          <div className="sitem open">
            <div className="sbody">
              <OwnerSessionForm
                date={date}
                onSaved={(id) => {
                  setOpenId(id);
                  onToast("Sesi ditambahkan");
                }}
                onDeleted={() => setOpenId(null)}
                onCancel={() => setOpenId(null)}
              />
            </div>
          </div>
        ) : (
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => setOpenId("new")}>
              {sessions.length ? "Tambah sesi lain" : "Tambah sesi"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
