export function formatCompactNumber(value?: number | null, maximumFractionDigits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not tracked";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits }).format(value);
}

export function formatFullNumber(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not tracked";
  return value.toLocaleString("en-US");
}

export function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not enough data";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

export function formatDelta(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not tracked";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCompactNumber(Math.abs(value))}`;
}

export function formatDeltaPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not tracked";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}
