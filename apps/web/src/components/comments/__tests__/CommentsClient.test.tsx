// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommentsClient } from "@/components/comments/CommentsClient";
import type { CommentEntry } from "@/lib/comments";

function comment(id: string, parentId: string | null): CommentEntry {
  return {
    id, parent_id: parentId,
    body_md: '<a href="https://spam.example.com">spam</a>\nSecond line',
    // The client must also ignore HTML that an older cached payload generated.
    body_html: '<a href="https://spam.example.com">spam</a>',
    status: "approved", created_at: "2026-10-01T00:00:00Z", created_label: "Oct 1, 2026",
    author: {
      id: `guest:${id}`, display_name: "Player", role: null,
      roblox_avatar_url: null, roblox_display_name: null, roblox_username: null
    }
  };
}

describe("comments crawler and rendering boundaries", () => {
  it("marks the list and form as nosnippet and every comment and reply as Comment microdata", () => {
    const html = renderToStaticMarkup(
      <CommentsClient entityType="code" entityId="entity" initialComments={[comment("parent", null), comment("reply", "parent")]} />
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const comments = container.querySelector("#comments[data-nosnippet]")!;
    expect(comments).not.toBeNull();
    expect(comments.querySelector("form")).not.toBeNull();
    expect(comments.querySelectorAll('[itemscope][itemtype="https://schema.org/Comment"]')).toHaveLength(2);
    for (const prop of ["author", "name", "dateCreated", "text"]) {
      expect(comments.querySelectorAll(`[itemprop="${prop}"]`)).toHaveLength(2);
    }
    expect(comments.querySelector('[itemprop="dateCreated"]')?.getAttribute("datetime")).toBe("2026-10-01T00:00:00Z");
    expect(html).toContain("&lt;a href=&quot;https://spam.example.com&quot;&gt;spam&lt;/a&gt;<br />Second line");
    expect(html).not.toContain('href="https://spam.example.com"');
    expect(html).not.toContain("application/ld+json");
    // Only our own internal links (log in, privacy policy) may render as anchors.
    const hrefs = Array.from(comments.querySelectorAll("a[href]")).map((anchor) => anchor.getAttribute("href") ?? "");
    for (const href of hrefs) expect(href.startsWith("/")).toBe(true);
    expect(html).not.toContain("Links aren&#x27;t allowed");
    expect(html).not.toContain("Please remove the link");
  });
});
