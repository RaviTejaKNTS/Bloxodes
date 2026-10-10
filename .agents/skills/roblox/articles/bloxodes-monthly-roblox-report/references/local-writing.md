# Local Writing and Implementation Checklist

Use this once the evidence dossier is complete. The same agent owns the prose, the implementation, the evidence review and local QA, all in the current workspace.

## Read all of these before editing

1. `AGENTS.md`
2. `DESIGN.md`
3. `apps/web/src/app/(site)/AGENTS.md`
4. `.agents/skills/bloxodes-voice/SKILL.md` (how the prose should sound)
5. `references/editorial-standard.md` (story, data wording and chart rules for this report)
6. the monthly report dossier
7. the monthly analysis output
8. the raw export, only when you need an exact daily array or event row
9. the latest completed monthly report's route, data, chart components and focused tests

## Build the report

Create `/stats/reports/roblox-[month]-[year]` as one continuous editorial feature that follows the dossier.

**Writing**

- Open with the dossier's strongest game story.
- Write for ordinary Roblox players in very simple, lively language, following the voice guide.
- Use no more than three main H2 sections.
- Don't use `cohort`, `coverage` or `CCU` in reader-facing copy.
- Never claim causation. Use `coincided with`, `landed alongside` or `the timing matches`.
- Never call games dead, fake or suspicious.
- Keep a tiny plain endnote for the data window and limitations.
- Derive every fact, link and chart from the dossier or the supplied datasets. Never invent facts.

**Charts and data**

- Place no more than four real data-backed charts between the paragraphs they support.
- Use full-period paths, same-weekday movement, rolling windows and event waves.
- Don't use arbitrary opening-window versus closing-window comparisons.
- Make multi-line charts readable without relying on color alone.

**Page and publishing**

- Remove KPI cards, metric grids, dashboard navigation, executive-summary boxes, watchlists, next-month questions, visible internal-preview labels, and public developer or database language.
- Use restrained article styling, not a card wall or AI-generated images.
- Keep the route `noindex`. Don't add it to sitemap, feeds, navigation, revalidation or production publishing.
- Add the dossier-approved `featureImage` config to the report data. Generate the static PNG from the real lead series once the module is ready.

**Edit only:**

- new report route files
- report data files
- report chart files
- the report feature image
- focused report tests
- directly affected report inventory docs

Leave unrelated work alone. Don't browse, commit, deploy, publish, stage or create a branch.

## Review the implementation

Check that:

- the headline and opening are backed by the dossier
- every number and date matches the analysis or raw data
- every news and event link supports the claim next to it
- event language is correlational
- chart titles and captions are plain and accurate
- the page reads continuously, with no hidden dashboard structure
- the technical `noindex` state doesn't show up as editorial copy
- changes stay inside the allowlist

Fix factual, causal, accessibility and layout problems before QA. If the writing is weak (stiff, report-like or hard to follow), revise the article yourself against the voice guide, keeping the approved evidence and structure.

## Required checks

The focused report test, `typecheck:web` and the rendered checks run on GitHub in the PR workflow, never locally. Review its screenshots of the route at about 1440×1000, 390×844 and 320×800.

Verify:

- the opening gets the month's hook across above the fold
- every chart renders from real data and has a plain caption and source
- multi-series charts use line patterns or direct labels as well as color
- chart tooltips work
- no horizontal overflow, clipped required content, runtime errors or unreadable labels
- the article has a clear flow and doesn't look like a dashboard
- the feature PNG is exactly 1200×630, readable at thumbnail size and built from the configured lead series
- the archive, when separately approved and updated, can use the feature image without turning into a card grid
- `og:image` and `twitter:image` use the same absolute feature-image URL
- metadata stays `noindex`
- the route is absent from sitemap, feeds, navigation and revalidation
