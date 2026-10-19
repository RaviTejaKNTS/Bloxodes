---
name: bloxodes-franchise-game-collection-images
description: Gather, save, wire, and verify exact item images for one approved non-Roblox franchise collection after data approval. Do not write final.json or publish production.
---

# Bloxodes Franchise Game Collection Images

You're finding and wiring a clear image for every item in one approved game collection, so players can recognize what they're looking at. You're done when every verified match is saved and wired, every gap is recorded with a reason, required image coverage is complete, the GitHub checker has run, and `brief.md` has a filled-in `Image readiness` section.

> **You are a subagent. Do NOT spawn sub-agents or call other agents. Download images and edit dataset files directly using Bash and the Edit/Write tools.**

Use the game and collection names to find their suggestions and workspace in the inherited task context, or use the default workspace. Keep any supplied workspace override. This skill owns its stage. Return the stage artifacts when you're done.

Run this after `brief.md` and data readiness are approved. Images get their own authoring pass before writing. Save staging media under the collection workspace. The parent verifier uploads and verifies immutable R2 media keys before the database-backed route can render them.

**Before you start:** read `bloxodes-docs/content/franchise.md` (identity, routes, tables and the rules every franchise page follows) and `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images and layout). Public copy and writer briefs follow `.agents/skills/bloxodes-voice/SKILL.md`.

## Useful coverage

Build the most accurate, up-to-date collection the sources support. Combine rows across sources and merge duplicates. When sources disagree on a value, use the better-supported one or a range, as the data skill's "Conflicting sources" rule says. Leave a value empty or null only when no reliable source gives one. Record missing rows, conflicting claims and follow-ups in the brief so the collection can improve later.

A source saying 97 items while listing 98, an incomplete roster, no official confirmation or uncertain update coverage aren't reasons to block on their own. Don't invent facts or claim complete live coverage. Block only when there truly isn't enough supported material for a worthwhile player-facing page.

## Steps

Checks below run on GitHub, never locally. Local work is research and authoring.

1. Read the approved `brief.md` and dataset.
2. Confirm which items need images and which dataset field stores the image path.
3. Find clear item images (see "What a good image looks like").
4. Save images under `<workspace>/media/` for the game and collection.
5. Update the dataset image field for each matched item.
6. If an image is missing, record the exact item and why.
7. Don't use `npm run collect:collection-images` for workspace collections. It's a legacy tool that only writes into `apps/web/public` and emits public-root paths, which this skill forbids. Save each image into `<workspace>/media/` yourself and set the dataset image field to its path relative to the runtime manifest's `mediaRoot` (like `first-rebirth.webp`). Updating the collector for workspaces is a separate code task.
8. When this collection should have images, run the readiness check with images required:

   ```bash
   npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json --require-images
   ```

9. Update `brief.md` with image readiness (see "Image Approval Notes").

Never save collection data or staging media under `data/` or `apps/web/public/`.

## What a good image looks like

**Where to look**

- Prefer official or game-wiki-style images when they exist.
- Use official publisher/developer media, manuals, store art, real gameplay captures, Fandom, Game8, Pro Game Guides and dedicated game wikis when they have usable exact images. Record credit with the source page and direct image URL in `images.json`. Match the edition, platform, mode, release generation and exact item; never use generic game art as an item image.
- Search beyond the roster source for exact-item images.
- User- or parent-approved direct item-image sources are fine when their images clearly match the exact game. Keep source or licensing caveats in the brief instead of silently dropping usable coverage.

**Keep or reject**

- Keep images that clearly show the item.
- Reject edited thumbnails, page screenshots, logos, fan art, AI-generated substitutes and anything that doesn't clearly show the item. Visually inspect ambiguous matches; record edition, platform, mode or model caveats in the brief.
- A readable item name or other identifying text baked into an otherwise useful item image is fine. Never reject an image just because the item name appears on it. Still record its source URL in the manifest and brief.

**Collectible pages**

For `collectible` collections, prefer an exact location, route, quest step or collectible view that helps a player recognize the goal. Don't switch a collectible to text-only just because a generic item thumbnail is easier to find. Record the sources you tried and record any genuine no-image case. Missing required images block publication.

## Partial coverage is fine, skipping the pass isn't

Partial coverage is fine while authoring. Required images must be complete before publication.

- Save and wire every verified match, even when the set is incomplete. Never throw away available images because other rows lack them.
- Record remaining gaps item by item and keep useful authoring work. Missing required images block publication; don't waive them or skip rows to hide the gap. A genuine no-image case needs a recorded reason.
- The image pass still has to happen, every time.

## Image Approval Notes

Add this section to `brief.md`:

```text
Image readiness:
- Image field:
- Page type (`database` or `collectible`):
- Expected image count:
- Images found:
- Images missing or genuine no-image cases:
- Source page, direct image URL, credit and images.json path:
- Visual spot-check result:
- Image sources used:
- Workspace media path:
- Dataset image paths updated: yes/no
- Checker command:
- Checker result:
- Ready for writing: yes/no
```
