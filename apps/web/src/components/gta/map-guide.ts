import { MAP_GUIDE_ID } from "./map-guide-id";

export { MAP_GUIDE_ID };

export function scrollToMapGuide() {
  window.dispatchEvent(new Event("bloxodes:map-guide"));
  const guide = document.getElementById(MAP_GUIDE_ID);
  if (!guide) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  guide.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  guide.focus({ preventScroll: true });
}

