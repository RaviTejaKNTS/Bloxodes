// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildCollectionCardLayout, capitalizeCollectionLabel, collectionFactColor, CollectionFactRows, CollectionReadMore } from "../CollectionCardContent";
import { GameCollectionView } from "../GameCollectionView";

vi.mock("../CollectionImageLightbox", () => ({ CollectionImageLightbox: () => null }));
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });

const fact = (key: string, value: string | null, label = key) => ({ key, label, value });

describe("shared collection card content", () => {
  it("joins by key in supplied order, drops globally empty fields and fills missing neighbors", () => {
    const first = [fact("sea", "1"), { ...fact("reward", null), omitWhenEmpty: true }, fact("empty", null)];
    const second = [fact("sea", null), fact("reward", "Gold"), fact("empty", null)];
    const layout = buildCollectionCardLayout([{ fields: first }, { fields: second }]);
    expect(layout.fields.map(field => field.key)).toEqual(["sea", "reward"]);
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<CollectionFactRows fields={first} layout={layout} />);
    expect([...container.querySelectorAll("dt")].map(node => node.textContent)).toEqual(["Sea", "Reward"]);
    expect([...container.querySelectorAll("dd")].map(node => node.textContent)).toEqual(["1", "-"]);
    container.innerHTML = renderToStaticMarkup(<CollectionFactRows fields={[second[1]]} layout={layout} />);
    expect([...container.querySelectorAll("dd")].map(node => node.textContent)).toEqual(["-", "Gold"]);
    expect(buildCollectionCardLayout([{ fields: [] }]).rowCount).toBe(1);
  });

  it("reserves optional tracks once per group", () => {
    const layout = buildCollectionCardLayout([
      { fields: [fact("sea", "1")], image: true, tracks: true },
      { fields: [fact("sea", null)], description: true, details: true }
    ]);
    expect(layout).toMatchObject({ image: true, description: true, tracks: true, details: true, rowCount: 6 });
  });

  it("capitalizes only the first letter and colors only the displayed Status label", () => {
    expect(capitalizeCollectionLabel("sea")).toBe("Sea");
    expect(capitalizeCollectionLabel("best use")).toBe("Best use");
    for (const label of ["Tradable", "Best use", "Trading Status", "STATUS"]) {
      for (const tone of ["positive", "negative", "warning"]) {
        expect(collectionFactColor({ ...fact("key", "Yes", label), tone, kind: "highlight" })).toBe("text-foreground");
      }
    }
    for (const [tone, color] of [["positive", "text-emerald-300"], ["negative", "text-rose-300"], ["warning", "text-amber-300"]]) {
      expect(collectionFactColor({ ...fact("key", "Yes", "status"), tone })).toBe(color);
    }
    expect(collectionFactColor({ ...fact("key", "Yes", "Status"), kind: "highlight" })).toBe("text-emerald-300");
  });

  it.each([false, true])("keeps full clamped text in SSR HTML, description=%s", description => {
    const limit = description ? 135 : 100;
    for (const length of [limit, limit + 1]) {
      const text = "x".repeat(length);
      const container = document.createElement("div");
      container.innerHTML = renderToStaticMarkup(<CollectionReadMore text={text} description={description} />);
      expect(container.textContent).toContain(text);
      expect(container.querySelector("button")?.getAttribute("aria-expanded") ?? null).toBe(length > limit ? "false" : null);
      expect(container.querySelector(description ? ".line-clamp-3" : ".line-clamp-4") !== null).toBe(length > limit);
      expect(container.querySelector("[hidden]")).toBeNull();
      expect(container.innerHTML).not.toContain("display:none");
    }
  });

  it("expands only the clicked text and can close it again", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<><CollectionReadMore text={"a".repeat(101)} /><CollectionReadMore text={"b".repeat(101)} /></>));
      const buttons = container.querySelectorAll("button");
      flushSync(() => buttons[0].click());
      expect(buttons[0].getAttribute("aria-expanded")).toBe("true");
      expect(buttons[1].getAttribute("aria-expanded")).toBe("false");
      expect(buttons[0].textContent).toBe("Show less");
      flushSync(() => buttons[0].click());
      expect(container.querySelectorAll(".line-clamp-4")).toHaveLength(2);
    } finally { root.unmount(); }
  });

  it("renders every kind without pill classes and parts as separate list items", () => {
    const html = renderToStaticMarkup(<CollectionFactRows fields={["chip", "highlight", "detail", "normal"].map(kind => ({
      ...fact(kind, "One; Two"), kind, parts: ["One", "Two"]
    }))} />);
    const container = document.createElement("div"); container.innerHTML = html;
    expect(container.querySelectorAll("li")).toHaveLength(8);
    expect(html).not.toMatch(/rounded|bg-background|inline-flex|line-clamp/);
    expect(container.querySelectorAll("dd.text-foreground.text-right")).toHaveLength(4);
  });

  it("never cuts a long list or a link", () => {
    const long = "x".repeat(40);
    const html = renderToStaticMarkup(<CollectionFactRows fields={[
      { ...fact("bonuses", Array(5).fill(long).join("; ")), parts: Array(5).fill(long) },
      { ...fact("walkthroughUrl", `https://example.com/${"x".repeat(120)}`), kind: "link" }
    ]} />);
    expect(html).not.toMatch(/line-clamp|Read more/);
  });

  it("integrates group layout into real cards without dropping empty neighbors", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<GameCollectionView stream config={{
      slug: "items", label: "Items", groupLabel: "Items", cardFields: ["sea", "reward", "empty"],
      fieldLabels: { sea: "sea" }, fieldPresentation: { reward: { kind: "chip", omitWhenEmpty: true } }
    }} sections={[{ id: "items", label: "Items", items: [
      { id: "a", name: "A", sea: 1 }, { id: "b", name: "B", reward: "Gold" }
    ] }]} />);
    expect(container.querySelector(".collections-card-grid")?.getAttribute("style")).toContain("--collection-card-rows:3");
    const cards = container.querySelectorAll("article.collection-card");
    expect([...cards[0].querySelectorAll("dd")].map(node => node.textContent)).toEqual(["1", "-"]);
    expect([...cards[1].querySelectorAll("dd")].map(node => node.textContent)).toEqual(["-", "Gold"]);
    expect(container.innerHTML).not.toContain("--wide");
  });
  it("shows a real array as an uncut list, even on a configured field", () => {
    const places = ["Northern forest clearing beside the old mill and river", "Southern mountain entrance past the broken bridge"];
    const html = renderToStaticMarkup(<GameCollectionView stream config={{
      slug: "items", label: "Items", groupLabel: "Items", cardFields: ["places"],
      fieldPresentation: { places: { kind: "normal" } }
    }} sections={[{ id: "items", label: "Items", items: [{ id: "a", name: "A", places }] }]} />);
    expect(html).toContain(`<li>${places[0]}</li>`);
    expect(html).not.toContain("Read more");
  });

  it("keeps table values plain and colors only Status without clamping", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<GameCollectionView config={{
        slug: "items", label: "Items", groupLabel: "Items",
        stats: [{ key: "price", label: "Price" }, { key: "status", label: "Status" }, { key: "best", label: "Best use" }],
        fieldPresentation: { price: "chip", status: { kind: "highlight", tone: "positive" }, best: "highlight" }
      }} sections={[{ id: "items", label: "Items", items: [{ id: "a", name: "Alpha", price: "25 Coins", status: "Available", best: "x".repeat(101) }] }]} />));
      const list = [...container.querySelectorAll("button")].find(button => button.textContent === "List")!;
      flushSync(() => list.click());
      const values = [...container.querySelectorAll("tbody td")].slice(1);
      expect(values[0].innerHTML).not.toMatch(/rounded|inline-flex|bg-background/);
      expect(values[1].querySelector(".text-emerald-300")?.textContent).toBe("Available");
      expect(values[2].querySelector(".text-foreground")?.textContent).toBe("x".repeat(101));
      expect(container.querySelector("table [aria-expanded], table [class*=line-clamp]")).toBeNull();
    } finally { root.unmount(); }
  });

  it.each([false, true])("reserves media and description tracks for missing neighbors, hideMissing=%s", hideMissing => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<GameCollectionView stream config={{
      slug: "items", label: "Items", groupLabel: "Items", cardDescriptionKey: "summary", hideMissingImagePlaceholders: hideMissing
    }} sections={[{ id: "items", label: "Items", items: [
      { id: "a", name: "Alpha", image: "/a.png", summary: "A description" }, { id: "b", name: "Beta" }
    ] }]} />);
    const cards = container.querySelectorAll("article.collection-card");
    expect(container.querySelector(".collections-card-grid")?.getAttribute("style")).toContain("--collection-card-rows:3");
    expect(cards[0].querySelector(".collection-card-description")?.textContent).toBe("A description");
    expect(cards[1].querySelector(".collection-card-description")?.textContent).toBe("");
    expect(cards[1].querySelector(".collection-card-media") !== null).toBe(!hideMissing);
    expect(cards[1].querySelector("[data-collection-image-preview]")).toBeNull();
  });

});
