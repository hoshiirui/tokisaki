import Link from "next/link";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let studio = "Studio Foto";
  let tagline = "Lihat tanggal yang masih tersedia, lalu hubungi kami untuk booking sesi foto.";
  try {
    const s = await getSettings();
    studio = s.studio;
    tagline = s.tagline || tagline;
  } catch {
    // Pakai teks bawaan jika database belum siap.
  }

  return (
    <main className="hero wrap">
      <p className="eyebrow">Fotografer</p>
      <h1>{studio}</h1>
      <p className="lede">{tagline}</p>
      <div className="actions">
        <Link href="/kalender" className="btn accent">Lihat kalender</Link>
        <Link href="/pricelist" className="btn ghost">Lihat pricelist</Link>
      </div>
    </main>
  );
}
