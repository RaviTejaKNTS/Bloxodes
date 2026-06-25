import { SiteGameTopBarClient } from "@/components/SiteGameTopBarClient";
import { getSidebarAccount } from "@/lib/site-sidebar-account";

export async function SiteGameTopBar() {
  const account = await getSidebarAccount();
  return <SiteGameTopBarClient account={account} />;
}
