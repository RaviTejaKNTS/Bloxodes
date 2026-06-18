---
name: bloxodes-catalog-workflow-runner
description: Run one approved global Bloxodes /catalog page with parent review. Use when the user asks to create or update catalog_pages content with subagent research, catalog writing, local verification, and Codex Browser preview.
---

# Bloxodes Catalog Workflow Runner

Use one subagent for one global catalog page. The same subagent researches the collection, waits for parent approval, then writes `final.json`.

## Workflow

1. Confirm the catalog idea and route code.
2. Ask the subagent to use `bloxodes-catalog-research` and return `brief.md`.
3. Review existing coverage, data state, sources, useful fields, and gaps.
4. Ask the same subagent to use `bloxodes-catalog-writing` and create `final.json`.
5. Review copy, metadata, FAQs, and JSON.
6. Start or reuse localhost with `npm run dev:local`.
7. Run:

```bash
npm run verify:catalog-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/catalog/<code>` link in the Codex Browser.
9. Return paths, localhost link, blocked reason if any, and remaining risks.

## Parent Checks

- production duplicate check is done
- item/data source is strong enough
- copy explains the collection, not how to use the page
- no raw dataset or website-first wording appears in public copy
- verifier and Browser preview pass
