/** Editorial aliases must resolve identically for metadata and generated covers. */
export function catalogCodeCandidates(code: string): string[] {
  const canonical = code.replace(/^roblox-free-items(?=\/|$)/, "free-roblox-items");
  return /^free-roblox-items(?:\/|$)/.test(canonical)
    ? [canonical, canonical.replace(/^free-roblox-items/, "roblox-free-items")]
    : [code];
}
