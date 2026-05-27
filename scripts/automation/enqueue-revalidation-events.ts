import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_TYPES = new Set([
  "code",
  "article",
  "list",
  "author",
  "event",
  "checklist",
  "tool",
  "catalog",
  "music",
  "quiz",
  "puzzle",
  "wiki",
  "wiki_catalog",
  "stats"
]);

type RevalidationEvent = {
  type: string;
  slug: string;
};

type Options = {
  events: RevalidationEvent[];
  source: string;
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

function parseEvent(value: string): RevalidationEvent {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    throw new Error(`Invalid event "${value}". Use type:slug, for example stats:games.`);
  }

  const type = value.slice(0, separator).trim();
  const slug = normalizeSlug(value.slice(separator + 1));
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Invalid event type "${type}".`);
  }
  if (!slug) {
    throw new Error(`Missing slug for event "${value}".`);
  }
  return { type, slug };
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const events: RevalidationEvent[] = [];
  let source = "manual_script";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--event" || arg === "-e") {
      const value = args[index + 1];
      if (!value) throw new Error("--event requires type:slug.");
      events.push(parseEvent(value));
      index += 1;
    } else if (arg === "--source") {
      const value = args[index + 1];
      if (!value) throw new Error("--source requires a value.");
      source = value.trim() || source;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run enqueue:revalidation -- --event <type:slug> [--event <type:slug>]

Examples:
  npm run enqueue:revalidation -- --event stats:stats --event stats:games --source stats_hourly
  npm run enqueue:revalidation -- stats:stats stats:games
`);
      process.exit(0);
    } else {
      events.push(parseEvent(arg));
    }
  }

  if (!events.length) {
    throw new Error("At least one revalidation event is required.");
  }

  return { events, source };
}

async function main() {
  const options = parseArgs();
  const createdAt = new Date().toISOString();
  const rows = Array.from(
    new Map(options.events.map((event) => [`${event.type}:${event.slug}`, event])).values()
  ).map((event) => ({
    entity_type: event.type,
    slug: event.slug,
    source: options.source,
    created_at: createdAt
  }));

  const { error } = await supabaseAdmin()
    .from("revalidation_events")
    .upsert(rows, { onConflict: "entity_type,slug" });

  if (error) throw error;
  console.log(`Queued ${rows.length} revalidation event(s): ${rows.map((row) => `${row.entity_type}:${row.slug}`).join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
