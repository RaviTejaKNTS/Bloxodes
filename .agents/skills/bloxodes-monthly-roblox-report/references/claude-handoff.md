# Claude Code handoff

Create `<workspace>/claude-assignment.md` and replace every placeholder.

```markdown
# Claude assignment: rewrite the [Month Year] Roblox report

You are the editorial writer and frontend implementer for this pass.

Read completely before editing:

1. `AGENTS.md`
2. `DESIGN.md`
3. `apps/web/src/app/(site)/AGENTS.md`
4. `[DOSSIER_PATH]`
5. `[ANALYSIS_PATH]`
6. `[RAW_PATH]` only when an exact daily array or event row is needed
7. the latest completed monthly report route, data, chart components, and tests

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
- Add the dossier-approved `featureImage` configuration to the report data. The parent will generate and verify the static PNG from the real lead series.
- Derive every factual claim, link, and chart from the dossier or supplied datasets. Do not browse or invent facts.
- Make multi-line charts distinguishable without relying only on color.

You may edit only:

- `[NEW_REPORT_ROUTE_FILES]`
- `[REPORT_DATA_FILES]`
- `[REPORT_CHART_FILES]`
- `[REPORT_FEATURE_IMAGE_FILES]`
- `[FOCUSED_TEST_FILES]`
- directly affected report inventory documentation

Preserve unrelated work. Do not browse, commit, deploy, publish, stage, or create a branch.

After editing, run the focused report test and the web TypeScript check. Fix issues within the allowlist. End with a compact summary of changes and commands that passed.
```

## Parent review after Claude

Check:

- headline and opening are supported by the dossier;
- every number and date matches analysis/raw data;
- news links support the adjacent claims;
- event language is correlational;
- chart titles and captions are plain and accurate;
- the page reads continuously without a hidden dashboard structure;
- technical `noindex` state is not visible as editorial copy;
- Claude changed nothing outside the allowlist.

Correct factual, causal, accessibility, and layout problems before QA. If the writing is fundamentally weak, give Claude focused feedback and resume the writing pass instead of papering over it with cards or more metrics.
