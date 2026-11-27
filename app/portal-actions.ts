"use server";

import { revalidatePath } from "next/cache";
import { auth, isOwner } from "@/auth";
import { normalizeCode } from "@/lib/claim";
import { longDate, parseDriveFolderId } from "@/lib/dates";
import { listImages } from "@/lib/drive";
import { memberEmails, notify, ownerEmail } from "@/lib/notify";
import { nameFor } from "@/lib/profile";
import { getAccessRow, getClientSessionRow, isSessionId, newClaimCode, sessionLabel } from "@/lib/portal";
import { supabase } from "@/lib/supabase";

type Result = { ok: true } | { ok: false; error: string };
type Files = { id: string; name: string }[];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function refresh(id?: string) {
  revalidatePath("/client-portal");
  if (id) revalidatePath(`/client-portal/${id}`);
  revalidatePath("/kalender");
}

/** Client mengirim pilihan foto. Pilihan dikunci dan status berubah menjadi Diproses. */
export async function saveSelection(sessionId: string, fileIds: string[]): Promise<Result> {
  const email = (await auth())?.user?.email?.toLowerCase();
  if (!email) return { ok: false, error: "Silakan login terlebih dahulu." };
  if (!isSessionId(sessionId) || !Array.isArray(fileIds)) return { ok: false, error: "Permintaan tidak valid." };

  let sent: { count: number; label: string } | null = null;
  try {
    const row = await getClientSessionRow(sessionId, email);
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
      .from("sessions")
      .update({ selection, stage: "proses", selection_saved_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("stage", "")
      .select("id");
    if (error) return { ok: false, error: "Pilihan belum tersimpan. Coba lagi sebentar lagi." };
    if (!data?.length) return { ok: false, error: "Pilihan untuk sesi ini sudah dikirim." };
    sent = { count: selection.length, label: row.title || longDate(row.date) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Pilihan belum tersimpan. Coba lagi sebentar lagi." };
  }

  if (sent) {
    const who = await nameFor(email);
    const link = `/client-portal/${sessionId}`;
    const owner = ownerEmail();
    // Anggota lain di sesi yang sama dan pemilik diberi tahu. Pelaku sendiri tidak.
    const others = (await memberEmails(sessionId)).filter((m) => m !== owner);
    await notify(others, { kind: "selection", title: "Pilihan foto sudah dikirim", body: `${who} mengirim ${sent.count} foto pilihan untuk ${sent.label}.`, link }, email);
    await notify([owner], { kind: "selection", title: "Client mengirim pilihan foto", body: `${who} memilih ${sent.count} foto untuk ${sent.label}.`, link }, email);
  }

  refresh(sessionId);
  return { ok: true };
}

/**
 * Daftar foto asli (JPG) sebuah sesi, diminta client hanya saat tab Foto asli dibuka
 * agar halaman sesi tidak memuat ribuan foto sekaligus.
 */
export async function listRawPhotos(sessionId: string): Promise<{ ok: true; files: Files } | { ok: false; error: string }> {
  const email = (await auth())?.user?.email?.toLowerCase();
  if (!email) return { ok: false, error: "Silakan login terlebih dahulu." };
  if (!isSessionId(sessionId)) return { ok: false, error: "Permintaan tidak valid." };
  try {
    const row = await getClientSessionRow(sessionId, email);
    if (!row || !row.driveFolderId) return { ok: false, error: "Foto asli belum tersedia." };
    const files = await listImages(row.driveFolderId);
    return { ok: true, files: files.map((f) => ({ id: f.id, name: f.name })) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Foto asli belum bisa dimuat. Coba lagi sebentar lagi." };
  }
}

/**
 * Client memasukkan kode klaim dari fotografer. Jika cocok, sesi ditambahkan ke akun client.
 * Satu kode bisa dipakai beberapa orang untuk satu sesi bersama. Percobaan salah dibatasi per akun.
 */
export async function claimSession(rawCode: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const email = (await auth())?.user?.email?.toLowerCase();
  if (!email) return { ok: false, error: "Silakan login terlebih dahulu." };
  const code = normalizeCode(rawCode);
  if (code.length < 6 || code.length > 16) return { ok: false, error: "Kode tidak valid. Periksa lagi penulisannya." };

  const db = supabase();
  try {
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count, error: cErr } = await db
      .from("claim_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("ok", false)
      .gte("at", since);
    if (cErr) throw cErr;
    if ((count ?? 0) >= 8) return { ok: false, error: "Terlalu banyak percobaan yang salah. Coba lagi 15 menit lagi." };

    const { data, error } = await db.from("sessions").select("id,title,date").eq("claim_code", code).maybeSingle();
    if (error) throw error;

    // Catatan lama dibersihkan sekalian agar tabel tidak menumpuk.
    await db.from("claim_attempts").delete().lt("at", new Date(Date.now() - 24 * 3600_000).toISOString());

    if (!data) {
      await db.from("claim_attempts").insert({ email, ok: false });
      return { ok: false, error: "Kode tidak ditemukan. Periksa lagi penulisannya atau tanyakan ke fotografer." };
    }
    const id = String((data as Record<string, unknown>).id);
    const { data: added, error: mErr } = await db
      .from("session_members")
      .upsert({ session_id: id, email, source: "kode" }, { onConflict: "session_id,email", ignoreDuplicates: true })
      .select("session_id");
    if (mErr) throw mErr;
    await db.from("claim_attempts").insert({ email, ok: true });
    if (added?.length) {
      // Pemilik diberi tahu hanya saat akun benar-benar baru bergabung.
      const row = data as Record<string, unknown>;
      const label = String(row.title ?? "") || longDate(String(row.date));
      await notify([ownerEmail()], { kind: "claim", title: "Sesi diklaim", body: `${await nameFor(email)} menambahkan ${label} ke akunnya.`, link: `/client-portal/${id}` }, email);
    }
    refresh(id);
    return { ok: true, id };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Kode belum bisa diproses. Coba lagi sebentar lagi." };
  }
}

/** Pemilik meminta daftar foto asli atau hasil edit sebuah sesi (dimuat saat tab dibuka). */
export async function listSessionPhotos(
  sessionId: string,
  kind: "raw" | "edited",
): Promise<{ ok: true; files: Files } | { ok: false; error: string }> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa membuka ini." };
  if (!isSessionId(sessionId) || (kind !== "raw" && kind !== "edited")) return { ok: false, error: "Permintaan tidak valid." };
  try {
    const row = await getAccessRow(sessionId);
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
  id: string;
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
  const id = String(input.id);
  if (!isSessionId(id)) return { ok: false, error: "Sesi tidak valid." };
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

  const { data: before } = await supabase().from("sessions").select("title,date,stage,drive_folder_id").eq("id", id).maybeSingle();
  const { data, error } = await supabase()
    .from("sessions")
    .update({
      stage: input.stage,
      drive_folder_id: driveId,
      edited_folder_id: editedId,
      max_select: max,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
  if (!data?.length) return { ok: false, error: "Sesi tidak ditemukan." };

  // Beri tahu anggota sesi hanya jika ada perubahan yang berarti bagi mereka.
  if (before) {
    const b = before as Record<string, unknown>;
    const label = String(b.title ?? "") || longDate(String(b.date));
    const link = `/client-portal/${id}`;
    const oldStage = String(b.stage ?? "");
    const hadFolder = Boolean(b.drive_folder_id);
    let msg: { title: string; body: string } | null = null;
    if (input.stage !== oldStage) {
      if (input.stage === "selesai") msg = { title: "Foto hasil edit sudah siap", body: `Foto hasil edit ${label} sudah bisa dilihat dan diunduh.` };
      else if (input.stage === "proses") msg = { title: "Status sesi: Diproses", body: `Foto pilihan ${label} sedang diedit.` };
      else msg = { title: "Pilihan foto dibuka kembali", body: `Kamu bisa memilih foto untuk ${label} lagi.` };
    } else if (!hadFolder && driveId && input.stage === "") {
      msg = { title: "Foto siap dipilih", body: `Foto ${label} sudah tersedia. Silakan pilih foto yang ingin diedit.` };
    }
    if (msg) await notify(await memberEmails(id), { kind: "status", ...msg, link });
  }

  refresh(id);
  return { ok: true };
}

/** Membuat kode klaim baru. Kode lama tidak berlaku lagi, tetapi anggota yang sudah klaim tetap punya akses. */
export async function regenerateClaimCode(id: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah kode." };
  if (!isSessionId(id)) return { ok: false, error: "Sesi tidak valid." };
  for (let i = 0; i < 5; i++) {
    const code = newClaimCode();
    const { data, error } = await supabase().from("sessions").update({ claim_code: code }).eq("id", id).select("id");
    if (!error) {
      if (!data?.length) return { ok: false, error: "Sesi tidak ditemukan." };
      refresh(id);
      return { ok: true, code };
    }
    if (error.code !== "23505") return { ok: false, error: "Gagal membuat kode baru. Coba lagi sebentar lagi." };
  }
  return { ok: false, error: "Gagal membuat kode baru. Coba lagi." };
}

export async function addMember(id: string, rawEmail: string): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa menambah anggota." };
  const email = String(rawEmail ?? "").trim().toLowerCase().slice(0, 120);
  if (!isSessionId(id)) return { ok: false, error: "Sesi tidak valid." };
  if (!EMAIL.test(email)) return { ok: false, error: "Email tidak valid. Contoh: nama@gmail.com" };
  const { data: added, error } = await supabase()
    .from("session_members")
    .upsert({ session_id: id, email, source: "email" }, { onConflict: "session_id,email", ignoreDuplicates: true })
    .select("session_id");
  if (error) return { ok: false, error: "Gagal menambah anggota. Coba lagi sebentar lagi." };
  if (added?.length) {
    await notify([email], { kind: "session", title: "Kamu ditambahkan ke sebuah sesi", body: `Sesi ${await sessionLabel(id)} sekarang ada di Client Portal-mu.`, link: `/client-portal/${id}` });
  }
  refresh(id);
  return { ok: true };
}

export async function removeMember(id: string, rawEmail: string): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah anggota." };
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!isSessionId(id) || !email) return { ok: false, error: "Permintaan tidak valid." };
  const { error } = await supabase().from("session_members").delete().eq("session_id", id).eq("email", email);
  if (error) return { ok: false, error: "Gagal menghapus anggota. Coba lagi sebentar lagi." };
  refresh(id);
  return { ok: true };
}
