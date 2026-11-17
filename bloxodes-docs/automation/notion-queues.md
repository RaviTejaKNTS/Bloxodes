# Notion queues

Last verified: 2026-11-16

Five Notion databases coordinate the scheduled content runs. Agents read and update them through the Notion connector or the Notion API, neither of which deletes rows. So agents never delete rows; they set a status instead.

## Roblox Wiki Queue

- Database: https://app.notion.com/p/b49555b7263b44939d71da109e0b2cfa
- Data source: `collection://9e104b46-a080-49de-905c-667111aa47eb`
- Used by: the scheduled Roblox wiki run, and any manual Roblox wiki run.

This queue is a claim log, not a to-do list. It stops two runs from building the same game.

1. Pick the highest-ranked game in the live top 100 (`/api/stats/games?sort=playing`) that has no live wiki hub and no row here. Any row, whatever its status, means skip that game.
2. Before any research, add a row: Game, Universe ID, Rank, Status `In progress`, Device, Worktree, Started.
3. Query again. If an earlier row has the same Universe ID, set yours to `Duplicate` and take the next game.
4. When the hub and its collections are published and checked live, set `Done` with a short Run report, even if an extra code PR is still waiting for approval.
5. If the run stops early, set `Waiting for approval` or `Blocked` with a short Run report.

| Status | Meaning |
| --- | --- |
| `In progress` | A run is working on it. |
| `Done` | Published and checked live. |
| `Waiting for approval` | Stopped, waiting on the owner. |
| `Blocked` | Stopped on a problem. The Run report says what. |
| `Duplicate` | Another run claimed the same game first. |

## Other Games Queue

- Database: https://app.notion.com/p/5185dc698b5b47c698bc882dfdedb8d7
- Data source: `collection://3f3e6551-1fe9-4bc0-9dfa-e2ad78c5de8b`
- Used by: the Content Factory's scheduled franchise run (`franchise-wiki-main`).

New non-Roblox games only. The owner updates games we already cover (like ARC Raiders) by hand.

Rows come from the owner, or from the run itself: with no `Ready` row, the run finds one worthy uncovered game, writes its plan into a new row with Added by `Agent` and Priority 900, and builds it in the same run (see [franchise](../content/franchise.md#scheduled-run-macbook-pro-every-6-hours)). Owner `Ready` rows always come first. Added by is `Owner` or `Agent`; empty means the owner.

One row per game. Its page holds the whole approved plan: pages, URLs, sources and per-page notes. Don't split a game into several rows. A run follows the plan without re-planning. It builds the plan's wiki hubs and collections; other page types in the plan are listed in the Run report for a manual run. Skipped pages and the reasons go in the Run report.

| Status | Set by | Meaning |
| --- | --- | --- |
| `Planning` | Owner | Plan is still being drafted. Runs skip it. |
| `Ready` | Owner | Plan is final. The run takes the `Ready` row with the lowest Priority. |
| `In progress` | Run | Being built. A self-found row starts here; one left for more than 12 hours is taken back by the next run with no `Ready` row. |
| `Done` | Run | Everything planned is published. |
| `Waiting for approval` | Run | Hubs and collections are published, but the plan has other page types or code work left for the owner. |
| `Blocked` | Run | Stopped on a problem. |

The run also fills in Last run and a short Run report (thread, PRs, published URLs, open items).

Keep the `Template: duplicate this row` row. Copy it to add a new game.

## Codes Queue

- Database: https://app.notion.com/p/485d1be99ef6402c9a9e264249592e3a
- Data source: `collection://257a3425-d4f8-44c1-af56-4ac96a5bed07`
- Filled by: the homelab codes finder (`bloxodes-codes-discovery.timer`, through the Notion API with `NOTION_CODES_QUEUE_TOKEN`). See [codes](../content/codes.md#new-pages-homelab-finder-and-content-factory).
- Used by: the Content Factory's codes run.

One row per Roblox universe (`Universe ID`). Columns: Game, Universe ID, Place ID, Found on (`RobloxDen`, `Beebom`), RobloxDen URL, Beebom URL, Roblox URL, Found, Status, Run report, Live page, Claimed. The finder creates `New` rows and, while a row is still `New`, adds a source it finds later. It never changes a row's status. Run only one finder at a time: Notion can't enforce a unique Universe ID.

| Status | Set by | Meaning |
| --- | --- | --- |
| `New` | Finder | Waiting for the codes run. |
| `Claimed` | Codes run | Being built. Claimed holds the time. A `Claimed` row older than 12 hours was left by a run that stopped, and the next run takes it again. |
| `Published` | Codes run | Live. Live page holds the URL. |
| `Skipped` | Codes run | Not worth a page (for example a duplicate game or no working codes source). Run report says why. |
| `Failed` | Codes run | Couldn't publish. Run report says what. |

## Article Queue

- Database: https://app.notion.com/p/4197bc97c44381f9acb8e00d51ed7a12
- Data source: `collection://4197bc97-c443-8125-977a-000b7ede5751`
- Filled by: the homelab topic discovery (`bloxodes-article-discovery.timer`, `articles:curate`), and by the article run's own topics (`articles:queue:add`). Both use the Notion API with `NOTION_ARTICLE_QUEUE_TOKEN`. See [articles](../content/articles.md#topic-discovery-homelab).
- Used by: the Content Factory's article run, only through `articles:queue:list`, `articles:queue:add`, `articles:queue:update` and `content:publish` (the factory's `bin/article`). Don't edit rows by hand while a run holds them.

One row per topic. The CLI shows statuses in lowercase (`pending`) and row IDs as Notion page IDs. Columns: Title, Status, Type, Topic key, Idempotency key, Universe ID, Event ID, Source name, Source URL, Source URLs, Source published, Discovered, Curation model, Curation reason, Curation confidence, Curated, Attempts, Worker, Claimed, Retry after, Run report, Result slug, Result path, Live page, Completed, Published, Dev queue ID. The page body holds the full source evidence as JSON. Dev queue ID is set on rows copied from the old managed-development `article_generation_queue` table.

Duplicates are refused by topic key, idempotency key or a title similarity of 0.8 or more, against the queue and production articles. Notion can't enforce a unique key, so after each add, and at every curation run, duplicate groups are resolved: a `Completed` or `Published` row and an active `Processing` claim are always kept, and only unfinished duplicates become `Skipped` with Run report `duplicate`. If two finished rows in a group disagree, nothing changes and their IDs are logged for a person to check.

Curation never edits a `Completed` or `Published` row. Publishing checks that the row's Result path, Result slug and file hashes match the bundle before writing and again after marking it `Published`; a mismatch fails loudly and leaves the live page up. The `Snapshot` property names the committed evidence snapshot in the page body; older snapshots go to the trash (`in_trash`, Notion API `2026-03-11`). Queue pages themselves are never trashed.

| Status | Set by | Meaning |
| --- | --- | --- |
| `Pending` | Curation or run | Waiting to be written. |
| `Processing` | Article run | Being written. A claim older than 6 hours goes back to `Pending` at the next curation. |
| `Blocked` | Article run | Stopped for now; Retry after says when it goes back to `Pending`. |
| `Completed` | Article run | Written and checked; Result path holds the exact `final.json`. Publishing needs this. |
| `Published` | Publisher | Live, set only after the live check. Live page holds the URL. |
| `Skipped` | Run or curation | Dropped for good (overlap, no real angle, duplicate). Run report says why. |
| `Rejected`, `Failed` | Legacy | Kept for copied rows. |

### Claims

Notion can't update a row only if it hasn't changed, so claims (`--status processing`, and `add --claim`) on both article queues take a kernel lock on the machine (`tmp/article-queue/claims.lock` in the Bloxodes checkout, released when the process dies), write a unique claim token into Worker (`<worker>#<uuid>`), wait 2 seconds and read the row back. If another claim replaced the token, the claim fails. The claim prints `claim_token`, and marking the row `Completed` needs it (`--claim-token`), so only the run that claimed a row can finish it. Each factory run keeps its own token and passes it to `bin/article publish` or `game-publish`. A claim older than 6 hours, and a due `Blocked` row, can be claimed again.

### Duplicate topics

Adding a topic to either article queue (`articles:queue:add`, `game-articles:queue:add`) and curation also compare its meaning with the same game's live articles, wiki hub and collections and its queue rows (`scripts/articles/article-topic-similarity.ts`). The game's name and stopwords are dropped, words are stemmed, and task synonyms are grouped (get, obtain, unlock and farm; make money and earn cash; best, top and tier list; beat, defeat and kill; upgrade and level up; install mods). Two topics match only when they ask the same kind of task about the same subject, so "how to get X" and "how to use X" stay separate. A clear match is refused with exit code 3 and the closest pages are printed with scores and URLs. `articles:similar -- --title "<title>" (--universe-id N | --namespace X --game-slug Y --kind game|franchise)` shows the same scores without adding anything; the runs check every topic of their own with it first. Skipped and failed rows don't block a topic.

## Game Article Queue

- Database: https://app.notion.com/p/41a7bc97c443814ea0c8d2a90c611f76
- Data source: `collection://41a7bc97-c443-81fa-9567-000b9788bcfc`
- Filled by: the owner, by hand, and the Content Factory's game article run (`game-articles:queue:add`), through the Notion API with `NOTION_ARTICLE_QUEUE_TOKEN`, the same integration as the Article Queue.
- Used by: the Content Factory's game article run, only through `game-articles:queue:list`, `game-articles:queue:add`, `game-articles:queue:update` and `content:publish` (the factory's `bin/article game-*` commands).

Article topics for non-Roblox games, one row per topic. Columns: Title, Status, Game, Type (`guide`, `tier_list`, `explainer`, `news`), Added by (`Owner`, `Agent`), Namespace, Game slug, Game kind, Live page, Run report, Curation reason, Source URLs, Source URL, Source name, Curation model, Topic key, Idempotency key, Worker, Attempts, Curated, Claimed, Retry after, Completed, Published, Result slug, Result path, Snapshot. It uses the Article Queue's code with its own settings (`scripts/articles/game-article-queue.ts`), so claims, readback checks and duplicate handling work the same way.

To add a topic by hand: a new row with Title and Game, and Status `Pending` or empty. Type and notes in the page body are optional; the run reads the notes and picks the type if it's empty. An empty Added by means the owner. The run claims owner rows before anything else, fills in Namespace, Game slug and Game kind, and adds its own rows (Added by `Agent`) only when fewer than 3 good rows are waiting.

| Status | Set by | Meaning |
| --- | --- | --- |
| `Pending` (or empty) | Owner or run | Waiting to be written. |
| `Processing` | Game article run | Being written. A claim older than 6 hours is listed again and the next claim takes it back. |
| `Blocked` | Game article run | Stopped for now; Retry after says when it's listed again. |
| `Completed` | Game article run | Written and checked; Result path holds the exact `final.json`. Publishing needs this. |
| `Published` | Publisher | Live, set only after the live check. Live page holds the URL. |
| `Skipped` | Game article run | Dropped for good (duplicate, game not on Bloxodes, no real angle). Run report says why. |

A `game-article@1` bundle with a `queueId` is bound to its row like an `article@1` bundle: publishing needs the row `Completed` or `Published` with the bundle's namespace, game slug, kind and slug, and the exact `final.json` bytes at Result path. A bundle without `queueId` (articles written before the queue) still publishes without a row.

