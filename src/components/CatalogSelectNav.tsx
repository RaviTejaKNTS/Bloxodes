"use client";

import type { ChangeEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type CatalogSelectNavOption = {
  value: string;
  label: string;
  count?: number;
  href?: string;
  targetId?: string;
};

type CatalogSelectNavProps = {
  label: string;
  options: CatalogSelectNavOption[];
  value?: string;
  placeholder?: string;
  className?: string;
};

export function CatalogSelectNav({
  label,
  options,
  value,
  placeholder,
  className
}: CatalogSelectNavProps) {
  if (!options.length) return null;

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const option = options.find((entry) => entry.value === event.currentTarget.value);
    if (!option) return;

    if (option.targetId) {
      document.getElementById(option.targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      window.history.replaceState(null, "", `#${option.targetId}`);
      event.currentTarget.value = "";
      return;
    }

    if (option.href && option.href !== window.location.pathname) {
      window.location.assign(option.href);
    }
  }

  return (
    <div className={cn("catalog-surface max-w-md space-y-2", className)}>
      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </label>
      <div className="relative">
        <select
          defaultValue={value ?? ""}
          onChange={handleChange}
          className="h-11 w-full appearance-none rounded-md border border-border/70 bg-surface px-3 pr-10 text-sm font-medium text-foreground outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
          aria-label={label}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {typeof option.count === "number" ? ` (${option.count.toLocaleString("en-US")})` : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
