"use server";

import { revalidatePath } from "next/cache";
import { isOwner } from "@/auth";
import { supabase } from "@/lib/supabase";
import { isGoogleDocUrl, isValidKey, longDate } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { isSessionId, newClaimCode } from "@/lib/portal";
import type { DayStatus } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function refresh() {
  revalidatePath("/");
  revalidatePath("/kalender");
  revalidatePath("/client-portal");
}

export type SaveDayInput = {
  date: string;
  status: DayStatus;
  info: string;
  showInfo: boolean;
};

/** Status tanggal dan info yang dilihat client. Detail sesi disimpan terpisah lewat saveSession. */
export async function saveDay(input: SaveDayInput): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah kalender." };

  const date = String(input.date);
  if (!isValidKey(date)) return { ok: false, error: "Tanggal tidak valid." };
  if (!["available", "booked", "blocked"].includes(input.status)) return { ok: false, error: "Status tidak valid." };

  const db = supabase();
  if (input.status === "available") {
    const { count, error: cErr } = await db.from("sessions").select("id", { count: "exact", head: true }).eq("date", date);
    if (cErr) return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Tanggal ini masih punya ${count} sesi. Hapus sesinya dulu, atau pilih status Terbooking.`,
      };
    }
    const { error } = await db.from("bookings").delete().eq("date", date);
    if (error) return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
  } else {
    const { error } = await db.from("bookings").upsert({
      date,
      status: input.status,
      public_info: clip(input.info, 80),
      show_info: Boolean(input.showInfo),
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
  }

  refresh();
  return { ok: true };
}

export type SaveSessionInput = {
  /** Kosong untuk sesi baru. */
  id?: string;
  date: string;
  title: string;
  client: string;
  contact: string;
  time: string;
  location: string;
  notes: string;
  docUrl: string;
  /** Opsional. Email ini langsung menjadi anggota sesi. */
  email: string;
};

/** Membuat atau mengubah satu sesi. Satu tanggal bisa punya beberapa sesi. */
export async function saveSession(input: SaveSessionInput): Promise<(Result & { ok: true; id: string }) | { ok: false; error: string }> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah sesi." };

  const date = String(input.date);
  if (!isValidKey(date)) return { ok: false, error: "Tanggal tidak valid." };
  const docUrl = clip(input.docUrl, 600);
  if (docUrl && !isGoogleDocUrl(docUrl)) {
    return { ok: false, error: "Tautan harus berupa dokumen Google Docs, diawali https://docs.google.com/document/" };
  }
  const email = clip(input.email, 120).toLowerCase();
  if (email && !EMAIL.test(email)) return { ok: false, error: "Email tidak valid. Contoh: nama@gmail.com" };
  if (input.id && !isSessionId(input.id)) return { ok: false, error: "Sesi tidak valid." };

  const fields = {
    title: clip(input.title, 80),
    client: clip(input.client, 80),
    contact: clip(input.contact, 80),
    session_time: clip(input.time, 40),
    location: clip(input.location, 120),
    notes: clip(input.notes, 1500),
    doc_url: docUrl,
    updated_at: new Date().toISOString(),
  };

  const db = supabase();
  let id = input.id ?? "";

  if (id) {
    const { data, error } = await db.from("sessions").update(fields).eq("id", id).select("id");
    if (error) return { ok: false, error: "Gagal menyimpan sesi. Coba lagi sebentar lagi." };
    if (!data?.length) return { ok: false, error: "Sesi tidak ditemukan. Mungkin sudah dihapus." };
  } else {
    // Tanggal yang belum terbooking otomatis menjadi Terbooking. Status yang sudah ada tidak diubah.
    const { data: day, error: dErr } = await db.from("bookings").select("date").eq("date", date).maybeSingle();
    if (dErr) return { ok: false, error: "Gagal menyimpan sesi. Coba lagi sebentar lagi." };
    if (!day) {
      const { error } = await db.from("bookings").insert({ date, status: "booked", public_info: "", show_info: true });
      if (error) return { ok: false, error: "Gagal menyimpan sesi. Coba lagi sebentar lagi." };
    }
    // Kode klaim harus unik; ulangi jika kebetulan bentrok.
    let created = false;
    for (let i = 0; i < 5 && !created; i++) {
      const { data, error } = await db
        .from("sessions")
        .insert({ ...fields, date, claim_code: newClaimCode() })
        .select("id")
        .single();
      if (!error && data) {
        id = String((data as Record<string, unknown>).id);
        created = true;
      } else if (error?.code !== "23505") {
        return { ok: false, error: "Gagal menyimpan sesi. Coba lagi sebentar lagi." };
      }
    }
    if (!created) return { ok: false, error: "Gagal membuat kode sesi. Coba lagi." };
  }

  if (email) {
    const { data: added, error } = await db
      .from("session_members")
      .upsert({ session_id: id, email, source: "email" }, { onConflict: "session_id,email", ignoreDuplicates: true })
      .select("session_id");
    if (error) return { ok: false, error: "Sesi tersimpan, tetapi email gagal ditambahkan sebagai anggota." };
    if (added?.length) {
      await notify([email], {
        kind: "session",
        title: "Kamu ditambahkan ke sebuah sesi",
        body: `Sesi ${fields.title || longDate(date)} sekarang ada di Client Portal-mu.`,
        link: `/client-portal/${id}`,
      });
    }
  }

  refresh();
  revalidatePath(`/client-portal/${id}`);
  return { ok: true, id };
}

/** Menghapus satu sesi beserta daftar anggotanya. Foto di Google Drive tidak disentuh. */
export async function deleteSession(id: string): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa menghapus sesi." };
  if (!isSessionId(id)) return { ok: false, error: "Sesi tidak valid." };
  const { error } = await supabase().from("sessions").delete().eq("id", id);
  if (error) return { ok: false, error: "Gagal menghapus sesi. Coba lagi sebentar lagi." };
  refresh();
  return { ok: true };
}

export type SaveSettingsInput = {
  studio: string;
  tagline: string;
  whatsapp: string;
  showInfoDefault: boolean;
};

export async function saveSettings(input: SaveSettingsInput): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah pengaturan." };

  const { error } = await supabase().from("settings").upsert({
    id: 1,
    studio: clip(input.studio, 60) || "Studio Foto",
    tagline: clip(input.tagline, 140),
    whatsapp: clip(input.whatsapp, 20).replace(/\D/g, ""),
    show_info_default: Boolean(input.showInfoDefault),
  });
  if (error) return { ok: false, error: "Gagal menyimpan pengaturan. Coba lagi sebentar lagi." };

  revalidatePath("/");
  return { ok: true };
}
