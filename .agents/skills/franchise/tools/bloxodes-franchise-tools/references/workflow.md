# Bloxodes Franchise Tool Workflow Runner

You run one tool page from research to GitHub-verified QA. One subagent researches the tool's job, waits for your approval, then writes `final.json`. You review both stages.

**In T3 Code**, follow the "Franchise tool pages" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md`. Luna researches and checks formulas, assumptions and sample results. Haiku 5.5 reviews the research and writes. Outside T3 Code, follow the handoff below.

## Subagent handoff

Every message sets its role and the exact skill:

- You are the subagent for one franchise tool page only.
- Do not create or call other subagents or run the parent workflow.
- Read `.agents/skills/bloxodes-franchise-tools/SKILL.md` and `references/research.md`.
- Return `brief.md` only and wait for parent approval.
- After approval, read the voice guide and write `final.json` for the approved brief only.

## Workflow

1. Confirm namespace, registry game UUID, route, player decision, inputs, outputs, formula and edition/platform/mode scope.
2. Ask for research and `brief.md`.
3. Review whether this is a real interactive tool, not a static content page. Confirm its calculator and rules are registered. For unsupported math, return the exact implementation gap.
4. After brief approval, ask for the `publish:game-pages` `tools` payload in `final.json`.
5. Review the final:
   - Formula assumptions, limits, metadata and JSON are right and match the approved brief.
   - The copy reads right against `.agents/skills/bloxodes-voice/SKILL.md`: an answer-first intro about the player's problem, a player's voice, no template openings, research voice, hype, filler or repeated facts, and headings that say what's under them.
   - Input labels, steps and result text stay plain and exact.
   - The required credited thumbnail exists, renders and supplies social metadata. The layout and sections match Roblox tools.
6. Keep the reviewed final in the workspace. Prepare the exact `game-pages` selected operation and namespace, or a reviewed immutable bundle, per `bloxodes-docs/operations/release.md`. Don't run the publisher, checks or a preview locally.
7. Run `Managed content QA` on GitHub. Check ordinary, zero, invalid and large inputs against known results, units, rounding and whole-number rules. QA stages the page in development, builds the site and renders desktop/mobile routes.
8. Review screenshots, metadata, thumbnail, `og:image`, comments, game links, search, sitemap, feed and cache refresh. The receipt must match the selected input bytes and source SHA.
9. Return the final path, successful GitHub artifact links, blocked reasons and remaining risks. Production publication needs explicit authorization.
