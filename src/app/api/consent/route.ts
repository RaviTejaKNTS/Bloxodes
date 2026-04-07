import { NextResponse } from "next/server";
import { resolveRequiresConsent } from "@/lib/privacy/consent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const requiresConsent = resolveRequiresConsent(request.headers);

  return NextResponse.json(
    { requiresConsent },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0"
      }
    }
  );
}
