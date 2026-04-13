import "dotenv/config";

import { spawn } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

type QueueRow = {
  id: string;
  article_title: string | null;
  status: string;
  attempts?: number;
  next_attempt_at?: string | null;
  last_attempted_at: string | null;
  last_error: string | null;
};

function parseLimit(args: string[]): number {
  const eqArg = args.find((arg) => arg.startsWith("--limit="));
  if (eqArg) {
    const value = eqArg.split("=")[1];
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }

  const index = args.indexOf("--limit");
  if (index !== -1 && args[index + 1]) {
    const parsed = Number(args[index + 1]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }

  return 1;
}

const LIMIT = parseLimit(process.argv.slice(2));

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

async function pickQueueItems(limit: number): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("id, article_title, status, attempts, next_attempt_at, last_attempted_at, last_error")
    .eq("status", "pending")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load article queue: ${error.message}`);
  }

  return data ?? [];
}

function runGenerator(queueId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "generate:articles", "--", "--queue-id", queueId], {
      stdio: "inherit"
    });

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Article generator exited with code ${code}`));
    });
  });
}

async function processQueueItem(entry: QueueRow) {
  const label = entry.article_title?.trim() || "Untitled article";
  console.log(`📰 Processing article queue item ${label} (${entry.id})`);

  try {
    await runGenerator(entry.id);
    console.log(`✅ Article generated for queue item ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to generate article for queue item ${label}: ${message}`);
  }
}

async function main() {
  try {
    const items = await pickQueueItems(LIMIT);
    if (items.length === 0) {
      console.log("No pending articles in queue.");
      return;
    }

    for (const entry of items) {
      await processQueueItem(entry);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
