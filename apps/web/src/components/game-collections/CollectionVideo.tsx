"use client";

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";
import { extractYouTubeVideoUrlId } from "@/lib/youtube-media";

export function CollectionVideo({ url, title, poster }: { url: string; title: string; poster: string | null }) {
  const [playing, setPlaying] = useState(false);
  const videoId = extractYouTubeVideoUrlId(url);
  if (!videoId) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden border-b border-border/60 bg-black" data-collection-video>
      {playing ? (
        <iframe
          ref={(frame) => frame?.focus()}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          aria-label={`Play ${title}`}
          onClick={() => setPlaying(true)}
          className="absolute inset-0 flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <Image
            src={poster || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-black/80 text-white">
            <Play className="h-7 w-7" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
