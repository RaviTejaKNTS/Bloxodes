---
name: bloxodes-events-workflow-runner
description: Run one approved Bloxodes events page with parent review. Use when the user asks to create or update /events/<game-slug> evergreen page copy with source verification, local verification, and Codex Browser preview.
---

# Bloxodes Events Workflow Runner

You run one events page from research to GitHub-verified QA. One subagent does the work: it researches the event source path, waits for your approval of the brief, then writes `final.json`. You review both stages.

## Subagent handoff

Every message to the subagent sets its role and the exact skill.

First message:

- You are the subagent for one events page only.
- Do not run `/bloxodes-events-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-events-research`.
- Skill file: `.agents/skills/bloxodes-events-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After you approve the brief, send the same subagent:

- Continue with `/bloxodes-events-writing`.
- Skill file: `.agents/skills/bloxodes-events-writing/SKILL.md`.
- Read the voice guide first: `.agents/skills/bloxodes-voice/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the game and universe ID.
2. Ask the subagent to use `/bloxodes-events-research` and return `brief.md`.
3. Review whether the event data source is good enough. Don't approve manual timeline rows.
4. Ask the same subagent to use `/bloxodes-events-writing` and create an evergreen `final.json`.
5. Review the final:
   - No stale dates, current-event claims or invented timeline facts.
   - The copy reads right against `.agents/skills/bloxodes-voice/SKILL.md`: it opens on what events mean in this game, sounds like a player, and has no template openings, research voice, hype, filler or repeated facts. Headings say what's under them.
   - Every fact matches the approved brief.
6. Keep the reviewed `final.json` in the task workspace. For CI, stage an exact copy in a selected batch under `content/releases/<batch>/` (operation kind `events-final`), or use a reviewed immutable bundle. Ignored `tmp/` files aren't available on GitHub by themselves. Don't start a local preview or run the verifier locally.
7. Run `Managed content QA` on GitHub with the exact committed batch or bundle. It stages the page in managed development, builds the site and checks the selected route on desktop and mobile.
8. Review the job's screenshots and reports for the `/events/<slug>` route. The receipt must match the selected input bytes and the reviewed source SHA.
9. Return the exact final path, the successful GitHub artifact links, any blocked reason and the remaining risks. Production publication needs explicit authorization.