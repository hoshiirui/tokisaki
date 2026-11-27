import { isOwner } from "@/auth";
import { fetchThumbnail, getFileMeta } from "@/lib/drive";
import { getAlbum } from "@/lib/portfolio";
import { isSessionId } from "@/lib/portal";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Tidak ditemukan", { status: 404 });

/**
 * Foto portfolio untuk dilihat saja. Yang disajikan hanya gambar berukuran tampilan (maksimal 1600 px)
 * dari Drive, tidak pernah file aslinya, dan tanpa header unduhan.
 * Album yang dipublikasikan terbuka untuk siapa saja; draf hanya untuk pemilik.
 */
export async function GET(req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  const url = new URL(req.url);
  const albumId = url.searchParams.get("album") ?? "";
  if (!isSessionId(albumId)) return notFound();

  try {
    const album = await getAlbum(albumId, true);
    if (!album || !album.driveFolderId) return notFound();
    if (!album.published && !(await isOwner())) return notFound();

    const meta = await getFileMeta(fileId);
    if (!meta || !meta.parents.includes(album.driveFolderId)) return notFound();

    const size = Math.max(64, Math.min(1600, Math.round(Number(url.searchParams.get("s")) || 640)));
    const thumb = await fetchThumbnail(meta, size);
    if (!thumb?.body) return notFound();

    return new Response(thumb.body, {
      headers: {
        "Content-Type": thumb.headers.get("content-type") ?? "image/jpeg",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": album.published ? "public, max-age=3600, s-maxage=86400" : "private, no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("Foto belum bisa dimuat", { status: 502 });
  }
}
