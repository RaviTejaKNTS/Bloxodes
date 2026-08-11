import { describe, expect, it } from "vitest";
import {
  generateUsernameCandidates,
  mapRobloxValidationResponse,
  normalizeUsernameGeneratorOptions
} from "@/lib/roblox-username-generator";

function options(overrides: Record<string, unknown> = {}) {
  const normalized = normalizeUsernameGeneratorOptions({
    mode: "generate",
    keyword: "",
    vibes: ["space"],
    minLength: 8,
    maxLength: 14,
    allowNumbers: true,
    allowUnderscore: false,
    alliteration: false,
    mustIncludeKeyword: false,
    preference: "balanced",
    amount: 12,
    ...overrides
  });
  if (!normalized.ok) throw new Error(normalized.error.message);
  return normalized.options;
}

describe("Roblox username generator", () => {
  it("creates deterministic, unique candidates that follow the requested format", () => {
    const input = options();
    const first = generateUsernameCandidates(input, "same-seed", 80);
    const second = generateUsernameCandidates(input, "same-seed", 80);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(30);
    expect(new Set(first.map((candidate) => candidate.username.toLowerCase())).size).toBe(first.length);
    for (const candidate of first) {
      expect(candidate.username).toMatch(/^[A-Za-z0-9]+$/);
      expect(candidate.username.length).toBeGreaterThanOrEqual(8);
      expect(candidate.username.length).toBeLessThanOrEqual(14);
    }
  });

  it("keeps a required keyword without silently truncating it", () => {
    const input = options({ keyword: "Nova", mustIncludeKeyword: true, minLength: 7, maxLength: 16 });
    const candidates = generateUsernameCandidates(input, "keyword-seed", 60);

    expect(candidates.length).toBeGreaterThan(20);
    expect(candidates.every((candidate) => candidate.username.toLowerCase().includes("nova"))).toBe(true);
  });

  it("rejects personal-information-shaped and conflicting inputs", () => {
    const email = normalizeUsernameGeneratorOptions({ keyword: "kid@example.com" });
    const fullName = normalizeUsernameGeneratorOptions({ keyword: "First Last" });
    const tooShort = normalizeUsernameGeneratorOptions({ keyword: "LongKeyword", maxLength: 5, mustIncludeKeyword: true });

    expect(email.ok).toBe(false);
    expect(fullName.ok).toBe(false);
    expect(tooShort.ok).toBe(false);
  });

  it("creates recognizable variants in remix mode without returning the exact source", () => {
    const input = options({
      mode: "remix",
      sourceUsername: "NovaRacer99",
      vibes: ["space"],
      minLength: 8,
      maxLength: 16,
      allowNumbers: true
    });
    const candidates = generateUsernameCandidates(input, "remix-seed", 60);

    expect(candidates.length).toBeGreaterThan(10);
    expect(candidates.every((candidate) => candidate.username.toLowerCase() !== "novaracer99")).toBe(true);
    expect(candidates.some((candidate) => candidate.username.toLowerCase().includes("novaracer"))).toBe(true);
    expect(candidates.every((candidate) => candidate.tags.includes("Remix"))).toBe(true);
  });

  it("maps every known Roblox response without treating unknown failures as available", () => {
    expect(mapRobloxValidationResponse(0, "Username is valid").status).toBe("available");
    expect(mapRobloxValidationResponse(1, "Username is already in use").status).toBe("taken");
    expect(mapRobloxValidationResponse(2, "Username not appropriate for Roblox").status).toBe("inappropriate");
    for (const code of [3, 4, 5, 6, 7]) {
      expect(mapRobloxValidationResponse(code, "Invalid").status).toBe("invalid");
    }
    expect(mapRobloxValidationResponse(99, "Unexpected").status).toBe("unverified");
    expect(mapRobloxValidationResponse(undefined, undefined).status).toBe("unverified");
  });

  it("filters official-looking fragments before any network validation", () => {
    const normalized = normalizeUsernameGeneratorOptions({ keyword: "Roblox", mustIncludeKeyword: true, maxLength: 20 });
    expect(normalized.ok).toBe(false);
  });
});
