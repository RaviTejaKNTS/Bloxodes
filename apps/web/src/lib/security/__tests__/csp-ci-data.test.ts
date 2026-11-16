import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it("allows the loopback data API only for an explicit GitHub fixture build", async () => {
  vi.stubEnv("NODE_ENV", "production");
  for (const [github, fixture, allowed] of [["true", "1", true], ["true", "", false], ["", "1", false]] as const) {
    vi.stubEnv("GITHUB_ACTIONS", github);
    vi.stubEnv("BLOXODES_CI_DATA", fixture);
    vi.resetModules();
    const { publicCsp, secureCsp } = await import("../csp");
    expect(publicCsp.includes("http://127.0.0.1:54321")).toBe(allowed);
    expect(secureCsp).not.toContain("http://127.0.0.1:54321");
  }
});
