---
name: bloxodes-article-workflow-runner
description: Run one or many Bloxodes article writing jobs with parent review. Use when the user gives approved article ideas, asks to write multiple articles, wants subagents to research/write articles, or needs parent QA before final.json output.
---

# Bloxodes Article Workflow Runner

Use this as the parent review workflow for one article or a list of articles.

Use subagents and give each subagent one article. The same subagent should research that article, create `brief.md`, wait for parent approval, then write `final.json`.

If there are more article ideas than available subagent slots, queue the extra articles. Do not write them from the parent role. Start the next article with a new subagent only after another subagent finishes or becomes available.

The parent owns judgment: approve the brief, ask for refinement, review the final article, and decide whether it is done. The parent should not take over the writing unless the fix is tiny.

## Subagent Handoff

Every subagent message must set the role and exact skill:

- You are the subagent for one article only.
- Do not run `/bloxodes-article-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-article-research`.
- Skill file: `.agents/skills/bloxodes-article-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After the parent approves the brief, send the same subagent:

- Continue with `/bloxodes-article-writing`.
- Skill file: `.agents/skills/bloxodes-article-writing/SKILL.md`.
- Create `final.json` for the approved brief only.

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
6. After approval, ask the same subagent to use `/bloxodes-article-writing` and create `final.json`.
7. Review the final article and send fixes back to the same subagent when needed.
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
- game-specific article titles and slugs include the game name
- the title promise is clear
- the outline answers the title
- facts to avoid are named
- open gaps are honest

If the brief is weak, ask for more research or mark the article blocked.

Do not rewrite the article from the parent role unless the fix is tiny. Send clear feedback back to the same article subagent so the agent who researched the article also fixes the article.

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
- no public copy mentions research workflow, source gathering, database checks, or internal notes
- no unsupported claims, vague wording, or page-type overlap
- links are useful, not decorative

After this review, run the batch verifier on the files that look ready. Treat failures as feedback for the same article subagent, not as a final import problem.

## Local Preview

Before final output, the parent model must preview every approved article on the real local route.

1. Start or reuse the local web server with `npm run dev:local`.
2. Run:

```bash
npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json> --file <final.json>
```

Use one `--file` for each approved article and the actual localhost port shown by the dev server.

3. If the verifier fails, send the output back to the same article subagent for fixes.
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
