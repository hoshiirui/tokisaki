import "server-only";
import { supabase } from "@/lib/supabase";

export type Profile = { email: string; displayName: string; contact: string };

export async function getProfile(email: string): Promise<Profile | null> {
  const { data, error } = await supabase()
    .from("profiles")
    .select("email,display_name,contact")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Gagal membaca profil: ${error.message}`);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return { email: String(r.email), displayName: String(r.display_name ?? ""), contact: String(r.contact ?? "") };
}

/** Profil beberapa email sekaligus, untuk daftar anggota sesi (pemilik). */
export async function getProfiles(emails: string[]): Promise<Map<string, Profile>> {
  const out = new Map<string, Profile>();
  const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!list.length) return out;
  const { data, error } = await supabase().from("profiles").select("email,display_name,contact").in("email", list);
  if (error) throw new Error(`Gagal membaca profil: ${error.message}`);
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    out.set(String(r.email), { email: String(r.email), displayName: String(r.display_name ?? ""), contact: String(r.contact ?? "") });
  }
  return out;
}

/** Nama untuk ditampilkan: nama profil jika ada, jika tidak bagian depan email. Tidak pernah melempar error. */
export async function nameFor(email: string): Promise<string> {
  try {
    const p = await getProfile(email);
    if (p?.displayName) return p.displayName;
  } catch (err) {
    console.error(err);
  }
  return email.split("@")[0] || email;
}

/** Hanya jalur di situs ini yang boleh dipakai sebagai tujuan setelah login (mencegah pengalihan ke situs lain). */
export function safeNext(value: string | null | undefined, fallback = "/client-portal"): string {
  const v = String(value ?? "");
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || v.length > 200) return fallback;
  return v;
}
