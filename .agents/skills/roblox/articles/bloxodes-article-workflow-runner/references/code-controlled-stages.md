# Code-Controlled Article Stages

Read this when the runtime assigns you one stage or sets `ARTICLE_PIPELINE_STAGE`. You do one focused job (research, images, writing or a review) and return its result. Code does everything else.

This page overrides interactive parent/subagent and standalone self-review instructions for that invocation. The shared editorial standard and the page-type output contracts still apply.

## The pipeline

The runtime runs: research → research review → image selection → image review → upload/readback → writing → editorial review → copy/media checks → managed-development import/readback → browser verification.

- Models do only the assigned judgment or authoring task.
- The runtime owns process lifetimes, deadlines, retries, stage transitions, approval records, queue status and release eligibility.
- Native subagent tools are disabled. Don't launch another model, manage processes, call workflow runners, inspect env/auth files or change queue/database state.

## Who owns what

| Stage | Your deliverable | The runtime's job |
| --- | --- | --- |
| research | `brief.md` with evidence, a useful writer packet and `ready_for_review` or an exact blocker | Keep checkpoints, launch a separate research review |
| research_review | A structured decision with concrete evidence findings. No artifact edits | Record approval or ask for bounded focused research |
| images | `media.json` with verified source matches or documented missing targets. No uploads and no self-approved omissions | Launch image review |
| image_review | A structured decision, exact `accepted_missing` IDs and any source or placement findings. No artifact edits | Apply justified omissions, upload approved media, verify hosted bytes |
| writing | `final.json`. Media placement headings can change; approved sources, statuses and URLs can't | Sync placed images' headings and alt text, then launch a separate editorial review |
| editorial_review | A structured decision with draft quotes, assessments for each check and per-FAQ added-value evidence. No artifact edits | Write `editorial-review.md`, route one bounded correction and enforce technical checks |

- The stage prompt gives you the exact workspace, title, slug, sources and feedback. Use those paths even when an interactive skill shows a different workspace convention.
- Prior review approval in the prompt is backed by runtime state. A brief doesn't need an invented parent signature.
- The writing stage gets hosted media after upload. It doesn't write its own approval note or run a separate self-edit loop before review.
- Writing follows [the pipeline writing contract](../../bloxodes-article-writing/references/pipeline-writing.md), which starts with the voice guide (`.agents/skills/bloxodes-voice/SKILL.md`) and the article standard. Specialized tech and tier-list output contracts still apply.
- Editorial review judges the copy against the voice guide and the six checks in [editorial-review.md](../../bloxodes-article-writing/references/editorial-review.md): opening, completeness, structure, explanation, repetition and evidence.

## Decisions

Return the supplied JSON schema:

- `status`: `completed`, `needs_revision`, `blocked` or `skipped`
- `summary`
- `findings`
- `repair_stage`: `research`, `images`, `writing` or `null`
- `accepted_missing` IDs

The images stage's `repair_stage` is `research` or `null`, never `writing`. Only image review fills `accepted_missing`, using exact entry `id` values from `media.json`. Images are best effort: a reasonably searched miss gets accepted, and missing images never block an article.

Rules for the decision:

- `completed` has no unresolved findings and a `null` repair target.
- `needs_revision` needs specific findings and the right target.
- A completed writing result is a saved draft, not publication approval.
- Editorial review also returns `editorial_evidence` using its stage schema. Generic praise can't grant approval.
- The reviewer gets the retained repair findings and, for explicit experiments, the original user-requested outcomes and baseline path, even after the writer returns a completion summary.

How to review:

- Judge evidence, reader usefulness and the actual prose.
- Don't prescribe a universal outline, mandatory highlights, an FAQ count, a word count or a stock ending.
- A source leaving something out isn't a contradiction on its own. Judge credible single-source facts with the research skill's exception.
- A vague "check your tracker" can't fill a missing mandatory action.
- Local review traces are not public article templates.

## Recovery

**What gets saved.** The runtime saves `state.json`, per-attempt prompts, logs and decisions, input hashes and revision counts outside the article content directory. Every attempt also saves `timing.json`, including failures. `run-report.json` records measured active and wall time and CLI token usage.

**Resuming.** The runtime resumes an interrupted stage from saved artifacts and doesn't infer a stall from a quiet file. It owns the real stage and batch deadlines. A review task can't cancel another worker.

**Correction limits.**

- In the unattended workflow, each of research, images and writing gets one substantive correction, followed by review.
- Technical failures have bounded retry handling.
- The copy validator has one separate narrow correction after the substantive review. Image defects use the remaining writing revision.
- After every writing pass and localized edit, code syncs placed images' headings and alt text. Unused verified images keep their URLs and evidence, pass readiness and stay out of promotion and provenance sync. Image readiness runs locally even with `BLOXODES_CI_QA=1`; unresolved defects block locally once the writing revision is exhausted.
- Exhausted review or evidence problems need attention. They don't requeue themselves forever.

**Provider and operational failures.**

- A classified provider or operational failure keeps the failed stage and enters a three-hour backoff.
- At most two later operational resumptions are allowed, also subject to the queue attempt limit.
- Recovery keeps editorial revision counts and prior approvals.
- For a repaired technical failure, the manual `--retry-technical` flag can use an existing recovery attempt right away. It doesn't override provider or editorial blockers.
- Provider access failures pause the rest of the batch so untouched topics stay pending.
- Evidence and editorial blockers have no automatic retry date.

**Environment.** Technical upload, import and QA commands use `NODE_ENV=development` with an explicit process-only profile and validated managed-development credentials. Model workers keep their minimized environment.

**Approvals.** An artifact edited outside the pipeline can't inherit cached approval. Explicit user experiments can use a new reviewed run. Never edit runtime counters to give yourself more attempts.

**Where repairs go.**

- A prose defect reuses the approved brief and images.
- An evidence repair goes back to research review, then the affected task.
- An image repair goes back to image review and upload, then writing.

The runtime marks an article completed only after the copy, media, import and browser checks pass and editorial review accepts it.
