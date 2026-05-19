import type { ReactNode } from "react";
import { processHtmlLinks } from "@/lib/link-utils";
import { renderHtmlAsReactNodes } from "@/lib/html-to-react";
import { renderMarkdown } from "@/lib/markdown";
import { resolveModifiedAt, type ContentDateSource } from "@/lib/content-dates";

export type PageFaqEntry = { q: string; a: string };

export type PageContentSource = ContentDateSource & {
  id?: string | null;
  title?: string | null;
  intro_md?: string | null;
  how_it_works_md?: string | null;
  description_md?: string | null;
  description_json?: Record<string, string> | null;
  faq_json?: PageFaqEntry[] | null;
  cta_label?: string | null;
  cta_url?: string | null;
};

export type PageContentHtml = {
  id?: string | null;
  title?: string | null;
  introHtml: string;
  howHtml: string;
  descriptionHtml: Array<{ key: string; html: string }>;
  faqHtml: Array<{ q: string; a: string }>;
  updatedAt: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export function sortOrderedContentEntries(description: Record<string, string> | null | undefined) {
  return Object.entries(description ?? {}).sort((a, b) => {
    const left = Number.parseInt(a[0], 10);
    const right = Number.parseInt(b[0], 10);
    if (Number.isNaN(left) && Number.isNaN(right)) return a[0].localeCompare(b[0]);
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return left - right;
  });
}

export async function buildPageContentHtml(source: PageContentSource | null): Promise<PageContentHtml | null> {
  if (!source) {
    return null;
  }

  const introHtml = source.intro_md ? await renderMarkdown(source.intro_md, { paragraphizeLineBreaks: true }) : "";
  const howHtml = source.how_it_works_md
    ? await renderMarkdown(source.how_it_works_md, { paragraphizeLineBreaks: true })
    : "";

  const descriptionMdHtml = source.description_md
    ? await renderMarkdown(source.description_md, { paragraphizeLineBreaks: true })
    : "";
  const descriptionEntries = sortOrderedContentEntries(source.description_json ?? {});
  const descriptionJsonHtml = await Promise.all(
    descriptionEntries.map(async ([key, value]) => ({
      key,
      html: await renderMarkdown(value ?? "", { paragraphizeLineBreaks: true })
    }))
  );
  const descriptionHtml = [
    ...(descriptionMdHtml ? [{ key: "description-md", html: descriptionMdHtml }] : []),
    ...descriptionJsonHtml
  ];

  const faqEntries = Array.isArray(source.faq_json) ? source.faq_json : [];
  const faqHtml = await Promise.all(
    faqEntries.map(async (entry) => ({
      q: entry.q,
      a: await renderMarkdown(entry.a ?? "", { paragraphizeLineBreaks: true })
    }))
  );

  return {
    id: source.id ?? null,
    title: source.title ?? null,
    introHtml,
    howHtml,
    descriptionHtml,
    faqHtml,
    updatedAt: resolveModifiedAt(source),
    ctaLabel: source.cta_label ?? null,
    ctaUrl: source.cta_url ?? null
  };
}

export function renderPageContentNodes(html: string, keyPrefix: string): ReactNode[] {
  return renderHtmlAsReactNodes(processHtmlLinks(html).__html, { keyPrefix });
}
