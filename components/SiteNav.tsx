import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getSettings } from "@/lib/data";
import NavLinks from "./NavLinks";

export default async function SiteNav() {
  let studio = "Studio Foto";
  try {
    studio = (await getSettings()).studio;
  } catch {
    // Database belum siap: navbar tetap tampil dengan nama bawaan.
  }

  const session = await auth();

  const authSlot = session?.user ? (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className="btn ghost">Keluar</button>
    </form>
  ) : (
    <Link href="/login" className="btn ghost">Login</Link>
  );

  return <NavLinks brand={studio} auth={authSlot} />;
}
