import Link from "next/link";
import { isOwner } from "@/auth";
import AlbumOrder from "@/components/AlbumOrder";
import { MONTHS, parseKey } from "@/lib/dates";
import { listImages } from "@/lib/drive";
import { getAlbums, type Album } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

/** Foto thumbnail album: pilihan pemilik, atau foto pertama di folder. Gagal diam-diam jika Drive belum siap. */
async function coverFor(a: Album): Promise<string | null> {
  if (a.coverFileId) return a.coverFileId;
  if (!a.driveFolderId) return null;
  try {
    return (await listImages(a.driveFolderId, 1))[0]?.id ?? null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function monthYear(k: string) {
  const d = parseKey(k);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default async function PortfolioPage() {
  const owner = await isOwner();
  let albums: Album[] = [];
  let failed = false;
  try {
    albums = await getAlbums(owner);
  } catch (err) {
    console.error(err);
    failed = true;
  }
  const covers = await Promise.all(albums.map(coverFor));

  return (
    <main className="wrap portal">
      <header className="palbum-head">
        <h1>Portfolio</h1>
        <p className="lede">Kumpulan hasil dari berbagai sesi dan acara. Pilih satu album untuk melihat fotonya.</p>
        {owner ? (
          <div className="ptoolbar">
            <Link href="/portfolio/new" className="btn accent">Tambah album</Link>
            <span className="muted">Kamu melihat halaman ini sebagai pemilik. Draf hanya terlihat olehmu.</span>
          </div>
        ) : null}
      </header>

      {failed ? (
        <p className="lede">Portfolio belum bisa dimuat. Coba muat ulang beberapa saat lagi.</p>
      ) : albums.length === 0 ? (
        <div className="pempty">
          {owner ? "Belum ada album. Klik Tambah album untuk membuat yang pertama." : "Album sedang disiapkan. Kembali lagi sebentar lagi."}
        </div>
      ) : (
        <ul className="pcards">
          {albums.map((a, i) => (
            <li key={a.id} className="pcard">
              <Link href={`/portfolio/${a.id}`} className="pcard-link">
                <div className="pcard-thumb">
                  {covers[i] ? (
                    <img src={`/api/portfolio/${covers[i]}?album=${a.id}&s=800`} alt="" loading="lazy" draggable={false} />
                  ) : (
                    <span className="muted">Belum ada foto</span>
                  )}
                  {owner && !a.published ? <span className="pbadge draft">Draf</span> : null}
                </div>
                <div className="pcard-body">
                  <h3>{a.title}</h3>
                  {a.eventDate ? <p>{monthYear(a.eventDate)}</p> : null}
                </div>
              </Link>
              {owner ? (
                <div className="pcard-tools">
                  <AlbumOrder id={a.id} first={i === 0} last={i === albums.length - 1} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
