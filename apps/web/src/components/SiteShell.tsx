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

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className={`${inter.className} min-h-screen`}>
      <SiteHeader account={signedOutSidebarAccount} />
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      <RecentVisitTracker />
    </div>
  );
}
