import { permanentRedirect } from "next/navigation";
import { minecraftLegacyRedirect } from "@/lib/minecraft-paths";
export default async function LegacyCollection({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  permanentRedirect(minecraftLegacyRedirect(`/minecraft/wiki/${collection}`, "")!);
}
