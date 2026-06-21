import Image from "next/image";
import Link from "next/link";

const companyLinks = [
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
  { href: "/how-we-gather-and-verify-codes", label: "How We Verify Codes" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/editorial-guidelines", label: "Editorial Guidelines" },
  { href: "/terms-of-service", label: "Terms of Service" },
  { href: "/disclaimer", label: "Disclaimer" }
];

const indexLinks = [
  { href: "/codes", label: "Codes" },
  { href: "/articles", label: "Articles" },
  { href: "/stats", label: "Stats" },
  { href: "/wiki", label: "Wiki" },
  { href: "/tools", label: "Tools" },
  { href: "/catalog", label: "Catalog" },
  { href: "/checklists", label: "Checklists" },
  { href: "/events", label: "Events" },
  { href: "/puzzles", label: "Puzzles" },
  { href: "/quizzes", label: "Quizzes" }
];

const topPageLinks = [
  { href: "/catalog/roblox-music-ids", label: "Roblox Music IDs" },
  { href: "/catalog/free-roblox-items", label: "Free Roblox Items" },
  { href: "/catalog/roblox-decal-ids", label: "Roblox Decal IDs" },
  { href: "/catalog/roblox-color-codes", label: "Roblox Color Codes" },
  { href: "/tools/grow-a-garden-crop-value-calculator", label: "Grow a Garden Crop Calculator" },
  { href: "/tools/the-forge-crafting-calculator", label: "The Forge Crafting Calculator" },
  { href: "/tools/the-forge-inventory-optimizer", label: "The Forge Inventory Optimizer" }
];

function FooterLinkList({
  columns = false,
  links
}: {
  columns?: boolean;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <ul className={columns ? "grid grid-cols-2 gap-x-6 gap-y-2.5" : "grid gap-2.5"}>
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className="text-sm font-medium text-muted transition hover:text-foreground">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border/60">
      <div className="container grid gap-10 py-10 md:grid-cols-[1.2fr_1fr_1.3fr]">
        <section className="space-y-5">
          <Link href="/" className="inline-flex w-fit items-center text-foreground" aria-label="Bloxodes home">
            <Image
              src="/Bloxodes-dark.png"
              alt="Bloxodes"
              width={948}
              height={319}
              loading="lazy"
              fetchPriority="low"
              className="hidden h-12 w-auto max-w-none dark:block"
            />
            <Image
              src="/Bloxodes-light.png"
              alt="Bloxodes"
              width={948}
              height={319}
              loading="lazy"
              fetchPriority="low"
              className="block h-12 w-auto max-w-none dark:hidden"
            />
          </Link>
          <FooterLinkList links={companyLinks} />
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Page Indexes</h2>
          <FooterLinkList columns links={indexLinks} />
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Top Pages</h2>
          <FooterLinkList links={topPageLinks} />
        </section>
      </div>
      <div className="border-t border-border/50">
        <div className="container py-4 text-xs text-muted">
          <p>© {currentYear} Bloxodes. Not affiliated with Roblox.</p>
        </div>
      </div>
    </footer>
  );
}
