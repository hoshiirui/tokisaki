import "server-only";
import { supabase } from "@/lib/supabase";
import { isSessionId } from "@/lib/portal";

export type Album = {
  id: string;
  title: string;
  description: string;
  eventDate: string | null;
  driveFolderId: string;
  coverFileId: string;
  position: number;
  published: boolean;
};

const COLUMNS = "id,title,description,event_date,drive_folder_id,cover_file_id,position,published";

function toAlbum(r: Record<string, unknown>): Album {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    eventDate: r.event_date ? String(r.event_date) : null,
    driveFolderId: String(r.drive_folder_id ?? ""),
    coverFileId: String(r.cover_file_id ?? ""),
    position: Number(r.position) || 0,
    published: Boolean(r.published),
  };
}

/** Album untuk halaman Portfolio. Draf hanya ikut jika includeDrafts (pemilik). */
export async function getAlbums(includeDrafts: boolean): Promise<Album[]> {
  let q = supabase().from("portfolio_albums").select(COLUMNS);
  if (!includeDrafts) q = q.eq("published", true);
  const { data, error } = await q.order("position", { ascending: true }).order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal membaca portfolio: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(toAlbum);
}

/** Satu album. Draf hanya dikembalikan jika includeDrafts (pemilik). */
export async function getAlbum(id: string, includeDrafts: boolean): Promise<Album | null> {
  if (!isSessionId(id)) return null;
  const { data, error } = await supabase().from("portfolio_albums").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Gagal membaca album: ${error.message}`);
  if (!data) return null;
  const a = toAlbum(data as Record<string, unknown>);
  return a.published || includeDrafts ? a : null;
}
