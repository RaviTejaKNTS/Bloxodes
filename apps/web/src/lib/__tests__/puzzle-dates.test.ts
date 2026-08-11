import { describe, expect, it } from "vitest";
import { formatPuzzleDate, partitionPuzzleAnswersByDate, shiftPuzzleDate } from "../puzzle-dates";

describe("puzzle date handling", () => {
  it("uses the New York puzzle calendar across the UTC date boundary", () => {
    expect(formatPuzzleDate(new Date("2026-08-12T02:00:00Z"))).toBe("2026-08-11");
    expect(formatPuzzleDate(new Date("2026-08-12T05:00:00Z"))).toBe("2026-08-12");
  });

  it("shifts ISO puzzle dates without local timezone drift", () => {
    expect(shiftPuzzleDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("does not label a stale latest row as today's answer", () => {
    const answers = [
      { id: "latest", answer_date: "2026-05-27" },
      { id: "older", answer_date: "2026-05-26" }
    ];
    const result = partitionPuzzleAnswersByDate(answers, "2026-08-11");

    expect(result.today).toBeNull();
    expect(result.yesterday).toBeNull();
    expect(result.archive).toEqual(answers);
  });

  it("selects exact today and yesterday rows independent of array position", () => {
    const today = { id: "today", answer_date: "2026-08-11" };
    const yesterday = { id: "yesterday", answer_date: "2026-08-10" };
    const archive = { id: "archive", answer_date: "2026-08-09" };
    const result = partitionPuzzleAnswersByDate([archive, today, yesterday], "2026-08-11");

    expect(result).toEqual({ today, yesterday, archive: [archive] });
  });
});
