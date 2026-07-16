import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CLIENT_CARD_PATHS = [
  new URL("../../components/ChecklistCard.tsx", import.meta.url),
  new URL("../../components/QuizCard.tsx", import.meta.url)
];

const SERVER_PAGE_DATA_PATHS = [
  new URL("../../app/(site)/checklists/page-data.tsx", import.meta.url),
  new URL("../../app/(site)/quizzes/page-data.tsx", import.meta.url)
];

describe("hydration-safe updated labels", () => {
  it.each(CLIENT_CARD_PATHS)("%s consumes a serialized label without reading the clock", (path) => {
    const source = readFileSync(path, "utf8");

    expect(source).toContain("updatedLabel: string | null");
    expect(source).not.toContain("formatDistanceToNow");
    expect(source).not.toContain("new Date(updatedAt)");
  });

  it.each(SERVER_PAGE_DATA_PATHS)("%s serializes the updated label before the client boundary", (path) => {
    const source = readFileSync(path, "utf8");

    expect(source).toContain("updatedLabel: formatUpdatedLabel(updatedAt)");
  });
});
