import type { ReactNode } from "react";
import { SiteGameTopBar } from "@/components/SiteGameTopBar";

export default function SiteTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteGameTopBar />
      <div className="container py-6 md:py-8 xl:py-10 min-[1200px]:max-xl:max-w-[1042px]">{children}</div>
    </>
  );
}
