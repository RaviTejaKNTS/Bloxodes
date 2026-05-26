import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function readBuildSha() {
  const envSha =
    process.env.BLOXODES_BUILD_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

  if (envSha && envSha !== "unknown") {
    return envSha;
  }

  try {
    const fileSha = readFileSync(join(process.cwd(), "build-sha"), "utf8").trim();
    return fileSha || "unknown";
  } catch {
    return envSha || "unknown";
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      timestamp: new Date().toISOString(),
      build: {
        sha: readBuildSha()
      },
      features: {
        cacheTags: true,
        cacheHeaderVersion: 2,
        cloudflarePurgeStrategy: process.env.CLOUDFLARE_PURGE_STRATEGY || "tags"
      }
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
