export const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
export const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const DOW = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** Kunci tanggal YYYY-MM-DD; month berbasis 0 seperti Date. */
export const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function parseKey(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function longDate(k: string): string {
  const d = parseKey(k);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function shortDate(k: string): string {
  const d = parseKey(k);
  return `${DAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function isValidKey(k: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
  const d = parseKey(k);
  return key(d.getFullYear(), d.getMonth(), d.getDate()) === k;
}

export function isGoogleDocUrl(u: string): boolean {
  return /^https:\/\/docs\.google\.com\/document\/\S+$/.test(u);
}

/** Ambil ID folder dari tautan Google Drive (atau ID polos). Null jika bentuknya tidak dikenali. */
export function parseDriveFolderId(input: string): string | null {
  const v = input.trim();
  const fromUrl = /^https:\/\/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|folderview\?id=|open\?id=)([A-Za-z0-9_-]{10,100})/.exec(v);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9_-]{10,100}$/.test(v) ? v : null;
}

export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}

/** Kunci tanggal hari ini (YYYY-MM-DD) di zona waktu studio. Dipakai di server. */
export function todayKeyIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Alamat pratinjau (mode baca) untuk iframe, atau null jika tautan bukan bentuk /document/d/ID. */
export function docPreviewUrl(u: string): string | null {
  const m = /^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/.exec(u);
  return m ? `https://docs.google.com/document/d/${m[1]}/preview` : null;
}
