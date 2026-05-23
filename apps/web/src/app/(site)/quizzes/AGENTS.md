# Quiz Routes Guide

Scope: `apps/web/src/app/(site)/quizzes`.

This folder renders the public quizzes index and quiz detail pages. Quiz page copy lives in Supabase `quiz_pages`; question pools live in local JSON and are loaded through `apps/web/src/lib/quizzes.ts`.

## Route Shape

- `/quizzes`: index page for published quizzes.
- `/quizzes/[slug]`: detail page with a 15-question interactive run.

Shared route-family data belongs in `page-data.tsx`. Quiz detail rendering should stay server-first and pass the local question pool into `QuizRunner`.

## Content Workflow

Use:

- `$bloxodes-quiz-writing`
- `agents/content/page-types/quizzes.md`
- `agents/content/writing-core.md`
- `agents/content/final-edit.md`

For a new game quiz, create or update a `quiz_pages` row and a local `data/<Game>/quiz.json` pool. The quiz code should be the game slug, such as `wizard-alchemy`, because the route already supplies `/quizzes/`.

## Page Copy Rules

Keep `description_md` compact and player-facing. It should explain the kind of knowledge being tested, not become a guide or answer key.

Do not add a separate “what this quiz covers” or `about_md` section. The detail page should move from the intro into the quiz, then related content.

## Question Pool Rules

The current runner builds each public attempt from:

- 5 easy questions
- 5 medium questions
- 5 hard questions

Keep at least 10 questions per difficulty for replay variety when possible.

Easy should be easy. Medium should require real game familiarity. Hard should be very hard and pro-level, using exact values, route comparisons, drop tables, formulas, thresholds, build tradeoffs, or multi-step reasoning when the facts support it.

Question rhythm should feel natural. Mix ordinary quiz phrasing with scenarios, calculations, route checks, and comparison prompts. Do not overfit to one starter or ban normal `What`, `Which`, `Who`, and `Where` questions.

## Validation

Before calling a quiz route update complete:

1. Validate the local JSON parses.
2. Confirm each difficulty pool has the intended count.
3. Confirm every question has four options.
4. Confirm every `correctOptionId` matches an option in the same question.
5. Preview `/quizzes/<slug>` and verify the updated pool is rendered.
6. Preview `/quizzes` when metadata, index card text, image, or publish state changed.
7. Run `npm run typecheck:web` when route or shared TypeScript changed.

If the dev page shows old questions after editing JSON, restart the local dev server or clear the relevant Next cache before judging the page.
