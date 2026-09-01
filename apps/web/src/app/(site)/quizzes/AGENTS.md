# Quiz Routes Guide

Scope: `apps/web/src/app/(site)/quizzes`.

This folder renders the public quizzes index and quiz detail pages. Quiz page copy and question pools live in Supabase `quiz_pages`; `apps/web/src/lib/quizzes.ts` reads the `quiz_data` JSONB column and has no filesystem fallback.

## Route Shape

- `/quizzes`: index page for published quizzes.
- `/quizzes/[slug]`: detail page with a 15-question interactive run.

Shared route-family data belongs in `page-data.tsx`. Quiz detail rendering should stay server-first and pass the validated database question pool into `QuizRunner`.

## Content Workflow

Use:

- `$bloxodes-quiz-writing`
- `agents/content-writing/agents.md`

For a new game quiz, write the approved `final.json`, then use `npm run verify:engagement-finals` so `import-content-final.ts` validates and writes both page copy and `quiz_data` to managed development before route verification. The quiz code should be the game slug, such as `wizard-alchemy`, because the route already supplies `/quizzes/`.

Existing `data/<Game>/quiz.json` files are retained temporarily as migration/archive inputs. Runtime code must never read them. Bulk migration uses `npm run sync:quiz-data`; normal new-quiz work uses the reviewed `final.json` importer.

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

Answer choices should be balanced within each question. The correct option must not stand out as the only long or highly detailed answer while the distractors are short, generic, or joke-like. When one option names exact values, routes, materials, stages, or mechanics, the other options should use comparable detail from the same game system.

## Validation

Before calling a quiz route update complete:

1. Validate `final.json.quizData` with the shared `QuizData` parser.
2. Confirm each difficulty pool has the intended count.
3. Confirm every question has four options.
4. Confirm every `correctOptionId` matches an option in the same question.
5. Confirm no question has the correct option as the unique obvious longest or most detailed answer.
6. Preview `/quizzes/<slug>` and verify the updated pool is rendered.
7. Preview `/quizzes` when metadata, index card text, image, or publish state changed.
8. Run `npm run typecheck:web` when route or shared TypeScript changed.

If the managed-development page shows old questions after import, verify the `quiz_pages.quiz_data` readback and clear the relevant Next cache before judging the page.
