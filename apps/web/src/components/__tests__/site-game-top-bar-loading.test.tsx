// @vitest-environment jsdom
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ pathname: "/games/gta" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("../SiteTopNav", () => ({ SiteTopNav: () => null }));
import { SiteGameTopBarClient } from "../SiteGameTopBarClient";

afterEach(() => vi.unstubAllGlobals());
it("removes the reserved row after the API resolves a franchise page to null", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let resolve!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(done => { resolve = done; })));
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<SiteGameTopBarClient />));
    expect(container.querySelector("[data-game-bar]")).not.toBeNull();
    await act(async () => resolve({ ok: true, json: async () => ({ gameNav: null, catalogNav: null }) }));
    expect(container.innerHTML).toBe("");
  } finally {
    await act(async () => root.unmount());
  }
});
