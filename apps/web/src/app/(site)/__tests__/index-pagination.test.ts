import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  permanentRedirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }
}));
vi.mock("../codes/page-data", () => ({
  codesMetadata: {},
  loadCodesPageData: vi.fn(async () => ({ games: [], total: 45, totalPages: 3 })),
  renderCodesPage: vi.fn((props) => props)
}));
vi.mock("../wiki/index-page-data", () => ({
  loadWikiIndexPageData: vi.fn(async (currentPage: number) => ({ pages: [], total: 45, totalPages: 3, currentPage })),
  renderWikiIndexPage: vi.fn((props) => props)
}));

import CodesPage, { generateMetadata as codesMetadata } from "../codes/page/[page]/page";
import WikiPage, { generateMetadata as wikiMetadata } from "../wiki/page/[page]/page";

describe.each([
  { family: "codes", render: CodesPage, metadata: codesMetadata },
  { family: "wiki", render: WikiPage, metadata: wikiMetadata }
])("$family index pagination", ({ family, render, metadata }) => {
  const props = (page: string) => ({ params: Promise.resolve({ page }) });

  it.each(["0", "-1", "abc", "2.5", "02", "2e0", "9007199254740992", "4"])("rejects invalid or out-of-range page %s", async (page) => {
    await expect(render(props(page))).rejects.toThrow("NOT_FOUND");
  });

  it("redirects page one to the editorial landing page", async () => {
    await expect(render(props("1"))).rejects.toThrow(`REDIRECT:/${family}`);
  });

  it("renders page two with its actual page number", async () => {
    expect(await render(props("2"))).toMatchObject({ currentPage: 2, totalPages: 3 });
  });

  it("uses a distinct canonical and social URL without forcing noindex", async () => {
    const result = await metadata(props("2"));
    expect(String(result.alternates?.canonical)).toMatch(new RegExp(`/${family}/page/2$`));
    expect(result.openGraph?.url).toMatch(new RegExp(`/${family}/page/2$`));
    expect(result.title).toContain("Page 2");
    expect(result.robots).toBeUndefined();
  });
});

it("keeps wiki search filters in the page-one redirect", async () => {
  await expect(WikiPage({params:Promise.resolve({page:"1"}),searchParams:Promise.resolve({q:"Fish & friends",sort:"name"})})).rejects.toThrow("REDIRECT:/wiki?q=Fish+%26+friends&sort=name#game-wikis");
});

it("keeps filtered wiki pagination out of the search index", async () => {
  const result = await wikiMetadata({params:Promise.resolve({page:"2"}),searchParams:Promise.resolve({genre:"RPG"})});
  expect(result.robots).toEqual({index:false,follow:true});
});
