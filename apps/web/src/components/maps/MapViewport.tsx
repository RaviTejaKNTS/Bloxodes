"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize, Minimize } from "lucide-react";
import "@/styles/ads-maps.css";

const MapViewportExpanded = createContext(false);

export function useMapViewportExpanded() {
  return useContext(MapViewportExpanded);
}

/** Keep the map mounted when expanding it so pins, filters and progress survive. */
export function MapViewport({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);

  function collapse() {
    const element = dialog.current;
    if (element?.matches(":modal")) {
      element.close();
      element.show();
    }
    setExpanded(false);
    button.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const element = dialog.current;
    if (!element || !expanded) return;
    element.close();
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Consume Escape before Leaflet or an engine's window handler clears a pin
    // or schedules pin focus. The next Escape in the embedded view stays normal.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !element.matches(":modal")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      collapse();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  useEffect(() => {
    const element = dialog.current;
    const showGuide = () => {
      if (element?.matches(":modal")) {
        element.close();
        element.show();
        setExpanded(false);
      }
    };
    window.addEventListener("bloxodes:map-guide", showGuide);
    return () => window.removeEventListener("bloxodes:map-guide", showGuide);
  }, []);

  return (
    <div className="map-viewport-space">
      <dialog ref={dialog} open className="map-viewport" aria-label="Interactive map view"
        onCancel={event => { event.preventDefault(); collapse(); }}>
        <div className="map-viewport-toolbar">
          <button ref={button} type="button" aria-expanded={expanded}
            onClick={() => expanded ? collapse() : setExpanded(true)}>
            {expanded ? <Minimize size={16} aria-hidden /> : <Maximize size={16} aria-hidden />}
            {expanded ? "Exit full screen" : "Full screen"}
          </button>
        </div>
        <MapViewportExpanded.Provider value={expanded}>
          <div className="map-viewport-content">{children}</div>
        </MapViewportExpanded.Provider>
      </dialog>
    </div>
  );
}
