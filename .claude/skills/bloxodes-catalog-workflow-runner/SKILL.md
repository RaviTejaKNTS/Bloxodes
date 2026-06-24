---
name: bloxodes-catalog-workflow-runner
description: Run one approved global Bloxodes /catalog page with parent review. Use when the user asks to create or update catalog_pages content with subagent research, catalog writing, local verification, and browser preview.
---

# Bloxodes Catalog Workflow Runner

Spawn one subagent (Agent tool, `subagent_type: general-purpose`) for one global catalog page. The same subagent researches the collection, waits for parent approval, then writes `final.json`. Continue the same subagent across gates with SendMessage so its context carries over.

## Subagent Handoff

When you spawn the subagent, set the role and exact skill in the prompt:

- You are the subagent for one global catalog page only.
- Do not invoke the `bloxodes-catalog-workflow-runner` skill.
- Do not spawn or call other subagents.
- Invoke the `bloxodes-catalog-research` skill (Skill tool).
- Return `brief.md` only and stop for parent approval.

After the parent approves the brief, continue the same subagent with SendMessage:

- Invoke the `bloxodes-catalog-writing` skill.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the catalog idea and route code.
2. Ask the subagent to use the `bloxodes-catalog-research` skill and return `brief.md`.
3. Review existing coverage, data state, sources, useful fields, and gaps.
4. Ask the same subagent to use the `bloxodes-catalog-writing` skill and create `final.json`.
5. Review copy, metadata, FAQs, and JSON.
6. Start or reuse localhost with `npm run dev:local`.
7. Run:

```bash
npm run verify:catalog-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/catalog/<code>` link in the browser preview (Claude-in-Chrome MCP, or the Preview MCP).
9. Return paths, localhost link, blocked reason if any, and remaining risks.

## Parent Checks

- production duplicate check is done
- item/data source is strong enough
- copy explains the collection, not how to use the page
- no raw dataset or website-first wording appears in public copy
- verifier and browser preview pass
