import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Klien Supabase dengan kunci service_role. Hanya dipakai di server:
 * semua tabel dikunci dengan RLS, jadi browser tidak punya jalur langsung ke database.
 */
export function supabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi.");
  }
  client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}
