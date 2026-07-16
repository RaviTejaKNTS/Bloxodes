import { parseContentDate } from "@/lib/content-dates";

export type StructuredDataIssue = {
  code: string;
  path: string;
  message: string;
};

const ALLOWED_CONTEXTS = new Set(["https://schema.org", "http://schema.org"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function flattenStructuredData(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenStructuredData);
  if (!isRecord(value)) return [];

  const nodes = [value];
  if (Array.isArray(value["@graph"])) nodes.push(...value["@graph"].flatMap(flattenStructuredData));
  return nodes;
}

function typesForNode(node: Record<string, unknown>): string[] {
  const value = node["@type"];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  }
  return [];
}

function validateUrl(
  value: unknown,
  path: string,
  expectedOrigin: string | undefined,
  issues: StructuredDataIssue[]
) {
  if (typeof value !== "string" || !value.trim()) return;
  try {
    const url = new URL(value);
    if (expectedOrigin && url.origin !== expectedOrigin) {
      issues.push({ code: "cross-origin-url", path, message: `${value} does not use ${expectedOrigin}` });
    }
  } catch {
    issues.push({ code: "invalid-url", path, message: `${value} is not an absolute URL` });
  }
}

export function validateStructuredData(
  value: unknown,
  options: { expectedOrigin?: string; requireContext?: boolean } = {}
): StructuredDataIssue[] {
  const issues: StructuredDataIssue[] = [];
  const nodes = flattenStructuredData(value);

  if (!nodes.length) {
    return [{ code: "invalid-root", path: "$", message: "Structured data must be an object or array of objects" }];
  }

  nodes.forEach((node, index) => {
    const path = `$[${index}]`;
    const context = node["@context"];
    if (options.requireContext !== false && index === 0) {
      if (typeof context !== "string" || !ALLOWED_CONTEXTS.has(context.replace(/\/$/, ""))) {
        issues.push({ code: "invalid-context", path: `${path}.@context`, message: "Expected schema.org @context" });
      }
    }

    const isGraphContainer = Array.isArray(node["@graph"]);
    if (!isGraphContainer && !typesForNode(node).length) {
      issues.push({ code: "missing-type", path: `${path}.@type`, message: "Missing @type" });
    }

    for (const key of ["url", "@id"] as const) {
      validateUrl(node[key], `${path}.${key}`, options.expectedOrigin, issues);
    }

    const published = parseContentDate(node.datePublished as string | undefined);
    const modified = parseContentDate(node.dateModified as string | undefined);
    if (node.datePublished && !published) {
      issues.push({ code: "invalid-date-published", path: `${path}.datePublished`, message: "Invalid datePublished" });
    }
    if (node.dateModified && !modified) {
      issues.push({ code: "invalid-date-modified", path: `${path}.dateModified`, message: "Invalid dateModified" });
    }
    if (published && modified && modified.getTime() < published.getTime()) {
      issues.push({
        code: "modified-before-published",
        path: `${path}.dateModified`,
        message: "dateModified is earlier than datePublished"
      });
    }
  });

  return issues;
}

export function structuredDataTypes(value: unknown): string[] {
  return Array.from(new Set(flattenStructuredData(value).flatMap(typesForNode))).sort();
}
