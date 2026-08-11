# Development Supabase Workflow

Bloxodes uses a dedicated managed Supabase project as its development database. Local web previews, content imports, and workflow QA read the gitignored `.env.local`; they do not require Docker or a locally running Supabase stack.

## Environment boundary

- Development: the managed Supabase project configured in `.env.local`.
- Production: the self-hosted API at `https://database.bloxodes.com`, with public media at `https://media.bloxodes.com`.
- Former managed production: rollback/source fallback only. It is not the development project.
- Never copy production service-role credentials into `.env.local` or an agent child process.
- Never commit or print `.env.local` values. Confirm only the resolved hostname when checking a target.

The development file should provide the app's normal Supabase variables, including `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, the anon key, and the service-role key needed by approved development import scripts.

## Start localhost

For ordinary web development:

```bash
npm run dev:web
```

Next.js loads `.env.local` automatically. For content workflows that call the guarded launcher, explicitly select managed-development mode:

```bash
ARTICLE_WRITER_DEV_ONLY=true npm run dev:local
```

The guarded launcher rejects the known Bloxodes production hosts. If port 3000 is occupied, reuse the existing Bloxodes development process or stop that exact process before starting another one.

## Content preview flow

1. Prepare and review the page's `final.json`.
2. Run the page-type dry-run and copy checks.
3. Confirm `.env.local` resolves to the managed development project, not `database.bloxodes.com`.
4. Import only the approved development row.
5. Open the localhost route and verify its rendered content, metadata, and behavior.
6. Keep production publication as a separate, explicitly approved release.

Some older import scripts treat every remote hostname as production even when `.env.local` points to managed development. Follow a script's documented remote confirmation only after checking the hostname. A flag named `--allow-prod` does not select the database; the environment determines the target. Never use that flag as a reason to skip target verification.

## Schema changes

1. Add a forward-only migration under `supabase/migrations/`.
2. Apply and test it against the managed development project first.
3. Verify affected application routes and scripts locally.
4. Apply it to production only through the explicit migration and release workflow.
5. Regenerate `supabase/schema.sql` from the live database after the production migration; do not hand-edit the snapshot.

Use Supabase CLI linked-project commands only after confirming which project is linked. Do not assume a previous CLI link is still correct.

## Optional isolated Docker stack

The `supabase:start`, `supabase:stop`, `supabase:status`, and `supabase:reset` commands remain available for exceptional isolated database work. They are optional tools, not prerequisites for normal development, content imports, or localhost previews.
