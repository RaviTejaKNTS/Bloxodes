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
    compact: "0.1875rem"
    panel: "0.25rem"
  layout:
    topBarHeight: "3.5rem"
    rightRailWidth: "21rem (336px) from 1200px"
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
- Use clean, restrained shadcn-style primitives for interface surfaces: navigation items, search inputs, buttons, cards, badges, tabs, sheets, dialogs, dropdowns, tooltips, loading states, and empty states.
- Prefer plain page layouts with strong content hierarchy. Let reusable components carry the product/database feel.
- Avoid heavy custom decorative layouts inside shadcn primitives. Compose primitives simply and override only enough to match Bloxodes tokens.
- Site navigation is the sticky top bar (`SiteHeader`): section links on one line, search, a More drawer and the account button. There is no left sidebar, so the main column gets the full width. Keep nav items quiet: compact text links, subtle hover/active fills and no borders.
- Content pages put one right rail (`PageSidebar`) beside the main column. From 1200px it is a fixed `21rem` (336px), which leaves room for Mediavine's 300px sticky sidebar ads; from 1024px the columns split `3fr / 1.25fr`. Keep rail content short so the first sidebar ad shows early. Page text fills the main column, on every page with a rail, so no gap opens between the text and the rail.

## Layout

- Main content starts with the same vertical rhythm across page families: `py-6 md:py-8 xl:py-10`.
- Every section link stays in the server HTML. Top bar links that don't fit wrap out of view, and the More drawer (a right-side sheet on every screen size) lists them all. Keep the drawer compact and readable rather than full-screen.
- The header and More drawer always show the same 11 section links, on every page. Game-specific links never go there.
- Game and catalog pages can add a second bar under the header (`SiteGameTopBar`). On a game page it shows that game's name and one plain link per page type it has (Wiki, Articles, Codes, Gameplay Checklist, Quiz, Map), plus a Tools menu, for Roblox and non-Roblox alike. Articles links to the game's article list, never to single articles. Pages without contextual links, and franchise pages spanning several games, show no second bar.
- The homepage has no rail. From 1280px some of its blocks share a row in pairs; see Advertising in `bloxodes-docs/overview.md` for why each block stays a separate element.

## Components

- New shared UI components should live in `src/components/ui` when they are shadcn primitives or close extensions of shadcn primitives.
- Use Bloxodes theme tokens through Tailwind classes instead of one-off color values.
- Cards and controls should be compact, bordered, and neutral. Avoid oversized rounded cards, nested cards, and decorative gradients.
- Navigation and search should behave like database navigation: persistent, scoped, fast, and minimal.
- Search should scope to the current content family when the route is specific, and fall back to global search on the homepage and neutral/legal pages.
- Search results should read as list rows, not heavy cards.
- Navigation sections should use quiet labels where they help scanning, but avoid turning the public site into a literal workspace clone.
- "More …" page lists in the rail use `RailLinkList`: one row per page with its image when it has one, otherwise an icon picked from the URL, and a one-line description. New pages need no extra data to look right.
- Wiki collection pages have one sidebar for every game and collection type (`GameCollectionsRail`, instead of a "More …" `RailLinkList`). The order is: share, wiki card, a `More <game> collections` panel with the next 3 collections, a flat unboxed `All other <game> collections` list of inline links, then the game's other pages. Articles on these pages have no cover image. Below 1024px, only the panel and list show, below the page content.
- Copyable codes and IDs on cards use `CopyCodeButton` with `variant="bar"`: one full-width button showing the code and a Copy label.
- Images in page text stop at 720px wide and 480px tall (`--content-image-max-width` and `--content-image-max-height` in `article-content.css`). Galleries are exempt.

### Collection cards

Wiki collections and collectables use one card design for every game (`CollectionCardContent`). There are at most 3 cards per row.

- Order: centered title, inset 16:10 image or video, left-aligned description, then fact rows in the order the collection's data gives. Collectables put the checkbox left of the title and the `#n` right of it.
- Fact rows: label on the left, value on the right, thin lines between. There are no pills and no panels. Lists show one line per item.
- Long text: descriptions over 135 characters stop at 3 lines and values over 100 characters stop at 4, each with a small Read more. Clip with CSS only, so the full text stays in the page HTML. Lists and links are never cut.
- Color: only a label reading `Status` gets the green, amber or red value color, in cards and in List view. `chip` and `highlight` in `fieldPresentation` stay as data for the mobile app; they don't change the website's look.
- Rows line up: every card in a row shares CSS subgrid tracks, so the tallest title, description or fact sets the height for all of them. Facts are matched by field key. A field empty on all cards in a row is dropped; otherwise a card without it shows `-`. A row with an image keeps the initials box on cards that have none, and a page with no images leaves no image space.

## Content

- Public pages remain SEO-first and reader-friendly.
- Articles and guides can use large headings and comfortable paragraph spacing.
- Data-heavy sections can be denser, but should still be readable on mobile.
- Do not convert article content into a dashboard layout. Apply the database feel to the shell and reusable UI controls.
- Every visible heading must help the reader understand a distinct section. Do not add `Browse all...` or similar headings merely to repeat the H1 or satisfy document hierarchy.
- Avoid decorative eyebrows, redundant labels, status text, count lines, and badges on public content cards. Keep one only when it provides decision-relevant information that is not already clear from the title, value, control, or surrounding context.
- Prefer large, readable item names and previews over dense card metadata. Keep functional labels only where accessibility or ambiguity requires them.

## Interaction

- Prefer direct, inline interactions over modals when the current surface can handle the workflow.
- Search inputs must retain focus while typing and should never remount on each keystroke.
- Clear buttons should appear only when there is something to clear.
- Scoped search should prioritize exact title, title prefix, word prefix, title substring, then broader body/search-text matches.

## Visual Constraints

- Do not use decorative orb, bokeh, or gradient blob backgrounds.
- Do not use one-note palettes dominated by one hue family.
- Do not place cards inside cards.
- Keep text inside controls from wrapping awkwardly or overflowing.
- Use lucide icons for common actions instead of custom-drawn icons when an icon exists.

## Feature Thumbnails

Small feature images should follow the [Bloxodes Single-Object Thumbnail System](bloxodes-docs/design/feature-thumbnails.md). The default is one immediately recognizable subject on a quiet background, composed for recognition at card size rather than detail at full resolution. Avoid miniature scenes, floating interface panels, explanatory diagrams, and decorative supporting objects.
