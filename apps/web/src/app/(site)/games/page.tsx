import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { breadcrumbJsonLd, buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

const description = "Explore Roblox, Grand Theft Auto, Red Dead, and daily puzzles on Bloxodes.";
const canonical = `${SITE_URL}/games`;

export const metadata: Metadata = {
  title: `Games | ${SITE_NAME}`,
  description,
  alternates: buildAlternates(canonical),
  openGraph: {
    title: `Games | ${SITE_NAME}`,
    description,
    url: canonical,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: `Games | ${SITE_NAME}`,
    description
  }
};

const platforms = [
  {
    href: "/wiki",
    label: "Roblox",
    image: "/images/games/roblox.webp"
  },
  {
    href: "/gta",
    label: "Grand Theft Auto",
    image: "/images/games/gta.webp"
  },
  {
    href: "/red-dead",
    label: "Red Dead",
    image: "/images/games/red-dead.webp"
  },
  {
    href: "/puzzles",
    label: "Puzzles",
    image: "/images/games/puzzles.webp"
  }
];

export default function GamesPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: "Home", url: SITE_URL },
        { name: "Games", url: canonical }
      ]),
      {
        "@type": "CollectionPage",
        name: "Browse games on Bloxodes",
        description,
        url: canonical,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: platforms.length,
          itemListElement: platforms.map(({ href, label, image }, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: label,
            url: `${SITE_URL}${href}`,
            image: `${SITE_URL}${image}`
          }))
        }
      }
    ]
  };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Games", href: null }]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Browse games on Bloxodes</h1>
        <p className="max-w-2xl text-base leading-7 text-muted md:text-lg">{description}</p>
      </header>

      <section className="grid gap-5 md:grid-cols-2" aria-label="Games and puzzles">
        {platforms.map(({ href, label, image }, index) => (
          <Link
            key={href}
            href={href}
            className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <Card className="relative aspect-[1200/675] overflow-hidden rounded-xl border-border/70 bg-card shadow-none transition-colors group-hover:border-accent/60">
              <Image
                src={image}
                alt=""
                width={1200}
                height={675}
                sizes="(min-width: 1280px) calc((100vw - 20rem) / 2), (min-width: 768px) calc((100vw - 5rem) / 2), calc(100vw - 2rem)"
                priority={index < 2}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" aria-hidden />
              <h2 className="absolute inset-x-0 bottom-0 mb-0 px-5 pb-5 text-2xl font-semibold leading-tight text-white md:px-6 md:pb-6 lg:text-3xl">
                {label}
              </h2>
            </Card>
          </Link>
        ))}
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </div>
  );
}
