"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isNavLinkActive } from "@/lib/site-navigation";

type SidebarActiveStateProps = {
  navId: string;
};

export function SidebarActiveState({ navId }: SidebarActiveStateProps) {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const nav = document.getElementById(navId);
    if (!nav) return;

    nav.querySelectorAll<HTMLAnchorElement>("[data-site-nav-link]").forEach((link) => {
      const href = link.dataset.href ?? link.getAttribute("href") ?? "/";
      const active = isNavLinkActive(pathname, href);
      link.dataset.active = active ? "true" : "false";
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }, [navId, pathname]);

  return null;
}
