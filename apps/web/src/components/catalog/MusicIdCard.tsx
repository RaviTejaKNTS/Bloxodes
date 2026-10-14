import Link from "next/link";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { MusicCoverImage } from "@/components/MusicCoverImage";

export type MusicIdCardSong = {
  assetId: number;
  title: string;
  artist: string;
  genre: string | null;
  durationLabel: string | null;
  thumbnailUrl: string;
  artistHref: string;
  genreHref: string | null;
};

/**
 * Music and sound ID card, built around copying the ID. Narrow enough for three per row in a
 * 1280px laptop's main column. `minimal` drops the artist and the duration/genre footer for
 * short sound effects.
 */
export function MusicIdCard({
  song,
  rank,
  idLabel = "Music ID",
  titleAs: Title = "h2",
  minimal = false
}: {
  song: MusicIdCardSong;
  rank?: number;
  idLabel?: string;
  titleAs?: "h2" | "p";
  minimal?: boolean;
}) {
  return (
    <article className="relative flex h-full flex-col gap-3 rounded-lg border border-border/70 bg-surface p-3.5 transition duration-200 hover:border-accent/55">
      <div className="flex min-w-0 items-start gap-3 pr-9">
        <div className="relative h-[3.25rem] w-[3.25rem] flex-shrink-0 overflow-hidden rounded-md border border-border/60 bg-background/60">
          <MusicCoverImage src={song.thumbnailUrl} alt={`${song.title} Roblox music`} sizes="52px" className="object-cover" />
          {rank != null ? (
            <span className="absolute left-0 top-0 rounded-br-md bg-black/75 px-1 text-[10px] font-bold leading-4 text-white">#{rank}</span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <Title className="mb-0 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-foreground">{song.title}</Title>
          {minimal ? null : (
            <Link href={song.artistHref} className="mt-0.5 block truncate text-[0.8rem] text-muted transition hover:text-accent">
              {song.artist}
            </Link>
          )}
        </div>
      </div>
      <a
        href={`https://www.roblox.com/library/${song.assetId}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Play ${song.title} on Roblox`}
        title="Play on Roblox"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-border/80 text-accent transition hover:border-accent/60 hover:bg-accent/10"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="ml-px h-3 w-3" fill="currentColor">
          <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
        </svg>
      </a>
      <div className="mt-auto">
        <CopyCodeButton
          variant="bar"
          code={String(song.assetId)}
          label={`Copy ${idLabel} ${song.assetId}`}
          analytics={{
            event: "music_id_copy",
            params: { asset_id: song.assetId, artist: song.artist, genre: song.genre ?? "" }
          }}
        />
      </div>
      {minimal ? null : (
        <div className="-mt-0.5 flex items-center justify-between gap-3 text-[0.8rem] text-muted">
          <span className="inline-flex flex-none items-center gap-1.5">
            <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span className="sr-only">Duration</span>
            {song.durationLabel ?? "—"}
          </span>
          {song.genre && song.genreHref ? (
            <Link href={song.genreHref} className="inline-flex min-w-0 items-center gap-1.5 transition hover:text-accent">
              <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none opacity-70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l11-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="17" cy="16" r="3" />
              </svg>
              <span className="sr-only">Genre</span>
              <span className="truncate text-foreground/85">{song.genre}</span>
            </Link>
          ) : null}
        </div>
      )}
    </article>
  );
}
