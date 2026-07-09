---
name: bloxodes-article-workflow-runner
description: Run one or many Bloxodes article writing jobs with parent review. Use when the user gives approved article ideas, asks to write multiple articles, wants subagents to research/write articles, or needs parent QA before final.json output.
---

# Bloxodes Article Workflow Runner

Use this as the parent review workflow for one article or a list of articles.

Use subagents and give each subagent one article. The same subagent should research that article, create `brief.md`, and wait for parent approval. After brief approval, the writing gate is handed to Claude, then the parent resumes final review and verification.

If there are more article ideas than available subagent slots, queue the extra articles. Do not write them from the parent role. Start the next article with a new subagent only after another subagent finishes or becomes available.

The parent owns judgment: approve the brief, ask for refinement, review the final article, and decide whether it is done. The parent should not take over the writing voice, tone, structure, or body/FAQ content. Codex may make tiny non-content metadata or JSON fixes itself, such as correcting a slug, source URL, tag, `universe_id`, `author_id`, `cover_image`, missing/null field, or malformed JSON wrapper, as long as the fix does not change article tone or substantive claims.

## Subagent Handoff

Every subagent message must set the role and exact skill:

- You are the subagent for one article only.
- Do not run `/bloxodes-article-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-article-research`.
- Skill file: `.agents/skills/bloxodes-article-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After the parent approves the brief, stop using the research subagent for writing. Use Claude for `final.json`.

Normal gameplay/article writing handoff:

```bash
npm run write:article:claude -- --topic <game-or-topic-slug> --article <article-slug>
```

Roblox tech / platform / troubleshooting handoff (error-code fixes, "how to fix", won't open, crash, lag, install, settings how-tos; not single-game gameplay):

```bash
npm run write:article:claude -- --topic <game-or-topic-slug> --article <article-slug> --tech
```

The script writes a Claude handoff prompt to:

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/claude-writing-prompt.md
```

If the Claude CLI is available in the current environment, add `--run` to the same command. The script invokes Claude with the symlinked Claude writing skill at `.claude/skills/bloxodes-article-writing/SKILL.md`, or `.claude/skills/bloxodes-tech-article-writing/SKILL.md` when `--tech` is used. It tells Claude to write `final.json` for the approved brief only and requires Claude to reopen and revise its output once for human-friendly voice, concrete usefulness, no generic filler, valid JSON, no source/research/database/internal/page wording, no self-referential article/page/guide phrasing, correct `faq_json` keys, and useful links.

If the CLI is not available, paste the generated handoff prompt into Claude manually and continue after Claude writes the same `final.json` path. Do not let the previous Codex research subagent write the article unless the user explicitly overrides this workflow.

## Workspace

For each article:

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  final.json
```

## Workflow

1. Confirm the approved article idea or list of ideas.
2. Give each subagent exactly one article idea.
3. Ask each subagent to start with `/bloxodes-article-research` and return `brief.md` only.
4. Review each brief. Do not approve weak research just because the angle sounds good.
5. Send feedback to the same subagent, or approve the brief.
6. After approval, run `npm run write:article:claude -- --topic <game-or-topic-slug> --article <article-slug>` to prepare the Claude handoff. Add `--tech` for Roblox tech / platform / troubleshooting articles, and add `--run` when the Claude CLI is available.
7. After Claude writes `final.json`, review the final article. Codex may directly fix small non-content metadata/JSON issues, such as slug/source/tag/schema/ID mistakes, but must send any tone, body, structure, FAQ, wording, or substantive factual changes back to Claude using the same handoff prompt context.
8. Start or reuse the local web server with `npm run dev:local`.
9. Run the batch verifier on reviewed final files. If it fails, send the findings back to the same subagent and do not open Browser yet.
10. Open verified localhost article links in the Codex Browser.
11. Return approved paths, localhost article links, blocked articles, and remaining risks.

If subagents are not available, run the same brief-review-final process sequentially.

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

If the brief is weak, ask for more research or mark the article blocked.

Do not rewrite the article from the parent role. Codex may only make tiny non-content metadata or JSON repairs itself, such as slug, source URL, tag, ID, null field, or syntax fixes. Send clear writing/tone/body/FAQ/content feedback back to Claude, and send research-gap feedback back to the article research subagent.

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

After this review, run the batch verifier on the files that look ready. Treat writing/copy/tone/body/FAQ failures as feedback for Claude, and research/accuracy gaps as feedback for the article research subagent, not as a final import problem. Codex may directly fix verifier failures only when they are small non-content metadata or JSON issues, such as a wrong slug, malformed JSON, source URL typo, tag cleanup, missing `universe_id`, or an import-required null/default field.

## Local Preview

Before final output, the parent model must preview every approved article on the real local route.

1. Start or reuse the local web server with `npm run dev:local`.
2. Run:

```bash
npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json> --file <final.json>
```

Use one `--file` for each approved article and the actual localhost port shown by the dev server.

3. If the verifier fails, send writing/JSON/copy output back to Claude for fixes. Send source or brief gaps back to the article research subagent.
4. If the verifier passes, open every verified `/articles/<slug>` link in the Codex Browser.
5. Check the page title, article body, author/cover behavior, and obvious layout issues.
6. Return the localhost links for every completed article.

If an article cannot be imported or previewed, mark it blocked with the reason.

## Final Output

Return:

- brief paths
- final.json paths
- localhost article links
- approved articles
- blocked articles and why
- verification done, including `verify:article-finals` and Codex Browser preview
- remaining risks
