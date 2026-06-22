import { headers } from "next/headers";
import { SiteGameTopBarClient } from "@/components/SiteGameTopBarClient";
import { getGameTopNavContext } from "@/lib/game-top-nav";
import { REQUEST_PATHNAME_HEADER } from "@/lib/request-headers";

export async function SiteGameTopBar() {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get(REQUEST_PATHNAME_HEADER) ?? "/";

  try {
    const gameNav = await getGameTopNavContext(pathname);
    return <SiteGameTopBarClient initialGameNav={gameNav} initialCatalogNav={null} initialPathname={pathname} />;
  } catch (error) {
    console.error("Failed to load site top nav", error);
    return <SiteGameTopBarClient initialGameNav={null} initialCatalogNav={null} initialPathname={pathname} />;
  }
}
