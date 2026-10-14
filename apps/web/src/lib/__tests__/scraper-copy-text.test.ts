import { describe, expect, it } from "vitest";
import { parseBeebomHtml } from "../beebom";
import { parseRobloxdenHtml } from "../robloxden";
import { mergeScrapeResults } from "../scraper";

const beebomPage = (content: string) =>
  `<main class="beebom-single-content entry-content highlight">${content}</main>`;

const adoptMe = beebomPage(`
  <h2>All New Adopt Me Codes</h2>
  <ul class="wp-block-list is-style-copy-code-list">
    <li><strong>PROUDFROGCopy</strong>: Proud Frog Sticker (<strong><mark class="has-inline-color has-gradient-red-color">NEW</mark></strong>) <button type="button" class="copy-code-list__copy-button" data-copy-text="PROUDFROGCopy" data-default-label="Copy" data-copied-label="Copied" aria-label="Copy PROUDFROGCopy to clipboard">Copy</button></li>
  </ul>
`);

function robloxdenRow(code: string, expired = false, status = "Check") {
  return `<tr class=" filter-tags__target " data-expired="${expired}" data-search="game-codes" data-search-terms="[&quot;${code}&quot;]">
    <td class="table__td table__td--35 table__td--mobile-100"><div class="copy-button__container copy-button__container--dashed copy-button" role="button" tabindex="0" aria-label="Copy code ${code}" data-copy="${code}" data-code-status="check"><span class="content-editable" contenteditable="true" spellcheck="false">${code}</span><span class="copy-button__icon"><i class="fas fa-copy"></i></span></div></td>
    <td class="table__td table__td--35 table__td--mobile-100 search-term">This code credits your account with <strong>200 Spins</strong>.</td>
    <td class="table__td table__td--10 table__td--center table__td--mobile-auto"><span class="badge badge--large badge--uppercase ${expired ? "badge--inactive" : status === "Check" ? "badge--check" : "badge--active"}">${status}</span></td>
  </tr>`;
}

const robloxdenPage = (...rows: string[]) => `<table><tbody>${rows.join("")}</tbody></table>`;

describe("source HTML through shared code intake", () => {
  it("cleans Beebom's pasted data-copy-text code and retains its reward", () => {
    const parsed = parseBeebomHtml(adoptMe);
    expect(parsed.codes).toEqual([{
      code: "PROUDFROG", status: "active", provider: "beebom",
      rewardsText: "Proud Frog Sticker", isNew: true,
    }]);
    expect(mergeScrapeResults([parsed]).codes[0]).toMatchObject({
      code: "PROUDFROG", status: "active", rewardsText: "Proud Frog Sticker",
    });
  });

  it("cleans RobloxDen's contenteditable code at shared intake", () => {
    const parsed = parseRobloxdenHtml(robloxdenPage(robloxdenRow("!code hakotrapCopy")));
    expect(mergeScrapeResults([parsed]).codes).toEqual([expect.objectContaining({
      code: "!code hakotrap", status: "check", provider: "robloxden",
      rewardsText: "This code gives you 200 Spins.",
    })]);
  });

  it("collapses Anime Vanguards' two expired rows after parsing", () => {
    const parsed = parseRobloxdenHtml(robloxdenPage(
      robloxdenRow("2MLIKESCopy", true, "Expired"),
      robloxdenRow("2MLIKES", true, "Expired"),
    ));
    expect(mergeScrapeResults([parsed])).toEqual({ codes: [], expiredCodes: ["2MLIKES"] });
  });

  it("collapses Build An Attack Army's separated Copy row into Cannon", () => {
    const parsed = parseRobloxdenHtml(robloxdenPage(
      robloxdenRow("Cannon", false, "Active"),
      robloxdenRow("Cannon Copy", false, "Active"),
    ));
    expect(mergeScrapeResults([parsed]).codes.map((entry) => entry.code)).toEqual(["Cannon"]);
  });

  it("cleans a separated lowercase suffix before Beebom removes spaces", () => {
    const parsed = parseBeebomHtml(beebomPage(`
      <h2>Working Codes</h2>
      <table><tr><td><button data-copy-text="Cannon copy">Copy</button>Cannon copy</td><td>Coins</td></tr></table>
      <h2>Expired Codes</h2><ul><li><button data-copy-text="OLDCODECopied">Copy</button>OLDCODECopied</li></ul>
    `));
    expect(mergeScrapeResults([parsed])).toEqual({
      codes: [expect.objectContaining({ code: "Cannon", rewardsText: "Coins" })],
      expiredCodes: ["OLDCODE"],
    });
  });

  it("also cleans RobloxDen's data-copy fallback", () => {
    const parsed = parseRobloxdenHtml(`<table><tr data-search="game-codes"><td><div data-copy="Cannon Copy">Copy</div></td></tr></table>`);
    expect(mergeScrapeResults([parsed]).codes[0].code).toBe("Cannon");
  });
});

describe("code merge precedence after copy cleanup", () => {
  it.each([false, true])("keeps Beebom's active code over RobloxDen's expired twin, reversed=%s", (reversed) => {
    const results = [parseBeebomHtml(adoptMe), parseRobloxdenHtml(robloxdenPage(
      robloxdenRow("PROUDFROG", true, "Expired"),
    ))];
    const merged = mergeScrapeResults(reversed ? results.reverse() : results);
    expect(merged).toEqual({
      codes: [expect.objectContaining({ code: "PROUDFROG", status: "active", provider: "beebom", providerPriority: 3 })],
      expiredCodes: [],
    });
  });

  it("cleans raw provider results before keys and retains display/reward priority", () => {
    const result = mergeScrapeResults([
      { codes: [{ code: "!code HAKOTRAPCopy", status: "check", provider: "robloxden", rewardsText: "200 Spins Copy" }], expiredCodes: [] },
      { codes: [{ code: "!code hakotrap", status: "active", provider: "beebom", rewardsText: "300 Spins Copy" }], expiredCodes: [] },
    ]);
    expect(result.codes).toEqual([expect.objectContaining({
      code: "!code hakotrap", status: "active", provider: "beebom", rewardsText: "300 Spins", providerPriority: 3,
    })]);
  });

  it("removes a reward copy label that sits before a (new) marker", () => {
    const result = mergeScrapeResults([
      { codes: [{ code: "SPINS", status: "active", provider: "robloxden", rewardsText: "200 Spins Copy (new)" }], expiredCodes: [] },
    ]);
    expect(result.codes[0].rewardsText).toBe("200 Spins");
  });

  it("retains higher-priority expired reports and real Copy/NEW codes", () => {
    const codes = ["Copy", "copy", "COPY", "xcopy", "NEW", "Visit2MNew", "ENDLESSNEW"];
    for (const code of codes) {
      expect(mergeScrapeResults([{ codes: [{ code, status: "active" }], expiredCodes: [] }]).codes[0].code).toBe(code);
    }
    expect(mergeScrapeResults([
      { codes: [{ code: "Cannon Copy", status: "active", provider: "robloxden" }], expiredCodes: [] },
      { codes: [], expiredCodes: [{ code: "CannonCopied", provider: "beebom" }] },
    ]).expiredCodes).toEqual(["Cannon"]);
  });
});
