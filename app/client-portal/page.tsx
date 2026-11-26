import Link from "next/link";
import { auth, isOwner, signIn } from "@/auth";
import { listImages } from "@/lib/drive";
import { longDate, todayKeyIn } from "@/lib/dates";
import OwnerPortalList, { type OwnerItem } from "@/components/OwnerPortalList";
import { getClientSessionRows, getOwnerSessionRows, portalStatus, STATUS_LABEL, studioTimeZone, type SessionRow } from "@/lib/portal";

export const dynamic = "force-dynamic";

/** Foto pertama di folder yang relevan untuk thumbnail kartu. Gagal diam-diam jika Drive belum siap. */
async function coverFor(row: SessionRow): Promise<string | null> {
  const folder = row.stage === "selesai" && row.editedFolderId ? row.editedFolderId : row.driveFolderId;
  if (!folder) return null;
  try {
    const files = await listImages(folder, 1);
    return files[0]?.id ?? null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function SessionCard({ row, today, cover }: { row: SessionRow; today: string; cover: string | null }) {
  const status = portalStatus(row.date, today, Boolean(row.driveFolderId), row.stage);
  return (
    <li>
      <Link href={`/client-portal/${row.date}`} className="scard">
        <div className="scard-thumb">
          {cover ? (
            <img src={`/api/drive/${cover}?date=${row.date}&s=640`} alt="" loading="lazy" />
          ) : (
            <span className="muted">Belum ada foto</span>
          )}
        </div>
        <div className="scard-body">
          <span className={`pill s-${status}`}>{STATUS_LABEL[status]}</span>
          <h3>{row.title || "Sesi foto"}</h3>
          <p>{longDate(row.date)}</p>
          {row.location ? <p>{row.location}</p> : null}
          {row.clientName ? <p className="muted">{row.clientName}</p> : null}
        </div>
      </Link>
    </li>
  );
}

export default async function ClientPortalPage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return (
      <main className="stub wrap">
        <h1>Client Portal</h1>
        <p className="lede">Masuk dengan akun Google untuk melihat sesi dan memilih foto.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/client-portal" });
          }}
        >
          <button type="submit" className="btn">Masuk dengan Google</button>
        </form>
      </main>
    );
  }

  if (await isOwner()) {
    let all: SessionRow[] = [];
    let ownerFailed = false;
    try {
      all = await getOwnerSessionRows();
    } catch (err) {
      console.error(err);
      ownerFailed = true;
    }
    const todayKey = todayKeyIn(studioTimeZone());
    const items: OwnerItem[] = all.map((r) => ({
      date: r.date,
      title: r.title,
      clientName: r.clientName,
      clientEmail: r.clientEmail,
      location: r.location,
      status: portalStatus(r.date, todayKey, Boolean(r.driveFolderId), r.stage),
      selectionCount: r.selection.length,
      maxSelect: r.maxSelect,
      hasEdited: Boolean(r.editedFolderId),
    }));
    return (
      <main className="wrap portal">
        <h1>Client Portal</h1>
        <p className="lede">Semua sesi client. Buka satu sesi untuk mengubah tahap, menautkan folder hasil edit, dan melihat fotonya.</p>
        {ownerFailed ? (
          <p className="lede">Sesi belum bisa dimuat. Coba muat ulang beberapa saat lagi.</p>
        ) : items.length === 0 ? (
          <p className="lede">Belum ada sesi. Tambahkan detail sesi dari form tanggal di kalender.</p>
        ) : (
          <OwnerPortalList items={items} today={todayKey} />
        )}
      </main>
    );
  }

  let rows: SessionRow[] = [];
  let failed = false;
  try {
    rows = await getClientSessionRows(email);
  } catch (err) {
    console.error(err);
    failed = true;
  }

  const today = todayKeyIn(studioTimeZone());
  const covers = await Promise.all(rows.map(coverFor));
  const items = rows.map((row, i) => ({ row, cover: covers[i] }));
  const upcoming = items.filter((x) => x.row.date > today && x.row.stage === "");
  const previous = items.filter((x) => !(x.row.date > today && x.row.stage === "")).reverse();

  return (
    <main className="wrap portal">
      <h1>Client Portal</h1>
      <p className="lede">Masuk sebagai {email}.</p>

      {failed ? (
        <p className="lede">Sesi belum bisa dimuat. Coba muat ulang beberapa saat lagi.</p>
      ) : rows.length === 0 ? (
        <p className="lede">
          Belum ada sesi untuk akun ini. Jika kamu sudah booking, minta studio mencatat email Google ini di booking-mu.
        </p>
      ) : (
        <>
          {upcoming.length ? (
            <section>
              <h2>Akan datang</h2>
              <ul className="scards">
                {upcoming.map((x) => <SessionCard key={x.row.date} row={x.row} today={today} cover={x.cover} />)}
              </ul>
            </section>
          ) : null}
          {previous.length ? (
            <section>
              <h2>Sesi sebelumnya</h2>
              <ul className="scards">
                {previous.map((x) => <SessionCard key={x.row.date} row={x.row} today={today} cover={x.cover} />)}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
