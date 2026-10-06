---
name: bloxodes-monthly-roblox-report
description: Research, write, implement, and locally verify one Bloxodes monthly Roblox editorial report from a supplied month and year. Use when the user asks for a dated `/stats/reports/roblox-month-year` page combining Bloxodes historical player data, genre and game trends, Roblox events, major news, community context, real data-backed charts, and a reusable non-AI feature image for archive and social previews.
---

# Bloxodes Monthly Roblox Report

Create one grounded monthly Roblox feature from research through local preview. Treat the page as an editorial article supported by charts, never as a dashboard.

## Inputs and defaults

Require a month and year. Normalize:

- report key: `YYYY-MM`
- route: `/stats/reports/roblox-<month-name-lowercase>-<year>`
- workspace: `tmp/content-workspace/roblox/reports/YYYY-MM/`
- dossier: `<workspace>/brief.md`
- raw export: `<workspace>/raw.json`
- analysis: `<workspace>/analysis.json`

If the month has not ended, create only an explicitly labeled internal partial preview unless the user asks to wait. Never present a partial month as a completed monthly report.

Keep every new report `noindex` and absent from navigation, sitemap, feeds, and revalidation until the user separately approves publication. Do not deploy, commit, stage, or publish unless asked.

## Required resources

Read:

- `references/editorial-standard.md` before selecting stories or charts.
- `references/dossier-template.md` before writing `brief.md`.
- `references/local-writing.md` before writing or implementing the report.

Use `scripts/analyze-month.mjs` after producing the raw export.

Use `scripts/generate-feature-image.mts` after the headline and lead series are approved.

When querying Supabase, first use the available Supabase skill and read `supabase/AGENTS.md`. Keep queries read-only.

## Workflow

### 1. Inspect the project and prior report

Read the root and closest route `AGENTS.md` files, `DESIGN.md`, the latest completed monthly report, its data module, charts, tests, and relevant inventory docs.

Use the previous report for code patterns only. Do not reuse its headline, story selection, prose, chart series, or conclusions.

### 2. Freeze the month's source data

Collect read-only data for the full calendar month:

- `roblox_universe_stats_daily`
- matching `roblox_universes`
- overlapping `roblox_virtual_events`
- relevant `roblox_universe_update_events`

Paginate every query; do not rely on a default 1,000-row response. Check finalized status, sample counts, nulls, duplicate universe/date rows, and missing dates.

Write `raw.json` with this contract:

```json
{
  "daily": [],
  "universes": [],
  "events": [],
  "updates": []
}
```

Preserve source fields rather than silently repairing data. Record extraction time, query filters, and limitations in `brief.md`; do not expose those internal details as public page copy.

### 3. Analyze waves, not arbitrary endpoints

Run:

```bash
node .agents/skills/bloxodes-monthly-roblox-report/scripts/analyze-month.mjs \
  --month YYYY-MM \
  --input <workspace>/raw.json \
  --output <workspace>/analysis.json
```

The analyzer:

- finds the longest well-observed continuous run in the month;
- compares each date with the same weekday seven days earlier;
- measures persistence, strongest and weakest seven-day stretches, weekday patterns, and volatility;
- aggregates stable games by genre;
- surfaces breakouts, persistent climbers, cool-downs, large absolute moves, event waves, and older-game comebacks.

Do not use a first-window versus last-window comparison as the main trend measure. Do not infer platform-wide growth from a selected game set. Do not treat one intraday peak as a durable trend.

Review the generated rankings and daily paths manually. Reject anomalies, thin samples, tiny-base percentage tricks, and stories that are numerically large but uninteresting.

### 4. Research the month's public context

Browse because news, game updates, legal events, and community discussion are time-sensitive.

Research only story candidates supported by the data, plus genuinely major Roblox-wide developments during the month. Prefer:

1. Roblox announcements, DevForum posts, official game pages, and official update logs;
2. reputable independent reporting for legal, business, and safety news;
3. established game databases or focused community references for corroboration;
4. social and forum discussion only as qualitative color, never as quantified sentiment.

Verify when an event happened, not only when an article was published. Separate facts, company claims, allegations, community signals, and inference. Never claim an update, algorithm change, meme, or event caused a player movement from timing alone.

### 5. Create and approve the evidence dossier

Write `brief.md` from `references/dossier-template.md`. It must contain:

- the central human story and recommended narrative flow;
- exact usable figures for every named game and genre;
- source URLs beside the claims they support;
- chart specifications with exact series and measures;
- facts to avoid;
- source limitations and data limitations;
- public-language and design guardrails;
- a concise public endnote.

The dossier is the factual contract for the writing pass. Review it against `analysis.json` and primary sources before any page writing.

### 6. Write and implement the report locally

Work in the current task workspace after the dossier is complete. Read `references/local-writing.md`, then write the prose and implement the route, data module, charts, focused tests, and feature-image configuration directly. Keep the edit allowlist narrow: new report route files, report data and chart files, the generated feature image, focused tests, and directly affected inventory documentation.

The agent doing the implementation owns both the prose pass and the code pass. Preserve the frozen evidence contract, review every public claim against the dossier and source datasets, and do not browse beyond the research pass or publish anything as part of this step.

### 7. Generate the report feature image

Define `featureImage` in the frozen report data module with:

- one to three manually controlled headline lines;
- the month for the archive row, one plain report identifier such as `Roblox June Stats Report`, one lead metric, and accessible alt text;
- the dotted path and numeric key for the report's lead chart series;
- one Bloxodes accent color;
- the final public path `/images/reports/roblox-<month>-<year>.png`.

Use the lead observation already approved in the dossier. Do not add a random statistic merely to fill the image. Generate and verify a restrained 1200×630 PNG from the real series:

```bash
npx tsx .agents/skills/bloxodes-monthly-roblox-report/scripts/generate-feature-image.mts \
  --module apps/web/src/data/reports/roblox-<month>-<year>.ts \
  --export <report-export-name> \
  --output apps/web/public/images/reports/roblox-<month>-<year>.png
```

Keep the image exceptionally minimal: one plain `Roblox <Month> Stats Report` context line, headline, Bloxodes wordmark, one meaningful metric, and one unlabeled sparkline from the real lead series. Do not add any other eyebrow, separate month label, chart caption, axis, date, source label, divider, grid, badge, or decorative copy. Do not use AI-generated art, stock decoration, game screenshots, decorative gradients, or fake charts. Use the same static PNG as the `/stats/reports` archive thumbnail and as the report's Open Graph and Twitter large-image preview. Keep the archive as a divided editorial list, with image-left/text-right rows on desktop and stacked rows on mobile. Do not repeat the headline image inside the report body.

### 8. Review the result independently

Review the implementation as a separate pass. Check every public claim against `brief.md` and every chart array against `analysis.json` or `raw.json`.

Remove:

- internal database, development, coverage, or workflow language;
- KPI strips, metric cards, dashboard navigation, executive-summary boxes, watchlists, and “questions for next month”;
- arbitrary start/end comparisons;
- causal wording unsupported by evidence;
- repetitive game-by-game blocks;
- hype, jargon, and unexplained abbreviations.

Require one continuous article, no more than three main H2 sections, and at most four useful charts placed between the paragraphs they support.

### 9. Verify code and rendered page

Run the focused report tests and `npm run typecheck:web`. Add tests for date alignment, normalization, ordering, event-marker dates, and banned public terminology.

Start or reuse the local web server. Inspect the rendered route in a real browser at:

- desktop: about 1440×1000;
- mobile: about 390×844;
- narrow mobile: about 320×800.

Verify:

- the opening communicates the month's hook above the fold;
- every chart renders from real data and has a plain caption/source;
- multi-series charts use line patterns or direct labels as well as color;
- chart tooltips work;
- no horizontal overflow, clipped required content, runtime errors, or unreadable labels;
- the article has a clear story flow and does not look like a dashboard;
- the feature PNG is exactly 1200×630, readable at thumbnail size, and derived from the configured lead series;
- the archive uses the feature image without becoming a card grid;
- `og:image` and `twitter:image` use the same absolute feature-image URL;
- metadata remains `noindex`;
- the route is absent from sitemap, feeds, navigation, and revalidation.

Keep the localhost server running when the user wants to review the page.

## Final response

Return:

- localhost report link;
- dossier path;
- feature-image path;
- files created or changed;
- tests, typecheck, and responsive QA completed;
- confirmation that the page remains internal and unpublished;
- any unresolved source or data limitations.

Do not claim completion if the dossier, implementation, evidence review, or rendered-page QA is missing.
