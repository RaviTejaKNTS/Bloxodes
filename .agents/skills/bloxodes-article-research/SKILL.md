---
name: bloxodes-article-research
description: Research one approved Bloxodes article idea and create brief.md before writing. Use for article evidence checks, source coverage, production overlap, related page-type overlap, title promise, outline, facts to use, facts to avoid, and open gaps. Do not write final.json.
---

# Bloxodes Article Research

Use this for one approved article idea. Research only. Do not write the article and do not create `final.json`.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
```

## Start

Start by checking if we have already covered in this article on the production db. If the article belongs to a game, you can check the db with the universe id to find the articles of that specific game easily. This is to make sure we are not writing an existing article.

## Research

1. Do a deep dive into the topic and the game if the topic is about a specific game. Try to get a good understanding of what will be useful for people in this topic.

2. Do fan out queries to fill up any gaps, do not speculate anything, confirm all the info you have researched.

3. You can also check trusted websites like Beebom, Pro Game Guides, game specific wiki pages, fandom, TechWiser, IGN, Game Rant and Eurogamer. Does not have to stick with the provided sources, use all the info you can gather.

4. Do not stop at first indexed results, dig deeper, click though internal links of the sources to get a holistic understanding.

5. Once done, understand what will be useful for people reading this article and what can be skipped. We write simple, clean and easy to understand and quick to read kind of articles. So make sure our research is helpful for that.

6. Only one you have searched all the sources and only when you think there are no gaps in the info, then continue and write `brief.md`.

## Article Outline

In the `brief.md`, you need to include the article outline. Follow these rules:

1. We keep the structure of the article simple to scan through. If two headings are good enough, we just roll with them.
2. A article should not have more than 3 H2s unless very much needed for the topic. For example, a listicle may need more headings which is fine, but a casual explainer or how to, having 2 headings can be more than good enough.
3. So use fewer headings that are simple to read and almost sentence like (not generic SEO headings).
4. Headings can give away the info without people needing to dig into the text.
5. In outline, you just need to provide headings and a small one to two lines of what needs to be included under it.
6. If required, you can suggest to include table, lists or numbered lists that can go into any section when it makes sense.
7. For example, when writing how to, do not write "What it is" headings when it is obvious. Things can simply go into intro, directly to point without any fluff. So your outline should respect that.

Title need to be in simple human language, small but full sentence, people seeing this title on search should understand and open our page.

For game-specific articles, include the game name in the working title and suggested slug so readers know which game the guide is about. You can use `Roblox` wording when it helps search or clarity.

## Brief Shape

For `brief.md` Use this shape:

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source/competitor coverage:
- Related page-type overlap:
- Useful uncovered angle:

Article plan:
- Working title:
- Suggested slug:
- Title promise:
- Reader need:
- Facts to use:
- Facts to avoid:
- Open gaps or risks:

Outline:
- cleanly list out the outline here.

```

If research is weak, say what is missing. Do not pretend the article is ready.

## Good Briefs

- show what was checked
- include useful links
- name existing Bloxodes overlap clearly
- explain why this should be an article, not another page type
- give an outline that answers the title promise
- separate facts to use from facts to avoid
- make gaps obvious so the parent can approve, refine, or block the article
