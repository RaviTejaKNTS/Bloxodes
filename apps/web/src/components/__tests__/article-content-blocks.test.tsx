import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleChecklist } from "../ArticleChecklist";
import { ArticleTierList } from "../ArticleTierList";

describe("article content block components", () => {
  it("server-renders tier images, names, and accessible tier labels", () => {
    const html = renderToStaticMarkup(
      <ArticleTierList
        data={{
          schema: 1,
          id: "styles",
          title: "Styles ranked",
          scope: "General combat",
          tiers: [
            {
              rank: "S",
              items: [
                {
                  name: "Hakari",
                  image: "/Gakuran/Fighting%20Styles/hakari.png",
                  alt: "Hakari fighting style icon",
                },
              ],
            },
          ],
        }}
      />
    );

    expect(html).toContain('data-article-block="tier-list"');
    expect(html).toContain('aria-label="S tier"');
    expect(html).toContain("Hakari fighting style icon");
    expect(html).toContain("General combat");
  });

  it("server-renders an unchecked checklist with progress semantics", () => {
    const html = renderToStaticMarkup(
      <ArticleChecklist
        articleSlug="raid-guide"
        data={{
          schema: 1,
          id: "raid-preparation",
          title: "Before entering the raid",
          items: [{ id: "reach-level-50", label: "Reach level 50" }],
        }}
      />
    );

    expect(html).toContain('data-article-block="checklist"');
    expect(html).toContain("0/1");
    expect(html).toContain("Reach level 50");
    expect(html).toContain('role="progressbar"');
  });
});
