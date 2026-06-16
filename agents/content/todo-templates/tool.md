# Tool Page Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-or-topic-slug>/tools/<tool-code>/`

## Use With

- Skill: `bloxodes-tool-writing`
- Core docs: `agents/content/page-types/tools.md`, `agents/content/research-policy.md`
- Rewrite/edit: `agents/content/flow-pass.md`, `agents/content/final-edit.md`

## Setup

- [ ] Confirm tool code, target route, existing `tools` row, universe ID if relevant, and tool client behavior.
- [ ] Copy this file as `todo.md` before writing or updating `research-notes.md`.
- [ ] Check production DB or public production URLs first for an existing tool, article, catalog, checklist, quiz, or wiki section that already solves this use case.
- [ ] Identify the real input, output, formula, planner, converter, or checker use case.
- [ ] Check whether this should be a tool instead of a catalog, article, checklist, quiz, or wiki section.
- [ ] Inspect the actual tool UI/client labels before naming inputs or results.

## Research

- [ ] Verify formulas, rates, item values, datasets, assumptions, and limits.
- [ ] Check competing tools/calculators/trackers or record that no useful competitor was found.
- [ ] Explain what users enter, what the result means, and where it can be approximate or stale.
- [ ] Record source links and unresolved calculation risks.
- [ ] Separate exact values from estimates or user-entered assumptions.
- [ ] Hard-pass or mark `potential future` when the use case, demand, formula, or data source is weak.

## Write

- [ ] Write `final.json` in the `tools` shape.
- [ ] Make `intro_md` explain the result quickly.
- [ ] Make `how_it_works_md` practical for using the tool surface.
- [ ] Use `description_json` and FAQs only for useful assumptions, limits, and follow-up questions.

## Verify

- [ ] Run FLOW pass for meaningful body copy.
- [ ] Run final edit.
- [ ] Preview `/tools/<code>` and confirm copy, inputs, results, FAQs, and CTA behavior render correctly.
