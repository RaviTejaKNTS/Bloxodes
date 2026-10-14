import { describe, expect, it } from "vitest";
import { cleanExpiredCodeList, stripPastedCopySuffix, stripTrailingCopyButtonText } from "../code-normalization";

describe("code normalization", () => {
  it("removes copy-button labels with or without separating whitespace", () => {
    expect(stripTrailingCopyButtonText("PROUDFROGCopy")).toBe("PROUDFROG");
    expect(stripTrailingCopyButtonText("500 Credits Copy")).toBe("500 Credits");
    expect(stripTrailingCopyButtonText("500 Credits Copied")).toBe("500 Credits");
  });

  it("removes stacked copy-button labels", () => {
    expect(stripTrailingCopyButtonText("Coins Copy Copy")).toBe("Coins");
    expect(stripTrailingCopyButtonText("Coins Copied Copy")).toBe("Coins");
  });

  it("returns null when the entire value is copy-button text", () => {
    expect(stripTrailingCopyButtonText("Copy")).toBeNull();
    expect(stripTrailingCopyButtonText("COPY")).toBeNull();
  });
});

describe("pasted copy suffixes in code names", () => {
  it.each([
    ["PROUDFROGCopy", "PROUDFROG"],
    ["!code hakotrapCopy", "!code hakotrap"],
    ["2MLIKESCopy", "2MLIKES"],
    ["Cannon Copy", "Cannon"],
    ["Cannon cOpY", "Cannon"],
    ["Cannon\tCOPIED", "Cannon"],
    ["CODECopied", "CODE"],
    ["  CODECopy  ", "CODE"],
    ["CODECopy Copy", "CODE"],
    ["Copy Copy", "Copy"],
  ])("cleans %s to %s", (input, expected) => {
    expect(stripPastedCopySuffix(input)).toBe(expected);
    expect(stripPastedCopySuffix(expected)).toBe(expected);
  });

  it.each(["Copy", "copy", "COPY", "Copied", "COPIED", "xcopy", "xcopied", "xCOPY", "NEW", "Visit2MNew", "ENDLESSNEW"])(
    "preserves the real code %s", (code) => {
      expect(stripPastedCopySuffix(code)).toBe(code);
    }
  );

  it("returns null only for missing or empty input", () => {
    expect(stripPastedCopySuffix(null)).toBeNull();
    expect(stripPastedCopySuffix(undefined)).toBeNull();
    expect(stripPastedCopySuffix("  ")).toBeNull();
  });
});

describe("stored expired code lists", () => {
  it("cleans before deduplication and retains the first spelling and position", () => {
    expect(cleanExpiredCodeList([
      "2MLIKESCopy", "OTHER", "2MLIKES", "Cannon Copy", "cannon", "Copy", "NEW", "Visit2MNew",
    ])).toEqual({
      codes: ["2MLIKES", "OTHER", "Cannon", "Copy", "NEW", "Visit2MNew"],
      removed: 2,
      renamed: 2,
    });
  });

  it.each(["Copy", "copy", "COPY"])("retains standalone %s", (code) => {
    expect(cleanExpiredCodeList([code])).toEqual({ codes: [code], removed: 0, renamed: 0 });
  });

  it("removes whitespace variants and blanks without changing first-occurrence order", () => {
    expect(cleanExpiredCodeList(["!code hakotrapCopy", "!codehakotrap", " ", "xcopy"])).toEqual({
      codes: ["!code hakotrap", "xcopy"], removed: 2, renamed: 1,
    });
  });
});
