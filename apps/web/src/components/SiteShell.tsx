import { ReactNode } from "react";
import { Inter } from "next/font/google";
import { MobileSiteHeader } from "@/components/MobileSiteHeader";
import { SiteSidebar } from "@/components/SiteSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { getSidebarAccount } from "@/lib/site-sidebar-account";

type SiteShellProps = {
  children: ReactNode;
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export async function SiteShell({ children }: SiteShellProps) {
  const account = await getSidebarAccount();

  return (
    <div className={`${inter.className} min-h-screen`}>
      <SiteSidebar pathname="" />
      <MobileSiteHeader account={account} initialPathname="" />
      <div className="flex min-h-screen flex-col xl:pl-[15.5rem]">
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
