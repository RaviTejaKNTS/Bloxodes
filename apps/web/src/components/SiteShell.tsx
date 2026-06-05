import { ReactNode, Suspense } from "react";
import { Inter } from "next/font/google";
import { MobileSiteHeader } from "@/components/MobileSiteHeader";
import { RouteScrollReset } from "@/components/RouteScrollReset";
import { SiteSidebar } from "@/components/SiteSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { signedOutSidebarAccount } from "@/lib/site-navigation";

type SiteShellProps = {
  children: ReactNode;
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className={`${inter.className} min-h-screen`}>
      <Suspense fallback={null}>
        <RouteScrollReset />
      </Suspense>
      <SiteSidebar account={signedOutSidebarAccount} pathname="" />
      <MobileSiteHeader account={signedOutSidebarAccount} initialPathname="" />
      <div className="flex min-h-screen flex-col xl:pl-[15.5rem]">
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
