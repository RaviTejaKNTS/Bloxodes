import { describe, expect, it } from "vitest";
import {
  articleBlockErrors,
  extractArticleBlockImageRefs,
  parseArticleContentPages,
  parseArticleContentBlocks,
  stripArticleContentBlocks,
  validateTierListArticleDetails,
} from "../article-blocks";

const tierListMarkdown = [
  "Direct answer.",
  "",
  "```tier-list",
  "schema: 1",
  "id: fighting-styles",
  "title: Fighting styles ranked",
  "scope: General combat",
  "tiers:",
  "  - rank: S",
  "    label: Best overall",
  "    items:",
  "      - name: Hakari",
  "        image: /Gakuran/Fighting%20Styles/hakari.png",
  "        alt: Hakari fighting style icon",
  "  - rank: A",
  "    items:",
  "      - name: Boxing",
  "        image: /Gakuran/Fighting%20Styles/boxing.png",
  "        alt: Boxing fighting style icon",
  "```",
  "",
  "## S Tier",
].join("\n");

describe("article content blocks", () => {
  it("parses markdown and tier-list blocks in order", () => {
    const blocks = parseArticleContentBlocks(tierListMarkdown);
    expect(blocks.map((block) => block.kind)).toEqual(["markdown", "tier-list", "markdown"]);
    expect(blocks[1]).toMatchObject({
      kind: "tier-list",
      data: { id: "fighting-styles", tiers: [{ rank: "S" }, { rank: "A" }] },
    });
  });

  it("extracts tier-list image references", () => {
    expect(extractArticleBlockImageRefs(tierListMarkdown)).toEqual([
      {
        blockId: "fighting-styles",
        itemName: "Hakari",
        alt: "Hakari fighting style icon",
        src: "/Gakuran/Fighting%20Styles/hakari.png",
        kind: "tier-list",
      },
      {
        blockId: "fighting-styles",
        itemName: "Boxing",
        alt: "Boxing fighting style icon",
        src: "/Gakuran/Fighting%20Styles/boxing.png",
        kind: "tier-list",
      },
    ]);
  });

  it("parses a sectioned embedded checklist", () => {
    const markdown = [
      "```article-checklist",
      "schema: 1",
      "id: raid-preparation",
      "title: Before entering the raid",
      "sections:",
      "  - title: Gear",
      "    items:",
      "      - id: equip-weapon",
      "        label: Equip a ranged weapon",
      "        description: This makes the second phase safer.",
      "```",
    ].join("\n");

    expect(parseArticleContentBlocks(markdown)).toMatchObject([
      {
        kind: "article-checklist",
        data: { id: "raid-preparation", sections: [{ title: "Gear" }] },
      },
    ]);
  });

  it("splits content at validated page-break blocks", () => {
    const markdown = [
      "Intro and first section.",
      "",
      "```article-page-break",
      "schema: 1",
      "id: page-two",
      "```",
      "",
      "Second page section.",
    ].join("\n");

    expect(parseArticleContentBlocks(markdown).map((block) => block.kind)).toEqual([
      "markdown",
      "article-page-break",
      "markdown",
    ]);
    expect(parseArticleContentPages(markdown).map((page) => page.length)).toEqual([1, 1]);
  });

  it("rejects page breaks at the beginning, end, or next to another break", () => {
    const markdown = [
      "```article-page-break",
      "schema: 1",
      "id: page-two",
      "```",
      "",
      "Content.",
      "",
      "```article-page-break",
      "schema: 1",
      "id: page-three",
      "```",
    ].join("\n");

    expect(articleBlockErrors(markdown)).toEqual([
      "article-page-break: Page breaks must appear between content sections",
      "article-page-break: The article cannot end with a page break",
    ]);
  });

  it("reports invalid schemas and duplicate items", () => {
    const invalid = tierListMarkdown.replace("      - name: Boxing", "      - name: Hakari");
    expect(articleBlockErrors(invalid).join(" ")).toContain("Duplicate tier-list item");
  });

  it("strips structured blocks while preserving prose", () => {
    const plain = stripArticleContentBlocks(tierListMarkdown);
    expect(plain).toContain("Direct answer");
    expect(plain).toContain("## S Tier");
    expect(plain).not.toContain("Gakuran/Fighting");
  });

  it("does not parse custom-looking fences inside ordinary code examples", () => {
    const markdown = [
      "````md",
      "```tier-list",
      "schema: 1",
      "```",
      "````",
    ].join("\n");
    expect(parseArticleContentBlocks(markdown)).toEqual([{ kind: "markdown", markdown }]);
  });

  it("validates one matching detail table per tier", () => {
    const details = [
      tierListMarkdown,
      "",
      "| Image | Style | Details |",
      "|---|---|---|",
      "| ![Hakari fighting style icon](/Gakuran/Fighting%20Styles/hakari.png) | Hakari | Strong |",
      "",
      "## A Tier",
      "",
      "| Image | Style | Details |",
      "|---|---|---|",
      "| ![Boxing fighting style icon](/Gakuran/Fighting%20Styles/boxing.png) | Boxing | Reliable |",
    ].join("\n");
    expect(validateTierListArticleDetails(details)).toEqual([]);
    expect(validateTierListArticleDetails(tierListMarkdown)).toContain("## S Tier must begin with a Markdown detail table");

    const lateTable = details.replace("## A Tier\n\n| Image", "## A Tier\n\nBoxing remains useful.\n\n| Image");
    expect(validateTierListArticleDetails(lateTable)).toContain("## A Tier must begin with a Markdown detail table");
  });
});
