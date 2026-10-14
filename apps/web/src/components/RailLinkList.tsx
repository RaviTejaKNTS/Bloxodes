import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Calculator,
  CalendarDays,
  Compass,
  Gift,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  ListChecks,
  Map as MapIcon,
  Music,
  Newspaper,
  Palette,
  Shirt,
  Terminal,
  Ticket,
  type LucideIcon
} from "lucide-react";
import { CardImage } from "@/components/CardImage";

export type RailLink = { href: string; title: string; description?: string | null; image?: string | null };

/** First match wins, so specific paths come before their section. */
const ICONS: Array<[RegExp, LucideIcon]> = [
  [/\/maps(\/|$)/, MapIcon],
  [/\/checklists(\/|$)/, ListChecks],
  [/\/tools(\/|$)/, Calculator],
  [/^\/stats(\/|$)/, BarChart3],
  [/^\/codes(\/|$)|promo-codes/, Ticket],
  [/music-ids/, Music],
  [/decal-ids/, ImageIcon],
  [/color-codes/, Palette],
  [/free-roblox-items/, Gift],
  [/items-and-bundles|avatar-marketplace/, Shirt],
  [/admin-commands|emote-commands/, Terminal],
  [/^\/catalog(\/|$)/, LayoutGrid],
  [/\/wiki(\/|$)/, BookOpen],
  [/^\/quizzes(\/|$)/, HelpCircle],
  [/^\/events(\/|$)/, CalendarDays],
  [/^\/articles(\/|$)/, Newspaper]
];

function railIconFor(href: string): LucideIcon {
  return ICONS.find(([pattern]) => pattern.test(href))?.[1] ?? Compass;
}

/**
 * The "More …" page list in the right rail. A row shows the page's image when it has one and an
 * icon picked from its URL otherwise, so new pages look right without extra data. Descriptions
 * are cut to one line.
 */
export function RailLinkList({ heading, links, footer }: {
  heading: string;
  links: RailLink[];
  footer?: { href: string; label: string };
}) {
  if (!links.length) return null;
  return (
    <section className="rounded-lg border border-border/70 bg-card">
      <h2 className="mb-0 px-4 pb-2 pt-3.5 text-[0.95rem] font-semibold leading-snug text-foreground">{heading}</h2>
      <ul className="px-2 pb-2">
        {links.map(link => {
          const Icon = railIconFor(link.href);
          return (
            <li key={link.href}>
              <Link href={link.href} className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary/60">
                <span className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-lg bg-accent/10 text-accent">
                  {link.image ? <CardImage src={link.image} alt="" /> : <Icon className="h-[1.05rem] w-[1.05rem]" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{link.title}</span>
                  {link.description ? <span className="block truncate text-[0.8rem] leading-5 text-muted">{link.description}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {footer ? (
        <Link href={footer.href} className="block border-t border-border/60 px-4 py-3 text-sm font-medium text-accent hover:underline">
          {footer.label}
        </Link>
      ) : null}
    </section>
  );
}
