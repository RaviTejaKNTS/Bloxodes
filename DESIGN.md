---
name: Bloxodes Live Database
version: 1.0
description: Public Roblox live database with readable editorial content and compact shadcn-style UI primitives.
tokens:
  color:
    background:
      light: "rgb(237 240 248)"
      dark: "rgb(5 6 8)"
    surface:
      light: "rgb(226 229 243)"
      dark: "rgb(12 14 18)"
    surfaceMuted:
      light: "rgb(212 215 231)"
      dark: "rgb(20 23 29)"
    foreground:
      light: "rgb(32 38 60)"
      dark: "rgb(238 241 247)"
    muted:
      light: "rgb(110 118 146)"
      dark: "rgb(164 173 190)"
    border:
      light: "rgb(198 202 224)"
      dark: "rgb(49 56 68)"
    accent:
      light: "rgb(79 70 229)"
      dark: "rgb(132 169 255)"
    sidebar:
      background:
        light: "hsl(220 14% 96%)"
        dark: "hsl(220 9% 7%)"
      accent:
        light: "hsl(220 13% 91%)"
        dark: "hsl(220 8% 12%)"
      border:
        light: "hsl(220 12% 84%)"
        dark: "hsl(220 8% 19%)"
  typography:
    family: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    body: "text-[1.05rem] md:text-[1.09rem] leading-relaxed"
    sidebar: "13px medium"
    sectionLabel: "11px uppercase"
  radius:
    compact: "0.375rem"
    panel: "1.25rem"
  layout:
    sidebarWidth: "240px"
    contentTopPaddingDesktop: "2.5rem"
    contentTopPaddingTablet: "2rem"
    contentTopPaddingMobile: "1.5rem"
  icons:
    library: "lucide-react"
    sidebarSize: "14px"
---

# Bloxodes Design System

Bloxodes should feel like a public live database with readable editorial content. It is not an internal admin dashboard and not a marketing landing page. Use this file as the root design source for UI work.

The shell may take inspiration from Notion-style product surfaces: quiet navigation, compact rows, subtle active states, and content-first workspace rhythm. This is inspiration only. Do not copy Notion's exact product layout, wording, placement, or proprietary interaction model.

## Core Direction

- Keep page and article titles large when they support reading, scanning, and SEO.
- Keep body copy comfortable and readable. Do not shrink long-form content into dashboard-sized text.
- Use clean, restrained shadcn-style primitives for interface surfaces: sidebar, navigation items, search inputs, buttons, cards, badges, tabs, sheets, dialogs, dropdowns, tooltips, loading states, and empty states.
- Prefer plain page layouts with strong content hierarchy. Let reusable components carry the product/database feel.
- Avoid heavy custom decorative layouts inside shadcn primitives. Compose primitives simply and override only enough to match Bloxodes tokens.
- The primary sidebar should stay narrow and calm at `240px` on desktop. Use compact rows, 16px or smaller icons, subtle hover/active fills, and avoid loud borders around normal nav items.

## Layout

- Main content starts with the same vertical rhythm across page families: `py-6 md:py-8 xl:py-10`.
- Sidebar header spacing should visually align with desktop content top padding.
- Sidebar logo is centered within the sidebar width. Mobile close buttons or controls must not push the logo off-center.
- On mobile and tablet, the sidebar opens as a sheet. Keep the drawer compact and readable rather than full-screen unless required by the route.

## Components

- New shared UI components should live in `src/components/ui` when they are shadcn primitives or close extensions of shadcn primitives.
- Use Bloxodes theme tokens through Tailwind classes instead of one-off color values.
- Cards and controls should be compact, bordered, and neutral. Avoid oversized rounded cards, nested cards, and decorative gradients.
- Sidebar and search should behave like database navigation: persistent, scoped, fast, and minimal.
- Search should scope to the current content family when the route is specific, and fall back to global search on the homepage and neutral/legal pages.
- Sidebar search results should read as list rows, not heavy cards.
- Sidebar sections should use quiet labels where they help scanning, but avoid turning the public site into a literal workspace clone.

## Content

- Public pages remain SEO-first and reader-friendly.
- Articles and guides can use large headings and comfortable paragraph spacing.
- Data-heavy sections can be denser, but should still be readable on mobile.
- Do not convert article content into a dashboard layout. Apply the database feel to the shell and reusable UI controls.
- Every visible heading must help the reader understand a distinct section. Do not add `Browse all...` or similar headings merely to repeat the H1 or satisfy document hierarchy.
- Avoid decorative eyebrows, redundant labels, status text, count lines, and badges on public content cards. Keep one only when it provides decision-relevant information that is not already clear from the title, value, control, or surrounding context.
- Prefer large, readable item names and previews over dense card metadata. Keep functional labels only where accessibility or ambiguity requires them.

## Interaction

- Prefer direct, inline interactions over modals when the sidebar or current surface can handle the workflow.
- Search inputs must retain focus while typing and should never remount on each keystroke.
- Clear buttons should appear only when there is something to clear.
- Scoped search should prioritize exact title, title prefix, word prefix, title substring, then broader body/search-text matches.

## Visual Constraints

- Do not use decorative orb, bokeh, or gradient blob backgrounds.
- Do not use one-note palettes dominated by one hue family.
- Do not place cards inside cards.
- Keep text inside controls from wrapping awkwardly or overflowing.
- Use lucide icons for common actions instead of custom-drawn icons when an icon exists.
