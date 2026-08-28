import Link from "next/link";
import type { ReactNode } from "react";
import { FiClock } from "react-icons/fi";
import { MorePuzzles } from "@/components/more-content";
import type { ContentFaqItem } from "@/components/ContentFaq";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { renderHtmlAsReactNodes } from "@/lib/html-to-react";
import { markdownToPlainText, renderMarkdown } from "@/lib/markdown";
import {
  getPuzzleAnswerByDate,
  getPuzzlePageBySlug,
  getPuzzlePageWithAnswers,
  listPublishedPuzzlePages,
  type PuzzleAnswer,
  type PuzzlePage
} from "@/lib/puzzles";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { PuzzleVisualAnswer } from "./components/PuzzleVisualAnswer";

export const PUZZLES_DESCRIPTION =
  "Daily puzzle answers for Wordle, Connections, Strands, Spelling Bee, Letter Boxed, Sudoku, Pips, Contexto, Letroso, and LinkedIn games.";

type AnyRecord = Record<string, unknown>;

const puzzleCardNames: Record<string, string> = {
  wordle: "Wordle",
  connections: "Connections",
  strands: "Strands",
  "spelling-bee": "Spelling Bee",
  "letter-boxed": "Letter Boxed",
  sudoku: "Sudoku",
  pips: "NYT Pips",
  contexto: "Contexto",
  letroso: "Letroso",
  "linkedin-zip": "LinkedIn Zip",
  "linkedin-crossclimb": "LinkedIn Crossclimb",
  "linkedin-queens": "LinkedIn Queens",
  "linkedin-tango": "LinkedIn Tango",
  "linkedin-mini-sudoku": "LinkedIn Mini Sudoku"
};

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function puzzleCardName(page: PuzzlePage) {
  return puzzleCardNames[page.slug] ?? page.title.replace(/^Today's\s+/i, "").replace(/\s+Answer$/i, "");
}

function summaryOf(answer: PuzzleAnswer | null): AnyRecord {
  return asRecord(answer?.answer_summary);
}

function formatDate(value?: string | null, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(date);
}

function formatDateShort(value?: string | null) {
  return formatDate(value, { month: "short", day: "numeric", year: "numeric" });
}

function formatUpdated(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatUpdatedDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function puzzleIdLabel(answer: PuzzleAnswer | null) {
  const id = answer?.puzzle_id || asString(summaryOf(answer).puzzleId);
  return id ? `Puzzle #${id}` : null;
}

function answerTitle(label: string, answer: PuzzleAnswer | null) {
  const date = answer?.answer_date ? formatDateShort(answer.answer_date) : "";
  const id = puzzleIdLabel(answer);
  return [label, date, id].filter(Boolean).join(" - ");
}

function PuzzleFaq({ items }: { items: ContentFaqItem[] }) {
  if (!items.length) return null;

  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">FAQ</h2>
      <div className="mt-4 space-y-5">
        {items.map((item) => (
          <div key={item.id}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Q.</span>
              <p className="text-base font-semibold leading-6 text-foreground">{item.question}</p>
            </div>
            <div className="content-faq-answer md-copy-scope mt-2 sm:pl-8">{item.answer}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

async function markdownNodes(markdown?: string | null, keyPrefix = "md") {
  if (!markdown) return null;
  const html = await renderMarkdown(markdown, { paragraphizeLineBreaks: true });
  return renderHtmlAsReactNodes(html, { keyPrefix });
}

async function buildFaqItems(page: PuzzlePage): Promise<ContentFaqItem[]> {
  const entries = Array.isArray(page.faq_json) ? page.faq_json : [];
  const items = await Promise.all(
    entries.map(async (entry, index) => {
      const html = await renderMarkdown(entry.a ?? "", { paragraphizeLineBreaks: true });
      return {
        id: `${page.slug}-faq-${index}`,
        question: entry.q,
        answer: <>{renderHtmlAsReactNodes(html, { keyPrefix: `${page.slug}-faq-${index}` })}</>
      };
    })
  );
  return items;
}

function AnswerShell({
  title,
  answer,
  children
}: {
  title: string;
  answer: PuzzleAnswer | null;
  children: ReactNode;
}) {
  if (!answer) {
    return (
      <section>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted">No saved answer is available yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{answerTitle(title, answer)}</h2>
      {children}
    </section>
  );
}

function renderAnswerContent(page: PuzzlePage, answer: PuzzleAnswer) {
  return <PuzzleVisualAnswer puzzleSlug={page.slug} payload={answer.payload} summary={answer.answer_summary} />;
}

export async function loadPuzzlesIndexData() {
  const pages = await listPublishedPuzzlePages();
  return { pages };
}

export async function renderPuzzlesIndex({ pages }: Awaited<ReturnType<typeof loadPuzzlesIndexData>>) {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Puzzle Answers",
    description: PUZZLES_DESCRIPTION,
    url: `${SITE_URL.replace(/\/$/, "")}/puzzles`
  };

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Daily puzzle answers in one clean place</h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">{PUZZLES_DESCRIPTION}</p>
      </header>

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--puzzles">
        {pages.length ? (
          pages.map((page) => (
            <div key={page.slug} data-journey-item className="h-full">
              <Link
                href={`/puzzles/${page.slug}`}
                className="group flex min-w-0 flex-col items-center rounded-lg px-1 py-2 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                <span className="flex aspect-square w-full max-w-[138px] items-center justify-center transition duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.03] min-[560px]:max-w-[146px] md:max-w-[158px]">
                  {page.icon_url ? (
                    <img
                      src={page.icon_url}
                      alt=""
                      className="h-full w-full rounded-lg object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded-lg border border-border/70 bg-card px-4 text-sm font-semibold text-muted">
                      {puzzleCardName(page)}
                    </span>
                  )}
                </span>
                <h2 className="mt-2.5 text-sm font-bold leading-tight text-foreground transition group-hover:text-accent md:text-base">
                  {puzzleCardName(page)}
                </h2>
              </Link>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-sm text-muted">
            No puzzle pages have been published yet. Check back soon.
          </div>
        )}
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
    </div>
  );
}

export async function loadPuzzleDetailData(slug: string) {
  return getPuzzlePageWithAnswers(slug);
}

export async function renderPuzzleDetail(data: NonNullable<Awaited<ReturnType<typeof loadPuzzleDetailData>>>) {
  const { page, today, yesterday, archive } = data;
  const intro = await markdownNodes(page.intro_md, `${page.slug}-intro`);
  const answerIntro = await markdownNodes(page.answer_intro_md, `${page.slug}-answer-intro`);
  const how = await markdownNodes(page.how_to_play_md, `${page.slug}-how`);
  const description = await markdownNodes(page.description_md, `${page.slug}-description`);
  const faqItems = await buildFaqItems(page);
  const updatedLabel = formatUpdatedDate(today?.fetched_at ?? page.content_updated_at ?? page.updated_at ?? page.published_at);
  const baseUrl = SITE_URL.replace(/\/$/, "");
  const previousAnswers = [yesterday, ...archive].filter((answer): answer is PuzzleAnswer => Boolean(answer));
  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", url: baseUrl },
    { name: "Puzzles", url: `${baseUrl}/puzzles` },
    { name: page.title, url: `${baseUrl}/puzzles/${page.slug}` }
  ]);
  const webPage = webPageJsonLd({
    title: page.seo_title || page.title,
    description: page.meta_description || PUZZLES_DESCRIPTION,
    slug: `/puzzles/${page.slug}`,
    siteUrl: baseUrl,
    image: "/Bloxodes.png",
    author: null,
    publishedAt: page.published_at,
    updatedAt: page.content_updated_at ?? page.updated_at
  });

  return (
    <article className="space-y-8">
      <PageBreadcrumb
        className="mb-4 text-xs uppercase tracking-[0.25em] text-muted"
        items={[{ label: "Home", href: "/" }, { label: "Puzzles", href: "/puzzles" }, { label: page.title }]}
      />
      <header className="mb-6">
        <h1 className="text-4xl font-bold text-foreground md:text-5xl">{page.title}</h1>
        {updatedLabel ? (
          <div className="mt-4 flex flex-col gap-3 text-sm text-muted">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-foreground/80">
                <FiClock className="h-4 w-4 shrink-0" aria-hidden />
                Updated on <span className="font-semibold text-foreground">{updatedLabel}</span>
              </span>
            </div>
          </div>
        ) : null}
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope game-copy puzzle-copy journey-content-stream journey-content-stream--interactive">
        {intro}
        {answerIntro}

        <AnswerShell title="Today's Answer" answer={today}>{today ? renderAnswerContent(page, today) : null}</AnswerShell>

        {how ? (
          <>
            <h2>How to Play</h2>
            {how}
          </>
        ) : null}
        {description}

        {previousAnswers.length ? (
          <section>
            <h2>Answer Archive</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-muted">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Puzzle</th>
                    <th className="py-2">Archive</th>
                  </tr>
                </thead>
                <tbody>
                  {previousAnswers.map((answer) => (
                    <tr key={answer.id}>
                      <td className="py-3 pr-4 text-foreground">
                        {formatDate(answer.answer_date)}
                        {yesterday?.id === answer.id ? <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Yesterday</span> : null}
                      </td>
                      <td className="py-3 pr-4 text-muted">{puzzleIdLabel(answer) ?? "-"}</td>
                      <td className="py-3"><Link className="font-semibold text-accent hover:underline" href={`/puzzles/${page.slug}/${answer.answer_date}`}>View answer</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <PuzzleFaq items={faqItems} />
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }} />
      <MorePuzzles excludeSlug={page.slug} />
    </article>
  );
}

export async function loadPuzzleArchiveData(slug: string, date: string) {
  const [page, answer] = await Promise.all([getPuzzlePageBySlug(slug), getPuzzleAnswerByDate(slug, date)]);
  if (!page || !answer) return null;
  return { page, answer };
}

export async function renderPuzzleArchive(data: NonNullable<Awaited<ReturnType<typeof loadPuzzleArchiveData>>>) {
  const { page, answer } = data;
  const description = page.description_md ? markdownToPlainText(page.description_md).slice(0, 220) : page.meta_description;

  return (
    <article className="space-y-8">
      <PageBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Puzzles", href: "/puzzles" },
          { label: page.title, href: `/puzzles/${page.slug}` },
          { label: formatDateShort(answer.answer_date) }
        ]}
      />
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          {page.title} for {formatDate(answer.answer_date)}
        </h1>
        {description ? <p className="max-w-2xl text-base text-muted md:text-lg">{description}</p> : null}
      </header>

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--interactive">
        <AnswerShell title="Archived Answer" answer={answer}>{renderAnswerContent(page, answer)}</AnswerShell>

        <div className="rounded-lg border border-border/70 bg-surface/60 p-4 text-sm text-muted">
          Looking for the newest answer? <Link className="font-semibold text-accent hover:underline" href={`/puzzles/${page.slug}`}>Open the current {page.title} page</Link>.
        </div>
      </section>
    </article>
  );
}
