import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      timestamp: new Date().toISOString(),
      build: {
        sha:
          process.env.BLOXODES_BUILD_SHA ||
          process.env.GIT_COMMIT_SHA ||
          process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
          "unknown"
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
