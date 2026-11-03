import "server-only";
import { getGameToolBySlug, listPublishedGameTools } from "../game-registry";
import { validateMinecraftToolRules } from "./validate";
import { getMinecraftToolCover } from "./covers";
const normalizeSlug = (value: string) => value.trim().toLowerCase();
export type MinecraftToolPage = import("@/lib/tools").ToolContent & {
  id: string;
  slug: string;
  tool_key: string;
  canonical_path: string;
  rules_json: Record<string, unknown>;
  description_md?: string | null;
};

export async function getMinecraftTool(slug: string): Promise<MinecraftToolPage | null> {
  const normalized = normalizeSlug(slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return null;
  return (async () => {
    const data = await getGameToolBySlug("minecraft", normalized);
    if (data) {
      if (data.tool_key !== normalized) throw new Error("Minecraft tool ownership does not match its route.");
      validateMinecraftToolRules(data.tool_key, data.rules_json);
    }
    return data ? { ...data, thumb_url: getMinecraftToolCover(normalized) ?? data.thumb_url } as MinecraftToolPage : null;
  })();
}

export async function listMinecraftTools(): Promise<MinecraftToolPage[]> {
  return (async () => {
    const data = await listPublishedGameTools("minecraft");
    return (data ?? []).map(tool => ({ ...tool, thumb_url: getMinecraftToolCover(tool.slug) ?? tool.thumb_url })) as MinecraftToolPage[];
  })();
}

