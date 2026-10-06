# One Editorial Revision Before Acceptance
In the code-controlled pipeline, a separate focused model invocation performs this review, and the runtime routes findings and writes the review note. The reviewer cannot edit artifacts or manage workers. The writing invocation produces the draft or requested revision only. Apply the same substantive criteria below; code, rather than a model parent, owns the retry count and acceptance transition.

Use this after the first draft and before import. The existing parent reviews; the same writing agent revises. Keep the configured model and reasoning effort, including Luna when selected. Do not add an editor agent or escalate to a different model for prose quality.

## Review the reader's task

First read the actual public draft against [the shared editorial standard](editorial-standard.md), before reading the evidence brief. Judge it as a player: does the language sound like usable advice, or like a report about what sources documented? Note concrete weaknesses in phrasing, explanation and repetition. Then consult the approved brief for accuracy and completeness; do not let its research language become the standard for public prose. A factually supported draft can still require writing revision. Check these five dimensions and record concrete locations/examples for defects:

| Dimension | Acceptance question |
| --- | --- |
| Practical completeness | Can the reader perform the promised task in order? Are prerequisite ingredients and their sources, controls, conditions, and outcomes explained where needed? For other formats, can they understand the change or make the promised choice? |
| Natural explanation | Does the opening lead with the player's goal or consequence? Do paragraphs explain the next obstacle in familiar language, without invented experience or evidence-report phrasing? |
| Structure | Does each section answer a distinct question? Are searchable H2s and contextual H3s grouped around the task, with media beside the explanation? |
| Repetition and emphasis | Do steps duplicate adjacent prose? Does each table column add information? Are useful details developed and minor tangents kept in proportion? |
| Evidence fidelity | Does the draft preserve approved facts, conditions, and meaningful uncertainty? Did an unsupported guarantee, stronger claim, or missing step appear during writing? |

Before assigning findings, make these short evidence checks in the local review note. They are reading aids, not additional public article tables:

- **Promise check:** compare the public title and opening with the actual instructions, independently of the brief's approval label. For a full unlock/how-to, enumerate every mandatory stage through the reward and identify the explained action and completion condition. Mark an unexplained “finish the questline” or tracker referral as a central gap, even if the brief explicitly approved it. A title cannot promise the full procedure while a private note limits the article to prerequisites and location.
- **Completeness trace:** list each essential prerequisite, resource, or action from the approved brief and its usable location in the draft. For a recipe guide, compare the union of ingredients across every prerequisite and final recipe with the actual farming guidance. A resource named only in a distant reward list is not explained at the point of need. For other formats, trace the promised controls, fixes, or changes and their practical explanations. Mark omissions or misplaced answers explicitly; “material sources are covered” is not evidence.
- **Opening check:** quote the actual first sentence and identify the player's goal/problem and first obstacle. For an acquisition guide, assess whether item classification or procedural jargon delays the desired reward. If the goal appears later, do not call the opening goal-first merely because it eventually mentions the goal. A direct definition can be appropriate for a definition question; match the reader promise. Merely restating “to unlock X, complete its route” also fails to explain an obstacle or reason to care. Quote the useful context that the opening actually supplies before approving it.
- **Structure and repetition check:** compare adjacent prose, ordered steps, and tables for the same actions. Give a concrete example of any duplication or explain briefly what distinct job each format does. Examine table cells before declaring their columns useful. Check whether troubleshooting adds a distinct diagnosis or merely repeats prerequisites, and whether adjacent requirement items name the same action twice.
- **Uncertainty check:** compare each meaningful qualifier with the underlying evidence, not just wording the brief suggested. Preserve actual uncertainty; flag repeated source-category labels that do not help the reader. Approval of research does not require copying the researcher's proposed phrasing.

Use these observations for the five judgments. A passing dimension still needs a short specific basis, not generic praise. Do not let the draft's assertion that it covers “every ingredient” stand in for checking the rows.

An unexplained mandatory objective prevents acceptance before prose polishing. Return it to research and keep the how-to unapproved; a generic tracker reminder or Early Access disclaimer does not resolve it. After the procedure is supported, evaluate the actual prose rather than accepting every instruction from an approved brief.

A missing ingredient source, contradictory instruction, or thin central explanation prevents acceptance. Do not invent numeric grades or treat heading/word counts, contractions, keyword checks, or successful JSON/browser tests as substitutes for judgment.

## Draft, feedback, one revision

1. The writer saves the initial `final.json` as a draft and returns it to the parent. This filename is not approval. Correct syntax while drafting, but reserve the substantive editorial revision for the combined feedback.
2. The parent reads the brief and draft and writes a short sibling `editorial-review.md`: `Status: revision_required`, `Revision passes used: 0`, findings grouped by the five dimensions above, and the exact changes requested. Record `no issue found` briefly for dimensions that pass. Include a specific strength worth retaining so an edit does not erase useful detail. Do not copy the whole article into feedback.
3. Send the findings together to the same writer with the approved brief, media manifest, and one or two relevant before/after examples from `editorial-examples.md`. The writer revises the actual `final.json`, preserving the reader promise, facts, slug, hosted media, and output contract. A checklist or promise to revise is not the deliverable. If the first draft has no defects, the writer performs the final reader pass and may retain copy that already works; do not demand cosmetic changes.
4. The parent reads the revised copy, checks both the requested fixes and possible factual/structural regressions, and updates the note to `Status: approved` or `Status: needs_attention`, with `Revision passes used: 1` and concise evidence. Only approved copy proceeds to import and the existing final/browser checks. Technical QA remains required.

For a standalone writing invocation without a parent, the writer performs these same review and revision steps itself and returns revised `final.json` plus the short review note. This replaces, rather than adds to, other generic self-edit instructions. Specialized article shapes retain their media and block contracts.

## Keep recovery bounded

- Reuse the approved brief and media. An editorial defect does not authorize a new research run, image search, upload, or complete workflow restart. If a detail is already in the brief, place it correctly in the article instead of browsing again.
- Before requesting research, search the entire approved brief, including reward notes and source-backed findings outside the writing packet. Quote the relevant existing evidence in the private feedback. A drop listed in boss rewards can supply an ingredient source; moving that supported fact into farming guidance is a writing correction. Distinguish missing from the draft, misplaced in the draft, and absent from the evidence.
- If an essential fact is genuinely missing or contradictory in the evidence, record the exact question and request a focused brief correction from the existing researcher. Do not invent the answer or weaken necessary uncertainty for a smoother voice. After correction, continue from the retained draft; it does not reset the revision counter.
- If headings change, reconcile the existing manifest's placement headings without replacing approved images. Flag an actual mapping problem to the parent; do not silently remove useful media.
- After one substantive revision, unresolved editorial problems require attention. Preserve all artifacts and the review note; do not mark the queue completed, start another polish loop, or switch models. The parent reports the specific remaining defect and uses the existing blocked/backoff path for a claimed queue row. On recovery, read this note and do not silently reset the counter; another editorial pass requires an explicit user instruction. Do not change scheduler retry limits or queue schemas through this skill.
- If later technical checks expose a narrow correctable defect, repair only that defect and recheck the affected output. They do not authorize another general rewrite. Recheck factual changes with the parent before acceptance.

## Explicit user-authorized quality experiments

The normal unattended workflow retains its one-revision limit. If the user explicitly asks to iterate until the quality is acceptable, that authorization permits further reviewed passes for the experiment. Retain a baseline and a short iteration history, explain the substantive defect motivating each pass, reuse approved evidence/media, and judge the actual revised copy. Keep feedback about outcomes; let the writer choose the form. Do not continue cosmetic revisions after the article fulfills its promise clearly and naturally. If repeated passes stall, report the specific persistent model limitations and source limitations separately rather than declaring success or endlessly adding rules.

## Comparing Luna results

When the user requests a writing experiment, keep the approved facts/media and article promise fixed for the first comparison. Retain the original output outside the live article path; run the draft and one revision in an isolated workspace. Compare the five dimensions above and the remaining manual edits. Then use other approved formats, such as an update explainer and another guide, before claiming the workflow is reliable across articles. Do not start extra articles or live imports merely to benchmark a skill change.

If section-level drafting is explicitly chosen after repeated weak results, give the same writer the complete outline and shared facts, work through difficult sections, and use the single revision for continuity. This is an alternative drafting method, not an extra agent chain or additional revision budget.

## Machine-readable review evidence

For code-controlled editorial review, return editorial_evidence matching the supplied schema. Assess opening, completeness, structure, explanation, repetition, and evidence exactly once, each with actual verbatim draft quotations and a specific assessment. Quote the opening itself for the opening check. For repetition, compare locations/formats, not merely whether identical sentences recur. For evidence, compare meaningful qualifiers with the brief. For completeness, trace the necessary actions and conditions through the promised result. Passing judgments require evidence too; a generic summary cannot grant approval.

Audit every faq_json question individually: identify the useful additional answer absent from the body, or mark adds_information false and request removal/integration. Rephrasing a body heading as a question does not add information. faq_json is already visible on the page; an FAQ in content_md is invalid. An article with no FAQs needs no replacement section.

On re-review, read the retained earlier findings, verify the requested corrections and check for regressions. Reuse accepted source evidence unless a changed claim or unresolved factual question requires checking it. Do not repeat the entire research pass to review a prose edit. These are private review checks, never a required public article shape.

In the completeness check, compare actionable named options/conditions in the brief with the draft: flag generic substitutes that hide a useful supported answer, especially timing in a “when to use” guide. In structure/repetition checks, quote and assess actual table cells, not only headers: does each row belong to the column category, and does each column add a different fact or consequence? Repetition can be the same advice in different words across sections. Explain any deliberate repeat by the distinct reader need it serves. Do not request removal of useful depth merely to shorten the piece.

### Avoid false editorial approvals

“Sources do not list a requirement” reports a research result; it neither proves the requirement is absent nor explains the purchase naturally. Check the actual positive procedure evidence and write that supported procedure. “Listed as retained” leaves the reader wondering who listed it when the evidence already establishes the behavior. Keep a necessary uncertainty when evidence is weak, but do not use source-report wording merely because it appears in the brief. Also check literal sentence sense: “bring access to an island” is not a natural player action. These examples illustrate judgment, not a blacklist of words or a license to remove factual caveats.
