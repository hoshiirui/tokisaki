import Link from "next/link";
import { notFound } from "next/navigation";
import { isOwner } from "@/auth";
import AlbumForm from "@/components/AlbumForm";
import PortfolioGallery from "@/components/PortfolioGallery";
import { longDate } from "@/lib/dates";
import { listImages } from "@/lib/drive";
import { isSessionId } from "@/lib/portal";
import { getAlbum } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSessionId(id)) notFound();
  const owner = await isOwner();
  let album: Awaited<ReturnType<typeof getAlbum>> = null;
  try {
    album = await getAlbum(id, owner);
  } catch (err) {
    console.error(err);
    return (
      <main className="wrap portal">
        <p><Link href="/portfolio" className="muted">‹ Portfolio</Link></p>
        <p className="lede">Album belum bisa dimuat. Coba muat ulang beberapa saat lagi.</p>
      </main>
    );
  }
  if (!album) notFound();

  let ids: string[] = [];
  let failed = false;
  if (album.driveFolderId) {
    try {
      ids = (await listImages(album.driveFolderId)).map((f) => f.id);
    } catch (err) {
      console.error(err);
      failed = true;
    }
  }

  return (
    <main className="wrap portal">
      <p>
        <Link href="/portfolio" className="muted">‹ Portfolio</Link>
      </p>
      <header className="palbum-head">
        {owner && !album.published ? <span className="pill s-upcoming">Draf, hanya terlihat olehmu</span> : null}
        <h1>{album.title}</h1>
        {album.eventDate ? <p className="muted">{longDate(album.eventDate)}</p> : null}
        {album.description ? <p className="lede">{album.description}</p> : null}
      </header>

      {owner ? (
        <details className="adetails">
          <summary>Atur album</summary>
          <AlbumForm
            key={`${album.title}|${album.driveFolderId}|${album.published}|${album.eventDate}|${album.description}`}
            album={album}
          />
          <p className="muted">
            Untuk mengganti thumbnail, buka satu foto di bawah lalu klik Jadikan thumbnail. Tanpa pilihan, thumbnail
            memakai foto pertama di folder.
          </p>
        </details>
      ) : null}

      {failed ? (
        <p className="lede">Foto belum bisa dimuat. Coba muat ulang beberapa saat lagi.</p>
      ) : ids.length === 0 ? (
        <div className="pempty">{owner ? "Belum ada foto. Tautkan folder Drive yang berisi foto di Atur album." : "Foto album ini sedang disiapkan."}</div>
      ) : (
        <PortfolioGallery albumId={album.id} title={album.title} fileIds={ids} coverId={album.coverFileId} owner={owner} />
      )}
    </main>
  );
}
