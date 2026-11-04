import { z } from "zod";
import { bundleSchema as articleBundle, articleFinalSchema } from "../../article/v1/schema";
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const bundleSchema = articleBundle.omit({contract:true,queueId:true}).extend({
  contract:z.literal("game-article@1"), namespace:slug.refine(value=>value!=="roblox"),
  game:z.object({slug,kind:z.enum(["game","franchise"])}).strict(),
}).strict();
export const gameArticleFinalSchema = articleFinalSchema.omit({universe_id:true,sources:true}).extend({
  seo_title:z.string().trim().min(1).nullable().optional(),
  cover_image:z.string().url().startsWith("https://"), author_id:z.string().uuid(),
  sources_json:z.array(z.object({title:z.string().trim().min(1),url:z.string().url().startsWith("https://")}).strict()).default([]),
}).strict();
export type GameArticleFinal = z.infer<typeof gameArticleFinalSchema>;
export const bundleJsonSchema = z.toJSONSchema(bundleSchema);
