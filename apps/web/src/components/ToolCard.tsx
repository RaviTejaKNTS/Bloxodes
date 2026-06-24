import type { ToolListEntry } from "@/lib/tools";
import { resolveModifiedAt } from "@/lib/content-dates";
import { formatUpdatedLabel } from "@/lib/updated-label";
import { FiClock } from "react-icons/fi";
import { ContentCard } from "@/components/ContentCard";

type ToolCardProps = {
  tool: ToolListEntry;
};

export function ToolCard({ tool }: ToolCardProps) {
  const updatedLabel = formatUpdatedLabel(resolveModifiedAt(tool));
  const thumb = tool.thumb_url || tool.universe?.icon_url || null;

  return (
    <ContentCard
      type="tool"
      variant="bar"
      href={`/tools/${tool.code}`}
      title={tool.title}
      titleClassName="line-clamp-2"
      image={{ src: thumb, alt: tool.title }}
      subtitle={
        updatedLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <FiClock aria-hidden className="h-3 w-3" />
            <span>{updatedLabel}</span>
          </span>
        ) : null
      }
    />
  );
}
