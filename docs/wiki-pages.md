1. Create a new Supabase migration for `wiki_pages`.

2. Add fields to `wiki_pages`: `id`, `slug`, `title`, `seo_title`, `meta_description`, `universe_id`, `controls_json`, `tips_md`, `is_published`, `published_at`, `created_at`, `updated_at`.

3. Create `wiki_pages_view` that joins or exposes render-friendly wiki fields and keeps `content_updated_at`.

4. Add indexes for `slug`, `universe_id`, and published wiki pages.

5. Add revalidation trigger support for wiki pages.

6. Add wiki page read helpers in `src/lib/wiki.ts`, similar to `src/lib/tools.ts` and `src/lib/catalog.ts`.

7. Add `/wiki` index page.

8. Add `/wiki/[slug]` route for the game hub page.

9. Add wiki metadata generation: SEO title, description, canonical, OG image, published/modified time.

10. Add wiki sitemap coverage.

11. Add wiki search index coverage if site search should include wiki pages.

12. Add related cards on the wiki hub: codes, tools, events, articles, checklists, quizzes, and published catalog pages where available by `universe_id`. Catalog pages can provide wiki-specific copy through `catalog_pages.wiki_md`, stable placement through `catalog_pages.wiki_sort_order`, and CTA background art through `catalog_pages.wiki_image_urls`.

13. Add Roblox universe metric blocks: playing now, visits, favorites, likes, dislikes, like ratio.

14. Add Roblox universe detail blocks: devices, voice, age rating, avatar type, genre, created date, last updated date.

15. Add media block using existing universe thumbnails/posters/video data where available.

16. Add developer block using existing Roblox universe creator/developer fields.

17. Add game passes and badges block from existing Roblox universe tables.

18. Add server details block only when server data exists.

19. Add game lists/rankings block from existing list data.

20. Add articles block for articles connected to the same `universe_id`.

21. Add controls block from `wiki_pages.controls_json`.

22. Add features/tips block from `wiki_pages.tips_md`.

23. Add optional current events/events history block from the events system.

24. Add optional quiz/trivia card if quizzes exist for the same `universe_id`.

25. Add shadcn setup properly if `components.json` is missing.

26. Build Bloxodes-specific shadcn-style primitives: compact data row, section shell, media frame, and related link list.

27. Create a new minimal wiki template without moving the existing Forge catalog/wiki page.

28. Run TypeScript check.

29. Update docs: `apps/web/src/app/(site)/AGENTS.md`, `apps/web/src/lib/AGENTS.md`, and relevant `agents/*` inventory docs.
