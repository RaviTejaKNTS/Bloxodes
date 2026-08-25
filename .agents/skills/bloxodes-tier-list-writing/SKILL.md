---
name: bloxodes-tier-list-writing
description: Write one Bloxodes Roblox tier-list article final.json from an approved brief and mandatory media.json. Use for /articles content that independently ranks a complete verified set of units, classes, weapons, abilities, items, characters, or similar game entities with the tier-list component, including text-only items when images are unavailable.
---

# Bloxodes Tier List Writing

Use this after `bloxodes-article-research` and parent approval. Write one article only.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  media.json
  final.json
```

Read the approved `brief.md` and the sibling `../bloxodes-article-writing/SKILL.md` before writing. Apply its house voice, accuracy, linking, metadata, FAQ, and final-output rules unless this skill gives a stricter tier-list rule.

## Readiness

Before ranking:

1. Define the exact scope, such as general progression, PvE, PvP, beginners, or endgame.
2. List the complete expected item set. Do not let easy-to-find images define coverage.
3. Build a Bloxodes ranking from the verified game facts and the player outcome defined by the scope. Competitor lists may reveal candidates or disputed placements, but their order is never the starting point, scoring input, or fallback.
4. Check whether every item has an exact existing Bloxodes public image path. Reuse canonical game and collection assets under `apps/web/public`; do not duplicate them into the article folder.
5. Stop if important items or placement evidence are unresolved. Run `bloxodes-article-images` for the complete item set. Missing images never remove the structured tier list: use text-only component items after the parent accepts the image gaps.

## Independent Ranking Gate

- Convert the scope into explicit gamer-facing criteria before placing anything. Examples: clear speed, survivability, team dependence, setup time, cost to reach full value, boss damage, crowd control, or PvP escape options.
- Use exact verified values where the game exposes them. When no number exists, use a concrete mechanic or repeatable player outcome, not another publisher's opinion.
- Rank the complete expected set from those criteria. Record the placement reason and the main condition that could move each item up or down.
- Compare the finished order with competitor lists only as a disagreement check. If the order matches one list exactly, re-evaluate every placement and document why the match is independently justified. Never publish a borrowed order with a disclaimer.
- Keep source names, research process, consensus language, and comparison with other rankings out of public copy. The article may explain the Bloxodes criteria and the gamer reason for a placement directly.

## Required Article Shape

Write Markdown in `content_md` in this order:

1. Open with a short gamer hook: two or three plain sentences about the choice or mistake the player is trying to avoid. Give the top pick only if it helps the hook. No game-history warm-up, source talk, or long methodology intro.
2. State the exact ranking scope and criteria in one compact paragraph. Do not list the tier placements in prose.
3. Add exactly one `tier-list` block containing every ranked item. Include verified images where available and text-only items where images were accepted missing. There is no Markdown-only fallback.
4. Add one `## <rank> Tier` section for every tier, in best-to-worst ranking order.
5. Under each tier heading, add one short cue that explains what kind of player decision the tier answers. Do not repeat the item names or placement summary from the component.
6. Add one Markdown detail table. Include every item in that tier once. Use images only for verified visuals; omit the Image column when every item in that table is text-only.
7. Follow the table with new analysis: thresholds, matchup or mode exceptions, team interactions, upgrade paths, failure cases, and what could move an item between tiers. Do not narrate rows, placements, or table values again.
8. Add a conclusion only when it contributes a choice, caveat, or next step.

Use topic-specific detail columns. Examples include role, exact cost, exact stats, cooldown, range, setup time, strengths, weaknesses, best use, PvE value, or PvP value. Keep cells concise. Put each number in either the table or prose, never both.

## Tier-List Block

Use this block for every tier-list article. If the parent has explicitly accepted missing visuals, include those names without `image` or `alt` so the renderer shows accessible text tiles. Never insert placeholders, near matches, or hotlinks.

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

## Tier Section Flow and Detail Tables

Use an exact H2 such as `## S Tier`. The verifier matches that heading to `rank: S`. Every section must contain cue text, then its table, then additional analysis.

```markdown
## S Tier

Choose from this tier when a clean clear matters more than saving upgrade currency.

| Image | Style | Best for | Strengths | Weaknesses |
|---|---|---|---|---|
| ![Hakari fighting style icon in Gakuran](/Gakuran/Fighting%20Styles/hakari.png) | Hakari | General combat | Exact mechanic | Exact limitation |

The extra setup is safe in boss rooms but costs too much time in short mob waves. Pair it with a teammate who can hold enemies in place while the setup finishes.
```

Every overview item must appear in its matching tier table with the exact same image path when an image exists. Do not add a detailed row that is absent from the overview. A text-only component item must appear in the table without a placeholder image.

The cue, table, and analysis have different jobs:

- The component shows placement.
- The cue frames the decision for that tier.
- The table stores exact comparable facts once.
- The analysis explains consequences, exceptions, and combinations that are not already in the component or table.

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

- Confirm the expected, ranked, component, and tabled item counts match. Confirm every available image is exact and every missing visual is represented by a text-only item without a placeholder.
- Confirm the article uses exactly one tier-list component even when every item is text-only.
- Confirm each placement belongs to the stated scope and each table adds real detail.
- Confirm overview names and tier placements exactly match the per-tier tables. Confirm verified image paths match; for accepted missing visuals, confirm the text-only item appears in the matching table without a placeholder image.
- Confirm the intro is no more than three short sentences and sounds like direct gamer talk.
- Compare the component, every table, and the surrounding prose. Delete repeated placements, row summaries, numbers, and labels. Keep only new decision value.
- Confirm the final order was produced from the declared criteria and game evidence, not copied from another site.
- Parse-check JSON.
- Run the normal article verifier against a local web server:

```bash
npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json>
```

Do not call a visual article ready if the structured block or local image checks fail. For either shape, do not call it ready if the tier detail contract, import, or rendered route fails.
