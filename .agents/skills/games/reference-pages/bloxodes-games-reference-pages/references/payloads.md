# Shared page payloads

All page rows need `namespace`, `game_id`, `slug` and `title`. Use an explicit `id` when another group refers to the row. Named page URLs are `/<namespace>/<section>/<slug>`. The database derives `canonical_path`; omit it for a new page. Existing routes and owners are permanent.

Maps, quizzes and catalogs accept `seo_title`, `meta_description`, `intro_md`, `description_md`, `sources_json`, `is_published` and `published_at`. Sources are an array of objects with a `title` and HTTPS `url`. Their game and parent must also be published to expose a page.

## Maps

Group `maps`, table `game_map_pages`, section `maps`. New maps use `renderer_key=image-pins`. `map_data` has `image`, positive numeric `width` and `height`, `attribution`, and `markers`.

Each marker needs a unique `id`, `title`, and numeric `x` and `y` from 0 to 100, measured as percentages from the image's left and top edges. Optional fields are `category`, `description` and a safe `href`. Coordinates must come from verified map sources. Do not guess positions from prose.

Images and links must be HTTPS or site-relative URLs. Preserve artwork credits. Existing GTA maps use their specialist `gta-layered` and `gta5` engines and the controlled `import:gta-shared-maps` command.

## Quizzes

Group `quizzes`, table `game_quiz_pages`, section `quizzes`. `quiz_data` follows the existing `QuizData` shape in `apps/web/src/lib/quiz-types.ts`.

Provide nonempty `easy`, `medium` and `hard` question arrays. Questions need a unique `id`, `question`, exactly four `options` with unique `id` and `text`, and `correctOptionId` matching one option. An optional `image` must use a safe hosted URL. The player selects up to five questions per level. Keep IDs stable so saved history still refers to the same facts.

Account history is stored in `game_quiz_progress` and saved only through `/api/games/<namespace>/quizzes/progress`. The quiz code is `<namespace>:<slug>`. Do not use the Roblox progress table for new games.

## Checklists

One checklist page row owns one board and all its section/task rows. Normally its scope is verified 100% completion of the named game and edition or mode. Record any explicit user exception in the brief. Follow `dev-docs/pipelines/content.md#standalone-checklist-scope`; payload validity alone does not prove full game completion.

Group `checklists`, existing table `game_checklist_pages`, section `checklists`. Use `description_md`, `seo_title`, `seo_description`, `is_public` and `published_at`; a public checklist needs a valid publication date. Other page types use `is_published` instead.

Group `checklistItems`, table `game_checklist_items`. Each row needs `page_id`, a stable `item_key`, `section_code`, `title`, optional `description` and `is_required`. Numeric codes have one part for a group, two for a section and three for a checkable task, such as `1`, `1.1`, `1.1.1`. Include the group and section rows needed by the board. Task IDs must survive content updates.

The board counts all three-level leaves regardless of `is_required`. Use one required leaf with an explicit `A or B` title for interchangeable paths, and explain both verified options in its description. Do not split mutually exclusive alternatives into separate tasks or use `is_required: false` to hide optional tasks from progress. Keep optional tips in descriptions. Defer branching requirements that need unsupported alternative groups.

Progress uses the existing `/api/checklists/progress` protocol and `<namespace>:<slug>` keys. Existing GTA and Roblox keys remain unchanged.

## Catalogs

Group `catalog`, table `game_catalog_pages`, section `catalog`. `catalog_data` has `columns` and `items`.

Columns need unique lowercase `key` values and readable `label` values. Keys may contain letters, numbers and underscores, and must begin with a letter. Reserve `id` for row identity. Each item has a unique string `id` and plain string, number, boolean or null values under the defined column keys. Avoid HTML, executable content and arbitrary nested objects.

The default template is a plain table without cards. Use `GameContentPage` with a separate registered body when a catalog needs different interactions. A custom renderer must still read its data from the shared catalog table.

Page data is capped at 4 MB, with at most 10,000 map markers or catalog rows. Larger references need deliberate pagination or the existing immutable collection dataset workflow before publication.
