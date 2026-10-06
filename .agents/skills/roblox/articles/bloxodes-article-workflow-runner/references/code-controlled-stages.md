# Code-controlled article stages

Use this when the runtime assigns one stage or supplies ARTICLE_PIPELINE_STAGE. It overrides interactive parent/subagent and standalone self-review instructions for that invocation. Keep the shared editorial standard and page-type output contracts.

The runtime runs research → research review → image selection → image review → upload/readback → writing → editorial review → copy/media checks → managed-development import/readback → browser verification. Models perform the assigned judgment or authoring task only. The runtime owns process lifetimes, deadlines, retries, stage transitions, approval records, queue status and release eligibility. Native subagent tools are disabled. Do not launch another model, manage processes, call workflow runners, inspect env/auth files, or change queue/database state.

## Ownership

| Stage | Model deliverable | Runtime responsibility |
| --- | --- | --- |
| research | brief.md with evidence, useful writer packet and ready_for_review or exact blocker | Retain checkpoints; launch a separate research review |
| research_review | Structured decision and concrete evidence findings; no artifact edits | Record approval or request bounded focused research |
| images | media.json with verified source matches or documented missing targets; no upload or self-approved omissions | Launch image review |
| image_review | Structured decision, exact accepted_missing IDs, and any source/placement findings; no artifact edits | Apply justified omissions, upload approved media, verify hosted bytes |
| writing | final.json; media placement headings may change, but approved sources, statuses and URLs may not | Launch a separate editorial review |
| editorial_review | Structured decision with draft quotations, criterion assessments and per-FAQ added-value evidence; no artifact edits | Write editorial-review.md, route one bounded correction and enforce technical checks |

The stage prompt supplies the exact workspace, title, slug, sources and feedback. Use those paths even when an interactive skill shows a different workspace convention. Prior review approval in the prompt is backed by runtime state; a brief does not need an invented parent signature. The writing stage receives hosted media after upload and does not write its own approval note or perform a separate self-edit loop before review. Specialized tech/tier output contracts still apply.

## Decisions

Return the supplied JSON schema: status (completed, needs_revision, blocked, skipped), summary, findings, repair_stage (research, images, writing, or null), and accepted_missing IDs. A completed result has no unresolved findings and a null repair target. A revision needs specific findings and an appropriate target. A completed writing result is a saved draft, not publication approval. Editorial review additionally returns editorial_evidence using its stage schema; generic praise cannot grant approval. The reviewer receives retained repair findings and, for explicit experiments, the original user-requested outcomes and baseline path, even after the writer returns a completion summary.

Review evidence, reader usefulness and actual prose. Do not prescribe a universal outline, mandatory highlights, FAQ count, word count or stock ending. Source omissions alone are not contradictions; evaluate credible single-source facts using the research skill's exception. A vague tracker referral cannot fill a missing mandatory action. Local review traces are not public article templates.

## Recovery

The runtime saves state.json, per-attempt prompts/logs/decisions, input hashes and revision counts outside the article content directory. Every attempt also saves timing.json, including failures; run-report.json records measured active/wall time and CLI token usage. It resumes an interrupted stage from saved artifacts and does not infer a stall from a quiet file. It owns actual stage and batch deadlines. A review task cannot cancel another worker.

One substantive correction per research/images/writing stage is allowed in the unattended workflow, followed by review; technical failures have bounded retry handling, and one separate narrow correction per copy/image validator remains available after the substantive review. Exhausted review or evidence problems require attention and do not requeue themselves forever. A classified provider or operational failure retains the failed stage and enters a three-hour backoff; at most two later operational resumptions are allowed, also subject to the queue attempt limit. Recovery preserves editorial revision counts and prior approvals. For a repaired technical failure, the manual --retry-technical flag can consume an existing recovery attempt immediately; it does not override provider/editorial blockers. Technical upload/import/QA commands use NODE_ENV=development with an explicit process-only profile and validated managed-development credentials, while model workers retain their minimized environment. Provider access failures pause the remaining batch so untouched topics stay pending. Evidence/editorial blockers have no automatic retry date. An externally edited artifact cannot inherit cached approval. Explicit user experiments can use a new reviewed run; never edit runtime counters to grant yourself more attempts.

A prose defect reuses the approved brief and images. An evidence repair returns to research review and then the affected task. An image repair returns to image review/upload and then writing. Successful copy/media/import/browser checks and editorial acceptance are all required before the runtime marks an article completed.
