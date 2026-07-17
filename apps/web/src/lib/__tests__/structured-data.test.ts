import { describe, expect, it } from "vitest";
import { structuredDataTypes, validateStructuredData } from "@/lib/structured-data";

describe("structured data contracts", () => {
  it("accepts a valid canonical Article graph", () => {
    const value = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          "@id": "https://bloxodes.com/articles/example",
          url: "https://bloxodes.com/articles/example",
          datePublished: "2026-01-01T00:00:00Z",
          dateModified: "2026-02-01T00:00:00Z"
        }
      ]
    };
    expect(validateStructuredData(value, { expectedOrigin: "https://bloxodes.com" })).toEqual([]);
    expect(structuredDataTypes(value)).toEqual(["Article"]);
  });

  it("reports invalid context, type, URLs and dates", () => {
    const issues = validateStructuredData(
      {
        "@context": "https://example.com",
        url: "/relative",
        datePublished: "invalid"
      },
      { expectedOrigin: "https://bloxodes.com" }
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["invalid-context", "missing-type", "invalid-url", "invalid-date-published"])
    );
  });

  it("reports cross-origin URLs and reversed dates", () => {
    const issues = validateStructuredData(
      {
        "@context": "https://schema.org",
        "@type": "Article",
        url: "https://staging.bloxodes.com/articles/example",
        datePublished: "2026-02-01T00:00:00Z",
        dateModified: "2026-01-01T00:00:00Z"
      },
      { expectedOrigin: "https://bloxodes.com" }
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["cross-origin-url", "modified-before-published"])
    );
  });
});
