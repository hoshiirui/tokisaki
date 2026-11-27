import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, isOwner, signIn } from "@/auth";
import OwnerAccess from "@/components/OwnerAccess";
import OwnerGallery from "@/components/OwnerGallery";
import OwnerSessionPanel from "@/components/OwnerSessionPanel";
import PhotoGallery from "@/components/PhotoGallery";
import SessionTabs from "@/components/SessionTabs";
import { longDate, todayKeyIn } from "@/lib/dates";
import { listImages, type DriveFile } from "@/lib/drive";
import {
  getClientSessionRow,
  getOwnerSessionRow,
  isSessionId,
  portalStatus,
  STATUS_LABEL,
  studioTimeZone,
} from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSessionId(id)) notFound();

  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return (
      <main className="stub wrap">
        <h1>Client Portal</h1>
        <p className="lede">Masuk dengan akun Google untuk membuka sesi ini.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: `/selamat-datang?next=/client-portal/${id}` });
          }}
        >
          <button type="submit" className="btn">Masuk dengan Google</button>
        </form>
      </main>
    );
  }

  const today = todayKeyIn(studioTimeZone());

  if (await isOwner()) {
    const found = await getOwnerSessionRow(id);
    if (!found) notFound();
    const { row: o, members } = found;
    const oStatus = portalStatus(o.date, today, Boolean(o.driveFolderId), o.stage);
    return (
      <main className="wrap portal">
        <p>
          <Link href="/client-portal" className="muted">‹ Semua sesi</Link>
        </p>
        <header className="session-head">
          <span className={`pill s-${oStatus}`}>{STATUS_LABEL[oStatus]}</span>
          <h1>{o.title || o.clientName || "Sesi foto"}</h1>
          <p className="lede">
            {longDate(o.date)}
            {o.time ? ` · ${o.time}` : ""}
            {o.location ? ` · ${o.location}` : ""}
            {o.clientName ? ` · ${o.clientName}` : ""}
          </p>
          {o.selectionSavedAt ? (
            <p className="muted">
              Pilihan dikirim {new Date(o.selectionSavedAt).toLocaleString("id-ID", { timeZone: studioTimeZone(), dateStyle: "medium", timeStyle: "short" })}
            </p>
          ) : null}
        </header>
        <section>
          <h2>Akses client</h2>
          <OwnerAccess id={o.id} claimCode={o.claimCode} members={members} />
        </section>
        <section>
          <h2>Atur sesi</h2>
          <OwnerSessionPanel
            key={`${o.stage}|${o.driveFolderId}|${o.editedFolderId}|${o.maxSelect}`}
            id={o.id}
            stage={o.stage}
            driveFolderId={o.driveFolderId}
            editedFolderId={o.editedFolderId}
            maxSelect={o.maxSelect}
          />
        </section>
        <section>
          <h2>Foto</h2>
          <OwnerGallery
            key={`${o.driveFolderId}|${o.editedFolderId}|${o.selection.length}`}
            sid={o.id}
            selection={o.selection}
            hasRaw={Boolean(o.driveFolderId)}
            hasEdited={Boolean(o.editedFolderId)}
            defaultTab={o.stage === "selesai" && o.editedFolderId ? "edited" : o.selection.length ? "selection" : o.driveFolderId ? "raw" : "selection"}
          />
        </section>
      </main>
    );
  }

  const row = await getClientSessionRow(id, email);
  if (!row) notFound();

  const status = portalStatus(row.date, today, Boolean(row.driveFolderId), row.stage);

  // Foto JPG asli tetap bisa dilihat client di semua tahap setelah sesi. Saat Selesai, hanya foto edit yang
  // diminta di awal; foto asli diminta belakangan lewat tab Foto asli.
  let files: DriveFile[] = [];
  let edited: DriveFile[] = [];
  let loadFailed = false;
  try {
    if ((status === "choose" || status === "processing") && row.driveFolderId) {
      files = await listImages(row.driveFolderId);
    }
  } catch (err) {
    console.error(err);
    loadFailed = true;
  }
  let editedFailed = false;
  try {
    if (status === "done" && row.editedFolderId) edited = await listImages(row.editedFolderId);
  } catch (err) {
    console.error(err);
    editedFailed = true;
  }
  const selectedIds = row.selection.filter((s) => files.some((f) => f.id === s.id)).map((s) => s.id);

  return (
    <main className="wrap portal">
      <p>
        <Link href="/client-portal" className="muted">‹ Semua sesi</Link>
      </p>
      <header className="session-head">
        <span className={`pill s-${status}`}>{STATUS_LABEL[status]}</span>
        <h1>{row.title || "Sesi foto"}</h1>
        <p className="lede">
          {longDate(row.date)}
          {row.time ? ` · ${row.time}` : ""}
          {row.location ? ` · ${row.location}` : ""}
          {row.clientName ? ` · ${row.clientName}` : ""}
        </p>
      </header>

      {loadFailed ? (
        <p className="lede">Foto belum bisa dimuat. Coba muat ulang beberapa saat lagi.</p>
      ) : status === "upcoming" ? (
        <p className="lede">Sesi ini belum berlangsung. Foto akan tersedia di sini setelah sesi selesai.</p>
      ) : status === "preparing" ? (
        <p className="lede">Foto sedang disiapkan. Kamu bisa memilih foto di sini setelah fotografer mengunggahnya.</p>
      ) : status === "choose" ? (
        files.length === 0 ? (
          <p className="lede">Belum ada foto di folder sesi ini.</p>
        ) : (
          <>
            <p className="lede">
              Pilih foto yang ingin diedit, maksimal {row.maxSelect} foto. Klik foto untuk memilih, atau Perbesar untuk
              melihat lebih jelas. Setelah dikirim, pilihan dikunci. Jika sesi ini dimiliki bersama, pilihan berlaku
              untuk semua orang di sesi ini.
            </p>
            <PhotoGallery sid={row.id} files={files} mode="select" max={row.maxSelect} initialSelected={selectedIds} />
          </>
        )
      ) : status === "processing" ? (
        <>
          <p className="lede">
            Pilihan sudah dikirim ({row.selection.length} foto). Fotografer sedang mengedit foto-foto ini. Semua foto
            asli tetap bisa dilihat dan diunduh di bawah, foto pilihan diberi nomor.
          </p>
          <h2>Foto asli (JPG)</h2>
          <PhotoGallery sid={row.id} files={files} mode="view" initialSelected={selectedIds} download />
        </>
      ) : (
        <SessionTabs
          sid={row.id}
          edited={edited.map((f) => ({ id: f.id, name: f.name }))}
          editedFailed={editedFailed}
          selectedIds={row.selection.map((x) => x.id)}
          hasRaw={Boolean(row.driveFolderId)}
        />
      )}
    </main>
  );
}
