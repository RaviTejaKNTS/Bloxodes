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
    <p className={className ?? "text-sm text-foreground/80"}>
      Updated on <span className="font-semibold text-foreground">{exact}</span>
      {relative ? <span>{` (${relative})`}</span> : null}
    </p>
  );
}
