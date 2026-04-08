import { describe, expect, it } from "vitest";
import { isTrustedMutationOrigin } from "@/lib/security/request";

describe("isTrustedMutationOrigin", () => {
  it("accepts same-origin writes when the public host is forwarded by the proxy", () => {
    const request = new Request("http://0.0.0.0:3000/api/codes/progress", {
      method: "PUT",
      headers: {
        origin: "https://bloxodes.com",
        "x-forwarded-host": "bloxodes.com",
        "x-forwarded-proto": "https"
      }
    });

    expect(isTrustedMutationOrigin(request)).toBe(true);
  });

  it("rejects writes from a different origin", () => {
    const request = new Request("http://0.0.0.0:3000/api/codes/progress", {
      method: "PUT",
      headers: {
        origin: "https://evil.example",
        "x-forwarded-host": "bloxodes.com",
        "x-forwarded-proto": "https"
      }
    });

    expect(isTrustedMutationOrigin(request)).toBe(false);
  });
});
