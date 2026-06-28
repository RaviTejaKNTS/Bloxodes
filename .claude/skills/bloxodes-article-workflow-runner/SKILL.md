---
name: bloxodes-article-workflow-runner
description: Run one or many Bloxodes article writing jobs with parent review. Use when the user gives approved article ideas, asks to write multiple articles, wants subagents to research/write articles, or needs parent QA before final.json output.
---

# Bloxodes Article Workflow Runner

Use this as the parent review workflow for one article or a list of articles.

Spawn a subagent with the Agent tool (`subagent_type: general-purpose`) and give each subagent one article. The same subagent should research that article, create `brief.md`, wait for parent approval, then write `final.json`. Continue the same subagent across gates with SendMessage so its context carries over; do not start a fresh agent for the writing step.

If there are more article ideas than you can run at once, queue the extras and start each with a new subagent only after a slot frees up. You can run subagents in parallel (or with `run_in_background`) up to a sensible limit. Do not write articles from the parent role.

The parent owns judgment: approve the brief, ask for refinement, review the final article, and decide whether it is done. The parent should not take over the writing unless the fix is tiny.

## Subagent Handoff

When you spawn the subagent, set the role and exact skill in the prompt:

- You are the subagent for one article only.
- Do not invoke the `bloxodes-article-workflow-runner` skill.
- Do not spawn or call other subagents.
- Invoke the `bloxodes-article-research` skill (Skill tool).
- Return `brief.md` only and stop for parent approval.

After the parent approves the brief, continue the same subagent with SendMessage:

- Invoke the `bloxodes-article-writing` skill.
- Exception — for Roblox tech / platform / troubleshooting articles (error-code fixes, "how to fix", won't open, crash, lag, install, settings how-tos; not single-game gameplay), invoke the `bloxodes-tech-article-writing` skill instead. It adds scan-table, numbered-step, heading, depth, and internal/external link rules on top of the base article rules.
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
3. Ask each subagent to start with the `bloxodes-article-research` skill and return `brief.md` only.
4. Review each brief. Do not approve weak research just because the angle sounds good.
5. Send feedback to the same subagent with SendMessage, or approve the brief.
6. After approval, ask the same subagent to use the `bloxodes-article-writing` skill and create `final.json`.
7. Review the final article and send fixes back to the same subagent when needed.
8. Start or reuse the local web server with `npm run dev:local`.
9. Run the batch verifier on reviewed final files. If it fails, send the findings back to the same subagent and do not open the browser preview yet.
10. Preview the verified localhost article links in the browser (Claude-in-Chrome MCP, or the Preview MCP).
11. Return approved paths, localhost article links, blocked articles, and remaining risks.

If subagents are not available, run the same brief-review-final process sequentially in the parent.

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

- Check against the Writing Rules in the `bloxodes-article-writing` skill
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
4. If the verifier passes, open every verified `/articles/<slug>` link in the browser preview (Claude-in-Chrome MCP, or the Preview MCP).
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
- verification done, including `verify:article-finals` and the browser preview
- remaining risks
