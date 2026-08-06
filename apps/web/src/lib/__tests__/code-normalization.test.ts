import { describe, expect, it } from "vitest";
import { stripTrailingCopyButtonText } from "../code-normalization";

describe("code normalization", () => {
  it("removes copy-button labels with or without separating whitespace", () => {
    expect(stripTrailingCopyButtonText("PROUDFROGCopy")).toBe("PROUDFROG");
    expect(stripTrailingCopyButtonText("500 Credits Copy")).toBe("500 Credits");
    expect(stripTrailingCopyButtonText("500 Credits Copied")).toBe("500 Credits");
  });

  it("returns null when the entire value is copy-button text", () => {
    expect(stripTrailingCopyButtonText("Copy")).toBeNull();
    expect(stripTrailingCopyButtonText("COPY")).toBeNull();
  });
});
