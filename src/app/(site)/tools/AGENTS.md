# Tools Routes Guide

Scope: `src/app/(site)/tools`.

Use this file when creating or editing tool hubs, dedicated calculator routes, or the generic tool copy fallback.

## Tool Page Types

- Tool hub: `/tools`
- Generic tool copy page: `tools/[...slug]`
- Dedicated interactive tool page: calculator or utility routes with a colocated client component
- Paginated tool list page: `/tools/page/[page]`

## Required Tool Page Contract

Every public tool page should follow this structure unless there is a strong product reason not to:

1. Breadcrumb
2. Hero with `h1`
3. Updated timestamp if a real tool content date exists
4. Intro copy
5. Primary tool UI
6. Long-form sections: description, how-it-works
7. FAQ
8. Comments
9. Structured data for `WebPage` plus `WebApplication`

## Shared Building Blocks

- Breadcrumbs: `src/components/PageBreadcrumb.tsx`
- Updated timestamps: `src/components/UpdatedTimestamp.tsx`
- FAQ blocks: `src/components/ContentFaq.tsx`
- Shared content rendering: `src/lib/page-content.tsx`
- Tool list cards: `src/components/ToolCard.tsx`

Prefer reusing these pieces over rebuilding the same layout in each tool page.

## Freshness Rules

- Public tool pages should use `content_updated_at`, then `updated_at`, then `published_at`, then `created_at`.
- Do not manufacture an updated date with `new Date()` for display or schema.
- Tool pages and the tools hub should generally revalidate every hour unless a slower cadence is explicitly justified.

## Publish Rules

- Public tool pages should use published content.
- Dev-only fallback content is acceptable for local non-production workflows, but production pages should never depend on draft content.

## Layout Rules

- Keep the interactive client tool inside a thin server wrapper page.
- Use the same section order across dedicated tool pages and the generic tool fallback.
- If a tool has related-content sidebar behavior, keep that logic explicit and consistent across similar tools.

## New Tool Page Checklist

1. Add or reuse a colocated client component for the interactive UI.
2. Load tool copy through `src/lib/tools.ts`.
3. Render intro, description, how-it-works, and FAQ through `src/lib/page-content.tsx`.
4. Use the shared breadcrumb, updated timestamp, and FAQ primitives.
5. Add `WebPage` and `WebApplication` JSON-LD.
6. Set `revalidate` intentionally, usually `3600`.
7. Add the tool to the tools hub / inventory if it is public.
8. Update `agents/pages/agents.md` if the route surface changes.
