---
name: bloxodes-catalog-workflow-runner
description: Run one approved global Bloxodes /catalog page with parent review. Use when the user asks to create or update catalog_pages content with subagent research, catalog writing, local verification, and Codex Browser preview.
---

# Bloxodes Catalog Workflow Runner

You run one global catalog page from research to GitHub-verified QA. One subagent does the work: it researches, waits for your approval of the brief, then writes `final.json`. You review both stages.

## Subagent handoff

Every message to the subagent sets its role and the exact skill.

First message:

- You are the subagent for one global catalog page only.
- Do not run `/bloxodes-catalog-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-catalog-research`.
- Skill file: `.agents/skills/bloxodes-catalog-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After you approve the brief, send the same subagent:

- Continue with `/bloxodes-catalog-writing`.
- Skill file: `.agents/skills/bloxodes-catalog-writing/SKILL.md`.
- Read the voice guide first: `.agents/skills/bloxodes-voice/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the catalog idea and route code.
2. Ask the subagent to use `/bloxodes-catalog-research` and return `brief.md`.
3. Review existing coverage, data state, sources, useful fields and gaps.
4. Ask the same subagent to use `/bloxodes-catalog-writing` and create `final.json`.
5. Review the copy, metadata, FAQs and JSON (see Parent checks).
6. Keep the reviewed `final.json` in the task workspace. For CI, stage an exact copy in a selected batch under `content/releases/<batch>/` (operation kind `catalog`), or use a reviewed immutable bundle. Ignored `tmp/` files aren't available on GitHub by themselves. Don't start a local preview or run the verifier locally.
7. Run `Managed content QA` on GitHub with the exact committed batch or bundle. It stages the page in managed development, builds the site and checks the selected route on desktop and mobile.
8. Review the job's screenshots and reports for the `/catalog/<code>` route: browser title, meta description, canonical, one H1, a meaningful H2 outline, the Open Graph title and the relevant JSON-LD names. Visible headings should add information, not repeat the H1. The receipt must match the selected input bytes and the reviewed source SHA.
9. Return the exact final path, the successful GitHub artifact links, any blocked reason and the remaining risks. Production publication needs explicit authorization.

## Parent checks

Research and data:

- The production duplicate check is done.
- The item and data source is strong enough.

Copy, checked against `.agents/skills/bloxodes-voice/SKILL.md`:

- The opening answers what the reader came for. No template openings.
- It reads like a player talking: simple English, calm and a bit playful, light wit only on real facts. No hype words, AI filler or research voice ("sources say," "data shows").
- It explains the collection, not how to use the page.
- No raw dataset or website-first wording in public copy.
- No fact repeated across intro, body and FAQ.
- Every fact matches the approved brief.

SEO and rendering:

- The H1 is keyword-first and stable. Changing counts or dates go in metadata only, and only when verified.
- The SEO title follows the approved comparable-page pattern without keyword stuffing.
- Section headings are complete and meaningful. No redundant `Browse all...`, eyebrow, count or label added only for hierarchy.
- Rendered metadata, canonical, Open Graph title, heading outline and JSON-LD names agree.
- The verifier and Browser preview pass.
