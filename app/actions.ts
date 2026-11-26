"use server";

import { revalidatePath } from "next/cache";
import { isOwner } from "@/auth";
import { supabase } from "@/lib/supabase";
import { isGoogleDocUrl, isValidKey, parseDriveFolderId } from "@/lib/dates";
import type { DayStatus } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

export type SaveDayInput = {
  date: string;
  status: DayStatus;
  info: string;
  showInfo: boolean;
  client: string;
  clientEmail: string;
  contact: string;
  time: string;
  location: string;
  notes: string;
  docUrl: string;
  driveFolder: string;
  editedFolder: string;
  maxSelect: number;
  stage: "" | "proses" | "selesai";
};

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function saveDay(input: SaveDayInput): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah kalender." };

  const date = String(input.date);
  if (!isValidKey(date)) return { ok: false, error: "Tanggal tidak valid." };
  if (!["available", "booked", "blocked"].includes(input.status)) return { ok: false, error: "Status tidak valid." };

  const docUrl = clip(input.docUrl, 600);
  if (docUrl && !isGoogleDocUrl(docUrl)) {
    return { ok: false, error: "Tautan harus berupa dokumen Google Docs, diawali https://docs.google.com/document/" };
  }

  const clientEmail = clip(input.clientEmail, 120).toLowerCase();
  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return { ok: false, error: "Email client tidak valid. Contoh: nama@gmail.com" };
  }

  const driveRaw = clip(input.driveFolder, 300);
  const editedRaw = clip(input.editedFolder, 300);
  const driveFolderId = driveRaw ? parseDriveFolderId(driveRaw) : "";
  const editedFolderId = editedRaw ? parseDriveFolderId(editedRaw) : "";
  if (driveFolderId === null || editedFolderId === null) {
    return { ok: false, error: "Tautan folder Drive tidak valid. Salin dari bilah alamat saat folder terbuka di Google Drive." };
  }
  if (!["", "proses", "selesai"].includes(input.stage)) return { ok: false, error: "Tahap tidak valid." };
  const maxSelect = Math.round(Number(input.maxSelect));
  if (!Number.isFinite(maxSelect) || maxSelect < 1 || maxSelect > 200) {
    return { ok: false, error: "Maksimal foto dipilih harus antara 1 dan 200." };
  }

  const db = supabase();

  if (input.status === "available") {
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

  const priv = {
    client: clip(input.client, 80),
    client_email: clientEmail,
    contact: clip(input.contact, 80),
    session_time: clip(input.time, 40),
    location: clip(input.location, 120),
    notes: clip(input.notes, 1500),
    doc_url: docUrl,
    drive_folder_id: driveFolderId,
    edited_folder_id: editedFolderId,
    max_select: maxSelect,
    stage: input.stage,
  };
  const hasPriv =
    [
      priv.client, priv.client_email, priv.contact, priv.session_time, priv.location, priv.notes,
      priv.doc_url, priv.drive_folder_id, priv.edited_folder_id, priv.stage,
    ].some(Boolean) || priv.max_select !== 20;
  if (hasPriv) {
    const { error } = await db.from("booking_private").upsert({ date, ...priv, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: "Info client tersimpan, tetapi detail privat gagal disimpan." };
  } else {
    const { error } = await db.from("booking_private").delete().eq("date", date);
    if (error) return { ok: false, error: "Info client tersimpan, tetapi detail privat gagal dihapus." };
  }

  revalidatePath("/");
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
