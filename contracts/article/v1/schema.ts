import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const file = z.string().min(1).refine(value => !value.startsWith("/") && !value.includes("\\") && value.split("/").every(part => part !== ".." && part !== "." && part !== ""), "Use a relative path inside the bundle");
export const bundleSchema = z.object({
  contract: z.literal("article@1"), slug, finalJson: file, mediaJson: file, queueId: z.string().uuid(),
}).strict();
export const articleFinalSchema = z.object({
  slug, title: z.string().trim().min(1), content_md: z.string().min(1),
  meta_description: z.string().nullable().optional(), cover_image: z.string().nullable().optional(),
  author_id: z.string().uuid().nullable().optional(), universe_id: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string()).optional(), sources: z.array(z.string().url()).optional(),
  faq_json: z.array(z.object({ q: z.string().trim().min(1), a: z.string().trim().min(1) }).strict()).nullable().optional(),
  is_published: z.literal(true).optional(),
}).strict();
export type ArticleBundle = z.infer<typeof bundleSchema>;
export type ArticleFinal = z.infer<typeof articleFinalSchema>;
export const bundleJsonSchema = z.toJSONSchema(bundleSchema);
