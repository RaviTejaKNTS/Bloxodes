import { ReactNode } from "react";
import { Inter } from "next/font/google";
import { MobileSiteHeader } from "@/components/MobileSiteHeader";
import { SiteSidebar } from "@/components/SiteSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { signedOutSidebarAccount } from "@/lib/site-navigation";

type SiteShellProps = {
  children: ReactNode;
  integrations?: ReactNode;
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export function SiteShell({ children, integrations = null }: SiteShellProps) {
  return (
    <>
      {integrations}
      <div className={`${inter.className} min-h-screen`}>
        <SiteSidebar account={signedOutSidebarAccount} pathname="" />
        <MobileSiteHeader account={signedOutSidebarAccount} initialPathname="" />
        <div className="flex min-h-screen flex-col xl:pl-[15.5rem]">
          <main className="container flex-1 py-6 md:py-8 xl:py-10">{children}</main>
          <SiteFooter />
        </div>
      </div>
    </>
  );
}
