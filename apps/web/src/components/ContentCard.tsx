import type { ReactNode } from "react";
import Link from "next/link";
import { CardImage } from "@/components/CardImage";
import { cn } from "@/lib/utils";

/**
 * ContentCard — the single card shell for every content type.
 *
 * It unifies the *foundation* (border, radius, background, image pipeline,
 * body layout, hover) across all cards, while each content type keeps its
 * *personality* by passing distinct content through slots:
 *   - eyebrow   small uppercase label above the title (universe, category, status)
 *   - subtitle  line under the title (description, "updated" line)
 *   - meta      stat row pinned to the bottom of the body (active codes, score)
 *   - liveSlot  dynamic widget pinned to the bottom (progress bar, countdown)
 *   - footer    supplementary strip rendered OUTSIDE the link (author, counts)
 *
 * Three layout variants:
 *   - media    image-on-top vertical card (grids / index pages)
 *   - row      small thumbnail + horizontal body (sidebars / related rails)
 *   - overlay  title rendered over a full-bleed image (spotlights / wiki)
 */

export type ContentCardType =
  | "codes"
  | "tool"
  | "quiz"
  | "checklist"
  | "wiki"
  | "catalog"
  | "events"
  | "article";

export type ContentCardVariant = "media" | "row" | "overlay";

type ImageRatio = "16:9" | "1:1" | "1200/675";

const RATIO_CLASS: Record<ImageRatio, string> = {
  "16:9": "aspect-[16/9]",
  "1:1": "aspect-square",
  "1200/675": "aspect-[1200/675]"
};

type TitleTag = "h2" | "h3" | "p";

type ContentCardProps = {
  href: string;
  type?: ContentCardType;
  variant?: ContentCardVariant;
  prefetch?: boolean;

  title: ReactNode;
  titleAs?: TitleTag;
  titleClassName?: string;

  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  liveSlot?: ReactNode;
  footer?: ReactNode;

  image?: {
    src?: string | null;
    alt: string;
    ratio?: ImageRatio;
    priority?: boolean;
  };
  /** Rendered in the image area when `image.src` is absent (e.g. gradient tile). */
  imageFallback?: ReactNode;

  /** Outer container override (background/hover tweaks per type). */
  className?: string;
  /** Row variant thumbnail wrapper override (e.g. tone ring). */
  thumbClassName?: string;
};

const OUTER_BASE =
  "group relative flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-none transition-colors";

function Title({
  as = "h3",
  className,
  children
}: {
  as?: TitleTag;
  className?: string;
  children: ReactNode;
}) {
  const Tag = as;
  return <Tag className={cn("mb-0 line-clamp-2 text-lg font-semibold leading-snug text-foreground", className)}>{children}</Tag>;
}

export function ContentCard({
  href,
  type,
  variant = "media",
  prefetch,
  title,
  titleAs,
  titleClassName,
  eyebrow,
  subtitle,
  meta,
  liveSlot,
  footer,
  image,
  imageFallback,
  className,
  thumbClassName
}: ContentCardProps) {
  const dataType = type ? { "data-card-type": type } : {};

  // ---------- OVERLAY ----------
  if (variant === "overlay") {
    const ratio = RATIO_CLASS[image?.ratio ?? "1200/675"];
    return (
      <div
        {...dataType}
        className={cn(OUTER_BASE, "border-border/50 bg-surface-muted/40 hover:border-accent/60", className)}
      >
        <Link href={href} prefetch={prefetch} className="group/link block h-full">
          <div className={cn("relative w-full overflow-hidden bg-surface-muted", ratio)}>
            {image?.src ? (
              <CardImage
                src={image.src}
                alt={image.alt}
                priority={image.priority}
                className="transition duration-700 group-hover:scale-[1.01]"
              />
            ) : (
              imageFallback ?? (
                <div className="absolute inset-0 bg-gradient-to-br from-[rgba(var(--color-accent),0.85)] via-[rgba(var(--color-accent-dark),0.7)] to-[rgba(var(--color-foreground),0.55)]" />
              )
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/35 to-transparent" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 p-3">
              {eyebrow ? (
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">{eyebrow}</p>
              ) : null}
              <Title as={titleAs} className={cn("text-base text-white drop-shadow-md", titleClassName)}>
                {title}
              </Title>
            </div>
          </div>
        </Link>
        {footer}
      </div>
    );
  }

  const body = (
    <>
      {eyebrow || title || subtitle ? (
        <div className="space-y-2">
          {eyebrow ? (
            <p className="mb-0 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">{eyebrow}</p>
          ) : null}
          <Title as={titleAs} className={titleClassName}>
            {title}
          </Title>
          {subtitle ? <div className="text-xs text-foreground/70">{subtitle}</div> : null}
        </div>
      ) : null}
      {meta || liveSlot ? (
        <div className="mt-auto space-y-2">
          {meta}
          {liveSlot}
        </div>
      ) : null}
    </>
  );

  // ---------- ROW ----------
  if (variant === "row") {
    const ratio = RATIO_CLASS[image?.ratio ?? "1:1"];
    return (
      <div {...dataType} className={cn(OUTER_BASE, "border-border/70 hover:border-border", className)}>
        <Link href={href} prefetch={prefetch} className="flex flex-1 items-start gap-4 p-4">
          <div
            className={cn(
              "relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-muted",
              ratio === RATIO_CLASS["1:1"] ? "" : ratio,
              thumbClassName
            )}
          >
            {image?.src ? (
              <CardImage src={image.src} alt={image.alt} priority={image?.priority} />
            ) : (
              imageFallback ?? <CardImage src={null} alt={image?.alt ?? ""} />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">{body}</div>
        </Link>
        {footer}
      </div>
    );
  }

  // ---------- MEDIA (default) ----------
  const ratio = RATIO_CLASS[image?.ratio ?? "16:9"];
  return (
    <div {...dataType} className={cn(OUTER_BASE, "border-border/70 hover:border-border", className)}>
      <Link href={href} prefetch={prefetch} className="flex flex-1 flex-col">
        <div className={cn("relative shrink-0 overflow-hidden bg-surface-muted", ratio)}>
          {image?.src ? (
            <CardImage
              src={image.src}
              alt={image.alt}
              priority={image.priority}
              className="transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            imageFallback ?? <CardImage src={null} alt={image?.alt ?? ""} />
          )}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card via-card/70 to-transparent" aria-hidden />
        </div>
        <div className="relative -mt-1 flex flex-1 flex-col gap-2 bg-card px-4 pb-4 pt-3">{body}</div>
      </Link>
      {footer}
    </div>
  );
}
