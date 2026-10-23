// @vitest-environment jsdom
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import ProfilePage from "@/app/(site)/tools/roblox-profile-checker/page";
import AccountValuePage from "@/app/(site)/tools/roblox-account-value-calculator/page";
import UsernamePage from "@/app/(site)/tools/roblox-username-generator/page";
import { renderToolsPage } from "@/app/(site)/tools/page-data";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tools", () => ({ getToolContentWithDevFallback: async () => ({ id: "tool", code: "tool", title: "Tool", meta_description: "Tool description", faq_json: [{ q: "Question?", a: "Answer." }] }) }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));
vi.mock("@/components/more-content", () => ({ MoreTools: () => null }));
vi.mock("@/components/UpdatedTimestamp", () => ({ UpdatedTimestamp: () => null }));
function InteractiveTestWidget() {
  const [expanded, setExpanded] = useState(false);
  return <div data-tool-widget><button onClick={() => setExpanded(!expanded)}>Show results</button>{expanded ? <p data-tool-result>Tool results</p> : null}</div>;
}
vi.mock("@/app/(site)/tools/roblox-profile-checker/RobloxProfileCheckerClient", () => ({ RobloxProfileCheckerClient: () => <InteractiveTestWidget /> }));
vi.mock("@/app/(site)/tools/roblox-account-value-calculator/RobloxAccountValueCalculatorClient", () => ({ RobloxAccountValueCalculatorClient: () => <InteractiveTestWidget /> }));
vi.mock("@/app/(site)/tools/roblox-username-generator/RobloxUsernameGeneratorClient", () => ({ RobloxUsernameGeneratorClient: () => <InteractiveTestWidget /> }));
vi.mock("@/lib/page-content", () => ({ buildPageContentHtml: async () => ({ introHtml: "Intro", howHtml: "How to use", descriptionHtml: [{ key: "one", html: "Explanation" }], faqHtml: [{ q: "Question?", a: "Answer." }] }), renderPageContentNodes: (html: string) => [<p key={html}>{html}</p>] }));

it.each([ProfilePage, AccountValuePage, UsernamePage])("keeps intro, the stable tool wrapper and explanations in one stream with one rail", async (render) => {
  const $ = load(renderToStaticMarkup(await render()));
  expect($("#article-body")).toHaveLength(1);
  expect($(".content-sidebar-grid > aside#sidebar.space-y-4")).toHaveLength(1);
  expect($("aside#sidebar")).toHaveLength(1);
  expect($(".ads-tools-widget")).toHaveLength(1);
  expect($("#article-body > div.ads-tools-widget [data-tool-widget]")).toHaveLength(1);
  expect($(".ads-tools-widget").prev().text()).toBe("Intro");
  expect($(".ads-tools-widget").next().text()).toBe("How to use");
  expect($("#article-body > p").map((_, node) => $(node).text()).get()).toEqual(["Intro", "How to use", "Explanation"]);
  expect($("#article-body > .ads-tools-faq-item")).toHaveLength(1);
});

it.each([ProfilePage, AccountValuePage, UsernamePage])("keeps the same direct children when tool results grow and clear", async (render) => {
  const page = await render();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    // GitHub loads React's production build, so use flushSync rather than act.
    flushSync(() => root.render(page));
    const stream = container.querySelector("#article-body")!;
    const children = [...stream.children];
    const wrapper = stream.querySelector(":scope > div.ads-tools-widget")!;
    const button = wrapper.querySelector("button")!;
    expect(container.querySelectorAll("#article-body")).toHaveLength(1);
    expect(container.querySelectorAll("aside#sidebar")).toHaveLength(1);
    expect(children).toContain(wrapper);
    for (const visible of [true, false]) {
      flushSync(() => button.click());
      expect(Boolean(wrapper.querySelector("[data-tool-result]"))).toBe(visible);
      expect(container.querySelector("#article-body")).toBe(stream);
      expect(container.querySelectorAll("#article-body")).toHaveLength(1);
      expect(container.querySelectorAll("aside#sidebar")).toHaveLength(1);
      expect(stream.children).toHaveLength(children.length);
      children.forEach((child, index) => expect(stream.children[index]).toBe(child));
    }
  } finally {
    flushSync(() => root.unmount());
    container.remove();
  }
});

it.each([1, 2])("keeps tool index page %i ad boundaries and a single rail", page => {
  const $ = load(renderToStaticMarkup(renderToolsPage({ tools: [{ id: "first", code: "first", title: "First tool", seo_title: "", intro_md: "", meta_description: "First", thumb_url: null }, { id: "second", code: "second", title: "Second tool", seo_title: "", intro_md: "", meta_description: "Second", thumb_url: null }], total: 2, totalPages: 2, currentPage: page, showHero: page === 1, latestUpdatedAt: null })));
  expect($("#article-body")).toHaveLength(1);
  expect($(".content-sidebar-grid > aside#sidebar.space-y-4")).toHaveLength(1);
  expect($("aside#sidebar")).toHaveLength(1);
  expect($("#article-body > [data-journey-item]")).toHaveLength(2);
  expect($("#article-body [data-journey-item] [data-journey-item]")).toHaveLength(0);
});

// Cover every bespoke wrapper as well as the rendered shared-template tests.
// Each client lives inside one stable direct-child div, or uses DedicatedToolPage.
const toolsDir = resolve(process.cwd(), "src/app/(site)/tools");
const pages = readdirSync(toolsDir, { withFileTypes: true }).filter(entry => entry.isDirectory() && entry.name !== "page");
describe("all Roblox tool page wrappers", () => {
  it.each(pages.map(entry => entry.name))("keeps %s client state inside a stable direct-child tool wrapper", directory => {
    const path = `${toolsDir}/${directory}/page.tsx`;
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let templates = 0;
    function attribute(opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) {
      const prop = opening.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === name);
      return prop && ts.isJsxAttribute(prop) && prop.initializer && ts.isStringLiteral(prop.initializer) ? prop.initializer.text : undefined;
    }
    function visit(node: ts.Node, ancestors: ts.JsxElement[] = []) {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const opening = ts.isJsxElement(node) ? node.openingElement : node;
        const tag = opening.tagName.getText(source);
        if (tag === "ToolPageLayout" || tag === "DedicatedToolPage") templates++;
        if (/Client$/.test(tag)) {
          const parent = ancestors[ancestors.length - 1].openingElement;
          if (parent.tagName.getText(source) !== "DedicatedToolPage") {
            expect(parent.tagName.getText(source)).toBe("div");
            expect(attribute(parent, "className")?.split(/\s+/)).toContain("ads-tools-widget");
            expect(attribute(ancestors[ancestors.length - 2].openingElement, "id")).toBe("article-body");
          }
        }
      }
      const nextAncestors = ts.isJsxElement(node) ? [...ancestors, node] : ancestors;
      ts.forEachChild(node, child => visit(child, nextAncestors));
    }
    visit(source);
    expect(templates).toBe(1);
  });
});

it.each([
  "roblox-profile-checker/RobloxProfileCheckerClient.tsx",
  "roblox-account-value-calculator/RobloxAccountValueCalculatorClient.tsx"
])("keeps %s lookups and reset out of browser history", path => {
  const source = readFileSync(`${toolsDir}/${path}`, "utf8");
  expect(source).not.toMatch(/history\.(?:replaceState|pushState)/);
  expect(source).toContain('get("username")');
});
