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
  const cleaned = sanitized.replace(/\s*Cop(?:y|ied)\s*$/i, "").trim();
  return cleaned || null;
}

export function normalizeCodeKey(code: string | null | undefined): string | null {
  const sanitized = sanitizeCodeDisplay(code);
  if (!sanitized) {
    return null;
  }

  return sanitized.replace(/\s+/g, "").toUpperCase();
}
