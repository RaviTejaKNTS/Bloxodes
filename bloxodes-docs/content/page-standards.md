# Page standards

Last verified: 2026-10-19

What every Bloxodes page must get right: titles, headings, depth, images and layout. This applies to every page type, Roblox and non-Roblox alike. The voice (how sentences sound) lives in `bloxodes-voice`; this file covers what the page contains and how it's built. Writers follow both, and reviewers check both.

## Same page, any game

A non-Roblox page is the same page as its Roblox counterpart, minus the Roblox-only parts (universe IDs, codes refresh, Roblox APIs). Same template, same sections, same sidebar, same image slots, same FAQ and related links. If a franchise page looks or reads differently from the matching Roblox page, that's a bug to fix, not a style choice.

| Page | Model it on |
| --- | --- |
| Franchise or game wiki hub | `/wiki/<game>` (for example `/wiki/blox-fruits`) |
| Collection | `/wiki/<game>/<collection>` (for example `/wiki/chop-a-forest/classes`) |
| Quiz, checklist, codes, tool | the Roblox page of the same type |

## Titles

- Readable by a person first. It should say exactly what the page gives them.
- About 50 to 65 characters, so Google shows it in full. Put the game name and the main search phrase near the start.
- Use a number when there's a real count. Numbers make titles easier to click. Collections use the `{count}` token, which fills in from the live data: `All {count} Characters in Mario Kart World and How to Unlock Them`.
- No clickbait, no stacked colons, no keyword lists.

| Weak | Better |
| --- | --- |
| Mario Kart World Characters and How to Unlock Them | All {count} Mario Kart World Characters and How to Unlock Them |
| Mario Kart World Quiz | Mario Kart World Quiz: How Well Do You Know the Tracks and Racers? |
| ARC Raiders | ARC Raiders Wiki: Raids, Workshop Gear, Skill Tree and Feats |

The meta description is 140 to 160 characters: what the page answers, plus the reason to click.

## Headings

Someone who reads only the headings should come away knowing what each section covers. So every heading:

- is a descriptive phrase or full sentence a player might search for, not one vague word;
- names the game or the thing when it helps search (`How to Unlock Every Mario Kart World Character`, not `Opening racers`);
- can carry a number (`5 Shortcuts Worth Learning on Rainbow Road`);
- doesn't repeat the heading pattern of the section before it.

| Weak | Better |
| --- | --- |
| Starters | Characters You Can Race With From the Start |
| Grand Prix Cup Unlocks | Characters You Unlock by Winning Grand Prix Cups |
| Items | Every Mario Kart World Item and What It Does |

Template headings like "Page Indexes" and "Top Pages" are site navigation. Change those in code, not in copy.

## Depth and flow

- **Full data.** Cover the whole system: every item, field, step and location players need. A page too thin to beat the pages already ranking isn't ready.
- **In depth, in full sentences.** Explain the why and the trade-offs, like a friend who has played a lot. No fragments, no note-style bullets for things that need explaining.
- **Scannable.** Short paragraphs, tables for comparisons, lists for steps, bold for the key term. A reader skimming should find their answer fast.
- **Answer first.** The first lines answer what the reader came for. Background comes after.
- **No repeats.** Each fact appears once, in the section where it belongs. Sections lead into each other instead of restarting.
- **Visual.** Use images, tables and clear grouping wherever they help more than words.
- **No "how to use this page".** Don't explain filters, sorting, checkboxes, cards or what a collection is. Players know. Only tool pages explain how to use the tool.
- **FAQ.** Real questions players search for, with direct answers that add something the page body doesn't already say.
- **Internal links.** Link to the related Bloxodes hub, collections, codes, quiz and checklist for the same game.

## Images

Every page ships with every image it can get. Never leave out an image that exists.

| Page | Required |
| --- | --- |
| Wiki hub (Roblox or franchise root and child game) | A landscape 16:9 cover (cards and social previews) and a square title thumbnail. |
| Collection | An image on every item that has one in the game. The collection's social image comes from its items. |
| Quiz, checklist, codes, tool, catalog | A cover or thumbnail for cards and the social preview. |
| Article | A cover plus in-body images from the image pass. |

- **Roblox:** the first official 768x432 universe thumbnail for the cover and the official 512x512 icon for the square.
- **Non-Roblox:** official key art, store art or real gameplay screenshots, stored on the game row (`games.cover_image` 16:9, `games.hero_image` square). Quizzes, checklists, codes, catalogs and maps use their game's art; tools set `thumb_url`. A cover must be truly landscape; don't pad portrait box art. Publishing rejects missing, logo, broken or wrongly shaped images.
- Use exact images. No unrelated crops, edited art or generic game thumbnails standing in for a missing item. If an item truly has no clean image, record the gap in the dataset.
- **Missing item images never hold a collection back.** Publish it with the images that exist, even if that's none, and record each gap. A game without its collections is worse than a collection without images. The hub cover and thumbnail are still required.
- Check the page's `og:image` after publishing. On a hub, the default Bloxodes logo means the cover is missing. A collection with no item images shows the logo, and that's expected.

## Before you publish

- [ ] Title is readable, 50 to 65 characters, has the game name and a count where one exists.
- [ ] Every heading tells the reader what's in its section.
- [ ] The page covers the full data, in full sentences, and is easy to skim.
- [ ] Nothing explains how to use the page (unless it's a tool).
- [ ] No fact repeats.
- [ ] Cover, thumbnail and item images are all present; `og:image` isn't the default logo.
- [ ] The layout and sections match the Roblox page of the same type.
- [ ] FAQ and internal links are in place.
