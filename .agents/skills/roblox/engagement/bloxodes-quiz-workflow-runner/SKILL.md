---
name: bloxodes-quiz-workflow-runner
description: Run one approved Bloxodes quiz page with parent review. Use when the user asks to create or update a /quizzes page with subagent research, question design, local verification, and Codex Browser preview.
---

# Bloxodes Quiz Workflow Runner

You run one quiz from research to a verified local preview. One subagent does the work: it researches the game facts, waits for your approval of the brief, then writes `final.json`. You review both stages.

## Subagent handoff

Every message to the subagent sets its role and the exact skill.

First message:

- You are the subagent for one quiz only.
- Do not run `/bloxodes-quiz-workflow-runner`.
- Do not create or call other subagents.
- Start with `/bloxodes-quiz-research`.
- Skill file: `.agents/skills/bloxodes-quiz-research/SKILL.md`.
- Return `brief.md` only and wait for parent approval.

After you approve the brief, send the same subagent:

- Continue with `/bloxodes-quiz-writing`.
- Skill file: `.agents/skills/bloxodes-quiz-writing/SKILL.md`.
- Read the voice guide first: `.agents/skills/bloxodes-voice/SKILL.md`.
- Create `final.json` for the approved brief only.

## Workflow

1. Confirm the game, universe ID and quiz idea.
2. Ask the subagent to use `/bloxodes-quiz-research` and return `brief.md`.
3. Review the source proof, topic coverage, difficulty plan and facts to avoid.
4. Ask the same subagent to use `/bloxodes-quiz-writing` and create `final.json`.
5. Review that the questions are fair, stable and useful, and check the copy (see Parent checks).
6. Start or reuse localhost with `npm run dev:managed`.
7. Run the managed-development verifier. It validates and imports both the page copy and `final.json.quizData` into `quiz_pages`, reads the exact saved payload back, and only then checks the route:

   ```bash
   npm run verify:engagement-finals -- --base-url http://localhost:<port> --file <final.json>
   ```

8. If the verifier passes, open the verified `/quizzes/<code>` link in the Codex Browser.
9. Return the paths, the localhost link, any blocked reason and the remaining risks.

## Parent checks

Facts and questions:

- Existing quiz coverage is checked.
- Questions are stable and source-backed.
- Wrong answers are plausible and similar in specificity.
- No answer is given away by option length.
- Explanations teach the fact briefly.

Copy, checked against `.agents/skills/bloxodes-voice/SKILL.md`:

- The page copy (intro and description) opens with something a player wants, in a player's voice: simple English, calm and a bit playful, light wit only on real facts. No template openings, research voice, hype words or AI filler.
- Questions and options stay plain and exact.
- No fact repeated between the intro and the description.

Verification:

- The verifier and Browser preview pass.
