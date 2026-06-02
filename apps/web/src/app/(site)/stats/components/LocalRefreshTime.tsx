"use client";

import { useEffect, useMemo, useState } from "react";

function formatLocalRefresh(value?: string | null) {
  if (!value) return "Waiting for refresh";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

function formatTimeZoneName() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return "your local time";
  return zone.replace(/_/g, " ");
}

export function LocalRefreshTime({ value, showZoneDetail = false }: { value?: string | null; showZoneDetail?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const label = useMemo(() => formatLocalRefresh(value), [value]);
  const zoneLabel = useMemo(formatTimeZoneName, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <span suppressHydrationWarning>{mounted ? label : formatLocalRefresh(value)}</span>
      {showZoneDetail ? (
        <span className="mt-2 block text-xs font-medium text-muted" suppressHydrationWarning>
          {mounted ? `Shown in ${zoneLabel}` : "Shown in your local time"}
        </span>
      ) : null}
    </>
  );
}
