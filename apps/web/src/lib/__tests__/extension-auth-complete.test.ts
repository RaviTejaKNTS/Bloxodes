import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentAppSession, createExtensionHandoffCode } = vi.hoisted(() => ({
  getCurrentAppSession: vi.fn(),
  createExtensionHandoffCode: vi.fn()
}));

vi.mock("@/lib/auth/app-session", () => ({
  getCurrentAppSession
}));

vi.mock("@/lib/auth/extension-session", () => ({
  createExtensionHandoffCode,
  normalizeExtensionAuthState: (value: unknown) =>
    typeof value === "string" && value.length >= 16 ? value : null,
  normalizeExtensionRedirectUri: (value: unknown) =>
    typeof value === "string" &&
    /^https:\/\/[a-p]{32}\.chromiumapp\.org\/bloxodes-auth$/.test(value)
      ? value
      : null
}));

vi.mock("@/lib/request-origin", () => ({
  resolvePublicOrigin: () => "https://bloxodes.com"
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true })
}));

vi.mock("@/lib/security/request", () => ({
  getRequestIp: () => "127.0.0.1"
}));

import { GET } from "@/app/api/extension/auth/complete/route";

const REDIRECT_URI = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/bloxodes-auth";
const STATE = "abcdefghijklmnop";

describe("extension auth completion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an authenticated session directly to the extension callback", async () => {
    getCurrentAppSession.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      expiresAt: "2026-08-01T00:00:00.000Z"
    });
    createExtensionHandoffCode.mockReturnValue("handoff-code");

    const response = await GET(
      new Request(
        `https://bloxodes.com/api/extension/auth/complete?redirectUri=${encodeURIComponent(REDIRECT_URI)}&state=${STATE}`
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${REDIRECT_URI}?code=handoff-code&state=${STATE}`
    );
    expect(createExtensionHandoffCode).toHaveBeenCalledWith("user-1", REDIRECT_URI);
  });

  it("starts Roblox sign-in when no Bloxodes session exists", async () => {
    getCurrentAppSession.mockResolvedValue(null);

    const response = await GET(
      new Request(
        `https://bloxodes.com/api/extension/auth/complete?redirectUri=${encodeURIComponent(REDIRECT_URI)}&state=${STATE}`
      )
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/auth/roblox/login");
    expect(location.searchParams.get("source")).toBe("/api/extension/auth/complete");
    expect(location.searchParams.get("next")).toContain("/api/extension/auth/complete?");
  });
});
