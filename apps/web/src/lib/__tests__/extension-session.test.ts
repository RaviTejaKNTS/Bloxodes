import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  consumeExtensionHandoffCode,
  createExtensionHandoffCode,
  normalizeExtensionAuthState,
  normalizeExtensionRedirectUri
} from "@/lib/auth/extension-session";

const REDIRECT_URI = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/bloxodes-auth";

describe("extension session handoff", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SESSION_SECRET", "test-extension-session-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts only Chromium identity redirect URLs on the fixed callback path", () => {
    expect(normalizeExtensionRedirectUri(REDIRECT_URI)).toBe(REDIRECT_URI);
    expect(
      normalizeExtensionRedirectUri(
        "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/another-path"
      )
    ).toBeNull();
    expect(
      normalizeExtensionRedirectUri(
        "https://abcdefghijklmnopabcdefghijklmnop.example.com/bloxodes-auth"
      )
    ).toBeNull();
    expect(
      normalizeExtensionRedirectUri(
        "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/bloxodes-auth?token=leak"
      )
    ).toBe(REDIRECT_URI);
  });

  it("normalizes high-entropy callback state", () => {
    expect(normalizeExtensionAuthState("abcdefghijklmnop")).toBe("abcdefghijklmnop");
    expect(normalizeExtensionAuthState("too short")).toBeNull();
    expect(normalizeExtensionAuthState("invalid+state+value")).toBeNull();
  });

  it("binds a one-time handoff to its extension redirect URL", () => {
    const code = createExtensionHandoffCode("user-123", REDIRECT_URI);
    expect(
      consumeExtensionHandoffCode(
        code,
        "https://ponmlkjihgfedcbaponmlkjihgfedcba.chromiumapp.org/bloxodes-auth"
      )
    ).toBeNull();
    expect(consumeExtensionHandoffCode(code, REDIRECT_URI)).toEqual({ userId: "user-123" });
    expect(consumeExtensionHandoffCode(code, REDIRECT_URI)).toBeNull();
  });
});
