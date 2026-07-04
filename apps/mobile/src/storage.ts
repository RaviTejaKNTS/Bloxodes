import AsyncStorage from "@react-native-async-storage/async-storage";

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

export function codeProgressKey(slug: string) {
  return `code-progress:${slug.trim().toLowerCase()}`;
}

export function checklistProgressKey(slug: string) {
  return `checklist-progress:${slug.trim().toLowerCase()}`;
}

export function quizProgressKey(code: string) {
  return `quiz-progress:${code.trim().toLowerCase()}`;
}

export const THEME_MODE_KEY = "bloxodes-theme-mode";

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
