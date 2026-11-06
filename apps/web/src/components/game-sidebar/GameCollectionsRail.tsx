import Link from "next/link";
import { BookOpen } from "lucide-react";

export type CollectionRailLink = {
  value: string;
  label: string;
  href: string;
  image?: string | null;
  count?: number | null;
};

/** Keep published order, starting after the current collection and wrapping once. */
export function orderOtherCollections<T extends { value: string }>(collections: T[], currentCode: string): T[] {
  const index = collections.findIndex(collection => collection.value === currentCode);
  const ordered = index < 0 ? collections : [...collections.slice(index + 1), ...collections.slice(0, index)];
  return ordered.filter(collection => collection.value !== currentCode);
}

/** Identical server-rendered navigation in the desktop rail and below the content on smaller screens. */
export function GameCollectionsRail({ gameName, collections }: { gameName: string; collections: CollectionRailLink[] }) {
  const cards = collections.slice(0, 3);
  const rest = collections.slice(3);
  if (!cards.length) return null;
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/70 bg-card">
        <h2 className="mb-0 px-4 pb-2 pt-3.5 text-[0.95rem] font-semibold leading-snug text-foreground">More {gameName} collections</h2>
        <ul className="divide-y divide-border/60 px-4 pb-2">
          {cards.map(collection => (
            <li key={collection.value}>
              <Link href={collection.href} className="flex items-center gap-3 py-3 hover:text-accent">
                <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md ${collection.image ? "bg-surface-muted" : "bg-accent/10 text-accent"}`}>
                  {collection.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={collection.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                  ) : <BookOpen className="h-5 w-5" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{collection.label}</span>
                  {typeof collection.count === "number" ? <span className="block text-xs text-muted">{collection.count.toLocaleString("en-US")} entries</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {rest.length ? (
        <section>
          <h2 className="mb-1.5 text-[0.95rem] font-semibold leading-snug text-foreground">All other {gameName} collections</h2>
          <ul className="text-[13.5px] leading-[1.75]">
            {rest.map((collection, index) => (
              <li key={collection.value} className="inline-block whitespace-nowrap">
                <Link href={collection.href} className="hover:text-accent hover:underline">{collection.label}</Link>
                {index < rest.length - 1 ? <span className="mx-1.5 text-muted" aria-hidden>·</span> : null}{" "}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
