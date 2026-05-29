import { ReactNode } from "react";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { MobileSiteHeader } from "@/components/MobileSiteHeader";
import { SiteSidebar } from "@/components/SiteSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { REQUEST_PATHNAME_HEADER } from "@/lib/request-headers";
import { getSidebarAccount } from "@/lib/site-sidebar-account";

type SiteShellProps = {
  children: ReactNode;
  integrations?: ReactNode;
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export async function SiteShell({ children, integrations = null }: SiteShellProps) {
  const [headersList, account] = await Promise.all([headers(), getSidebarAccount()]);
  const pathname = headersList.get(REQUEST_PATHNAME_HEADER) ?? "";

  return (
    <>
      {integrations}
      <div className={`${inter.className} min-h-screen`}>
        <SiteSidebar account={account} pathname={pathname} />
        <MobileSiteHeader account={account} initialPathname={pathname} />
        <div className="flex min-h-screen flex-col xl:pl-[15.5rem]">
          <main className="container flex-1 py-6 md:py-8 xl:py-10">{children}</main>
          <SiteFooter />
        </div>
      </div>
    </>
  );
}
