"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { countUnread } from "@/lib/notify";
import { isSessionId } from "@/lib/portal";
import { supabase } from "@/lib/supabase";

type Result = { ok: true } | { ok: false; error: string };

async function myEmail(): Promise<string | null> {
  return (await auth())?.user?.email?.trim().toLowerCase() || null;
}

export type SaveProfileInput = { displayName: string; contact: string };

/** Menyimpan nama tampilan (wajib) dan kontak (opsional) untuk akun yang sedang login. */
export async function saveProfile(input: SaveProfileInput): Promise<Result> {
  const email = await myEmail();
  if (!email) return { ok: false, error: "Silakan login terlebih dahulu." };
  const displayName = String(input.displayName ?? "").replace(/\s+/g, " ").trim();
  const contact = String(input.contact ?? "").trim().slice(0, 80);
  if (displayName.length < 2) return { ok: false, error: "Nama tampilan minimal 2 karakter." };
  if (displayName.length > 40) return { ok: false, error: "Nama tampilan maksimal 40 karakter." };

  const { error } = await supabase()
    .from("profiles")
    .upsert({ email, display_name: displayName, contact, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "Gagal menyimpan profil. Coba lagi sebentar lagi." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  createdAt: string;
  read: boolean;
};

/** Notifikasi terbaru milik akun yang sedang login. */
export async function getNotifications(): Promise<{ ok: true; items: NotificationItem[]; unread: number } | { ok: false }> {
  const email = await myEmail();
  if (!email) return { ok: false };
  const { data, error } = await supabase()
    .from("notifications")
    .select("id,kind,title,body,link,created_at,read_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return { ok: false };
  const items = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    kind: String(r.kind ?? "info"),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    link: String(r.link ?? ""),
    createdAt: String(r.created_at ?? ""),
    read: Boolean(r.read_at),
  }));
  return { ok: true, items, unread: await countUnread(email) };
}

export async function getUnreadCount(): Promise<number> {
  const email = await myEmail();
  return email ? countUnread(email) : 0;
}

/** Menandai dibaca: beberapa notifikasi tertentu, atau semuanya jika ids tidak diberikan. */
export async function markNotificationsRead(ids?: string[]): Promise<Result> {
  const email = await myEmail();
  if (!email) return { ok: false, error: "Silakan login terlebih dahulu." };
  const db = supabase();
  const now = new Date().toISOString();
  let q = db.from("notifications").update({ read_at: now }).eq("email", email).is("read_at", null);
  if (ids) {
    const valid = ids.filter((i) => isSessionId(String(i)));
    if (!valid.length) return { ok: true };
    q = q.in("id", valid);
  }
  const { error } = await q;
  if (error) return { ok: false, error: "Gagal menandai notifikasi." };
  if (!ids) {
    // Notifikasi yang sudah dibaca lebih dari 30 hari dibersihkan.
    await db.from("notifications").delete().eq("email", email).lt("read_at", new Date(Date.now() - 30 * 86400_000).toISOString());
  }
  return { ok: true };
}
