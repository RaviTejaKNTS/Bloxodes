---
name: bloxodes-wiki-workflow-runner
description: Run one approved Bloxodes wiki hub with parent review. Use when the user asks to create or update a /wiki/<game-slug> page with subagent research, wiki writing, local verification, and browser preview.
---

# Bloxodes Wiki Workflow Runner

Spawn one subagent (Agent tool, `subagent_type: general-purpose`) for one wiki hub. The same subagent researches the game, waits for parent approval, then writes `final.json`. Continue the same subagent across gates with SendMessage so its context carries over.

The parent owns judgment: approve the research, review the wiki copy, run local verification, and preview the route.

## Subagent Handoff

When you spawn the subagent, set the role and exact skill in the prompt:

- You are the subagent for one wiki hub only.
- Do not invoke the `bloxodes-wiki-workflow-runner` skill.
- Do not spawn or call other subagents.
- Invoke the `bloxodes-wiki-research` skill (Skill tool).
- Return `brief.md` only and stop for parent approval.

After the parent approves the brief, continue the same subagent with SendMessage:

- Invoke the `bloxodes-wiki-writing` skill.
- Create `final.json` for the approved brief only.

## Workspace

```text
tmp/content-workspace/<game-slug>/wiki/<game-slug>/
  brief.md
  final.json
```

## Workflow

1. Confirm the game, universe ID, and editorial slug.
2. Ask the subagent to use the `bloxodes-wiki-research` skill and return `brief.md`.
3. Review identity, existing coverage, game loop, controls proof, related pages, and gaps.
4. Send feedback or approve the research.
5. Ask the same subagent to use the `bloxodes-wiki-writing` skill and create `final.json`.
6. Review `final.json`, simple language, controls, tips, metadata, and related-page assumptions.
7. Start or reuse localhost with `npm run dev:local`.
8. Run:

```bash
npm run verify:wiki-final -- --base-url http://localhost:<port> --game <game-slug> --final-json-root tmp/content-workspace/<game-slug>
```

9. If the verifier passes, open the verified `/wiki/<game-slug>` link in the browser preview (Claude-in-Chrome MCP, or the Preview MCP).
10. Return paths, localhost link, blocked reason if any, and remaining risks.

## Parent Checks

- production coverage was checked for wiki, codes, catalogs, events, tools, articles, checklists, and quizzes
- game identity is exact
- core loop is easy to understand
- `description_md` is short, link-free, game-loop focused, and does not say what the wiki will cover
- controls are verified or omitted
- tips are concrete and useful
- public copy does not mention workflow, sources, databases, or page usage
- verifier and browser preview pass
