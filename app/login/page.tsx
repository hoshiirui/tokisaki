import Link from "next/link";
import { auth, isOwner, signIn, signOut } from "@/auth";
import { longDate } from "@/lib/dates";
import { getClientSessionRows, type SessionRow } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function LoginPage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  if (!session?.user || !email) {
    return (
      <main className="stub wrap">
        <h1>Login</h1>
        <p className="lede">Masuk dengan akun Google untuk melihat sesi foto yang sudah kamu booking.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/login" });
          }}
        >
          <button type="submit" className="btn">Masuk dengan Google</button>
        </form>
      </main>
    );
  }

  if (await isOwner()) {
    return (
      <main className="stub wrap">
        <h1>Kamu sudah masuk</h1>
        <p className="lede">Kamu masuk sebagai pemilik studio.</p>
        <div className="actions">
          <Link href="/kalender" className="btn accent">Buka kalender</Link>
          <form action={signOutAction}>
            <button type="submit" className="btn ghost">Keluar</button>
          </form>
        </div>
      </main>
    );
  }

  let bookings: SessionRow[] = [];
  let failed = false;
  try {
    bookings = await getClientSessionRows(email);
  } catch (err) {
    console.error(err);
    failed = true;
  }

  return (
    <main className="stub wrap">
      <h1>Sesi kamu</h1>
      <p className="lede">Masuk sebagai {email}.</p>
      {failed ? (
        <p className="lede">Sesi belum bisa dimuat. Coba muat ulang beberapa saat lagi.</p>
      ) : bookings.length === 0 ? (
        <p className="lede">
          Belum ada sesi di akun ini. Jika kamu sudah booking, masukkan kode sesi dari fotografer di Client Portal.
        </p>
      ) : (
        <ul className="mybookings">
          {bookings.map((b) => (
            <li key={b.id}>
              <span className="when">{longDate(b.date)}</span>
              {b.title ? <span className="what">{b.title}</span> : null}
              {b.time ? <span className="what">Jam: {b.time}</span> : null}
              {b.location ? <span className="what">Lokasi: {b.location}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <Link href="/client-portal" className="btn accent">Buka Client Portal</Link>
        <form action={signOutAction}>
          <button type="submit" className="btn ghost">Keluar</button>
        </form>
      </div>
    </main>
  );
}
