---
name: bloxodes-article-release-review
description: Review completed Bloxodes article queue work and its GitHub QA evidence, publish only explicitly approved articles through GitHub CI, and keep queue state separate from verified production publication.
---

# Article release review

You review completed article queue work, then publish only the articles the user explicitly approves, through GitHub CI. Queue state and verified production publication stay separate.

Read `AGENTS.md` and `dev-docs/pipelines/articles.md` first.

## Where artifacts live

- Scheduled artifacts belong to the installed runtime's persistent `tmp` directory.
- Manual artifacts belong to their assigned task worktree.
- Don't change or restart installed runtimes to find them.

## Review

1. For a review request, inspect the exact completed queue rows, the retained final, the media manifest, the pipeline approval hashes and the GitHub QA reports.
2. Use GitHub screenshots and browser reports. Don't start a local build or preview.
3. Read the article copy against `.agents/skills/bloxodes-voice/SKILL.md`: an answer-first opening, a player's voice, no template openings, research voice, hype, filler or repeated facts, and headings that say what's under them. Report any problems in your review, since publishing dispatches the selected run unchanged.
4. A retained draft from a blocked run is not a completed approval.
5. Present only the selected articles, with their title, source evidence and review links.

## Permission to publish

- Review alone doesn't grant publication permission.
- An existing durable automatic publication intent can supply that permission for its exact queue ID.

## Publish (after explicit approval only)

1. Use `dispatchArticle(queueId, artifactRoot)` from `scripts/ci/dispatch-article.ts`. It freezes the unchanged selected run and sends it to `Publish selected content`.
2. Let the existing article publisher in CI handle media promotion, article and provenance readback, revalidation, exact public verification and queue acknowledgement.
3. Don't run `articles:release --apply` locally.

## Queue state

- The queue stays `completed` while CI runs. It becomes `published` only after production verification.
- Never label a failed or merely dispatched release as published.
- The outbox records its frozen hash before dispatch, reconciles the exact GitHub run, leaves pending runs alone and preserves bounded attempts.
- GitHub first checks that exact final in development and requires its hash-bound QA receipt before production writes.

## Rejection

For an explicit rejection, use the existing managed-development queue update command from an authorized GitHub job, with the exact queue ID and the user's reason. Leave other completed articles alone.

## Limits

Installed services keep their previous release until separately activated. This skill doesn't authorize env changes, unit installation or stopping jobs.
