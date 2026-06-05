import { ReactNode } from "react";
import { SiteShell } from "@/components/SiteShell";

export default function SecureTemplate({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
