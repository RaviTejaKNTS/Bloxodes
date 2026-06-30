---
name: bloxodes-quiz-writing
description: Write one Bloxodes quiz final.json after brief approval. Use for /quizzes pages, metadata, quizData, Roblox game question pools, easy/medium/hard difficulty design, and question-quality review.
---

# Bloxodes Quiz Writing

Use this after `bloxodes-quiz-research` and parent approval. Questions should be clear, fair, and based on facts a player can learn from the game or reliable sources.

## Workflow

1. Read the approved `brief.md`.
2. Create or update:

```text
tmp/content-workspace/<game-slug>/quizzes/<quiz-code>/
  brief.md
  final.json
```

3. Write page metadata and quiz data in `final.json`.
4. Parse JSON and validate the quiz shape.

## Voice & Tone

Bloxodes house voice for the page copy (`description_md`, intro, explanations): write like a player who knows the game well, telling a friend how it works. Calm, warm, and a little playful, never formal, corporate, or hyped.

- Simple English first. Short sentences, everyday words a younger player gets instantly. Explain any game term in plain words right where it appears.
- Do not use em dashes. Replace any em dash with a colon, comma, parentheses, or two short sentences. This applies to every output field: title, metadata, body, FAQ, and all JSON values.
- Playful, not loud. Drop in a light, dry touch of wit (roughly one per short paragraph) and always wrap it around a real fact, like "protection that overstays its welcome." The fact leads; the wit rides along. Never force a joke, stack puns, or let a quip hide the info.
- Gamer-buddy warmth. Talk to the player as "you," use real in-game nouns, and sound like someone who actually plays, not a manual.
- Spark from rhythm, not adjectives. Energy comes from concrete detail, a strong first line, and varied sentence length, not from words like *ultimate, insane, amazing, epic, must-have, game-changer*. Ban those.
- Open on the real thing: the topic or the challenge. No "Welcome to…" or mood-setting warm-ups.
- Keep functional slots clean. Questions, options, and explanations stay plain, clear, and unambiguous; the playful voice lives in the page intro and description, never inside a question that needs one exact answer.
- No filler or AI tics. Cut "Additionally", "Furthermore", "It's important to note", and "not just… but". Every sentence earns its place.

## Question Rules

- Use easy, medium, and hard questions when the game has enough depth.
- Each question needs one correct answer and plausible wrong answers.
- Avoid trick questions, stale current-event claims, and questions that depend on private servers or rumors.
- Do not ask about exact dates, code names, or temporary events unless the quiz is explicitly about a stable historical fact.
- Explanations should teach the fact in one or two simple sentences.

## Field Jobs

- `page.universe_id`: Link the quiz to the exact game universe.
- `page.code`: Use the editorial game slug. The route already adds `/quizzes/`.
- `page.title`: Name the game and the quiz promise in a readable way.
- `page.description_md`: Tell players what knowledge the quiz tests without giving away answers.
- `page.seo_title`: Keep null or close to the title unless search needs custom text.
- `page.seo_description`: Summarize the quiz topic and player value in one durable snippet.
- `quizData`: Store the full question pool in the shape the route expects.
- `question`: Test one clear fact, decision, route, or system.
- `options`: Provide four plausible choices with similar specificity.
- `correctOptionId`: Match one option ID exactly.
- `explanation`: Teach the answer briefly when the data shape supports it.

## Output Shape

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
    "questions": []
  }
}
```
