import Link from "next/link";
import { auth, isOwner, signOut } from "@/auth";
import { getSettings } from "@/lib/data";
import { countUnread } from "@/lib/notify";
import { getProfile } from "@/lib/profile";
import NavLinks from "./NavLinks";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function SiteNav() {
  let studio = "Studio Foto";
  try {
    studio = (await getSettings()).studio;
  } catch {
    // Database belum siap: navbar tetap tampil dengan nama bawaan.
  }

  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  let authSlot;
  if (email) {
    let displayName = "";
    let profileKnown = true;
    try {
      displayName = (await getProfile(email))?.displayName ?? "";
    } catch {
      profileKnown = false;
    }
    const name = displayName || session?.user?.name || email.split("@")[0];
    const unread = await countUnread(email);
    authSlot = (
      <div className="nav-user">
        <NotificationBell initialUnread={unread} />
        <UserMenu
          name={name}
          email={email}
          owner={await isOwner()}
          needsProfile={profileKnown && !displayName}
          signOutAction={signOutAction}
        />
      </div>
    );
  } else {
    authSlot = <Link href="/login" className="btn ghost">Login</Link>;
  }

  return <NavLinks brand={studio} auth={authSlot} />;
}
