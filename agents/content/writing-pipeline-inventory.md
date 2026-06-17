# Bloxodes Codex Writing Flow Inventory

Date: 2026-06-17

This file lists the Codex-facing writing workflow files only: content docs, page-type docs, todo templates, skills, and scoped agent instructions. It intentionally excludes scripts, app route files, sitemaps, database schema, migrations, and rendering infrastructure.

## Core Content Docs

```text
agents/content/PLAN.md
agents/content/PROCESS.md
agents/content/writing-core.md
agents/content/research-policy.md
agents/content/flow-pass.md
agents/content/final-edit.md
```

## Page-Type Docs

```text
agents/content/page-types/articles.md
agents/content/page-types/catalog-pages.md
agents/content/page-types/game-catalog-pages.md
agents/content/page-types/wiki-pages.md
agents/content/page-types/code-pages.md
agents/content/page-types/events.md
agents/content/page-types/tools.md
agents/content/page-types/checklists.md
agents/content/page-types/quizzes.md
```

## Todo Templates

```text
agents/content/todo-templates/article.md
agents/content/todo-templates/catalog.md
agents/content/todo-templates/catalog-batch.md
agents/content/todo-templates/game-catalog.md
agents/content/todo-templates/wiki.md
agents/content/todo-templates/codes.md
agents/content/todo-templates/events.md
agents/content/todo-templates/tool.md
agents/content/todo-templates/checklist.md
agents/content/todo-templates/quiz.md
agents/content/todo-templates/discovery.md
agents/content/todo-templates/page-research.md
agents/content/todo-templates/final-verification.md
```

## Writing Skills

```text
.agents/skills/bloxodes-writing-core/SKILL.md
.agents/skills/bloxodes-research/SKILL.md
.agents/skills/bloxodes-flow-edit/SKILL.md
.agents/skills/bloxodes-final-edit/SKILL.md
.agents/skills/bloxodes-article-writing/SKILL.md
.agents/skills/bloxodes-code-writing/SKILL.md
.agents/skills/bloxodes-events-writing/SKILL.md
.agents/skills/bloxodes-wiki-writing/SKILL.md
.agents/skills/bloxodes-catalog-writing/SKILL.md
.agents/skills/bloxodes-game-catalog-writing/SKILL.md
.agents/skills/bloxodes-tool-writing/SKILL.md
.agents/skills/bloxodes-checklist-writing/SKILL.md
.agents/skills/bloxodes-quiz-writing/SKILL.md
.agents/skills/bloxodes-game-page-discovery/SKILL.md
.agents/skills/bloxodes-catalog-batch-runner/SKILL.md
```

## Skill Agent And Reference Files

```text
.agents/skills/bloxodes-writing-core/agents/openai.yaml
.agents/skills/bloxodes-research/agents/openai.yaml
.agents/skills/bloxodes-flow-edit/agents/openai.yaml
.agents/skills/bloxodes-final-edit/agents/openai.yaml
.agents/skills/bloxodes-article-writing/agents/openai.yaml
.agents/skills/bloxodes-wiki-writing/agents/openai.yaml
.agents/skills/bloxodes-catalog-writing/agents/openai.yaml
.agents/skills/bloxodes-game-catalog-writing/agents/openai.yaml
.agents/skills/bloxodes-tool-writing/agents/openai.yaml
.agents/skills/bloxodes-quiz-writing/agents/openai.yaml
.agents/skills/bloxodes-catalog-batch-runner/agents/openai.yaml
.agents/skills/bloxodes-catalog-batch-runner/references/subagent-prompt.md
```

## Scoped Agent Instructions

```text
AGENTS.md
apps/web/src/app/AGENTS.md
apps/web/src/app/(site)/AGENTS.md
apps/web/src/app/(site)/catalog/AGENTS.md
apps/web/src/app/(site)/quizzes/AGENTS.md
apps/web/src/app/(site)/tools/AGENTS.md
apps/web/src/app/api/AGENTS.md
apps/web/src/lib/AGENTS.md
data/AGENTS.md
scripts/AGENTS.md
supabase/AGENTS.md
```

## Legacy Or Adjacent Agent Docs

```text
agents/agents.md
agents/data/agents.md
agents/pages/agents.md
agents/routes/agents.md
agents/scripts/agents.md
agents/wiki-catalog-workflow.md
agents/universe-stats-workflow.md
```
