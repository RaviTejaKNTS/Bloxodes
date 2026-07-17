"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_FALLBACK = "/Bloxodes.png";

function resolveSrc(src?: string | null): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("data:")) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

type CardImageProps = {
  src?: string | null;
  alt: string;
  /** Eager-load + decode for above-the-fold (LCP) cards. */
  priority?: boolean;
  /** Image used when src is missing or fails to load. */
  fallback?: string;
  className?: string;
};

/**
 * Single image pipeline for every card. The app runs next/image with
 * `unoptimized: true`, so a plain <img> behaves identically while letting us
 * fall back to the site OG image when a remote thumbnail 404s.
 */
export function CardImage({ src, alt, priority, fallback = DEFAULT_FALLBACK, className }: CardImageProps) {
  const resolved = resolveSrc(src) ?? fallback;
  const [current, setCurrent] = useState(resolved);

  useEffect(() => {
    setCurrent(resolveSrc(src) ?? fallback);
  }, [src, fallback]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}
