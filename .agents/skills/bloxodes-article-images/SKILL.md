---
name: bloxodes-article-images
description: Gather, host, map, and verify a complete visual set for one approved Bloxodes article before writing. Use for location guides, routes, NPCs, puzzle steps, collectibles, menus, item sets, or other walkthroughs where readers benefit from one exact-match image per named place or step. Creates media.json and updates brief.md; does not write final.json.
---

# Bloxodes Article Images

Use this after article research and parent brief approval. Give visually dependent articles the same separate image-readiness pass as game collections. Do not write `final.json`.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  media.json
```

## Define the expected set first

1. Read the approved `brief.md`.
2. Decide whether the article is visually dependent. Treat named locations, routes, NPCs, puzzle states, collectibles, menu states, and ordered visual steps as visually dependent unless the brief explains why images would not help.
3. List every useful visual target before searching. Do not let easy-to-find images define the expected count.
4. Use one stable entry ID and one planned article heading per target.

For example, a five-location guide starts with five entries even if the lead source has no reusable images.

## Find and verify images

1. Start with the lead source, then fan out for every unresolved entry.
2. Search the exact game name plus location, NPC, item, or step name. Try spelling variants.
3. Check official game pages and media, the game's wiki, reputable community wikis, and credible guide pages. Prefer first-party captures, then clearly licensed wiki media, then other source-approved genuine gameplay captures.
4. Inspect full source pages and lazy-loaded `src`, `srcset`, and `data-src` values. Do not select from a search thumbnail alone.
5. Match each image with nearby headings, captions, alt text, map labels, or surrounding instructions. Visually inspect the full image. Cross-check ambiguous matches.
6. Reject logos, covers, edited thumbnails, page screenshots, decorative art, unrelated maps, collages that hide the target, watermarks, large arrows, and competitor branding.
7. Record the source page, original image URL, exact-match evidence, usage/source note, useful alt text, and status for every entry.

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
      "rights_note": "Source and usage basis checked; attribution retained internally.",
      "alt": "Character standing beside the First Location marker",
      "uploaded_path": null,
      "public_url": null,
      "width": null,
      "height": null
    }
  ]
}
```

Allowed statuses are `candidate`, `verified`, `missing`, and `accepted_missing`. Only the parent may approve `accepted_missing`; include both `missing_reason` and `acceptance_note`.

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
NODE_ENV=production npm run collect:article-images -- --manifest <media.json> --file <final.json> --apply --allow-prod
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

The parent approves readiness before writing. If required coverage is weak, stop with the exact missing entries and searches attempted. The writing pass inserts every verified `public_url` beneath its matching `placement_heading`; final verification then runs:

```bash
npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json> --require-image-readiness
```
