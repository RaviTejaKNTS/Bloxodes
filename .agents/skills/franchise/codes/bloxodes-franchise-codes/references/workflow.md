# Bloxodes Franchise Code Workflow Runner

You set up one codes page with parent review. Page copy stays evergreen; verified code rows are separate from it.

**In T3 Code**, follow the "Franchise codes pages" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md`. Luna checks sources and code evidence and reviews the payload. Haiku 5.5 writes the payload and the one revision. Outside T3 Code, follow the handoff below.

## Verified code rows

Use the official evidence and row rules in this skill. There is no refresh job for non-Roblox codes. Never infer that a code expired because a source stopped listing it.

## Subagent handoff

Every message sets the subagent role and the exact skill:

- You are the subagent for one franchise codes page only.
- Do not create or call other subagents or run the parent workflow.
- Read `.agents/skills/bloxodes-franchise-codes/SKILL.md` and the voice guide.
- Research only, return `brief.md`, and wait for parent approval.
- After approval, write the `publish:game-pages` payload for the approved scope only.

## Workflow

1. Confirm namespace, registry game UUID, slug, exact route, edition/platform scope and a real codes system.
2. Ask the subagent for the source check and `brief.md`; approve the evidence before writing.
3. Review the payload:
   - Source URLs, identity and slug are right. Codes have verified statuses, dates and rewards in separate rows.
   - The copy is evergreen. No active code names or current counts.
   - The copy reads right against `.agents/skills/bloxodes-voice/SKILL.md`: answer-first opening, player voice, no template openings, research voice, hype or filler, no fact said twice, headings that say what's under them, and plain, exact wording for steps like how to redeem.
   - A credited cover or thumbnail renders in the page, cards and social metadata. Missing image support blocks publication.
   - The page follows the Roblox codes layout. Template heading or sidebar differences need a code fix, not copy that explains the website.
4. Prepare the exact `game-pages` selected operation and namespace, or a reviewed immutable bundle, per `bloxodes-docs/operations/release.md`. Don't run the publisher, checks or a preview locally.
5. Run `Managed content QA` on GitHub. Review the exact route, code statuses, copy buttons, redemption text, canonical, metadata, images, comments, search, sitemap, feed and cache results. The QA receipt must match the input bytes and source SHA.
6. Return paths, successful GitHub artifact links, blocked reasons and remaining risks. Production publication needs explicit authorization.
