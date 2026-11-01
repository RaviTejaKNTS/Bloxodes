import { getGameMenuForPath } from "@/lib/game-site-data";
import { readGameIndexPaths } from "@/lib/site-route-snapshot";
import { headers } from "next/headers";
import { REQUEST_GAME_PATH_HEADER } from "@/lib/request-headers";
import { ReactNode } from "react";
import { Inter } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RecentVisitTracker } from "@/components/RecentVisitTracker";
import { signedOutSidebarAccount } from "@/lib/site-navigation";

type SiteShellProps = {
  children: ReactNode;
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["Arial", "Helvetica", "system-ui", "sans-serif"]
});

export async function SiteShell({ children }: SiteShellProps) {
  const path = (await headers()).get(REQUEST_GAME_PATH_HEADER);
  const gamePaths = [...await readGameIndexPaths(undefined, true)];
  const menu = path ? await getGameMenuForPath(path) : null;
  return (
    <div className={`${inter.className} min-h-screen`}>
      <SiteHeader gamePaths={gamePaths} gameMenus={menu ? [menu] : []} account={signedOutSidebarAccount} />
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      <RecentVisitTracker />
    </div>
  );
}
