"use client";

import Link from "next/link";
import { useState } from "react";
import { CardImage } from "@/components/CardImage";

type CatalogEntry = { href: string; title: string; count: number | null };

type CatalogListSidebarProps = {
  catalogs: CatalogEntry[];
  coverImage: string | null;
  gameName: string;
};

const MAX_VISIBLE = 5;

function label(entry: CatalogEntry) {
  return `All ${typeof entry.count === "number" ? `${entry.count.toLocaleString("en-US")} ` : ""}${entry.title}`;
}

export function CatalogListSidebar({ catalogs, coverImage, gameName }: CatalogListSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = catalogs.length - MAX_VISIBLE;
  const visible = expanded ? catalogs : catalogs.slice(0, MAX_VISIBLE);

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      {coverImage ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted">
          <CardImage src={coverImage} alt={gameName} />
        </div>
      ) : null}
      <div className="space-y-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55">Catalogs</p>
        <ul className="space-y-1.5">
          {visible.map((entry) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className="block line-clamp-1 text-sm font-medium text-foreground transition-colors hover:text-accent"
              >
                {label(entry)}
              </Link>
            </li>
          ))}
        </ul>
        {!expanded && hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm font-semibold text-accent transition-colors hover:underline"
          >
            +{hiddenCount} {hiddenCount === 1 ? "catalog" : "catalogs"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
