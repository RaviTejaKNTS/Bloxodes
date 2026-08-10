---
name: bloxodes-tier-list-writing
description: Write one Bloxodes Roblox tier-list article final.json from an approved brief. Use for /articles content that ranks a complete source-backed set of units, classes, weapons, abilities, items, characters, or similar game entities using a visual tier-list when complete exact-match local images exist, or a text/table-first layout when they do not.
---

# Bloxodes Tier List Writing

Use this after `bloxodes-article-research` and parent approval. Write one article only.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  final.json
```

Read the approved `brief.md` and the sibling `../bloxodes-article-writing/SKILL.md` before writing. Apply its house voice, accuracy, linking, metadata, FAQ, and final-output rules unless this skill gives a stricter tier-list rule.

## Readiness

Before ranking:

1. Define the exact scope, such as general progression, PvE, PvP, beginners, or endgame.
2. List the complete expected item set. Do not let easy-to-find images define coverage.
3. Verify ranking criteria and placements from the approved sources and game evidence. Do not copy one competitor's order blindly.
4. Check whether every item has an exact existing Bloxodes public image path. Reuse canonical game and collection assets under `apps/web/public`; do not duplicate them into the article folder.
5. Stop if important items or placement evidence are unresolved. Do not stop solely because some or all per-item images are unavailable; use the text/table-first shape instead.

## Required Article Shape

Write Markdown in `content_md` in this order:

1. Give the direct answer and top recommendations with any essential caveat.
2. State the ranking scope and criteria briefly.
3. When every ranked item has an exact verified local image, add exactly one `tier-list` block containing only tier ranks, images, names, and optional links. Otherwise omit the block entirely and introduce the ranking with a concise Markdown summary table.
4. Add one `## <rank> Tier` section for every tier, in best-to-worst ranking order.
5. Begin each tier section with one Markdown detail table. In visual mode, repeat the exact item name and image path from the overview. In text/table-first mode, omit the image column and include every ranked item by exact name.
6. Follow the table with useful tier-level analysis, exceptions, and player advice. Do not narrate every row again.
7. Add a conclusion only when it contributes a choice, caveat, or next step.

Use topic-specific detail columns. Examples include role, cost, stats, strengths, weaknesses, best use, PvE value, or PvP value. Keep cells concise.

## Tier-List Block

Use this block only in visual mode, when the image set is complete. Never insert placeholders, near matches, or hotlinks to force visual mode.

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
- In visual mode, confirm overview names and image paths exactly match the per-tier tables.
- Parse-check JSON.
- Run the normal article verifier against a local web server:

```bash
npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json>
```

Do not call a visual article ready if the structured block or local image checks fail. For either shape, do not call it ready if the tier detail contract, import, or rendered route fails.
