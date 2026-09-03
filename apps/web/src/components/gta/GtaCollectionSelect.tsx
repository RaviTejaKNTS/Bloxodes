"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

export function GtaCollectionSelect({
  value,
  options
}: {
  value: string;
  options: Array<{ value: string; label: string; href: string; pageType?: "database" | "checklist" }>;
}) {
  const router = useRouter();
  if (!options.length) return null;

  return (
    <div className="relative min-w-0 md:max-w-sm">
      <label htmlFor="gta-collection-select" className="sr-only">Choose a GTA collection</label>
      <select
        id="gta-collection-select"
        value={value}
        onChange={(event) => {
          const option = options.find((entry) => entry.value === event.target.value);
          if (option) router.push(option.href);
        }}
        className="h-11 w-full appearance-none rounded-md border border-border/70 bg-surface px-3 pr-10 text-sm font-medium text-foreground outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
        aria-label="Choose a GTA collection"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}
