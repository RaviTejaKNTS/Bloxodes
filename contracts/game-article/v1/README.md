# game-article@1

Queue-free articles for any registered non-Roblox game. The game and its parent must already be published. Resolve game identity separately on every target; never copy game UUIDs between environments.

`bundle.json`:

```json
{
  "contract": "game-article@1",
  "namespace": "example",
  "game": { "slug": "example-game", "kind": "game" },
  "slug": "example-guide",
  "finalJson": "final.json",
  "mediaJson": "media.json"
}
```

Paths are relative files inside the bundle. No `queueId`, Notion row or GitHub queue is accepted.

`final.json` requires `slug`, `title`, `content_md`, an HTTPS `cover_image`, and `author_id` (an existing author UUID on the target). Optional fields: `seo_title`, `meta_description`, `tags`, `sources_json` (`[{"title":"Official site","url":"https://example.com"}]`), `faq_json` (`[{"q":"Question?","a":"Answer."}]`) and `is_published: true`. Use the `news` tag for news. Each game gets one archive at `/articles/games/<game-slug>`, so publishing fails if a Roblox game or another game with the same slug already owns that URL. No Roblox universe ID is accepted. Slugs must match the bundle and cannot claim an existing Roblox or other game article route, including drafts and retired routes.

`media.json` uses the same image-readiness manifest as `article@1`. Body images undergo the same copy, image-readiness, decoding and video checks. Covers cannot repeat body images. Apply promotes body images and the cover to the target's Storage before writing. Keep the source bundle unchanged for retries.

```sh
npm run content:publish -- --bundle /absolute/bundle
npm run content:publish -- --bundle /absolute/bundle --target managed-dev --apply
npm run content:publish -- --bundle /absolute/bundle --target production --apply --allow-prod
npm run content:status -- --article example-guide --target production
```

Dry runs read target identity, author and route ownership and validate media without writes. Production uses the shared clean-checkout, deployed-code and migration-ledger guard. Apply preserves existing page UUIDs and publication dates, verifies every payload field by readback, revalidates, then checks the live article. Runtime design and pagination are shared with Roblox at `/articles/<slug>` and `/articles/<slug>/page/<n>`, for every game URL style. No news route exists.
