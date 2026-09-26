import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";
import { renderHtmlAsReactNodes } from "@/lib/html-to-react";

describe("public rich-content rendering", () => {
  it("preserves readable entities and timestamp parameters through React rendering", () => {
    const html = '<p>Rock &amp; Roll &#8212; Phil&#39;s range</p><a href="https://www.youtube.com/watch?v=ES5qHy_7uMI&amp;t=92s">Watch</a>';
    const markup = renderToStaticMarkup(createElement("div", null, ...renderHtmlAsReactNodes(html)));
    const $ = load(markup);
    expect($("p").text()).toBe("Rock & Roll — Phil's range");
    const url = new URL($("a").attr("href")!);
    expect(url.searchParams.get("v")).toBe("ES5qHy_7uMI");
    expect(url.searchParams.get("t")).toBe("92s");
  });

  it("renders the privacy-friendly video embed without invalid DOM-property warnings", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const html = '<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/45QnFJnbk0A" frameborder="0" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
      const markup = renderToStaticMarkup(createElement("div", null, ...renderHtmlAsReactNodes(html)));
      const $ = load(markup);
      expect($(".video-embed iframe").attr("src")).toContain("youtube-nocookie.com");
      expect($("iframe").attr("frameborder")).toBe("0");
      expect($("iframe").attr("allowfullscreen")).toBeDefined();
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
