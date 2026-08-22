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

  it("renders accepted missing visuals as text tiles", () => {
    const html = renderToStaticMarkup(
      <ArticleTierList
        data={{
          schema: 1,
          id: "evomon",
          title: "Evomon ranked",
          tiers: [{ rank: "A", items: [{ name: "Ignifist" }] }],
        }}
      />
    );

    expect(html).toContain('data-tier-list-text-item="true"');
    expect(html).toContain('aria-label="Ignifist, image unavailable"');
  });

  it("renders one derived collection link instead of per-item links", () => {
    const html = renderToStaticMarkup(
      <ArticleTierList
        data={{
          schema: 1,
          id: "pets",
          title: "Pets ranked",
          tiers: [
            {
              rank: "S",
              items: [
                {
                  name: "Unicorn",
                  image: "/Grow%20a%20Garden%202/Pets/unicorn.webp",
                  alt: "Unicorn pet icon",
                  href: "/wiki/grow-a-garden-2/pets#item-unicorn-row",
                },
                {
                  name: "Raccoon",
                  image: "/Grow%20a%20Garden%202/Pets/raccoon.webp",
                  alt: "Raccoon pet icon",
                  href: "/wiki/grow-a-garden-2/pets#item-raccoon-row",
                },
              ],
            },
          ],
        }}
      />
    );

    expect(html).toContain('href="/wiki/grow-a-garden-2/pets"');
    expect(html).toContain("Pets collection");
    expect(html).not.toContain("#item-unicorn-row");
  });

  it("prefers an explicit collection link over the scope label", () => {
    const html = renderToStaticMarkup(
      <ArticleTierList
        data={{
          schema: 1,
          id: "units",
          title: "Units ranked",
          scope: "Story mode",
          collection: { href: "/wiki/anime-squadron/units", label: "All units" },
          tiers: [
            {
              rank: "S",
              items: [{ name: "Shin", image: "/Anime%20Squadron/units/shin.png", alt: "Shin unit icon" }],
            },
          ],
        }}
      />
    );

    expect(html).toContain('href="/wiki/anime-squadron/units"');
    expect(html).toContain("All units");
    expect(html).not.toContain("Story mode");
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
