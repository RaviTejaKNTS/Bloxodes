---
name: bloxodes-tier-list-writing
description: Write one Bloxodes Roblox tier-list article final.json from an approved brief and its media.json. Use for /articles content that ranks a complete source-backed set of units, classes, weapons, abilities, items, characters, or similar game entities, using a visual tier list when exact images are verified and text/table fallback only for explicitly accepted-missing image targets.
---

# Bloxodes Tier List Writing

Tier lists are where players want a confident take. Lead with the answer (what's on top and why), then back every placement with real game reasons. Be decisive where the evidence is clear and upfront about the scope, so nobody's surprised that the PvP king sits in B tier for wave mode.

## Code-controlled runs

If you were assigned a code-controlled stage, follow [stage ownership](../bloxodes-article-workflow-runner/references/code-controlled-stages.md). It overrides the interactive parent/subagent, upload/import and standalone self-review instructions. Do only the assigned artifact or review. The runtime owns the next stages and approval records. Keep the editorial and page-type rules below.

Use this after `bloxodes-article-research` and parent approval. One article only.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  media.json
  final.json
```

## Read first

- The approved `brief.md`.
- `../bloxodes-article-writing/SKILL.md`. Apply its voice, accuracy, linking, metadata, FAQ and final-output rules unless this skill is stricter. Its draft, parent feedback and one-revision procedure also apply. Run final checks only after editorial acceptance, and keep the tier inventory, ranking evidence and visual/table contracts through revision.
- The voice guide (`.agents/skills/bloxodes-voice/SKILL.md`) and the "Tier lists" section of its examples.

## Voice for rankings

- **Open with the verdict.** Name the top pick or two and the one reason that puts them there. Lead with the unit's name and the concrete thing it does better than anything else.
- **State scope early and plainly:** wave mode, PvP, beginners, endgame.
- **Tier analysis explains, it doesn't re-read the table.** What do units in this tier have in common, where do they fall off, and what should you pair them with?
- **Table cells stay short and plain.** Save the personality for the prose around them.

## Readiness

Before ranking:

1. Define the exact scope, like general progression, PvE, PvP, beginners or endgame.
2. List the complete expected item set. Don't let easy-to-find images define coverage.
3. Verify ranking criteria and placements from the approved sources and game evidence. Don't copy one competitor's order blindly.
4. Check whether every item has an exact existing Bloxodes public image path. Reuse canonical game and collection assets under `apps/web/public`. Don't duplicate them into the article folder.
5. Stop if important items or placement evidence are unresolved. Run `bloxodes-article-images` for the complete item set. Use the text/table-first shape only when the parent has explicitly accepted unresolved images as missing after reliable exact-match searches.

## Required article shape

Write Markdown in `content_md` in this order:

1. The direct answer and top picks, with any essential caveat.
2. The ranking scope and criteria, briefly.
3. When every ranked item has an exact verified image, exactly one `tier-list` block with tier ranks, images, names and optional links. When the parent has explicitly accepted missing visuals, the block can still include every ranked item, with text-only tiles for those accepted omissions. Otherwise leave the block out and introduce the ranking with a short Markdown summary table.
4. One `## <rank> Tier` section for every tier, best to worst.
5. Each tier section starts with one Markdown detail table. In visual mode, repeat the exact item name and image path from the overview. In text/table-first mode, leave out the image column and include every ranked item by exact name.
6. After the table, useful tier-level analysis, exceptions and player advice. Don't narrate every row again.
7. A closing section only when it adds a choice, caveat or next step.

Use topic-specific detail columns, like role, cost, stats, strengths, weaknesses, best use, PvE value or PvP value. Keep cells short.

## Tier-List Block

Use this block in visual mode when the image set is complete. If the parent has explicitly accepted missing visuals, include those names without `image` or `alt` so the renderer can show an accessible text tile. Never insert placeholders, near matches, or hotlinks to force visual mode.

```yaml
schema: 1
id: fighting-styles
title: Fighting styles ranked
collection:
  href: /wiki/gakuran/fighting-styles
  label: Fighting styles collection
tiers:
  - rank: S
    label: Best overall
    items:
      - name: Hakari
        image: /Gakuran/Fighting%20Styles/hakari.png
        alt: Hakari fighting style icon in Gakuran
  - rank: A
    items:
      - name: Boxing
        image: /Gakuran/Fighting%20Styles/boxing.png
        alt: Boxing fighting style icon in Gakuran
```

Place that YAML inside a fenced block whose language is `tier-list`.

Block rules:

- Use `schema: 1` and a unique lowercase hyphenated `id`.
- Use each tier rank once and each item name once.
- Include factual alt text for every image.
- Omit `image` and `alt` together for an explicitly accepted missing visual; do not use placeholder URLs.
- Use a verified site-relative public path or Bloxodes media URL. Never hotlink.
- Add `collection` with the verified Bloxodes collection page when one exists; omit it otherwise. Do not add per-item `href` links; items render as plain images.
- Ranks color from green downward: `S` renders as the recommended green tier and low ranks shade toward red, so order tiers best-first.
- Keep reasons, stats, pros, and cons out of the overview block.
- Skip `scope` unless the ranking needs a disambiguating context such as PvP; it only shows when no collection link exists. Add a game version to `scope` only when verified.

## Detail Tables

Use an exact H2 such as `## S Tier`. The verifier matches that heading to `rank: S`.

```markdown
| Image | Style | Best for | Strengths | Weaknesses |
|---|---|---|---|---|
| ![Hakari fighting style icon in Gakuran](/Gakuran/Fighting%20Styles/hakari.png) | Hakari | General combat | Source-backed detail | Source-backed limitation |
```

Every overview item must appear in its matching tier table with the exact same image path. Do not add a detailed row that is absent from the overview. In text/table-first mode, use the same tier headings and detail tables without an Image column; every item must still appear exactly once.

## Optional Embedded Checklist

Use an `article-checklist` block only when a short actionable list materially helps the tier-list reader. Keep it smaller than a full checklist page.

```yaml
schema: 1
id: reroll-preparation
title: Before rerolling
items:
  - id: save-current-build
    label: Save your current build
    description: Record the items you need to restore it.
```

Place that YAML inside a fenced block whose language is `article-checklist`. Item IDs must be unique lowercase hyphenated strings. Use `sections` only when the list has meaningful groups.

## Final Gate

Before returning `final.json`:

- Confirm the expected, ranked, and tabled item counts match. In visual mode, also confirm the imaged item count matches; in text/table-first mode, confirm there is no partial tier-list block or placeholder image.
- Confirm each placement belongs to the stated scope and each table adds real detail.
- Confirm overview names and tier placements exactly match the per-tier tables. In visual mode, confirm image paths match; for accepted missing visuals, confirm the text-only item appears in the matching table without a placeholder image.
- Parse-check JSON.
- Hand the final back for the normal article QA: the runtime's `import_verify` and `browser_verify` stages in code-controlled runs, or `Managed content QA` on GitHub for task work. Don't run the verifier yourself.

Do not call a visual article ready if the structured block or image checks fail. For either shape, do not call it ready if the tier detail contract, import, or rendered route fails.
