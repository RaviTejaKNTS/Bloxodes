---
name: bloxodes-games-tool-pages
description: Prepare and verify shared non-Roblox tool pages backed by registered calculators.
---

# Shared game tool pages

**In T3 Code** (you have the `delegate_task` tool and the owner runs this here), follow the "Shared game tool pages" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md`: Luna builds the evidence and data and reviews the writing, Haiku 5.5 reviews Luna's work and writes. Outside T3 Code, the flow below applies.

Use this for a non-Roblox tool with verified inputs and a working calculator. Roblox keeps its tools workflow. Minecraft keeps its calculator engines and rules publisher.

1. Read the registry identity, published wiki and approved brief. Keep game ID, namespace and scope explicit.
2. Choose a registered calculator. The general registry supports `resource-cost`. Its rules need a numeric non-negative `unitCost` and non-empty `resourceLabel`. It multiplies a whole-number quantity by a verified unit cost. Other tools need a reviewed calculator implementation first. Never store executable code in rows.
3. Write `game_tool_pages` using existing tool copy fields, `game_id`, `slug`, `tool_key`, `rules_json`, media and publication state. The database derives `code` from `slug`; omit it from the payload. Record sources in the brief and verified rules. Write the copy in the house voice (`.agents/skills/bloxodes-voice/SKILL.md`, "Tool pages" examples): start from the player's decision, explain the math plainly and keep input labels plain.
4. Validate with `npm run publish:game-pages -- --namespace <slug> --file <reviewed.json>` using the `tools` group. `--apply` is development-only within the user's authorized work.
5. Check ordinary, zero, invalid and large inputs against known results. Verify units, metadata, comments, game links, search, sitemap, feed and cache refresh.

Reuse `GameToolPageLayout` for the title, copy, content columns and calculator body. It uses the same `DedicatedToolPage` shell as Roblox and Minecraft tools. Supply a registered client calculator as its body; the page layout does not dictate the calculation. Preserve existing Minecraft tools. Homepage and sidebar templates remain deferred. Do not publish production.
