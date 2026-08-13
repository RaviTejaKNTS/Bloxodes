import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv, parse } from "dotenv";

type EnvConfig = {
  version: number;
  profiles: Record<string, string[]>;
  overlays: Record<string, string[]>;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envRoot = path.join(repoRoot, ".envs");
const config = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "env/config.json"), "utf8")
) as EnvConfig;

function selectedProfile(): string {
  const explicit = process.env.BLOXODES_ENV_PROFILE?.trim();
  if (explicit) return explicit;
  return process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test"
    ? "process-only"
    : "local";
}

function selectedOverlays(): string[] {
  return (process.env.BLOXODES_ENV_OVERLAYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function filesForSelection(profile: string, overlays: string[]): string[] {
  const profileFiles = config.profiles[profile];
  if (!profileFiles) {
    throw new Error(
      `Unknown BLOXODES_ENV_PROFILE=${profile}. Expected one of: ${Object.keys(config.profiles).join(", ")}.`
    );
  }

  const files = [...profileFiles];
  for (const overlay of overlays) {
    const overlayFiles = config.overlays[overlay];
    if (!overlayFiles) {
      throw new Error(
        `Unknown BLOXODES_ENV_OVERLAYS entry ${overlay}. Expected one of: ${Object.keys(config.overlays).join(", ")}.`
      );
    }
    files.push(...overlayFiles);
  }
  return [...new Set(files)];
}

export type LoadedBloxodesEnv = {
  profile: string;
  overlays: string[];
  files: string[];
};

export function loadBloxodesEnv(): LoadedBloxodesEnv {
  const profile = selectedProfile();
  const overlays = selectedOverlays();
  const relativeFiles = filesForSelection(profile, overlays);
  const loadedFiles: string[] = [];

  for (const relativeFile of relativeFiles) {
    const envPath = path.join(envRoot, relativeFile);
    if (!fs.existsSync(envPath)) continue;
    loadDotenv({ path: envPath, override: false, quiet: true });
    loadedFiles.push(relativeFile);
  }

  return { profile, overlays, files: loadedFiles };
}

export function envFilePath(relativeFile: string): string {
  return path.join(envRoot, relativeFile);
}

export function readBloxodesEnvFile(relativeFile: string): Record<string, string> {
  const envPath = envFilePath(relativeFile);
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing env file: ${envPath}. See dev-docs/environment.md.`);
  }
  return parse(fs.readFileSync(envPath));
}
