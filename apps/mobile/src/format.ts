export function formatDate(value: string | null | undefined): string {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatUpdatedLabel(value: string | null | undefined): string {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.abs(Math.round(diffMs / 86_400_000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return diffMs >= 0 ? "yesterday" : "tomorrow";
  if (diffDays <= 7) return diffMs >= 0 ? `${diffDays} days ago` : `in ${diffDays} days`;
  return formatDate(value);
}

export function compactNumber(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function fullNumber(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value.toLocaleString("en-US");
}

export function stripMarkdown(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/^\s*-\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

export function rewardText(value: string | null | undefined): string {
  if (!value) return "No reward listed yet.";
  return /this code gives you/i.test(value) ? value : `You get ${value}`;
}

export function relativeTimeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  const future = diffMs > 0;
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60_000);
  const hours = Math.round(absMs / 3_600_000);
  const days = Math.round(absMs / 86_400_000);
  let span: string;
  if (minutes < 60) span = `${Math.max(1, minutes)} ${minutes === 1 ? "minute" : "minutes"}`;
  else if (hours < 48) span = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  else span = `${days} days`;
  return future ? `in ${span}` : `${span} ago`;
}

export function percentLabel(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}
