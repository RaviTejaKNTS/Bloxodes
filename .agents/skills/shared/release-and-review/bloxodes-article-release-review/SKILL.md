---
name: bloxodes-article-release-review
description: Review completed Bloxodes article queue work and its GitHub QA evidence, publish only explicitly approved articles through GitHub CI, and keep queue state separate from verified production publication.
---

# Article release review

Read `AGENTS.md` and `dev-docs/pipelines/articles.md`. Scheduled artifacts belong to the installed runtime's persistent `tmp` directory. Manual artifacts belong to their assigned task worktree. Do not change or restart installed runtimes to find them.

For a review request, inspect the exact completed queue rows, retained final, media manifest, pipeline approval hashes and GitHub QA reports. Use GitHub screenshots and browser reports. Do not start a local build or preview. A retained draft from a blocked run is not a completed approval.

Present only the selected articles with their title, source evidence and review links. Review alone does not grant publication permission. An existing durable automatic publication intent can supply that permission for its exact queue ID.

After explicit approval, use `dispatchArticle(queueId, artifactRoot)` from `scripts/ci/dispatch-article.ts`. It freezes the unchanged selected run and sends it to `Publish selected content`. Use the existing article publisher in CI for media promotion, article/provenance readback, revalidation, exact public verification and queue acknowledgement. Do not run `articles:release --apply` locally.

The queue stays `completed` while CI runs. It becomes `published` only after production verification. A failed or merely dispatched release must not be labelled published. The outbox records its frozen hash before dispatch, reconciles the exact GitHub run, leaves pending runs alone and preserves bounded attempts. GitHub first checks that exact final in development and requires its hash-bound QA receipt before production writes.

For an explicit rejection, use the existing managed-development queue update command from an authorized GitHub job, with the exact queue ID and the user's reason. Leave other completed articles alone.

Installed services keep their previous release until separately activated. This skill does not authorize env changes, unit installation or stopping jobs.
