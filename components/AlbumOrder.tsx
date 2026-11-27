"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { moveAlbum } from "@/app/portfolio-actions";

/** Tombol naik dan turun untuk mengatur urutan album (pemilik). */
export default function AlbumOrder({ id, first, last }: { id: string; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function move(dir: "up" | "down") {
    startTransition(async () => {
      try {
        await moveAlbum(id, dir);
      } finally {
        router.refresh();
      }
    });
  }

  return (
    <div className="aorder" role="group" aria-label="Urutan album">
      <button type="button" aria-label="Geser ke depan" disabled={pending || first} onClick={() => move("up")}>←</button>
      <button type="button" aria-label="Geser ke belakang" disabled={pending || last} onClick={() => move("down")}>→</button>
    </div>
  );
}
