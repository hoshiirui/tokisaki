import "server-only";
import { JWT } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const API = "https://www.googleapis.com/drive/v3";
const ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

let jwt: JWT | null = null;

async function accessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL dan GOOGLE_PRIVATE_KEY belum diisi.");
  jwt ??= new JWT({ email, key, scopes: [SCOPE] });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Gagal mendapatkan token Google.");
  return token;
}

async function driveFetch(url: string): Promise<Response> {
  const token = await accessToken();
  return fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
}

export type DriveFile = { id: string; name: string };

/** Daftar gambar di satu folder, urut nama alami (IMG_2 sebelum IMG_10). */
export async function listImages(folderId: string, limit = 3000): Promise<DriveFile[]> {
  if (!ID_RE.test(folderId)) return [];
  const out: DriveFile[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: "nextPageToken,files(id,name)",
      pageSize: String(Math.max(1, Math.min(1000, limit - out.length))),
      orderBy: "name_natural",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch(`${API}/files?${params}`);
    if (!res.ok) throw new Error(`Drive: gagal membaca folder (${res.status})`);
    const json = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    for (const f of json.files ?? []) out.push({ id: f.id, name: f.name });
    pageToken = json.nextPageToken ?? "";
  } while (pageToken && out.length < limit);
  return out;
}

export type FileMeta = { id: string; name: string; mimeType: string; parents: string[]; thumbnailLink?: string };

export async function getFileMeta(fileId: string): Promise<FileMeta | null> {
  if (!ID_RE.test(fileId)) return null;
  const params = new URLSearchParams({ fields: "id,name,mimeType,parents,thumbnailLink", supportsAllDrives: "true" });
  const res = await driveFetch(`${API}/files/${fileId}?${params}`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Drive: gagal membaca file (${res.status})`);
  const j = (await res.json()) as Partial<FileMeta>;
  return {
    id: String(j.id),
    name: String(j.name ?? "foto"),
    mimeType: String(j.mimeType ?? "application/octet-stream"),
    parents: Array.isArray(j.parents) ? j.parents : [],
    thumbnailLink: j.thumbnailLink,
  };
}

/** Thumbnail dari Drive (tautan bertanda tangan, harus diambil dengan kredensial). Null jika tidak tersedia. */
export async function fetchThumbnail(meta: FileMeta, size: number): Promise<Response | null> {
  if (!meta.thumbnailLink) return null;
  const link = meta.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  // Hanya ikuti tautan ke domain gambar Google.
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com\//.test(link)) return null;
  const res = await driveFetch(link);
  return res.ok ? res : null;
}

export async function fetchMedia(fileId: string): Promise<Response> {
  return driveFetch(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`);
}
