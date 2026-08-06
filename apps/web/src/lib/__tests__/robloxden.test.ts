import { describe, expect, it } from "vitest";
import { parseRobloxdenHtml } from "../robloxden";

describe("RobloxDen code parsing", () => {
  it("parses current table rows without treating copy controls as code text", () => {
    const result = parseRobloxdenHtml(`
      <table>
        <tbody>
          <tr class="filter-tags__target table__tr--new" data-expired="false"
            data-search="game-codes" data-search-terms='["BEWARETHETUNDRA"]'>
            <td>
              <span class="codes-list__new-badge">New Code</span>
              <div class="copy-button" data-copy="BEWARETHETUNDRA">
                <span contenteditable="true">BEWARETHETUNDRA</span>
              </div>
            </td>
            <td class="search-term">This code credits your account with <strong>1 Artifact Crate Spin</strong>.</td>
            <td><span class="badge badge--active">Active</span></td>
          </tr>
          <tr class="filter-tags__target" data-expired="true"
            data-search="game-codes" data-search-terms='["OLD_CODE"]'>
            <td><div class="copy-button" data-copy="OLD_CODE">Copy</div></td>
            <td class="search-term">Expired reward</td>
            <td><span class="badge badge--expired">Expired</span></td>
          </tr>
        </tbody>
      </table>
    `);

    expect(result).toEqual({
      codes: [
        {
          code: "BEWARETHETUNDRA",
          status: "active",
          rewardsText: "This code gives you 1 Artifact Crate Spin.",
          levelRequirement: null,
          isNew: true,
          provider: "robloxden",
        },
      ],
      expiredCodes: [{ code: "OLD_CODE", provider: "robloxden" }],
    });
  });
});
