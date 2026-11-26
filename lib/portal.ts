import "server-only";
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

export type SessionRow = {
  date: string;
  title: string;
  clientName: string;
  clientEmail: string;
  location: string;
  driveFolderId: string;
  editedFolderId: string;
  maxSelect: number;
  stage: Stage;
  selection: SelectedFile[];
  selectionSavedAt: string | null;
};

export function portalStatus(date: string, today: string, hasPhotos: boolean, stage: Stage): PortalStatus {
  if (stage === "selesai") return "done";
  if (stage === "proses") return "processing";
  if (date > today) return "upcoming";
  return hasPhotos ? "choose" : "preparing";
}

export function studioTimeZone(): string {
  return process.env.STUDIO_TIMEZONE || "Asia/Makassar";
}

function parseSelection(v: unknown): SelectedFile[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x?.id === "string" && typeof x?.name === "string")
    .map((x) => ({ id: String(x.id), name: String(x.name) }));
}

function toRow(r: Record<string, unknown>, title: string): SessionRow {
  const stage = r.stage === "proses" || r.stage === "selesai" ? r.stage : "";
  return {
    date: String(r.date),
    title,
    clientName: String(r.client ?? ""),
    clientEmail: String(r.client_email ?? ""),
    location: String(r.location ?? ""),
    driveFolderId: String(r.drive_folder_id ?? ""),
    editedFolderId: String(r.edited_folder_id ?? ""),
    maxSelect: Number(r.max_select) > 0 ? Number(r.max_select) : 20,
    stage,
    selection: parseSelection(r.selection),
    selectionSavedAt: r.selection_saved_at ? String(r.selection_saved_at) : null,
  };
}

const COLUMNS =
  "date,client,client_email,location,drive_folder_id,edited_folder_id,max_select,stage,selection,selection_saved_at";

/** Semua sesi milik satu client. Email berasal dari sesi login, bukan dari input pengunjung. */
export async function getClientSessionRows(email: string): Promise<SessionRow[]> {
  const db = supabase();
  const { data, error } = await db
    .from("booking_private")
    .select(COLUMNS)
    .eq("client_email", email.trim().toLowerCase())
    .order("date");
  if (error) throw new Error(`Gagal membaca sesi client: ${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!rows.length) return [];

  const { data: booked, error: err2 } = await db
    .from("bookings")
    .select("date,status,public_info")
    .in("date", rows.map((r) => String(r.date)));
  if (err2) throw new Error(`Gagal membaca sesi client: ${err2.message}`);
  const titles = new Map(
    ((booked ?? []) as Record<string, unknown>[])
      .filter((b) => b.status === "booked")
      .map((b) => [String(b.date), String(b.public_info ?? "")]),
  );
  return rows.filter((r) => titles.has(String(r.date))).map((r) => toRow(r, titles.get(String(r.date)) ?? ""));
}

export async function getClientSessionRow(date: string, email: string): Promise<SessionRow | null> {
  if (!isValidKey(date)) return null;
  const rows = await getClientSessionRows(email);
  return rows.find((r) => r.date === date) ?? null;
}

/** Baris sesi apa adanya untuk pengecekan akses foto (pemilik atau client terkait). */
export async function getAccessRow(date: string): Promise<SessionRow | null> {
  if (!isValidKey(date)) return null;
  const { data, error } = await supabase().from("booking_private").select(COLUMNS).eq("date", date).maybeSingle();
  if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
  return data ? toRow(data as Record<string, unknown>, "") : null;
}

/** Semua sesi terbooking yang punya detail privat, untuk halaman pemilik. Hanya dipanggil setelah isOwner() true. */
export async function getOwnerSessionRows(): Promise<SessionRow[]> {
  const db = supabase();
  const { data, error } = await db.from("booking_private").select(COLUMNS).order("date", { ascending: false }).limit(2000);
  if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
  const { data: booked, error: err2 } = await db.from("bookings").select("date,status,public_info").eq("status", "booked").limit(5000);
  if (err2) throw new Error(`Gagal membaca sesi: ${err2.message}`);
  const titles = new Map(((booked ?? []) as Record<string, unknown>[]).map((b) => [String(b.date), String(b.public_info ?? "")]));
  return ((data ?? []) as Record<string, unknown>[])
    .filter((r) => titles.has(String(r.date)))
    .map((r) => toRow(r, titles.get(String(r.date)) ?? ""));
}

export async function getOwnerSessionRow(date: string): Promise<SessionRow | null> {
  if (!isValidKey(date)) return null;
  const db = supabase();
  const { data, error } = await db.from("booking_private").select(COLUMNS).eq("date", date).maybeSingle();
  if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
  if (!data) return null;
  const { data: b, error: err2 } = await db.from("bookings").select("status,public_info").eq("date", date).maybeSingle();
  if (err2) throw new Error(`Gagal membaca sesi: ${err2.message}`);
  if (!b || (b as Record<string, unknown>).status !== "booked") return null;
  return toRow(data as Record<string, unknown>, String((b as Record<string, unknown>).public_info ?? ""));
}
