---
name: bloxodes-game-collection-writing
description: Write one Bloxodes game-specific collection final.json after collection research, data approval, and image approval. Use for durable in-game collections backed by local datasets and wiki_collection_pages, metadata, intro_md, description_md, description_json, faq_json, wiki_md, and final.json output.
---

# Bloxodes Game Collection Writing

Use this after `brief.md`, data readiness, and image readiness are approved. Use it for one durable item or system collection inside one Roblox game.

## Workflow

1. Read the approved `brief.md`.
2. Confirm `Data readiness` says the dataset, section field, card/table field order, field presentation map, highlight/chip/detail/plain fields, field consistency, and renderer/config support are ready.
3. Confirm `Image readiness` is approved, or missing images were clearly accepted.
4. Create or update:

```text
tmp/content-workspace/<game-slug>/collections/<collection-slug>/
  brief.md
  final.json
```

5. Write `final.json`.
6. Parse JSON before returning.

## Voice & Tone

Bloxodes house voice: write like a player who knows the game well, telling a friend how it works. Calm, warm, and a little playful — never formal, corporate, or hyped.

- Simple English first. Short sentences, everyday words a younger player gets instantly. Explain any game term in plain words right where it appears.
- Playful, not loud. Drop in a light, dry touch of wit — roughly one per short paragraph — and always wrap it around a real fact, like "protection that overstays its welcome." The fact leads; the wit rides along. Never force a joke, stack puns, or let a quip hide the info.
- Gamer-buddy warmth. Talk to the player as "you," use real in-game nouns, and sound like someone who actually plays — not a manual.
- Spark from rhythm, not adjectives. Energy comes from concrete detail, a strong first line, and varied sentence length — not from words like *ultimate, insane, amazing, epic, must-have, game-changer*. Ban those.
- Open on the real thing — the item or mechanic. No "In this game…", "This collection…", "Welcome to…", or mood-setting warm-ups.
- Keep functional slots clean. Card fields, table cells, and short facts stay plain and direct. Let the playful voice live in intros, descriptions, and the wiki blurb.
- No filler or AI tics. Cut "Additionally", "Furthermore", "It's important to note", and "not just… but". Every sentence earns its place.

## Writing Rules

**Key rules**

- Write for Roblox players like a Roblox player who gathered the collection for everyone to check.

**Do Not**

- Do not write about sources, dataset, or what this page is about.
- Do not write about your actions. Always focus on the game, items, and players.
- Do not write copy that explains how to use the page. Write copy that explains the game system.
- Do not write the collection number anywhere in prose. Never state how many items the collection has, how many are in a section, or phrases like "all X items", "over X", "the full list of X". The count changes every time more data is gathered, which makes the copy stale. This applies to `intro_md`, `description_md`, `description_json`, `faq_json`, and `wiki_md`. The only count allowed is the automated `{count}` token in `title` and `seo_title`, which the seed/verify workflow resolves from the live dataset so it never goes stale.


**intro_md**

- Write one small paragraph that gets directly into the game item system.
- Give context and cue to the collection with no repeated info that's anywhere on this page.

**Card copy**

Cards are the default collection view. They should feel complete, aligned, and easy to scan:

- Name of the item
- One useful description line or short paragraph.
- Useful key-value facts that are easy to scan.
- A collection-specific field presentation contract. Do not rely on renderer word matching or random value heuristics.
- At least one source-backed highlight-style field when the collection has a natural status, strength, availability, best-use, or recommendation value.
- Chip-style fields for prices, time, rarity, tier, chance, levels, costs, damage, BPS, or other important short numbers.
- Plain fields for normal comparable text such as source, shop, main use, role, or route names.
- Detail fields for longer sentence facts such as obtainment, behavior, weaknesses, route notes, or strategy notes.
- There is no hard limit on key-value pairs, but only include fields that help players compare items or understand important differences.
- Card details come from the dataset. Do not invent fields in `final.json`; make sure the dataset already has the fields the page needs.
- Both cards and list view show the same public details. Do not plan details for one view only.
- Keep field names consistent across rows. Missing source-backed values should stay empty/null in the dataset so the renderer can show `-`.
- Do not merge labels into values. The dataset should provide a value like `Available`, not `Availability: Available`.
- Do not turn normal sentence values into random bullet-like fragments. Use complete prose for detail fields and arrays only for real lists.
- If one field key is rendered as a chip, highlight, detail, or plain value on one card, the same field key must render that way on every card in the collection. Style belongs to the field key/config, not to individual values.

**description_json**

Explain section groups only when it adds context beyond the cards.
This goes above each cards section and should not repeat the card copy. It should be a small paragraph that gives context to the group of items in that section.
`description_json` keys must match the actual rendered section labels from the dataset. If the dataset sections are `Basic`, `Rare`, and `Exclusive`, use those exact keys.
Do not create a section note for every section unless it helps. Empty `description_json` is fine when the section labels already explain enough.


**description_md**

This is the main body of the page. Its job is to cover everything a reader actually needs to use or finish this collection: strategy, how to progress, the key decisions and trade-offs between items, common mistakes, and any rules the cards alone do not make obvious. Cover what is genuinely useful for this specific collection, then stop. The goal is a page that feels complete, not a page that hits a fixed template.

Let the content decide the structure. Do not force a set number of sections or headings, and do not default to the same two-heading shape on every page. Match the shape to how much there is to say:

- Short paragraphs, around 2-3 sentences each, so they are easy to read. Break a long paragraph into smaller ones instead of writing a wall of text.
- Bullet points for steps, tips, quick comparisons, or short lists.
- A markdown table when you are comparing a few things across the same dimensions (for example, which option to pick for which situation). Use tables when they read more cleanly than prose, not for decoration.
- Headings only when they genuinely help the reader scan. A short body needs none; a deeper one might use a few. Heading text can read almost like a sentence.

Rules:

- Do not repeat the card copy, the intro, the how-it-works note, or the section notes. Only add information the rest of the page does not already give.
- No fluff, no filler, no restating the obvious. Every line should earn its place. If a section would just pad the page, cut it.
- Keep it concrete and specific to this game system, in plain, simple English that anyone can follow.
- Follow the global no-count rule: never state how many items the collection or a section has.

**wiki_md**

This is the blurb that shows on the game wiki hub next to the link to this collection. Most wiki blurbs are too generic ("this collection lists all the items") and tell the reader nothing. Write a blurb that is actually useful on the wiki page.

- Explain in plain words what this thing is inside the game and how it works for a player. Treat it like you are explaining the system to a new player who just started the game.
- Be specific to this collection. Say what the items do, how you get them, where they fit in the game, or what choice the player makes between them. Use concrete in-game terms, not vague words.
- Be simple and clear. Short sentences. No jargon, no hype words like "ultimate" or "complete".
- 2 to 4 sentences. Enough to genuinely help someone decide if they want to open the page, but not a full guide.
- Do not say how many items there are, do not mention the page, the list, sources, or "this collection". Talk about the game system itself.

Good shape: "what it is in the game" → "how it works / how you get it" → "why it matters to the player".

## Field Jobs

- `display_name`: Write the short reusable collection name exactly as it should appear in UI labels and wiki hub headings, for example `Units`, `Food Items`, `NPCs`, or `UGC Items`. Do not include counts, game names, colons, or SEO phrasing. This is the canonical collection label; do not make scripts infer it from `collection_slug` or `title`.
- `title`: Use the Bloxodes collection title pattern with an automated count token: `All {count} <Collection> in <Game>`. Add one short reader-focused angle only when it makes the title clearer. Do not manually replace `{count}` with a number; the seed/verify workflow resolves it from the verified dataset row count so refreshed data does not leave a stale title.
- `seo_title`: Keep it close to the title, make it natural for search, and use the same `{count}` token when the title count appears.
- `meta_description`: Say what the reader can compare or learn from the page.
- `intro_md`: Explain what this collection is in the game and why players compare it.
- `description_md`: The main body. Cover everything a reader needs to use or finish this collection (strategy, progression, trade-offs, mistakes) using whatever structure fits — short paragraphs, bullets, tables, and headings only where they help. Fluid, not a fixed two-section template; no fluff and no repeating the other fields.
- `how_it_works_md`: Explain page fields only when the fields need context. Keep it short.
- `description_json`: Explain section groups only when it adds context beyond the cards. Keys must match rendered section labels.
- `faq_json`: Answer useful follow-up questions not already covered. Each entry MUST use the keys `q` (question) and `a` (answer): `{ "q": "...", "a": "..." }`. Do NOT use `question`/`answer` — the renderer reads `q`/`a` and wrong keys make the FAQ render blank.
- `wiki_md`: Explain the in-game system this collection covers in plain, simple words so the blurb is genuinely useful on the wiki hub: what it is, how a player gets or uses it, and why it matters. Be specific, 2-4 sentences, no item count.

## Output Shape

```json
{
  "universe_id": 0,
  "wiki_slug": "",
  "collection_slug": "",
  "code": "",
  "display_name": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "description_md": "",
  "how_it_works_md": "",
  "description_json": {},
  "faq_json": [{ "q": "", "a": "" }],
  "wiki_md": "",
  "is_published": true
}
```

Use `<game-slug>-<collection-slug>` for `code`.
Use `<game-slug>` for `wiki_slug` and `<collection-slug>` for `collection_slug`.
Do not use `roblox_universes.slug` for editorial slugs.
