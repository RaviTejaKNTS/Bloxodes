"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

export type CollectionChecklistSessionState = {
  status: "loading" | "ready";
  userId: string | null;
};

export type CollectionChecklistProgressOptions = {
  code: string;
  endpoint: string;
  requestKey: string;
  storageKeyPrefix: string;
  eventName?: string;
  analyticsPrefix?: string;
  normalizeId?: (value: string) => string;
};

export type CollectionChecklistProgressState = {
  session: CollectionChecklistSessionState;
  checked: Set<string>;
  toggle: (id: string) => void;
  reset: () => void;
};

const SESSION_ENDPOINT = "/api/checklists/session";
const MAX_CHECKED_IDS = 2000;

let sessionState: CollectionChecklistSessionState = { status: "loading", userId: null };
let sessionPromise: Promise<void> | null = null;
let sessionCheckedAt = 0;
const sessionListeners = new Set<(state: CollectionChecklistSessionState) => void>();

function notifySession() {
  sessionListeners.forEach((listener) => listener(sessionState));
}

async function fetchSession(force = false) {
  if (sessionPromise) return sessionPromise;
  if (!force && sessionState.status === "ready" && Date.now() - sessionCheckedAt < 15_000) return;

  if (sessionState.status !== "ready") {
    sessionState = { ...sessionState, status: "loading" };
    notifySession();
  }

  sessionPromise = (async () => {
    try {
      const response = await fetch(SESSION_ENDPOINT, { credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      sessionState = {
        status: "ready",
        userId: typeof payload?.userId === "string" ? payload.userId : null
      };
    } catch {
      sessionState = { status: "ready", userId: null };
    } finally {
      sessionCheckedAt = Date.now();
      sessionPromise = null;
      notifySession();
    }
  })();

  return sessionPromise;
}

function normalizeIds(value: unknown, normalizeId: (value: string) => string): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const normalized = normalizeId(entry.trim());
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= MAX_CHECKED_IDS) break;
  }
  return result;
}

function defaultNormalizeId(value: string): string {
  return value.trim();
}

function storageKey(options: CollectionChecklistProgressOptions): string {
  return `${options.storageKeyPrefix}${options.code.trim().toLowerCase()}`;
}

function readLocal(options: CollectionChecklistProgressOptions): string[] {
  if (typeof window === "undefined") return [];
  const normalizeId = options.normalizeId ?? defaultNormalizeId;
  try {
    const raw = window.localStorage.getItem(storageKey(options));
    return raw ? normalizeIds(JSON.parse(raw), normalizeId) : [];
  } catch {
    return [];
  }
}

function writeLocal(options: CollectionChecklistProgressOptions, ids: string[]) {
  if (typeof window === "undefined") return;
  const normalizeId = options.normalizeId ?? defaultNormalizeId;
  try {
    window.localStorage.setItem(storageKey(options), JSON.stringify(normalizeIds(ids, normalizeId)));
  } catch {
    // Browser storage can be disabled or full. In-memory state remains usable.
  }
}

async function loadRemote(options: CollectionChecklistProgressOptions): Promise<string[]> {
  const normalizeId = options.normalizeId ?? defaultNormalizeId;
  try {
    const response = await fetch(
      `${options.endpoint}?${encodeURIComponent(options.requestKey)}=${encodeURIComponent(options.code)}`,
      { credentials: "include" }
    );
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return normalizeIds(payload?.checkedIds, normalizeId);
  } catch {
    return [];
  }
}

async function saveRemote(options: CollectionChecklistProgressOptions, ids: string[]): Promise<boolean> {
  const normalizeId = options.normalizeId ?? defaultNormalizeId;
  try {
    const response = await fetch(options.endpoint, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [options.requestKey]: options.code,
        checkedIds: normalizeIds(ids, normalizeId)
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

function mergeIds(primary: string[], secondary: string[], normalizeId: (value: string) => string): string[] {
  return normalizeIds([...primary, ...secondary], normalizeId);
}

export function useCollectionChecklistProgress(
  options: CollectionChecklistProgressOptions
): CollectionChecklistProgressState {
  const [session, setSession] = useState(sessionState);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const changeVersionRef = useRef(0);
  const pendingPersistRef = useRef(false);
  const checkedRef = useRef(checked);
  const normalizeId = options.normalizeId ?? defaultNormalizeId;

  useEffect(() => {
    sessionListeners.add(setSession);
    void fetchSession(true);
    return () => {
      sessionListeners.delete(setSession);
    };
  }, []);

  useEffect(() => {
    checkedRef.current = checked;
  }, [checked]);

  useEffect(() => {
    pendingPersistRef.current = false;
    changeVersionRef.current = 0;
    setChecked(new Set());
  }, [options.code, options.endpoint, options.requestKey, options.storageKeyPrefix]);

  useEffect(() => {
    if (session.status !== "ready") return;

    if (pendingPersistRef.current) {
      const ids = Array.from(checkedRef.current);
      if (session.userId) void saveRemote(options, ids);
      else writeLocal(options, ids);
      pendingPersistRef.current = false;
      return;
    }

    if (!session.userId) {
      setChecked(new Set(readLocal(options)));
      return;
    }

    let active = true;
    const loadVersion = changeVersionRef.current;
    const localIds = readLocal(options);
    void loadRemote(options).then((remoteIds) => {
      if (!active || changeVersionRef.current !== loadVersion) return;
      const merged = mergeIds(remoteIds, localIds, normalizeId);
      setChecked(new Set(merged));
      if (localIds.length && merged.length !== remoteIds.length) {
        void saveRemote(options, merged);
      }
    });
    return () => {
      active = false;
    };
  }, [options.code, options.endpoint, options.requestKey, options.storageKeyPrefix, session.status, session.userId]);

  useEffect(() => {
    const key = storageKey(options);
    const handleStorage = (event: StorageEvent) => {
      if (session.userId || event.key !== key) return;
      setChecked(new Set(readLocal(options)));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [options.code, options.storageKeyPrefix, session.userId]);

  const persist = (ids: string[]) => {
    if (session.status !== "ready") {
      pendingPersistRef.current = true;
      return;
    }
    if (session.userId) void saveRemote(options, ids);
    else writeLocal(options, ids);
  };

  const toggle = (id: string) => {
    const normalized = normalizeId(id);
    if (!normalized) return;
    changeVersionRef.current += 1;
    setChecked((current) => {
      const next = new Set(current);
      const isChecked = !next.has(normalized);
      if (isChecked) next.add(normalized);
      else next.delete(normalized);
      persist(Array.from(next));
      return next;
    });
  };

  const reset = () => {
    changeVersionRef.current += 1;
    setChecked(new Set());
    persist([]);
  };

  return { session, checked, toggle, reset };
}

export function dispatchCollectionChecklistProgress(
  options: Pick<CollectionChecklistProgressOptions, "code" | "eventName">,
  checkedCount: number,
  totalCount: number
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(options.eventName ?? "collection-checklist-progress", {
      detail: { code: options.code, checkedCount, totalCount }
    })
  );
}

export function trackCollectionChecklistEvent(
  prefix: string | undefined,
  event: "item_toggle" | "progress_reset",
  payload: Record<string, string | number | boolean | null | undefined>
) {
  trackEvent(`${prefix ?? "collection"}_${event}`, payload);
}

export { normalizeIds as normalizeCollectionChecklistIds };
