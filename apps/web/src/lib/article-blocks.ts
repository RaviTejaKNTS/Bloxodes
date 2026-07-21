import { parse as parseYaml } from "yaml";
import { z } from "zod";

const BLOCK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIER_RANK_PATTERN = /^[A-Za-z0-9+.-]{1,12}$/;
const ARTICLE_BLOCK_LANGUAGES = new Set(["tier-list", "article-checklist"]);

function isSafeArticleHref(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const articleHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(isSafeArticleHref, "Use a site-relative path or an HTTP(S) URL");

const linkedItemFields = {
  name: z.string().trim().min(1).max(80),
  image: z.string().trim().min(1).max(500),
  alt: z.string().trim().min(3).max(180),
  href: articleHrefSchema.optional(),
};

const tierListItemSchema = z.object(linkedItemFields).strict();

const collectionLinkSchema = z
  .object({
    href: articleHrefSchema,
    label: z.string().trim().min(1).max(60).optional(),
  })
  .strict();

const tierSchema = z
  .object({
    rank: z.string().trim().regex(TIER_RANK_PATTERN),
    label: z.string().trim().min(1).max(60).optional(),
    items: z.array(tierListItemSchema).min(1).max(80),
  })
  .strict();

export const tierListBlockSchema = z
  .object({
    schema: z.literal(1),
    id: z.string().trim().regex(BLOCK_ID_PATTERN),
    title: z.string().trim().min(1).max(120),
    scope: z.string().trim().min(1).max(80).optional(),
    collection: collectionLinkSchema.optional(),
    tiers: z.array(tierSchema).min(1).max(12),
  })
  .strict()
  .superRefine((value, context) => {
    const ranks = new Set<string>();
    const itemNames = new Set<string>();

    value.tiers.forEach((tier, tierIndex) => {
      const normalizedRank = tier.rank.toLowerCase();
      if (ranks.has(normalizedRank)) {
        context.addIssue({
          code: "custom",
          path: ["tiers", tierIndex, "rank"],
          message: `Duplicate tier rank: ${tier.rank}`,
        });
      }
      ranks.add(normalizedRank);

      tier.items.forEach((item, itemIndex) => {
        const normalizedName = item.name.toLowerCase();
        if (itemNames.has(normalizedName)) {
          context.addIssue({
            code: "custom",
            path: ["tiers", tierIndex, "items", itemIndex, "name"],
            message: `Duplicate tier-list item: ${item.name}`,
          });
        }
        itemNames.add(normalizedName);
      });
    });
  });

const checklistItemSchema = z
  .object({
    id: z.string().trim().regex(BLOCK_ID_PATTERN),
    label: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(280).optional(),
    href: articleHrefSchema.optional(),
  })
  .strict();

const checklistSectionSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(240).optional(),
    items: z.array(checklistItemSchema).min(1).max(60),
  })
  .strict();

export const articleChecklistBlockSchema = z
  .object({
    schema: z.literal(1),
    id: z.string().trim().regex(BLOCK_ID_PATTERN),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(280).optional(),
    items: z.array(checklistItemSchema).max(80).optional(),
    sections: z.array(checklistSectionSchema).max(16).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const allItems = [
      ...(value.items ?? []),
      ...(value.sections ?? []).flatMap((section) => section.items),
    ];

    if (!allItems.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Add at least one checklist item",
      });
      return;
    }

    const ids = new Set<string>();
    allItems.forEach((item) => {
      if (ids.has(item.id)) {
        context.addIssue({
          code: "custom",
          path: ["items"],
          message: `Duplicate checklist item id: ${item.id}`,
        });
      }
      ids.add(item.id);
    });
  });

export type TierListBlockData = z.infer<typeof tierListBlockSchema>;
export type TierListItem = z.infer<typeof tierListItemSchema>;
export type ArticleChecklistBlockData = z.infer<typeof articleChecklistBlockSchema>;
export type ArticleChecklistItem = z.infer<typeof checklistItemSchema>;

export type ArticleContentBlock =
  | { kind: "markdown"; markdown: string }
  | { kind: "tier-list"; data: TierListBlockData }
  | { kind: "article-checklist"; data: ArticleChecklistBlockData }
  | { kind: "invalid"; language: string; message: string };

export type ArticleBlockImageRef = {
  blockId: string;
  itemName: string;
  alt: string;
  src: string;
};

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

function parseStructuredBlock(language: string, source: string): ArticleContentBlock {
  try {
    const raw = parseYaml(source);
    if (language === "tier-list") {
      const parsed = tierListBlockSchema.safeParse(raw);
      return parsed.success
        ? { kind: "tier-list", data: parsed.data }
        : { kind: "invalid", language, message: formatZodError(parsed.error) };
    }

    const parsed = articleChecklistBlockSchema.safeParse(raw);
    return parsed.success
      ? { kind: "article-checklist", data: parsed.data }
      : { kind: "invalid", language, message: formatZodError(parsed.error) };
  } catch (error) {
    return {
      kind: "invalid",
      language,
      message: error instanceof Error ? error.message : "Invalid YAML",
    };
  }
}

function openingFence(line: string): { marker: string; language: string } | null {
  const match = line.match(/^[ \t]{0,3}(`{3,}|~{3,})([a-z-]+)[ \t]*$/i);
  if (!match) return null;
  const language = match[2].toLowerCase();
  if (!ARTICLE_BLOCK_LANGUAGES.has(language)) return null;
  return { marker: match[1], language };
}

function anyOpeningFence(line: string): { marker: string; language: string } | null {
  const match = line.match(/^[ \t]{0,3}(`{3,}|~{3,})([a-z0-9-]*)[^`~]*$/i);
  if (!match) return null;
  return { marker: match[1], language: (match[2] ?? "").toLowerCase() };
}

function isClosingFence(line: string, marker: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= marker.length && trimmed.split("").every((character) => character === marker[0]);
}

export function parseArticleContentBlocks(markdown: string): ArticleContentBlock[] {
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const blocks: ArticleContentBlock[] = [];
  let markdownStart = 0;
  let index = 0;

  const pushMarkdown = (start: number, end: number) => {
    const value = lines.slice(start, end).join("\n").trim();
    if (value) blocks.push({ kind: "markdown", markdown: value });
  };

  while (index < lines.length) {
    const anyOpening = anyOpeningFence(lines[index] ?? "");
    if (!anyOpening) {
      index += 1;
      continue;
    }

    let closingIndex = index + 1;
    while (closingIndex < lines.length && !isClosingFence(lines[closingIndex] ?? "", anyOpening.marker)) {
      closingIndex += 1;
    }

    if (closingIndex >= lines.length) {
      index += 1;
      continue;
    }

    const opening = openingFence(lines[index] ?? "");
    if (!opening) {
      index = closingIndex + 1;
      continue;
    }

    pushMarkdown(markdownStart, index);
    blocks.push(parseStructuredBlock(opening.language, lines.slice(index + 1, closingIndex).join("\n")));
    index = closingIndex + 1;
    markdownStart = index;
  }

  pushMarkdown(markdownStart, lines.length);
  return blocks;
}

export function extractArticleBlockImageRefs(markdown: string): ArticleBlockImageRef[] {
  return parseArticleContentBlocks(markdown).flatMap((block) => {
    if (block.kind !== "tier-list") return [];
    return block.data.tiers.flatMap((tier) =>
      tier.items.map((item) => ({
        blockId: block.data.id,
        itemName: item.name,
        alt: item.alt,
        src: item.image,
      }))
    );
  });
}

export function articleBlockErrors(markdown: string): string[] {
  return parseArticleContentBlocks(markdown)
    .filter((block): block is Extract<ArticleContentBlock, { kind: "invalid" }> => block.kind === "invalid")
    .map((block) => `${block.language}: ${block.message}`);
}

export function stripArticleContentBlocks(markdown: string): string {
  return parseArticleContentBlocks(markdown)
    .filter((block): block is Extract<ArticleContentBlock, { kind: "markdown" }> => block.kind === "markdown")
    .map((block) => block.markdown)
    .join("\n\n");
}

function normalizeHeadingText(value: string): string {
  return value
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tierDetailSection(markdown: string, rank: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const expected = normalizeHeadingText(`${rank} Tier`);
  let start = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(/^##[ \t]+(.+?)[ \t]*#*[ \t]*$/);
    if (match && normalizeHeadingText(match[1]) === expected) {
      start = index + 1;
      break;
    }
  }

  if (start < 0) return null;
  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    if (/^##[ \t]+/.test(lines[index] ?? "")) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function leadingMarkdownTable(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let start = 0;
  while (start < lines.length && !(lines[start] ?? "").trim()) start += 1;

  const header = lines[start] ?? "";
  const separator = lines[start + 1] ?? "";
  if (!header.includes("|") || !/^\s*\|?\s*:?-{3,}/.test(separator) || !separator.includes("|")) {
    return null;
  }

  let end = start + 2;
  while (end < lines.length && (lines[end] ?? "").includes("|")) end += 1;
  return lines.slice(start, end).join("\n");
}

/** Enforce the overview → one detailed table per tier article contract. */
export function validateTierListArticleDetails(markdown: string): string[] {
  const tierLists = parseArticleContentBlocks(markdown).filter(
    (block): block is Extract<ArticleContentBlock, { kind: "tier-list" }> => block.kind === "tier-list"
  );
  if (!tierLists.length) return [];
  if (tierLists.length > 1) return ["Use one tier-list overview block per article"];

  const errors: string[] = [];
  for (const tier of tierLists[0].data.tiers) {
    const section = tierDetailSection(markdown, tier.rank);
    if (section === null) {
      errors.push(`Missing ## ${tier.rank} Tier detail section`);
      continue;
    }
    const table = leadingMarkdownTable(section);
    if (table === null) {
      errors.push(`## ${tier.rank} Tier must begin with a Markdown detail table`);
      continue;
    }
    const tableLower = table.toLowerCase();
    for (const item of tier.items) {
      if (!tableLower.includes(item.name.toLowerCase())) {
        errors.push(`## ${tier.rank} Tier detail table is missing item name ${item.name}`);
      }
      if (!table.includes(item.image)) {
        errors.push(`## ${tier.rank} Tier detail table is missing image ${item.image} for ${item.name}`);
      }
    }
  }
  return errors;
}
