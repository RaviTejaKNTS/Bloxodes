# Interactive Article Workflow (Legacy Parent Review)

This is the parent review workflow for one article or a list of articles. You orchestrate separate research, image and writing subagents, approve each gate, review the copy as an editor, run verification and preview the rendered pages. Done means every approved article passed editorial review, the verifier and a real browser preview, and every queue row has its correct final status.

When `run-homelab-article-batch.ts` invokes this skill, run the workflow below directly in the current parent turn. Never call `articles:writer:batch` from inside this skill. The outer batch already owns the single-writer lock, the selected queue IDs and production release.

## Choose the inputs

Pick inputs in this order:

1. **The user supplied topics.** If the current message has one or more topics, article ideas, titles or source URLs, treat them as user-approved and work only on those. Don't query the generation queue to fill spare capacity. These are direct jobs, so don't update a queue row unless the user also gave its queue ID or asked to include queue work.
2. **The user asked for both.** If the user explicitly wants supplied topics and queued topics, do both in the order they asked.
3. **No topics supplied.** Load pending `agent_runner` leads from `article_generation_queue`:

```bash
npm run articles:queue:list -- --limit <candidate-window> --json
```

**How many to take.** If the user gives a count but no topics, that's the target. Otherwise the target is the number of research subagent slots available right now. Set `<candidate-window>` to up to three times the target, capped at 50, so you can skip unsuitable leads without running dry. Accept no more than the target. Leave the rest pending.

**What the queue gives you.** Queue listing returns only Groq-curated rows, newest `source_published_at` first. An eligible `agent_runner` row has already passed the Groq topic-type, owned-page-family, source-grouping and overlap filter. Still:

- Inspect the canonical title, grouped source URLs, source dates, curation reason and existing Bloxodes coverage before accepting a row for research.
- Check that the sources support accurate research before writing.
- Keep the queue ID and every grouped source URL for the whole job so the same skill can close the row when local work finishes.
- If no pending rows exist, report that the queue is empty. Don't invent substitute topics.
- If the queue can't be read, report the operational blocker. Don't quietly switch to topic suggestion.

**Homelab credentials.** On the Bloxodes homelab, queue commands resolve managed-dev credentials from `/etc/bloxodes/article-automation.env` automatically when the worker user can read it and no explicit article-dev credentials are set.

- Never print, quote or add the file's contents to a prompt.
- If the file exists but can't be read, report its ownership and mode without revealing values. The supported install is `root:teja` with mode `0640`.

### Externally claimed homelab writer jobs

When the current message says `scripts/articles/run-local-article-writer.ts` has already claimed the queue item:

- Treat the supplied title, type, queue reference and source packet as the one explicit approved input.
- Don't list, claim or update `article_generation_queue`. The wrapper owns managed-dev queue state, and Grok doesn't get production database credentials.
- Run the same separate research, mandatory image and writing-subagent workflow, with parent review at each gate, then the verifier, managed-dev Supabase import and real-browser preview.
- Check production overlap only with `npm run articles:inventory:production`. This GET-only path can't change production.
- Never publish or import the article to production. Normal `SUPABASE_*` variables point to managed dev on purpose in this mode.
- End with the structured status the wrapper asks for. Report `completed` only when `final.json`, verification, managed-dev import and the rendered preview all passed. Otherwise return `skipped`, `blocked` or `failed` with the actual reason.

## Roles

- Use separate research, image and writing subagents, one article each. The parent orchestrates, approves briefs and image readiness, reviews finals, runs verification and previews the rendered pages.
- If there are more ideas than subagent slots, queue the extras. Don't write them from the parent role. Start the next article with a new subagent only when another one finishes or frees up.
- If subagents aren't available, report the article as blocked. Don't quietly take over its research or writing.
- Use the configured writer model and reasoning effort for research, writing and editorial revision. In a Luna run, keep those stages on Luna. Don't silently pick Astra or add an editor agent. The existing parent owns review.

**The parent owns judgment, not prose.** You may make tiny non-content metadata or JSON fixes yourself: a slug, source URL, tag, `universe_id`, `author_id`, `cover_image`, a missing or null field, or a malformed JSON wrapper. Send tone, structure, body copy, FAQ copy and substantive claims back to the writing subagent. Send research gaps to the research subagent.

## Editorial contract

- Read [the article standard](../../bloxodes-article-writing/references/editorial-standard.md) and the voice guide (`.agents/skills/bloxodes-voice/SKILL.md`). Pass both to research, writing and review.
- Before approving any artifact, check the reader promise, outline, practical completeness and US localization.
- An explicit refresh of an existing article keeps the slug and doesn't claim or complete an unrelated queue row.
- If the user rejects the approved research premise, reopen that approval and rerun the affected research, parent review, media readiness, writing/revision and preview stages. Reuse source evidence and approved hosted assets where they're still valid. Keep the earlier draft and review as a baseline. An explicitly authorized rerun starts one new editorial revision allowance, recorded separately from the earlier run.

## Subagent progress and recovery

- **Judge progress from real activity:** the subagent's state, recent messages, tool activity and saved work. A missing or unchanged `brief.md` alone doesn't prove a stall. `running`, a wait timeout or an empty wait response doesn't mean the agent failed.
- **Keep waiting while work moves.** Use bounded individual waits so you stay responsive, but those wait intervals aren't task deadlines. Respect an explicit user or outer-run deadline. Don't invent a short per-agent deadline from repeated two-minute waits. Record a real deadline as a deadline, not a service outage.
- **Check before interrupting.** Look at the agent's recent activity with the available agent, status or history tools. If the wait tool only reports completion, use a read-only activity check instead of assuming silence. Ask for a short status and checkpoint without interrupting, then give it a fair chance to answer. "No blocker, I'm drafting" is a reason to continue, not to close it after another short wait.
- **Interrupt or replace a worker only for:** a concrete error, an explicit blocker, sustained lack of progress backed by successive activity checks and an unanswered status request, a real run deadline, or a user stop. Name the last productive action and the evidence for stopping. If you can't observe activity, say so honestly. Never diagnose an outage from missing visibility.
- **Prefer continuing or resuming the same researcher** with its gathered evidence. If you must replace it, hand the incomplete brief, source notes and permitted tool-output history to the replacement. Don't throw away finished research and repeat the same searches by default. Use the agent-control functions in this runtime. Never assume you can resume a child from a different parent.
- **Mark a queue row `blocked`** only for a concrete unresolved evidence or tool failure, or an evidenced stall after you tried recovery. Include the actual error or last activity and the recovery outcome. Don't turn a parent-imposed interruption into a claim that a research service failed. A reported blocker still needs the normal queue cleanup.

## Research subagent handoff

Tell the research subagent:

- You're the subagent for one article only.
- Don't run `/bloxodes-article-workflow-runner`.
- Don't create or call other subagents.
- Start with `/bloxodes-article-research`.
- Skill file: `.agents/skills/bloxodes-article-research/SKILL.md`.
- Save an early `Research status: in_progress` brief, checkpoint verified evidence as it builds up, and finish with `Research status: ready_for_review` before handing back. Return `brief.md` only and wait for parent approval.

## Image subagent handoff

After the parent approves `brief.md`, always run the separate image pass, with a new image subagent, before writing. Tell it:

- You're the image subagent for one article only.
- Don't write `final.json` and don't call subagents.
- Use `/bloxodes-article-images`.
- Skill file: `.agents/skills/bloxodes-article-images/SKILL.md`.
- Read the approved `brief.md`, define a nonzero expected set in `media.json`, search alternate wiki, official and guide sources for every unresolved target, host approved exact matches, update image readiness in `brief.md`, and stop for parent approval.

The parent then reviews:

- the expected count, exact matches and provenance
- missing reasons, with at least two distinct query variants and two checked source-page URLs for each proposed omission
- uploaded URL readback and readiness

Send search or mapping gaps back to the image subagent. Only the parent can accept a missing entry, and only after reliable, accurate, helpful images couldn't be found. An article can be image-free only when all planned targets are accepted missing.

## Writing subagent handoff

Start writing only after image readiness is approved. Use a new writing subagent. Don't reuse the research or image subagent.

Put these in the writer handoff:

- The reader goal and the hook or angle from the brief.
- One or two short, relevant before/after examples from `editorial-examples.md` or the voice guide examples, clearly labeled as illustrative prose, not extra facts. Include the reference path so the writer can read the explanation without rereading the whole style study.
- The paths to `brief.md` and `final.json`, the topic and article slugs, whether it's a normal, tech or tier-list article, and any parent approval notes.

Then tell the writer, for normal gameplay and general articles:

- Read the voice guide first: `.agents/skills/bloxodes-voice/SKILL.md` and the article section of `.agents/skills/bloxodes-voice/references/examples.md`. This is how the article should sound.
- Use `/bloxodes-article-writing`. Skill file: `.agents/skills/bloxodes-article-writing/SKILL.md`, including its [article standard](../../bloxodes-article-writing/references/editorial-standard.md).
- Read the approved `brief.md`, starting with its writing packet, and the approved `media.json`.
- Write the matching `final.json` as a first draft, then return it for review.
- Follow [the one-revision procedure](../../bloxodes-article-writing/references/editorial-review.md): the parent combines concrete feedback, and the same writer revises the file once. Don't run a separate self-edit loop before that feedback.

Swap the writing skill for special shapes:

- **Roblox tech, platform or troubleshooting articles:** use `/bloxodes-tech-article-writing` and apply its rules on top of the base article-writing rules.
- **Articles whose main job is ranking a complete set** of units, classes, weapons, abilities, items, characters or similar: use `/bloxodes-tier-list-writing`. Run the same mandatory image pass first. Prefer its visual overview when a complete exact-match image set exists. Use its text/table-first shape only when the unresolved image targets were explicitly accepted missing after the source search.

Resume the same writing subagent when copy changes are needed so it keeps the article context.

## Workspace

For each article:

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  final.json
  media.json        # required for every article; source, mapping, upload, and readiness state
  editorial-review.md  # parent findings, revision count, and acceptance; never public copy
```

Article-owned source images live in Supabase Storage under `articles/<article-slug>/sources/`. Never add them to the repo or hotlink third-party hosts.

## Workflow

1. Resolve inputs with [Choose the inputs](#choose-the-inputs). Confirm direct user-supplied ideas. For queue-backed work, inspect the source lead and existing Bloxodes coverage first. Mark a duplicate, a codes article, an unsupported lead or a topic with no useful angle `skipped` with a short reason.
2. Mark each accepted queue-backed lead `processing` before research starts:

   ```bash
   npm run articles:queue:update -- --queue-id <uuid> --status processing --worker <worker-name> --apply
   ```

3. Start one research subagent per article. Queue extras when slots are full.
4. Require each research subagent to use `/bloxodes-article-research` and return `brief.md` only.
5. Review each brief with [Brief review](#brief-review). Don't approve weak research just because the angle sounds good.
6. Send research feedback to the same research subagent, or approve the brief.
7. Start a new image subagent for every approved brief. Review and approve `media.json` and the updated image-readiness block before writing. If coverage is weak and the search is incomplete, send it back to the image subagent or block the article.
8. Once research and image readiness are approved, start a new writing subagent with the normal, tech or tier-list writing skill.
9. Review the draft with [Final article review](#final-article-review): the six checks in [the editorial review procedure](../../bloxodes-article-writing/references/editorial-review.md), read against the voice guide. Record concrete feedback and have the same writer do one revision. Reread the revised file and require editorial approval before import or completion. Fix only tiny non-content metadata or JSON issues yourself. Keep and flag unresolved problems after the bounded pass.
10. Start or reuse the local web server with `npm run dev:managed`.
11. Run the batch verifier on reviewed final files. It needs a sibling `media.json` for every article. Send copy failures to the writing subagent, source gaps to the research subagent, and image coverage or mapping failures to the image subagent.
12. Run the deterministic rendered-browser check for every verified final:

    ```bash
    npm run verify:article-browser -- --base-url http://localhost:<port> --file <final.json> --file <final.json>
    ```

    - It launches the installed headless Chrome or Chromium through Playwright, opens the real localhost route, scrolls to trigger lazy media, and requires every article-body image to finish with nonzero dimensions.
    - In unattended homelab runs, an empty product/browser-agent list is expected when the desktop browser bridge isn't attached. Don't block for that alone. Use `verify:article-browser` and report its actual result.
    - An HTML fetch, an image URL or browser-agent availability is not proof of rendered-page verification.
13. Right after an article passes both verification and the rendered browser preview, mark its queue row `completed`:

    ```bash
    npm run articles:queue:update -- --queue-id <uuid> --status completed --result-path <final.json> --apply
    ```

14. Return approved paths, localhost article links, queue outcomes, blocked articles and remaining risks.

### Queue statuses

| Status | When | How |
| --- | --- | --- |
| `skipped` | A deliberate editorial rejection, like existing coverage or no useful, source-backed angle. Never for a temporary image-search or media-service failure | `npm run articles:queue:update -- --queue-id <uuid> --status skipped --reason "<concise reason>" --apply` |
| `blocked` | A row this runner claimed hit a temporary evidence, tool, browser, media or service failure. The homelab batch returns due blocked rows to pending with bounded attempts | `npm run articles:queue:update -- --queue-id <uuid> --status blocked --reason "<concise reason>" --retry-after-minutes 180 --apply` |
| `blocked` (externally claimed one-row homelab job) | Same kinds of failure | Return `blocked` in the structured result and let the wrapper apply backoff |
| `failed` | Only an unrecoverable workflow failure | Structured result |
| `completed` | Editorial acceptance, the verifier and a real browser preview all passed | See step 13 |

Never mark a row `completed` just because `final.json` exists. If the one revision still needs attention, keep the review note and artifacts, report the defect, and use the existing blocked/backoff handling. Never reset the recorded revision count on automatic recovery to start another polish loop.

## Brief review

An `in_progress` brief is a checkpoint, not approved research. Require an explicit completion handoff and a `ready_for_review` brief before approving the image or writing stages.

**Coverage and sources**

- Existing Bloxodes coverage was actually checked.
- Related page-type overlap is handled.
- The sources support the angle.
- For a Roblox micro-guide, source discovery used more than one query style and more than one surface.
- Any "few sources" claim is backed by documented fallback checks, not one polluted or empty search.
- The brief separates sources found, sources used for exact facts, unusable sources and search limitations.
- Sources that look independent were checked for shared ancestry.

**Promise and completeness**

- Game-specific titles and slugs include the game name.
- The public title promise matches the supported procedure. A how-to has source-backed actions and completion conditions for every mandatory stage, including tasks after a payment or trainer interaction.
- "Complete the questline" or "follow the Logbook" doesn't hide missing essential instructions, and a private "narrowed promise" note never excuses an unchanged full-unlock title.
- The outline answers the title, gives each major subject one home and uses natural topic or action headings, with no count cap.
- Facts to avoid are named, and open gaps are honest.

**Writing packet**

- It separates usable facts, actionable uncertainties and private evidence notes.
- Every prerequisite and resource has the acquisition detail it needs. Central gaps are resolved or the promise is narrowed.
- Facts read as plain player statements, with a clear reader question and angle. Research jargon stays in the private notes (see `bloxodes-voice`).
- Community sourcing alone doesn't force repeated public caveats.
- Audience is US, with American English and date-aware ET/PT for relevant verified times.

**Media plan**

- A nonzero expected visual target set is defined before image discovery.
- Complete visual topics include every useful target. Normal articles include the one to three highest-value targets.
- Image candidates are mapped by target with exact-match evidence, source URL and usage or source notes.
- Images are clean, exact matches from reliable source pages, with provenance and any explicit attribution condition recorded.

If the brief is weak, ask for more research or mark the article blocked.

## Final article review

Use [the one-revision procedure](../../bloxodes-article-writing/references/editorial-review.md) for the draft, combined feedback, revision and final acceptance. Read the copy as a player first, against the voice guide (`.agents/skills/bloxodes-voice/SKILL.md`) and the article standard, then trace the reader's task through the brief. Record the result in `editorial-review.md`. A writer's self-report or a technical pass doesn't prove editorial quality. Existing finals being revised go through the same bounded procedure with their approved facts and media, not fresh research by default.

Also check against the Writing Rules in `bloxodes-article-writing/SKILL.md`. Group your findings by the six checks:

**Opening**

- The first sentences hand over the topic, action, problem or payoff and answer the title. No restated title, no throat-clearing.

**Completeness**

- `content_md` fulfills the public title, not just the approved brief. Reject a central omission even if the brief approved it earlier.
- `content_md` answers the approved brief, and each feature includes the practical details readers need.

**Structure**

- The headings alone form a useful map. Major headings name the game or system and the search intent. Contextual H3s can be shorter, and heading shapes vary.
- Every section adds value. Paragraphs develop one connected idea with comfortable spacing. No hard sentence-count ceiling cuts an explanation short.
- List and step items are short, one action or fact each, not paragraphs crammed into a bullet.
- Fix and troubleshooting articles give each fix its own H3, not one long nested-bullet list. No deep bullet-in-bullet hierarchies.
- Tables have useful interpretation, and the ending answers a remaining decision or next action instead of recapping.
- Compare the closest format in the [Beebom study](../../bloxodes-article-writing/references/beebom-style-study.md). Reject thin feature summaries even when technical checks pass.

**Explanation (voice)**

- It sounds like the voice guide: plain words simple enough for Roblox players, short clean sentences with natural variety, real game nouns, and a bit of personality where it fits. Calm in troubleshooting.
- Run-ons are split while keeping useful cause and effect.
- No manual voice, research voice, hype, filler or forced jokes. Firsthand experience is never invented.
- No public copy mentions research workflow, source gathering, database checks or internal notes. Internal refresh timestamps and database evidence stay in the brief.
- Public dates and times serve US readers.

**Repetition**

- A short summary that leads into detail is fine. Repeated body explanations, blanket caveats, decorative links and redundant FAQs come out.
- No fix, cause or explanation repeats across sections.
- `faq_json` answers useful follow-up questions without repeating the body.

**Evidence**

- Facts are verified and accurate: no invented menu paths, no impossible actions, and never telling readers to play Roblox in a web browser (the in-browser player is discontinued).
- No unsupported claims, vague wording or page-type overlap.

**Technical and media**

- `final.json` parses.
- Title, slug, meta, tags, sources and universe ID make sense. Game-specific titles and slugs include the game name. Add `Roblox` when it helps readers understand the topic.
- Links are useful, not decorative.
- Videos are perfect matches and use `{{ youtube: ... }}`, not leftover raw links.
- Body images are clean, use verified Bloxodes-hosted paths, have useful alt text and sit next to the content they show. Tier-list articles may reuse canonical game or collection assets under `apps/web/public`.
- Every article matches its sibling `media.json`: expected, verified, uploaded, inserted, missing and accepted-missing counts reconcile, with every image under its planned heading or in its row.
- Body images are left out only when all planned targets are accepted missing because no reliable, accurate, helpful image was found.

After this review, run the batch verifier on the files that look ready.

- Writing, copy, tone, body and FAQ failures go to the writing subagent.
- Research or accuracy gaps go to the research subagent.
- You may fix verifier failures yourself only when they're small non-content metadata or JSON issues: a wrong slug, malformed JSON, a source URL typo, tag cleanup, a missing `universe_id`, or an import-required null or default field.

## Local preview

Before the final output, preview every approved article on the real local route in an actual browser.

Use whatever browser control or automation this environment has. Prefer Chrome or Chromium. With only terminal tools, use the repo's Playwright package with an installed Chrome or Chromium. Don't depend on a product-specific browser name.

1. Start or reuse the local web server with `npm run dev:managed`.
2. Open the sibling `media.json` and every hosted public URL, and confirm each image loads. Article-owned images must use Supabase Storage. Tier lists may reuse canonical game or collection assets under `apps/web/public`.
3. Run the verifier. Image readiness is mandatory:

   ```bash
   npm run verify:article-finals -- --base-url http://localhost:<port> --file <final.json> --file <final.json>
   ```

   Use one `--file` per approved article and the actual localhost port the dev server shows.

4. If the verifier fails, send writing, JSON or copy output to the writing subagent, and source or brief gaps to the research subagent.
5. If it passes, open every verified `/articles/<slug>` link in Chrome, Chromium or another real browser.
6. Check the page title, article body, author and cover behavior, and obvious layout issues.
7. Confirm embeds render as players, not raw syntax, and body images load next to the right content.
8. On the homelab, return Tailscale links using `http://teja-homelab.tail13b5bd.ts.net:3000` (direct-IP fallback `http://100.86.117.125:3000`). Verify they're reachable and bind the preview to `0.0.0.0`. Elsewhere, return the actual reachable preview base.

If the deterministic browser check fails, mark the affected row blocked with the command's actual reason. Never claim browser verification from an HTML fetch alone.

## Final output

Return:

- brief paths
- `final.json` paths
- `media.json` paths and image readiness counts for every article
- reachable preview links (Tailscale on the homelab)
- approved articles
- blocked articles and why
- verification done, including `verify:article-finals` and the browser used for the rendered preview
- remaining risks
- queue ID and final queue status for every queue-backed article
