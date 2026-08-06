import { describe, expect, it } from "vitest";
import {
  isLikelyNonCodeText,
  isLikelyRedemptionInstruction,
  parseBeebomHtml,
} from "../beebom";

function page(content: string): string {
  return `<main class="beebom-single-content entry-content highlight">${content}</main>`;
}

describe("Beebom code parsing", () => {
  it("does not cross from an empty working section into expired or redemption lists", () => {
    const result = parseBeebomHtml(
      page(`
        <h2>All New Pet Simulator 99 Codes</h2>
        <h3>Working Pet Sim 99 Codes</h3>
        <p>There are no working codes.</p>
        <h3>Expired Pet Sim 99 Codes</h3>
        <ul><li>TitanicFireDragon</li></ul>
        <h2>How to Redeem Codes for Pet Simulator 99</h2>
        <ul><li>Go to Shop</li><li>Select Redeem</li><li>Enter Code and Redeem</li></ul>
      `)
    );

    expect(result.codes).toEqual([]);
    expect(result.expiredCodes).toEqual([
      { code: "TitanicFireDragon", provider: "beebom" },
    ]);
  });

  it("recognizes working headings with the game name between the keywords", () => {
    const result = parseBeebomHtml(
      page(`
        <h2>Game Codes (Working)</h2>
        <ul>
          <li><strong>REALCODE</strong> - 500 Coins</li>
          <li>SECOND_CODE</li>
        </ul>
        <h2>Expired Codes</h2>
      `)
    );

    expect(result.codes).toEqual([
      {
        code: "REALCODE",
        status: "active",
        provider: "beebom",
        rewardsText: "500 Coins",
      },
      { code: "SECOND_CODE", status: "active", provider: "beebom" },
    ]);
  });

  it("uses copy-button data without storing the button label in rewards", () => {
    const result = parseBeebomHtml(
      page(`
        <h2>All New Survive Zombie Arena Codes</h2>
        <ul class="wp-block-list is-style-copy-code-list">
          <li>
            <strong>UPDATE0.5</strong>: 5,000 Credits (<strong>NEW</strong>)
            <button class="copy-code-list__copy-button" data-copy-text="UPDATE0.5"
              data-default-label="Copy" data-copied-label="Copied">Copy</button>
          </li>
        </ul>
        <h3>Expired Survive Zombie Arena Codes</h3>
        <ul>
          <li>
            <strong>OLD_CODE</strong>
            <button class="copy-code-list__copy-button" data-copy-text="OLD_CODE">Copy</button>
          </li>
        </ul>
      `)
    );

    expect(result.codes).toEqual([
      {
        code: "UPDATE0.5",
        status: "active",
        provider: "beebom",
        rewardsText: "5,000 Credits",
        isNew: true,
      },
    ]);
    expect(result.expiredCodes).toEqual([
      { code: "OLD_CODE", provider: "beebom" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/\bCopy\b/);
  });

  it("does not treat troubleshooting headings as working code sections", () => {
    const result = parseBeebomHtml(
      page(`
        <h2>All New Anime Card Farm Codes</h2>
        <ul>
          <li><strong>POTIONS</strong>: 1x Cash Potion, 1x Luck Potion, 1x Mutation Potion (<strong>NEW</strong>)</li>
          <li><strong>TRAIT!</strong>: 1x Time II Potion, 100x Trait Gems (<strong>NEW</strong>)</li>
        </ul>
        <h3>Expired Anime Card Farm Codes</h3>
        <p>As of now, there are no expired codes in the game.</p>
        <h2>Why Are My Anime Card Farm Codes Not Working?</h2>
        <p>If the code is not working, check for typos.</p>
      `)
    );

    expect(result.codes).toEqual([
      {
        code: "POTIONS",
        status: "active",
        provider: "beebom",
        rewardsText: "1x Cash Potion, 1x Luck Potion, 1x Mutation Potion",
        isNew: true,
      },
      {
        code: "TRAIT!",
        status: "active",
        provider: "beebom",
        rewardsText: "1x Time II Potion, 100x Trait Gems",
        isNew: true,
      },
    ]);
    expect(result.expiredCodes).toEqual([]);
  });

  it("rejects instruction-like entries inside an otherwise valid code list", () => {
    const result = parseBeebomHtml(
      page(`
        <h2>Working Codes</h2>
        <ul>
          <li>Go to Shop</li>
          <li>SelectRedeem</li>
          <li>Enter Code and Redeem</li>
          <li>VALIDCODE99</li>
        </ul>
      `)
    );

    expect(result.codes.map((entry) => entry.code)).toEqual(["VALIDCODE99"]);
  });

  it("distinguishes redemption procedures from sentence-like real codes", () => {
    expect(isLikelyRedemptionInstruction("Click the Play button on the main menu screen.")).toBe(true);
    expect(isLikelyRedemptionInstruction("ClickontheArrownexttoitandentertheprivateserver.")).toBe(true);
    expect(isLikelyRedemptionInstruction("DoYouBelieveInGravity?")).toBe(false);
    expect(isLikelyRedemptionInstruction("TakeThisYouGreedyKidsThisIsTheFinalCodeYouEverGet")).toBe(false);
  });

  it("rejects no-code status text without rejecting sentence-like real codes", () => {
    expect(isLikelyNonCodeText("There are currently no working codes for Pet Simulator 99.")).toBe(true);
    expect(isLikelyNonCodeText("NoActiveCodes")).toBe(true);
    expect(isLikelyNonCodeText("HereIsAnExtraCode!!")).toBe(false);
  });

  it("ignores unrelated lists when no codes heading owns them", () => {
    const result = parseBeebomHtml(
      page(`
        <h2>About the Game</h2>
        <ul><li>Join the group</li><li>Follow the developer</li></ul>
        <h2>How to Redeem Codes</h2>
        <ol><li>Open Roblox</li><li>Click the Redeem button</li></ol>
      `)
    );

    expect(result.codes).toEqual([]);
  });
});
