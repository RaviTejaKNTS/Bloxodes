"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type RedeemImageGalleryProps = {
  images: string[];
  gameName: string;
  variant?: "default" | "card";
  className?: string;
  buttonClassName?: string;
  imageClassName?: string;
  imageAltBase?: string;
  openLabel?: string;
};

export function RedeemImageGallery({
  images,
  gameName,
  variant = "default",
  className,
  buttonClassName,
  imageClassName,
  imageAltBase,
  openLabel
}: RedeemImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isCard = variant === "card";
  const justifyClass = images.length === 1 ? "justify-center" : "justify-start";
  const itemWidth = useMemo(() => {
    if (isCard) return "100%";
    if (images.length === 3) return "calc((100% - 2rem) / 3)";
    if (images.length === 2) return "calc((100% - 1rem) / 2)";
    return "50%";
  }, [images.length, isCard]);

  const open = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const close = useCallback(() => {
    setActiveIndex(null);
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((prev) => {
          if (prev === null) return prev;
          return (prev + 1) % images.length;
        });
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((prev) => {
          if (prev === null) return prev;
          return (prev - 1 + images.length) % images.length;
        });
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, close, images.length]);

  useEffect(() => {
    if (activeIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex]);

  if (images.length === 0) return null;

  return (
    <>
      <div className={cn(isCard ? "h-full w-full" : `mt-6 flex flex-nowrap gap-4 pb-2 ${justifyClass}`, className)}>
        {images.map((src, idx) => (
          <figure
            key={`${src}-${idx}`}
            className={cn(isCard ? "h-full w-full" : "flex-shrink-0 w-full")}
            style={{ flex: `0 0 ${itemWidth}`, maxWidth: itemWidth }}
          >
            <button
              type="button"
              onClick={() => open(idx)}
              aria-label={openLabel ?? `Open ${gameName} image ${idx + 1}`}
              className={cn(
                "group block w-full overflow-hidden border border-border/50 bg-surface transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                isCard ? "relative h-full rounded-none shadow-none" : "rounded-[var(--radius-sm)] shadow-soft",
                buttonClassName
              )}
            >
              <img
                src={src}
                alt={imageAltBase ? `${imageAltBase}${images.length > 1 ? ` ${idx + 1}` : ""}` : `${gameName} redeem step ${idx + 1}`}
                loading="lazy"
                className={cn(
                  isCard ? "h-full w-full object-cover" : "h-auto w-full object-cover",
                  "transition duration-300 group-hover:scale-[1.02]",
                  imageClassName
                )}
              />
            </button>
          </figure>
        ))}
      </div>

      {activeIndex !== null ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={imageAltBase ? `${imageAltBase}${images.length > 1 ? ` ${activeIndex + 1}` : ""}` : `${gameName} redeem step ${activeIndex + 1}`}
          onClick={close}
        >
          <div
            className="relative mx-auto flex max-h-full w-full max-w-4xl flex-col items-center gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-3 top-3 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Close
            </button>
            <img
              src={images[activeIndex]}
              alt={imageAltBase ? `${imageAltBase}${images.length > 1 ? ` ${activeIndex + 1}` : ""}` : `${gameName} redeem step ${activeIndex + 1}`}
              className="max-h-[80vh] w-full rounded-[var(--radius-lg)] object-contain shadow-[0_40px_80px_-30px_rgba(0,0,0,0.65)]"
            />
            {images.length > 1 ? (
              <div className="flex items-center gap-3 text-sm text-white/80">
                <button
                  type="button"
                  onClick={() => setActiveIndex((activeIndex + images.length - 1) % images.length)}
                  className="rounded-full bg-white/10 px-3 py-1 font-semibold uppercase tracking-wide transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Prev
                </button>
                <span>
                  {activeIndex + 1} / {images.length}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveIndex((activeIndex + 1) % images.length)}
                  className="rounded-full bg-white/10 px-3 py-1 font-semibold uppercase tracking-wide transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
