# Bloxodes Content Work

Use this file before any Bloxodes content task. Then use the one skill that matches the job.

## Common Rules

- Write in simple language.
- Write for Roblox players and parents, not for search engines or internal reviewers.
- Start with the topic. Do not warm up with vague setup.
- Every sentence must add useful information, a step, a warning, a comparison, or a decision.
- Cut filler, hype, forced importance, and fake analysis.
- Use short paragraphs. Use bullets or tables only when they make the answer easier to scan.
- Explain facts directly. Do not mention research, scraping, prompts, workflow, databases, or internal notes in public copy.
- Verify facts that can change: codes, events, prices, dates, availability, stats, formulas, source URLs, live game state, and Roblox metadata.
- Check production coverage before suggesting or writing a new page. Do not duplicate a topic Bloxodes already covers.
- Keep page ownership clean. Content tasks should write the content row, local dataset, image assets, source notes, and import files only unless the user explicitly asks for app code.
- Use editorial game slugs for public pages. Do not copy `roblox_universes.slug` into codes, wiki, article, event, checklist, quiz, or catalog slugs.
- Do not create `todo.md`. Use the file the skill asks for: `brief.md` for article research approval, `research-notes.md` for other content facts and gaps.

## Workspace Shape

Use `tmp/content-workspace/` for content work:

```text
tmp/content-workspace/<game-or-topic-slug>/<page-family>/<page-slug-or-code>/
  brief.md          # article workflows only
  research-notes.md # other content workflows when the skill asks for it
  final.json
```

Suggestion-only work may use:

```text
tmp/content-workspace/<game-slug>/suggestions/<suggestion-family>/research-notes.md
```

## Page Skills

Use one matching skill:

```text
articles: .agents/skills/bloxodes-article-writing/SKILL.md
article research: .agents/skills/bloxodes-article-research/SKILL.md
article workflow runner: .agents/skills/bloxodes-article-workflow-runner/SKILL.md
codes: .agents/skills/bloxodes-code-writing/SKILL.md
events: .agents/skills/bloxodes-events-writing/SKILL.md
wiki hubs: .agents/skills/bloxodes-wiki-writing/SKILL.md
global catalogs: .agents/skills/bloxodes-catalog-writing/SKILL.md
game catalogs: .agents/skills/bloxodes-game-catalog-writing/SKILL.md
tools: .agents/skills/bloxodes-tool-writing/SKILL.md
checklists: .agents/skills/bloxodes-checklist-writing/SKILL.md
quizzes: .agents/skills/bloxodes-quiz-writing/SKILL.md
approved catalog batches: .agents/skills/bloxodes-catalog-batch-runner/SKILL.md
```

## Suggestion Skills

Use one matching skill:

```text
wiki and catalog suggestions: .agents/skills/bloxodes-wiki-catalog-suggestions/SKILL.md
article suggestions: .agents/skills/bloxodes-article-suggestions/SKILL.md
codes/checklist/quiz/event suggestions: .agents/skills/bloxodes-engagement-suggestions/SKILL.md
tool suggestions: .agents/skills/bloxodes-tool-suggestions/SKILL.md
```

If a request does not clearly match a page type or suggestion type, ask one short question.
