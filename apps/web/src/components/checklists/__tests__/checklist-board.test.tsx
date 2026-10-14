// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChecklistBoard } from "@/components/ChecklistBoard";
import type { ChecklistViewItem } from "@/lib/engagement/types";

function item(section_code: string, title: string, description: string | null = null): ChecklistViewItem {
  return { id: `id-${section_code}`, section_code, title, description, is_required: true };
}

const items: ChecklistViewItem[] = [
  item("1", "- Getting started", "Start here."),
  item("1.1", "First steps"),
  ...Array.from({ length: 13 }, (_, index) => item(`1.1.${index + 1}`, `- Task ${index + 1}`)),
  item("2", "Endgame"),
  item("2.0.1", "Beat the boss", "Final fight.")
];

describe("ChecklistBoard", () => {
  it("renders a flat stream of headings, notes and balanced row groups", () => {
    const html = renderToStaticMarkup(
      createElement("section", { id: "article-body" }, createElement(ChecklistBoard, { slug: "sample", items }))
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const body = container.querySelector("#article-body")!;
    const kinds = [...body.children].map((el) => el.className);
    expect(kinds).toEqual([
      "checklists-section-head",
      "checklists-note",
      "checklists-subhead",
      "checklists-group",
      "checklists-group",
      "checklists-section-head",
      "checklists-group"
    ]);
    const groups = [...body.querySelectorAll(":scope > ul.checklists-group")].map((ul) => ul.children.length);
    expect(groups).toEqual([6, 7, 1]);
    expect(body.querySelector("h2")?.textContent).toBe("1. - Getting started");
    expect(body.querySelector("h3")?.textContent).toBe("1.1 First steps");
    expect(body.querySelector(".checklists-row-title")?.textContent).toBe("- Task 1");
    expect(body.querySelectorAll("input[type=checkbox]:checked")).toHaveLength(0);
    expect(body.querySelector(".checklists-count")?.textContent).toBe("0/13 done");
    // Every checkbox has a clickable label.
    for (const input of body.querySelectorAll("input[type=checkbox]")) {
      expect(body.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
  });

  it("uses smaller groups when tasks carry long notes", () => {
    const note = "x".repeat(250);
    const noted = Array.from({ length: 10 }, (_, index) => item(`1.0.${index + 1}`, `Task ${index + 1}`, note));
    const html = renderToStaticMarkup(createElement(ChecklistBoard, { slug: "notes", items: [item("1", "Notes"), ...noted] }));
    const container = document.createElement("div");
    container.innerHTML = html;
    const groups = [...container.querySelectorAll(":scope > ul.checklists-group")].map((ul) => ul.children.length);
    expect(groups).toEqual([3, 4, 3]);
  });
});
