# GitHub release audit, October 7, 2026

Date: 2026-10-07
Scope: the GitHub release/worktree migration and verification-only content canary. This records execution evidence, not the current operating contract. The current flow belongs to [the deployment guide](../dev-docs/operations/deployment.md).

## Development and PR evidence

[PR CI run 37569597377](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37569597377) passed the history repair, all seven development readiness checks, tests, build and desktop/mobile browser checks at `631a8c3cb6caa53b9bf217d7b5403775fbd7dfa2`. Readback confirmed all 13 canonical records, all 13 original records and absent legacy tables. The final publication safeguards passed [PR CI run 37574740753](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37574740753) at `3e6638b18a3aa483ad741d1d228536b3f76c8345`, including migration byte proof, queue/artifact binding and wiki dispatch recovery tests. Desktop/mobile browser artifacts expire after one day.

## Release and canary receipts

[PR #30](https://github.com/RaviTejaKNTS/Bloxodes/pull/30) merged as `c199d39ac3bc03d37aec9c55aee13f0b2bb4cbaa` after required checks and completed automated review. [Production run 37575599220](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37575599220) passed managed-development readiness, the guarded Studio production schema job, image publication, exact-SHA web/database health, targeted cache purge and live smoke. Both databases had no pending migrations, so this release changed no production schema.

The main checkout fast-forwarded cleanly to this SHA. Its tracked T3 actions now use lightweight setup and GitHub PR/check links. The prior ignored T3 config was preserved in `/tmp/bloxodes-task30-t3-before-release.json`. GitHub deleted the merged remote branch. Production protection and the production-only environment policy were read back. The active task checkout remains attached to T3; cleanup waits until T3 releases it.

The verification-only [content run 37576589509](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37576589509) stopped before its ledger command because the production environment made npm omit the development-only `tsx` package. The content workflow now installs locked development dependencies explicitly with `npm ci --include=dev`. It keeps production mode for the guarded publishers and performs no local install. No content operation or revalidation ran in the failed canary.

The install correction passed [PR #31](https://github.com/RaviTejaKNTS/Bloxodes/pull/31) checks and completed review with no findings, then merged as `868acaf2ce30a4099097cf2883dbae1574afce65`. Its [production classification run 37577903746](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37577903746) correctly skipped schema application and image rebuilding. The live image remains the healthy `c199d39ac3bc03d37aec9c55aee13f0b2bb4cbaa` release.

The corrected verification-only [content run 37577949157](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37577949157) passed the exact-current-production gate, read-only production migration-ledger gate, compatible-live-code gate, `/games` text/metadata/canonical/sitemap checks and desktop/mobile Chromium checks. The batch contained zero operations and zero cache events, with `apply=false`. It created or changed no content, media, queue receipt or revalidation event. Browser reports expire after one day. Actual content publication still requires an explicit approved batch; this canary verifies the workflow without testing a real write.

Installed runtime pointers remain `cfadab0db53575c235535234185cea5120b56e0a` for the article runtime and `34b925cca7788e7db83e58d640031e89ffe01cec` for the shared automation runtime. Their env, services and jobs were not changed or activated.

