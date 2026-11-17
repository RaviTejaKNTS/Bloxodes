import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const base = z.object({
  contract: z.literal("article-links@1"),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  finalJson: z.literal("final.json"),
  beforeJson: z.literal("before.json"),
  beforeSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const articleLinkRepairBundleSchema = z.discriminatedUnion("articleKind", [
  base.extend({ articleKind: z.literal("roblox") }).strict(),
  base.extend({ articleKind: z.literal("game"), namespace: slug.refine(value => value !== "roblox"),
    game: z.object({ slug, kind: z.enum(["game", "franchise"]) }).strict() }).strict(),
]);
export type ArticleLinkRepairBundle = z.infer<typeof articleLinkRepairBundleSchema>;
