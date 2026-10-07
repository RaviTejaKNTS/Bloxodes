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

At the earlier release verification, installed runtime pointers remained `cfadab0db53575c235535234185cea5120b56e0a` for the article runtime and `34b925cca7788e7db83e58d640031e89ffe01cec` for the shared automation runtime. Their env, services and jobs were not changed or activated.

## Checklist QA and automation release

[PR #36](https://github.com/RaviTejaKNTS/Bloxodes/pull/36) merged as `97c8f0ff2caf1e870d2aa5727f90c7a45fd255c4` after the required checks and exact-head selective review passed. [Production run 37633307826](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37633307826) passed the guarded schema steps, deployment and exact-SHA web/database health.

The isolated [checklist QA run 37633349010](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37633349010) passed all 12 desktop/mobile tests. It verified the complete Roblox and shared-game boards, anonymous progress after reload, account progress after clearing local storage, and resetting progress. Full database readback and removal of the temporary development rows/accounts passed. No production fixture was created.

GitHub rejected the new publication workflow's job-level runner context after merge. [PR #37](https://github.com/RaviTejaKNTS/Bloxodes/pull/37) moved the receipt path to the publication step and added checksum-pinned workflow syntax validation. It passed independent review, exact-head selective review and required checks, then merged as `2956fb14f98e72116ade7afb14045ba11f3e9ffd`.

The corrected [publication verification run 37635486498](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37635486498) passed the reusable managed QA job, receipt artifact download, read-only production migration ledger, compatible live code, `/games` metadata/canonical/sitemap readback and desktop/mobile browser checks. The selected batch had zero operations and zero cache events with `apply=false`. It changed no production content.

The homelab services use `/usr/bin/node` 22.23.1. [PR #38](https://github.com/RaviTejaKNTS/Bloxodes/pull/38) corrected dependency packaging to Node 22, recorded the actual Node major and added the existing article/wiki helper tests before packaging. Required checks and both reviews passed. It merged as `12548cf8b56fb4be7fcb434d9f5c27d8ab154d83`. [Package run 37640614178](https://github.com/RaviTejaKNTS/Bloxodes/actions/runs/37640614178) passed on this exact SHA. The dependency artifact was downloaded directly to HDD and its source, lockfile, archive hash, platform and Node major passed operational verification before extraction. No local dependency install, platform check, test, build or browser QA ran.

The pre-existing article writer stopped by itself at 20:22:52 IST after image collection failed. Its saved work and retry state were retained. No job was interrupted to activate the new runtime. Runtime relocation copied approximately 12.7 GB across 163,990 existing article/wiki files to HDD. Full file hashes, owners, modes and old-path aliases matched before the retained source copy was removed. Historical runtime releases remain available for rollback.

The unified installer activated `12548cf8b56fb4be7fcb434d9f5c27d8ab154d83`. Operational readback confirmed the clean exact-SHA current pointer, all seven installed service files matching released source with HDD working directories and `BLOXODES_CI_QA=1`, and all five unchanged timer files, enablement and active states. Both protected env files retained their hashes, owner, group and mode. The original shared lease directory retained device 2051 and inode 2405610; the installation lease was released. Compatibility aliases resolve to HDD state, the previous runtime remains, and the dependency receipt records Node 22. Private baseline, copy and post-activation receipts remain under `/srv/data/bloxodes-automation-runtime/receipts` and `state-relocation.json`.

The final public deployment readback returned healthy database readiness with web SHA `97c8f0ff2caf1e870d2aa5727f90c7a45fd255c4`. PR37/38 changed scripts, workflows and documentation, so the production classifier correctly avoided a web rebuild. No real article or wiki batch was published as part of this verification. Temporary completion schedules were deleted.
