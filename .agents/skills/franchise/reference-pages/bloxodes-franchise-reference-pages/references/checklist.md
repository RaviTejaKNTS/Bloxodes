# Franchise Checklist Research

You're researching one approved checklist so the writer can build a board players can actually tick through to 100%. You hand back a `brief.md`. You don't write `final.json`.

## Scope

Follow `bloxodes-docs/content/engagement.md#standalone-checklist-scope`.

- Normally, each game gets one standalone, source-verified 100% completion checklist. State the supported edition or mode, and put sections inside one board.
- Reuse the game's existing checklist.
- Additional pages, preparation lists, beginner milestones and routines need an explicit user exception.
- Collectible trackers and achievement rosters don't establish in-game 100%.

## Output

```text
tmp/content-workspace/<namespace>/<game-slug>/checklists/<checklist-slug>/brief.md
```

## Research steps

1. Resolve the exact registry game UUID, namespace, editorial slug, kind, parent title and edition/platform/mode scope.
2. Check the game's published and draft Bloxodes checklists and related pages. Reuse its existing checklist. Additional pages need an explicit user exception.
3. Verify the full completion requirements, thresholds, exclusions and alternative paths for the exact scope. Record sources and any explicit user exception. If you can't verify the scope, return the gap. Don't approve creation.
4. Split the verified requirements into sections and checkable tasks within one board.
   - Plan interchangeable paths as one explicit `A or B` leaf, with each option's completion criteria in its description.
   - All three-level leaves count toward progress, whatever their `is_required` value. So don't plan separate mutually exclusive or optional leaves.
   - If branching requirements would need unsupported alternative groups, return a gap.
5. Skip generic advice, article-style how-tos and tasks players can't mark complete.

## Writing the brief for the writer

Task titles end up on the page almost word for word, so write them the way a player would. Read `.agents/skills/bloxodes-voice/SKILL.md` first.

- **Plain player language.** "Beat the Frost Warden on Hard," not "Boss encounter completion (Hard difficulty)."
- **Name the player's real goal** in `Player goal`: what does finishing the game mean to them?
- **Hooks worth using:** the requirement most players miss, the task that takes longest, the order that saves time. Put these in the plan so the short intro has something real to say.
- **Keep sources and doubts private.** They go under `Evidence checked` or `Open gaps or risks`. If a threshold is shaky, say so once in plain words so the writer can add one short note or leave it out.
- **No research jargon in task wording.** Words like source, requirement set or leaf stay in your notes.
- Tasks stay plain and exact. Save personality for the short intro.

## Brief shape

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source coverage:
- Namespace, registry game UUID, kind and parent:
- Edition/platform/mode/release-generation and spoiler scope:
- Cover/thumbnail source and credit:
- Player goal:
- Game/edition/mode completion scope:
- Full 100% requirements, thresholds and exclusions:
- Alternative paths and their single-leaf representation:
- Explicit user exception, if any:

Checklist plan:
- Title:
- Slug:
- Sections:
- One board and its required task set:
- Leaf task examples:
- Skipped tasks:
- Hooks worth using:
- Open gaps or risks:
```

# Franchise Checklist Writing

A checklist is a player's map to 100%. The tasks have to be exact and checkable, and the short page description should make the grind feel doable. Normally you only write source-verified 100% completion checklists for the exact game and edition or mode.

Use this after the research above and parent approval. Follow `bloxodes-docs/content/engagement.md#standalone-checklist-scope`. Preparation lists, beginner milestones and routines need an explicit user exception in the brief.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Checklists" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<namespace>/<game-slug>/checklists/<checklist-slug>/
     brief.md
     final.json
   ```

3. Write the page metadata under `checklists` and the complete retained task inventory under `checklistItems` in `final.json`. Preserve the page UUID, task UUIDs and `item_key` values on updates.
4. Check that section codes are consistent. JSON validation and publisher checks run on GitHub, never locally.

## Where the voice goes

- **`description_md` gets a little personality.** Say what 100% means in this game and set up the run. Name the real groups this game's 100% covers, then give one honest line about the size of the run.
- **Task titles are plain actions.** "Craft the Ember Compass," not "Make sure you complete the important task of obtaining the Ember Compass."
- **Descriptions only when they help.** A location, a requirement or the one thing people miss.
- **Never narrate how the page was made.** Follow Public Copy in root `AGENTS.md`. Game terms like Research or Source Cargo are fine.

## Task rules

- Every task is an action a player can mark complete.
- Normally write one standalone checklist page per game and reuse its existing checklist. Extra pages need an explicit user exception. Sections split the single board's verified completion requirements.
- Cover the full required set. When there are interchangeable paths, write one required leaf with an explicit `A or B` title, describe each verified option and say when either complete path counts. Never split mutually exclusive choices into separate leaves.
- Every three-level leaf counts toward board progress, even with `is_required: false`. Put optional tips in descriptions, not in checkable rows. Defer branching requirements that can't fit an accurate single leaf until reviewed alternative-group support exists.
- Never write around unresolved completion requirements or relabel an achievement roster as in-game 100%.
- Describe the board percentage as checked-task progress unless sources verify how it relates to the in-game meter.
- Keep task titles short.
- No vague tasks like `Learn the game` or `Get better`.
- No generic advice that doesn't belong to this game.

## Field jobs

- `namespace` and `game_id`: the approved namespace and exact registry UUID.
- `checklists[].id` and task `id`: stable UUIDs. Every task links through `page_id` and has a stable `item_key`.
- `checklists[].slug`: the approved editorial slug. Preserve existing routes and ownership.
- `checklists[].title`: normally `<Game> 100% completion checklist`. Name the edition or mode when needed. A narrower scope needs an explicit user exception in the brief.
- `checklists[].seo_title`: null or close to the title unless search needs custom text.
- `checklists[].seo_description`: the route or completion path the board tracks, with a reason to use it.
- `checklists[].description_md`: what 100% means for this game and scope, without explaining checkboxes or board controls.
- `is_public` and `published_at`: explicit visibility and a valid date for a public board. Other shared page types use `is_published`.
- `section_code`: numeric depth: parent sections, then subsections, then checkable tasks.
- `title`: parents name a real phase or system. Leaf tasks are concrete actions.
- `description`: context only when it helps the player complete or understand the task.
- `is_required`: `true` for checkable leaf tasks, including a single `A or B` task, and `false` for parent or subsection rows. This flag doesn't remove a leaf from the board's percentage.

## Output shape

```json
{
  "checklists": [{
    "id": "<stable-page-uuid>",
    "namespace": "<namespace>",
    "game_id": "<game-uuid>",
    "slug": "<checklist-slug>",
    "title": "",
    "seo_title": "",
    "seo_description": "",
    "description_md": "",
    "is_public": false,
    "published_at": null
  }],
  "checklistItems": [{
    "namespace": "<namespace>",
    "page_id": "<stable-page-uuid>",
    "item_key": "<stable-task-key>",
    "section_code": "1.1.1",
    "title": "",
    "description": null,
    "is_required": true
  }]
}
```

Include all group and subsection rows as well as every required leaf. For updates, include every retained task and its existing UUID. Don't use this leaf-only example as a complete board. See `payloads.md` for the progress contract. Required cover/thumbnail and related-link support must render; missing support blocks publication rather than adding unsupported payload fields.

