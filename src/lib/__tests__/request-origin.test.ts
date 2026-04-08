import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePublicOrigin } from "@/lib/request-origin";

describe("resolvePublicOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers forwarded public host over an internal fallback origin", () => {
    const headers = new Headers({
      "x-forwarded-host": "bloxodes.com",
      "x-forwarded-proto": "https"
    });

    expect(resolvePublicOrigin(headers, "http://0.0.0.0:3000")).toBe("https://bloxodes.com");
  });

  it("falls back to the configured site url when only local hosts are present", () => {
    vi.stubEnv("SITE_URL", "https://bloxodes.com");

    const headers = new Headers({
      host: "0.0.0.0:3000"
    });

    expect(resolvePublicOrigin(headers, "http://0.0.0.0:3000")).toBe("https://bloxodes.com");
  });
});
