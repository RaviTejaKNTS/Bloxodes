import { describe, expect, it, vi } from "vitest";
import { renderCommentText } from "@/lib/comment-text";
import { toCommentEntry, type CommentRow } from "@/lib/comments";

vi.mock("@/lib/public-content-cache", () => ({ publicContentCache: (loader: unknown) => loader }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: vi.fn() }));

describe("comment text rendering", () => {
  it("escapes HTML and preserves every line break", () => {
    expect(renderCommentText('<a href="/path">A & B</a>\r\n\'next\'\rfinal\nline'))
      .toBe("&lt;a href=&quot;/path&quot;&gt;A &amp; B&lt;/a&gt;<br />&#39;next&#39;<br />final<br />line");
  });

  it.each([
    "https://example.com", "www.example.com", "[click](https://example.com)",
    "![image](https://example.com/a.png)", '<iframe src="https://example.com"></iframe>',
    '<img src="x" onerror="alert(1)">', "<script>alert(1)</script>",
    "{{ youtube: QdBZY2fkU-0 }}", "<https://example.com>", "**bold** *italic*",
    "&lt;img src=x onerror=alert(1)&gt;"
  ])("keeps %s as text", (value) => {
    const html = renderCommentText(value);
    expect(html).not.toMatch(/<(?:a|img|iframe|script|strong|em)\b/i);
  });

  it("renders older stored comments through the safe path", async () => {
    const row: CommentRow = {
      id: "comment", parent_id: null, author_id: null, guest_name: "Player", author: null,
      body_md: '<iframe src="https://spam.example.com"></iframe>\n[click](https://example.com)',
      created_at: "2026-10-01T00:00:00Z", status: "approved"
    };
    const entry = await toCommentEntry(row);
    expect(entry.body_html).toBe(renderCommentText(row.body_md!));
    expect(entry.body_html).not.toMatch(/<(?:a|img|iframe)\b/i);
    expect(entry.body_md).toBe(row.body_md);
  });
});
