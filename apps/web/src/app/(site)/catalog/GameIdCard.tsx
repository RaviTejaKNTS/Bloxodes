import Image from "next/image";
import Link from "next/link";
import { Paintbrush } from "lucide-react";

type GameIdCardProps = {
  game: { slug: string; title: string; description: string };
  basePath: string;
};

export function GameIdCard({ game, basePath }: GameIdCardProps) {
  return (
    <Link
      href={`${basePath}/${game.slug}`}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="flex h-full items-start gap-4 rounded-lg border border-border/70 bg-surface p-4 transition-colors hover:border-accent/55 sm:p-5">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-muted sm:h-20 sm:w-20 xl:h-24 xl:w-24" aria-hidden="true">
          {game.slug === "spray-paint" ? (
            <div className="flex h-full items-center justify-center text-muted">
              <Paintbrush className="h-8 w-8" />
            </div>
          ) : (
            <Image
              src={`/images/catalog-games/${game.slug}.png`}
              alt=""
              width={150}
              height={150}
              className="h-full w-full object-cover !cursor-pointer"
            />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-snug text-foreground">{game.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{game.description}</p>
        </div>
      </article>
    </Link>
  );
}
