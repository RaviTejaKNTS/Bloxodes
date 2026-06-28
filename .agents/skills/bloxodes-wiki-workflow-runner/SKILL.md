---
name: bloxodes-wiki-workflow-runner
description: Run one approved Bloxodes wiki hub with parent review. Use when the user asks to create or update a /wiki/<game-slug> page with subagent research, wiki writing, local verification, and Codex Browser preview.
---

# Bloxodes Wiki Workflow Runner

Use one subagent for one wiki hub. The same subagent researches the game, waits for parent approval, then writes `final.json`.

The parent owns judgment: approve the research, review the wiki copy, run local verification, and preview the route.

## Subagent Handoff

Every subagent message must set the role and exact skill:

- You are the subagent for one wiki hub only.
- Do not run `/bloxodes-wiki-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-wiki-research`.
- Skill file: `.agents/skills/bloxodes-wiki-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After the parent approves the brief, send the same subagent:

- Continue with `/bloxodes-wiki-writing`.
- Skill file: `.agents/skills/bloxodes-wiki-writing/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workspace

```text
tmp/content-workspace/<game-slug>/wiki/<game-slug>/
  brief.md
  final.json
```

## Workflow

1. Confirm the game, universe ID, and editorial slug.
2. Ask the subagent to use `/bloxodes-wiki-research` and return `brief.md`.
3. Review identity, existing coverage, game loop, controls proof, related pages, and gaps.
4. Send feedback or approve the research.
5. Ask the same subagent to use `/bloxodes-wiki-writing` and create `final.json`.
6. Review `final.json`, simple language, controls, tips, metadata, and related-page assumptions.
7. Start or reuse localhost with `npm run dev:local`.
8. Run:

```bash
npm run verify:wiki-final -- --base-url http://localhost:<port> --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>
```

9. If the verifier passes, open the verified `/wiki/<game-slug>` link in the Codex Browser.
10. Return paths, localhost link, blocked reason if any, and remaining risks.

## Parent Checks

- production coverage was checked for wiki, codes, catalogs, events, tools, articles, checklists, and quizzes
- game identity is exact
- core loop is easy to understand
- `description_md` is short, link-free, game-loop focused, and does not say what the wiki will cover
- controls are verified or omitted
- tips are concrete and useful
- public copy does not mention workflow, sources, databases, or page usage
- verifier and Browser preview pass
