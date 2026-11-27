"use client";

import { useState, useTransition, type FormEvent } from "react";
import { saveDay } from "@/app/actions";
import type { DayStatus, PublicDay } from "@/lib/types";

const OPTIONS: { value: DayStatus; label: string }[] = [
  { value: "available", label: "Tersedia" },
  { value: "booked", label: "Terbooking" },
  { value: "blocked", label: "Tidak tersedia" },
];

type Props = {
  date: string;
  day?: PublicDay;
  defaultShow: boolean;
  onSaved: () => void;
};

/** Status tanggal dan info singkat yang dilihat client. Detail tiap sesi ada di form sesi. */
export default function OwnerDayForm({ date, day, defaultShow, onSaved }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const status: DayStatus = day?.status ?? "available";
  const showInfo = day ? day.showInfo : defaultShow;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const res = await saveDay({
          date,
          status: String(fd.get("status") ?? "available") as DayStatus,
          info: String(fd.get("info") ?? "").trim(),
          showInfo: fd.get("showInfo") === "on",
        });
        if (res.ok) onSaved();
        else setError(res.error);
      } catch {
        setError("Perubahan belum tersimpan. Coba lagi sebentar lagi.");
      }
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field">
        <span className="lab" id={`statusLab-${date}`}>Status tanggal</span>
        <div className="radios" role="radiogroup" aria-labelledby={`statusLab-${date}`}>
          {OPTIONS.map((o) => (
            <label key={o.value}>
              <input type="radio" name="status" value={o.value} defaultChecked={o.value === status} />
              {o.label}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor={`f-info-${date}`}>Info untuk client</label>
        <input id={`f-info-${date}`} name="info" type="text" maxLength={80} placeholder="Contoh: Wisuda, sesi pagi" defaultValue={day?.info ?? ""} />
      </div>
      <label className="check" htmlFor={`f-show-${date}`}>
        <input id={`f-show-${date}`} name="showInfo" type="checkbox" defaultChecked={showInfo} />
        <span>Tampilkan info ini ke client. Jika tidak dicentang, client hanya melihat &quot;Sudah terbooking&quot;.</span>
      </label>
      {error ? <p className="err" role="alert">{error}</p> : null}
      <div className="actions">
        <button type="submit" className="btn" disabled={pending}>{pending ? "Menyimpan…" : "Simpan status tanggal"}</button>
      </div>
    </form>
  );
}
