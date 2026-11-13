# Article Runs in T3 Code

Read this when the owner runs the article runner inside T3 Code and you have the T3 `delegate_task` tool. You're the orchestrator. Each stage goes to a fresh child agent in the role below, and you review every handoff. The code-controlled pipeline (`articles:pipeline`, `articles:writer:batch`) and the homelab automation don't use this page and keep their own model settings.

## Who runs each stage

| Stage | Role | Why |
| --- | --- | --- |
| Research | `researcher` | Careful sourcing, doesn't invent facts |
| Research review | `writer` | A second role catches gaps and dropped numbers |
| Images | `researcher` | Tool-heavy search, download and crop work |
| Image review | `writer` | Strong visual judgment on exact matches |
| Writing and the one revision | `writer` | Best voice with real depth in testing |
| Editorial review | `researcher` | No role reviews its own writing. Strong on facts against the brief |

The "Agent system" section of your global instructions says which model each role is. Here the `researcher` always runs at its higher effort.

- Don't run a stage yourself, and don't hand two stages to one child. The split is the point.
- Every handoff is a new `delegate_task` call with its own `clientRequestId` (like `<run-id>-<slug>-writing-r1`), stable across retries of that call. Keep each `taskId`.
- Children must not start sub-agents or leave background commands running. If a task seems stuck after the child reports, follow "When a child looks stuck" in `.agents/skills/bloxodes-model-routing/SKILL.md`.

## Workspace

One folder per article, created by you before research:

```text
tmp/article-runs/<run-id>/<article-slug>/
  job.json            title, slug, article_type, source leads, refresh flag
  brief.md            research
  research-review.md  research review
  media.json          images (local paths, hosted_url pending)
  images/             chosen WebP files
  image-review.md     image review
  draft-final.json    writing (never edited after review)
  editorial-review.md editorial review
  final.json          the one revision
  stage-log.md        one entry per stage: model, start/end, result, problems
```

- Several articles can run at once. Each child works only in its own article folder and never reads another run, `tmp/content-workspace`, `tmp/article-pipeline` or `tmp/model-test`.
- Read `tmp/article-runs/<run-id>/production-inventory.json` for overlap checks and internal-link slugs when you've prepared one. Otherwise children check production through read-only queries the research skill allows.

## Stage flow

Run the stages in order for each article. Review each result before starting the next stage.

1. **Research** (`researcher`). Follow `.agents/skills/bloxodes-article-research/SKILL.md`. Output `brief.md` with `Research status: ready_for_review` or an exact blocker. When sources disagree, the brief keeps every value with its source and a recommended value or range.
2. **Research review** (`writer`). Judge the brief against the research skill's review rules and the article's search intent. Output `research-review.md` with a decision (`completed`, `needs_revision` or `blocked`), concrete findings and missing facts compared with the top-ranking guides. No artifact edits.
   - On `needs_revision`, send the findings and the brief back to a new `researcher` research task. One correction, then one more review.
3. **Images** (`researcher`). Follow `.agents/skills/bloxodes-article-images/SKILL.md`. Output `media.json` and WebP files in `images/`, with `hosted_url` marked pending. No uploads.
   - If its shell can't reach an image host, the `researcher` records the exact source image URL and page in `media.json` with `download: blocked` and moves on. You download those files from the main shell into `images/` before image review.
4. **Image review** (`writer`). Open every file. Confirm each one shows its exact target and follows the image rules, including the "big arrow" definition. Output `image-review.md` with a decision, findings and any `accepted_missing` IDs with reasons. No artifact edits. Accept every reasonably searched miss. Images are best effort and never block the article.
   - On `needs_revision`, send the findings back to a new `researcher` images task. One correction, then one more review.
5. **Writing** (`writer`). Follow `.agents/skills/bloxodes-article-writing/references/pipeline-writing.md` (it starts with the voice guide and the article standard), or the tech or tier-list writing skill when the article type needs it. Output `draft-final.json`, with images as `![alt](images/<file>.webp)`.
6. **Editorial review** (`researcher`). Follow `.agents/skills/bloxodes-article-writing/references/editorial-review.md`: the six checks, plus the brief-fact ledger in Completeness. Output `editorial-review.md` with a decision and quoted findings. No artifact edits.
7. **Revision** (`writer`). A new writing task gets the draft, the brief and the editorial findings, and writes `final.json`. One revision only. Leave `draft-final.json` unchanged.

A `blocked` decision at any stage stops that article. Report the stage and the exact blocker. Don't pad around a missing central fact.

## What every child brief says

- The stage, the article title, slug, type and source leads.
- The exact article folder and the files to write.
- The skills to read in full first. Writing and editorial review always include `.agents/skills/bloxodes-voice/SKILL.md`.
- The previous stage's files to read, and any findings to fix.
- Boundaries: stay in the article folder; read-only web research is fine; no database writes, Supabase or R2 uploads, imports, publishing, queue or claim commands, GitHub actions, commits, edits to tracked repo files, builds, tests or previews; no sub-agents; never ask for permission escalation, and log anything blocked in `stage-log.md`.
- What to return: the decision or output path, a short summary and any problems.

## Your review

You own the content and SEO review in `bloxodes-docs/agents/how-agents-work.md`, judged against `bloxodes-docs/content/page-standards.md`. After each stage, read the actual files, not just the child's summary. After the revision, review `final.json` as an editor against the voice guide and the brief. Fix small prose issues yourself. Send a gap back only when it needs new research or images.

## After the final

The run stops at an approved `final.json` with local images. Hosted upload, managed-development import, `Managed content QA` on GitHub and production release each need the owner's explicit go-ahead, and they follow the normal article release path. Never mark a queue row from this path.

Report per article: status, the stage it reached, word and image counts, each review's main findings, what you changed, and the folder path.
