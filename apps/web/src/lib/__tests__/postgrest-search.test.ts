import { describe, expect, it } from "vitest";
import { quotePostgrestPattern } from "../postgrest-search";

describe("quotePostgrestPattern", () => {
  it.each([
    ["%hello,world%", '"%hello,world%"'],
    ["%game (test).name:one%", '"%game (test).name:one%"'],
    ['%say "hi"%', String.raw`"%say \"hi\"%"`],
    [String.raw`%path\\name%`, String.raw`"%path\\\\name%"`],
    [String.raw`%100\%\_done%`, String.raw`"%100\\%\\_done%"`],
    ["%red%blue%", '"%red%blue%"'],
    ["%1' UNION ALL SELECT (1,2)-- fd4nou%", '"%1\' UNION ALL SELECT (1,2)-- fd4nou%"'],
    ['%x"),name.eq.secret,or(name.ilike."%y%', String.raw`"%x\"),name.eq.secret,or(name.ilike.\"%y%"`]
  ])("quotes %s as one logic-tree value", (pattern, quoted) => {
    expect(quotePostgrestPattern(pattern)).toBe(quoted);
    // PostgREST pQuotedValue consumes each backslash plus the next character.
    expect(quoted.slice(1, -1).replace(/\\([\s\S])/g, "$1")).toBe(pattern);
  });

  it("keeps LIKE escapes after the logic parser removes its escape layer", () => {
    const input = String.raw`100%_"C:\games"`;
    const pattern = `%${input.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    expect(quotePostgrestPattern(pattern)).toBe(String.raw`"%100\\%\\_\"C:\\\\games\"%"`);
  });
});
