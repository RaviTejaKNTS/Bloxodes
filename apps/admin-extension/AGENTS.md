# Admin Extension Guide

Scope: everything under `apps/admin-extension`.

This is a personal, unpacked-only Chrome MV3 popup that acts as a quick admin panel for Bloxodes codes pages and articles. It is never packaged, never published to a store, and is not part of the Dokploy web build. It is separate from the public `apps/extension`.

## Shape

- `manifest.json`: MV3 manifest. Popup only, `storage` permission, host permissions for `https://bloxodes.com/*` and `http://localhost/*` (any port).
- `popup.html` + `src/popup.ts`: read-only summary for the current `/codes/<slug>` or `/articles/<slug>` tab (title, published state, environment, key fields, sources) with one `Edit` button.
- `edit.html` + `src/edit.ts`: schema-driven full-page editor opened in a new tab by `Edit`, laid out like a CMS editor: sticky top bar (breadcrumb with page link, save status, environment + publish badges, theme toggle, Discard, Save), a main column for the title and long-form markdown blocks (borderless, auto-growing textareas), and a right sidebar of collapsible settings panels. Field kinds: title, text, number, textarea, image (with preview), fixed `slots`, dynamic `list`, and `faq` pairs. Per family:
  - Codes: main = Name, Intro, How to redeem, Where to find codes, Troubleshooting, Rewards; sidebar = Status, Details (universe ID), SEO (title, description), Cover image, Sources 1-5 as fixed slots, Links (Roblox, community, Discord, Twitter/X, YouTube).
  - Articles: main = Title, Body, FAQ (question/answer cards); sidebar = Status, Details (universe ID, author ID), Meta description, Cover image, Tags (comma-separated), Sources as an add/remove list.
- Theme is dark by default with a light toggle in the editor top bar; the choice is stored in `chrome.storage.local` (`theme`) and shared with the popup.
- `src/shared.ts`: family/target/token/API helpers and small DOM utilities shared by both pages. `ui.css` is the single stylesheet. No background worker, no content script.
- `scripts/`: build helpers. `dist/` is generated and ignored; load it via `chrome://extensions` > Load unpacked.

## Behavior

- Reads the active tab URL. Only `/codes/<slug>` and `/articles/<slug>` on `bloxodes.com` or `localhost:<port>` are handled (`/articles/games` and `/articles/page/*` are ignored); anything else shows a one-line hint.
- Calls `<tab origin>/api/admin/<family>` with a bearer token, so the page you are viewing decides which environment you edit (`localhost:3000` = managed development, `bloxodes.com` = production).
- Tokens are stored per origin in `chrome.storage.local` under `token:<origin>`. A missing or rejected token shows the token input; the value must match that server's `ADMIN_API_TOKEN`.
- The popup is view-only. `Edit` opens the editor tab; nothing is written until `Save changes` (or Cmd/Ctrl+S) on that page, and only fields that actually changed are sent. `Discard` restores the loaded values; leaving with unsaved changes prompts.
- Codes sources are strict positional slots: Source 1 is `source_url` (RobloxDen), Source 2 is `source_url_2` (Beebom), and so on. Slots 6-10 appear only when they already hold a value. Saving sends the visible slots as one positional array so a value never moves to a different column. Article sources are a plain array, so that list supports add/remove.
- Article saves that change the body also refresh `word_count` server-side; tags are lower-cased, hyphenated, and de-duplicated; empty FAQ pairs are dropped.
- The environment badge is convention-based: `bloxodes.com` and `localhost:5000` are labelled as production database targets; everything else is `dev`.
- Slug, publish state, `published_at`, expired codes, and code rows are intentionally not editable here. Revalidation and `updated_at` come from the existing `code_pages` database triggers; the extension never calls `/api/revalidate`.

## Rules

- Keep it read-first with explicit edit mode. No autosave, no inline editing in view mode.
- Keep the UI minimal: no eyebrows, no marketing copy, no extra labels beyond what is needed to tell fields apart. Single-field sidebar panels use the panel title as the only label. Keep both families on the same layout, tokens (`ui.css` `:root` / `[data-theme="light"]`), and control kinds; add fields to a family's `Layout`, not bespoke markup.
- Never put Supabase keys, service-role behavior, or direct database calls in this extension. All access goes through `apps/web/src/app/api/admin/*`.
- Add a page family by adding `apps/web/src/lib/admin/<family>.ts` + `apps/web/src/app/api/admin/<family>/route.ts` (reuse `lib/admin/http.ts`), then a `Family` entry, popup summary rows, and an editor section schema in the extension. Keep one generic origin/token model.
- Build with `npm run build:admin-extension`; typecheck with `npm run typecheck:admin-extension`.

## Local Setup

1. Add `ADMIN_API_TOKEN=<random>` to `.envs/shared/application.env` and restart the dev server so `/api/admin/codes` exists.
2. `npm run build:admin-extension`, then load `apps/admin-extension/dist` unpacked in Chrome.
3. Open any `/codes/<slug>` or `/articles/<slug>` page, click the extension, paste the token once per origin.
4. For production, set the same variable on the Dokploy web service and enter that token when on `bloxodes.com`.
