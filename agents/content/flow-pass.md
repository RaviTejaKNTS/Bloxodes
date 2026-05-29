# Bloxodes FLOW Pass

Use this after the first `final.json` draft and before the final edit gate. The FLOW pass is not another checklist. It is a rewrite pass whose job is to make the page read in a clean, useful order.

The failure this pass prevents is easy to spot: the facts may be true, but the page feels like random sections were stitched together from fields. A normal reader should never wonder why a heading exists, why the paragraph jumped there, or what the section is trying to help them do.

Before the pass starts, open the page folder's `todo.md` and confirm the research/data/approval gates that apply to the page type are checked or explicitly blocked. After the rewrite, mark the FLOW item complete in `todo.md` and record the pass in `research-notes.md`.

For catalog and game-catalog pages, also open the player-usefulness gate and required fact matrix in `research-notes.md`. FLOW must make sure the finished copy answers the promised player task. If the matrix says the reader needs prices, damage, upgrade steps, locations, chances, requirements, or route order, those facts must appear in the planned cards/tables/body or be marked unavailable. Do not turn missing facts into vague sections.

## What FLOW Means

FLOW means the public copy moves like a player explanation:

1. Start with the collection or mechanic in normal game language.
2. Show the primary cards or table early.
3. Use `description_json` for short notes tied to card sections.
4. Use `description_md` for the whole system: how it works, how players get or use the items, which mistakes matter, and what the cards mean in practice.
5. Use `how_it_works_md` to explain how to read the data without sounding like field commands.
6. Use FAQs only for real follow-up questions.
7. End with a page where a reader can name what to do next in the game.

The pass should change `final.json` when the structure is weak. Do not only say the draft is bad. Rewrite it.

For catalog and game-catalog pages, also read the approved title as a promise. If the title says `how to get them`, `locations`, `drops`, `chances`, `what they do`, `bonuses`, `value`, or another specific answer, the FLOW pass must make sure the body actually answers it. Do not leave the promise trapped in a card column when the title needs a real explanation.

Read the approved player task the same way. If the page is meant to help players buy weapons, it needs the buy path. If it is meant to help players upgrade weapons, it needs the upgrade process. If it is meant to help players choose a class, it needs role and unlock context. Remove headings that explain internal uncertainty instead of helping the player act.

## Catalog FLOW Rules

For catalog and game-catalog pages, `description_md` must not be a second set of card-section notes. If the cards are grouped by rarity, sea, source, item type, or unlock route, those group notes belong in `description_json`.

`description_md` should explain the page as a whole. It should answer the kind of questions a player has after seeing the cards:

- How do I get or use this thing in the game?
- Where do I find it?
- What route, shop, island, NPC, event, machine, egg, gift, boss, or resource is involved?
- What values on the cards actually change a decision?
- What do new players misunderstand?
- What should I save, farm, buy, open, unlock, equip, trade, or skip?
- Which exact facts from the required fact matrix should be visible before the reader needs another guide?

Every catalog or game-catalog `description_md` should include at least one useful action section when the collection has an action behind it. That section can be a how-to, use, unlock, farm, obtain, find, hatch, roll, craft, grow, redeem, equip, travel, or compare section. If the collection is purely cosmetic or passive, the copy should still explain how players actually encounter or apply it.

Good section ideas:

- `How to train Instinct levels in Blox Fruits`
- `How to get gift prizes from Adopt Me gifts`
- `How to reach the islands in this route`
- `How to farm materials without wasting time`
- `How to read fruit stock and spawn timing`
- `What the rarity tiers mean before you trade`

Weak section ideas:

- `Value`
- `Source`
- `Progression`
- `Instinct EXP comes from dodging` when the section never explains the player action clearly
- Any heading that only restates a field name or one card value

## Tables, Lists, And Steps

Use formatting because it helps the reader, not because every page needs decoration.

Use numbered lists for a process:

```markdown
1. Buy or earn a gift.
2. Open it to roll a reward tier.
3. Check the active prize board before assuming an old item is still obtainable.
```

Use tables when several groups need the same comparison points:

```markdown
| Gift | Cost | Legendary chance | Best use |
| --- | --- | --- | --- |
| Small Gift | 70 Bucks | 0.5% | Cheap rolls when you are fine with common rewards |
```

Use bullets for quick rules, mistakes, item groups, or examples.

Use paragraphs for connective explanation. A catalog page should not become a wall of tables, but it also should not make readers dig through five paragraphs when a small table would explain the decision faster.

## Story Order

During the FLOW pass, read the page from top to bottom and ask whether the next section feels expected. If not, move, rewrite, merge, or cut.

A strong catalog flow often looks like this:

1. `intro_md`: what the collection is and why it matters in the game.
2. Cards/table: the data the reader came for.
3. `description_json`: short section notes near each card group.
4. `description_md`: whole-system explanation with a clear action section and practical context.
5. `how_it_works_md`: how to interpret the visible card/table fields in player language.
6. `faq_json`: real questions the card data naturally creates.

Do not make `description_md` chase each card section. If the cards are already split into `Starter Instinct`, `Main training climb`, and `V2 preparation`, the markdown below should not become three more tiny sections that say the same thing in larger text. It should explain how to train Instinct, what the EXP milestones mean, and how normal Instinct connects to Instinct V2.

## Rhythm And Personality

The page should sound like a Roblox player who understands the game and is explaining it clearly to another player.

That does not mean slang in every sentence. It means the copy has judgment and pace. Some sentences can be blunt. Some can slow down and explain the confusing part. A useful aside or example is fine when it helps the reader understand the mechanic.

Do not polish the page into lifeless help-center copy. Do not turn it into forced hype either. The sweet spot is direct, practical, and a little human.

## FLOW Pass Checklist

Before the pass is complete, confirm:

- `description_md` explains the whole page, not individual card sections.
- The page has a useful action/how-to/use section when the collection has player action behind it.
- The visible title and `seo_title` promise is answered by the cards, `description_md`, `how_it_works_md`, and FAQs.
- Headings explain what the section helps the reader understand.
- The first paragraph under a heading deepens the idea instead of repeating the heading.
- Paragraphs do not mix unrelated concepts.
- At least one list, table, or numbered process is used when it would explain faster than prose.
- The copy moves from context to action to interpretation to caveats.
- The page does not mention the website, catalog, dataset, or internal process.
- The draft has been rewritten where needed, not merely judged.

If the FLOW pass changes public fields, update `final.json` directly and record the change in `research-notes.md` under `Implementation notes` or `Writing angle`.
