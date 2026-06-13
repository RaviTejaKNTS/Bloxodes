---
name: bloxodes-quiz-writing
description: Write, review, or seed Bloxodes quiz pages backed by quiz_pages and local QuizData JSON. Use for /quizzes pages, quiz metadata, Roblox game question pools, easy/medium/hard difficulty design, quiz page copy, local Supabase quiz imports, and question-quality review.
---

# Bloxodes Quiz Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/quizzes.md`
- `agents/content/final-edit.md`

If these files have not been read in the current task, read them before writing or importing a quiz.

Create or update the game-first workspace before writing:

```text
tmp/content-workspace/<game-slug>/quiz/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/quiz.md` into the folder as `todo.md` and update it as work progresses.

## What This Skill Is For

Use this when the page is an interactive quiz under `/quizzes/<slug>`. A quiz is not an article and should not become a guide page with a small quiz attached. It should be a replayable test built from real game knowledge.

Do not edit shared quiz routes, quiz runner components, result screens, page chrome, CTAs, sidebars, ads, sitemap/feed code, or unrelated copy while using this skill unless the user explicitly asks for implementation work. Quiz work owns `quiz_pages` and the local question pool. If preview exposes a runner/template issue, report it separately.

Bloxodes normally creates one combined quiz per game unless the user explicitly asks for multiple. Use the game slug as the quiz code. Example: `wizard-alchemy`, not `wizard-alchemy-quiz`. Do not use `roblox_universes.slug` as `quiz_pages.code`; universe slugs belong to `/stats/games/*` and may include universe IDs.

For new game coverage, prefer writing the quiz after core catalog data or catalog-led discovery exists. A good quiz needs stable item, map, mode, mechanic, and progression facts; do not make questions from surface-level guesses or current live codes/events.

## Required Shape

Quiz metadata lives in `quiz_pages`:

```json
{
  "universe_id": null,
  "code": "",
  "title": "",
  "description_md": "",
  "seo_title": null,
  "seo_description": "",
  "is_published": true
}
```

Questions live in a local `QuizData` file:

```json
{
  "easy": [
    {
      "id": "",
      "question": "",
      "options": [
        { "id": "A", "text": "" },
        { "id": "B", "text": "" },
        { "id": "C", "text": "" },
        { "id": "D", "text": "" }
      ],
      "correctOptionId": "A",
      "image": null
    }
  ],
  "medium": [],
  "hard": []
}
```

The public attempt uses 5 easy, 5 medium, and 5 hard questions. Keep at least 10 questions in each difficulty pool for replay variety unless the user accepts a smaller quiz.

## Workflow

Research the game like a player. Explain the loop, core systems, important routes, confusing details, and what expert players would know. Inspect existing local datasets, existing quiz rows, route behavior, and related wiki/catalog/tool/checklist pages before writing.

Then write `final.json` with:

- the `quiz_pages` row fields being inserted or updated
- the full `QuizData` object or a pointer to the local file being updated
- a summary with question counts, validation results, and remaining uncertainty

Seed local Supabase first when metadata changes. Preview `/quizzes/<slug>` and `/quizzes` before calling the work complete.

## Writing Guidance

Keep the page copy short and useful. `description_md` should tell the player what kind of knowledge the quiz checks, but it should not give away answers or become a separate coverage section. Do not add a “what this quiz covers” block.

Easy questions should be easy and friendly. Medium questions should require real game familiarity. Hard questions should be very hard and pro level: exact thresholds, drop comparisons, material math, chance calculations, late-game routes, build tradeoffs, and multi-system details are all good hard-question material when the facts are supported.

Question rhythm should feel natural across the pool. Mix plain `What`, `Which`, `Who`, and `Where` questions with scenarios, compare-and-pick prompts, calculations, route checks, and mistake-catching prompts. Do not turn rhythm guidance into a rigid count rule. The goal is a human-feeling quiz, not a new template.

Answer options should be clean and plausible. Use wrong answers from the same game system when possible, and avoid ambiguity. The UI shuffles options, but the source file should still avoid obvious correct-answer patterns.

Balance answer length and specificity. Do not make the correct answer the only long, detailed, qualified option while the distractors are short or silly. If one option names exact costs, stages, routes, or mechanics, the wrong options should usually name comparable costs, stages, routes, or mechanics too. A player should need game knowledge to choose, not a guess that the longest answer is probably right.

## Final Checks

Before calling a quiz ready:

- `final.json` is valid when used.
- `quiz_pages.code` is the editorial game slug.
- `quiz_pages.code` is not `roblox_universes.slug`.
- The local quiz JSON parses.
- Each difficulty has the intended question count.
- Every question has four options.
- Every `correctOptionId` exists in that question's options.
- No question has the correct answer as the unique obvious longest option, and distractors are comparable in detail to the correct answer.
- Easy questions are actually easy.
- Medium questions are not throwaway beginner prompts.
- Hard questions are pro-level and supported by checked facts.
- The pool uses varied question rhythms without banning normal quiz phrasing.
- The detail page renders the updated pool and starts a 15-question attempt.
- The index card has a useful title, summary, and image.
