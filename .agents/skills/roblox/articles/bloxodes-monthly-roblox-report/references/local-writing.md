# Local writing and implementation checklist

Use this checklist after the evidence dossier is complete. The same agent should own the prose, implementation, evidence review, and local QA in the current workspace.

## Read completely before editing

1. `AGENTS.md`
2. `DESIGN.md`
3. `apps/web/src/app/(site)/AGENTS.md`
4. the monthly report dossier
5. the monthly analysis output
6. the raw export only when an exact daily array or event row is needed
7. the latest completed monthly report route, data, chart components, and focused tests

## Implement the report

Create `/stats/reports/roblox-[month]-[year]` as a continuous editorial feature that follows the dossier.

Non-negotiable requirements:

- Open with the dossier's strongest game story.
- Write for ordinary Roblox players in exceptionally simple, lively language.
- Use no more than three main H2 sections.
- Place no more than four real data-backed charts between relevant paragraphs.
- Use full-period paths, same-weekday movement, rolling windows, and event waves.
- Do not use arbitrary opening-window versus closing-window comparisons.
- Remove KPI cards, metric grids, dashboard navigation, executive-summary boxes, watchlists, next-month questions, visible internal-preview labels, and public developer/database language.
- Do not use `cohort`, `coverage`, or `CCU` in reader-facing copy.
- Do not claim causation. Use `coincided with`, `landed alongside`, or `the timing matches`.
- Do not call games dead, fake, or suspicious.
- Keep a tiny plain endnote for the data window and limitations.
- Keep the route `noindex`; do not add it to sitemap, feeds, navigation, revalidation, or production publishing.
- Use restrained article styling, not a card wall or AI-generated images.
- Add the dossier-approved `featureImage` configuration to the report data. Generate the static PNG from the real lead series after the module is ready.
- Derive every factual claim, link, and chart from the dossier or supplied datasets. Do not invent facts.
- Make multi-line charts distinguishable without relying only on color.

Edit only:

- new report route files;
- report data files;
- report chart files;
- the report feature image;
- focused report tests;
- directly affected report inventory documentation.

Preserve unrelated work. Do not browse, commit, deploy, publish, stage, or create a branch.

## Review the implementation

Check:

- the headline and opening are supported by the dossier;
- every number and date matches the analysis or raw data;
- every news and event link supports the adjacent claim;
- event language is correlational;
- chart titles and captions are plain and accurate;
- the page reads continuously without a hidden dashboard structure;
- technical `noindex` state is not visible as editorial copy;
- changes stay within the allowlist.

Correct factual, causal, accessibility, and layout problems before QA. If the writing is weak, revise the article directly while preserving the approved evidence and structure.

## Required checks

Run the focused report test and `npm run typecheck:web`. Start or reuse the local web server and inspect the rendered route at approximately 1440×1000, 390×844, and 320×800.

Verify:

- the opening communicates the month's hook above the fold;
- every chart renders from real data and has a plain caption/source;
- multi-series charts use line patterns or direct labels as well as color;
- chart tooltips work;
- there is no horizontal overflow, clipped required content, runtime error, or unreadable label;
- the article has a clear flow and does not look like a dashboard;
- the feature PNG is exactly 1200×630, readable at thumbnail size, and derived from the configured lead series;
- the archive, when separately approved and updated, can use the feature image without becoming a card grid;
- `og:image` and `twitter:image` use the same absolute feature-image URL;
- metadata remains `noindex`;
- the route is absent from sitemap, feeds, navigation, and revalidation.
