"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type PreviewImage = {
  src: string;
  alt: string;
};

export function CollectionImageLightbox({ containerId }: { containerId: string }) {
  const [mounted, setMounted] = useState(false);
  const [image, setImage] = useState<PreviewImage | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest<HTMLButtonElement>("[data-collection-image-preview]");
      if (!trigger || !container.contains(trigger)) return;

      const src = trigger.dataset.collectionImageSrc;
      if (!src) return;

      setImage({
        src,
        alt: trigger.dataset.collectionImageAlt || "Collection item image"
      });
    };

    container.addEventListener("click", onClick);
    return () => container.removeEventListener("click", onClick);
  }, [containerId]);

  useEffect(() => {
    if (!image) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImage(null);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [image]);

  const activeImage = useMemo(() => image, [image]);

  if (!mounted || !activeImage) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={activeImage.alt}
      onClick={(event) => {
        if (event.target === event.currentTarget) setImage(null);
      }}
    >
      <div className="relative flex max-h-full w-full max-w-5xl items-center justify-center">
        <button
          type="button"
          onClick={() => setImage(null)}
          className="absolute right-0 top-0 z-10 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Close
        </button>
        <img
          src={activeImage.src}
          alt={activeImage.alt}
          className="max-h-[84vh] w-auto max-w-full rounded-lg object-contain shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]"
        />
      </div>
    </div>,
    document.body
  );
}
