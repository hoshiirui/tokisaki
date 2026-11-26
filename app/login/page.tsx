import Link from "next/link";
import { auth, isOwner, signIn, signOut } from "@/auth";
import { getMyBookings } from "@/lib/data";
import { longDate } from "@/lib/dates";
import type { MyBooking } from "@/lib/types";

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

  let bookings: MyBooking[] = [];
  let failed = false;
  try {
    bookings = await getMyBookings(email);
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
          Belum ada booking untuk akun ini. Jika kamu sudah booking, minta studio mencatat email Google ini di booking-mu.
        </p>
      ) : (
        <ul className="mybookings">
          {bookings.map((b) => (
            <li key={b.date}>
              <span className="when">{longDate(b.date)}</span>
              {b.info ? <span className="what">{b.info}</span> : null}
              {b.time ? <span className="what">Jam: {b.time}</span> : null}
              {b.location ? <span className="what">Lokasi: {b.location}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <form action={signOutAction}>
        <button type="submit" className="btn ghost">Keluar</button>
      </form>
    </main>
  );
}
