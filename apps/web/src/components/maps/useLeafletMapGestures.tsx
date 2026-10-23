"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useMapViewportExpanded } from "./MapViewport";

type GestureHint = { message: string; visible: boolean };

/** Let embedded maps share touch and wheel gestures with the surrounding page. */
export function useLeafletMapGestures(mapRef: RefObject<LeafletMap | null>, ready: boolean) {
  const expanded = useMapViewportExpanded();
  const [hint, setHint] = useState<GestureHint>({ message: "", visible: false });

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const container = map.getContainer();
    const coarse = window.matchMedia("(any-pointer: coarse)");
    const previousTouchAction = container.style.touchAction ?? "";
    let hintTimeout: number | undefined;
    let touchStart: { x: number; y: number } | null = null;
    const hideHint = () => {
      window.clearTimeout(hintTimeout);
      setHint(current => ({ ...current, visible: false }));
    };
    const showHint = (message: string) => {
      window.clearTimeout(hintTimeout);
      setHint({ message, visible: true });
      hintTimeout = window.setTimeout(() => setHint(current => ({ ...current, visible: false })), 1800);
    };
    const updateHandlers = () => {
      const pageTouch = coarse.matches && !expanded;
      if (pageTouch) map.dragging.disable();
      else map.dragging.enable();
      // Leaflet's two-finger handler pans as well as zooms. Leave it enabled
      // while one-finger dragging is disabled, and override its touch-action.
      map.touchZoom.enable();
      container.style.touchAction = pageTouch ? "pan-y" : previousTouchAction;
      if (expanded) map.scrollWheelZoom.enable();
      else map.scrollWheelZoom.disable();
      hideHint();
      map.invalidateSize();
    };
    const onTouchStart = (event: TouchEvent) => {
      touchStart = event.touches.length === 1
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
      if (event.touches.length > 1) hideHint();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (expanded || !coarse.matches) return;
      // A laptop can have both a mouse and a touchscreen. Keep mouse dragging
      // available, then turn it off before Leaflet receives the next touch.
      if (event.pointerType === "mouse") map.dragging.enable();
      else map.dragging.disable();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (expanded || !coarse.matches || event.touches.length !== 1 || !touchStart) return;
      const touch = event.touches[0];
      if (Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > 8) {
        showHint("Use two fingers to move the map");
        touchStart = null;
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (expanded) return;
      if (event.ctrlKey || event.metaKey) {
        // Leaflet's own listener may attach too late to cancel this event, so
        // stop browser page zoom here.
        event.preventDefault();
        map.scrollWheelZoom.enable();
        hideHint();
      } else {
        map.scrollWheelZoom.disable();
        // Stop map listeners, but preserve the browser's page-scroll default.
        event.stopImmediatePropagation();
        showHint(/Mac|iPhone|iPad/.test(navigator.platform)
          ? "Use ⌘ + scroll to zoom" : "Use Ctrl + scroll to zoom");
      }
    };
    updateHandlers();
    coarse.addEventListener("change", updateHandlers);
    container.addEventListener("pointerdown", onPointerDown, true);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    // Capture runs before Leaflet's bubble listener, including when it was
    // enabled by the preceding Ctrl/Cmd + wheel event. Not passive, so a
    // modified wheel can cancel browser zoom; ordinary scrolls keep the default.
    container.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      window.clearTimeout(hintTimeout);
      coarse.removeEventListener("change", updateHandlers);
      container.removeEventListener("pointerdown", onPointerDown, true);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("wheel", onWheel, true);
      container.style.touchAction = previousTouchAction;
    };
  }, [expanded, mapRef, ready]);

  return hint;
}

export function MapGestureHint({ hint }: { hint: GestureHint }) {
  return <div className={"map-gesture-hint" + (hint.visible ? " is-visible" : "")} role="status" aria-live="polite" aria-hidden={!hint.visible}>{hint.message}</div>;
}
