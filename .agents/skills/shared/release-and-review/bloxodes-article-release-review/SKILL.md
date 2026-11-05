---
name: bloxodes-article-release-review
description: Review completed Bloxodes article queue work, publish only explicitly approved articles with content:publish, and keep queue state separate from verified production publication.
---

# Article release review

You review completed article queue work, then publish only the articles the user explicitly approves, with `content:publish`. Queue state and verified production publication stay separate.

Read `AGENTS.md` and `bloxodes-docs/content/articles.md` first.

## Where artifacts live

- Scheduled artifacts belong to the installed runtime's persistent `tmp` directory.
- Manual artifacts belong to their assigned task worktree.
- Don't change or restart installed runtimes to find them.

## Review

1. For a review request, inspect the exact completed queue rows, the retained final, the media manifest, and the pipeline approval hashes.
2. `content:publish` has its own checks but no browser report, so don't wait for one. Don't start a local build or preview.
3. Read the article copy against `.agents/skills/bloxodes-voice/SKILL.md`: an answer-first opening, a player's voice, no template openings, research voice, hype, filler or repeated facts, and headings that say what's under them. Report any problems in your review, since publishing sends the selected bundle unchanged.
4. A retained draft from a blocked run is not a completed approval.
5. Present only the selected articles, with their title, source evidence and review links.

## Permission to publish

- Review alone doesn't grant publication permission.

## Publish (after explicit approval only)

1. Publish the approved `article@1` bundle from the up-to-date main checkout: `npm run content:publish -- --bundle <absolute-folder> --target production --apply --allow-prod`. Add `--update-published` to change an article that's already live.
2. The publisher handles media promotion, article and provenance readback, revalidation, exact public verification and queue acknowledgement.

## Queue state

- The queue stays `completed` until the publisher finishes production verification. Only then does it become `published`.
- Never label a failed or merely dispatched release as published.
- `content:publish` has no browser check. Open the live page at desktop and phone widths yourself.

## Rejection

For an explicit rejection, use the existing managed-development queue update command from an authorized GitHub job, with the exact queue ID and the user's reason. Leave other completed articles alone.

## Limits

Installed services keep their previous release until separately activated. This skill doesn't authorize env changes, unit installation or stopping jobs.
