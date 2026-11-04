# article@1

Roblox articles only. The factory writes `bundle.json` beside its approved files:

```text
<slug>/
  bundle.json
  final.json
  media.json
  brief.md
```

```json
{
  "contract": "article@1",
  "slug": "example-beginner-guide",
  "finalJson": "final.json",
  "mediaJson": "media.json",
  "queueId": "11111111-1111-4111-8111-111111111111"
}
```

Paths must resolve inside this folder, including symlinks. `brief.md` is retained
for editorial use; it is not a publisher input. The queue row must already be
`completed` or `published`, use `agent_runner`, and have this `result_slug` and a
`result_path`. Mark completion with `articles:queue:update` before publishing.
The supplied final must match the completed result bytes when first published.

`content:publish /abs/folder` checks managed development without writes.
`--target managed-dev --apply` stages the article and image source records.
`--target production --apply --allow-prod` uses the wiki production guard,
promotes used images on scratch copies, imports, verifies and acknowledges the
managed-development queue. Failures leave the queue unchanged; rerun the bundle.
An unresolved old dispatch blocks direct publication. Do not create new old-path
intents for direct bundles. Existing intents reconcile from the published row on
the next drain. This command does not remove or disable the old publisher.

Credentials use the existing target profiles. Production also reads managed-dev
queue credentials from `ARTICLE_DEV_*` or `.envs/targets/managed-dev.env`.
No dependencies, tables or environment variables are added.
