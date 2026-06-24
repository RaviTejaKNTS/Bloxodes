import type { ToolListEntry } from "@/lib/tools";
import { resolveModifiedAt } from "@/lib/content-dates";
import { formatUpdatedLabel } from "@/lib/updated-label";
import { FiClock } from "react-icons/fi";
import { ContentCard } from "@/components/ContentCard";

type ToolCardProps = {
  tool: ToolListEntry;
};

/** Derive a short utility-type label from the tool title. */
function toolTypeLabel(title: string): string {
  const t = title.toLowerCase();
  if (/calculator|calc\b/.test(t)) return "Calculator";
  if (/converter|convert|→|to usd|to robux/.test(t)) return "Converter";
  if (/planner|plan\b/.test(t)) return "Planner";
  if (/optimizer|optimi[sz]e/.test(t)) return "Optimizer";
  if (/extractor|extract|finder|id\b/.test(t)) return "Extractor";
  if (/tracker|track\b/.test(t)) return "Tracker";
  if (/generator|generate/.test(t)) return "Generator";
  return "Tool";
}

const chipClass =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none";

export function ToolCard({ tool }: ToolCardProps) {
  const updatedLabel = formatUpdatedLabel(resolveModifiedAt(tool));
  const thumb = tool.thumb_url || tool.universe?.icon_url || null;
  const description = tool.meta_description?.trim() || null;
  const typeLabel = toolTypeLabel(tool.title);
  const gameLabel = tool.universe_id
    ? tool.universe?.display_name?.trim() || tool.universe?.name?.trim() || null
    : null;

  return (
    <ContentCard
      type="tool"
      href={`/tools/${tool.code}`}
      title={tool.title}
      image={{ src: thumb, alt: tool.title, ratio: "1:1" }}
      subtitle={description ? <p className="line-clamp-2 text-sm text-muted">{description}</p> : null}
      meta={
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${chipClass} border-accent/30 bg-accent/10 text-accent`}>{typeLabel}</span>
            {gameLabel ? (
              <span className={`${chipClass} border-border/60 bg-surface-muted text-muted`}>{gameLabel}</span>
            ) : null}
          </div>
          {updatedLabel ? (
            <p className="mb-0 inline-flex items-center gap-1.5 text-xs text-foreground/70">
              <FiClock aria-hidden className="h-3 w-3" />
              <span>{updatedLabel}</span>
            </p>
          ) : null}
        </>
      }
    />
  );
}
