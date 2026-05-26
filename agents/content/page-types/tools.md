# Tool Pages

Use this guide for Bloxodes tool pages at `/tools/<code>` backed by the `tools` table.

Tool copy should feel like a clear explanation beside the interactive experience. The tool itself is the main event. The writing helps users understand what to enter, what the result means, and where the result has limits.

## Purpose

A tool page should help the reader put in the right values, understand the result, and know what assumptions affect the output. The interactive tool is the main experience; copy should make the tool easier to trust and use.

Use a hard gate before recommending or creating a new tool. A tool needs a real input/output job, reliable data or formula support, and evidence that players actually need the helper. Check gameplay, search intent, and competing tools/calculators/trackers before green-lighting it. If the idea only repackages a catalog, article, checklist, or wiki explanation, hard pass.

It is fine to record `potential future tools`, but do not create a tool page until the use case is proven and the calculation/planner/checker can be implemented honestly.

## Database Fields

Create or update:

```text
tmp/content-workspace/<game-or-topic-slug>/tools/<tool-code>/
  todo.md
  research-notes.md
  final.json
```

Copy `agents/content/todo-templates/tool.md` into the folder as `todo.md` before research starts.

Write in this shape:

```json
{
  "code": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "how_it_works_md": "",
  "description_json": {},
  "faq_json": [],
  "cta_label": null,
  "cta_url": null,
  "schema_ld_json": null,
  "thumb_url": null,
  "universe_id": null
}
```

Only include fields you are updating. Do not invent formula details, conversion rates, image paths, or game-specific assumptions.

If there is no implemented or clearly scoped interactive surface, do not write tool copy. First define the actual UI inputs, outputs, formula/data source, update risk, and user decision it supports.

## Field Roles

- `title`: visible tool name.
- `seo_title`: search title. Keep it readable.
- `meta_description`: under 160 characters, specific to the tool result.
- `intro_md`: crisp context before or near the tool surface.
- `how_it_works_md`: plain-language explanation of inputs, outputs, formulas, assumptions, or limits.
- `description_json`: optional ordered blocks for extra detail sections.
- `faq_json`: real questions users have after seeing the tool.
- `cta_label` and `cta_url`: only when the page has a clear next action.
- `universe_id`: use when the tool belongs to a specific Roblox game hub.

## Writing Pattern

Good tool copy usually covers:

1. What the tool calculates, converts, extracts, ranks, or plans.
2. Which inputs the user needs.
3. What the result means.
4. Which assumptions or limits affect the result.
5. What to check next if the result depends on game data, platform pricing, stock, events, or formulas.

Keep this concise. Do not bury the tool under a long essay.

Before writing, the research notes must state why this deserves a tool instead of a catalog, checklist, article, or wiki section. They should also name comparable tools or state that no useful competitor was found after searching.

Give context before formulas or limits. If a tool has several concepts, such as input value, result meaning, assumptions, and edge cases, explain them in separate paragraphs or blocks so the user can follow the calculation.

Headings should read like useful sentence fragments, such as `What the result means` or `Why the estimate can change`, not rigid labels such as `Result` or `Accuracy`.

## Intro Rules

The intro should hook with usefulness, not hype.

Good:

```markdown
Use this calculator to estimate how much Robux you get from each package and compare the real dollar value before you buy.
```

Bad:

```markdown
This powerful and useful calculator helps Roblox players make smarter decisions.
```

## How-It-Works Rules

`how_it_works_md` renders directly below the interactive tool on tool pages. Write it as the practical "how to use this tool" section, not as a distant technical appendix. It should tell the reader what to click or enter, what to check in the result panel, what each important number means, and which output should drive the next decision.

`how_it_works_md` should explain the actual mechanics:

- what each input changes
- which values are fixed
- which values may change over time
- whether the result is an estimate or exact output
- what the user should do if a value looks wrong

For interactive tools, use short headings, numbered steps, or compact bullets when they make the workflow easier to follow. A good section can say things like "Pick the target item first", "Enter the quantity you actually plan to spend", "Read the shortfall before using rare materials", or "Compare miss chance with hit chance before rerolling." Do not write vague lines like "enter your information and get a result" unless the next sentence explains the result.

Keep broader system explanation, examples, and edge cases in `description_json` below this section. The first written section after the tool should help the player operate the tool immediately.

## FAQ Rules

Good tool FAQs answer:

- why the result differs from Roblox or in-game values
- what each input means
- whether the calculation uses current rates
- whether the tool stores user data
- what to do when an item, event, or value is missing
- how often the underlying data can change

Avoid:

- `What is this tool?`
- `Why should I use this tool?`
- generic safety or accuracy claims without a real explanation

## Final Checks

- Does the intro say what result the tool gives?
- Does `how_it_works_md` explain assumptions or formulas in plain English?
- Does every sentence help the user use or understand the tool?
- Does each paragraph explain one input, output, assumption, or limit instead of mixing several?
- Are headings clear before the user reads the paragraph?
- Are current rates, formulas, and game values verified or marked `needs review`?
- Did research prove this is a real tool use case rather than a content idea?
- Did you check competing tools or player demand before recommending it?
- Are source and research notes kept internal?
- Does the page flow from tool purpose to input/result explanation to useful follow-up questions?
