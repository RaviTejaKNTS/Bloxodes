// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/wiki/the-forge" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props: ComponentProps<"img">) => <img alt={props.alt} /> }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>
}));
vi.mock("@/components/AccountSheetButton", () => ({ AccountSheetButton: () => <button type="button">Account</button> }));
vi.mock("@/components/SiteFeedbackButton", () => ({ SiteFeedbackButton: () => <button type="button">Give feedback</button> }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => <button type="button">Theme</button> }));
vi.mock("@/components/GlobalSearchOverlay", () => ({ GlobalSearchOverlay: () => null }));

import { SiteHeader } from "@/components/SiteHeader";
import { signedOutSidebarAccount, siteNavLinks } from "@/lib/site-navigation";

function render() {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<SiteHeader account={signedOutSidebarAccount} />);
  return container;
}

function hrefs(root: Element | null) {
  return [...(root?.querySelectorAll("a[href]") ?? [])].map((link) => link.getAttribute("href"));
}

beforeEach(() => {
  navigation.pathname = "/wiki/the-forge";
});

describe("site header", () => {
  it("server-renders every section link in a sticky bar with search, More and account", () => {
    const container = render();
    const header = container.querySelector("header")!;
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("top-0");
    const primary = container.querySelector('nav[aria-label="Primary"]');
    expect(hrefs(primary)).toEqual(siteNavLinks.map((link) => link.href));
    expect(primary?.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe("/wiki");
    expect(container.querySelector('button[aria-label="Search"][data-search-trigger]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="More"]')?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("Account");
  });

  it("keeps the closed More drawer in the HTML with every section, feedback and theme", () => {
    const container = render();
    const drawer = container.querySelector("#site-more-drawer")!;
    expect(drawer.hasAttribute("hidden")).toBe(true);
    expect(drawer.querySelector("h2")).toBeNull();
    for (const link of siteNavLinks) expect(hrefs(drawer)).toContain(link.href);
    expect(drawer.textContent).toContain("Give feedback");
    expect(drawer.textContent).toContain("Theme");
  });

  it("uses the Roblox fallback in server HTML on game URLs before a bridge publishes", () => {
    navigation.pathname = "/wiki/gta-5/vehicles";
    const container = render();
    expect(hrefs(container.querySelector('nav[aria-label="Primary"]'))).toEqual(siteNavLinks.map(link => link.href));
    for (const link of siteNavLinks) expect(hrefs(container.querySelector("#site-more-drawer"))).toContain(link.href);
  });
});
