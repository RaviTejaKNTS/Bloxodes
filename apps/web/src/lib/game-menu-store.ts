"use client";

import { useSyncExternalStore } from "react";
import type { GameMenu } from "./game-site-navigation";

type Snapshot = { owner: symbol; path: string; menus: GameMenu[] };
let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();
const emptyMenus: GameMenu[] = [];
const getSnapshot = () => snapshot;
// Never share a client's menu with server rendering or hydration.
const getServerSnapshot = () => null;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const notify = () => listeners.forEach(listener => listener());

export function publishGameMenu(path: string, menu: GameMenu | null) {
  const owner = Symbol();
  snapshot = { owner, path, menus: menu ? [menu] : emptyMenus };
  notify();
  return () => {
    // An outgoing page's cleanup must not erase the incoming page's menu.
    if (snapshot?.owner !== owner) return;
    snapshot = null;
    notify();
  };
}

export function useGameMenus(path: string) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Hide stale menus immediately, even before the outgoing bridge unmounts.
  return current?.path === path ? current.menus : emptyMenus;
}
