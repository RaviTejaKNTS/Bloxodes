# Notion queues

Last verified: 2026-10-19

Two Notion databases coordinate the nightly content runs. Agents read and update them through the Notion connector, which can't delete rows. So agents never delete rows; they set a status instead.

## Roblox Wiki Queue

- Database: https://app.notion.com/p/b49555b7263b44939d71da109e0b2cfa
- Data source: `collection://9e104b46-a080-49de-905c-667111aa47eb`
- Used by: the nightly Roblox wiki run, and any manual Roblox wiki run.

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
- Used by: the nightly franchise run.

New non-Roblox games only. The owner updates games we already cover (like ARC Raiders) by hand.

One row per game. Its page holds the whole approved plan: pages, URLs, sources and per-page notes. Don't split a game into several rows. A run follows the plan as `bloxodes-franchise-plan` describes, without re-planning, and keeps going until every page is built or skipped by its gate, even if that takes days. Skipped pages and the reasons go in the Run report.

| Status | Set by | Meaning |
| --- | --- | --- |
| `Planning` | Owner | Plan is still being drafted. Runs skip it. |
| `Ready` | Owner | Plan is final. The run takes the `Ready` row with the lowest Priority. |
| `In progress` | Run | Being built. |
| `Done` | Run | Everything planned is published. |
| `Waiting for approval` | Run | A code PR is open for the owner. |
| `Blocked` | Run | Stopped on a problem. |

The run also fills in Last run and a short Run report (thread, PRs, published URLs, open items).

Keep the `Template: duplicate this row` row. Copy it to add a new game.
