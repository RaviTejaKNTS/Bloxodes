# Wiki and Collection Runs in T3 Code

Read this when the owner runs the collection runner or the wiki runner inside T3 Code and you have the T3 `delegate_task` tool. You're the orchestrator. Each stage goes to a fresh child agent on the model below. Luna builds anything that's evidence or data. Haiku 5.5 checks Luna's work and writes. Luna checks Haiku's writing. The homelab wiki automation (`wiki:homelab:run`) doesn't use this page and keeps its own model settings.

## Who runs each stage

| Stage | Provider instance | Model | Options |
| --- | --- | --- | --- |
| Collection suggestions | `codex` | `gpt-6-luna` | `reasoningEffort: max` |
| Collection research | `codex` | `gpt-6-luna` | `reasoningEffort: max` |
| Collection research review | `claudeAgent` | `claude-haiku-5-5` | `effort: xhigh` |
| Collection data | `codex` | `gpt-6-luna` | `reasoningEffort: max` |
| Collection data review | `claudeAgent` | `claude-haiku-5-5` | `effort: xhigh` |
| Collection images | `codex` | `gpt-6-luna` | `reasoningEffort: max` |
| Collection image review | `claudeAgent` | `claude-haiku-5-5` | `effort: xhigh` |
| Collection writing and the one revision | `claudeAgent` | `claude-haiku-5-5` | `effort: xhigh` |
| Collection editorial review | `codex` | `gpt-6-luna` | `reasoningEffort: max` |
| Wiki hub research | `codex` | `gpt-6-luna` | `reasoningEffort: max` |
| Wiki hub research review | `claudeAgent` | `claude-haiku-5-5` | `effort: xhigh` |
| Wiki hub writing and the one revision | `claudeAgent` | `claude-haiku-5-5` | `effort: xhigh` |
| Wiki hub editorial review | `codex` | `gpt-6-luna` | `reasoningEffort: max` |

- If a model ID stops resolving, check `orchestrator_capabilities`. Never swap in another model on your own. Ask the owner.
- Don't run a stage yourself, and don't hand two stages to one child. Each stage reads the previous stage's files.
- Every handoff is a new `delegate_task` call with its own `clientRequestId` (like `<run-id>-<collection>-data-r1`), stable across retries of that call. Keep each `taskId`.
- Children must not start sub-agents.

## Before you start

1. Take the game's claim: `npm run claim:shared-content -- --game <game-slug>`. Release it with `--release` when the run ends, blocked or not.
2. Confirm the game name, universe ID and editorial slug.
3. Create the run folder inside the checkout. Don't use `tmp/content-workspace`: it's a symlink outside the checkout, and child agents can't write through it.

```text
tmp/wiki-runs/<run-id>/<game-slug>/
  suggestions.md
  collections/<collection-slug>/
    brief.md  research-review.md
    dataset.json  runtime-manifest.json  data-review.md
    media/  image-review.md
    draft-final.json  editorial-review.md  final.json
    stage-log.md
  wiki/<game-slug>/
    brief.md  research-review.md
    draft-final.json  editorial-review.md  final.json
    stage-log.md
```

Children work only in their own collection or hub folder (suggestions write `suggestions.md`). They never read another run, `tmp/content-workspace`, `tmp/wiki-automation` or `tmp/model-test`. `stage-log.md` gets one entry per stage: model, start and end, result and problems.

## Collection flow

Skip the suggestions stage when the owner names the collections. Otherwise run it first, then every `[create]` collection. Collections can run in parallel, one stage at a time per collection.

1. **Suggestions** (Luna). Follow `.agents/skills/bloxodes-game-collection-suggestions/SKILL.md`. Output `suggestions.md`.
2. **Research** (Luna). Follow `.agents/skills/bloxodes-game-collection-research/SKILL.md`. Output `brief.md`, including the `database` or `collectible` page-type call.
3. **Research review** (Haiku). Check the brief against the research skill and the runner's "Research checks": is the collection worth a page, are the sections and fields useful to a player, is the page type right, and what do the top guides cover that the brief misses. Output `research-review.md` with a decision and findings. No artifact edits.
4. **Data** (Luna). Follow `.agents/skills/bloxodes-game-collection-data/SKILL.md`. Output `dataset.json` (v2) and `runtime-manifest.json`, and update the brief's data notes.
5. **Data review** (Haiku). Check against the runner's "Data checks": useful card fields, sensible sections, missing rows or fields, plain public values, and conflicting values handled by the data skill's "Conflicting sources" rule rather than left empty. Output `data-review.md`. No artifact edits.
6. **Images** (Luna). Follow `.agents/skills/bloxodes-game-collection-images/SKILL.md`. Save files into `media/` and wire the dataset image fields. If its shell can't reach an image host, Luna records the exact image URL and page in the brief's image notes and moves on. You download those files from the main shell into `media/` before image review.
7. **Image review** (Haiku). Open the images and confirm each one shows its exact item, using the runner's "Image checks". Output `image-review.md` with a decision, findings and accepted gaps. No artifact edits.
8. **Writing** (Haiku). Follow `.agents/skills/bloxodes-game-collection-writing/SKILL.md` and the voice guide. Read `dataset.json` for the real numbers, not just the brief. Output `draft-final.json`.
9. **Editorial review** (Luna). Check the copy against the dataset and brief: every useful number and pick backed by data, nothing invented, no count claims, the writing skill's rules and the runner's "Final checks". Use the six checks in `.agents/skills/bloxodes-article-writing/references/editorial-review.md` as the format. Output `editorial-review.md`. No artifact edits.
10. **Revision** (Haiku). A new writing task gets the draft, dataset, brief and editorial findings, and writes `final.json`. One revision only. Leave `draft-final.json` unchanged.

## Wiki hub flow

Run the hub after the collections, so it can link to the collections that passed.

1. **Research** (Luna). Follow `.agents/skills/bloxodes-wiki-research/SKILL.md`. Output `brief.md` and include the collections that passed in this run.
2. **Research review** (Haiku). Check identity, the core loop, controls proof, tip-worthy facts with real names and numbers, and related pages. Output `research-review.md`. No artifact edits.
3. **Writing** (Haiku). Follow `.agents/skills/bloxodes-wiki-writing/SKILL.md` and the voice guide. Output `draft-final.json`.
4. **Editorial review** (Luna). Check facts against the brief, verified controls only, concrete tips and the wiki runner's "Parent checks". Output `editorial-review.md`. No artifact edits.
5. **Revision** (Haiku). Writes `final.json` from the draft and findings. One revision only.

## Decisions and limits

- Every review returns `completed`, `needs_revision` or `blocked`, with concrete findings.
- On `needs_revision`, send the findings to a new task on the stage's own model (research, data and images go to Luna; writing goes to Haiku). One correction per stage, then one more review.
- A data or image gap found during editorial review goes back to the Luna data or images stage, then its Haiku review, then writing.
- `blocked` stops only that collection or the hub. Report the stage and the exact blocker.

## What every child brief says

- The stage, game name, universe ID, editorial slug and collection (when there is one).
- The exact folder and files to write, and the previous stage's files to read.
- The skills to read in full first. Writing and editorial review always include `.agents/skills/bloxodes-voice/SKILL.md`.
- Any findings to fix.
- Boundaries: stay in the folder; read-only web research is fine; no database writes, Supabase or R2 uploads, imports, publishing, claim commands, GitHub actions, commits, edits to tracked repo files, builds, tests or previews; no sub-agents; never ask for permission escalation, and log anything blocked in `stage-log.md`.
- What to return: the decision or output paths, a short summary and any problems.

## After the finals

The run stops at approved `final.json` files with their datasets, manifests and media. Staging a `roblox-collection` or `roblox-wiki` batch, `Managed content QA` on GitHub, managed-development publishing and production release each need the owner's explicit go-ahead.

Report per collection and for the hub: status, the stage reached, item and image counts, each review's main findings, and the folder path. Then release the claim.
