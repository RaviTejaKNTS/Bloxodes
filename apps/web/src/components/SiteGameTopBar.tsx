import { headers } from "next/headers";
import { SiteGameTopBarClient } from "@/components/SiteGameTopBarClient";
import { getCatalogTopNavContext } from "@/lib/catalog-top-nav";
import { getGameTopNavContext } from "@/lib/game-top-nav";
import { REQUEST_PATHNAME_HEADER } from "@/lib/request-headers";

export async function SiteGameTopBar() {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get(REQUEST_PATHNAME_HEADER) ?? "";
  const [gameNav, catalogNav] = await Promise.all([getGameTopNavContext(pathname), getCatalogTopNavContext(pathname)]);
  return <SiteGameTopBarClient initialGameNav={gameNav} initialCatalogNav={catalogNav} initialPathname={pathname} />;
}
