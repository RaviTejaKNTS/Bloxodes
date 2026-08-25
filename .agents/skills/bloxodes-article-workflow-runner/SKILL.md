---
name: bloxodes-article-workflow-runner
description: Run one or many Bloxodes article jobs with Codex research/image agents, isolated Pi Luna Max writing, and parent review. Use explicit topics from the user's message when present; otherwise select pending article_generation_queue leads.
---

# Bloxodes Article Workflow Runner

Use this as the parent review workflow for one article or a list of articles.

When `run-homelab-article-batch.ts` invokes this skill, execute the workflow below directly in the current parent turn. Never call `articles:writer:batch` from inside this skill: the outer batch already owns the single-writer lock and invoking it again only creates a self-blocking batch.

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

Use separate Codex research and image subagents. Give each subagent one article only. The parent model orchestrates the work, approves briefs and image readiness, invokes the isolated Pi writer, reviews finals, runs verification, and previews the rendered pages. Every Codex model-driven stage must run with `gpt-5.6-luna` at `max` reasoning. Article prose must never be drafted by Codex or Grok.

If there are more article ideas than available subagent slots, queue the extra articles. Do not write them from the parent role. Start the next article with a new subagent only after another subagent finishes or becomes available.

The parent owns judgment but not article prose. It may make tiny non-content metadata or JSON fixes, such as correcting a slug, source URL, tag, `universe_id`, `author_id`, `cover_image`, missing/null field, or malformed JSON wrapper. For changes to tone, structure, body copy, FAQ copy, or substantive claims, rerun the Pi writer with the same minimal packet.

## Research Subagent Handoff

The handoff contains only the skill link and the article packet. Do not add prose instructions, writing advice, ranking suggestions, source interpretation, or approval notes. The skill owns the procedure.

```text
Skill: .agents/skills/bloxodes-article-research/SKILL.md
Article: <title, type, slug/workspace, queue ID when present, and supplied source URLs>
```

## Pi Writing Handoff

After the parent approves `brief.md`, always run the separate article-image pass. Start writing only after image readiness is approved. Do not reuse the parent, research agent, or image agent for writing.

## Image Subagent Handoff

For every approved brief, start a new image subagent before writing. Its handoff contains only:

```text
Skill: .agents/skills/bloxodes-article-images/SKILL.md
Article: <title, slug, and workspace path>
```

The parent reviews expected count, exact matches, provenance, missing reasons, at least two distinct query variants and two checked source-page URLs for each proposed omission, uploaded URL readback, and readiness. Send search or mapping gaps back to the image subagent. Only the parent may accept a missing entry, and only after reliable, accurate, helpful images could not be found. An article may be image-free only when all planned targets are accepted missing.

After image readiness passes, choose the applicable writing skill and invoke the Pi harness:

```bash
npm run articles:writer:pi -- \
  --skill .agents/skills/bloxodes-article-writing/SKILL.md \
  --title <title> --slug <slug> --type <type> --workspace <workspace-path> --apply
```

For Roblox tech, platform, or troubleshooting articles, replace the writing skill with `/bloxodes-tech-article-writing` and apply its rules on top of the base article-writing rules.

For articles whose primary job is ranking a complete set of units, classes, weapons, abilities, items, characters, or similar entities, replace the writing skill with `/bloxodes-tier-list-writing`. Run the same mandatory image pass first. Its tier-list component is required even when unresolved image targets were explicitly accepted missing; those entries render as text-only items.

The Pi wrapper supplies exactly the skill link and an article packet containing title, slug, type, and workspace path. Never add parent approval notes, draft prose, preferred wording, source names, proposed placements, ranking direction, or editorial interpretation. When revision is needed, rerun the same Pi command with the same minimal packet; Pi must inspect the files again. The parent runs the full verifier after reviewing the result.

If research or image subagents are unavailable, report the article as blocked instead of silently taking over. If Pi or its ChatGPT `openai-codex` authentication is unavailable, report writing as blocked; never substitute Codex, Grok, or parent prose.

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
8. After research and image readiness are approved, invoke `articles:writer:pi` with the normal, tech, or tier-list writing skill. The wrapper is hard-pinned to Pi `openai-codex/gpt-5.6-luna` at `max` reasoning and runs deterministic copy and media checks.
9. Review `final.json`. Fix only tiny non-content metadata or JSON issues directly; for copy and content changes, rerun Pi using the same minimal handoff.
10. Start or reuse the local web server with `npm run dev:managed`.
11. Run the batch verifier on reviewed final files. It requires sibling `media.json` for every article. Rerun Pi for copy failures, send source gaps to the research subagent, and send image coverage or mapping failures to the image subagent.
12. Open each verified localhost article in an available real browser and inspect the rendered page.
13. Immediately after an article passes both verification and rendered browser preview, mark its queue row `completed`:

```bash
npm run articles:queue:update -- --queue-id <uuid> --status completed --result-path <final.json> --apply
```

14. Run the production article public-copy audit in read-only mode. Record any existing source, competitor, research-process, internal-note, or editorial-disclaimer findings for correction; the current final files must have zero findings before completion:

```bash
npm run articles:audit-copy:production -- --days 30
```

15. Return approved paths, localhost article links, queue outcomes, blocked articles, and remaining risks.

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

Do not rewrite the article from the parent role. The parent may only make tiny non-content metadata or JSON repairs itself, such as slug, source URL, tag, ID, null field, or syntax fixes. Rerun Pi with the same minimal packet for writing, tone, body, FAQ, and content failures, and send research-gap feedback to the research subagent.

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
- no public copy names a source or competitor, attributes a claim, describes another site's ordering, or adds an editorial/consensus disclaimer
- every useful verified number and constraint appears clearly once, in either prose or a table
- prose around a table interprets player choices and does not repeat the table's numbers or row summaries
- no unsupported claims, vague wording, or page-type overlap
- links are useful, not decorative
- videos are perfect matches and use `{{ youtube: ... }}` rather than leftover raw links
- body images are clean, use verified Bloxodes-hosted paths, have useful alt text, and sit beside the relevant content; tier-list articles may reuse canonical game/collection assets under `apps/web/public`
- every article matches sibling `media.json`: expected, verified, uploaded, inserted, missing, and accepted-missing counts reconcile, with every image beneath its planned heading or in its row
- body images are omitted only when all planned targets are accepted missing because no reliable, accurate, helpful image was found

After this review, run the batch verifier on the files that look ready. Treat writing, copy, tone, body, and FAQ failures as reasons to rerun Pi, and research or accuracy gaps as feedback for the research subagent. The parent may directly fix verifier failures only when they are small non-content metadata or JSON issues, such as a wrong slug, malformed JSON, source URL typo, tag cleanup, missing `universe_id`, or an import-required null/default field.

The parent never rewrites body copy and never supplies substitute copy or ranking direction in revision prompts. It reruns Pi with the same skill link and article packet; Pi reads the failed files, while the parent reruns the full verifier.

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

4. If the verifier fails, rerun Pi for writing or copy failures. Send source or brief gaps to the research subagent and make only tiny non-content JSON repairs directly.
5. If the verifier passes, open every verified `/articles/<slug>` link in Chrome, Chromium, or another available real browser.
6. Check the page title, article body, author/cover behavior, and obvious layout issues.
7. Confirm embeds render as players instead of raw syntax and that body images load beside the correct content.
8. Return the localhost links for every completed article.

If no real browser can be controlled, or an article cannot be imported or previewed, mark it blocked with the reason. Do not claim browser verification from an HTML fetch alone.

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
