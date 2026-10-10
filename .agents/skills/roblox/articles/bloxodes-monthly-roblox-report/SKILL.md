---
name: bloxodes-monthly-roblox-report
description: Research, write, implement and GitHub-verify one Bloxodes monthly Roblox editorial report from a supplied month and year. Use when the user asks for a dated `/stats/reports/roblox-month-year` page combining Bloxodes historical player data, genre and game trends, Roblox events, major news, community context, real data-backed charts, and a reusable non-AI feature image for archive and social previews.
---

# Bloxodes Monthly Roblox Report

You make one grounded monthly Roblox feature, from data and research through GitHub-verified checks. It's an editorial article that tells the month's story, with charts that back it up. It's never a dashboard. Done means a dossier, an implemented route, a real feature image, passing GitHub checks and an honest list of limits.

## Inputs and defaults

You need a month and year. Normalize them to:

| Item | Value |
| --- | --- |
| Report key | `YYYY-MM` |
| Route | `/stats/reports/roblox-<month-name-lowercase>-<year>` |
| Workspace | `tmp/content-workspace/roblox/reports/YYYY-MM/` |
| Dossier | `<workspace>/brief.md` |
| Raw export | `<workspace>/raw.json` |
| Analysis | `<workspace>/analysis.json` |

- If the month hasn't ended, create only a clearly labeled internal partial preview, unless the user asks you to wait. Never present a partial month as a finished monthly report.
- Keep every new report `noindex` and out of navigation, sitemap, feeds and revalidation until the user separately approves publication.
- Don't deploy, commit, stage or publish unless asked.

## Read these

- `references/editorial-standard.md` before picking stories or charts.
- `references/dossier-template.md` before writing `brief.md`.
- `references/local-writing.md` before writing or implementing the report.
- The voice guide, `.agents/skills/bloxodes-voice/SKILL.md`, before writing any public copy.

Tools:

- Run `scripts/analyze-month.mjs` after producing the raw export.
- Run `scripts/generate-feature-image.mts` after the headline and lead series are approved.
- When querying Supabase, use the available Supabase skill and read `supabase/AGENTS.md` first. Keep queries read-only.

## Workflow

### 1. Inspect the project and the last report

Read the root and closest route `AGENTS.md` files, `DESIGN.md`, the latest completed monthly report, its data module, charts, tests and the relevant inventory docs.

Use the previous report for code patterns only. Don't reuse its headline, story selection, prose, chart series or conclusions.

### 2. Freeze the month's source data

Collect read-only data for the full calendar month:

- `roblox_universe_stats_daily`
- matching `roblox_universes`
- overlapping `roblox_virtual_events`
- relevant `roblox_universe_update_events`

Paginate every query. Don't rely on a default 1,000-row response. Check finalized status, sample counts, nulls, duplicate universe/date rows and missing dates.

Write `raw.json` with this contract:

```json
{
  "daily": [],
  "universes": [],
  "events": [],
  "updates": []
}
```

Keep source fields as they are instead of quietly repairing data. Record the extraction time, query filters and limitations in `brief.md`. Those internal details never appear in public copy.

### 3. Analyze waves, not arbitrary endpoints

Run:

```bash
node .agents/skills/bloxodes-monthly-roblox-report/scripts/analyze-month.mjs \
  --month YYYY-MM \
  --input <workspace>/raw.json \
  --output <workspace>/analysis.json
```

The analyzer:

- finds the longest well-observed continuous run in the month
- compares each date with the same weekday seven days earlier
- measures persistence, the strongest and weakest seven-day stretches, weekday patterns and volatility
- aggregates stable games by genre
- surfaces breakouts, persistent climbers, cool-downs, large absolute moves, event waves and older-game comebacks

Rules for reading it:

- Don't use a first-window versus last-window comparison as the main trend measure.
- Don't infer platform-wide growth from a selected set of games.
- Don't treat one intraday peak as a lasting trend.
- Review the generated rankings and daily paths by hand. Reject anomalies, thin samples, tiny-base percentage tricks, and stories that are numerically big but boring.

### 4. Research the month's public context

Browse, because news, game updates, legal events and community discussion are time-sensitive.

Research only story candidates the data supports, plus genuinely major Roblox-wide developments that month. Prefer, in this order:

1. Roblox announcements, DevForum posts, official game pages and official update logs
2. reputable independent reporting for legal, business and safety news
3. established game databases or focused community references for corroboration
4. social and forum discussion, only as qualitative color, never as quantified sentiment

- Verify when an event happened, not just when an article about it was published.
- Separate facts, company claims, allegations, community signals and inference.
- Never claim an update, algorithm change, meme or event caused a player movement just from timing.

### 5. Create and approve the evidence dossier

Write `brief.md` from `references/dossier-template.md`. It must contain:

- the central human story and the recommended narrative flow
- exact usable figures for every named game and genre
- source URLs next to the claims they support
- chart specs with exact series and measures
- facts to avoid
- source limitations and data limitations
- public-language and design guardrails
- a short public endnote

The dossier is the factual contract for the writing pass. Check it against `analysis.json` and primary sources before any page writing.

### 6. Write and implement the report

Work in the current task workspace once the dossier is complete. Read `references/local-writing.md`, then write the prose and implement the route, data module, charts, focused tests and feature-image config directly.

- Keep the edit allowlist narrow: new report route files, report data and chart files, the generated feature image, focused tests, and directly affected inventory docs.
- The agent doing the implementation owns both the prose pass and the code pass.
- Keep the frozen evidence contract. Check every public claim against the dossier and source datasets.
- Don't browse beyond the research pass, and don't publish anything in this step.

### 7. Generate the report feature image

Define `featureImage` in the frozen report data module with:

- one to three manually controlled headline lines
- the month for the archive row, one plain report identifier like `Roblox June Stats Report`, one lead metric and accessible alt text
- the dotted path and numeric key for the report's lead chart series
- one Bloxodes accent color
- the final public path `/images/reports/roblox-<month>-<year>.png`

Use the lead observation already approved in the dossier. Don't add a random stat just to fill the image. Generate and check a restrained 1200×630 PNG from the real series:

```bash
npx tsx .agents/skills/bloxodes-monthly-roblox-report/scripts/generate-feature-image.mts \
  --module apps/web/src/data/reports/roblox-<month>-<year>.ts \
  --export <report-export-name> \
  --output apps/web/public/images/reports/roblox-<month>-<year>.png
```

Keep the image very minimal:

- **Include only:** one plain `Roblox <Month> Stats Report` context line, the headline, the Bloxodes wordmark, one meaningful metric, and one unlabeled sparkline from the real lead series.
- **Leave out:** any other eyebrow, separate month label, chart caption, axis, date, source label, divider, grid, badge or decorative copy.
- **Never use:** AI-generated art, stock decoration, game screenshots, decorative gradients or fake charts.

Use the same static PNG as the `/stats/reports` archive thumbnail and as the report's Open Graph and Twitter large-image preview. Keep the archive as a divided editorial list: image left and text right on desktop, stacked on mobile. Don't repeat the headline image inside the report body.

### 8. Review the result independently

Review the implementation as a separate pass. Check every public claim against `brief.md`, and every chart array against `analysis.json` or `raw.json`.

Remove:

- internal database, development, coverage or workflow language
- KPI strips, metric cards, dashboard navigation, executive-summary boxes, watchlists and "questions for next month"
- arbitrary start/end comparisons
- causal wording the evidence doesn't support
- repetitive game-by-game blocks
- hype, jargon and unexplained abbreviations

Require one continuous article, no more than three main H2 sections, and at most four useful charts placed between the paragraphs they support. Read the prose against the voice guide too: it should sound like a player explaining the month to a friend, not a stats bulletin.

### 9. Verify code and the rendered page

Add focused tests for date alignment, normalization, ordering, event-marker dates and banned public terminology. Don't run tests, typecheck, builds or a local server locally. They run on GitHub in the PR workflow once the brief allows a commit and PR. Review that workflow's results and screenshots of the rendered route at:

- desktop: about 1440×1000
- mobile: about 390×844
- narrow mobile: about 320×800

Verify:

- the opening gets the month's hook across above the fold
- every chart renders from real data and has a plain caption and source
- multi-series charts use line patterns or direct labels as well as color
- chart tooltips work
- no horizontal overflow, clipped required content, runtime errors or unreadable labels
- the article has a clear story flow and doesn't look like a dashboard
- the feature PNG is exactly 1200×630, readable at thumbnail size and built from the configured lead series
- the archive uses the feature image without turning into a card grid
- `og:image` and `twitter:image` use the same absolute feature-image URL
- metadata stays `noindex`
- the route is absent from sitemap, feeds, navigation and revalidation

If the PR workflow's screenshots don't cover an item above, report it as an open QA gap. Only when the owner explicitly asks for the existing homelab preview, follow the preview rule in root `AGENTS.md`.

## Final response

Return:

- the GitHub check and screenshot links (or why no PR was opened yet)
- the dossier path
- the feature-image path
- files created or changed
- GitHub tests, typecheck and responsive QA results
- confirmation that the page stays internal and unpublished
- any unresolved source or data limitations

Don't claim completion if the dossier, implementation, evidence review or rendered-page QA is missing.
