import "server-only";
import { getSessionUser } from "@/lib/auth/session-user";
import { signedOutSidebarAccount, type SidebarAccount } from "@/lib/site-navigation";

export async function getSidebarAccount(): Promise<SidebarAccount> {
  try {
    const user = await getSessionUser();
    if (!user) return signedOutSidebarAccount;

    const label = (user.roblox_display_name ?? user.roblox_username ?? "Account").trim() || "Account";

    return {
      avatarUrl: user.roblox_avatar_url ?? null,
      href: "/account",
      label,
      signedIn: true
    };
  } catch {
    return signedOutSidebarAccount;
  }
}
