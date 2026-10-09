# One Editorial Revision Before Acceptance

Every approved-brief article gets one real editorial pass: specific feedback, one revision by the same writer, and a final read. This replaces endless polish loops.

In the code-controlled pipeline, a separate reviewer invocation does the review. The runtime routes findings and writes the review note. The reviewer can't edit files or manage workers, and the writer only produces the draft or the requested revision. The judging criteria below are the same either way. Code, not a model parent, owns the retry count and the acceptance step.

In an interactive workflow, the parent reviews and the same writing agent revises. Keep the configured model and reasoning effort. Don't add an extra editor agent or switch models for prose quality.

## Read it as a player first

Read the public draft against the voice guide (`.agents/skills/bloxodes-voice/SKILL.md`) and the [article standard](editorial-standard.md) before you open the brief. Does it sound like a player giving useful advice, or like a report about what sources said? Note the weak phrasing, thin explanations and repeats.

Then open the brief to check accuracy and completeness. The brief's wording is never the standard for public prose. A factually correct draft can still need a rewrite.

## The six checks

These match the `editorial_evidence` schema (`opening`, `completeness`, `structure`, `explanation`, `repetition`, `evidence`). Each one needs a concrete basis, with quotes for defects and a short specific reason for passes.

| Check | The question |
| --- | --- |
| Opening | Quote the first sentence. Does it hand over the reader's goal, problem or payoff right away? If the goal only shows up later, it fails. Restating the title ("To unlock X, complete its route") fails. A direct definition is fine when the reader asked for a definition. |
| Completeness | Can the reader do the promised task in order? List every essential prerequisite, resource and action from the brief and where the draft explains it. For a recipe guide, check that every ingredient across every prerequisite has a farming spot at the point of need. For a full unlock or how-to, trace every required stage through the reward. "Finish the questline" or a tracker reference is a central gap even if the brief approved it. |
| Structure | Does each section answer a distinct question? Do main H2s use searchable words with the game where it's natural, and do the heading shapes vary? Is media next to the explanation it belongs to? |
| Explanation | Does it sound like the voice guide: plain words, short clean sentences, real game nouns, a bit of personality where it fits, calm in troubleshooting? Does each paragraph handle the next obstacle? Flag manual voice, research voice, hype, filler, forced jokes, invented experience and literal nonsense ("bring access to an island"). |
| Repetition | Compare prose, steps, tables and FAQs. Is the same action or advice said twice, even in different words? Read actual table cells: does each row fit its column, and does each column add a new fact? If something repeats on purpose, name the different need it serves. |
| Evidence | Are approved facts, conditions and real uncertainty preserved? Did a stronger claim, a guarantee or a missing step sneak in? Compare each qualifier with the evidence, not just with the brief's suggested wording. Flag source-category labels ("community-documented") that don't help the reader. |

Also check every `faq_json` question on its own. Name the extra answer it adds that the body doesn't have, or mark `adds_information: false` and ask for removal or merging. Rewording a body heading as a question adds nothing. An FAQ section in `content_md` is invalid, because `faq_json` is already visible. An article with no FAQs doesn't need a replacement section.

When the brief names a useful option or condition (especially timing in a "when to use" guide), check that the draft uses it instead of generic advice.

## What blocks acceptance

- An unexplained required step. Send it back to research and keep the how-to unapproved. A tracker reminder or Early Access note doesn't fix it.
- A missing ingredient source, a contradictory instruction or a thin core explanation.
- Copy that reads like a report, a manual or a template, even if every fact checks out.

Don't invent scores. Heading counts, word counts, contractions, keyword checks and passing JSON or browser tests are not substitutes for reading the copy.

## Draft, feedback, one revision

1. The writer saves the first `final.json` as a draft and returns it. The filename isn't approval. Fix syntax while drafting, but save the real editorial work for the combined feedback.
2. The parent reads the brief and draft and writes a short sibling `editorial-review.md`: `Status: revision_required`, `Revision passes used: 0`, findings grouped by the six checks, and the exact changes requested. Write `no issue found` briefly for checks that pass. Name one strength worth keeping so the edit doesn't erase it. Don't paste the whole article.
3. Send all findings together to the same writer with the brief, media manifest and one or two relevant examples from [article examples](editorial-examples.md) or the voice guide examples. The writer revises the actual `final.json`, keeping the promise, facts, slug, hosted media and output contract. A promise to revise isn't a revision. If the draft had no defects, the writer does a final read and can keep what works. Don't ask for cosmetic changes.
4. The parent reads the revision, checks the requested fixes and looks for new factual or structural problems. Update the note to `Status: approved` or `Status: needs_attention`, with `Revision passes used: 1` and short evidence. Only approved copy moves on to import and the final and browser checks. Technical QA is still required.

A standalone writer with no parent runs these same steps on its own draft and returns the revised `final.json` plus the short review note. Specialized article shapes keep their media and block contracts.

## Keep recovery bounded

- Reuse the approved brief and media. An editorial problem doesn't justify new research, image searches, uploads or a restart. If the fact is already in the brief, move it to the right place.
- Before asking for research, search the whole brief, including reward notes and findings outside the writing packet, and quote what's there. A drop listed under boss rewards can be an ingredient source, and moving it into the farming section is a writing fix. Separate "missing from the draft," "in the wrong place" and "not in the evidence."
- If an essential fact is truly missing or contradictory, write the exact question and ask the existing researcher for a focused correction. Don't invent the answer or soften real uncertainty for flow. After the correction, continue from the kept draft. The revision counter doesn't reset.
- If headings change, update the manifest's placement headings without replacing approved images. Flag real mapping problems to the parent.
- After the one revision, any remaining editorial problem needs attention. Keep every artifact and the note, don't mark the queue completed, don't start another polish loop and don't switch models. The parent reports the exact defect and uses the existing blocked/backoff path for a claimed queue row. On recovery, read the note. Another pass needs an explicit user instruction. Don't change scheduler retry limits or queue schemas from this skill.
- If later technical checks find a narrow defect, fix only that and recheck it. That's not permission for a general rewrite. Recheck factual changes with the parent.

## Re-reviews

Read the earlier findings, confirm the requested fixes and look for regressions. Reuse accepted evidence unless a claim changed or a factual question is still open. Don't redo the whole research pass to review a prose edit. These checks are private review aids, never a required public article shape.

## Don't approve these by mistake

"Sources do not list a requirement" is a research result. It doesn't prove the requirement is absent, and it isn't how a player would explain buying something. Check the positive evidence and write the supported procedure. "Listed as retained" leaves the reader asking who listed it when the evidence already shows the behavior. Keep a real caveat when evidence is weak, but don't keep report wording just because the brief used it. These are examples of judgment, not a word blacklist.

## When the user asks for more passes

The normal unattended workflow keeps the one-revision limit. If the user explicitly asks to keep iterating until the quality is right, that allows more reviewed passes for that experiment. Keep a baseline and a short history, explain the defect behind each pass, reuse approved evidence and media, and judge the actual revised copy. Give feedback about outcomes and let the writer choose the fix. Stop when the article answers its promise clearly and naturally. If passes stall, report model limits and source limits separately instead of declaring success or piling on rules.

## Comparing writer models

When the user asks for a writing experiment, keep the approved facts, media and promise fixed for the first comparison. Save the original output outside the live article path and run the draft plus one revision in an isolated workspace. Compare the six checks and the manual edits still needed. Then try other formats, like an update explainer and another guide, before calling the workflow reliable. Don't start extra articles or live imports just to benchmark a skill change.

If section-by-section drafting is chosen after repeated weak results, give the same writer the full outline and shared facts, work through the hard sections, and use the one revision for continuity. That's a different drafting method, not an extra agent chain or more revision budget.
