---
name: bloxodes-article-workflow-runner
description: Run one or many Bloxodes article writing jobs with parent review. Use explicit topics from the user's message when present; otherwise select pending article_generation_queue leads. Use when the user asks to write articles, gives article ideas, wants subagents to research/write articles, or needs parent QA before final.json output.
---

# Bloxodes Article Workflow Runner

Use this as the parent review workflow for one article or a list of articles.

When `run-homelab-article-batch.ts` invokes this skill, execute the workflow below directly in the current parent turn. Never call `articles:writer:batch` from inside this skill: the outer batch already owns the single-writer lock, selected queue IDs, and production release.

## Input Selection

Choose inputs in this order:

1. If the user's current message supplies one or more topics, article ideas, titles, or source URLs, treat them as explicitly user-approved and work only on those supplied inputs. Do not query the generation queue merely to fill spare capacity. These are direct jobs, so do not update a queue row unless the user also supplied its queue ID or explicitly asked to include queue work.
2. If the user explicitly asks for both supplied topics and queued topics, do both in the order the user requested.
3. If the current message supplies no topic, title, idea, or source URL, load pending `agent_runner` leads from `article_generation_queue`:

```bash
npm run articles:queue:list -- --limit <candidate-window> --json
```

When the user gives a count but no topics, the target article count is that count. Otherwise, the target count is the number of research subagent slots currently available. Set `<candidate-window>` to as many as three times the target count, capped at 50, so unsuitable leads can be skipped without exhausting the batch. Accept no more than the target count; leave unselected rows pending.

Queue listing returns only Groq-curated rows and orders them by newest `source_published_at` first. Inspect the canonical title, grouped source URLs, source dates, curation reason, and existing Bloxodes coverage before accepting it for research. If no pending rows exist, return that the queue is empty; do not invent substitute topics. If the queue cannot be read, report the operational blocker rather than silently switching to topic suggestion.

On the Bloxodes homelab, queue commands automatically resolve the managed-dev
credentials from `/etc/bloxodes/article-automation.env` when that file is
readable by the worker user and no explicit article-dev credentials are set.
Never print, quote, or add the file contents to a prompt. If the conventional
file exists but is unreadable, report its ownership and mode without revealing
values; the supported installation is `root:teja` with mode `0640`.

An eligible `agent_runner` row in `article_generation_queue` has already passed the Groq topic-type, owned-page-family, source-grouping, and overlap filter. The parent still verifies that the sources support accurate research before writing. Preserve the queue ID and every grouped source URL throughout the job so the same skill can close the row when local work finishes.

### Externally Claimed Homelab Writer Jobs

When the current message explicitly says that `scripts/articles/run-local-article-writer.ts` has already claimed the queue item:

- Treat the supplied title, type, queue reference, and source packet as the one explicit approved input.
- Do not list, claim, or update `article_generation_queue`; the wrapper owns managed-dev queue state and Grok does not receive production database credentials.
- Complete the same separate research, mandatory image, and writing-subagent workflow, with parent review at each gate, followed by the verifier, managed-dev Supabase import, and real-browser preview.
- Check production overlap only with `npm run articles:inventory:production`; this GET-only path cannot mutate production.
- Never publish or import the article to production. Normal `SUPABASE_*` variables intentionally point to managed dev in this mode.
- End with the structured status requested by the wrapper. Report `completed` only when `final.json`, verification, managed-dev import, and rendered preview all passed. Otherwise return `skipped`, `blocked`, or `failed` with the actual reason.

Use separate research, image, and writing subagents. Give each subagent one article only. The parent model orchestrates the work, approves briefs and image readiness, reviews finals, runs verification, and previews the rendered pages.

If there are more article ideas than available subagent slots, queue the extra articles. Do not write them from the parent role. Start the next article with a new subagent only after another subagent finishes or becomes available.

The parent owns judgment but not article prose. It may make tiny non-content metadata or JSON fixes, such as correcting a slug, source URL, tag, `universe_id`, `author_id`, `cover_image`, missing/null field, or malformed JSON wrapper. Send changes to tone, structure, body copy, FAQ copy, or substantive claims back to the writing subagent.

## Research Subagent Handoff

Tell the research subagent:

- You are the subagent for one article only.
- Do not run `/bloxodes-article-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-article-research`.
- Skill file: `.agents/skills/bloxodes-article-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

## Writing Subagent Handoff

After the parent approves `brief.md`, always run the separate article-image pass. Start writing only after image readiness is approved. Do not reuse the research or image subagent for writing.

## Image Subagent Handoff

For every approved brief, start a new image subagent before writing. Tell it:

- You are the image subagent for one article only.
- Do not write `final.json` and do not call subagents.
- Use `/bloxodes-article-images`.
- Skill file: `.agents/skills/bloxodes-article-images/SKILL.md`.
- Read the approved `brief.md`, define a nonzero expected set in `media.json`, search alternate wiki/official/guide sources for every unresolved target, host approved exact matches, update image readiness in `brief.md`, and stop for parent approval.

The parent reviews expected count, exact matches, provenance, missing reasons, at least two distinct query variants and two checked source-page URLs for each proposed omission, uploaded URL readback, and readiness. Send search or mapping gaps back to the image subagent. Only the parent may accept a missing entry, and only after reliable, accurate, helpful images could not be found. An article may be image-free only when all planned targets are accepted missing.

After image readiness passes, tell the separate writing subagent for normal gameplay and general articles:

- Use `/bloxodes-article-writing`.
- Skill file: `.agents/skills/bloxodes-article-writing/SKILL.md`.
- Read the approved `brief.md`.
- Write only the matching `final.json`.
- Reopen the draft once and revise it for the skill's voice, clarity, usefulness, and valid JSON.

For Roblox tech, platform, or troubleshooting articles, replace the writing skill with `/bloxodes-tech-article-writing` and apply its rules on top of the base article-writing rules.

For articles whose primary job is ranking a complete set of units, classes, weapons, abilities, items, characters, or similar entities, replace the writing skill with `/bloxodes-tier-list-writing`. Run the same mandatory image pass first. Prefer its visual overview when a complete exact-match image set exists. Use its text/table-first tier-list shape only when the unresolved image targets were explicitly accepted missing after the source search.

Pass the writing subagent the paths to `brief.md` and `final.json`, the topic and article slugs, whether the article is normal, tech, or tier-list content, and any parent approval notes. Resume that writing subagent when copy changes are needed so it retains the article context.

If subagents are unavailable, report the article as blocked instead of silently taking over its research or writing.

## Workspace

For each article:

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  final.json
  media.json        # required for every article; source, mapping, upload, and readiness state
```

Article-owned source images live in Supabase Storage under `articles/<article-slug>/sources/`. Never add them to the repository or hotlink third-party hosts.

## Workflow

1. Resolve inputs using **Input Selection**. Confirm direct user-supplied ideas. For queue-backed work, inspect the source lead and existing Bloxodes coverage first. Mark a duplicate, codes article, unsupported lead, or topic without a useful angle `skipped` with a concise reason.
2. For each accepted queue-backed lead, mark it `processing` before starting research:

```bash
npm run articles:queue:update -- --queue-id <uuid> --status processing --worker <worker-name> --apply
```

3. Start one research subagent per article and queue extras when slots are full.
4. Require each research subagent to use `/bloxodes-article-research` and return `brief.md` only.
5. Review each brief. Do not approve weak research just because the angle sounds good.
6. Send research feedback to the same research subagent, or approve the brief.
7. Start a new image subagent for every approved brief. Review and approve `media.json` and the updated image-readiness block before writing. If coverage is weak and the search is incomplete, return it to the image subagent or block the article.
8. After research and image readiness are approved, start a new writing subagent with the normal, tech, or tier-list writing skill.
9. Review `final.json`. Fix only tiny non-content metadata or JSON issues directly; send copy and content changes back to the writing subagent.
10. Start or reuse the local web server with `npm run dev:managed`.
11. Run the batch verifier on reviewed final files. It requires sibling `media.json` for every article. Send copy failures to the writing subagent, source gaps to the research subagent, and image coverage or mapping failures to the image subagent.
12. Run the deterministic rendered-browser check for every verified final:

```bash
npm run verify:article-browser -- --base-url http://localhost:<port> --file <final.json> --file <final.json>
```

    - This command launches the installed headless Chrome/Chromium executable through Playwright, opens the real localhost route, scrolls the article to trigger lazy media, and requires every article-body image to finish with nonzero dimensions.
    - In unattended homelab runs, an empty product/browser-agent list is expected when the desktop browser bridge is not attached. Do not block solely for that reason; use `verify:article-browser` and report its actual result.
    - Do not treat an HTML fetch, image URL, or browser-agent availability as proof of rendered-page verification.
13. Immediately after an article passes both verification and rendered browser preview, mark its queue row `completed`:

```bash
npm run articles:queue:update -- --queue-id <uuid> --status completed --result-path <final.json> --apply
```

13. Return approved paths, localhost article links, queue outcomes, blocked articles, and remaining risks.

Use `skipped` for a deliberate editorial rejection such as existing coverage or no useful/source-backed angle:

```bash
npm run articles:queue:update -- --queue-id <uuid> --status skipped --reason "<concise reason>" --apply
```

For a queue row claimed directly by this runner, use `blocked` for a temporary evidence, tool, browser, media, or service failure. The homelab batch returns due blocked rows to pending with bounded attempts:

```bash
npm run articles:queue:update -- --queue-id <uuid> --status blocked --reason "<concise reason>" --retry-after-minutes 180 --apply
```

For an externally claimed one-row homelab job, return `blocked` in the structured result and let its wrapper apply backoff. Use `failed` only for an unrecoverable workflow failure. Use `skipped` only for a deliberate editorial rejection, never for a temporary image-search or media-service failure. Do not mark a row `completed` merely because `final.json` exists: the verifier and actual browser preview must both have passed.

## Brief Review

Check:

- existing Bloxodes coverage is actually checked
- related page-type overlap is handled
- sources support the angle
- source discovery used more than one query style and more than one surface when the topic is a Roblox micro-guide
- "few sources" claims are backed by documented fallback checks, not just one polluted or empty search
- the brief separates sources found, sources used for exact facts, unusable sources, and search limitations
- game-specific article titles and slugs include the game name
- the title promise is clear
- the outline answers the title
- facts to avoid are named
- open gaps are honest
- the brief defines a nonzero expected visual target set before image discovery
- complete visual topics include every useful target; normal articles include the one to three highest-value targets
- image candidates are mapped by target and preserve exact-match evidence, source URL, and usage/source notes
- images are clean, exact matches from reliable source pages; source provenance and any explicit attribution condition are recorded

If the brief is weak, ask for more research or mark the article blocked.

Do not rewrite the article from the parent role. The parent may only make tiny non-content metadata or JSON repairs itself, such as slug, source URL, tag, ID, null field, or syntax fixes. Send writing, tone, body, FAQ, and content feedback to the writing subagent, and send research-gap feedback to the research subagent.

## Final Article Review

Check:

- Check against the Writing Rules in `bloxodes-article-writing/SKILL.md`
- `final.json` parses
- title, slug, meta, tags, sources, and universe ID make sense
- game-specific article titles and slugs include the game name; use `Roblox` wording when it helps readers understand the topic
- `content_md` answers the approved brief
- `faq_json` answers useful follow-up questions without repeating the article body
- the opening starts with the topic, action, or problem
- every section adds value
- language is simple enough for Roblox players
- copy reads in the Bloxodes house voice: calm, playful gamer-buddy, with a light dry touch of wit wrapped around real facts (wit dialed down on error/troubleshooting pieces), and no hype words like ultimate, insane, amazing, epic, must-have, or game-changer
- paragraphs are short (1-3 sentences, one idea each) with no wall-of-text blocks
- sentences are short and plain; long run-on sentences are split
- list and step items are short (one action/fact each), not paragraphs crammed into a bullet
- for fix/troubleshooting articles, each fix has its own H3 heading (not one long nested-bullet list); no deep bullet-in-bullet hierarchies
- no repeated fixes, causes, or explanations across sections
- facts are verified and accurate: no invented menu paths, no impossible actions, and never tells readers to play Roblox in a web browser (the in-browser player is discontinued)
- no public copy mentions research workflow, source gathering, database checks, or internal notes
- no unsupported claims, vague wording, or page-type overlap
- links are useful, not decorative
- videos are perfect matches and use `{{ youtube: ... }}` rather than leftover raw links
- body images are clean, use verified Bloxodes-hosted paths, have useful alt text, and sit beside the relevant content; tier-list articles may reuse canonical game/collection assets under `apps/web/public`
- every article matches sibling `media.json`: expected, verified, uploaded, inserted, missing, and accepted-missing counts reconcile, with every image beneath its planned heading or in its row
- body images are omitted only when all planned targets are accepted missing because no reliable, accurate, helpful image was found

After this review, run the batch verifier on the files that look ready. Treat writing, copy, tone, body, and FAQ failures as feedback for the writing subagent, and research or accuracy gaps as feedback for the research subagent. The parent may directly fix verifier failures only when they are small non-content metadata or JSON issues, such as a wrong slug, malformed JSON, source URL typo, tag cleanup, missing `universe_id`, or an import-required null/default field.

## Local Preview

Before final output, the parent model must preview every approved article on the real local route in an actual browser.

Use any browser control or automation available in the current environment. Prefer Chrome or Chromium. When only terminal tools are available, use the repository's Playwright package with an installed Chrome or Chromium executable. Do not depend on a product-specific browser name.

1. Start or reuse the local web server with `npm run dev:managed`.
2. Open sibling `media.json` and every hosted public URL, then confirm each image loads. Article-owned images must use Supabase Storage; tier lists may reuse canonical game/collection assets under `apps/web/public`.
3. Run the verifier. Image readiness is mandatory:

```bash
npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json> --file <final.json>
```

Use one `--file` for each approved article and the actual localhost port shown by the dev server.

4. If the verifier fails, send writing, JSON, or copy output to the writing subagent. Send source or brief gaps to the research subagent.
5. If the verifier passes, open every verified `/articles/<slug>` link in Chrome, Chromium, or another available real browser.
6. Check the page title, article body, author/cover behavior, and obvious layout issues.
7. Confirm embeds render as players instead of raw syntax and that body images load beside the correct content.
8. Return the localhost links for every completed article.

If the deterministic browser check fails, mark the affected row blocked with the command's actual reason. Do not claim browser verification from an HTML fetch alone.

## Final Output

Return:

- brief paths
- final.json paths
- media.json paths and image readiness counts for every article
- localhost article links
- approved articles
- blocked articles and why
- verification done, including `verify:article-finals` and the browser used for rendered-page preview
- remaining risks
- queue ID and final queue status for every queue-backed article
