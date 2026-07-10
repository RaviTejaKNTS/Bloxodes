---
name: bloxodes-article-workflow-runner
description: Run one or many Bloxodes article writing jobs with parent review. Use when the user gives approved article ideas, asks to write multiple articles, wants subagents to research/write articles, or needs parent QA before final.json output.
---

# Bloxodes Article Workflow Runner

This is the parent workflow for one article or a list of articles.

You are the parent. You judge. You do not take over the writing voice.

## How the work splits

1. A **research subagent** builds `brief.md` and waits.
2. You approve, refine, or block the brief.
3. A **writing subagent** writes `final.json` from the approved brief.
4. You review the article, run verification, and preview the local page.

Give each subagent one article only. If you have more ideas than open slots, queue the rest. Do not write articles from the parent seat.

If subagents are not available, run the same two passes yourself: research first, then writing. Keep them separate.

The parent may fix tiny non-content metadata or JSON issues (slug, source URL, tag, IDs, null fields, broken JSON). Anything about tone, body, structure, FAQ wording, or real claims goes back to the right subagent.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  final.json
```

## Research subagent handoff

Tell the research subagent:

- You own one article only.
- Do not run this workflow runner.
- Do not create other subagents.
- Skill: `.agents/skills/bloxodes-article-research/SKILL.md`
- Return `brief.md` only.
- Do not write `final.json`.

## Writing subagent handoff

After the brief is approved, start a **new** writing subagent. Do not reuse the research subagent for writing unless the user says to.

For normal gameplay and general articles:

- Skill: `.agents/skills/bloxodes-article-writing/SKILL.md`
- Read the approved brief first.
- Write only:
  `tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/final.json`
- After drafting, reread once as a stuck player and fix flow, voice, and clarity.

For Roblox tech / platform / troubleshooting pieces (errors, won’t open, crash, lag, install, settings):

- Skill: `.agents/skills/bloxodes-tech-article-writing/SKILL.md`
- That skill sits on top of the normal writing skill. Apply both.

Also give the writing subagent:

- path to `brief.md`
- path for `final.json`
- topic and article slugs
- whether it is tech or normal
- any approval notes (soft facts, preferred links, risks)

## Workflow

1. Confirm the approved idea or list.
2. Start one research subagent per article (queue the rest).
3. Review each brief carefully.
4. Send research feedback to the same research subagent, or approve.
5. Start a writing subagent with the right skill.
6. Review `final.json`.
7. Start or reuse local web with `npm run dev:local`.
8. Run `verify:article-finals` on ready files.
9. If verification fails, send writing issues to the writing subagent and research gaps to the research subagent.
10. Preview each passed `/articles/<slug>` page.
11. Return paths, localhost links, blocks, and risks.

## Brief review

A brief is ready when:

- Bloxodes coverage was actually checked
- page-type overlap is clear
- sources support the angle
- thin-source claims show real fallback checks
- source buckets are separated (found / used / unusable / limits)
- game titles and slugs include the game name
- the title promise is clear and the outline answers it
- facts to avoid and open gaps are honest
- **player texture is usable**: wrong assumptions, stuck scenes, player words, decisions, and where that texture should land in the outline

Weak research does not become strong just because the angle sounds fun. Ask for more work or block it.

## Final article review

Read the piece top to bottom like a player who is stuck and a little impatient.

Check:

- Matches `bloxodes-article-writing` (and the tech skill when needed)
- JSON parses
- title, slug, meta, tags, sources, and `universe_id` make sense
- game pieces include the game name in title and slug
- body answers the brief
- FAQs help without repeating the body, in the same voice
- opens on the real problem or answer
- reads as one clean story with full sentences and natural flow
- simple enough for a younger Roblox player
- sounds like a calm friend who plays, not a manual and not a hype ad
- each main section has at least one real player moment, mistake, or decision
- no research leaks in public copy
- no empty hype words
- steps and lists stay short and clear
- fix articles use one H3 per fix
- facts are solid; never tell people to play Roblox in a browser
- links help

Then run the verifier on files that look ready. Only fix tiny metadata or JSON issues yourself.

## Local preview

1. Start or reuse `npm run dev:local`.
2. Run:

```bash
npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json>
```

Use the real port and one `--file` per article.

3. On failure, send writing problems to the writing subagent and research gaps to research.
4. On pass, open or fetch each `/articles/<slug>` page.
5. Check title, body, author/cover, and whether the story still feels good on the real page.
6. Return the localhost links.

If a piece cannot import or preview, mark it blocked with the reason.

## Final output

Return:

- brief paths
- final.json paths
- localhost article links
- approved articles
- blocked articles and why
- verification done
- remaining risks
