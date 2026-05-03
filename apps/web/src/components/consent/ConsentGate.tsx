"use client";

import type { ReactNode } from "react";
import { useConsent } from "./ConsentProvider";

type ConsentCategory = "analytics" | "marketing";

export function ConsentGate({ category, children }: { category: ConsentCategory; children: ReactNode }) {
  const { ready, state, requiresConsent, shouldShowBanner } = useConsent();

  if (!ready) {
    return null;
  }

  if (requiresConsent && shouldShowBanner) {
    return null;
  }

  const allowed = category === "marketing" ? state.marketing : state.analytics;
  return allowed ? <>{children}</> : null;
}
