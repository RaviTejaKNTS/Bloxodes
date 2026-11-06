// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionChecklist } from "../CollectionChecklist";

const progress = vi.hoisted(() => ({ checked: new Set<string>(), toggle: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/collection-checklist-progress-client", () => ({
  useCollectionChecklistProgress: () => progress,
  dispatchCollectionChecklistProgress: vi.fn(), trackCollectionChecklistEvent: vi.fn()
}));
vi.mock("@/components/game-collections/CollectionImageLightbox", () => ({ CollectionImageLightbox: () => null }));
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
beforeEach(() => { progress.checked.clear(); progress.toggle.mockClear(); });

const props = {
  code: "items", gameName: "Example", collectionLabel: "Items",
  progressOptions: { code: "items", endpoint: "/api/example", requestKey: "code", storageKeyPrefix: "example:" },
  cardFields: ["sea", "status", "reward", "notes", "walkthroughUrl", "empty"],
  fieldLabels: { sea: "sea", status: "Status", reward: "Reward" },
  sections: [{ id: "items", label: "Items", items: [
    { id: "a", name: "Alpha", image: "/a.png", imageCreditUrl: "https://example.com/credit", sea: 1,
      status: "Available", reward: "Yes", notes: "n".repeat(101), walkthroughUrl: "https://www.youtube.com/watch?v=QdBZY2fkU-0" },
    { id: "b", name: "Beta", status: "Removed", reward: "No" }
  ] }]
};

async function mount(stream: boolean) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(<CollectionChecklist {...props} stream={stream} />));
  await new Promise(resolve => setTimeout(resolve, 0));
  return { container, root, cleanup: () => { root.unmount(); container.remove(); } };
}

describe("collectable collection cards", () => {
  it("SSR keeps clamped text and disabled checkboxes", () => {
    const html = renderToStaticMarkup(<CollectionChecklist {...props} stream />);
    expect(html).toContain("n".repeat(101));
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("--wide");
  });

  it.each([true, false])("uses shared facts and click handling in stream=%s", async stream => {
    const view = await mount(stream);
    try {
      const card = view.container.querySelector<HTMLElement>("#item-a")!;
      const second = view.container.querySelector<HTMLElement>("#item-b")!;
      expect(card.querySelector("h3")?.textContent).toBe("Alpha");
      expect(card.querySelector(".collection-card-title")?.textContent).toContain("#1");
      expect([...card.querySelectorAll("dt")].map(node => node.textContent)).toEqual(["Sea", "Status", "Reward", "Notes", "Walkthrough Url"]);
      expect(card.querySelector(".collection-card-media")?.classList.contains("aspect-square")).toBe(true);
      expect(second.querySelector(".collection-card-media") !== null).toBe(stream);
      expect([...second.querySelectorAll("dd")].map(node => node.textContent)).toEqual(stream ? ["-", "Removed", "No", "-", "-"] : ["Removed", "No"]);
      expect(card.querySelector("dd.text-emerald-300")?.textContent).toContain("Available");
      expect(second.querySelector("dd.text-rose-300")?.textContent).toContain("Removed");
      expect([...card.querySelectorAll("dd.text-foreground")].some(node => node.textContent === "Yes")).toBe(true);
      expect(card.querySelector("dd [class*=rounded]")).toBeNull();
      const more = card.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
      flushSync(() => more.click());
      expect(more.getAttribute("aria-expanded")).toBe("true");
      expect(progress.toggle).not.toHaveBeenCalled();
      for (const element of card.querySelectorAll<HTMLElement>("a, [data-collection-image-preview]")) {
        element.addEventListener("click", event => event.preventDefault());
        flushSync(() => element.click());
      }
      expect(progress.toggle).not.toHaveBeenCalled();
      flushSync(() => card.querySelector("h3")!.click());
      expect(progress.toggle).toHaveBeenCalledExactlyOnceWith("a");
      progress.toggle.mockClear();
      flushSync(() => card.querySelector("input")!.click());
      expect(progress.toggle).toHaveBeenCalledExactlyOnceWith("a");
      const list = [...view.container.querySelectorAll("button")].find(button => button.textContent === "List")!;
      flushSync(() => list.click());
      expect(view.container.querySelector("table .text-emerald-300")?.textContent).toBe("Available");
      expect(view.container.querySelector("table .text-rose-300")?.textContent).toBe("Removed");
      expect(view.container.querySelector("table a")?.getAttribute("href")).toBe("https://example.com/credit");
      expect(view.container.querySelector("table [aria-expanded]")).toBeNull();
    } finally { view.cleanup(); }
  });

  it("keeps completed styling and checkbox labels", async () => {
    progress.checked.add("a");
    const view = await mount(true);
    try {
      const card = view.container.querySelector("#item-a")!;
      expect(card.className).toContain("border-accent/50");
      expect(card.querySelector("h3")?.className).toContain("line-through");
      expect(card.querySelector("input")?.getAttribute("aria-label")).toBe("Alpha, completed");
    } finally { view.cleanup(); }
  });
});
