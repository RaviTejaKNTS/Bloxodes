# Franchise Map Research and Writing

Research one approved map, then write its page and verified pins after parent approval. Read the franchise doc for routes and engine ownership, the page standards for layout and images, and the voice guide before writing.

## Output

```text
tmp/content-workspace/<namespace>/<game-slug>/maps/<map-slug>/
  brief.md
  final.json
```

Keep a supplied workspace override. `brief.md` comes first; don't write `final.json` until the parent approves the map evidence and data.

## Research steps

1. Resolve namespace, registry game UUID, kind, parent, exact route, edition, platform, mode and release generation.
2. Check existing map rows and routes for overlap. Existing GTA `gta-layered` and `gta5` engines keep their frozen snapshots. A snapshot change requires a reviewed migration; don't switch them to `image-pins`.
3. Verify the artwork, native dimensions, credit and every pin against actual map evidence. Measure coordinates; don't infer positions from prose.
4. Plan useful marker categories and game-specific descriptions. Verify guide links and spoiler scope.
5. Plan the required page/social image as well as the map artwork. Report missing storage or rendering support. Publication stays blocked until required images and layout can render.

## Writing the brief for the writer

Use plain player language. List exact places, how to recognize them, requirements and rewards that help at the location. Keep source quality and coordinate doubts in private evidence notes. No research jargon or website instructions in facts the writer might reuse.

## Brief shape

```text
Evidence checked:
- Registry identity and existing route:
- Edition/platform/mode/release-generation and spoiler scope:
- Map artwork, dimensions, source and credit:
- Coordinate proof per marker:
- Page/social image source and credit:

Map plan:
- Title and SEO description:
- Reader's real question:
- Marker categories and stable IDs:
- Exact measured coordinates:
- Facts to use:
- Facts to avoid:
- Related Bloxodes links:
- Open gaps or risks:
```

## Read first

- The approved brief and data.
- `.agents/skills/bloxodes-voice/SKILL.md`.
- `payloads.md`, Maps, for the exact publisher contract.

## Workflow

1. Write the `maps` group in `final.json` only after evidence/data approval.
2. Use `image-pins` for new simple maps and the specialist importer for existing GTA maps.
3. Write an answer-first intro and descriptive headings that cover real map locations and player goals. Marker titles stay plain; descriptions name landmarks, requirements or rewards. Don't explain zoom, search or filters.
4. Return the payload and source proof. The parent runs GitHub QA; no local builds, checks or preview.

## Field jobs

- `namespace`, `game_id`, `slug`: approved registry ownership and stable route identity.
- `title`, `seo_title`, `meta_description`: natural game-specific search wording within page standards.
- `intro_md`, `description_md`: useful game context without repeating marker facts.
- `sources_json`: credited HTTPS sources.
- `renderer_key`, `map_data`: verified map artwork, attribution, dimensions and markers from the payload contract.
- `is_published`, `published_at`: reviewed visibility and date.

## Output shape

Use the `maps` group and exact `map_data` shape in `payloads.md`. Keep IDs stable on updates. The parent checks search, categories, zoom, marker positions and guide links on desktop/mobile in GitHub QA. Never change frozen GTA snapshots without a reviewed migration.
