import "server-only";
import { supabase } from "@/lib/supabase";
import { key } from "@/lib/dates";
import type { MyBooking, PrivateDay, PublicDay, Settings } from "@/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  studio: "Studio Foto",
  tagline: "Lihat tanggal yang masih tersedia, lalu hubungi kami untuk booking sesi foto.",
  whatsapp: "",
  showInfoDefault: true,
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase().from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Gagal membaca pengaturan: ${error.message}`);
  if (!data) return DEFAULT_SETTINGS;
  const row = data as Record<string, unknown>;
  return {
    studio: String(row.studio ?? DEFAULT_SETTINGS.studio),
    tagline: String(row.tagline ?? ""),
    whatsapp: String(row.whatsapp ?? ""),
    showInfoDefault: Boolean(row.show_info_default),
  };
}

/** Jendela tanggal yang dikirim ke browser: 2 bulan ke belakang sampai sekitar 2 tahun ke depan. */
function windowRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const to = new Date(now.getFullYear() + 2, now.getMonth(), 1);
  return {
    from: key(from.getFullYear(), from.getMonth(), from.getDate()),
    to: key(to.getFullYear(), to.getMonth(), to.getDate()),
  };
}

/**
 * Untuk client, info yang disembunyikan pemilik dikosongkan di server,
 * sehingga tidak pernah ikut terkirim ke browser.
 */
export async function getPublicDays(owner: boolean): Promise<PublicDay[]> {
  const { from, to } = windowRange();
  const { data, error } = await supabase()
    .from("bookings")
    .select("date,status,public_info,show_info")
    .gte("date", from)
    .lte("date", to)
    .order("date");
  if (error) throw new Error(`Gagal membaca kalender: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const showInfo = Boolean(r.show_info);
    return {
      date: String(r.date),
      status: r.status === "blocked" ? "blocked" : "booked",
      info: owner || showInfo ? String(r.public_info ?? "") : "",
      showInfo,
    } satisfies PublicDay;
  });
}

/**
 * Sesi milik satu client, dicari lewat email Google dari sesi login (bukan dari input pengunjung).
 * Hanya mengembalikan tanggal, info sesi, jam, dan lokasi. Catatan, kontak, dan tautan planning tidak ikut.
 */
export async function getMyBookings(email: string): Promise<MyBooking[]> {
  const db = supabase();
  const { data: rows, error } = await db
    .from("booking_private")
    .select("date,session_time,location")
    .eq("client_email", email.trim().toLowerCase())
    .order("date");
  if (error) throw new Error(`Gagal membaca booking client: ${error.message}`);
  const mine = (rows ?? []) as Record<string, unknown>[];
  if (!mine.length) return [];

  const { data: booked, error: err2 } = await db
    .from("bookings")
    .select("date,status,public_info")
    .in("date", mine.map((r) => String(r.date)));
  if (err2) throw new Error(`Gagal membaca booking client: ${err2.message}`);
  const info = new Map(
    ((booked ?? []) as Record<string, unknown>[])
      .filter((b) => b.status === "booked")
      .map((b) => [String(b.date), String(b.public_info ?? "")]),
  );

  // Hanya tanggal yang statusnya masih Terbooking.
  return mine
    .filter((r) => info.has(String(r.date)))
    .map((r) => ({
      date: String(r.date),
      info: info.get(String(r.date)) ?? "",
      time: String(r.session_time ?? ""),
      location: String(r.location ?? ""),
    }));
}

/** Hanya boleh dipanggil setelah isOwner() bernilai true. */
export async function getPrivateDays(): Promise<PrivateDay[]> {
  const { from, to } = windowRange();
  const { data, error } = await supabase()
    .from("booking_private")
    .select(
      "date,client,client_email,contact,session_time,location,notes,doc_url,drive_folder_id,edited_folder_id,max_select,stage,selection",
    )
    .gte("date", from)
    .lte("date", to)
    .order("date");
  if (error) throw new Error(`Gagal membaca detail privat: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    date: String(r.date),
    client: String(r.client ?? ""),
    clientEmail: String(r.client_email ?? ""),
    contact: String(r.contact ?? ""),
    time: String(r.session_time ?? ""),
    location: String(r.location ?? ""),
    notes: String(r.notes ?? ""),
    docUrl: String(r.doc_url ?? ""),
    driveFolderId: String(r.drive_folder_id ?? ""),
    editedFolderId: String(r.edited_folder_id ?? ""),
    maxSelect: Number(r.max_select) > 0 ? Number(r.max_select) : 20,
    stage: r.stage === "proses" || r.stage === "selesai" ? r.stage : "",
    selection: Array.isArray(r.selection)
      ? (r.selection as Record<string, unknown>[])
          .filter((x) => typeof x?.id === "string" && typeof x?.name === "string")
          .map((x) => ({ id: String(x.id), name: String(x.name) }))
      : [],
  }));
}
