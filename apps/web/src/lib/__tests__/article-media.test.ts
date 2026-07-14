import { describe, expect, it } from "vitest";
import {
  buildYouTubeEmbedHtml,
  classifyArticleImageSrc,
  extractYouTubeId,
  findMarkdownImages,
  findYouTubeDirectives,
  injectYouTubeEmbeds,
  suggestArticleImageMarkdown,
  stripArticleMediaForPlainText,
} from "../article-media";
import { markdownToPlainText, renderMarkdown } from "../markdown";

describe("extractYouTubeId", () => {
  it("parses watch, short, embed, and bare ids", () => {
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects junk", () => {
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(extractYouTubeId("not a video")).toBeNull();
  });
});

describe("youtube directives", () => {
  it("finds valid and invalid directives", () => {
    const md = [
      "Intro",
      "{{ youtube: https://www.youtube.com/watch?v=dQw4w9WgXcQ }}",
      "{{ youtube: https://example.com/v/nope }}",
      "{{youtube:abc123XYZ}}",
    ].join("\n");

    const found = findYouTubeDirectives(md);
    expect(found).toHaveLength(3);
    expect(found[0]?.videoId).toBe("dQw4w9WgXcQ");
    expect(found[1]?.videoId).toBeNull();
    expect(found[2]?.videoId).toBe("abc123XYZ");
  });

  it("injects privacy-friendly embeds", () => {
    const html = injectYouTubeEmbeds("See {{ youtube: dQw4w9WgXcQ }} now");
    expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(html).toContain('class="video-embed"');
    expect(html).not.toContain("{{ youtube");
  });

  it("leaves invalid directives untouched for verifier to catch", () => {
    const raw = "{{ youtube: https://example.com/v/1 }}";
    expect(injectYouTubeEmbeds(raw)).toBe(raw);
  });
});

describe("article images", () => {
  it("parses markdown images", () => {
    const images = findMarkdownImages('Hello ![Menu panel](/articles/foo/menu.webp) and ![x](https://media.bloxodes.com/a.webp)');
    expect(images).toHaveLength(2);
    expect(images[0]?.alt).toBe("Menu panel");
    expect(images[0]?.src).toBe("/articles/foo/menu.webp");
  });

  it("classifies allowed and blocked image srcs", () => {
    expect(classifyArticleImageSrc("/articles/foo/menu.webp", "foo")).toEqual({ ok: true, kind: "local" });
    expect(classifyArticleImageSrc("https://media.bloxodes.com/x.webp", "foo").ok).toBe(true);
    expect(classifyArticleImageSrc("https://static.wikia.nocookie.net/x.png", "foo").ok).toBe(false);
    expect(classifyArticleImageSrc("/articles/other/menu.webp", "foo").ok).toBe(false);
    expect(classifyArticleImageSrc("https://example.com/x.png", "foo").ok).toBe(false);
  });

  it("suggests hosted markdown", () => {
    expect(suggestArticleImageMarkdown({ slug: "Foo-Bar", fileName: "menu.webp", alt: "Menu" })).toBe(
      "![Menu](/articles/foo-bar/menu.webp)"
    );
  });
});

describe("plain text and render", () => {
  it("strips media for plain text", () => {
    const text = stripArticleMediaForPlainText(
      "A {{ youtube: dQw4w9WgXcQ }} B ![alt](/articles/foo/a.webp) C"
    );
    expect(text).not.toContain("youtube");
    expect(text).not.toContain("articles/foo");
    expect(markdownToPlainText("A {{ youtube: dQw4w9WgXcQ }} B")).toContain("A");
    expect(markdownToPlainText("A {{ youtube: dQw4w9WgXcQ }} B")).not.toContain("youtube");
  });

  it("renders youtube embed through sanitize path", async () => {
    const html = await renderMarkdown("Watch:\n\n{{ youtube: dQw4w9WgXcQ }}\n");
    expect(html).toContain("video-embed");
    expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(buildYouTubeEmbedHtml("dQw4w9WgXcQ")).toContain("iframe");
  });
});
