import { ContentCard } from "@/components/ContentCard";

const TONE_STYLES = {
  indigo: {
    ring: "border-accent/20",
    text: "text-accent",
    dot: "bg-accent"
  },
  emerald: {
    ring: "border-emerald-400/30",
    text: "text-emerald-600",
    dot: "bg-emerald-400"
  },
  amber: {
    ring: "border-amber-400/30",
    text: "text-amber-600",
    dot: "bg-amber-400"
  }
} as const;

type Tone = keyof typeof TONE_STYLES;

type CatalogCardProps = {
  href: string;
  title: string;
  description: string;
  category: string;
  metricLabel?: string | null;
  metricValue?: number | null;
  updatedLabel?: string | null;
  coverImage?: string | null;
  tileLabel?: string | null;
  tone?: Tone;
};

function formatMetricValue(value: number | null | undefined) {
  if (typeof value !== "number") return "--";
  return value.toLocaleString("en-US");
}

export function CatalogCard({
  href,
  title,
  description,
  category,
  metricLabel,
  metricValue,
  updatedLabel,
  coverImage,
  tileLabel,
  tone = "indigo"
}: CatalogCardProps) {
  const toneStyles = TONE_STYLES[tone] ?? TONE_STYLES.indigo;
  const tileText = (tileLabel ?? category).slice(0, 10);
  const formattedValue = formatMetricValue(metricValue);
  const showMetric = typeof metricValue === "number" && typeof metricLabel === "string" && metricLabel.trim().length > 0;

  return (
    <ContentCard
      type="catalog"
      variant="row"
      href={href}
      className="bg-surface hover:border-accent/55"
      thumbClassName={`border ${toneStyles.ring} bg-background/70`}
      title={title}
      titleClassName="transition group-hover:text-accent"
      subtitle={<p className="line-clamp-2 text-sm text-muted">{description}</p>}
      image={{ src: coverImage, alt: title, ratio: "1:1" }}
      imageFallback={
        <div className={`flex h-full w-full items-center justify-center px-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] ${toneStyles.text}`}>
          {tileText}
        </div>
      }
      liveSlot={
        showMetric ? (
          <div className={`flex flex-wrap items-end justify-between gap-4 rounded-md border ${toneStyles.ring} bg-background/60 px-3 py-2.5`}>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">Catalog size</p>
              <p className="text-2xl font-semibold text-foreground">{formattedValue}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${toneStyles.text}`}>{metricLabel}</p>
            </div>
          </div>
        ) : updatedLabel ? (
          <div className={`flex items-center gap-2 rounded-md border ${toneStyles.ring} bg-background/60 px-3 py-2 text-sm text-muted`}>
            <span className={`h-2 w-2 rounded-full ${toneStyles.dot}`} aria-hidden />
            <span>Updated {updatedLabel}</span>
          </div>
        ) : null
      }
    />
  );
}
