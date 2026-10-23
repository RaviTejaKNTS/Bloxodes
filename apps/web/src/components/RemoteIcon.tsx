"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Keep failed CDN icons out of the DOM. A new URL is tried automatically.
export function RemoteIcon({ src, alt, size, fallback, className, loading = "lazy" }: {
  src?: string | null;
  alt: string;
  size: number;
  fallback: ReactNode;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    // The CDN error may have fired before hydration attached onError.
    if (src && image?.complete && image.naturalWidth === 0) setFailedSrc(src);
  }, [src]);
  if (!src || failedSrc === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={imageRef} src={src} alt={alt} width={size} height={size} loading={loading} decoding="async"
      className={className} onError={() => setFailedSrc(src)} />
  );
}
