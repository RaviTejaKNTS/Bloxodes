import { describe, expect, it } from "vitest";
import { classifyUmamiContentType } from "../umami";

describe("classifyUmamiContentType", () => {
  it.each([
    ["/", "home"],
    ["/articles", "article"],
    ["/articles/example", "article"],
    ["/codes/example", "codes"],
    ["/wiki/example/items", "wiki"],
    ["/tools/example", "tool"],
    ["/catalog/example", "catalog"],
    ["/events/example", "event"],
    ["/checklists/example", "checklist"],
    ["/quizzes/example", "quiz"],
    ["/stats/games/example", "stats"],
    ["/about", "other"]
  ])("classifies %s as %s", (pathname, expected) => {
    expect(classifyUmamiContentType(pathname)).toBe(expected);
  });
});
