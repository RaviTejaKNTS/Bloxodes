"use client";

export type UmamiEventName = "engaged_visit" | "quiz_finished";

type UmamiEventValue = string | number | boolean;
type UmamiEventData = Record<string, UmamiEventValue | null | undefined>;

type UmamiWindow = typeof window & {
  umami?: {
    track: (eventName: string, data?: Record<string, UmamiEventValue>) => void;
  };
};

const CONTENT_TYPE_BY_PREFIX = [
  ["/articles", "article"],
  ["/codes", "codes"],
  ["/wiki", "wiki"],
  ["/tools", "tool"],
  ["/catalog", "catalog"],
  ["/events", "event"],
  ["/checklists", "checklist"],
  ["/quizzes", "quiz"],
  ["/stats", "stats"]
] as const;

export function classifyUmamiContentType(pathname: string) {
  for (const [prefix, contentType] of CONTENT_TYPE_BY_PREFIX) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return contentType;
  }
  return pathname === "/" ? "home" : "other";
}

export function trackUmamiEvent(eventName: UmamiEventName, data?: UmamiEventData) {
  if (typeof window === "undefined") return;
  const tracker = (window as UmamiWindow).umami;
  if (!tracker || typeof tracker.track !== "function") return;

  const cleaned: Record<string, UmamiEventValue> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === null || value === undefined) continue;
    cleaned[key] = value;
  }

  tracker.track(eventName, cleaned);
}
