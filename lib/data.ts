import "server-only";
import { supabase } from "@/lib/supabase";
import { key } from "@/lib/dates";
import type { OwnerSession, PublicDay, Settings } from "@/lib/types";

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

/** Hanya boleh dipanggil setelah isOwner() bernilai true. */
export async function getOwnerSessions(): Promise<OwnerSession[]> {
  const { from, to } = windowRange();
  const { data, error } = await supabase()
    .from("sessions")
    .select("id,date,title,client,contact,session_time,location,notes,doc_url,claim_code,created_at,session_members(count)")
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("created_at");
  if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const m = r.session_members as { count?: number }[] | undefined;
    return {
      id: String(r.id),
      date: String(r.date),
      title: String(r.title ?? ""),
      client: String(r.client ?? ""),
      contact: String(r.contact ?? ""),
      time: String(r.session_time ?? ""),
      location: String(r.location ?? ""),
      notes: String(r.notes ?? ""),
      docUrl: String(r.doc_url ?? ""),
      claimCode: String(r.claim_code ?? ""),
      memberCount: Array.isArray(m) && m[0]?.count ? Number(m[0].count) : 0,
    } satisfies OwnerSession;
  });
}
