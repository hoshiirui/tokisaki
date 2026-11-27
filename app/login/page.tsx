import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  // Sudah login: langsung ke Client Portal. Keluar dan pengaturan ada di menu navbar.
  if (session?.user?.email) redirect("/client-portal");

  return (
    <main className="stub wrap">
      <h1>Login</h1>
      <p className="lede">Masuk dengan akun Google untuk melihat sesi foto, memilih foto, dan menerima pemberitahuan.</p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/selamat-datang?next=/client-portal" });
        }}
      >
        <button type="submit" className="btn">Masuk dengan Google</button>
      </form>
      <p className="muted" style={{ marginTop: 14 }}>Pengguna baru akan diminta mengisi nama tampilan dan kontak (opsional).</p>
    </main>
  );
}
