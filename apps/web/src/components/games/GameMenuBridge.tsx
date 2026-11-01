"use client";

import { useEffect } from "react";
import type { GameMenu } from "@/lib/game-site-navigation";
import { publishGameMenu } from "@/lib/game-menu-store";

export function GameMenuBridge({ path, menu }: { path: string; menu: GameMenu | null }) {
  useEffect(() => publishGameMenu(path, menu), [path, menu]);
  return null;
}
