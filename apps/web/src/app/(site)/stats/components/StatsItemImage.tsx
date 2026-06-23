"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatsItemImage({
  src,
  alt,
  size,
  loading,
  className
}: {
  src: string | null;
  alt: string;
  size: number;
  loading: "eager" | "lazy";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const wrapperClassName = cn(
    "flex shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted",
    className
  );

  if (!src || failed) {
    return (
      <div className={wrapperClassName} style={{ width: size, height: size }}>
        <ShoppingBag className="h-4 w-4" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-md border border-border/70 object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}
