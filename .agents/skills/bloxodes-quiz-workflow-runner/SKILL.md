---
name: bloxodes-quiz-workflow-runner
description: Run one approved Bloxodes quiz page with parent review. Use when the user asks to create or update a /quizzes page with subagent research, question design, local verification, and Codex Browser preview.
---

# Bloxodes Quiz Workflow Runner

Use one subagent for one quiz. The same subagent researches the game facts, waits for parent approval, then writes `final.json`.

## Workflow

1. Confirm the game, universe ID, and quiz idea.
2. Ask the subagent to use `bloxodes-quiz-research` and return `brief.md`.
3. Review source proof, topic coverage, difficulty plan, and facts to avoid.
4. Ask the same subagent to use `bloxodes-quiz-writing` and create `final.json`.
5. Review that questions are fair, stable, and useful.
6. Start or reuse localhost with `npm run dev:local`.
7. Run:

```bash
npm run verify:engagement-finals -- --base-url http://localhost:<port> --file <final.json>
```

8. If the verifier passes, open the verified `/quizzes/<code>` link in the Codex Browser.
9. Return paths, localhost link, blocked reason if any, and remaining risks.

## Parent Checks

- existing quiz coverage is checked
- questions are stable and source-backed
- wrong answers are plausible and similar in specificity
- no answer is given away by option length
- explanations teach the fact briefly
- verifier and Browser preview pass
