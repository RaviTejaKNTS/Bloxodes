import Link from "next/link";
import type { Author } from "@/lib/db";
import { authorAvatarUrl } from "@/lib/avatar";
import { AuthorSocialLinks } from "@/components/AuthorSocialLinks";

type ProcessedHtml = {
  __html: string;
};

interface AuthorCardProps {
  author: Author;
  bioHtml: string | ProcessedHtml;
}

export function AuthorCard({ author, bioHtml }: AuthorCardProps) {
  const avatar = authorAvatarUrl(author);

  return (
    <section className="mt-10 border-t border-border/60 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <img
          src={avatar}
          alt={author.name}
          className="h-16 w-16 shrink-0 rounded-md border border-border/60 object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className="mb-0 text-2xl font-semibold tracking-tight text-foreground">
            {author.slug ? (
              <Link href={`/authors/${author.slug}`} className="transition hover:text-accent">
                About {author.name}
              </Link>
            ) : (
              <>About {author.name}</>
            )}
          </h2>
          {bioHtml ? (
            <div
              className="max-w-3xl text-sm leading-7 text-muted [&_a]:font-semibold [&_a]:text-accent [&_a]:underline-offset-4 [&_a:hover]:text-accent [&_p]:m-0 [&_p+p]:mt-3"
              dangerouslySetInnerHTML={typeof bioHtml === "string" ? { __html: bioHtml } : bioHtml}
            />
          ) : (
            <p className="max-w-3xl text-sm leading-7 text-muted">
              {author.name} curates the latest Roblox codes and keeps this guide up to date.
            </p>
          )}
          <AuthorSocialLinks author={author} size="sm" />
        </div>
      </div>
    </section>
  );
}
