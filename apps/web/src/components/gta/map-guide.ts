import { useEffect, type RefObject } from "react";
import { MAP_GUIDE_ID } from "./map-guide-id";

export { MAP_GUIDE_ID };

export function scrollToMapGuide() {
  const guide = document.getElementById(MAP_GUIDE_ID);
  if (!guide) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  guide.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  guide.focus({ preventScroll: true });
}

/**
 * The site shell (game top bar, left nav, mobile header) sits under the map while the map fills
 * the screen, so keep it out of the tab order until the reader scrolls down to the guide.
 */
export function useShellInertUnderMap(mapElement: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const app = mapElement.current?.closest(".gta-map-app");
    const main = app?.closest("main");
    const shellRoot = main?.parentElement?.parentElement;
    const covered = [
      main?.querySelector(":scope > header"),
      shellRoot?.querySelector(":scope > aside"),
      shellRoot?.querySelector(":scope > header")
    ].filter((element): element is HTMLElement => element instanceof HTMLElement);
    if (!app || !covered.length) return;
    const previous = covered.map((element) => element.inert);
    const observer = new IntersectionObserver(([entry]) => {
      const mapCoversScreen = entry.intersectionRatio >= 0.5;
      covered.forEach((element, index) => { element.inert = mapCoversScreen || previous[index]; });
    }, { threshold: [0, 0.5, 1] });
    observer.observe(app);
    return () => {
      observer.disconnect();
      covered.forEach((element, index) => { element.inert = previous[index]; });
    };
  }, [mapElement]);
}
