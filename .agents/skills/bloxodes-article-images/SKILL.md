---
name: bloxodes-article-images
description: Gather, host, map, and verify useful images for every approved Bloxodes article before writing. Define a nonzero target set, search reliable exact-match sources, and allow image-free output only when every target is explicitly accepted as missing after the search. Creates media.json and updates brief.md; does not write final.json.
---

# Bloxodes Article Images

Use this after article research and parent brief approval for every article. The image pass is mandatory even when the article is not a location guide or collection. Do not write `final.json`.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  media.json
```

## Define the expected set first

1. Read the approved `brief.md`.
2. Define at least one useful visual target. The image pass can never start with an expected count of zero.
3. For named locations, routes, NPCs, puzzle states, collectibles, menu states, ordered visual steps, complete rankings, or other visual sets, list every distinct target that images would help identify. For a normal article, list the one to three highest-value screenshots, UI states, items, characters, or steps that would make the answer clearer.
4. Do not let easy-to-find images define the expected count.
5. Use one stable entry ID and one planned article heading per target.

For example, a five-location guide starts with five entries even if the lead source has no reusable images.

## Find and verify images

1. Start with the lead source, then fan out for every unresolved entry.
2. Search the exact game name plus location, NPC, item, or step name. Try spelling variants.
3. Check official game pages and media, the game's wiki, reputable community wikis, and credible guide pages. A clean, exact, genuine gameplay screenshot from a credible page is usable when its provenance is recorded; do not reject it only because another editorial site hosts it or the page does not state a general reuse license.
4. Inspect full source pages and lazy-loaded `src`, `srcset`, and `data-src` values. Do not select from a search thumbnail alone.
5. Match each image with nearby headings, captions, alt text, map labels, or surrounding instructions. Visually inspect the full image. Cross-check ambiguous matches.
6. Reject logos, covers, edited thumbnails, page screenshots, decorative art, unrelated maps, collages that hide the target, watermarks, large arrows, and visible site branding.
7. Record the source page, original image URL, exact-match evidence, provenance/source note, useful alt text, and status for every entry. If the source or file states an explicit attribution or license condition, record it and stop for parent review before use. Do not add a public attribution caption automatically.

Do not stop after rejecting the lead source. Continue the source fan-out until every expected entry is verified or has a precise missing reason.

## media.json

Use this shape:

```json
{
  "schema": 1,
  "article_slug": "game-topic",
  "visual_type": "locations",
  "required": true,
  "expected_count": 2,
  "entries": [
    {
      "id": "first-location",
      "label": "First Location",
      "required": true,
      "placement_heading": "First Location",
      "status": "verified",
      "source_page_url": "https://example.com/source-page",
      "original_image_url": "https://example.com/full-image.png",
      "match_evidence": "The source heading and caption identify the exact in-game location.",
      "rights_note": "Credible source and exact gameplay provenance recorded; no explicit attribution condition found.",
      "alt": "Character standing beside the First Location marker",
      "uploaded_path": null,
      "public_url": null,
      "width": null,
      "height": null
    }
  ]
}
```

Allowed statuses are `candidate`, `verified`, `missing`, and `accepted_missing`. The manifest and every entry must use `required: true`. `candidate` and `missing` never pass readiness. Only the parent may approve `accepted_missing`. Each accepted omission must include `search_queries` with at least two distinct query variants, `searched_source_urls` with at least two distinct HTTP source-page URLs, a specific `missing_reason`, and the parent's explicit decision in `acceptance_note`.

Use this shape for an accepted omission:

```json
{
  "id": "rebirth-confirmation",
  "label": "Rebirth confirmation",
  "required": true,
  "placement_heading": "Confirm the rebirth",
  "status": "accepted_missing",
  "search_queries": [
    "game name rebirth confirmation screen",
    "game name rebirth menu wiki"
  ],
  "searched_source_urls": [
    "https://example.com/game-wiki/rebirth",
    "https://example.org/game-guide/rebirth"
  ],
  "missing_reason": "Both checked pages explain rebirth but contain no clean exact screenshot of the confirmation state.",
  "acceptance_note": "Parent approved prose-only coverage after reviewing the documented search."
}
```

## Host the verified set

Dry-run the manifest first:

```bash
npm run collect:article-images -- --manifest <media.json>
```

After the source matches and usage notes are approved, upload to the configured managed-dev Supabase Storage target:

```bash
npm run collect:article-images -- --manifest <media.json> --apply
```

The collector downloads, validates, converts to WebP, uploads to `articles/<article-slug>/sources/`, verifies public readback, and updates `media.json`. Do not save article-owned images in the repository and do not hotlink source hosts.

Production publication promotes the exact approved managed-dev WebP bytes to the same object paths and rewrites the reviewed final to production URLs:

```bash
BLOXODES_ENV_PROFILE=production-preview NODE_ENV=production npm run collect:article-images -- --manifest <media.json> --file <final.json> --apply --allow-prod
```

Do not run that command without explicit production publication approval.

## Readiness

Update `brief.md` with:

```text
Image readiness:
- Visual type:
- Expected images:
- Exact matches verified:
- Images uploaded:
- Images missing:
- Accepted missing:
- Source pages used:
- Manifest path:
- Collector command and result:
- Ready for writing: yes/no
```

The parent approves readiness before writing. An article may proceed with no inserted images only when reliable, accurate, helpful images could not be found for every planned target and every entry is `accepted_missing`. The writing pass inserts every verified `public_url` beneath its matching `placement_heading`; final verification then runs:

```bash
npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json>
```
