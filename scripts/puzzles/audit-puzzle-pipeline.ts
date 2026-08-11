import "../shared/load-env";
import { formatPuzzleDate } from "@/lib/puzzle-dates";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  ALL_PUZZLE_SLUGS,
  isPuzzlePayloadStructurallyValid,
  type AnyRecord,
  type PuzzleSlug
} from "./pipeline-utils";

type PageRow = {
  slug: string;
  provider: string;
  latest_answer_date?: string | null;
  latest_fetched_at?: string | null;
};

type AnswerRow = {
  puzzle_slug: string;
  answer_date: string;
  answer_summary?: AnyRecord | null;
  payload?: AnyRecord | null;
};

type RunRow = {
  puzzle_slug?: string | null;
  ran_at: string;
  status: string;
  issue?: string | null;
  payload?: AnyRecord | null;
};

const strict = process.argv.includes("--strict");
const supportedSlugs = new Set<string>(ALL_PUZZLE_SLUGS);

async function main() {
  const expectedDate = formatPuzzleDate();
  const recentCutoff = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const sb = supabaseAdmin();

  const [pagesResult, answersResult, runsResult] = await Promise.all([
    sb
      .from("puzzle_pages_view")
      .select("slug, provider, latest_answer_date, latest_fetched_at")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    sb
      .from("puzzle_answers")
      .select("puzzle_slug, answer_date, answer_summary, payload")
      .eq("answer_date", expectedDate),
    sb
      .from("puzzle_sync_runs")
      .select("puzzle_slug, ran_at, status, issue, payload")
      .gte("ran_at", recentCutoff)
      .order("ran_at", { ascending: false })
      .limit(1000)
  ]);

  for (const result of [pagesResult, answersResult, runsResult]) {
    if (result.error) throw result.error;
  }

  const pages = (pagesResult.data ?? []) as PageRow[];
  const answers = (answersResult.data ?? []) as AnswerRow[];
  const runs = (runsResult.data ?? []) as RunRow[];
  const answersBySlug = new Map(answers.map((answer) => [answer.puzzle_slug, answer]));
  const latestRunBySlug = new Map<string, RunRow>();

  for (const run of runs) {
    if (run.puzzle_slug && !latestRunBySlug.has(run.puzzle_slug)) latestRunBySlug.set(run.puzzle_slug, run);
  }

  const failures: string[] = [];
  const report = pages.map((page) => {
    const answer = answersBySlug.get(page.slug);
    const latestRun = latestRunBySlug.get(page.slug);
    const supported = supportedSlugs.has(page.slug);
    const validPayload = supported && answer
      ? isPuzzlePayloadStructurallyValid(page.slug as PuzzleSlug, answer.payload, answer.answer_summary)
      : false;
    const runAnswerDate = String(latestRun?.payload?.answerDate ?? "");
    const reasons: string[] = [];

    if (!supported) reasons.push("unsupported published slug");
    if (page.latest_answer_date !== expectedDate) reasons.push(`latest answer is ${page.latest_answer_date ?? "missing"}`);
    if (!answer) reasons.push("current answer row missing");
    else if (!validPayload) reasons.push("current payload is incomplete");
    if (!latestRun) reasons.push("no sync run in 36h");
    else if (latestRun.status !== "ok") reasons.push(`latest run is ${latestRun.status}`);
    else if (runAnswerDate !== expectedDate) reasons.push(`latest run wrote ${runAnswerDate || "no date"}`);

    if (reasons.length) failures.push(`${page.slug}: ${reasons.join("; ")}`);

    return {
      puzzle: page.slug,
      provider: page.provider,
      expected: expectedDate,
      latest: page.latest_answer_date ?? "missing",
      latest_run: latestRun?.status ?? "missing",
      payload: validPayload ? "valid" : "invalid",
      status: reasons.length ? "FAIL" : "PASS"
    };
  });

  for (const expectedSlug of ALL_PUZZLE_SLUGS) {
    if (!pages.some((page) => page.slug === expectedSlug)) failures.push(`${expectedSlug}: expected published puzzle page is missing`);
  }

  console.table(report);
  console.log(`Puzzle pipeline audit: ${failures.length ? "FAILED" : "PASSED"} for ${expectedDate} (${pages.length} published pages).`);
  for (const failure of failures) console.error(`- ${failure}`);

  if (strict && failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
