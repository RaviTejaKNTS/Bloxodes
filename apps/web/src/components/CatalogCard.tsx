import { Gift, Image as ImageIcon, Music, Package, Palette, Shirt, Smile, Sparkles, Terminal, Wrench } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";
import type { CatalogIconKey } from "@/lib/catalog-card-meta";

const TONE_BG = {
  indigo: "bg-gradient-to-br from-indigo-500 to-indigo-700",
  emerald: "bg-gradient-to-br from-emerald-500 to-emerald-700",
  amber: "bg-gradient-to-br from-amber-500 to-amber-600"
} as const;

type Tone = keyof typeof TONE_BG;

const ICONS: Record<CatalogIconKey, typeof Music> = {
  music: Music,
  gift: Gift,
  package: Package,
  shirt: Shirt,
  image: ImageIcon,
  palette: Palette,
  terminal: Terminal,
  smile: Smile,
  sparkles: Sparkles,
  wrench: Wrench
};

type CatalogCardProps = {
  href: string;
  title: string;
  count?: number | null;
  iconKey?: CatalogIconKey | null;
  tone?: Tone;
};

export function CatalogCard({ href, title, count, iconKey, tone = "indigo" }: CatalogCardProps) {
  const Icon = iconKey ? ICONS[iconKey] : Sparkles;
  const toneBg = TONE_BG[tone] ?? TONE_BG.indigo;
  const hasCount = typeof count === "number" && Number.isFinite(count);

  return (
    <ContentCard
      type="catalog"
      variant="overlay"
      overlayAlign="center"
      overlayTextClassName="text-white"
      href={href}
      image={{ src: null, alt: title, ratio: "16:9" }}
      imageFallback={
        <div className={`absolute inset-0 ${toneBg}`}>
          <Icon className="absolute -bottom-4 -right-3 h-28 w-28 text-white/15" aria-hidden />
        </div>
      }
      title={hasCount ? count!.toLocaleString("en-US") : title}
      titleClassName={hasCount ? "text-3xl font-bold tracking-tight sm:text-4xl" : "text-xl font-bold"}
      subtitle={hasCount ? title : null}
    />
  );
}
