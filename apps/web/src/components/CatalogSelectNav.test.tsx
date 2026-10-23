// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CatalogSelectNav } from "./CatalogSelectNav";

it("scrolls to a section without generating a history-based pageview", () => {
  const container = document.createElement("div");
  const target = document.createElement("section");
  target.id = "section-two";
  target.scrollIntoView = vi.fn();
  document.body.append(container, target);
  const root = createRoot(container);
  const replace = vi.spyOn(window.history, "replaceState");
  const push = vi.spyOn(window.history, "pushState");
  try {
    flushSync(() => root.render(<CatalogSelectNav label="Jump to section" options={[{ value: "two", label: "Section two", targetId: target.id }]} placeholder="Choose" />));
    const select = container.querySelector("select")!;
    select.value = "two";
    flushSync(() => select.dispatchEvent(new Event("change", { bubbles: true })));
    expect(target.scrollIntoView).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  } finally {
    flushSync(() => root.unmount());
    container.remove(); target.remove(); vi.restoreAllMocks();
  }
});
