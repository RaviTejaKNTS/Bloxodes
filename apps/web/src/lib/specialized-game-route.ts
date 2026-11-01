import "server-only";
export async function specializedMinecraftToolRoute(namespace: string, slug: string) {
  if (namespace !== "minecraft") return null;
  const adapter = await import("@/components/games/specialized/minecraft/MinecraftTool");
  const props = { params: Promise.resolve({ tool: slug }) };
  return { render: () => adapter.default(props), metadata: () => adapter.generateMetadata(props) };
}

export async function specializedGtaMapRoute(namespace: string, slug: string) {
  if (namespace !== "gta") return null;
  if (slug === "gta5") {
    const adapter = await import("@/components/games/specialized/Gta5Map");
    return { render: () => adapter.default(), metadata: () => adapter.generateMetadata() };
  }
  const adapter = await import("@/components/games/specialized/GtaMap");
  const props = { params: Promise.resolve({ slug }) };
  return { render: () => adapter.default(props), metadata: () => adapter.generateMetadata(props) };
}
