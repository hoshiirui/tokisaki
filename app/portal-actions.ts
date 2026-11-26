"use server";

import { revalidatePath } from "next/cache";
import { auth, isOwner } from "@/auth";
import { isValidKey, parseDriveFolderId } from "@/lib/dates";
import { listImages } from "@/lib/drive";
import { getAccessRow, getClientSessionRow } from "@/lib/portal";
import { supabase } from "@/lib/supabase";

type Result = { ok: true } | { ok: false; error: string };

/** Client mengirim pilihan foto. Pilihan dikunci dan status berubah menjadi Diproses. */
export async function saveSelection(date: string, fileIds: string[]): Promise<Result> {
  const email = (await auth())?.user?.email?.toLowerCase();
  if (!email) return { ok: false, error: "Silakan login terlebih dahulu." };
  if (!isValidKey(date) || !Array.isArray(fileIds)) return { ok: false, error: "Permintaan tidak valid." };

  try {
    const row = await getClientSessionRow(date, email);
    if (!row) return { ok: false, error: "Sesi tidak ditemukan." };
    if (row.stage !== "") return { ok: false, error: "Pilihan untuk sesi ini sudah dikirim." };
    if (!row.driveFolderId) return { ok: false, error: "Foto belum tersedia untuk dipilih." };

    const unique = [...new Set(fileIds.map(String))];
    if (unique.length < 1) return { ok: false, error: "Pilih minimal satu foto." };
    if (unique.length > row.maxSelect) return { ok: false, error: `Maksimal ${row.maxSelect} foto.` };

    // Hanya terima file yang benar-benar ada di folder sesi ini; nama file diambil dari Drive.
    const files = await listImages(row.driveFolderId);
    const names = new Map(files.map((f) => [f.id, f.name]));
    const selection: { id: string; name: string }[] = [];
    for (const id of unique) {
      const name = names.get(id);
      if (!name) return { ok: false, error: "Ada foto yang tidak ditemukan. Muat ulang halaman lalu coba lagi." };
      selection.push({ id, name });
    }

    const { data, error } = await supabase()
      .from("booking_private")
      .update({ selection, stage: "proses", selection_saved_at: new Date().toISOString() })
      .eq("date", date)
      .eq("client_email", email)
      .eq("stage", "")
      .select("date");
    if (error) return { ok: false, error: "Pilihan belum tersimpan. Coba lagi sebentar lagi." };
    if (!data?.length) return { ok: false, error: "Pilihan untuk sesi ini sudah dikirim." };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Pilihan belum tersimpan. Coba lagi sebentar lagi." };
  }

  revalidatePath("/client-portal");
  revalidatePath(`/client-portal/${date}`);
  revalidatePath("/kalender");
  return { ok: true };
}

/**
 * Daftar foto asli (JPG) sebuah sesi, diminta client hanya saat tab Foto asli dibuka
 * agar halaman sesi tidak memuat ribuan foto sekaligus.
 */
export async function listRawPhotos(
  date: string,
): Promise<{ ok: true; files: { id: string; name: string }[] } | { ok: false; error: string }> {
  const email = (await auth())?.user?.email?.toLowerCase();
  if (!email) return { ok: false, error: "Silakan login terlebih dahulu." };
  if (!isValidKey(date)) return { ok: false, error: "Permintaan tidak valid." };
  try {
    const row = await getClientSessionRow(date, email);
    if (!row || !row.driveFolderId) return { ok: false, error: "Foto asli belum tersedia." };
    const files = await listImages(row.driveFolderId);
    return { ok: true, files: files.map((f) => ({ id: f.id, name: f.name })) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Foto asli belum bisa dimuat. Coba lagi sebentar lagi." };
  }
}

/** Pemilik meminta daftar foto asli atau hasil edit sebuah sesi (dimuat saat tab dibuka). */
export async function listSessionPhotos(
  date: string,
  kind: "raw" | "edited",
): Promise<{ ok: true; files: { id: string; name: string }[] } | { ok: false; error: string }> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa membuka ini." };
  if (!isValidKey(date) || (kind !== "raw" && kind !== "edited")) return { ok: false, error: "Permintaan tidak valid." };
  try {
    const row = await getAccessRow(date);
    const folder = kind === "raw" ? row?.driveFolderId : row?.editedFolderId;
    if (!folder) return { ok: false, error: kind === "raw" ? "Folder foto asli belum ditautkan." : "Folder hasil edit belum ditautkan." };
    const files = await listImages(folder);
    return { ok: true, files: files.map((f) => ({ id: f.id, name: f.name })) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Foto belum bisa dimuat dari Drive. Coba lagi sebentar lagi." };
  }
}

export type OwnerSessionInput = {
  date: string;
  stage: "" | "proses" | "selesai";
  driveFolder: string;
  editedFolder: string;
  maxSelect: number;
};

/**
 * Pemilik mengubah tahap dan folder Drive sebuah sesi. Hanya kolom ini yang diubah,
 * jadi detail lain (catatan, kontak, planning) dan pilihan client tidak ikut tertimpa.
 */
export async function saveSessionAdmin(input: OwnerSessionInput): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah sesi." };
  const date = String(input.date);
  if (!isValidKey(date)) return { ok: false, error: "Tanggal tidak valid." };
  if (!["", "proses", "selesai"].includes(input.stage)) return { ok: false, error: "Tahap tidak valid." };
  const driveRaw = String(input.driveFolder ?? "").trim().slice(0, 300);
  const editedRaw = String(input.editedFolder ?? "").trim().slice(0, 300);
  const driveId = driveRaw ? parseDriveFolderId(driveRaw) : "";
  const editedId = editedRaw ? parseDriveFolderId(editedRaw) : "";
  if (driveId === null || editedId === null) {
    return { ok: false, error: "Tautan folder Drive tidak valid. Salin dari bilah alamat saat folder terbuka di Google Drive." };
  }
  const max = Math.round(Number(input.maxSelect));
  if (!Number.isFinite(max) || max < 1 || max > 200) return { ok: false, error: "Maksimal foto dipilih harus antara 1 dan 200." };
  if (input.stage === "selesai" && !editedId) {
    return { ok: false, error: "Tautkan folder hasil edit dulu sebelum menandai sesi Selesai." };
  }

  const { data, error } = await supabase()
    .from("booking_private")
    .update({
      stage: input.stage,
      drive_folder_id: driveId,
      edited_folder_id: editedId,
      max_select: max,
      updated_at: new Date().toISOString(),
    })
    .eq("date", date)
    .select("date");
  if (error) return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
  if (!data?.length) return { ok: false, error: "Sesi tidak ditemukan." };

  revalidatePath("/client-portal");
  revalidatePath(`/client-portal/${date}`);
  revalidatePath("/kalender");
  return { ok: true };
}
