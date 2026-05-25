import { ReactNode } from "react";
import { Inter } from "next/font/google";
import { HeaderControls } from "@/components/HeaderControls";
import { SiteFooter } from "@/components/SiteFooter";

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
        <HeaderControls />
        <div className="flex min-h-screen flex-col xl:pl-[15.5rem]">
          <main className="container flex-1 py-6 md:py-8 xl:py-10">{children}</main>
          <SiteFooter />
        </div>
      </div>
    </>
  );
}
