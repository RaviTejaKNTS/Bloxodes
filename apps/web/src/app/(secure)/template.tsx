import { ReactNode } from "react";
import { SiteShell } from "@/components/SiteShell";

export default function SecureTemplate({ children }: { children: ReactNode }) {
  return (
    <SiteShell>
      <div className="container py-6 md:py-8 xl:py-10">{children}</div>
    </SiteShell>
  );
}
