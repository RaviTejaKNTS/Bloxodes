import Image from "next/image";
import Link from "next/link";
import type { ToolListEntry } from "@/lib/tools";
import { resolveModifiedAt } from "@/lib/content-dates";
import { formatUpdatedLabel } from "@/lib/updated-label";
import { FiClock } from "react-icons/fi";

type ToolCardProps = {
  tool: ToolListEntry;
};

export function ToolCard({ tool }: ToolCardProps) {
  const updatedAt = resolveModifiedAt(tool);
  const updatedLabel = formatUpdatedLabel(updatedAt);
  const thumb = tool.thumb_url || tool.universe?.icon_url || "/og-image.png";
  const thumbSrc = thumb.startsWith("http") ? thumb : thumb.startsWith("/") ? thumb : `/${thumb}`;

  return (
    <Link href={`/tools/${tool.code}`} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-none transition-colors hover:border-border">
        <div className="relative aspect-square shrink-0 overflow-hidden bg-surface-muted">
          <Image
            src={thumbSrc}
            alt={tool.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/70 to-transparent" aria-hidden />
        </div>

        <div className="relative -mt-1 space-y-2 bg-card px-4 pb-4 pt-3">
          <h3 className="mb-0 line-clamp-2 text-lg font-semibold leading-snug text-foreground">
            {tool.title}
          </h3>
          {updatedLabel ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
              <FiClock aria-hidden className="h-3 w-3" />
              <span>{updatedLabel}</span>
            </p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
