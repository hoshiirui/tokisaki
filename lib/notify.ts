import "server-only";
import { supabase } from "@/lib/supabase";
import { safeNext } from "@/lib/profile";

export type NotifyInput = { title: string; body?: string; link?: string; kind?: string };

export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
}

/**
 * Membuat notifikasi untuk beberapa penerima. Hanya upaya terbaik: kegagalan dicatat di log
 * dan tidak pernah menggagalkan aksi utama. `exclude` biasanya pelaku, agar tidak memberi tahu diri sendiri.
 */
export async function notify(
  recipients: (string | null | undefined)[],
  input: NotifyInput,
  exclude?: string | null,
): Promise<void> {
  try {
    const skip = (exclude ?? "").trim().toLowerCase();
    const to = [...new Set(recipients.map((r) => String(r ?? "").trim().toLowerCase()).filter((r) => r && r !== skip))];
    if (!to.length) return;
    const link = input.link ? safeNext(input.link, "") : "";
    const rows = to.map((email) => ({
      email,
      kind: input.kind ?? "info",
      title: input.title.slice(0, 120),
      body: (input.body ?? "").slice(0, 300),
      link,
    }));
    const { error } = await supabase().from("notifications").insert(rows);
    if (error) console.error("Notifikasi gagal dibuat:", error.message);
  } catch (err) {
    console.error("Notifikasi gagal dibuat:", err);
  }
}

/** Email semua anggota sebuah sesi. Mengembalikan daftar kosong jika gagal. */
export async function memberEmails(sessionId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase().from("session_members").select("email").eq("session_id", sessionId);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((r) => String(r.email));
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function countUnread(email: string): Promise<number> {
  try {
    const { count, error } = await supabase()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("email", email.trim().toLowerCase())
      .is("read_at", null);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error(err);
    return 0;
  }
}
