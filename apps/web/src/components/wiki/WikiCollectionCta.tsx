import Image from "next/image";
import Link from "next/link";

function normalizeImageUrls(value?: string[] | null): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const normalized = entry.trim();
      if (!normalized) return null;
      if (/^https?:\/\//i.test(normalized)) return normalized;
      return normalized.startsWith("/") ? normalized : `/${normalized}`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 6);
}

export function WikiCollectionCta({
  href,
  title,
  imageUrls
}: {
  href: string;
  title: string;
  imageUrls?: string[] | null;
}) {
  const images = normalizeImageUrls(imageUrls);
  const label = title.trim() || "Open collection";

  return (
    <Link
      href={href}
      scroll
      className="group relative isolate flex min-h-[128px] w-full overflow-hidden rounded-lg border border-border/60 bg-surface/80 px-6 py-5 text-foreground shadow-sm transition hover:border-accent/60 dark:text-white md:min-h-[136px]"
    >
      {images.length ? (
        <div aria-hidden className="absolute inset-0 flex opacity-60">
          {images.map((image, index) => (
            <div key={`${image}-${index}`} className="relative min-w-0 flex-1 border-r border-white/20 last:border-r-0">
              <Image src={image} alt="" fill sizes="(max-width: 768px) 20vw, 120px" className="object-cover" />
            </div>
          ))}
        </div>
      ) : null}
      <span
        className="absolute inset-0 bg-gradient-to-r from-white/98 via-white/96 to-white/93 transition group-hover:from-white/97 group-hover:via-white/95 group-hover:to-white/92 dark:from-black/96 dark:via-black/93 dark:to-black/89 dark:group-hover:from-black/95 dark:group-hover:via-black/92 dark:group-hover:to-black/88"
        aria-hidden
      />
      <span className="relative z-10 flex w-full items-center">
        <span className="max-w-3xl text-base font-semibold leading-6 md:text-lg">{label}</span>
      </span>
    </Link>
  );
}
