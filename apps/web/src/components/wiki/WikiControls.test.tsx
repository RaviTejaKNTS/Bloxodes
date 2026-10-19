import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { WikiControls } from "./WikiControls";

describe("shared wiki controls", () => {
  it("uses the same device columns and missing-cell behavior for every game", () => {
    const $ = load(renderToStaticMarkup(<WikiControls heading="Game Controls" value={[{ action: "Move", keyboard: "WASD", controller: "Left stick" }, { action: "Chat", desktop: "Enter" }]} />));
    expect($("h2").text()).toBe("Game Controls");
    expect($("thead th").map((_, cell) => $(cell).text()).get()).toEqual(["Action", "Desktop", "Console"]);
    expect($("tbody tr")).toHaveLength(2);
    expect($("tbody").text()).toContain("Left stick");
    expect($("tbody").text()).toContain("No control shown");
  });
  it("omits the whole section when the game has no verified controls", () => {
    expect(renderToStaticMarkup(<WikiControls heading="Game Controls" value={[]} />)).toBe("");
  });
});
