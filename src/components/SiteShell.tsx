import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import { HeaderControls } from "@/components/HeaderControls";

type SiteShellProps = {
  children: ReactNode;
  integrations?: ReactNode;
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export function SiteShell({ children, integrations = null }: SiteShellProps) {
  const currentYear = new Date().getFullYear();

  return (
    <>
      {integrations}
      <div className={`${inter.className} min-h-screen`}>
        <HeaderControls />
        <div className="flex min-h-screen flex-col xl:pl-72">
          <main className="container flex-1 py-6 md:py-8 xl:py-10">{children}</main>
          <footer className="mt-16 border-t border-border/60">
            <div className="container flex flex-col gap-6 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
              <Link href="/" className="flex items-center gap-3 text-foreground">
                <div className="relative h-8 w-auto">
                  <Image
                    src="/Bloxodes-dark.png"
                    alt="Bloxodes"
                    width={948}
                    height={319}
                    loading="lazy"
                    fetchPriority="low"
                    className="hidden h-8 w-auto dark:block"
                  />
                  <Image
                    src="/Bloxodes-light.png"
                    alt="Bloxodes"
                    width={948}
                    height={319}
                    loading="lazy"
                    fetchPriority="low"
                    className="block h-8 w-auto dark:hidden"
                  />
                </div>
              </Link>
              <nav className="flex flex-wrap items-center gap-5 text-xs uppercase tracking-wide text-muted md:text-sm">
                <Link href="/about" className="transition hover:text-foreground">
                  About Us
                </Link>
                <Link href="/how-we-gather-and-verify-codes" className="transition hover:text-foreground">
                  How We Verify Codes
                </Link>
                <Link href="/contact" className="transition hover:text-foreground">
                  Contact Us
                </Link>
                <Link href="/editorial-guidelines" className="transition hover:text-foreground">
                  Editorial Guidelines
                </Link>
                <Link href="/privacy-policy" className="transition hover:text-foreground">
                  Privacy Policy
                </Link>
                <Link href="/terms-of-service" className="transition hover:text-foreground">
                  Terms of Service
                </Link>
                <Link href="/disclaimer" className="transition hover:text-foreground">
                  Disclaimer
                </Link>
              </nav>
              <div className="text-xs text-muted md:text-right">
                <p>© {currentYear} Bloxodes. Not affiliated with Roblox.</p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
