---
name: bloxodes-writing-core
description: Shared Bloxodes content voice, style, and quality rules. Use when writing, rewriting, reviewing, or polishing any Bloxodes public copy for Supabase-backed pages, catalog pages, wiki hubs, articles, tools, lists, quizzes, checklists, metadata, FAQ, Markdown fields, or JSON content fields.
---

# Bloxodes Writing Core

## Start Here

Read `agents/content/writing-core.md` before writing or editing Bloxodes public copy. That file carries the voice, the taste, and the quality bar. Treat it like the editor sitting next to you.

For serious rewrites, also read:

- `agents/content/PROCESS.md`
- `agents/content/research-policy.md`
- `agents/content/final-edit.md`

If those files have not been read in the current task, read them before producing public copy. Do not guess the Bloxodes style from memory.

## How To Use This Skill

Bloxodes writing should sound like a useful Roblox player explaining the part that matters. It can be friendly and natural, but it should never drift into filler, hype, or website-focused copy.

Start with the reader's reason for being there. They may want to compare items, understand a mechanic, redeem a reward, use a tool, or decide whether something is worth chasing. The first draft should already serve that goal.

Keep the copy game-first. Explain the item, mechanic, event, code, tool result, or collection directly. Do not explain the website, the database, the route, or the existence of the catalog unless the UI itself requires that wording.

Give context before asking the reader to understand a field. `Rarity`, `source`, `availability`, `chance`, `seats`, `uses`, `refresh`, `Full Grown`, `Neon`, and similar terms only work after the page explains what they mean in play.

Write in simple English with natural rhythm. Some sentences can be short. Some can carry a little more explanation. The goal is not to sound casual for its own sake; the goal is to sound clear, human, and useful.

Use examples when they teach a reusable pattern. Avoid examples that make the workflow feel locked to one game or one page type.

When a sentence can fit almost any Roblox page, rewrite it. When a normal player can ask "what does that mean?" and the next sentence does not answer it, rewrite it.

## Output Standard

When producing content, return the target database shape when possible:

- Supabase fields as JSON for catalog, wiki, and tool-like pages.
- Article fields as JSON, with Markdown inside `content_md`.
- `research-notes.md` and `final.json` as the only local generated artifacts for serious content work.

Do not call content finished until `bloxodes-final-edit` has been applied.
