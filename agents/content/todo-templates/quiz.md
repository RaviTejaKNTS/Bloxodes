# Quiz Page Todo

Status: not started
Updated: YYYY-MM-DD
Workspace: `tmp/content-workspace/<game-slug>/quiz/`

## Use With

- Skill: `bloxodes-quiz-writing`
- Core docs: `agents/content/page-types/quizzes.md`, `agents/content/research-policy.md`
- Final gate: `agents/content/final-edit.md`

## Setup

- [ ] Confirm editorial game slug, universe ID, existing quiz page, local quiz JSON path, and related wiki/catalog/checklist pages.
- [ ] Copy this file as `todo.md` before writing or updating `research-notes.md`.
- [ ] Check production DB or public production URLs first for an existing quiz or related page that already covers this game.
- [ ] Use the editorial game slug for `quiz_pages.code`, not `roblox_universes.slug`.
- [ ] Check whether catalog-led discovery, local datasets, or related pages already define stable facts.

## Research And Plan

- [ ] Explain the game loop, key systems, important facts, confusing details, and expert knowledge.
- [ ] Plan easy, medium, and hard question areas.
- [ ] Verify facts used by hard questions.
- [ ] Record any facts too volatile for quiz questions.
- [ ] Exclude current code names, live event statuses, temporary reward tracks, and other short-lived facts.

## Write

- [ ] Write `final.json` with `quiz_pages` fields and full `QuizData` or a pointer to the local file updated.
- [ ] Keep at least 10 questions per difficulty unless the user accepts fewer.
- [ ] Give every question four options and a valid `correctOptionId`.
- [ ] Keep page copy compact and avoid a guide-shaped coverage block.
- [ ] Avoid repeated question rhythm, ambiguous distractors, and answer-length tells.

## Verify

- [ ] Validate JSON parsing, difficulty counts, answer IDs, and question rhythm.
- [ ] Confirm the correct answer is not the unique obvious longest or most detailed option in any question.
- [ ] Confirm easy is easy, medium requires familiarity, and hard is pro-level but fair.
- [ ] Import metadata locally when needed.
- [ ] Preview `/quizzes/<slug>` and `/quizzes`, then start a 15-question attempt.
