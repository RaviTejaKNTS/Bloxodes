---
name: bloxodes-article-images
description: Gather, host, map, and verify useful images for every approved Bloxodes article before writing. Define a nonzero target set, search reliable exact-match sources, and allow image-free output only when every target is explicitly accepted as missing after the search. Creates media.json and updates brief.md; does not write final.json.
---

# Bloxodes Article Images

You find, verify and host the images for one approved article before anyone writes it. Done means a `media.json` where every planned target is either a verified exact match or a precise, well-searched missing entry. You don't write `final.json`.

The image pass is mandatory for every article, even ones that aren't location guides or collections. It runs after article research and the parent's brief approval.

## Code-controlled runs

If you were assigned a code-controlled stage, follow [stage ownership](../bloxodes-article-workflow-runner/references/code-controlled-stages.md). It overrides the interactive parent/subagent, upload/import and standalone self-review instructions here for that invocation. Do only the assigned artifact or review. The runtime owns later stages and approval records. The editorial and page-type contracts below still apply.

In the code-controlled `images` stage:

- **Only `media.json` may change.** Treat `brief.md` as immutable approved research.
- Put all image targets, search evidence, omissions and readiness notes in the manifest entries.
- Skip the standalone brief-update step in [Readiness](#readiness).
- Reviewers change no artifacts. Code records their decisions and applies accepted omissions.
- See [Unattended inspection](#unattended-code-controlled-inspection) for how to look at images without a desktop browser.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  media.json
```

## Define the expected set first

1. Read the approved `brief.md`.
2. Define at least one useful visual target. The image pass never starts with an expected count of zero.
3. Size the set to the article:
   - **Visual sets** (named locations, routes, NPCs, puzzle states, collectibles, menu states, ordered visual steps, complete rankings or other sets): list every distinct target an image would help identify.
   - **Normal articles:** list the one to three highest-value screenshots, UI states, items, characters or steps that make the answer clearer.
   - **Opinionated best-games articles:** every selected game is a target. Plan one useful landscape gameplay thumbnail per game section, in the approved order. The approved game selection sets the expected thumbnail count.
4. Don't let easy finds set the expected count.
5. Give each target one stable entry ID and one planned article heading. Follow the approved reader-focused outline.
6. When editorial review renames or regroups a heading, update `placement_heading` to match. Don't keep an awkward section just to save an old media label.
7. Refreshes of existing articles can reuse verified, matching hosted images after URL and visual readback.

For example, a five-location guide starts with five entries even if the lead source has no reusable images.

## Find and verify images

1. Start with the lead source, then fan out for every unresolved entry.
2. Search the exact game name plus the location, NPC, item or step name. Try spelling variants.
3. Check official game pages and media, the game's wiki, reputable community wikis and credible guide pages. A clean, exact, genuine gameplay screenshot from a credible page is usable when you record its provenance. Don't reject it just because another editorial site hosts it or the page has no general reuse license.
4. Inspect full source pages, including lazy-loaded `src`, `srcset` and `data-src` values. Never pick from a search thumbnail alone.
5. Match each image using nearby headings, captions, alt text, map labels or surrounding instructions. For best-games articles, the exact official Roblox experience page is the source-page proof for its landscape thumbnail. Look at the full image yourself. Cross-check unclear matches.
6. Reject logos, covers, edited thumbnails, page screenshots, decorative art, unrelated maps, collages that hide the target, watermarks, big arrows and visible site branding.
   - A "big arrow" is a mark someone drew on top of the screenshot (arrow, circle, box or scribble) that covers part of the target or pulls the eye away from it. Markers that are part of the game itself, like map pins, quest arrows or the game's own highlight boxes, are fine. A small, neat editor mark that points at the target without covering it is also fine; note it in `media.json`.
7. For every entry, record the source page, original image URL, exact-match evidence, provenance note, useful alt text and status.
8. If the source or file states an explicit attribution or license condition, record it and stop for parent review before use. Don't add a public attribution caption automatically.

Don't stop after rejecting the lead source. Keep fanning out until every expected entry is verified or has a precise missing reason.

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

Status rules:

- Allowed statuses are `candidate`, `verified`, `missing` and `accepted_missing`.
- The manifest and every entry use `required: true`.
- `candidate` and `missing` never pass readiness.
- Only the parent can approve `accepted_missing`. Each accepted omission needs:
  - `search_queries` with at least two distinct query variants
  - `searched_source_urls` with at least two distinct HTTP source-page URLs
  - a specific `missing_reason`
  - the parent's explicit decision in `acceptance_note`

An accepted omission looks like this:

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

1. Dry-run the manifest first:

   ```bash
   npm run collect:article-images -- --manifest <media.json>
   ```

2. Once the source matches and usage notes are approved, upload to the configured managed-dev Supabase Storage target:

   ```bash
   npm run collect:article-images -- --manifest <media.json> --apply
   ```

The collector downloads, validates, converts to WebP, uploads to `articles/<article-slug>/sources/`, checks public readback and updates `media.json`. Never save article images in the repo, and never hotlink source hosts.

Production publication promotes the exact approved managed-dev WebP bytes to the same object paths and rewrites the reviewed final to production URLs:

```bash
BLOXODES_ENV_PROFILE=production-preview NODE_ENV=production npm run collect:article-images -- --manifest <media.json> --file <final.json> --apply --allow-prod
```

Never run that command without explicit production publication approval.

## Readiness

In interactive runs, update `brief.md` with this block (code-controlled runs put these notes in `media.json` instead):

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

- The parent approves readiness before writing starts.
- An article can go ahead with no inserted images only when reliable, accurate, helpful images couldn't be found for any planned target and every entry is `accepted_missing`.
- The writing pass inserts every verified `public_url` under its matching `placement_heading`. Final verification then runs on GitHub in `Managed content QA` (or in the runtime's `import_verify` stage for code-controlled runs), never locally.

## Unattended code-controlled inspection

Scheduled image work has headless Chrome, not a connected Codex desktop browser.

- Run `npm --prefix <repository> run articles:inspect-image -- <exact-source-image-url> <article-workspace>` and open the returned screenshot with `view_image`.
- Don't load desktop browser setup helpers in this mode.
- A successful screenshot only proves access. Look at the gameplay it shows and match it to the source and the intended placement before marking it verified.
- Keep the exact original URL and attribution evidence in `media.json`.
- The independent reviewer gets code-captured screenshots in `image-inspection/index.json` and must inspect them before accepting.
- Tool or network failures are operational problems. They're never a reason to invent a match or quietly accept an omission.
