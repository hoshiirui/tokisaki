"use server";

import { revalidatePath } from "next/cache";
import { isOwner } from "@/auth";
import { isValidKey, parseDriveFolderId } from "@/lib/dates";
import { getFileMeta } from "@/lib/drive";
import { isSessionId } from "@/lib/portal";
import { supabase } from "@/lib/supabase";

type Result = { ok: true } | { ok: false; error: string };

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function refresh(id?: string) {
  revalidatePath("/portfolio");
  if (id) revalidatePath(`/portfolio/${id}`);
}

export type SaveAlbumInput = {
  /** Kosong untuk album baru. */
  id?: string;
  title: string;
  description: string;
  /** YYYY-MM-DD atau kosong. */
  eventDate: string;
  driveFolder: string;
  published: boolean;
};

export async function saveAlbum(input: SaveAlbumInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah portfolio." };
  const title = clip(input.title, 80);
  if (!title) return { ok: false, error: "Judul album wajib diisi." };
  const eventDate = clip(input.eventDate, 10);
  if (eventDate && !isValidKey(eventDate)) return { ok: false, error: "Tanggal tidak valid." };
  const folderRaw = clip(input.driveFolder, 300);
  const folderId = folderRaw ? parseDriveFolderId(folderRaw) : "";
  if (folderId === null) {
    return { ok: false, error: "Tautan folder Drive tidak valid. Salin dari bilah alamat saat folder terbuka di Google Drive." };
  }
  const published = Boolean(input.published);
  if (published && !folderId) return { ok: false, error: "Tautkan folder foto dulu sebelum album ditampilkan." };
  if (input.id && !isSessionId(input.id)) return { ok: false, error: "Album tidak valid." };

  const db = supabase();
  const fields = {
    title,
    description: clip(input.description, 600),
    event_date: eventDate || null,
    drive_folder_id: folderId,
    published,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data: old, error: oErr } = await db.from("portfolio_albums").select("drive_folder_id").eq("id", input.id).maybeSingle();
    if (oErr) return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
    if (!old) return { ok: false, error: "Album tidak ditemukan. Mungkin sudah dihapus." };
    // Ganti folder berarti thumbnail lama tidak berlaku lagi.
    const folderChanged = String((old as Record<string, unknown>).drive_folder_id ?? "") !== folderId;
    const { error } = await db
      .from("portfolio_albums")
      .update(folderChanged ? { ...fields, cover_file_id: "" } : fields)
      .eq("id", input.id);
    if (error) return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
    refresh(input.id);
    return { ok: true, id: input.id };
  }

  // Album baru tampil paling atas.
  const { data: first, error: fErr } = await db.from("portfolio_albums").select("position").order("position", { ascending: true }).limit(1);
  if (fErr) return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
  const top = first?.length ? Number((first[0] as Record<string, unknown>).position) || 0 : 0;
  const { data, error } = await db.from("portfolio_albums").insert({ ...fields, position: top - 1 }).select("id").single();
  if (error || !data) return { ok: false, error: "Gagal menyimpan. Coba lagi sebentar lagi." };
  refresh();
  return { ok: true, id: String((data as Record<string, unknown>).id) };
}

/** Memilih foto thumbnail album. fileId kosong mengembalikan ke foto pertama di folder. */
export async function setAlbumCover(albumId: string, fileId: string): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah portfolio." };
  if (!isSessionId(albumId)) return { ok: false, error: "Album tidak valid." };
  const db = supabase();
  const { data, error } = await db.from("portfolio_albums").select("drive_folder_id").eq("id", albumId).maybeSingle();
  if (error || !data) return { ok: false, error: "Album tidak ditemukan." };
  const folder = String((data as Record<string, unknown>).drive_folder_id ?? "");

  let cover = "";
  if (fileId) {
    try {
      const meta = await getFileMeta(String(fileId));
      if (!meta || !folder || !meta.parents.includes(folder)) return { ok: false, error: "Foto itu tidak ada di folder album ini." };
      cover = meta.id;
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Foto belum bisa diperiksa di Drive. Coba lagi sebentar lagi." };
    }
  }
  const { error: uErr } = await db.from("portfolio_albums").update({ cover_file_id: cover, updated_at: new Date().toISOString() }).eq("id", albumId);
  if (uErr) return { ok: false, error: "Gagal menyimpan thumbnail. Coba lagi sebentar lagi." };
  refresh(albumId);
  return { ok: true };
}

/** Menggeser urutan album satu langkah ke atas atau ke bawah. */
export async function moveAlbum(albumId: string, dir: "up" | "down"): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah portfolio." };
  if (!isSessionId(albumId) || (dir !== "up" && dir !== "down")) return { ok: false, error: "Permintaan tidak valid." };
  const db = supabase();
  const { data, error } = await db
    .from("portfolio_albums")
    .select("id")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: "Gagal mengubah urutan. Coba lagi sebentar lagi." };
  const ids = ((data ?? []) as Record<string, unknown>[]).map((r) => String(r.id));
  const i = ids.indexOf(albumId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  // Nomor urut ditulis ulang 0..n-1 agar tidak ada yang kembar.
  for (let k = 0; k < ids.length; k++) {
    const { error: uErr } = await db.from("portfolio_albums").update({ position: k }).eq("id", ids[k]);
    if (uErr) return { ok: false, error: "Gagal mengubah urutan. Coba lagi sebentar lagi." };
  }
  refresh();
  return { ok: true };
}

/** Menghapus album dari portfolio. Foto di Google Drive tidak ikut terhapus. */
export async function deleteAlbum(albumId: string): Promise<Result> {
  if (!(await isOwner())) return { ok: false, error: "Hanya pemilik yang bisa mengubah portfolio." };
  if (!isSessionId(albumId)) return { ok: false, error: "Album tidak valid." };
  const { error } = await supabase().from("portfolio_albums").delete().eq("id", albumId);
  if (error) return { ok: false, error: "Gagal menghapus album. Coba lagi sebentar lagi." };
  refresh();
  return { ok: true };
}
