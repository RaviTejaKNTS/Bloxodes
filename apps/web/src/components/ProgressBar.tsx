import { cn } from "@/lib/utils";

type ProgressBarProps = {
  /** 0–100. Clamped and rounded. */
  percent: number;
  /** Extra classes for the track (e.g. height: "h-2"). */
  className?: string;
  /** Extra classes for the fill (e.g. a different color). */
  fillClassName?: string;
  /** Accessible label for the bar. */
  label?: string;
};

/**
 * Single progress bar used across checklists, the quiz, and tools.
 * The track uses `bg-foreground/10` so it stays visible against cards in both
 * light and dark mode (the old `bg-surface-muted` track was invisible in dark).
 * The fill keeps a small minimum width so tiny progress is still perceptible.
 */
export function ProgressBar({ percent, className, fillClassName, label }: ProgressBarProps) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-foreground/10", className)}
    >
      <div
        className={cn("h-full rounded-full bg-accent transition-[width] duration-300 ease-out", fillClassName)}
        style={{ width: value > 0 ? `max(0.375rem, ${value}%)` : "0%" }}
        aria-hidden
      />
    </div>
  );
}
