# Bloxodes Writing Core

Use this guide for every Bloxodes page type. Page-type files can add structure, but they do not override the core voice.

The guidance in these files should model the writing we want from the model. Keep instructions clear, specific, and human. Use normal sentences when an idea needs judgment. Use checklists only when order, completeness, or validation matters. A model often mirrors the voice of the instructions it reads, so these docs should feel like a careful editor explaining the work, not like a stack of rigid commands.

## Goal

Bloxodes should read like a useful Roblox live database written for players. The copy should help readers compare items, redeem rewards, understand game systems, or decide what to do next without feeling like SEO filler.

The same idea applies to internal guidance. A useful instruction should explain what to care about and why it matters. If a rule is only written as a command, add enough context for the model to make the right call on a different page type later.

## Instruction Voice

When writing or updating skills, agent notes, and workflow docs, use the same practical clarity we want in public copy.

Prefer guidance that sounds like this:

```markdown
Research the topic until you can explain what the player does, what changes in the game, and which details affect a decision. Then choose the page structure that makes those decisions easiest to understand.
```

Avoid guidance that sounds like this:

```markdown
Research topic. Identify fields. Explain value. Add context.
```

Both examples ask for similar work, but the first one gives the model a way to think. It is still direct, but it has enough rhythm and context to generalize across catalog pages, wiki hubs, articles, and tools.

Examples are allowed when they teach a reusable pattern. Do not let an example become the hidden template for every page. If an example is very game-specific, make sure the surrounding instruction explains the broader principle.

## Voice

- Use simple US English.
- Write like a Roblox player explaining useful details to another player.
- Stay friendly, factual, and practical.
- Be specific to the game, item collection, event, tool, or article topic.
- Use natural sentence rhythm. Mix short direct sentences with slightly longer explanatory ones.
- Keep paragraphs compact.
- Use contractions when they sound natural.
- Sound like a practical Roblox player, not a polished help-center article. A light opinion is good when the data supports it: say an item is mostly for collectors, worth saving, annoying to replace, or not worth chasing unless that is actually true from the facts.
- Write from a player-perspective voice. The copy should feel like someone who plays Roblox is explaining the useful part to another player.
- Do not hype. Avoid marketing language.
- Do not add emojis.
- Do not use em dashes.
- Do not mention scraping, source gathering, prompts, AI, or internal research in public page copy.

## Mature Human Standard

Bloxodes copy must sound human from the first written version. Do not write generic copy and plan to humanize it later.

- Say the exact thing that helps the player.
- Every sentence must add useful information, context, comparison, warning, instruction, or next-step clarity.
- Delete any sentence that does not help the reader understand, decide, compare, redeem, calculate, collect, or act.
- Prefer concrete game details over broad importance claims.
- Use plain verbs such as `is`, `has`, `gives`, `costs`, `drops`, `refreshes`, and `unlocks`.
- Let sentence length vary naturally.
- Give a useful stance when the data supports it.
- Explain the "why" behind fields. Do not only tell the reader to read category, rarity, source, or availability first.
- Keep uncertainty in research notes unless it directly helps the reader.
- Keep research and source work internal. Public copy should explain the result, not describe how we found it.
- For catalog, wiki, tool, and database copy, prefer player-perspective language over literal first person. Use `you`, `your`, and practical gamer judgment. Avoid stuffing fields with `I`, `we`, or `our`.
- For normal guides, voice should come from structure, specificity, confident judgment, and the feeling that the writer understands the game.
- For articles, first person is allowed when the format benefits from a direct player opinion or editorial angle.

## System-First Standard

Explain the game system before explaining fields.

The old failure mode was field-first writing: `source affects value`, `seats explain use`, `rarity helps scanning`, `availability changes replacement difficulty`. Those sentences are too abstract unless the copy defines what the field means in gameplay.

Good public copy should teach the topic like a player would:

1. Name what the item, mechanic, tool, or system does in the game.
2. Explain what the player actually does with it.
3. Define any term that may be unclear.
4. Use a real example from the game or dataset.
5. Then explain why a value or field matters.

Bad:

```markdown
Seats explain how vehicles play.
```

Better:

```markdown
A one-seat vehicle is mostly personal travel. Multi-seat vehicles matter more when you are moving with friends, roleplaying as a family, or carrying babies and pets around the map.
```

Bad:

```markdown
Source explains whether a pet is easy to replace.
```

Better:

```markdown
An egg pet that still hatches from the Nursery is easier to replace because players can keep buying eggs. A Halloween or Christmas pet from an old event usually depends on trading because that event shop is gone.
```

Bad:

```markdown
Price, source, and uses explain replacement value.
```

Better:

```markdown
Basic food is usually safe to spend because you can buy it again or pick it up during normal tasks. Event candy, weather food, and potion-like consumables are different because their source may only appear during a limited event or rotation.
```

## Code Page Standard

Code pages must separate evergreen article copy from live code data. The public prose should explain the game, reward types, redemption steps, troubleshooting, and official places where new codes usually appear. It should not name active codes, list current code rewards by code name, mention exact dates, include month/year labels, quote active-code counts, or promise freshness with lines such as `latest codes`, `current codes`, `fresh codes`, or `updated daily`.

The live codes table and `scripts/codes/update-codes.ts` own active codes, expired codes, dates, counts, and reward rows. When writing code-page fields, return only the `games` row fields and source URLs. Do not include a manual `codes` array.

## Non-Negotiable Writing Rules

1. No vague writing. Every sentence needs clear context and useful information.
2. If a sentence does not add value for the user, it should not exist.
3. Do not mention source gathering, research, checking, or internal evidence in public copy. Explain the player-facing fact directly.
4. Every page should flow from top to bottom like a clear story: why the page matters, what the user can do, what details matter, and what to check next.
5. Do not write lines just to be engaging. Write useful information in an engaging way.
6. The intro must be crisp, clean, and specific enough to pull the reader in. Keep that clarity and momentum through the rest of the page.
7. Give enough context before moving into details. Do not jump from one system, field, item group, or mechanic to another before the reader understands the first one.
8. One paragraph should explain one concept. If a paragraph starts mixing source, value, rarity, trading, events, and mistakes, split it.
9. Headings should usually read like clear sentence fragments that tell the reader what the section explains. Avoid rigid one-word headings when a useful heading is possible.
10. The paragraph after a heading should deepen the idea, not repeat the heading in a slightly longer sentence.
11. Define game terms before relying on them. If you use `source`, `seats`, `uses`, `availability`, `rarity`, `chance`, `multiplier`, `Full Grown`, `Neon`, `weather`, or `refresh`, explain the gameplay meaning when the term is not obvious.
12. If a normal player can ask "what does that mean?" after a sentence, rewrite it with context.
13. Do not compress away explanation just to keep the field short. Short copy is good only when it is complete.

## One-Workflow Writing Standard

Every serious content task should produce researched, final-shaped copy in one workflow:

1. Confirm the page type and exact database fields.
2. Create or update `research-notes.md` with plain-language topic research before implementation notes.
3. Inspect the current row, local dataset, route behavior, or source material.
4. For catalog work, audit data and images before writing: local count, source count, rendered count, title count, image coverage, and missing or stale rows.
5. Verify unstable facts before writing.
6. Update or intentionally accept stale data before writing public copy.
7. Write the first pass directly in `final.json` using the mature human standard.
8. Run the FLOW pass when the page has meaningful body copy, especially catalog, game-catalog, article, and tool pages.
9. Run the final edit checklist before returning or importing the result.

Do not return weak preliminary copy that needs another prompt to become usable. If research is blocked, return `needs review` with the missing facts inside `research-notes.md` instead of filling gaps.

For catalog and game catalog work, finish one gold-standard page before scaling to more pages. The gold standard includes data completeness and image coverage, not only good prose.

## Reader-First Standard

Start with what the reader came to do:

- compare items
- check a price, source, rarity, reward, code, event, or requirement
- understand what a game system means
- decide what to collect, buy, unlock, redeem, craft, fight, hatch, or skip
- get reliable context before using a tool

Assume the reader already knows the broad topic they searched for. Do not spend the opening explaining Roblox basics unless the page genuinely needs that context.

## Game-First, Not Website-First

Public copy should explain the game, item, mechanic, event, or tool result. It should not explain Bloxodes, the database, the dataset, the page, or the catalog unless the UI itself requires that word.

Hard rules:

- Do not write `Use the X catalog`, `check the catalog`, `open the catalog`, or `browse the catalog` in public copy.
- Do not tell the reader what our website lets them do when you can explain the game concept directly.
- Do not use `dataset`, `database`, `Bloxodes`, `this page`, `this catalog`, or `this guide` as filler in intro, description, FAQ, wiki, or article copy.
- `wiki_md` must explain the collection as a game system, not describe a link card.
- Catalog page intros should start with the collection or mechanic, not the site surface.
- Links can exist in UI. The copy does not need to beg the reader to click them.

Bad:

```markdown
Use the Eggs catalog to compare egg prices, legendary chances, and availability before hatching.
```

Better:

```markdown
Eggs decide which pet pool each hatch can pull from. Current eggs are easy to replace, while retired and event eggs usually matter because players can only get them through trading.
```

Bad:

```markdown
This catalog includes current pets, event pets, reward pets, and older limited pets.
```

Better:

```markdown
Adopt Me pets come from eggs, events, shops, rewards, Robux purchases, and older limited releases. Rarity helps with sorting, but source, age, potion status, and availability usually decide how hard a pet is to replace.
```

## Page Flow

A Bloxodes page should move like a practical story:

1. The intro names the useful problem, collection, tool, guide, or game context.
2. The primary data or tool experience appears before long explanation.
3. Supporting copy explains how to read the data, avoid mistakes, or use the result.
4. Deeper sections answer the questions the page naturally creates.
5. FAQs cover real follow-up questions, not filler.

Keep the reader oriented. Each section should make the next section feel expected.

## FLOW Pass Standard

The FLOW pass exists because a page can be factual and still read badly. It may have clean sentences, but the headings feel random, the paragraphs jump too fast, or `description_md` repeats card-section notes instead of explaining the whole mechanic.

Run the FLOW pass after the first-pass `final.json` and before final edit. It should rewrite the public fields, not merely judge them.

For catalog and game-catalog pages:

- `description_json` explains specific card sections near the cards.
- `description_md` explains the collection as a whole: how it works, how players get or use it, what terms mean, and what mistakes matter across the page.
- `description_md` should include at least one useful action section when the collection has an action behind it. The action can be getting, finding, unlocking, farming, growing, hatching, rolling, crafting, equipping, traveling, comparing, or using the items.
- Tables, bullets, and numbered steps should appear when they make the page easier to understand.
- Headings should explain a reader question or action, not restate a field label.

Think of the pass like this: research gives the facts, the first pass writes the page, FLOW makes the page readable enough that a normal Roblox player can follow it without stopping to decode why the sections exist.

## Outline-First Page Structure

Do not start public copy by turning research notes into polished paragraphs. Build the reader path first.

Before writing, decide:

- what the reader came to solve
- what must be explained before the item cards or tool result makes sense
- what should come after the cards because it helps interpret the data
- what should be cut because the cards already show it or the detail does not change a player decision
- where a list, table, or numbered process will be clearer than prose

Good catalog and game-catalog pages should feel like catalog plus useful guide context. They should not become giant articles, but they should answer the practical questions a player would ask: how to get the item, what the main types are, what current versus old availability means, which values change a decision, and what mistakes to avoid.

They also need trustworthy data. If research finds more items than the local dataset, missing expected images, or cards that cannot show useful fields yet, stop and fix or approve the data state before writing polished copy.

## Lists, Tables, And Steps

Use formatting only when it makes the explanation easier.

- Use bullets for short routes, item groups, warnings, and examples.
- Use Markdown tables when several groups share the same comparison points.
- Use numbered lists for linear processes, such as how to acquire, redeem, unlock, hatch, craft, or calculate something.
- Use paragraphs when the reader needs context, nuance, or a smooth explanation.

Do not make every section a paragraph. Do not make every section a list. Choose the shape that lets the reader understand fastest.

## Context And Flow

Useful copy can still move too fast. Slow down enough for the reader to follow the mechanic.

- Set up the concept before naming exceptions.
- Explain what a field means before telling the reader to compare it.
- Move from broad game concept to specific item details, not the other way around.
- Put caveats near the claim they affect.
- Do not jump from obtainment to trading to event availability in one paragraph unless those ideas are directly connected.
- If a section introduces a new idea, give it its own paragraph or heading.

Bad:

```markdown
Food covers healing, tasks, potions, event items, and rewards, so check price, availability, and source before using rare items.
```

Better:

```markdown
Food in Adopt Me is mostly about pet and baby needs. Most basic food is easy to replace, so the source field matters most when an item comes from an event, reward, or older shop rotation.
```

## Paragraph Discipline

Each paragraph should make one idea clear.

- One paragraph can explain what the collection is.
- One paragraph can explain obtainment.
- One paragraph can explain value, trading, or availability.
- One paragraph can explain common mistakes.

Do not pack unrelated scan fields into the same paragraph just because they all appear on the card. If two ideas would need different player actions, they usually need separate paragraphs.

## Sentence Test

Keep a sentence only if it does one of these:

- explains
- compares
- guides
- warns
- verifies
- ranks
- helps redeem
- helps decide
- helps the reader continue

Cut sentences that only say the page is useful, exciting, complete, popular, or easy.

## Avoid

- "This game is fun and engaging."
- "Players can enjoy a variety of experiences."
- "There are many things to know."
- "Let's dive in."
- "Whether you are a beginner or experienced player..."
- "This page will cover everything you need."
- "It plays a crucial role."
- "It is important to understand..."
- "This serves as..."
- "This stands as..."
- "This showcases..."
- "This underscores..."
- "This marks a pivotal..."
- "This reflects the evolving landscape..."
- "Not only X, but also Y" when a direct sentence works.
- "It is not just X" or "X is not just Y" when the sentence is only trying to sound deeper. Say the direct point instead.
- Vague authority such as "players say", "experts believe", or "many sources claim" without a named source.
- Promotional words such as "boasts", "vibrant", "rich", "seamless", "powerful", "immersive", "exciting", "valuable", and "enhance" unless the specific feature makes the word necessary.
- Fake analysis tails such as "highlighting its importance", "showcasing the game's depth", "ensuring a smoother experience", or "making it a valuable choice".
- Forced sets of three when the data does not need three examples.
- False `from X to Y` ranges when X and Y are not a real scale.
- Repeating the heading in the first line below it.

## Better Patterns

Bad:

```markdown
Pets are an important part of the game and help players progress faster.
```

Better:

```markdown
Pets matter because their rarity, age, and availability decide how hard they are to trade or collect later.
```

Bad:

```markdown
Use this table to see all items and their information.
```

Better:

```markdown
Compare rarity, source, and availability first; those fields usually decide whether an item is easy to replace or worth saving.
```

Bad:

```markdown
This event has many exciting rewards for players.
```

Better:

```markdown
Check the start and end times before planning around the event because limited rewards can disappear once the timer ends.
```

Bad:

```markdown
The seed shop refreshes every 5 minutes, ensuring players always have new options.
```

Better:

```markdown
The seed shop refreshes every 5 minutes, so short check-ins matter more than waiting for one long session.
```

Bad:

```markdown
There are many fields to consider when choosing an accessory.
```

Better:

```markdown
Compare bonuses first, then source and requirement. Rarity helps with sorting, but it does not tell you whether an accessory fits your build.
```

## Headings

Use headings that tell readers what the section explains. Prefer readable sentence-style fragments over rigid labels.

Good:

- `How source changes item value`
- `Why availability matters more than rarity`
- `What to check before trading`
- `Where these rewards come from`
- `How events change what you can still get`

Avoid:

- `Introduction`
- `Overview` when a clearer heading exists
- `Why it matters`
- `Sources`
- `Value`
- `Tips`
- `Final thoughts`
- cute headings that hide the answer

After a heading, do not restate it. Go deeper immediately.

Bad:

```markdown
## How source changes item value

Source changes item value because it tells you where the item comes from.
```

Better:

```markdown
## How source changes item value

Shop items are usually easier to replace than event rewards or retired drops. When two items have the same rarity, source often tells you which one will be harder to get again later.
```

## Structured Data Copy

When writing around tables, cards, pills, JSON fields, or tool panels:

- Use the field names players understand.
- Explain unclear fields once, near the data.
- Do not expose raw internal keys in visible copy.
- Treat `Yes` and `No` as incomplete unless the label explains what they mean.
- Prefer `Tradeable: Yes`, `Limited: No`, `Craftable: Yes`, or a full sentence.
- Treat field-command sentences such as `Read category first`, `Check rarity first`, or `Use source first` as hard failures. Rewrite them into a player-facing explanation of what that field changes in the game.
- Treat `not just` and `not only` contrast lines as hard failures unless the contrast is genuinely necessary. Most of the time, a direct sentence is cleaner.
- Use `Not listed` only when the missing value matters to the reader.
- Leave optional copy blank rather than filling space.

## Sentence Rhythm

Vary rhythm without becoming theatrical.

Good:

```markdown
Rarity helps you scan the list, but the source matters more. A common item from a rotating event can be harder to replace than a rare item that stays in a shop.
```

Avoid a whole section where every sentence has the same shape:

```markdown
Pets help players progress. Pets have different rarities. Pets can be found in eggs. Pets are useful for collecting.
```

## Links And Sources In Public Copy

Keep research and source notes internal. Do not write phrases such as "we checked", "according to our research", "sources say", or "based on the data" in public copy.

When a table has a `sources` field, store important URLs there. Visible copy should explain what the player needs to know in plain language.

Internal links should help the reader move to a related Bloxodes page. Do not write self-referential phrases such as "in our guide" just to add a link.

## Database Copy Rules

- `meta_description` should be under 160 characters when possible.
- `seo_title` should be readable, not stuffed. For catalog and game-catalog pages, it should usually equal the visible `title`, including item counts. Count-based titles give readers useful search context and should not be simplified away.
- Markdown fields should use clean headings, bullets, lists, and tables only when helpful.
- JSON fields must stay valid JSON.
- FAQ answers should answer real reader questions, not restate the page title.
- Do not duplicate the same idea across intro, description, how-it-works, FAQ, and wiki copy.
- Avoid over-bolded inline-header lists unless the UI or field format needs them.
- Use sentence-case headings.

## Required Human Check

Before returning copy, scan for:

- a generic first sentence
- any sentence that does not add user value
- inflated importance
- promotional adjectives
- vague authority
- repeated sentence shape
- fake `-ing` analysis
- forced threes
- topic jumps inside one paragraph
- one-word headings where a clear explanatory heading would be better
- unexplained `Yes`, `No`, or numbers
- heading repeated in the first sentence below it
- an ending that says nothing new

If a sentence could fit any Roblox game, rewrite it with this game's data or cut it.

## Quality Bar

A good Bloxodes page should make the reader feel:

- "I found the useful data quickly."
- "I understand what these fields mean."
- "I know what changes often and what is stable."
- "This copy fits this game, not a generic Roblox page."
- "The page helped me decide what to do next."
