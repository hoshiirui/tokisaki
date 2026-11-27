import Link from "next/link";
import { notFound } from "next/navigation";
import { isOwner } from "@/auth";
import AlbumForm from "@/components/AlbumForm";

export const dynamic = "force-dynamic";

export default async function NewAlbumPage() {
  if (!(await isOwner())) notFound();
  return (
    <main className="wrap portal">
      <p>
        <Link href="/portfolio" className="muted">‹ Portfolio</Link>
      </p>
      <header className="palbum-head">
        <h1>Album baru</h1>
        <p className="lede">Beri judul, tautkan folder Drive berisi foto, lalu pilih apakah album langsung ditampilkan.</p>
      </header>
      <AlbumForm />
    </main>
  );
}
