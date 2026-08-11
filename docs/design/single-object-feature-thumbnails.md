# Bloxodes Single-Object Feature Thumbnail System

This is the default visual system for small Bloxodes feature images used on tool cards, catalog cards, related-content rows, compact previews, and similar surfaces. It is designed for images that are usually seen between roughly 48 and 160 CSS pixels wide.

The governing idea is simple:

> One recognizable object on one clean background.

The thumbnail should be understood before its details are inspected. It is not a miniature hero illustration, interface mockup, infographic, or scene.

## Design Goals

- Read instantly at small sizes.
- Give each page a memorable visual identity without competing with its title.
- Feel polished and friendly while staying consistent with Bloxodes' restrained live-database design.
- Work in square cards, cropped previews, metadata images, and related-content rows.
- Avoid dependence on tiny text, fine detail, or supporting context.
- Stay generic and safe when a page concerns a third-party platform, currency, avatar system, or product.

## Core Rules

### One subject

Use exactly one dominant subject whenever possible. A subject may be a single avatar bust, calculator, name tile, chest, potion, controller, map pin, or other concrete visual metaphor.

A second element is allowed only when it is structurally attached to the first and necessary for recognition. Examples include an equals key on a calculator or an `@` symbol inset into a username tile. It should still read as one unified icon.

Do not build a scene from several individually meaningful objects. If the concept needs arrows, charts, cards, badges, panels, or explanatory callouts to make sense, simplify the concept again.

### One background

Use a quiet, uninterrupted background with a single base color. The background exists to separate the silhouette, not to tell a story.

- No grids, landscapes, rooms, interfaces, patterns, particles, bokeh, or decorative geometry.
- Avoid visible gradient effects. Soft lighting falloff is acceptable only when it does not become a decorative glow.
- Choose enough contrast that the subject remains distinct in light and dark site themes.
- Prefer muted indigo, plum, teal, rust, ochre, blue-gray, or similarly restrained hues.

### Strong silhouette

The outer shape should communicate the category even when interior detail is lost.

- Keep the subject centered or optically centered.
- Let it occupy about 60 to 70 percent of the canvas.
- Preserve approximately 12 to 18 percent safe padding on every edge.
- Use a front-facing or mild three-quarter view. Avoid dramatic perspective.
- Prefer broad, rounded, chunky forms over narrow or intricate ones.
- Do not crop the defining part of the object.

### Minimal detail

Use only the details needed to identify the subject.

- Avatar: face, head, shoulders, and a plain shirt are enough.
- Username: one name tile with an `@` symbol is enough.
- Calculator: display, a few oversized keys, and one equals key are enough.
- Do not add miniature labels, charts, inventories, status dots, shadows from unrelated objects, or ornamental trim.
- If a detail disappears at 64 pixels without changing recognition, remove it.

## Visual Language

### Form

- Soft 3D editorial iconography.
- Rounded corners and lightly softened edges.
- Simple, believable depth without photorealism.
- Friendly proportions and neutral expressions.
- One clear foreground plane rather than layered scenery.

### Materials

- Mostly matte or satin surfaces.
- Subtle texture is acceptable, but should not create visual noise.
- Avoid glass, chrome, neon tubes, highly reflective metal, smoke, and translucent materials.
- Use gentle contact grounding when helpful, without a visible floor or elaborate cast shadow.

### Lighting

- Soft studio lighting from one broad source.
- Enough shading to explain the form at small size.
- No theatrical rim lights, lens effects, glowing halos, or multiple colored light sources.
- Keep highlights broad and shadows soft.

### Color

Use a small palette:

1. One muted background color.
2. One light neutral for the main object.
3. One charcoal or near-black detail color.
4. Optionally, one restrained semantic accent.

The accent should support meaning, not decoration. Green can identify an equals key or confirmed state. Indigo can support identity/profile tools. Plum can support naming or creative tools. Do not use several accents merely to make the thumbnail colorful.

Adjacent thumbnails should vary their background hue enough to be distinguished in a list while preserving the same lighting, material, scale, and composition rules.

## Typography and Symbols

Avoid words and numbers. Small thumbnail text is hard to read, localization-sensitive, and prone to generation errors.

A single universal symbol is acceptable when it is the concept:

- `@` for usernames or handles.
- `=` for a calculator result.
- A simple check only when verification is the primary page task.

Treat the symbol as part of the object, not as a floating annotation. Never use platform logos, currency marks, fake trademarks, or marks that can be confused with a platform's official branding.

## Choosing the Object

Pick the most literal object that represents the user's task, not every input and output involved in the tool.

| Page task | Preferred object | Avoid |
| --- | --- | --- |
| Check a profile | Generic avatar bust | Scan frames, follower cards, calendar tiles, inventory panels |
| Generate a username | Rounded `@` name tile | Candidate lists, shuffle arrows, cursors, sparkles, magic wands |
| Calculate a value | Calculator with one accent key | Coin stacks, charts, item feeds, resale tags, cash |
| Convert a currency | Calculator or converter dial | Multiple currencies floating around a dashboard |
| Find an ID | Tag, label, or magnifier | Search-results interfaces and code panels |
| Plan or optimize | One tool-specific object | Flow diagrams and several competing resources |

When two metaphors seem equally valid, choose the one with the simpler silhouette.

## Composition Specification

- Master aspect ratio: `1:1`.
- Recommended source size: at least `1200 x 1200`; current generated masters are `1254 x 1254`.
- Subject coverage: approximately 60 to 70 percent of width or height.
- Safe zone: keep defining features inside the central 76 percent of the canvas.
- Background: edge-to-edge, single-color, no border.
- Orientation: straight-on or a subtle three-quarter turn.
- Focal point: one.
- Text: none, except one approved universal symbol.
- Object count: one; maximum two only when they visually behave as one unit.

## Small-Size QA

Every thumbnail must be reviewed at its real delivery sizes, not only at full resolution.

Check at `160`, `96`, `64`, and `48` pixels square:

1. Can the page category be guessed in under one second?
2. Is there still one obvious focal point?
3. Does the silhouette remain intact?
4. Is the approved symbol still legible, if present?
5. Do any details turn into visual noise?
6. Does the subject remain distinct from the background?
7. Does it look different from adjacent thumbnails without abandoning the system?

If the image works at full size but fails any of these checks, remove elements before increasing contrast or adding labels.

## Production and Delivery

- Keep a lossless PNG master in the repository or controlled media source.
- Serve an optimized WebP or AVIF derivative when the delivery path does not already optimize images.
- Use stable, descriptive filenames in kebab case, such as `roblox-profile-checker.png`.
- Keep one canonical asset per page unless a separate social-image composition is deliberately required.
- Do not place essential detail near the edges, because cards and social surfaces may crop differently.
- Write alt text from the page purpose, not an exhaustive visual description. Example: `Roblox Profile Checker` is better card alt text than a long inventory of shapes and colors.

## Brand and Safety Guardrails

- Use generic blocky avatars rather than identifiable platform characters or user avatars unless the source and permission are explicit.
- Do not reproduce Roblox logos, Robux marks, UI chrome, or other platform trade dress.
- Do not imply affiliation, verification by a platform, account resale, guaranteed value, or financial endorsement.
- For value tools, prefer a generic calculator. Avoid dollar signs, cash, price tags, marketplace imagery, and token shapes that resemble official currency marks.
- Do not generate readable usernames, player IDs, balances, or profile data into the image.
- Do not use another site's thumbnail as a style or composition copy.

## Generation Prompt Template

Use this template for new assets and replace only the bracketed parts:

```text
Use case: stylized-concept
Asset type: minimal square feature thumbnail for [page purpose]
Primary request: Create an extremely simple image that remains clear when displayed very small.
Scene/backdrop: one clean solid muted [background color] background, no pattern or scenery.
Subject: exactly one large centered [literal object]. [Describe only the one or two features required for recognition.]
Style/medium: polished soft 3D icon, chunky readable silhouette, understated and modern.
Composition/framing: single object centered, filling roughly 60 to 70 percent of the square, generous even padding, straight-on or mild three-quarter depth.
Lighting/mood: soft studio light, [calm/clear/friendly/trustworthy].
Color palette: [light neutral object], charcoal details, [one semantic accent], muted [background color] background.
Constraints: square, exactly one object, no secondary cards, no charts, no arrows, no scenery, no words, no numbers, no logo, no platform logo, no watermark, no decorative gradient, no pattern, no bokeh, no clutter.
```

Add concept-specific exclusions aggressively. For example, a profile image should explicitly exclude scan frames and data cards; a value calculator should exclude coins, cash, price tags, and currency logos.

## Current Reference Set

These three assets establish the initial reference set:

- `apps/web/public/images/tools/roblox-profile-checker.png`: one generic avatar portrait on muted indigo.
- `apps/web/public/images/tools/roblox-username-generator.png`: one rounded `@` tile on muted plum.
- `apps/web/public/images/tools/roblox-account-value-calculator.png`: one calculator with a green equals key on muted teal.

Future thumbnails should match their simplicity, subject scale, soft 3D material treatment, and quiet backgrounds. They do not need to reuse the same three background colors.

## Rejection Checklist

Reject or regenerate an asset when any of the following is true:

- More than two independently meaningful objects are visible.
- The image needs its small text to explain itself.
- The background contains a grid, room, landscape, interface, decorative glow, or pattern.
- Several accent colors compete for attention.
- The main object occupies less than half the square.
- The subject is difficult to identify at 64 pixels.
- A symbol resembles an official platform logo or currency mark.
- The thumbnail tells a full process instead of representing one task.
- It looks impressive at full size but busy in a card.
