import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET dan AUTH_SECRET dibaca otomatis dari environment.
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { error: "/akses-ditolak" },
  callbacks: {
    // Semua akun Google dengan email terverifikasi boleh masuk (pemilik dan client).
    // Hak pemilik tetap ditentukan terpisah oleh isOwner() berdasarkan OWNER_EMAIL.
    async signIn({ profile }) {
      return Boolean(profile?.email && profile.email_verified);
    },
  },
});

/** True hanya jika sesi saat ini milik OWNER_EMAIL. Dipakai di setiap pembacaan dan penulisan data privat. */
export async function isOwner(): Promise<boolean> {
  const owner = ownerEmail();
  if (!owner) return false;
  const session = await auth();
  return session?.user?.email?.toLowerCase() === owner;
}
