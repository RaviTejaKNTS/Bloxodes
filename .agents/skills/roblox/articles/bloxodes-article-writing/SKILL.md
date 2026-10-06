---
name: bloxodes-article-writing
description: Write one Bloxodes article final.json from an approved brief.md, including useful source-provided gameplay images hosted in Supabase Storage. Use after bloxodes-article-research and parent approval for Roblox how-tos, focused guides, comparisons, news tests approved for /articles, content_md, faq_json, tags, sources, article media, and metadata.
---

# Bloxodes Article Writing

## Code-controlled execution

When assigned a code-controlled stage, follow [stage ownership](../bloxodes-article-workflow-runner/references/code-controlled-stages.md). It overrides interactive parent/subagent, upload/import, and standalone self-review instructions for that invocation. Complete only the assigned artifact or review; the runtime owns subsequent stages and approval records. For a code-controlled writing invocation, read [the focused writing contract](references/pipeline-writing.md), the shared editorial standard, and the closest original example, then perform that contract. The interactive upload/import instructions below are not part of your stage. Specialized tech/tier skills still supply their additional page-type contracts.

Use this after `brief.md` is approved. Do not use this for first-pass research; use `bloxodes-article-research`.

Use this for one article only. Do not handle batches here; use `bloxodes-article-workflow-runner`.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  final.json
  editorial-review.md  # parent-owned in the workflow; writer-owned for standalone work
```

## Before Writing

Read the approved `brief.md`.

If the brief is missing, weak, unapproved, or has unresolved central source gaps, return the exact missing requirement for brief correction. Use the reader-facing writing packet first; consult its private evidence notes for claim checks. A source being community-authored is not itself a reason to qualify every supported fact. For older approved briefs, separate facts, actionable uncertainties, and private notes while reading; do not restart research merely to reformat them.

Always read sibling `media.json`. Start writing only after the parent approved image readiness. Insert every verified hosted image beneath its matching `placement_heading`; do not replace it with prose, a YouTube embed, a lead-source hotlink, or an unrelated generic image. An image-free article is allowed only when every planned target is `accepted_missing` because no reliable, accurate, helpful match was found.

Before accepting a how-to brief, check its procedure proof through the final result. If it gives only prerequisites and then says to follow unknown quest objectives, return that exact central gap to the parent. Prior approval does not require writing an incomplete walkthrough. Use the approved facts to explain the task in ordinary player language; do not turn private terms such as “gate” or “reward interaction” into the article's voice.

## Writing Rules

Read and apply [the shared editorial standard](references/editorial-standard.md) before drafting. It owns audience, openings, headings, structure, depth, voice, uncertainty, dates, links, and editorial review. Read [the Beebom Roblox style study](references/beebom-style-study.md) and the closest [original example](references/editorial-examples.md) when choosing the article shape. Use specific search-intent headings and connected explanations, not just a compact feature outline. Apply these alongside the operational rules below.

**Preferred article media**
- Insert every verified useful image from the mandatory image pass. A YouTube embed may supplement those images when the brief marks it as a perfect match.
- The cover image does not count as body media. Do not bypass the image pass because a cover exists.

**YouTube embeds (optional)**
- Embed a video only when the approved brief marks it as a perfect match. Skip near matches and filler videos.
- Put an embed on its own line with `{{ youtube: https://www.youtube.com/watch?v=VIDEO_ID }}`. Do not invent IDs or leave a raw YouTube URL when an embed is intended.
- One embed is normally enough. Place it near the step or explanation it demonstrates.

**Embedded article checklists (optional)**
- Use a fenced `article-checklist` YAML block only when a short actionable list materially helps inside the article. Full standalone checklist jobs still use `bloxodes-checklist-writing`.
- Use `schema: 1`, a unique lowercase hyphenated block `id`, a short `title`, and unique lowercase hyphenated item IDs. Each item needs a direct `label`; `description` and `href` are optional.
- Keep the embedded checklist compact. Use `sections` only when the items have meaningful groups. The renderer adds progress and local persistence.
- Do not use raw HTML checkboxes or manually add progress copy.

Use `bloxodes-tier-list-writing` instead of this skill when the article's primary job is ranking a complete item set. It owns the visual overview and matching per-tier detail-table contract.

The image-selection, readiness, and Storage rules below describe the approved media contract. In the writing stage, reuse the completed manifest and hosted files; do not repeat source discovery, downloads, uploads, or provenance writes merely because these rules are present. Return an actual media defect to the parent/image agent. The parent owns import and rendered verification after editorial acceptance.

**Source-provided article images**
- Actively inspect the approved lead source for genuine gameplay screenshots, item or character panels, maps, menus, raid screens, and collection-style images. Use them when they explain an article fact, step, item, or table row better than prose alone.
- Prefer genuine in-game captures over a publisher's custom illustrations or branded composites. Clean, exact gameplay screenshots from credible guide or wiki pages are usable when the approved manifest records their provenance. Flag any explicit attribution or license condition for parent review.
- Do not use images with watermarks, large arrows, subscribe overlays, or competitor branding.
- Do not hotlink the source page, wiki, Discord, Imgur, competitor CDN, or any other third-party host in `content_md`. Download, validate, convert to WebP, and upload the selected image to Bloxodes Supabase Storage first.
- Normal articles usually use one to three body images. Complete visual sets may use more.
- Write each hosted image as `![useful factual alt text](<Supabase public URL>)` beside the matching explanation. Use the exact public URL returned for the current environment, never the original source URL.
- Keep the source article URL in `sources`. Keep per-image provenance in `article_source_images`; do not mention competitors or image collection in public copy.
- Combine images, tables, lists, and prose when each explains a distinct useful detail. Avoid redundant presentations of the same information.

**Required visual sets**
- For location guides, routes, NPCs, puzzle states, collectibles, menu states, ordered visual steps, catalog entries, items, characters, enemies, rewards, abilities, evolutions, loadouts, or another visual collection, gather a useful matching image set. This is a required research and writing step, not an optional enhancement.
- Apply the same readiness standard as the game-collection image workflow: identify the expected item set first, find one clean exact-match image per useful entry, record every missing entry, and do not call the image pass ready while important coverage is weak.
- Use `bloxodes-article-images` for this separate pass. Its `media.json` is the mapping contract between research and writing: entry label, planned heading, approved hosted URL, alt text, source provenance, match evidence, and readiness status.
- Start with the approved lead source. If it has no usable images or does not cover the full useful set, run a targeted image fan-out. Check official game pages, official media, the game's own wiki, reputable community wikis, and other credible source articles. Do not reject a clean exact-match gameplay screenshot only because another editorial site hosts it or the page lacks a general reuse statement.
- Do not stop because the lead source has no images. Search each item or group by its exact in-game name plus the game name, try spelling variants, and inspect relevant source pages rather than relying only on image-search thumbnails.
- Inspect the source's in-article images, including lazy-loaded `src`, `srcset`, and `data-src` candidates. Exclude logos, ads, author photos, related-post thumbnails, decorative banners, duplicates, and images for entries the article does not cover.
- Match every selected image to its exact item using nearby headings, captions, alt text, table-row text, or surrounding copy. Open the full source image and visually confirm it shows that item. Cross-check ambiguous matches against an official or independent source. Do not guess from a filename, search thumbnail, color, or resemblance.
- Reject edited thumbnails, page screenshots, group collages that hide the individual item, placeholder art, logos, fan art presented as game art, and any image that does not clearly show the named entry.
- Put the hosted image in the matching table row or directly beneath the matching location, step, NPC, puzzle, or item heading. Give the alt text the real location, item, or state name plus the visible detail; never use generic text such as `image` or `screenshot`.
- The normal zero-to-three preference does not apply to this useful item set. Include one clear image per distinct entry when it materially helps identification, but do not copy unrelated parts of the source gallery.
- Add every image source page used to `sources` and keep the original image URL in `article_source_images` provenance.
- Do not silently finish an image-free `final.json` before completing this fan-out. If useful images still cannot be found, downloaded, mapped confidently, approved for reuse, uploaded, or verified, return the searches attempted and the exact media gap for correction instead of substituting hotlinks or repo files.

**Article image readiness gate**
- Before collecting, list the exact locations, steps, NPCs, puzzle states, collectibles, or table rows that should have images. Treat that count as `expected`; do not let whatever images happen to be easy to find define the scope.
- For walkthroughs, use one useful heading per visual target and put its verified `![specific alt](<Supabase public URL>)` in that section. For tables, add one `Image` column and put each image in the correct row. Do not create a detached gallery that makes the reader map images back to instructions.
- Keep the target-to-image mapping in `media.json`: canonical target name, placement heading, source page, original image URL, Storage object path, public URL, match evidence, and status (`verified` or a precise missing reason).
- Before returning `final.json`, compare expected, found, uploaded, inserted, and missing counts. Every inserted URL must belong to its row, and one image must not be reused for different entries unless the entries genuinely share the same visual.
- Open every uploaded public URL and visually inspect it, then preview the rendered local article. Confirm each image loads beneath the correct heading or in the correct table row, its label agrees, and its alt text is accurate.
- The image gate passes only when all useful rows are verified or every unresolved row has an explicit accepted reason. A wrong image is worse than a missing image: remove uncertain matches and report them as missing.

**Supabase Storage workflow for article images**
- Never save article images under `apps/web/public`, another tracked repository path, or a permanent local asset folder. The repository must not gain image files from article writing.
- Use a temporary file outside the repository only for download and WebP conversion. Remove it after the upload and readback checks pass.
- Upload to the environment selected by the existing Supabase env configuration and `SUPABASE_MEDIA_BUCKET`. Use the stable object path `articles/<article-slug>/sources/<descriptive-name>-<source-hash>.webp`; use `upsert` only when intentionally replacing that exact object.
- Treat managed dev and production as separate Storage targets. During homelab verification, upload to managed-dev Supabase Storage and use its public URL in the draft row. During an explicitly approved production publish, upload the same approved bytes and object path to production Storage, then use the production public URL normalized through `SUPABASE_MEDIA_PUBLIC_URL` (`https://media.bloxodes.com` in production).
- Never put a localhost URL in production, point a production article at the retired managed Supabase project, or assume a local Storage upload was promoted automatically.
- After the article row exists, upsert one `article_source_images` row per used image with `article_id`, source page URL and host, original image URL, object path, public URL, useful alt/context, and available dimensions. Do this in managed-dev Supabase for homelab verification and again in production during the approved production publish.
- Verify the Storage object is readable and the `article_source_images` row matches it in each target environment. Only then place that environment's public URL in `content_md`. If upload, provenance write, or readback fails, omit the image rather than hotlinking or creating a repo fallback.
- Keep `cover_image` null unless a cover already exists in Supabase Storage. Let the import flow generate and upload the edited cover from the game's thumbnail when it is null. Never insert the cover URL into `content_md`; the feature image is stored in `cover_image` only.

**How-to-fix and troubleshooting articles**
- Give each fix its own `###` (H3) heading, grouped under one `##` (H2) like "How to fix it". This beats a long numbered list with nested sub-bullets, which gets hard to scan.
- The H3 is a short action ("Restart your device", "Update your graphics drivers"). Under it, explain when the fix helps, give the procedure, and say what result to check. Use a numbered list when the fix has ordered steps; do not impose a sentence-count ceiling.
- Do not stack deep bullet hierarchies (bullets inside bullets inside steps). Keep each fix flat and simple.
- Order fixes easiest-first.
- Never repeat the same fix, cause, or explanation across sections. Each H3 covers one distinct thing. If two fixes overlap, merge them.
- Keep one short intro before the fixes, and an optional short closing section (e.g. when the problem is on Roblox's side and waiting is the answer). Do not pad with a separate "what is this error" section unless it adds real value.

**Accuracy (never ship wrong info)**
- Check platform claims against the approved evidence before writing; do not guess menu paths, toggles, limits, or behavior. Return an essential uncertain label or path for focused research correction; do not replace a necessary instruction with unusably generic wording.
- Roblox experiences cannot be played in a web browser. The in-browser player was discontinued; roblox.com only launches the installed app. Never tell readers to "play in the browser" or "try the browser instead of the app" as a fix.
- Do not suggest actions that are not actually possible (e.g. disabling a system that cannot be disabled). Do not claim a fix works for a platform you have not verified it on.
- When unsure whether something is true, leave it out rather than risk misinformation.

**Game-specific pages**
- Include the game name in the title and slug. Use "Roblox" when it aids search or clarity.

**Gaps and links**
- Return essential factual gaps to the parent for targeted research correction. If evidence remains unavailable, request a narrower promise or retain a blocker; omit nonessential unknowns without repeated disclaimers. Do not independently restart research from the writing stage.
- Use relevant internal-link candidates from the brief. If none were supplied, use the GET-only production editorial inventory for same-game pages. Link where it helps; there is no quota and no direct production database query.
- Link only to pages that actually exist. Use real, current slugs (article links are `/articles/<slug>`). Never invent a slug or link to a page you have not confirmed exists.
- Weave each internal link naturally, mid-sentence, as part of the flow. No "read this" or similar call-outs. Pick anchor text that matches what the reader gets, and place links where they genuinely help (related mechanic, income, next goal), not as filler.

**What never appears in copy**
- Keep research processes, competitor comparisons, database checks, and internal notes out of public copy. Useful developer attribution and verified official links are allowed.
- Brief article/guide orientation is allowed when useful; avoid self-description that replaces player help.

## Draft and One Editorial Revision

Follow [the editorial review procedure](references/editorial-review.md). In a parent workflow, first return the draft for combined feedback, then revise the actual `final.json` once in the same writing agent. For standalone writing, perform the review and revision yourself. Keep the configured model; Luna does not need a separate editor model. Save the short review note beside the final, outside public JSON.

Before drafting, read the one or two [before/after examples](references/editorial-examples.md#turning-research-into-an-explanation) selected in the handoff. They demonstrate transformations, not required wording or gameplay facts. Keep a brief mental map of the player's goal, prerequisites, next obstacles, and result. Choose prose, steps, and tables to explain that map without repeating it in every format.

Reuse approved facts and images during revision. Return genuine evidence gaps to the parent; do not browse again to fix phrasing. Preserve useful approved media, and reconcile placement headings with the parent if the structure changes.

## Writing and Field Jobs

Write `final.json` and the editorial review note only in the content workspace. The parent owns the note in a parent workflow. Approved Supabase Storage uploads and `article_source_images` provenance writes are allowed, but do not create repository image assets.

- `title`: State the exact reader question, action, story, or guide promise in human search language. Include the game name for game-specific articles.
- `slug`: Use a short stable editorial slug for the article topic. Include the game name for game-specific articles.
- `meta_description`: Summarize the answer or reader outcome in one specific search snippet.
- `content_md`: Answer the title fully. Use headings only for real sections and keep source-gathering language out of public copy. Insert every approved `media.json` image under its matching heading or table row. Use no body images only when all planned entries are explicitly `accepted_missing`.
- `faq_json`: Optional, with no question quota. This field renders a visible FAQ section as well as structured data: it is the sole home for FAQs. Never also put an FAQ section or the same questions in `content_md`. Keep a question only if its source-backed answer adds useful information not already answered in the body; otherwise use `[]`. Search wording alone does not make a repeated answer useful.
- `cover_image`: Use an existing Bloxodes Supabase Storage public URL when a cover is already hosted; otherwise use null so the import path can generate and upload one.
- `author_id`: Set when known, or let the import path assign it if that is the project flow.
- `universe_id`: Set whenever the article belongs to one Roblox game and that game has a `roblox_universes` row. Look it up (by name/slug, or reuse the id other same-game articles use) instead of leaving it null. Only leave it null if no universe row exists for the game.
- `tags`: Use specific reusable labels, not loose keyword stuffing.
- `sources`: Keep the URLs that support important facts. Do not pad with weak repeats.

Parse-check JSON before returning.

## Output Shape

```json
{
  "title": "",
  "slug": "",
  "meta_description": "",
  "content_md": "",
  "faq_json": [],
  "cover_image": null,
  "author_id": null,
  "universe_id": null,
  "tags": [],
  "sources": [],
  "is_published": true
}
```

Do not include `seo_title`; the articles table does not use it.

For game-linked articles, use the article topic and game name for the slug. Do not use `roblox_universes.slug`.

If the article topic is about some specific roblox game, then you must include universe id.

Parse-check JSON on each handoff. Identify the first return as a draft awaiting editorial review; after the one revision, return the revised file and concrete changes for parent acceptance. Do not claim editorial approval or managed-development completion merely because the file parses.
