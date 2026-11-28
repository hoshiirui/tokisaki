import { Zip, ZipPassThrough } from "fflate";
import { auth, isOwner } from "@/auth";
import { fetchMedia, listImages } from "@/lib/drive";
import { getAccessRow, isMember, isSessionId, sessionLabel } from "@/lib/portal";

export const dynamic = "force-dynamic";
// Unduhan besar butuh waktu. Batas efektif mengikuti paket Vercel.
export const maxDuration = 300;

const notFound = () => new Response("Tidak ditemukan", { status: 404 });
// fflate tidak mendukung ZIP64, jadi total ukuran dijaga di bawah 4 GB.
const MAX_BYTES = 3.9e9;
const MAX_FILES = 2000;

function safeName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  return clean || "foto.jpg";
}

/** Nama unik di dalam ZIP: foto.jpg, foto (2).jpg, ... */
function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const name = safeName(raw);
    const key = name.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n === 1) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
  });
}

/**
 * Mengunduh semua foto satu sesi sebagai ZIP (kind=raw atau kind=edited).
 * Aturan akses sama dengan penyaji foto: wajib login, pemilik atau anggota sesi, dan hasil edit
 * baru terbuka untuk client saat status Selesai. File dialirkan satu per satu tanpa kompresi
 * (JPG sudah terkompresi), sehingga memori server tetap kecil berapa pun jumlah fotonya.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isSessionId(id) || (kind !== "raw" && kind !== "edited")) return notFound();

  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return new Response("Silakan login", { status: 401 });

  try {
    const row = await getAccessRow(id);
    const owner = await isOwner();
    if (!row || (!owner && !(await isMember(id, email)))) return notFound();
    if (kind === "edited" && !owner && row.stage !== "selesai") return notFound();

    const folder = kind === "raw" ? row.driveFolderId : row.editedFolderId;
    if (!folder) return notFound();

    const files = await listImages(folder, MAX_FILES);
    if (files.length === 0) return notFound();
    const total = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
    if (total > MAX_BYTES) {
      return new Response("Ukuran foto terlalu besar untuk satu ZIP. Unduh per foto, atau hubungi fotografer.", { status: 413 });
    }

    const names = uniqueNames(files.map((f) => f.name));
    const label = (await sessionLabel(id)).replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || "sesi-foto";
    const fileName = `${label} - ${kind === "raw" ? "foto asli" : "hasil edit"}.zip`;
    const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

    let next = 0;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let entry: ZipPassThrough | null = null;
    let zip: Zip;
    let produced = false;

    async function open(index: number): Promise<Response> {
      // Satu kali coba ulang untuk gangguan sesaat dari Drive.
      let res = await fetchMedia(files[index].id);
      if (!res.ok || !res.body) res = await fetchMedia(files[index].id);
      if (!res.ok || !res.body) throw new Error(`Drive: gagal mengambil ${files[index].name} (${res.status})`);
      return res;
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        zip = new Zip((err, chunk, final) => {
          if (err) return controller.error(err);
          produced = true;
          controller.enqueue(chunk);
          if (final) controller.close();
        });
      },
      // Setiap pull maju sampai ada data keluar, jadi backpressure dari browser dihormati.
      async pull(controller) {
        try {
          produced = false;
          while (!produced) {
            if (!entry) {
              if (next >= files.length) {
                zip.end();
                return;
              }
              const index = next++;
              const res = await open(index);
              entry = new ZipPassThrough(names[index]);
              zip.add(entry);
              reader = res.body!.getReader();
              continue;
            }
            const { done, value } = await reader!.read();
            if (done) {
              entry.push(new Uint8Array(0), true);
              entry = null;
              reader = null;
            } else if (value) {
              entry.push(value);
            }
          }
        } catch (err) {
          console.error(err);
          controller.error(err);
        }
      },
      async cancel() {
        await reader?.cancel().catch(() => undefined);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("ZIP belum bisa dibuat. Coba lagi sebentar lagi.", { status: 502 });
  }
}
