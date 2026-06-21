import { permanentRedirect } from "next/navigation";

export default function RetiredListsRedirectPage() {
  permanentRedirect("/stats");
}
