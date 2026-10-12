import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/comments/route";
import { PATCH } from "@/app/api/comments/[id]/route";
import { COMMENT_LINK_ERROR } from "@/lib/comment-links";

const mocks = vi.hoisted(() => ({
  moderate: vi.fn(), user: vi.fn(), admin: vi.fn(), insert: vi.fn(), update: vi.fn(), revalidate: vi.fn()
}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidate }));
vi.mock("@/lib/auth/session-user", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("@/lib/comment-moderation", () => ({ moderateCommentBody: mocks.moderate }));
vi.mock("@/lib/comments", () => ({
  getCommentsTag: (type: string, id: string) => `comments:${type}:${id}`,
  toCommentEntry: (row: unknown) => row
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/security/request", () => ({ getRequestIp: () => "127.0.0.1", isTrustedMutationOrigin: () => true }));

const id = "10000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ id }) };

function request(method: string, payload: unknown) {
  return new Request("https://bloxodes.com/api/comments", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue(null);
  mocks.moderate.mockResolvedValue({ approved: true, moderation: {} });
  const row = { id, entity_type: "code", entity_id: id, slug: "example", author: null };
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    insert: mocks.insert.mockReturnThis(), update: mocks.update.mockReturnThis()
  };
  mocks.admin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
});

describe("comment mutation link rejection", () => {
  it.each([
    { body: "site.com", guestName: "Player" },
    { body: "discord. gg/abc", guestName: "Player" },
    { body: "A good guide", guestName: "site dot com" },
    { body: "[click](/path)", guestName: "Player" },
    { body: "A good guide", guestName: "player@site.com" }
  ])("rejects POST links before moderation or database access: %j", async (fields) => {
    const response = await POST(request("POST", { entityType: "code", entityId: id, guestEmail: "me@example.com", ...fields }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: COMMENT_LINK_ERROR });
    expect(mocks.moderate).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it.each(["site.com", "discord. gg/abc", "<img src='/a.png'>", "me@site.com", "h t t p s :/ /site.com"])(
    "rejects PATCH links before moderation or database access: %s", async (body) => {
      mocks.user.mockResolvedValue({ id });
      const response = await PATCH(request("PATCH", { body }), context);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: COMMENT_LINK_ERROR });
      expect(mocks.moderate).not.toHaveBeenCalled();
      expect(mocks.admin).not.toHaveBeenCalled();
    }
  );

  it("allows a plain guest comment and the required private email address", async () => {
    const response = await POST(request("POST", {
      entityType: "code", entityId: id, body: "Thanks! Got 2.5M coins.", guestName: "Player", guestEmail: "me@example.com"
    }));
    expect(response.status).toBe(200);
    expect(mocks.moderate).toHaveBeenCalledWith("Thanks! Got 2.5M coins.");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ guest_email: "me@example.com" }));
  });

  it("allows a plain signed-in edit through moderation and cache revalidation", async () => {
    mocks.user.mockResolvedValue({ id });
    const response = await PATCH(request("PATCH", { body: "v1.2 gives a 1.5x boost" }), context);
    expect(response.status).toBe(200);
    expect(mocks.moderate).toHaveBeenCalledWith("v1.2 gives a 1.5x boost");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ body_md: "v1.2 gives a 1.5x boost" }));
    expect(mocks.revalidate).toHaveBeenCalledWith(`comments:code:${id}`, { expire: 0 });
  });
});
