import { FiClock } from "react-icons/fi";

import { buildUpdatedDisplay } from "@/lib/content-dates";

export function UpdatedTimestamp({
  value,
  className
}: {
  value: string | Date | null | undefined;
  className?: string;
}) {
  const { exact, relative } = buildUpdatedDisplay(value);
  if (!exact) return null;

  return (
    <p className={className ?? "inline-flex items-center gap-1.5 text-sm text-foreground/80"}>
      <FiClock className="h-4 w-4 shrink-0" aria-hidden />
      Updated on <time dateTime={typeof value === "string" ? value : value?.toISOString()} className="font-semibold text-foreground">{exact}</time>
      {relative ? <span>{` (${relative})`}</span> : null}
    </p>
  );
}
