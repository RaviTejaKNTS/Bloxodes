import type { ReactNode } from "react";
import { SiteGameTopBar } from "@/components/SiteGameTopBar";

export default function SiteTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteGameTopBar />
      <div className="site-container py-6 md:py-8 xl:py-10">{children}</div>
    </>
  );
}
