---
name: bloxodes-article-workflow-runner
description: Run one or many Bloxodes article writing jobs with parent review. Use when the user gives approved article ideas, asks to write multiple articles, wants subagents to research/write articles, or needs parent QA before final.json output.
---

# Bloxodes Article Workflow Runner

Use this as the parent review workflow for one article or a list of articles.

Use separate research and writing subagents. Give each subagent one article only. The parent model orchestrates the work, approves briefs, reviews finals, runs verification, and previews the rendered pages.

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

After the parent approves `brief.md`, start a new writing subagent. Do not reuse the research subagent for writing.

For normal gameplay and general articles, tell it:

- Use `/bloxodes-article-writing`.
- Skill file: `.agents/skills/bloxodes-article-writing/SKILL.md`.
- Read the approved `brief.md`.
- Write only the matching `final.json`.
- Reopen the draft once and revise it for the skill's voice, clarity, usefulness, and valid JSON.

For Roblox tech, platform, or troubleshooting articles, replace the writing skill with `/bloxodes-tech-article-writing` and apply its rules on top of the base article-writing rules.

Pass the writing subagent the paths to `brief.md` and `final.json`, the topic and article slugs, whether the article is normal or tech, and any parent approval notes. Resume that writing subagent when copy changes are needed so it retains the article context.

If subagents are unavailable, report the article as blocked instead of silently taking over its research or writing.

## Workspace

For each article:

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  final.json
  media.md          # optional source and rights notes, not public copy
```

Hosted article images live at:

```text
apps/web/public/articles/<article-slug>/
  cover.webp
  <descriptive-name>.webp
```

Save approved images with `npm run content:save-article-image` before final verification.

## Workflow

1. Confirm the approved article idea or list of ideas.
2. Start one research subagent per article and queue extras when slots are full.
3. Require each research subagent to use `/bloxodes-article-research` and return `brief.md` only.
4. Review each brief. Do not approve weak research just because the angle sounds good.
5. Send research feedback to the same research subagent, or approve the brief.
6. After approval, start a new writing subagent with the normal or tech writing skill.
7. Review `final.json`. Fix only tiny non-content metadata or JSON issues directly; send copy and content changes back to the writing subagent.
8. Start or reuse the local web server with `npm run dev:local`.
9. Run the batch verifier on reviewed final files. Send copy failures to the writing subagent and research gaps to the research subagent.
10. Open each verified localhost article in an available real browser and inspect the rendered page.
11. Return approved paths, localhost article links, blocked articles, and remaining risks.

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
- the media plan uses only perfect-match video candidates and clean, source-checked images, without forcing media

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
- body images are clean, hosted under `/articles/<slug>/`, have useful alt text, and sit beside the relevant step
- media is omitted when it does not make the article easier to understand

After this review, run the batch verifier on the files that look ready. Treat writing, copy, tone, body, and FAQ failures as feedback for the writing subagent, and research or accuracy gaps as feedback for the research subagent. The parent may directly fix verifier failures only when they are small non-content metadata or JSON issues, such as a wrong slug, malformed JSON, source URL typo, tag cleanup, missing `universe_id`, or an import-required null/default field.

## Local Preview

Before final output, the parent model must preview every approved article on the real local route in an actual browser.

Use any browser control or automation available in the current environment. Prefer Chrome or Chromium. When only terminal tools are available, use the repository's Playwright package with an installed Chrome or Chromium executable. Do not depend on a product-specific browser name.

1. Start or reuse the local web server with `npm run dev:local`.
2. If body images are planned, confirm the files exist under `apps/web/public/articles/<slug>/`.
3. Run:

```bash
npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json> --file <final.json>
```

Use one `--file` for each approved article and the actual localhost port shown by the dev server.

4. If the verifier fails, send writing, JSON, or copy output to the writing subagent. Send source or brief gaps to the research subagent.
5. If the verifier passes, open every verified `/articles/<slug>` link in Chrome, Chromium, or another available real browser.
6. Check the page title, article body, author/cover behavior, and obvious layout issues.
7. Confirm embeds render as players instead of raw syntax and that body images load beside the correct content.
8. Return the localhost links for every completed article.

If no real browser can be controlled, or an article cannot be imported or previewed, mark it blocked with the reason. Do not claim browser verification from an HTML fetch alone.

## Final Output

Return:

- brief paths
- final.json paths
- localhost article links
- approved articles
- blocked articles and why
- verification done, including `verify:article-finals` and the browser used for rendered-page preview
- remaining risks
