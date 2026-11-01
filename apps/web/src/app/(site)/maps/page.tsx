import { OtherGamesSection } from "@/components/games/OtherGamesSection";
import { buildAlternates, SITE_URL } from "@/lib/seo";
export const revalidate = 3600;
export const metadata = { title: "Maps", alternates: buildAlternates(`${SITE_URL}/maps`) };
export default function MapsPage() { return <div className="space-y-8"><h1 className="text-4xl font-semibold">Maps</h1><OtherGamesSection kind="map" /></div>; }
