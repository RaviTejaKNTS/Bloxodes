import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { CardImage } from "@/components/CardImage";
import type { RobloxGameCardBlockData } from "@/lib/article-blocks";

function GameLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  const className = primary
    ? "inline-flex min-h-9 items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90"
    : "inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-border/70 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent/60 hover:text-accent";

  if (href.startsWith("/")) {
    return <Link href={href} className={className}>{children}</Link>;
  }

  return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>;
}

export function RobloxGameCard({ data }: { data: RobloxGameCardBlockData }) {
  return (
    <article
      className="not-prose my-7 overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition hover:border-accent/60"
      data-article-block="roblox-game-card"
      data-game-card-id={data.id}
      data-universe-id={data.universeId}
    >
      <div className="flex items-center gap-4 p-3 sm:gap-5 sm:p-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-muted sm:h-24 sm:w-24">
          <CardImage src={data.image} alt={`${data.name} Roblox game icon`} className="aspect-square" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <h3 className="m-0 truncate text-lg font-bold leading-tight text-foreground sm:text-xl">{data.name}</h3>
          <div className="flex flex-wrap gap-2">
            <GameLink href={data.robloxUrl} primary>
              Play on Roblox <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
            </GameLink>
            {data.statsUrl ? (
              <GameLink href={data.statsUrl}>
                View stats <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </GameLink>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
