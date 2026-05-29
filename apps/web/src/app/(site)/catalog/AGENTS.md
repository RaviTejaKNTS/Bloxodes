# Catalog Routes Guide

Scope: `apps/web/src/app/(site)/catalog`.

Use this file when creating or editing catalog hubs, dataset-backed catalog pages, category pages, or generic catalog copy pages.

## Catalog Page Types

- Hub page: `/catalog`
- Generic copy page: `catalog/[...slug]`
- Dataset browser page: decal IDs, color codes, music IDs, free items, The Forge
- Category or pagination page: free-items categories, music genres/artists/trending, paginated lists

## Required Page Contract

Every public catalog page should follow this structure unless there is a strong reason not to:

1. Breadcrumb
2. Hero with `h1`
3. Updated timestamp if a real content or dataset date exists
4. Intro copy
5. Primary interactive/data section
6. Secondary long-form sections: description, how-it-works
7. FAQ
8. Comments
9. JSON-LD / breadcrumbs / item-list schema where relevant

## Shared Building Blocks

- Breadcrumbs: `apps/web/src/components/PageBreadcrumb.tsx`
- Updated timestamps: `apps/web/src/components/UpdatedTimestamp.tsx`
- FAQ blocks: `apps/web/src/components/ContentFaq.tsx`
- Pagination: `apps/web/src/components/PagePagination.tsx`
- Shared content rendering: `apps/web/src/lib/page-content.tsx`

Do not re-implement these patterns inside each route unless the catalog page genuinely needs a different interaction model.

## Freshness Rules

- Public catalog routes should use real dates only.
- Prefer `content_updated_at`, then `updated_at`, then `published_at`, then `created_at`.
- Do not fall back to `new Date()` just to show an updated label or schema date.
- Default public catalog route revalidation is `86400` unless a page has a clearly faster update cycle.

## Publish Rules

- Public catalog routes should use published content loaders.
- Do not use draft-including loaders for public pages.
- If draft preview is needed, keep it in a separate preview-only flow.

## Data Source Rules

- Supabase copy should be loaded through `apps/web/src/lib/catalog.ts`.
- Dataset-backed pages should still use the shared page contract and shared UI primitives.
- Keep route files thin and move repeated rendering or loader logic into `page-data.tsx`.

## New Catalog Page Checklist

1. Decide whether the primary data comes from Supabase, a local dataset, or both.
2. For item-backed pages, confirm the player-usefulness gate and required fact matrix from `agents/content/PROCESS.md`; route fields should expose source-backed facts players need, not only whatever data is easiest to render.
3. Add or reuse a `page-data.tsx` helper if the route family has multiple pages.
4. Use the shared breadcrumb, updated timestamp, FAQ, and pagination primitives.
5. Add metadata, canonical handling, and JSON-LD.
6. Use published-only content loaders.
7. Set `revalidate` intentionally instead of copying another route blindly.
8. Update sitemap and revalidation coverage if the route is publishable.
9. Update `agents/pages/agents.md` if the route surface changes.
