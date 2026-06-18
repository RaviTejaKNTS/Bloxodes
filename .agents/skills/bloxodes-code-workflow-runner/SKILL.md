---
name: bloxodes-code-workflow-runner
description: Run one Bloxodes codes page setup with parent review. Use when the user asks to create or update /codes/<game-slug> page fields, source URLs, Roblox link, local preview, and code refresh workflow without manually writing code rows.
---

# Bloxodes Code Workflow Runner

Use one subagent for one codes page. Codes are different from normal content: the page row is written, then code rows come from the refresh script.

## Workflow

1. Confirm the game, Roblox link, and whether it has a real code system.
2. Ask the subagent to use `bloxodes-code-writing` and return the approved payload for `upsert:code-page`.
3. Review source URLs, evergreen copy, slug, and that no active code names or current counts are written.
4. Run:

```bash
npm run upsert:code-page -- --file <payload.json> --publish
npm run refresh:codes -- --slug <game-slug>
```

5. Start or reuse localhost with `npm run dev:local`.
6. Open `/codes/<game-slug>` in the Codex Browser and verify the page renders.
7. Return paths, localhost link, refresh status, blocked reason if any, and remaining risks.

Do not manually add active codes, expired codes, rewards tied to code names, code dates, or active-code counts.
