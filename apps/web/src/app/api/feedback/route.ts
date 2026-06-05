import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp, isTrustedMutationOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const FEEDBACK_RATE_LIMIT = {
  limit: 8,
  windowMs: 10 * 60 * 1000
};
const MAX_BODY_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 160;
const MAX_URL_LENGTH = 500;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(value: string): boolean {
  if (!value) return true;
  if (value.length > MAX_EMAIL_LENGTH) return false;
  if (!value.includes("@")) return false;
  const [local, domain] = value.split("@");
  return Boolean(local && domain && domain.includes("."));
}

function normalizeOptionalText(value: unknown, maxLength = MAX_URL_LENGTH): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeOptionalPath(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized.startsWith("/") ? normalized.slice(0, MAX_URL_LENGTH) : null;
}

function normalizeViewportValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 && rounded < 10000 ? rounded : null;
}

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const ip = getRequestIp(request);
    const rateLimit = checkRateLimit({
      key: `feedback:create:${ip}`,
      ...FEEDBACK_RATE_LIMIT
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many feedback attempts. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
        }
      );
    }

    const payload = await request.json();
    const body = normalizeString(payload?.body);
    const email = normalizeEmail(payload?.email);

    if (!body) {
      return NextResponse.json({ error: "Feedback cannot be empty." }, { status: 400 });
    }

    if (body.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: `Feedback must be ${MAX_BODY_LENGTH} characters or less.` }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const { error } = await supabaseAdmin().from("site_feedback").insert({
      body,
      email: email || null,
      page_url: normalizeOptionalText(payload?.pageUrl),
      page_path: normalizeOptionalPath(payload?.pagePath),
      viewport_width: normalizeViewportValue(payload?.viewportWidth),
      viewport_height: normalizeViewportValue(payload?.viewportHeight),
      user_agent: normalizeOptionalText(request.headers.get("user-agent"), 500),
      ip_address: ip === "unknown" ? null : ip,
      metadata: {
        source: "site_header"
      }
    });

    if (error) {
      console.error("Failed to insert site feedback", error);
      return NextResponse.json({ error: "Unable to send feedback." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unhandled feedback error", error);
    return NextResponse.json({ error: "Unable to send feedback." }, { status: 500 });
  }
}
