---
name: bloxodes-quiz-writing
description: Write one Bloxodes quiz final.json after brief approval. Use for /quizzes pages, metadata, quizData, Roblox game question pools, easy/medium/hard difficulty design, and question-quality review.
---

# Bloxodes Quiz Writing

A good quiz feels like a friend testing how well you really know the game. Easy questions make players feel smart, and hard ones make them say "wait, really?" Questions must be clear, fair and based on facts players can learn in the game or from reliable sources.

Use this after `bloxodes-quiz-research` and parent approval.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Quizzes" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<game-slug>/quizzes/<quiz-code>/
     brief.md
     final.json
   ```

3. Write page metadata and quiz data in `final.json`. The approved importer stores both in `quiz_pages`, including `quiz_data`. Never create or update a runtime `quiz.json` file.
4. Parse the JSON and validate the quiz shape.

## Where the voice goes

- **The page description gets the personality.** A quick challenge to the reader and a hint of what the questions cover, without giving answers away. Name the real places or systems the easy and hard questions touch.
- **Questions and options stay plain.** One exact question, four clean options. No jokes, puns or extra words where a player needs one precise answer.
- **No explanations.** The quiz route doesn't store or show an `explanation` field, so don't write one. Make the question itself teach by naming the real place, item or system.
- **Never narrate how the page was made.** Follow Public Copy in root `AGENTS.md`. Game terms like Research or Source Cargo are fine.

## Question rules

- Use easy, medium and hard questions when the game has enough depth.
- Each question has exactly one correct answer and believable wrong answers of similar specificity.
- No trick questions, stale current-event claims, or questions that depend on private servers or rumors.
- No exact dates, code names or temporary events unless the quiz is explicitly about a stable historical fact.
- Test one clear fact, decision, route or system per question.
- Vary how questions start. Twenty questions in a row beginning "Which of the following..." feels like an exam.

## Field jobs

- `page.universe_id`: the exact game universe.
- `page.code`: the editorial game slug. The route already adds `/quizzes/`.
- `page.title`: the game and the quiz promise, written the way people search ("Ember Isles Quiz: How Well Do You Know the Islands?").
- `page.description_md`: what knowledge the quiz tests, without giving away answers.
- `page.seo_title`: null or close to the title unless search needs custom text.
- `page.seo_description`: the quiz topic and why it's worth taking, in one lasting snippet.
- `quizData`: the full question pool in the shape the route expects.
- `question`: one clear fact, decision, route or system.
- `options`: four believable choices.
- `correctOptionId`: matches one option ID exactly.
- `image`: optional, a hosted image URL or null.

## Output shape

```json
{
  "page": {
    "universe_id": 0,
    "code": "",
    "title": "",
    "description_md": "",
    "seo_title": "",
    "seo_description": "",
    "is_published": true
  },
  "quizData": {
    "easy": [
      {
        "id": "easy-1",
        "question": "",
        "options": [
          { "id": "a", "text": "" },
          { "id": "b", "text": "" },
          { "id": "c", "text": "" },
          { "id": "d", "text": "" }
        ],
        "correctOptionId": "a",
        "image": null
      }
    ],
    "medium": [],
    "hard": []
  }
}
```

Questions use only these keys. Anything else, like `explanation`, is dropped on import.

Each difficulty must be a non-empty array. Every question needs a globally unique ID, exactly four options with unique IDs, and a `correctOptionId` that exists in that question's options.
