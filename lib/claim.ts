/** Fungsi murni untuk kode klaim sesi (aman dipakai di server maupun browser). */

/** Huruf besar dan angka saja; spasi, tanda hubung, dan karakter lain dibuang. */
export function normalizeCode(input: string): string {
  return String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Tampilan kode berkelompok empat karakter, misalnya K7M2-QX9P. */
export function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}
