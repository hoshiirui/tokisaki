import { auth, isOwner } from "@/auth";
import { fetchMedia, fetchThumbnail, getFileMeta } from "@/lib/drive";
import { getAccessRow, isMember, isSessionId } from "@/lib/portal";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Tidak ditemukan", { status: 404 });

/**
 * Menyajikan foto dari Google Drive lewat server. Foto tidak pernah dibuat publik di Drive.
 * Akses diberikan hanya jika:
 *  1. pengunjung login,
 *  2. pengunjung adalah pemilik studio atau anggota sesi itu,
 *  3. file benar-benar berada di folder sesi tersebut,
 *  4. foto hasil edit baru terbuka untuk client setelah sesi berstatus Selesai.
 */
export async function GET(req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session") ?? "";
  if (!isSessionId(sessionId)) return notFound();

  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return new Response("Silakan login", { status: 401 });

  try {
    const row = await getAccessRow(sessionId);
    const owner = await isOwner();
    if (!row || (!owner && !(await isMember(sessionId, email)))) return notFound();

    const meta = await getFileMeta(fileId);
    if (!meta) return notFound();

    const inRaw = Boolean(row.driveFolderId) && meta.parents.includes(row.driveFolderId);
    const inEdited = Boolean(row.editedFolderId) && meta.parents.includes(row.editedFolderId);
    if (!inRaw && !inEdited) return notFound();
    if (inEdited && !inRaw && !owner && row.stage !== "selesai") return notFound();

    const headers = new Headers({
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });

    const sizeParam = Number(url.searchParams.get("s"));
    if (sizeParam > 0) {
      const size = Math.max(64, Math.min(2048, Math.round(sizeParam)));
      const thumb = await fetchThumbnail(meta, size);
      if (thumb?.body) {
        headers.set("Content-Type", thumb.headers.get("content-type") ?? "image/jpeg");
        return new Response(thumb.body, { headers });
      }
      // Tanpa thumbnail dari Drive, jatuh ke file asli.
    }

    const media = await fetchMedia(fileId);
    if (!media.ok || !media.body) return notFound();
    headers.set("Content-Type", media.headers.get("content-type") ?? meta.mimeType);
    if (url.searchParams.get("download") === "1") {
      headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`);
    }
    return new Response(media.body, { headers });
  } catch (err) {
    console.error(err);
    return new Response("Foto belum bisa dimuat", { status: 502 });
  }
}
