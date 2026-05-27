import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
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

  const buildShaPaths = [
    join(process.cwd(), "build-sha"),
    join(process.cwd(), "..", "..", "build-sha"),
    "/app/build-sha"
  ];

  for (const buildShaPath of buildShaPaths) {
    if (!existsSync(buildShaPath)) continue;

    const fileSha = readFileSync(buildShaPath, "utf8").trim();
    if (fileSha) {
      return fileSha;
    }
  }

  return envSha || "unknown";
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
