import { describe, expect, it } from "vitest";
import { isSearchIndexingEnabledForHost, normalizeOrigin } from "@/lib/site-config";

describe("site-config", () => {
  it("normalizes valid origins", () => {
    expect(normalizeOrigin("https://bloxodes.com/path")).toBe("https://bloxodes.com");
    expect(normalizeOrigin("http://localhost:3000/test")).toBe("http://localhost:3000");
  });

  it("rejects unsupported origins", () => {
    expect(normalizeOrigin("ftp://bloxodes.com")).toBeNull();
    expect(normalizeOrigin("not-a-url")).toBeNull();
    expect(normalizeOrigin(undefined)).toBeNull();
  });

  it("allows indexing only for the main production hosts", () => {
    expect(isSearchIndexingEnabledForHost("bloxodes.com")).toBe(true);
    expect(isSearchIndexingEnabledForHost("www.bloxodes.com")).toBe(true);
    expect(isSearchIndexingEnabledForHost("ravitejaknts.com")).toBe(false);
    expect(isSearchIndexingEnabledForHost("staging.bloxodes.com")).toBe(false);
  });
});
