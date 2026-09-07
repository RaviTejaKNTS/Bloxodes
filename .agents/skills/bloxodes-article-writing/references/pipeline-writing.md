# Focused pipeline writing contract

The controller has approved brief.md and media.json. Your job is final.json only; you may adjust media.json placement_heading to match your headings. Do not repeat research, inventory queries, image collection, uploads, import, or browser checks. If the approved evidence truly lacks a central answer, return the specific question to research. Use identity and confirmed internal URLs from the brief; do not construct collection paths from database codes.

Read the reader-facing writing packet first and private evidence notes as needed. Read editorial-standard.md and the closest original example in editorial-examples.md. The Beebom study is additional guidance when deciding how to handle an unfamiliar format. Examples teach explanation and prioritization, not phrasing or a required outline.

Choose a natural article around the reader's goal. Explain what matters and why, in connected, conversational American English. Give each substantial answer one home. Use helpful named events, tools and conditions from the approved evidence instead of replacing them with abstract goal/route advice. A table row must fit its column category and each cell should add a fact or consequence; switch to connected prose when there is little to compare. A table should help compare, steps should guide action, and surrounding prose should explain a consequence or choice rather than restating the same rows. Keep meaningful caveats beside the affected advice once. Source disagreements, verification methods, and source-category labels belong in private research notes unless an actual uncertainty changes the reader's decision. Do not replace a needed caveat with certainty.

Use specific searchable titles and H2s and contextual H3s. Do not force highlights, section counts, lengths, jokes, a stock opening, or a recap ending. Stop when the player's task is answered; a useful next decision can make a natural ending. Do not pad a complete answer with FAQs.

Output valid JSON with exactly these article fields:
- title, slug (preserve the assigned slug), meta_description, content_md.
- faq_json: an array of {q, a}. It renders a visible FAQ after the body and supplies structured data. This is the sole FAQ location. Never include an FAQ section in content_md. Each optional question must add a supported follow-up answer absent from the body; use [] when the body already answers the useful questions. There is no question quota.
- cover_image: null; the runtime owns cover generation.
- author_id: approved known ID or null; universe_id: the verified game universe ID from the brief for a game-linked article.
- tags: specific reusable labels; sources: URLs supporting the actual facts; is_published: true (managed-development import only; the controller owns publication permission).
Do not include seo_title or internal review notes.

Insert all verified hosted images from media.json at their useful matching headings with factual alt text. Preserve approved URLs and provenance. Accepted missing entries need no substitute. Never insert the cover as a body image. Use confirmed links naturally where the destination helps. Perfect-match approved YouTube media is optional using {{ youtube: URL }} on its own line. Specialized blocks follow the relevant page-type skill.

Before returning, read the complete copy aloud in your head. Check the title's promise through the result, repeated explanations, misplaced evidence language, useful headings, and FAQ value. Parse the JSON. Return a draft or revision decision, not self-approval. A separate reviewer evaluates it; code performs QA.
