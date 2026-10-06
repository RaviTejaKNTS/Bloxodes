import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: { id: "user-a" } as { id: string } | null, page: true, saves: [] as unknown[], filters: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("../auth/session-user", () => ({ getSessionUser: async () => state.user }));
vi.mock("../security/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true }) }));
const quiz = Object.fromEntries(["easy", "medium", "hard"].map(level => [level, [{ id: level, question: "Which letter?", options: ["a", "b", "c", "d"].map(id => ({ id, text: id })), correctOptionId: "a" }]]));
vi.mock("../supabase", () => ({ supabaseAdmin: () => ({
  from: (table: string) => {
    const chain = { select: () => chain, eq: (key: string, value: unknown) => { state.filters.push([key, value]); return chain; },
      maybeSingle: async () => ({ data: table === "game_quiz_pages_view" ? state.page ? { id: "quiz-a", quiz_data: quiz } : null : { seen_question_ids: ["easy", "removed-question"], last_score: 1 }, error: null }) };
    return chain;
  },
  rpc: async (name: string, args: unknown) => { state.saves.push([name, args]); return { error: null }; }
}) }));
import { handleGameQuizProgress } from "../game-quiz-progress";
const result = { code: "example:basics", questionIds: ["easy"], score: 1, total: 1, breakdown: { easy: { correct: 1, total: 1 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } }, user_id: "user-b" };
function put(body = result, origin = "https://bloxodes.com") {
  return new Request("https://bloxodes.com/api/games/example/quizzes/progress", { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => { state.user = { id: "user-a" }; state.page = true; state.saves = []; state.filters = []; });
describe("shared quiz account progress", () => {
  it("uses the session owner and atomic history RPC", async () => {
    const response = await handleGameQuizProgress(put(), "example");
    expect(response.status).toBe(200);
    expect(state.saves).toEqual([["save_game_quiz_progress", { target_user: "user-a", target_page: "quiz-a", target_namespace: "example", question_ids: ["easy"], score: 1, total: 1, breakdown: result.breakdown }]]);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("filters retired question IDs and scopes the account read", async () => {
    const response = await handleGameQuizProgress(new Request("https://bloxodes.com/api/games/example/quizzes/progress?code=example:basics"), "example");
    expect((await response.json()).seenQuestionIds).toEqual(["easy"]);
    expect(state.filters).toContainEqual(["user_id", "user-a"]);
    expect(state.filters).toContainEqual(["namespace", "example"]);
  });
  it("rejects foreign questions, namespace codes and inconsistent totals", async () => {
    expect((await handleGameQuizProgress(put({ ...result, questionIds: ["foreign"] }), "example")).status).toBe(400);
    expect((await handleGameQuizProgress(put({ ...result, code: "other:basics" }), "example")).status).toBe(400);
    expect((await handleGameQuizProgress(put({ ...result, score: 0 }), "example")).status).toBe(400);
    expect(state.saves).toEqual([]);
  });
  it("denies anonymous, untrusted and unpublished requests", async () => {
    expect((await handleGameQuizProgress(put(result, "https://untrusted.example"), "example")).status).toBe(403);
    state.user = null;
    expect((await handleGameQuizProgress(put(), "example")).status).toBe(401);
    state.user = { id: "user-a" }; state.page = false;
    expect((await handleGameQuizProgress(put(), "example")).status).toBe(404);
    expect(state.saves).toEqual([]);
  });
});
