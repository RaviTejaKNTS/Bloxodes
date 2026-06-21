import { permanentRedirect } from "next/navigation";

export const dynamic = "force-static";

export default function RetiredListsRedirectPage() {
  permanentRedirect("/stats");
}
