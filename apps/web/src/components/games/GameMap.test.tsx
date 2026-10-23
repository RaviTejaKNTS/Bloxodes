// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { GameMap } from "./GameMap";

const data = { image: "https://example.com/map.png", width: 500, height: 500, attribution: "Map credit", markers: [{ id: "first", title: "First location", x: 20, y: 20 }, { id: "second", title: "Second location", x: 50, y: 50 }] };

it("loads a generic map pin and keeps later selections out of history", async () => {
  window.history.replaceState(null, "", "/example/maps/locations?point=first");
  const replace = vi.spyOn(window.history, "replaceState");
  const push = vi.spyOn(window.history, "pushState");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    flushSync(() => root.render(<GameMap data={data} />));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(container.querySelector('[aria-label="First location"]')?.getAttribute("aria-pressed")).toBe("true");
    flushSync(() => container.querySelector<HTMLButtonElement>('[aria-label="Second location"]')!.click());
    expect(container.querySelector('[aria-label="Second location"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(container.querySelector("dialog [aria-label='Map category']")).not.toBeNull();
  } finally {
    flushSync(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  }
});

it("keeps a generic map selection mounted and restores toolbar focus on Escape", async () => {
  const modal = new WeakSet<HTMLDialogElement>();
  vi.spyOn(HTMLDialogElement.prototype, "matches").mockImplementation(function(this: HTMLDialogElement, selector) { return selector === ":modal" && modal.has(this); });
  Object.defineProperties(HTMLDialogElement.prototype, {
    show: { configurable: true, value() { this.open = true; } },
    showModal: { configurable: true, value() { this.open = true; modal.add(this); } },
    close: { configurable: true, value() { this.open = false; modal.delete(this); } }
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    flushSync(() => root.render(<GameMap data={data} />));
    await new Promise(resolve => setTimeout(resolve, 0));
    const pin = container.querySelector<HTMLButtonElement>('[aria-label="Second location"]')!;
    const toggle = container.querySelector<HTMLButtonElement>(".map-viewport-toolbar button")!;
    flushSync(() => pin.click());
    flushSync(() => toggle.click());
    pin.focus();
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    flushSync(() => pin.dispatchEvent(escape));
    expect(escape.defaultPrevented).toBe(true);
    expect(modal.has(container.querySelector("dialog")!)).toBe(false);
    expect(document.activeElement).toBe(toggle);
    expect(container.querySelector('[aria-label="Second location"]')).toBe(pin);
    expect(pin.getAttribute("aria-pressed")).toBe("true");
  } finally {
    flushSync(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  }
});
