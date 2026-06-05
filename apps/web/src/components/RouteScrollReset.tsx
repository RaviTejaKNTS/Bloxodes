"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function scrollToTopSoon() {
  window.scrollTo(0, 0);
  window.requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  });
  window.setTimeout(() => window.scrollTo(0, 0), 80);
  window.setTimeout(() => window.scrollTo(0, 0), 240);
}

function shouldResetScrollForLink(link: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.hasAttribute("download")) return false;

  const href = link.getAttribute("href");
  if (!href || href.startsWith("#")) return false;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
  if (url.hash) return false;

  return true;
}

export function RouteScrollReset() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (!shouldResetScrollForLink(link, event)) return;

      scrollToTopSoon();
    }

    window.addEventListener("click", handleClick, { capture: true });
    return () => window.removeEventListener("click", handleClick, { capture: true });
  }, []);

  useEffect(() => {
    if (window.location.hash) return;

    let secondFrame = 0;
    let timeout = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      secondFrame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
      timeout = window.setTimeout(() => window.scrollTo(0, 0), 80);
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (timeout) window.clearTimeout(timeout);
    };
  }, [pathname, searchParams]);

  return null;
}
