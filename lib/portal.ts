import "server-only";
import { randomInt } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { isValidKey } from "@/lib/dates";

export type Stage = "" | "proses" | "selesai";
export type PortalStatus = "upcoming" | "preparing" | "choose" | "processing" | "done";
export type SelectedFile = { id: string; name: string };

export const STATUS_LABEL: Record<PortalStatus, string> = {
  upcoming: "Akan datang",
  preparing: "Foto disiapkan",
  choose: "Pilih foto",
  processing: "Diproses",
  done: "Selesai",
};

/** Sesi apa adanya untuk client. Tidak memuat kode klaim, daftar anggota, kontak, atau catatan. */
export type SessionRow = {
  id: string;
  date: string;
  title: string;
  clientName: string;
  location: string;
  time: string;
  driveFolderId: string;
  editedFolderId: string;
  maxSelect: number;
  stage: Stage;
  selection: SelectedFile[];
  selectionSavedAt: string | null;
};

export type Member = { email: string; source: "kode" | "email" | "pemilik"; createdAt: string };

/** Hanya untuk pemilik. */
export type OwnerSessionRow = SessionRow & { claimCode: string; memberCount: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isSessionId = (v: string) => UUID.test(v);

export function portalStatus(date: string, today: string, hasPhotos: boolean, stage: Stage): PortalStatus {
  if (stage === "selesai") return "done";
  if (stage === "proses") return "processing";
  if (date > today) return "upcoming";
  return hasPhotos ? "choose" : "preparing";
}

export function studioTimeZone(): string {
  return process.env.STUDIO_TIMEZONE || "Asia/Makassar";
}

/** Kode klaim 8 karakter tanpa huruf dan angka yang mudah tertukar (0, O, 1, I, L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newClaimCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

function parseSelection(v: unknown): SelectedFile[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x?.id === "string" && typeof x?.name === "string")
    .map((x) => ({ id: String(x.id), name: String(x.name) }));
}

function toRow(r: Record<string, unknown>): SessionRow {
  const stage = r.stage === "proses" || r.stage === "selesai" ? r.stage : "";
  return {
    id: String(r.id),
    date: String(r.date),
    title: String(r.title ?? ""),
    clientName: String(r.client ?? ""),
    location: String(r.location ?? ""),
    time: String(r.session_time ?? ""),
    driveFolderId: String(r.drive_folder_id ?? ""),
    editedFolderId: String(r.edited_folder_id ?? ""),
    maxSelect: Number(r.max_select) > 0 ? Number(r.max_select) : 20,
    stage,
    selection: parseSelection(r.selection),
    selectionSavedAt: r.selection_saved_at ? String(r.selection_saved_at) : null,
  };
}

const COLUMNS =
  "id,date,title,client,location,session_time,drive_folder_id,edited_folder_id,max_select,stage,selection,selection_saved_at";

function memberCountOf(r: Record<string, unknown>): number {
  const m = r.session_members as { count?: number }[] | undefined;
  return Array.isArray(m) && m[0]?.count ? Number(m[0].count) : 0;
}

/** Apakah email ini anggota sesi. Email berasal dari sesi login, bukan dari input pengunjung. */
export async function isMember(sessionId: string, email: string): Promise<boolean> {
  if (!isSessionId(sessionId)) return false;
  const { data, error } = await supabase()
    .from("session_members")
    .select("session_id")
    .eq("session_id", sessionId)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Gagal memeriksa akses sesi: ${error.message}`);
  return Boolean(data);
}

/** Semua sesi milik satu client (sebagai anggota). */
export async function getClientSessionRows(email: string): Promise<SessionRow[]> {
  const db = supabase();
  const { data: mem, error } = await db
    .from("session_members")
    .select("session_id")
    .eq("email", email.trim().toLowerCase());
  if (error) throw new Error(`Gagal membaca sesi client: ${error.message}`);
  const ids = ((mem ?? []) as Record<string, unknown>[]).map((m) => String(m.session_id));
  if (!ids.length) return [];
  const { data, error: err2 } = await db.from("sessions").select(COLUMNS).in("id", ids).order("date");
  if (err2) throw new Error(`Gagal membaca sesi client: ${err2.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(toRow);
}

export async function getClientSessionRow(id: string, email: string): Promise<SessionRow | null> {
  if (!isSessionId(id) || !(await isMember(id, email))) return null;
  return getAccessRow(id);
}

/** Baris sesi apa adanya. Pemanggil wajib memeriksa pemilik atau keanggotaan sendiri. */
export async function getAccessRow(id: string): Promise<SessionRow | null> {
  if (!isSessionId(id)) return null;
  const { data, error } = await supabase().from("sessions").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
  return data ? toRow(data as Record<string, unknown>) : null;
}

/** Hanya boleh dipanggil setelah isOwner() bernilai true. */
export async function getOwnerSessionRows(): Promise<OwnerSessionRow[]> {
  const { data, error } = await supabase()
    .from("sessions")
    .select(`${COLUMNS},claim_code,session_members(count)`)
    .order("date", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...toRow(r),
    claimCode: String(r.claim_code ?? ""),
    memberCount: memberCountOf(r),
  }));
}

/** Hanya boleh dipanggil setelah isOwner() bernilai true. */
export async function getOwnerSessionRow(id: string): Promise<{ row: OwnerSessionRow; members: Member[] } | null> {
  if (!isSessionId(id)) return null;
  const db = supabase();
  const { data, error } = await db.from("sessions").select(`${COLUMNS},claim_code`).eq("id", id).maybeSingle();
  if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
  if (!data) return null;
  const { data: mem, error: err2 } = await db
    .from("session_members")
    .select("email,source,created_at")
    .eq("session_id", id)
    .order("created_at");
  if (err2) throw new Error(`Gagal membaca anggota sesi: ${err2.message}`);
  const members = ((mem ?? []) as Record<string, unknown>[]).map((m) => ({
    email: String(m.email),
    source: (m.source === "email" || m.source === "pemilik" ? m.source : "kode") as Member["source"],
    createdAt: String(m.created_at ?? ""),
  }));
  const r = data as Record<string, unknown>;
  return { row: { ...toRow(r), claimCode: String(r.claim_code ?? ""), memberCount: members.length }, members };
}

export { isValidKey };
