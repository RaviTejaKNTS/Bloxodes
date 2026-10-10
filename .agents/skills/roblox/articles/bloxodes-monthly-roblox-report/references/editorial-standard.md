# Monthly Roblox Editorial Standard

The reader should come away knowing what happened in Roblox this month and why it was interesting. The stats support the story. They aren't the story.

The voice comes from `.agents/skills/bloxodes-voice/SKILL.md`: answer first, plain words, real game names, a bit of spark. This page adds what's specific to a monthly data report: which stories to pick, how to talk about numbers honestly, and how the charts and page should look.

## Picking the story

Lead with the most surprising observation you can defend, usually one game with an unmistakable path across the whole month. Good leads:

- a new breakout with sustained growth
- a genre move that repeats across matching weekdays
- a recognizable event rhythm
- a sharp but sustained cool-down
- an old game coming back into the spotlight
- a meaningful contrast, like a genre weakening while its biggest game holds steady

Reject:

- sample counts as headlines
- generic totals with no human meaning
- start-day versus end-day league tables
- tiny games winning only on percentage
- one unexplained peak
- platform-wide claims from a selected set of games
- facts that answer no reader question

## Shape of the piece

One H1 and at most three main H2 sections:

1. the month's strongest game story
2. the wider genre, event or community pattern
3. lasting climbers versus cool-downs, ending with short platform or community context

The exact structure can change with the evidence. Don't force last month's story onto new data.

Open with a concrete surprise. End with a synthesis, not an internal watchlist or questions for the next report.

## Talking about the numbers

Write for ordinary Roblox players: short paragraphs, short direct sentences, and concrete game names, dates and comparisons. On top of the voice guide, these word choices keep the data honest:

| Say | Not |
| --- | --- |
| players online at the same time | `CCU` |
| typical weekly change | statistical jargon |
| cooled, lost momentum | died |
| coincided with, landed alongside, the timing matches | caused, drove, led to |

- Keep `cohort`, `coverage`, `opening window`, `closing window`, `integrity review`, `sample management` and other internal terms out of public copy.
- Never say an update, algorithm change, meme or community reaction caused a player movement unless a strong source proves causation.

## Charts

Three or four editorial figures at most. Every chart needs:

- a neutral, human title
- one sentence on how to read it
- a small source line
- real numeric arrays in code
- accessible tooltips or labels
- line patterns or direct labels as well as color, for multi-series charts

Useful figures:

1. a breakout game's daily average line with verified event markers
2. a horizontal genre bar using median same-weekday change
3. indexed event-wave lines where each game's monthly average equals 100
4. normalized full-period lines for cooling games

No image-generated charts. No metric cards around the page. A subtle figure boundary is fine when it helps the chart read inside the article.

## Public endnote

Keep the method to one short endnote. It's the only place the report explains how the numbers were made. Adapt:

> We used Bloxodes' repeated readings of public Roblox player counts from [dates] and averaged them by day. The figures show players online at the same time, not unique people. Events and news are linked to their original sources. Incomplete collection dates were excluded from trend calculations.

## Sources and attribution

These are accuracy rules for news and legal topics. They apply even though the voice guide usually avoids saying who said what.

- Link primary announcements and official game or update pages inline.
- Attribute company test results as company-reported.
- Attribute allegations and include the relevant response.
- Treat forum posts, Reddit, memes, fan art and videos as qualitative community signals only.
- Never turn selective discussion into a sentiment percentage.
- Don't include a news item just because it happened that month. It has to matter to players or explain the wider picture.

## Visual direction

The page should look like a restrained magazine or newspaper feature inside the Bloxodes shell:

- a comfortable reading column
- a strong headline and standfirst
- continuous prose
- charts placed after the paragraphs that introduce them
- no dashboard chrome, KPI grid, decorative hero, card wall or internal-preview badge

Keep the technical `noindex` behavior invisible to readers.

### Feature image

Each report gets one restrained 1200×630 feature PNG for the reports archive and social previews.

- **Show only:** one plain `Roblox <Month> Stats Report` context line, the approved headline, the Bloxodes wordmark, one meaningful lead metric, and one unlabeled sparkline from the real lead chart series.
- **Leave out:** any other eyebrow, separate month label, chart caption, axis, date, source label, divider, grid, badge or decorative copy.
- **Never use:** AI-generated art, stock decoration, game screenshots, decorative gradients or fake charts.
- Don't repeat the feature image inside the report body, where it would duplicate the headline.
