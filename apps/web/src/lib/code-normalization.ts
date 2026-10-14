export function sanitizeCodeDisplay(code: string | null | undefined): string | null {
  if (typeof code !== "string") {
    return null;
  }

  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

export function stripTrailingCopyButtonText(
  value: string | null | undefined
): string | null {
  const sanitized = sanitizeCodeDisplay(value);
  if (!sanitized) return null;
  // Repeat so stacked labels such as "Coins Copy Copy" are fully removed.
  let cleaned = sanitized;
  while (true) {
    const next = cleaned.replace(/\s*Cop(?:y|ied)\s*$/i, "").trim();
    if (next === cleaned) return cleaned || null;
    cleaned = next;
  }
}

export function stripPastedCopySuffix(
  value: string | null | undefined
): string | null {
  let code = sanitizeCodeDisplay(value);
  if (!code) return null;

  // Preserve standalone labels and lowercase glued endings such as "xcopy".
  // Repeat for pasted labels such as "CODECopy Copy" so cleanup is idempotent.
  while (true) {
    const cleaned = code
      .replace(/\s+cop(?:y|ied)$/i, "")
      .replace(/(\S)Cop(?:y|ied)$/, "$1")
      .trim();
    if (!cleaned || cleaned === code) return code;
    code = cleaned;
  }
}

export function cleanExpiredCodeList(values: readonly string[]) {
  const codes: string[] = [];
  const seen = new Set<string>();
  let removed = 0;
  let renamed = 0;

  for (const value of values) {
    const code = stripPastedCopySuffix(value);
    const key = normalizeCodeKey(code);
    if (!code || !key || seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    codes.push(code);
    if (code !== value) renamed += 1;
  }

  return { codes, removed, renamed };
}

export function normalizeCodeKey(code: string | null | undefined): string | null {
  const sanitized = sanitizeCodeDisplay(code);
  if (!sanitized) {
    return null;
  }

  return sanitized.replace(/\s+/g, "").toUpperCase();
}
