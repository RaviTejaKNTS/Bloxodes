import { SiteGameTopBarClient } from "@/components/SiteGameTopBarClient";
import { signedOutSidebarAccount } from "@/lib/site-navigation";

export function SiteGameTopBar() {
  return <SiteGameTopBarClient account={signedOutSidebarAccount} />;
}
