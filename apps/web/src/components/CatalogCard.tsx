import { Gift, Image as ImageIcon, Music, Package, Palette, Shirt, Smile, Sparkles, Terminal } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";
import type { CatalogIconKey } from "@/lib/catalog-card-meta";

const TONE_STYLES = {
  indigo: { ring: "border-accent/20", text: "text-accent" },
  emerald: { ring: "border-emerald-400/30", text: "text-emerald-600 dark:text-emerald-400" },
  amber: { ring: "border-amber-400/30", text: "text-amber-600 dark:text-amber-400" }
} as const;

type Tone = keyof typeof TONE_STYLES;

const ICONS: Record<CatalogIconKey, typeof Music> = {
  music: Music,
  gift: Gift,
  package: Package,
  shirt: Shirt,
  image: ImageIcon,
  palette: Palette,
  terminal: Terminal,
  smile: Smile,
  sparkles: Sparkles
};

type CatalogCardProps = {
  href: string;
  title: string;
  description: string;
  count?: number | null;
  unit?: string | null;
  iconKey?: CatalogIconKey | null;
  updatedLabel?: string | null;
  coverImage?: string | null;
  tone?: Tone;
};

export function CatalogCard({
  href,
  title,
  description,
  count,
  unit,
  iconKey,
  updatedLabel,
  coverImage,
  tone = "indigo"
}: CatalogCardProps) {
  const toneStyles = TONE_STYLES[tone] ?? TONE_STYLES.indigo;
  const Icon = iconKey ? ICONS[iconKey] : null;
  const hasCount = typeof count === "number" && Number.isFinite(count);

  return (
    <ContentCard
      type="catalog"
      variant="row"
      href={href}
      className="bg-surface hover:border-accent/55"
      thumbClassName={`border ${toneStyles.ring} bg-background/70`}
      title={title}
      titleClassName="transition group-hover:text-accent"
      image={{ src: coverImage, alt: title, ratio: "1:1" }}
      imageFallback={
        Icon ? (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className={`h-7 w-7 ${toneStyles.text}`} aria-hidden />
          </div>
        ) : undefined
      }
      subtitle={
        hasCount ? (
          <p className="mb-0">
            <span className="text-xl font-semibold text-foreground">{count!.toLocaleString("en-US")}</span>{" "}
            {unit ? <span className="text-sm text-muted">{unit}</span> : null}
          </p>
        ) : (
          <p className="line-clamp-2 text-sm text-muted">{description}</p>
        )
      }
      meta={
        updatedLabel ? <p className="mb-0 text-xs text-muted">Updated {updatedLabel}</p> : null
      }
    />
  );
}
