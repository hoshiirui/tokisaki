import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ProfileForm from "@/components/ProfileForm";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/login");

  let profile = null;
  let failed = false;
  try {
    profile = await getProfile(email);
  } catch (err) {
    console.error(err);
    failed = true;
  }

  return (
    <main className="stub wrap">
      <h1>Profil saya</h1>
      <p className="lede">Atur nama tampilan dan kontakmu.</p>
      {failed ? (
        <p className="lede">Profil belum bisa dimuat. Coba muat ulang beberapa saat lagi.</p>
      ) : (
        <ProfileForm
          email={email}
          initialName={profile?.displayName ?? session?.user?.name ?? ""}
          initialContact={profile?.contact ?? ""}
          mode="edit"
        />
      )}
    </main>
  );
}
