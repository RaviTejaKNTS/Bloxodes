import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function css(name: string) {
  return readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Split a selector list on top-level commas, keeping `:is(a, b)` whole. */
function selectorList(text: string) {
  const selectors = [""];
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) selectors.push("");
    else selectors[selectors.length - 1] += char;
  }
  return selectors.map(selector => selector.trim());
}

/** Every style rule's selector list, including rules nested in @media. */
function rules(source: string) {
  return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g), match => ({ selectors: selectorList(match[1].trim()), body: match[2] }))
    .filter(rule => !rule.selectors[0].startsWith("@"));
}

describe("map styles stay inside the map", () => {
  // These files load on every map page, next to the guide copy. A bare element or page selector here would restyle it.
  it.each(["gta5-map.css", "gta-interactive-map.css"])("%s only targets map classes", name => {
    const leaks = rules(css(name)).flatMap(rule => rule.selectors).filter(selector => !/^\.(gta-map|gta-interactive-map)/.test(selector));
    expect(leaks).toEqual([]);
  });
});

describe("shared reference copy spacing", () => {
  it("pulls split copy blocks together only in grid streams, never in block prose streams", () => {
    const pulls = rules(css("ads-content.css")).filter(rule => rule.selectors.some(selector => selector.includes(".ads-content-plain-copy + .ads-content-plain-copy")));
    expect(pulls).toHaveLength(1);
    expect(pulls[0].body).toMatch(/margin-top:\s*-1\.5rem/);
    // A prose stream is display: block with no gap, so a negative margin draws each block over the last.
    for (const selector of pulls[0].selectors) {
      expect(selector).toContain(":not(.journey-content-stream--prose)");
      expect(selector).toContain(":not(.journey-content-stream--interactive)");
    }
  });
});
