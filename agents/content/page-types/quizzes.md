# Quiz Pages

Use this guide for Bloxodes quiz pages at `/quizzes/<slug>`, backed by a `quiz_pages` row and a local question pool such as `data/<Game>/quiz.json`.

A quiz page should feel like a quick playable test, not a thin article. The reader is there to answer questions, learn what they missed, and replay. Keep the page intro useful and short, then let the interactive quiz do the work.

## Purpose

A good game quiz checks whether a player understands the systems that matter in play:

- first-session basics
- NPCs, locations, shops, and routes
- item uses, materials, drops, rewards, and unlocks
- mechanics such as crafting, brewing, rerolls, stats, chances, effects, and formulas
- common mistakes or details players confuse
- late-game or completionist knowledge for hard questions

Bloxodes normally creates one combined quiz per game. Do not split a game into multiple quiz pages unless the user explicitly asks or the game has a clear reason for separate quiz markets.

For new game coverage, quiz writing should usually wait until catalog-led discovery or core catalog data has produced stable facts. Do not build quiz questions from surface-level guesses, current code names, current event status, or temporary reward tracks.

## Database And Data Shape

The page metadata lives in `quiz_pages`:

```json
{
  "universe_id": 10006104044,
  "code": "wizard-alchemy",
  "title": "Wizard Alchemy Quiz (Roblox) - 15 Questions on Potions, Races, Gear & Maps",
  "description_md": "Short intro for the detail page and index card.",
  "seo_title": null,
  "seo_description": "Short durable meta description.",
  "is_published": true
}
```

The question pool lives in local JSON:

```json
{
  "easy": [
    {
      "id": "WA-E1",
      "question": "What are materials mainly used for in Wizard Alchemy?",
      "options": [
        { "id": "A", "text": "Decorate a house" },
        { "id": "B", "text": "Brew potion spells" },
        { "id": "C", "text": "Trade pets" },
        { "id": "D", "text": "Build vehicles" }
      ],
      "correctOptionId": "B",
      "image": null
    }
  ],
  "medium": [],
  "hard": []
}
```

Use the editorial game slug as `quiz_pages.code`, for example `wizard-alchemy`, not `wizard-alchemy-quiz`. The route already supplies `/quizzes/`. Do not copy `roblox_universes.slug`; universe slugs belong to `/stats/games/*` and may include universe IDs.

The current quiz runner builds each public attempt from 5 easy, 5 medium, and 5 hard questions. Keep at least 10 questions per difficulty for replay variety unless the user accepts a smaller pool.

## Page Copy

`description_md` should tell the player what kind of knowledge the quiz tests without giving away the answers or turning into an extra guide section. Keep it durable and compact.

Do not add a separate “what this quiz covers” block. That section was removed because it repeats the intro and slows down the quiz page. If the player needs more detail, related wiki, catalog, checklist, code, article, and tool cards can carry the deeper paths.

Avoid active-code style freshness promises, exact update-date prose, or claims that the quiz covers every future update. The quiz should be updated when the question pool changes, but the page copy should not sound like a daily news post.

## Research Pattern

Before writing questions, research the game enough to explain the actual loop:

- What does a new player do first?
- Which systems decide progression?
- Which items, locations, NPCs, drops, stats, or formulas are central?
- Which details are easy to confuse?
- What would a good player know that a casual player may miss?
- What would only a pro, completionist, or spreadsheet-style player know?

Use existing local datasets, wiki/catalog pages, tools, checklists, articles, and source notes where available. If facts could be stale, verify before writing. Record the useful player-facing facts, unknowns, and question plan in `research-notes.md`.

## Question Difficulty

Easy questions should be easy. They should confirm first-session knowledge, obvious game categories, basic NPCs, starter items, simple locations, or core mechanic purpose. Easy does not need to be clever.

Medium questions should require actual game knowledge. They can ask about routes, item roles, stronger drops, common build choices, hidden chests, named NPCs, or system details that a casual player may not know after five minutes.

Hard questions should be very hard and pro level. Use exact thresholds, multi-step material math, drop-table comparisons, stat-pair distinctions, chance calculations, late-game routes, and questions that require connecting two or more systems. Hard questions should still be fair: every correct answer must be supported by the dataset, the rendered page, or recorded research.

## Question Rhythm

Write questions like a human quiz writer, not like a template. A good pool can mix:

- plain quiz questions such as `What`, `Which`, `Who`, and `Where`
- short scenarios from play
- route or drop identification
- compare-and-pick prompts
- calculation or threshold prompts
- mistake-catching prompts
- direct commands such as `Name the item` or `Pick the route`

Do not ban normal question starters. Also do not let one starter or one sentence shape dominate the whole pool. The goal is natural variety, not forced cleverness.

Avoid lazy rhythm fixes such as making every prompt a sentence fragment, adding ellipses, or turning every question into `X is...`. If several questions can swap nouns and still read the same, rewrite them.

## Answer Options

Each question needs four options with stable IDs `A`, `B`, `C`, and `D`.

Distractors should be plausible enough to test knowledge but not so close that the answer becomes unfair. Prefer wrong options from the same game system when possible: other potions for potion questions, other enemies for drop questions, other races for race questions, and other locations for route questions.

Answer length is part of fairness. Do not make the right answer the only detailed sentence while the wrong answers are tiny labels or obvious jokes. If the correct answer includes a cost, route, stage count, material set, stat, or mechanic, write the distractors with similar structure and specificity: other costs, other routes, other stage counts, other material sets, other stats, or other mechanics from the same game. The player should not be able to beat the quiz by picking the longest option.

Spread correct answers across options. The UI shuffles options during attempts, but the source file should still avoid obvious `A`-only or `B`-only patterns.

Do not use joke answers unless the whole quiz style calls for it. Bloxodes quizzes should feel playful through the game topic, not through throwaway choices.

## Workflow

Create or update:

```text
tmp/content-workspace/<game-slug>/quiz/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/quiz.md` into the folder as `todo.md` before research starts.

`research-notes.md` should include:

- reader goal
- current route and table behavior
- existing page row, if any
- local question pool path, if any
- sources or local datasets checked
- difficulty plan
- important facts used for hard questions
- validation results and remaining risks

`final.json` should include the `quiz_pages` row fields and the full `QuizData` object, or a clear note that only one side is being changed.

## Local Import And Preview

After writing:

- validate JSON parses
- confirm each difficulty has the intended count
- confirm every question has four options
- confirm every `correctOptionId` exists in that question's options
- inspect the question text for repeated rhythm
- inspect answer choices for length tells, especially correct answers that are uniquely longer or more detailed than all distractors
- check hard questions are actually hard
- seed or upsert the local `quiz_pages` row when metadata changes
- preview `/quizzes/<slug>` and `/quizzes`
- confirm the detail page renders the intended pool and no stale cache is hiding older questions

For local development, quiz JSON should be read fresh enough that edits appear during preview. If a page still shows old questions, restart the dev server or clear the relevant Next cache before judging the page.

## Final Checks

Before calling a quiz ready:

- `quiz_pages.code` is the editorial game slug, not `roblox_universes.slug`.
- `description_md` is useful but not a guide-shaped info dump.
- There is no separate coverage/about section.
- `quiz.json` is valid and follows the `QuizData` shape.
- Easy questions are easy.
- Medium questions require real game familiarity.
- Hard questions are pro-level and source-supported.
- Question rhythm feels natural across the whole pool.
- Answer options are plausible, clean, not ambiguous, and balanced enough that the longest or most detailed option is not an answer tell.
- The local route renders and a player can start the quiz.
