import { isMinecraftToolSlug } from "./manifest";

export function getMinecraftToolCover(slug: string): string | null {
  return isMinecraftToolSlug(slug) ? `/images/tools/minecraft/${slug}.webp` : null;
}
