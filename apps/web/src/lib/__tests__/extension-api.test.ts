import { describe, expect, it } from "vitest";
import { isBloxodesExtensionRequest } from "@/lib/extension-api";

function request(headers: Record<string, string>) {
  return new Request("https://bloxodes.com/api/extension/auth/session", { headers });
}

describe("extension API client validation", () => {
  it("accepts a versioned extension client from a Chromium extension origin", () => {
    expect(
      isBloxodesExtensionRequest(
        request({
          Origin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
          "X-Bloxodes-Extension": "Bloxodes/6.0.0"
        })
      )
    ).toBe(true);
  });

  it("accepts background requests that omit Origin", () => {
    expect(
      isBloxodesExtensionRequest(
        request({
          "X-Bloxodes-Extension": "Bloxodes/6.0.0"
        })
      )
    ).toBe(true);
  });

  it("rejects web origins and malformed extension identifiers", () => {
    expect(
      isBloxodesExtensionRequest(
        request({
          Origin: "https://example.com",
          "X-Bloxodes-Extension": "Bloxodes/6.0.0"
        })
      )
    ).toBe(false);
    expect(
      isBloxodesExtensionRequest(
        request({
          Origin: "chrome-extension://not-an-extension-id",
          "X-Bloxodes-Extension": "Bloxodes/6"
        })
      )
    ).toBe(false);
  });
});
