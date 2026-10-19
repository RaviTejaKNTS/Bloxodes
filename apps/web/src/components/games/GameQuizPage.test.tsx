import { describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { GameQuizPage, gameQuizMetadata } from "./GameQuizPage";
import { QuizPageTemplate } from "@/components/quizzes/QuizPageTemplate";
import type { GameExtendedPage } from "@/lib/game-page-data";

vi.mock("server-only", () => ({}));
vi.mock("./GameRelatedLinks", () => ({ GameRelatedLinks: () => <a href="/example/wiki/child">Child wiki</a> }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => <div data-comments /> }));
vi.mock("@/components/QuizRunner", () => ({ QuizRunner: ({ quizCode, heroImage, progress }: { quizCode: string; heroImage: string; progress: { progressEndpoint: string } }) => <div data-quiz={quizCode} data-cover={heroImage} data-progress={progress.progressEndpoint} /> }));

const question = { id: "question", question: "Choose A", options: ["a", "b", "c", "d"].map(id => ({ id, text: id })), correctOptionId: "a" };
const page: GameExtendedPage = {
  id: "quiz", namespace: "example", game_id: "child", game_title: "Child", slug: "child-quiz", title: "Child Quiz",
  canonical_path: "/example/quizzes/child-quiz", image: "https://media.bloxodes.com/child-cover.webp",
  seo_title: null, meta_description: "Test your Child knowledge.", intro_md: "Answer the Child questions.", description_md: "Race across the tracks.",
  sources_json: [], published_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  quiz_data: { easy: [question], medium: [{ ...question, id: "medium" }], hard: [{ ...question, id: "hard" }] }
};

describe("franchise quiz presentation", () => {
  it("uses the Roblox quiz template with one ad stream, a direct sidebar and the same saved progress key", async () => {
    const element = GameQuizPage({ page });
    expect(element.type).toBe(QuizPageTemplate);
    const $ = load(renderToStaticMarkup(await QuizPageTemplate(element.props)));
    expect($("#article-body")).toHaveLength(1);
    expect($(".content-sidebar-grid > aside#sidebar.space-y-4")).toHaveLength(1);
    expect($("#article-body [data-quiz]").attr("data-quiz")).toBe("example:child-quiz");
    expect($("[data-quiz]").attr("data-cover")).toBe(page.image);
    expect($("[data-quiz]").attr("data-progress")).toBe("/api/games/example/quizzes/progress");
    expect($("#sidebar a[href='/example/wiki/child']")).toHaveLength(1);
    expect($("[data-comments]")).toHaveLength(1);
    const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
    expect(graph.find((entry: { "@type": string }) => entry["@type"] === "WebApplication").image).toEqual([page.image]);
  });
  it("emits the owning game's social cover and exact canonical URL", () => {
    const metadata = gameQuizMetadata(page);
    expect(metadata.openGraph).toMatchObject({ images: [page.image], url: "https://bloxodes.com/example/quizzes/child-quiz" });
    expect(metadata.twitter).toMatchObject({ images: [page.image] });
  });
});
