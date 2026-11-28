import Link from "next/link";
import { getSettings, getPublicDays } from "@/lib/data";
import { getAlbums } from "@/lib/portfolio";
import { PACKAGES, SERVICES, STATS, TESTIMONIALS } from "@/lib/home-dummy";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "1", title: "Pilih tanggal", text: "Cek kalender dan lihat tanggal yang masih kosong." },
  { n: "2", title: "Booking", text: "Hubungi lewat WhatsApp, lalu bayar sebelum sesi." },
  { n: "3", title: "Sesi foto", text: "Datang di hari-H. Semua foto asli langsung bisa kamu unduh." },
  { n: "4", title: "Pilih & terima hasil", text: "Pilih foto favorit di Client Portal, hasil edit menyusul di sana." },
];

function todayInStudio(): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
  return new Date(`${ymd}T00:00:00Z`);
}

/** Beberapa tanggal terdekat yang belum terbooking atau ditutup. */
function nextOpenDates(taken: Set<string>, count: number): string[] {
  const out: string[] = [];
  const d = todayInStudio();
  for (let i = 0; i < 90 && out.length < count; i++) {
    const key = d.toISOString().slice(0, 10);
    if (!taken.has(key)) out.push(key);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default async function HomePage() {
  let studio = "Studio Foto";
  let tagline = "Foto yang jujur, proses yang jelas. Lihat tanggal kosong, lalu booking sesimu.";
  let whatsapp = "";
  let taken: Set<string> | null = null;
  let covers: { src: string; title: string }[] = [];

  try {
    const s = await getSettings();
    studio = s.studio;
    tagline = s.tagline || tagline;
    whatsapp = s.whatsapp.replace(/\D/g, "");
  } catch {
    // Pakai teks bawaan jika database belum siap.
  }
  try {
    taken = new Set((await getPublicDays(false)).map((d) => d.date));
  } catch {
    taken = null;
  }
  try {
    const albums = (await getAlbums(false)).filter((a) => a.coverFileId).slice(0, 3);
    covers = albums.map((a) => ({ src: `/api/portfolio/${a.coverFileId}?album=${a.id}&s=900`, title: a.title }));
  } catch {
    covers = [];
  }

  const open = taken ? nextOpenDates(taken, 5) : [];
  const waHref = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Halo, saya ingin booking sesi foto.")}` : "/kalender";

  return (
    <main className="home">
      <section className="wrap home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">Fotografer</p>
          <h1>{studio}</h1>
          <p className="lede">{tagline}</p>
          <div className="actions">
            <Link href="/kalender" className="btn accent">Cek tanggal kosong</Link>
            <Link href="/portfolio" className="btn ghost">Lihat portfolio</Link>
          </div>
          <dl className="home-stats">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt>{s.value}</dt>
                <dd>{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="home-collage" aria-hidden={covers.length === 0}>
          {[0, 1, 2].map((i) =>
            covers[i] ? (
              <figure key={i} className={`frame f${i}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={covers[i].src} alt={covers[i].title} loading={i === 0 ? "eager" : "lazy"} draggable={false} />
              </figure>
            ) : (
              <div key={i} className={`frame f${i} ph`} />
            ),
          )}
        </div>
      </section>

      <section className="wrap home-sec">
        <h2>Jenis sesi</h2>
        <div className="home-grid four">
          {SERVICES.map((s) => (
            <article key={s.title} className="home-card">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap home-sec">
        <h2>Cara kerjanya</h2>
        <ol className="home-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {open.length > 0 ? (
        <section className="wrap home-sec">
          <div className="home-sec-head">
            <h2>Tanggal terdekat yang kosong</h2>
            <Link href="/kalender" className="linklike">Lihat kalender lengkap</Link>
          </div>
          <ul className="home-dates">
            {open.map((d) => (
              <li key={d}>
                <Link href="/kalender">{dayFmt.format(new Date(`${d}T00:00:00Z`))}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="wrap home-sec">
        <div className="home-sec-head">
          <h2>Paket</h2>
          <Link href="/pricelist" className="linklike">Pricelist lengkap</Link>
        </div>
        <div className="home-grid three">
          {PACKAGES.map((p) => (
            <article key={p.name} className={p.featured ? "home-card pkg featured" : "home-card pkg"}>
              {p.featured ? <span className="pkg-badge">Paling dipilih</span> : null}
              <h3>{p.name}</h3>
              <p className="price">{p.price}</p>
              <ul>
                {p.points.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap home-sec">
        <h2>Kata mereka</h2>
        <div className="home-grid three">
          {TESTIMONIALS.map((t) => (
            <blockquote key={t.name} className="home-card quote">
              <p>“{t.quote}”</p>
              <footer>
                <strong>{t.name}</strong> <span className="muted">· {t.note}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="wrap home-cta">
        <h2>Siap booking sesimu?</h2>
        <p>Pilih tanggal yang kosong, lalu hubungi langsung untuk konfirmasi.</p>
        <div className="actions">
          <a href={waHref} className="btn accent" {...(whatsapp ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {whatsapp ? "Chat WhatsApp" : "Lihat kalender"}
          </a>
          <Link href="/client-portal" className="btn ghost">Client Portal</Link>
        </div>
      </section>
    </main>
  );
}
