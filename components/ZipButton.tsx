/** Tautan unduh semua foto satu sesi sebagai ZIP. Server yang menyusun dan mengalirkan file. */
export default function ZipButton({ sid, kind, count }: { sid: string; kind: "raw" | "edited"; count?: number }) {
  return (
    <a className="btn ghost zip-btn" href={`/api/zip/${sid}?kind=${kind}`} download>
      Unduh semua (ZIP){count ? ` · ${count} foto` : ""}
    </a>
  );
}
