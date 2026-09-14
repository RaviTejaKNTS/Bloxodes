import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChecklistIndexPage } from "@/components/checklists/ChecklistIndexPage";
import { QuizIndexPage } from "@/components/quizzes/QuizIndexPage";
import { QuizPageTemplate, quizMetadata } from "@/components/quizzes/QuizPageTemplate";
import { checklistMetadata } from "@/components/ChecklistPageTemplate";
import { ROBLOX_CHECKLISTS, GTA_CHECKLISTS, ROBLOX_QUIZZES } from "@/lib/engagement/config";
import { engagementProgressKey, type QuizConfig, type QuizTemplateData } from "@/lib/engagement/types";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/markdown", () => ({ markdownToPlainText: (text: string) => text, renderMarkdown: async (text: string) => `<p>${text}</p>` }));
vi.mock("@/components/QuizRunner", () => ({ QuizRunner: (props: { quizCode: string; initialAttempt: unknown[]; progress: { progressEndpoint: string } }) => createElement("div", {
  "data-quiz-key": props.quizCode, "data-question-count": props.initialAttempt.length, "data-endpoint": props.progress.progressEndpoint
}) }));

// A fixture-only franchise proves new routes need configuration, not another UI.
const otherQuiz: QuizConfig = { ...ROBLOX_QUIZZES, basePath: "/example/quizzes", title: "Example Quizzes", description: "Test your Example game knowledge.", heading: "Example quizzes", homePath: "/example", progressNamespace: "example", progress: { sessionEndpoint: "/api/example/session", progressEndpoint: "/api/example/progress" } };
function quizData(): QuizTemplateData {
  const questions = (level: string) => Array.from({ length: 10 }, (_, i) => ({ id: `${level}-${i}`, question: "Question", correctOptionId: "a", options: ["a", "b", "c", "d"].map(id => ({ id, text: id })) }));
  return { page: { code: "sample", title: "Sample Quiz", gameName: "Sample", description_md: "Test your knowledge." }, questions: { easy: questions("easy"), medium: questions("medium"), hard: questions("hard") } };
}

describe("shared engagement page templates", () => {
  it("keeps existing progress keys and isolates another platform", () => {
    expect(engagementProgressKey(ROBLOX_CHECKLISTS.progressNamespace, "sample")).toBe("sample");
    expect(engagementProgressKey(GTA_CHECKLISTS.progressNamespace, "gta-5")).toBe("gta:gta-5");
    expect(engagementProgressKey(ROBLOX_QUIZZES.progressNamespace, "sample")).toBe("sample");
    expect(engagementProgressKey(otherQuiz.progressNamespace, "sample")).toBe("example:sample");
  });
  it("renders both checklist indexes with the same DOM classes and platform URLs", () => {
    const render = (config: typeof GTA_CHECKLISTS) => renderToStaticMarkup(createElement(ChecklistIndexPage, {
      config, cards: [], total: 0, totalPages: 2, currentPage: 1, showHero: true
    }));
    const roblox = render(ROBLOX_CHECKLISTS); const gta = render(GTA_CHECKLISTS);
    const classes = (html: string) => [...html.matchAll(/class="([^"]*)"/g)].map(m => m[1]);
    expect(classes(gta)).toEqual(classes(roblox));
    expect(roblox).toContain('href="/checklists/page/2"');
    expect(gta).toContain('href="/gta/checklists/page/2"');
    expect(gta).not.toContain("Roblox");
  });
  it("renders quiz index copy and canonical from supplied configuration", () => {
    const html = renderToStaticMarkup(createElement(QuizIndexPage, { config: otherQuiz, cards: [], total: 0 }));
    expect(html).toContain("Example quizzes");
    expect(html).toContain('"url":"https://bloxodes.com/example/quizzes"');
    expect(html).not.toContain("Roblox");
  });
  it("keeps the 15-question attempt while passing platform progress and related-content slots", async () => {
    const html = renderToStaticMarkup(await QuizPageTemplate({ data: quizData(), config: otherQuiz,
      sidebar: createElement("span", null, "Platform sidebar"), relatedContent: createElement("span", null, "Related quizzes") }));
    expect(html).toContain('data-quiz-key="example:sample"');
    expect(html).toContain('data-question-count="15"');
    expect(html).toContain('data-endpoint="/api/example/progress"');
    expect(html).toContain('href="/example/quizzes"');
    expect(html).toContain("Platform sidebar"); expect(html).toContain("Related quizzes");
    expect(html).not.toContain("Roblox");
  });
  it("builds each platform's canonical without changing the game slug", () => {
    expect(quizMetadata(quizData().page, ROBLOX_QUIZZES).alternates?.canonical).toBe("https://bloxodes.com/quizzes/sample");
    expect(quizMetadata(quizData().page, otherQuiz).alternates?.canonical).toBe("https://bloxodes.com/example/quizzes/sample");
    expect(checklistMetadata({ page: { id: "1", slug: "gta-5", title: "GTA 5 Checklist", created_at: "2026-09-10", updated_at: "2026-09-10" }, items: [] }, GTA_CHECKLISTS).alternates?.canonical).toBe("https://bloxodes.com/gta/checklists/gta-5");
  });
});
