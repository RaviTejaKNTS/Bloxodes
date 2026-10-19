# Franchise Quiz Research

You're researching one approved quiz so the writer has a pool of solid, stable facts to build fair questions from. You hand back a `brief.md`. You don't write `final.json`.

## Output

```text
tmp/content-workspace/<namespace>/<game-slug>/quizzes/<quiz-code>/brief.md
```

## Research steps

1. Resolve the exact registry game UUID, namespace, editorial slug, kind, parent title and edition/platform/mode scope.
2. Check existing Bloxodes quizzes and related pages for overlap.
3. Gather stable facts players can learn from the game or reliable sources.
4. Split facts into easy, medium and hard, but only if the game has enough depth.
5. Record the edition/platform/mode, release-generation and spoiler boundary for every fact that could vary. Plan a credited cover or thumbnail; question images are separate.
6. Avoid exact dates, current events, rumors, code names and temporary claims, unless the quiz is explicitly about stable history.

## Writing the brief for the writer

Read `.agents/skills/bloxodes-voice/SKILL.md` first.

- **Write each fact as one plain, exact statement** a player would recognize: "The Iron Rod costs 500 Coins at the harbor shop." The writer turns these into questions, so each one needs a single clear answer.
- **Questions stay plain and exact.** No jokes, hedges or trick wording in the fact pool. Personality belongs in the quiz intro only.
- **Name what the player is testing:** how well they know the early game, the bosses, the lore?
- **Hooks worth using:** a surprising true fact most players get wrong. These make great medium and hard questions.
- **Keep sources and doubts private.** They go under `Evidence checked` or `Open gaps or risks`. If a fact is shaky, move it to `Facts to avoid` instead of hedging it.
- **No research jargon in the fact pool.** Words like source coverage or provenance stay in your evidence notes.

## Brief shape

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source coverage:
- Exact game UUID, namespace, kind and parent:
- Edition/platform/mode/release-generation and spoiler scope:
- Cover/thumbnail source and credit:
- Stable fact pool:

Quiz plan:
- Title:
- Slug:
- Easy topics:
- Medium topics:
- Hard topics:
- Facts to avoid:
- Hooks worth using:
- Open gaps or risks:
```

# Franchise Quiz Writing

A good quiz feels like a friend testing how well you really know the game. Easy questions make players feel smart, and hard ones make them say "wait, really?" Questions must be clear, fair and based on facts players can learn in the game or from reliable sources.

Use this after the research above and parent approval.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Quizzes" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<namespace>/<game-slug>/quizzes/<quiz-code>/
     brief.md
     final.json
   ```

3. Write the `quizzes` group in `final.json`. The approved publisher stores page metadata and `quiz_data` together in `game_quiz_pages`. Never create or update a runtime `quiz.json` file.
4. Check the JSON contract before returning. Parsing and quiz validation run on GitHub, never locally.

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

- `namespace`, `game_id` and `slug`: exact namespace, registry UUID and approved editorial page slug. Preserve existing IDs and ownership.
- `title`: the game and the quiz promise, written the way people search, about 50 to 65 characters.
- `intro_md` and `description_md`: what knowledge the quiz tests, without giving away answers or explaining quiz controls. Give each fact one home.
- `seo_title`: null or close to the title unless search needs custom text.
- `meta_description`: the quiz topic and why it's worth taking, in a lasting 140 to 160 character snippet.
- `sources_json`: credited source objects with `title` and HTTPS `url`.
- `quiz_data`: the full question pool in the shape the route expects.
- `question`: one clear fact, decision, route or system.
- `options`: four believable choices.
- `correctOptionId`: matches one option ID exactly.
- `image`: optional, a hosted image URL or null.

## Output shape

```json
{
  "quizzes": [{
    "namespace": "<namespace>",
    "game_id": "<game-uuid>",
    "slug": "<quiz-slug>",
    "title": "",
    "intro_md": "",
    "description_md": "",
    "seo_title": "",
    "meta_description": "",
    "sources_json": [],
    "is_published": false,
    "quiz_data": {
      "easy": [{
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
      }],
      "medium": [],
      "hard": []
    }
  }]
}
```

The empty pools above show the structure; fill every difficulty before handoff. Page-level cover/thumbnail support is required separately. Don't invent image, FAQ or related-link storage fields that aren't in the shared contract; return the implementation gap if those required sections can't render.

Questions use only these keys. Anything else, like `explanation`, is unsupported and must not be written.

Each difficulty must be a non-empty array. Every question needs a globally unique ID, exactly four options with unique IDs, and a `correctOptionId` that exists in that question's options.
