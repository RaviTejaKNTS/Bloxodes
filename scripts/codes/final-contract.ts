import { z } from "zod";

const text = z.string().trim().min(1);
const source = (host: string, prefix: string) => z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname === host && url.pathname.startsWith(prefix);
}).nullable();
export const codePageFinalSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(value => !/-codes$/.test(value) && !/-\d{5,}$/.test(value), "Use an editorial game slug, without -codes or a universe ID"),
  name: text,
  universe_id: z.number().int().positive().safe(),
  roblox_link: z.string().url().refine(value => /^https:\/\/(?:www\.)?roblox\.com\/games\/\d+(?:\/|$)/.test(value)),
  source_url: source("robloxden.com", "/game-codes/"),
  source_url_2: source("beebom.com", "/"),
  intro_md: text,
  redeem_md: text,
  troubleshoot_md: text,
  rewards_md: text,
  find_codes_md: text,
  meta_description: text.min(150).max(160),
  game_display_name: text,
  interlinking_copy_md: z.string()
}).strict().refine(value => value.source_url || value.source_url_2, "At least one codes source is required");
export type CodePageFinal = z.infer<typeof codePageFinalSchema>;
