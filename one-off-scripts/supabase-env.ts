import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type DatabaseTarget = "prod" | "local";

type TargetConfig = {
  url: string;
  serviceRole: string;
  envPath: string;
};

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function readEnvFile(relativePath: string): Record<string, string> {
  const resolved = path.resolve(repoRoot, relativePath);
  if (!existsSync(resolved)) {
    throw new Error(`Missing env file: ${resolved}`);
  }
  return parse(readFileSync(resolved));
}

export function getTargetConfig(target: DatabaseTarget): TargetConfig {
  const envPath =
    target === "prod"
      ? process.env.PROD_ENV_FILE ?? ".envs/targets/production.env"
      : process.env.LOCAL_ENV_FILE ?? ".envs/targets/local.env";
  const env = readEnvFile(envPath);
  const url = env.SUPABASE_URL || (target === "local" ? "http://127.0.0.1:54321" : "");
  const serviceRole = env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceRole) {
    throw new Error(`Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in ${envPath}`);
  }

  return { url, serviceRole, envPath };
}

export function createTargetClient(target: DatabaseTarget): SupabaseClient {
  const config = getTargetConfig(target);
  return createClient(config.url, config.serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function fetchAllRows<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  select = "*",
  orderColumn?: string
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    let query = client.from(table).select(select).range(from, to);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`);
    }

    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export async function upsertRows<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
  batchSize = 100
): Promise<void> {
  for (const batch of chunk(rows, batchSize)) {
    const { error } = await client.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`Failed to upsert ${table}: ${error.message}`);
    }
  }
}

export async function fetchRowsByValues<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  column: string,
  values: Array<string | number>,
  select = "*"
): Promise<T[]> {
  const uniqueValues = Array.from(new Set(values)).filter((value) => value !== null && value !== undefined);
  const rows: T[] = [];
  for (const batch of chunk(uniqueValues, 100)) {
    const { data, error } = await client.from(table).select(select).in(column, batch);
    if (error) {
      throw new Error(`Failed to fetch ${table} dependencies: ${error.message}`);
    }
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}
