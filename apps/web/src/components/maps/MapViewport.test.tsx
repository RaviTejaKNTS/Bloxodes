// @vitest-environment jsdom
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { MapViewport } from "./MapViewport";

// GitHub uses React's production build, so use flushSync rather than act.
async function settle(run: () => unknown) {
  let pending: unknown;
  flushSync(() => { pending = run(); });
  await pending;
  await new Promise(resolve => setTimeout(resolve, 0));
}

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ""; });
it("keeps map state mounted across full screen, Escape and About", async () => {
  const modal = new WeakSet<HTMLDialogElement>();
  vi.spyOn(HTMLDialogElement.prototype, "matches").mockImplementation(function(this: HTMLDialogElement, selector) { return selector === ":modal" && modal.has(this); });
  Object.defineProperties(HTMLDialogElement.prototype, {
    show: { configurable: true, value() { this.open = true; } },
    showModal: { configurable: true, value() { this.open = true; modal.add(this); } },
    close: { configurable: true, value() { this.open = false; modal.delete(this); } }
  });
  function FakeMap() {
    const [selected, setSelected] = useState(false);
    return <button data-pin onClick={() => setSelected(true)}>{selected ? "Selected" : "Choose a pin"}</button>;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await settle(() => root.render(<MapViewport><FakeMap /></MapViewport>));
  const pin = container.querySelector<HTMLButtonElement>("[data-pin]")!;
  const toggle = container.querySelector<HTMLButtonElement>(".map-viewport-toolbar button")!;
  const dialog = container.querySelector("dialog")!;
  await settle(() => pin.click());
  await settle(() => toggle.click());
  expect(modal.has(dialog)).toBe(true);
  expect(document.body.style.overflow).toBe("hidden");
  expect(pin.textContent).toBe("Selected");
  await settle(() => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
  expect(modal.has(dialog)).toBe(false);
  expect(toggle.textContent).toBe("Full screen");
  expect(document.body.style.overflow).toBe("");
  await settle(() => toggle.click());
  await settle(() => window.dispatchEvent(new Event("bloxodes:map-guide")));
  expect(modal.has(dialog)).toBe(false);
  expect(dialog.open).toBe(true);
  expect(container.querySelector("[data-pin]")).toBe(pin);
  await settle(() => root.unmount());
});
