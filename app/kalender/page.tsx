import { isOwner } from "@/auth";
import CalendarApp from "@/components/CalendarApp";
import { getOwnerSessions, getPublicDays, getSettings } from "@/lib/data";

// Status booking berubah kapan saja, jadi halaman selalu dibuat ulang per permintaan.
export const dynamic = "force-dynamic";

export default async function KalenderPage() {
  const owner = await isOwner();

  let data;
  try {
    const [settings, days, sessions] = await Promise.all([
      getSettings(),
      getPublicDays(owner),
      owner ? getOwnerSessions() : Promise.resolve(null),
    ]);
    data = { settings, days, sessions };
  } catch (err) {
    console.error(err);
    return (
      <main className="notice">
        <h1>Kalender belum bisa dimuat</h1>
        <p className="lede">
          Coba muat ulang beberapa saat lagi. Jika kamu pemilik, periksa pengaturan Supabase di environment variable
          dan pastikan skema database sudah dijalankan.
        </p>
      </main>
    );
  }

  return <CalendarApp settings={data.settings} days={data.days} sessions={data.sessions} isOwner={owner} />;
}
