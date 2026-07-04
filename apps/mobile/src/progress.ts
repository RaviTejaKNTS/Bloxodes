import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";
import { normalizeStringList, readJson, writeJson } from "./storage";

export type SyncState = "local" | "syncing" | "synced" | "failed";

type SyncedProgressOptions = {
  storageKey: string | null;
  fetchRemote: () => Promise<string[]>;
  saveRemote: (ids: string[]) => Promise<boolean>;
};

/**
 * Local-first progress set: always persisted to AsyncStorage, merged with and
 * saved to the signed-in account when a session exists.
 */
export function useSyncedProgress({ storageKey, fetchRemote, saveRemote }: SyncedProgressOptions) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    async function load() {
      setReady(false);
      setSyncState(user ? "syncing" : "local");
      const local = normalizeStringList(await readJson<string[]>(storageKey!));
      if (!user) {
        if (!cancelled) {
          setIds(new Set(local));
          setReady(true);
          setSyncState("local");
        }
        return;
      }
      const remote = normalizeStringList(await fetchRemote().catch(() => []));
      if (cancelled) return;
      const merged = Array.from(new Set([...remote, ...local]));
      setIds(new Set(merged));
      await writeJson(storageKey!, merged);
      if (!cancelled) {
        setReady(true);
        setSyncState("synced");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, user?.id]);

  useEffect(() => {
    if (!storageKey || !ready) return;
    const serialized = Array.from(ids);
    void writeJson(storageKey, serialized);
    if (!user) {
      setSyncState("local");
      return;
    }
    setSyncState("syncing");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveRemote(serialized).then((ok) => setSyncState(ok ? "synced" : "failed"));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, ready, storageKey, user?.id]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const add = useCallback((id: string) => {
    setIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setIds(new Set());
  }, []);

  return { ids, ready, syncState, toggle, add, remove, reset };
}
