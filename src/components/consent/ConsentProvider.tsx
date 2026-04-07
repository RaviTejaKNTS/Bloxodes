"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ConsentState = {
  analytics: boolean;
  marketing: boolean;
  decided: boolean;
  updatedAt: number | null;
};

type ConsentContextValue = {
  ready: boolean;
  state: ConsentState;
  requiresConsent: boolean;
  shouldShowBanner: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  updateConsent: (next: Partial<Pick<ConsentState, "analytics" | "marketing">>) => void;
};

const STORAGE_KEY = "gdpr-consent";

const defaultBlockedState: ConsentState = {
  analytics: false,
  marketing: false,
  decided: false,
  updatedAt: null
};

const defaultAllowedState: ConsentState = {
  analytics: true,
  marketing: true,
  decided: true,
  updatedAt: Date.now()
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readStoredConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      decided: Boolean(parsed.decided),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now()
    };
  } catch {
    return null;
  }
}

function persist(state: ConsentState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

function toRuntimeState(stored: ConsentState | null, requiresConsent: boolean): ConsentState {
  if (!requiresConsent) {
    if (!stored?.decided) {
      return defaultAllowedState;
    }

    return {
      analytics: stored.analytics,
      marketing: stored.marketing,
      decided: true,
      updatedAt: stored.updatedAt ?? Date.now()
    };
  }

  return stored ?? defaultBlockedState;
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [requiresConsent, setRequiresConsent] = useState(true);
  const [state, setState] = useState<ConsentState>(defaultBlockedState);

  useEffect(() => {
    const controller = new AbortController();

    async function hydrateConsent() {
      const stored = readStoredConsent();
      let shouldRequireConsent = process.env.NODE_ENV === "production";

      try {
        const response = await fetch("/api/consent", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal
        });

        if (response.ok) {
          const payload = (await response.json()) as { requiresConsent?: boolean };
          shouldRequireConsent = payload.requiresConsent === true;
        }
      } catch {
        // Fall back to the safer production default if the check fails.
      }

      if (controller.signal.aborted) {
        return;
      }

      setRequiresConsent(shouldRequireConsent);
      setState(toRuntimeState(stored, shouldRequireConsent));
      setReady(true);
    }

    hydrateConsent();

    return () => {
      controller.abort();
    };
  }, []);

  const setAndPersist = (next: ConsentState) => {
    setState(next);
    persist(next);
  };

  const acceptAll = () => {
    setAndPersist({
      analytics: true,
      marketing: true,
      decided: true,
      updatedAt: Date.now()
    });
  };

  const rejectAll = () => {
    setAndPersist({
      analytics: false,
      marketing: false,
      decided: true,
      updatedAt: Date.now()
    });
  };

  const updateConsent = (next: Partial<Pick<ConsentState, "analytics" | "marketing">>) => {
    setAndPersist({
      analytics: next.analytics ?? state.analytics,
      marketing: next.marketing ?? state.marketing,
      decided: true,
      updatedAt: Date.now()
    });
  };

  const value = useMemo<ConsentContextValue>(
    () => ({
      ready,
      state,
      requiresConsent,
      shouldShowBanner: ready && requiresConsent && !state.decided,
      acceptAll,
      rejectAll,
      updateConsent
    }),
    [ready, state, requiresConsent]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return ctx;
}
