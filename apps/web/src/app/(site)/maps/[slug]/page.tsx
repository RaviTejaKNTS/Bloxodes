import { notFound } from "next/navigation";
import { resolvePageTypeGameRoute } from "@/lib/page-type-game-route";
export const revalidate = 3600;
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
 const route = await resolvePageTypeGameRoute(`/maps/${(await params).slug}`);
 if (!route) notFound();
 return route.metadata();
}
export default async function Page({ params }: Props) {
 const route = await resolvePageTypeGameRoute(`/maps/${(await params).slug}`);
 if (!route) notFound();
 return route.render();
}
