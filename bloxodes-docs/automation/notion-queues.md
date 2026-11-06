# Notion queues

Last verified: 2026-11-06

Three Notion databases coordinate the scheduled content runs. Agents read and update them through the Notion connector, which can't delete rows. So agents never delete rows; they set a status instead.

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

One row per game. Its page holds the whole approved plan: pages, URLs, sources and per-page notes. Don't split a game into several rows. A run follows the plan without re-planning. It builds the plan's wiki hubs and collections; other page types in the plan are listed in the Run report for a manual run. Skipped pages and the reasons go in the Run report.

| Status | Set by | Meaning |
| --- | --- | --- |
| `Planning` | Owner | Plan is still being drafted. Runs skip it. |
| `Ready` | Owner | Plan is final. The run takes the `Ready` row with the lowest Priority. |
| `In progress` | Run | Being built. |
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
