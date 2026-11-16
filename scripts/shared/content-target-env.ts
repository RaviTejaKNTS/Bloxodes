import { loadBloxodesEnv, readBloxodesEnvFile } from "./env-files";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "./supabase-target";

export type ContentTarget = "production" | "managed-dev";

// An explicit content target wins over a shell's inherited development profile.
// process-only keeps isolated CI fixtures and service-manager environments usable.
export function selectContentTarget(target: ContentTarget = "production") {
  if (process.env.BLOXODES_ENV_PROFILE !== "process-only") {
    process.env.BLOXODES_ENV_PROFILE = target === "production" ? "production-preview" : "managed-dev";
    loadBloxodesEnv();
    Object.assign(process.env, readBloxodesEnvFile(`targets/${target}.env`));
  }
  const matches = target === "production" ? isProductionSupabaseUrl : isManagedDevelopmentSupabaseUrl;
  if (!matches(process.env.SUPABASE_URL)) throw new Error(`Credentials do not match content target ${target}.`);
  process.env.NODE_ENV = target === "production" ? "production" : "development";
}
