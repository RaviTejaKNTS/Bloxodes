---
name: bloxodes-article-writing
description: Write one Bloxodes article final.json from an approved brief.md, including useful source-provided gameplay images hosted in Supabase Storage. Use after bloxodes-article-research and parent approval for Roblox how-tos, focused guides, comparisons, news tests approved for /articles, content_md, faq_json, tags, sources, article media, and metadata.
---

# Bloxodes Article Writing

You're writing one article that a player will actually enjoy reading: answer first, clean sentences, real game details and a bit of personality. Research is already done. Your job is to turn an approved brief into the best page on the topic.

## Code-controlled runs

If you were assigned a code-controlled stage, follow [stage ownership](../bloxodes-article-workflow-runner/references/code-controlled-stages.md). It overrides the interactive parent/subagent, upload/import and standalone self-review instructions here. For a writing stage, read [the pipeline writing contract](references/pipeline-writing.md), the voice guide, the article standard and the closest example, then do exactly that contract. Skip the upload/import parts below. Tech and tier-list skills still add their page-type rules.

## When to use this

- After `brief.md` is approved. For first-pass research, use `bloxodes-article-research`.
- For one article. Batches go through `bloxodes-article-workflow-runner`.
- If the article's main job is ranking a full set of items, use `bloxodes-tier-list-writing`. Platform and troubleshooting pieces use `bloxodes-tech-article-writing` on top of this skill.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  media.json
  final.json
  editorial-review.md  # parent-owned in the workflow; writer-owned for standalone work
```

## Read first

1. **The voice guide:** `.agents/skills/bloxodes-voice/SKILL.md` and the article section of `references/examples.md`. This is how we sound.
2. **The article standard:** [references/editorial-standard.md](references/editorial-standard.md). Openings, headings, depth, evidence, dates, links and FAQs.
3. **The closest example** in [references/editorial-examples.md](references/editorial-examples.md), plus the [Beebom study](references/beebom-style-study.md) for structure on unfamiliar formats.
4. **The approved `brief.md`.** Use the reader-facing writing packet first, and the private evidence notes to check claims.
5. **The sibling `media.json`.** Start writing only after the parent approves image readiness.

## Check the brief before writing

- If the brief is missing, weak, unapproved or has open central gaps, return the exact missing piece for a brief correction.
- A community source isn't a reason to hedge every supported fact.
- For older briefs, sort facts, real uncertainties and private notes as you read. Don't restart research just to reformat.
- For a how-to, check the brief proves every step through the final result. If it lists prerequisites and then says "follow the quest objectives," send that gap back to the parent. Earlier approval doesn't mean you have to write an incomplete walkthrough.
- Turn private research terms ("gate," "reward interaction") into normal player language.

## Writing rules

The voice guide and article standard cover tone, openings, headings, structure and depth. These are the article-specific extras.

### Accuracy

- Check platform claims against the approved evidence. Don't guess menu paths, toggles, limits or behavior. If an essential label or path is uncertain, send it back for focused research instead of writing something too vague to use.
- Roblox experiences can't be played in a web browser. The browser player was discontinued, and roblox.com only launches the installed app. Never suggest playing in the browser as a fix.
- Don't suggest things that aren't possible, like disabling a system that can't be disabled. Don't claim a fix works on a platform you haven't verified.
- When you're not sure something is true, leave it out.

### Game-specific articles

Put the game name in the title and slug. Add "Roblox" when it helps search or clarity.

### How-to-fix and troubleshooting sections

- Give each fix its own `###` under one `##` like "How to fix it." That's easier to scan than one long numbered list with sub-bullets.
- The H3 is a short action: "Restart your device," "Update your graphics drivers." Under it, say when the fix helps, give the steps and say what to check after. Use a numbered list for ordered steps. No sentence limit.
- Keep fixes flat. No bullets inside bullets inside steps.
- Easiest fixes first.
- Each H3 covers one distinct fix. If two overlap, merge them. Never repeat a fix, cause or explanation.
- One short intro before the fixes. An optional short closing section works when the problem is on Roblox's side and waiting is the answer. Skip a "what is this error" section unless it adds real value.

### Gaps and links

- Send essential factual gaps to the parent for targeted research. If the evidence still isn't there, ask for a narrower promise or keep a blocker. Leave out nonessential unknowns without repeated disclaimers. Don't restart research from the writing stage.
- Use internal-link candidates from the brief. If there are none, use the GET-only production editorial inventory for same-game pages. Link where it helps. There's no quota, and never query the production database directly.
- Link only to pages that exist, with real current slugs (`/articles/<slug>` for articles). Never invent a slug.
- Put links on words already in the sentence. No "read this" callouts. The anchor text should say what the reader gets, and the link should help: a related mechanic, income, the next goal.

### What never appears in copy

- Research process, competitor comparisons, database checks and internal notes stay out. Useful developer credit and verified official links are fine.
- A brief "this guide" for orientation is OK. Self-description that replaces actual help isn't.

## Media

### Article images

- Insert every verified useful image from the image pass. A YouTube embed can add to those images when the brief marks it a perfect match.
- The cover image doesn't count as body media, and having a cover doesn't let you skip the image pass.
- An image-free article is only allowed when every planned target in `media.json` is `accepted_missing` because no reliable, accurate, helpful match exists.
- Put each verified hosted image under its matching `placement_heading`. Don't replace it with prose, a YouTube embed, a lead-source hotlink or an unrelated generic image.

### YouTube embeds (optional)

- Only when the approved brief marks the video as a perfect match. Skip near matches and filler.
- Put it on its own line: `{{ youtube: https://www.youtube.com/watch?v=VIDEO_ID }}`. Never invent IDs or leave a raw YouTube URL when you meant an embed.
- One is usually enough. Place it next to the step or explanation it shows.

### Embedded checklists (optional)

- Use a fenced `article-checklist` YAML block only when a short to-do list really helps inside the article. Full checklist pages use `bloxodes-checklist-writing`.
- Use `schema: 1`, a unique lowercase hyphenated block `id`, a short `title` and unique lowercase hyphenated item IDs. Each item needs a direct `label`. `description` and `href` are optional.
- Keep it compact. Use `sections` only for real groups. The renderer adds progress and saving. No raw HTML checkboxes or hand-written progress copy.

### The image contract

The rules below describe the approved media contract. In the writing stage, reuse the finished manifest and hosted files. Don't redo source discovery, downloads, uploads or provenance writes just because these rules are here. Send real media defects back to the parent or image agent. The parent owns import and rendered checks after editorial acceptance.

**Source-provided images**

- Look through the approved lead source for real gameplay screenshots, item or character panels, maps, menus, raid screens and collection-style images. Use them when they explain a fact, step, item or table row better than words.
- Prefer real in-game captures over a publisher's custom art or branded composites. Clean, exact gameplay screenshots from credible guide or wiki pages are fine when the manifest records their provenance. Flag any explicit attribution or license condition for parent review.
- No images with watermarks, big arrows (as `bloxodes-article-images` defines them), subscribe overlays or competitor branding.
- Never hotlink the source page, wiki, Discord, Imgur, a competitor CDN or any other third-party host in `content_md`. Download, validate, convert to WebP and upload to Bloxodes Supabase Storage first.
- Insert every verified image that helps the reader (see above). Most normal articles land at one to three, and complete visual sets can have more. Never drop a verified, useful image to hit a count.
- Write each image as `![useful factual alt text](<Supabase public URL>)` next to the matching explanation, using the exact public URL for the current environment.
- Keep the source article URL in `sources` and per-image provenance in `article_source_images`. Never mention competitors or image collection in public copy.
- Mix images, tables, lists and prose when each one explains something different. Don't show the same information twice.

**Required visual sets**

- Location guides, routes, NPCs, puzzle states, collectibles, menu states, ordered visual steps, catalog entries, items, characters, enemies, rewards, abilities, evolutions, loadouts and other visual collections need a matching image set. This is required, not a nice extra.
- Use the same readiness standard as the game-collection image workflow: list the expected set first, find one clean exact-match image per useful entry, record every missing entry, and don't call it ready while important coverage is weak.
- Run this through `bloxodes-article-images`. Its `media.json` maps research to writing: entry label, planned heading, hosted URL, alt text, provenance, match evidence and readiness status.
- Start with the lead source. If it lacks images or doesn't cover the whole set, fan out: official game pages, official media, the game's own wiki, reputable community wikis and other credible articles. Don't reject a clean exact-match screenshot just because another editorial site hosts it or the page has no general reuse statement.
- Don't stop because the lead source has no images. Search each item or group by exact in-game name plus the game name, try spelling variants and open the relevant pages instead of trusting image-search thumbnails.
- Check in-article images, including lazy-loaded `src`, `srcset` and `data-src`. Skip logos, ads, author photos, related-post thumbnails, decorative banners, duplicates and entries the article doesn't cover.
- Match every image to its exact item using nearby headings, captions, alt text, table rows or surrounding copy. Open the full image and confirm it shows that item. Cross-check unclear matches against an official or independent source. Never guess from a filename, thumbnail, color or resemblance.
- Reject edited thumbnails, page screenshots, group collages that hide the item, placeholder art, logos, fan art posing as game art and anything that doesn't clearly show the named entry.
- Put each hosted image in its matching table row or right under its location, step, NPC, puzzle or item heading. Alt text names the real thing plus what's visible. Never "image" or "screenshot."
- The usual one-to-three range doesn't apply to these sets. Include one clear image per entry when it helps identification, but don't copy unrelated parts of a source gallery.
- Add every image source page to `sources` and keep the original image URL in `article_source_images`.
- Don't quietly finish an image-free `final.json` before doing this fan-out. If images still can't be found, downloaded, matched, cleared, uploaded or verified, return the searches you tried and the exact gap instead of hotlinks or repo files.

**Image readiness gate**

- Before collecting, list the exact locations, steps, NPCs, puzzle states, collectibles or table rows that need images. That's `expected`. Don't let the easy finds define the scope.
- Walkthroughs get one useful heading per visual target with its image in that section. Tables get one `Image` column with each image in the right row. No detached galleries.
- Keep the target-to-image map in `media.json`: target name, placement heading, source page, original image URL, Storage object path, public URL, match evidence and status (`verified` or a precise missing reason).
- Before returning `final.json`, compare expected, found, uploaded, inserted and missing counts. Every URL must belong to its row, and one image can't stand in for different entries unless they really look the same.
- Open every uploaded public URL and look at it, then preview the rendered local article. Confirm each image loads under the right heading or in the right row, with matching label and accurate alt text.
- The gate passes only when every useful row is verified or every missing row has an accepted reason. A wrong image is worse than a missing one, so drop uncertain matches and report them as missing.

**Supabase Storage for article images**

- Never save article images under `apps/web/public`, any tracked repo path or a permanent local folder. Article writing must not add image files to the repo.
- Use a temp file outside the repo only for download and WebP conversion. Delete it after upload and readback pass.
- Upload to the environment selected by the existing Supabase env config and `SUPABASE_MEDIA_BUCKET`. Object path: `articles/<article-slug>/sources/<descriptive-name>-<source-hash>.webp`. Use `upsert` only to deliberately replace that exact object.
- Managed dev and production are separate Storage targets. For homelab verification, upload to managed-dev Storage and use its public URL in the draft row. For an explicitly approved production publish, upload the same approved bytes and path to production Storage and use the production public URL normalized through `SUPABASE_MEDIA_PUBLIC_URL` (`https://media.bloxodes.com` in production).
- Never put a localhost URL in production, point a production article at the retired managed Supabase project, or assume a local upload was promoted.
- Once the article row exists, upsert one `article_source_images` row per image: `article_id`, source page URL and host, original image URL, object path, public URL, useful alt/context and available dimensions. Do this in managed dev for homelab verification and again in production during the approved publish.
- Confirm the Storage object is readable and its `article_source_images` row matches in each target environment before putting that environment's URL in `content_md`. If upload, provenance or readback fails, leave the image out. No hotlinks, no repo fallback.
- Keep `cover_image` null unless a cover already lives in Supabase Storage. The import flow makes and uploads the cover from the game's thumbnail when it's null. Never put the cover URL in `content_md`.

## Draft and one editorial revision

Follow [the editorial review procedure](references/editorial-review.md). In a parent workflow, return the draft for combined feedback, then revise the actual `final.json` once in the same agent. For standalone work, do the review and revision yourself. Keep the configured model. Save the short review note next to the final, outside the public JSON.

Before drafting, read the one or two examples picked in the handoff. They show moves, not wording or facts. Keep a quick mental map of the player's goal, prerequisites, next obstacles and result, then choose prose, steps and tables to explain it without repeating it in every format.

During revision, reuse approved facts and images. Send real evidence gaps to the parent instead of browsing again to fix phrasing. Keep useful approved media, and line up placement headings with the parent if the structure changes.

## Fields

Write `final.json` and the review note only in the content workspace. Approved Supabase Storage uploads and `article_source_images` writes are allowed. Repo image assets aren't.

- `title`: the reader's exact question, action, story or guide promise in search language. Game name included for game articles.
- `slug`: short and stable for the topic. Game name included for game articles. Never use `roblox_universes.slug`.
- `meta_description`: the answer or outcome plus a reason to click, in one or two plain sentences of roughly 140 to 160 characters.
- `content_md`: answers the title fully. Headings only for real sections. Every approved `media.json` image under its matching heading or row. No body images only when every planned entry is `accepted_missing`.
- `faq_json`: optional, no quota. It renders a visible FAQ and structured data, so it's the only home for FAQs. Never add an FAQ section to `content_md`. Keep a question only if its supported answer adds something the body doesn't have. Otherwise `[]`.
- `cover_image`: an existing Bloxodes Storage URL if a cover is already hosted, otherwise `null`.
- `author_id`: set when known, or let the import path assign it.
- `universe_id`: required whenever the article is about one Roblox game that has a `roblox_universes` row. Look it up by name or slug, or reuse the ID from other articles on the same game. Null only when no row exists.
- `tags`: specific reusable labels, no keyword stuffing.
- `sources`: URLs that support the important facts. No weak repeats.

No `seo_title`. The articles table doesn't use it.

```json
{
  "title": "",
  "slug": "",
  "meta_description": "",
  "content_md": "",
  "faq_json": [{ "q": "", "a": "" }],
  "cover_image": null,
  "author_id": null,
  "universe_id": null,
  "tags": [],
  "sources": [],
  "is_published": true
}
```

Parse-check the JSON at every handoff. Mark the first return as a draft awaiting review. After the one revision, return the revised file and the concrete changes for parent acceptance. A file that parses isn't editorial approval or managed-development completion.
