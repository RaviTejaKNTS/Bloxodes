import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { SiRoblox } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

const description = "Choose a game platform to browse Bloxodes wikis, collections, tools, and player guides.";

export const metadata: Metadata = {
  title: `Games | ${SITE_NAME}`,
  description,
  alternates: buildAlternates(`${SITE_URL}/games`)
};

const platforms = [
  {
    href: "/wiki",
    label: "Roblox",
    description: "Codes, stats, wikis, collections, tools, events, and more for Roblox players.",
    icon: SiRoblox
  },
  {
    href: "/gta",
    label: "Grand Theft Auto",
    description: "GTA game wikis and structured collections built on the same Bloxodes system.",
    icon: Gamepad2
  }
];

export default function GamesPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Games", href: null }]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Browse games on Bloxodes</h1>
        <p className="max-w-2xl text-base leading-7 text-muted md:text-lg">{description}</p>
      </header>

      <section className="grid gap-5 md:grid-cols-2" aria-label="Game platforms">
        {platforms.map(({ href, label, description: summary, icon: Icon }) => (
          <Link key={href} href={href} className="group block">
            <Card className="h-full rounded-xl border-border/70 bg-card shadow-none transition-colors group-hover:border-accent/60">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/70 bg-surface text-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <CardTitle className="text-2xl">{label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-6 text-muted">{summary}</p>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
                  Browse {label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
