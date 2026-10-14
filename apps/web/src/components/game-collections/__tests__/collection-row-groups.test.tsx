// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionRowGroups, collectionCardColumns } from "../CollectionRowGroups";

const items = Array.from({ length: 13 }, (_, index) => ({ id: String(index), name: `Item ${index}` }));
let resize: ResizeObserverCallback;
vi.stubGlobal("ResizeObserver", class {
  constructor(callback: ResizeObserverCallback) { resize = callback; }
  observe() {}
  disconnect() {}
});
afterEach(() => {
  document.body.innerHTML = "";
  // Each test waits for its own observer; drop the callback left by an unmounted root.
  resize = undefined as unknown as ResizeObserverCallback;
});

function Groups({ view = "cards", visible = items, wide = false }: { view?: "cards" | "list"; visible?: typeof items; wide?: boolean }) {
  return <section className="collections-stream"><CollectionRowGroups items={visible} slots={items.length} activeView={view} wide={wide}
    renderCard={item => <article>{item.name}</article>}
    renderList={group => <table><tbody>{group.map(item => <tr key={item.id}><td>{item.name}</td></tr>)}</tbody></table>}
  /></section>;
}

describe("collection ad boundaries", () => {
  it("server-renders one four-card row per group for the 1440px layout", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<Groups />);
    const groups = [...container.querySelectorAll("[data-collections-group]:not([hidden])")];
    expect(groups.map(group => group.querySelectorAll("[data-journey-item]").length)).toEqual([4, 4, 4, 1]);
    expect(container.querySelector(".collections-stream")?.children).toHaveLength(13);
  });

  it("matches the card column breakpoints in ads-collections.css", () => {
    expect([358, 459, 460, 739, 740, 919, 920, 1120].map(width => collectionCardColumns(width, false))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect([358, 519, 520, 849, 850, 1120].map(width => collectionCardColumns(width, true))).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("regroups into exactly one row at every column count without changing boundaries", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToStaticMarkup(<Groups />);
    const stream = container.querySelector(".collections-stream")!;
    const groups = [...stream.children];
    const root = hydrateRoot(container, <Groups />);
    try {
      await vi.waitFor(() => expect(resize).toBeTypeOf("function"));
      const rows = () => [...stream.querySelectorAll("[data-collections-group]:not([hidden])")]
        .map(group => group.querySelectorAll("[data-journey-item]").length);
      flushSync(() => resize([{ contentRect: { width: 864 } } as ResizeObserverEntry], {} as ResizeObserver));
      expect(rows()).toEqual([3, 3, 3, 3, 1]);
      flushSync(() => resize([{ contentRect: { width: 677 } } as ResizeObserverEntry], {} as ResizeObserver));
      expect(rows()).toEqual([2, 2, 2, 2, 2, 2, 1]);
      flushSync(() => resize([{ contentRect: { width: 1120 } } as ResizeObserverEntry], {} as ResizeObserver));
      expect(rows()).toEqual([4, 4, 4, 1]);
      expect([...stream.children]).toEqual(groups);
    } finally { root.unmount(); }
  });

  it("server-renders wide cards as complete three-column rows", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<Groups wide />);
    const groups = [...container.querySelectorAll("[data-collections-group]:not([hidden])")];
    expect(groups.map(group => group.querySelectorAll("[data-journey-item]").length)).toEqual([3, 3, 3, 3, 1]);
    expect(container.querySelector(".collections-stream")?.children).toHaveLength(13);
  });

  it("hydrates wide rows without replacing boundaries, then retains an ad on phone", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToStaticMarkup(<Groups wide />);
    const stream = container.querySelector(".collections-stream")!;
    const groups = [...stream.children];
    const errors: unknown[] = [];
    const root = hydrateRoot(container, <Groups wide />, { onRecoverableError: error => errors.push(error) });
    try {
      await vi.waitFor(() => expect(resize).toBeTypeOf("function"));
      expect(errors).toEqual([]);
      expect([...stream.children]).toEqual(groups);
      flushSync(() => resize([{ contentRect: { width: 808 } } as ResizeObserverEntry], {} as ResizeObserver));
      expect(stream.querySelectorAll("[data-collections-group]:not([hidden])")).toHaveLength(7);
      flushSync(() => resize([{ contentRect: { width: 657 } } as ResizeObserverEntry], {} as ResizeObserver));
      expect(stream.querySelectorAll("[data-collections-group]:not([hidden])")).toHaveLength(7);
      const ad = document.createElement("div");
      groups[0].after(ad);
      flushSync(() => resize([{ contentRect: { width: 358 } } as ResizeObserverEntry], {} as ResizeObserver));
      expect(stream.querySelectorAll("[data-collections-group]:not([hidden])")).toHaveLength(13);
      expect([...stream.children].filter(element => element !== ad)).toEqual(groups);
      expect(ad.parentElement).toBe(stream);
    } finally { root.unmount(); }
  });

  it("retains group elements and an inserted ad through view, width and filter changes", async () => {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    const render = async (view: "cards" | "list", visible = items) => {
      flushSync(() => root.render(<Groups view={view} visible={visible} />));
      await new Promise(resolve => setTimeout(resolve, 0));
    };
    try {
      await render("cards");
      const stream = container.querySelector(".collections-stream")!;
      const groups = [...stream.children];
      const ad = document.createElement("div"); ad.className = "mv-ad-box";
      groups[0].after(ad);
      await render("list");
      expect([...stream.children].filter(element => element !== ad)).toEqual(groups);
      expect(ad.parentElement).toBe(stream);
      const listGroups = [...stream.querySelectorAll("[data-collections-group]:not([hidden])")];
      expect(listGroups.map(group => group.querySelectorAll("tbody tr").length)).toEqual([10, 3]);
      // One table split in two chunks: header shown on the first, frame closed on the last.
      expect(listGroups.map(group => [group.classList.contains("ads-tables-chunk-first"), group.classList.contains("ads-tables-chunk-last")])).toEqual([[true, false], [false, true]]);
      expect(new Set(listGroups.map(group => group.getAttribute("data-collections-list"))).size).toBe(1);
      flushSync(() => resize([{ contentRect: { width: 390 } } as ResizeObserverEntry], {} as ResizeObserver));
      await render("cards");
      expect(stream.querySelectorAll("[data-collections-group]:not([hidden])")).toHaveLength(13);
      expect([...stream.children].filter(element => element !== ad)).toEqual(groups);
      await render("cards", items.slice(0, 2));
      expect(stream.querySelectorAll("[data-collections-group]:not([hidden])")).toHaveLength(2);
      expect([...stream.children].filter(element => element !== ad)).toEqual(groups);
      expect(ad.parentElement).toBe(stream);
    } finally { root.unmount(); }
  });
});
