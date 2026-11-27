import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ProfileForm from "@/components/ProfileForm";
import { getProfile, safeNext } from "@/lib/profile";

export const dynamic = "force-dynamic";

/** Tujuan setelah login Google. Pengguna baru melengkapi nama tampilan dulu; yang sudah punya profil langsung diteruskan. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/login");

  let profile = null;
  try {
    profile = await getProfile(email);
  } catch (err) {
    // Database sedang bermasalah: jangan tahan pengguna di sini.
    console.error(err);
    redirect(target);
  }
  if (profile) redirect(target);

  return (
    <main className="stub wrap">
      <h1>Selamat datang</h1>
      <p className="lede">Satu langkah lagi. Beri tahu nama yang ingin kamu pakai.</p>
      <ProfileForm email={email} initialName={session?.user?.name ?? ""} initialContact="" mode="onboarding" next={target} />
    </main>
  );
}
