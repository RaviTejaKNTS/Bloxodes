// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Gta5InteractiveMap } from "./Gta5InteractiveMap";
import { GtaInteractiveMap } from "./GtaInteractiveMap";
import { MapViewport } from "@/components/maps/MapViewport";
import type { Gta5MapMarker } from "@/lib/gta-map-types";
import type { GtaMapPageData } from "@/lib/gta-interactive-map-types";
import registry from "@/data/gta-maps/registry.json";

// GitHub uses React's production build, so use flushSync rather than act.
async function settle(run: () => unknown) {
  let pending: unknown;
  flushSync(() => { pending = run(); });
  await pending;
  await new Promise(resolve => setTimeout(resolve, 0));
}

const fake = vi.hoisted(() => ({
  pinClicks: [] as Array<() => void>, pinElements: [] as HTMLButtonElement[],
  checked: new Set<string>(), toggle: vi.fn(), coarse: false,
  maps: [] as Array<{
    dragging: { enable: ReturnType<typeof vi.fn>; disable: ReturnType<typeof vi.fn> };
    scrollWheelZoom: { enable: ReturnType<typeof vi.fn>; disable: ReturnType<typeof vi.fn> };
    touchZoom: { enable: ReturnType<typeof vi.fn> };
    invalidateSize: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }>,
  frames: [] as FrameRequestCallback[]
}));
vi.mock("@/components/SiteLogo", () => ({ SiteLogo: () => <span>Logo</span> }));
vi.mock("@/lib/collection-checklist-progress-client", () => ({ useCollectionChecklistProgress: () => ({ checked: fake.checked, toggle: fake.toggle }) }));
vi.mock("leaflet.markercluster", () => ({}));
vi.mock("leaflet", () => {
  function layer() {
    const pinElement = document.createElement("button");
    const result = { addTo: vi.fn(), remove: vi.fn(), bringToBack: vi.fn(), once: vi.fn(), addLayer: vi.fn(), addLayers: vi.fn(), clearLayers: vi.fn(), setIcon: vi.fn(), on: vi.fn(), getElement: () => pinElement };
    result.addTo.mockReturnValue(result);
    result.once.mockReturnValue(result);
    result.on.mockImplementation((event: string, callback: () => void) => {
      if (event === "click") { fake.pinClicks.push(callback); fake.pinElements.push(pinElement); }
      return result;
    });
    return result;
  }
  return { default: {
    CRS: { Simple: {} }, divIcon: vi.fn(), marker: layer, tileLayer: layer, imageOverlay: layer, markerClusterGroup: layer,
    latLngBounds: () => ({ pad: () => ({}) }),
    map: (container: HTMLElement) => {
      let wheelEnabled = false;
      const wheel = (event: Event) => event.preventDefault();
      const map = {
        getContainer: () => container, getZoom: () => 3, flyTo: vi.fn(), fitBounds: vi.fn(), invalidateSize: vi.fn(),
        remove: vi.fn(() => container.removeEventListener("wheel", wheel)), setMaxBounds: vi.fn(),
        dragging: { enable: vi.fn(), disable: vi.fn() },
        scrollWheelZoom: {
          enable: vi.fn(() => { if (!wheelEnabled) container.addEventListener("wheel", wheel); wheelEnabled = true; }),
          disable: vi.fn(() => { container.removeEventListener("wheel", wheel); wheelEnabled = false; })
        },
        touchZoom: { enable: vi.fn() },
        attributionControl: { setPrefix: vi.fn(), addAttribution: vi.fn(), removeAttribution: vi.fn() }
      };
      fake.maps.push(map);
      return map;
    }
  } };
});

const first: Gta5MapMarker = { id: "first", number: 1, name: "First location", layer: "spaceship-parts", area: "Desert", description: "Find it here.", facts: [], image: null, x: 100, y: 100, guideUrl: null, collectionCode: null };
const second = { ...first, id: "second", number: 2, name: "Second location" };
const config = registry[0] as GtaMapPageData["config"];
const shared: GtaMapPageData = {
  config, guides: [], hubPath: "/gta/wiki/gta-san-andreas", hubTitle: "San Andreas",
  layers: [{ ...config.layers[0], collectionCode: null, guideUrl: null, collectionAvailable: false, defaultEnabled: true }],
  markers: [first, second].map(marker => ({ ...marker, layer: config.layers[0].slug, layerLabel: config.layers[0].label, color: "#fff", group: "Places", view: config.views[0].slug, title: marker.name, sourceId: marker.id, sourceTitle: "Map", sourceUrl: "https://example.com/map", category: "Places", collectionNumber: null, collectionName: null, referenceOnly: true, mode: null, edition: null, variant: null, sourceImage: null, checkId: null, note: null }))
};
let root: Root;
let container: HTMLDivElement;
let modal: WeakSet<HTMLDialogElement>;
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  fake.coarse = false;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({
    matches: query === "(any-pointer: coarse)" && fake.coarse, addEventListener: vi.fn(), removeEventListener: vi.fn()
  }) });
  modal = new WeakSet();
  vi.spyOn(HTMLDialogElement.prototype, "matches").mockImplementation(function(this: HTMLDialogElement, selector) { return selector === ":modal" && modal.has(this); });
  Object.defineProperties(HTMLDialogElement.prototype, {
    show: { configurable: true, value() { this.open = true; } },
    showModal: { configurable: true, value() { this.open = true; modal.add(this); } },
    close: { configurable: true, value() { this.open = false; modal.delete(this); } }
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { fake.frames.push(callback); return fake.frames.length; });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
  window.history.replaceState(null, "", "/gta/maps/example?point=first&test=houseads#guide");
  fake.pinClicks.length = 0;
  fake.pinElements.length = 0;
  fake.maps.length = 0;
  fake.frames.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { vi.useRealTimers(); await settle(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe.each([
  { name: "GTA 5", element: <Gta5InteractiveMap markers={[first, second]} /> },
  { name: "registered GTA maps", element: <GtaInteractiveMap map={shared} /> }
])("$name interactions", ({ element }) => {
  it("loads a deep link, selects a different pin without history writes, and shares that pin", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const push = vi.spyOn(window.history, "pushState");
    await settle(() => { root.render(element); });
    await settle(() => undefined);
    expect(container.querySelector(".gta-map-detail h2")?.textContent).toBe("First location");
    expect(fake.pinClicks).toHaveLength(2);
    await settle(() => fake.pinClicks[1]());
    expect(container.querySelector(".gta-map-detail h2")?.textContent).toBe("Second location");
    expect(window.location.search).toBe("?point=first&test=houseads");
    const share = container.querySelector<HTMLButtonElement>(".gta-map-share")!;
    await settle(() => share.click());
    const copied = new URL(vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]);
    expect(copied.searchParams.get("point")).toBe("second");
    expect(copied.searchParams.get("test")).toBe("houseads");
    expect(copied.hash).toBe("#guide");
    await settle(() => container.querySelector<HTMLButtonElement>('[aria-label="Close location details"]')!.click());
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("uses the first Escape only to collapse and restore toolbar focus, then clears the pin on the second", async () => {
    await settle(() => root.render(<MapViewport>{element}</MapViewport>));
    await settle(() => undefined);
    const canvas = container.querySelector<HTMLElement>(".gta-map-canvas")!;
    canvas.append(...fake.pinElements);
    await settle(() => fake.pinClicks[1]());
    const toggle = container.querySelector<HTMLButtonElement>(".map-viewport-toolbar button")!;
    const dialog = container.querySelector("dialog")!;
    await settle(() => toggle.click());
    fake.pinElements[1].focus();
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    await settle(() => fake.pinElements[1].dispatchEvent(escape));
    await settle(() => { fake.frames.splice(0).forEach(frame => frame(0)); });
    expect(escape.defaultPrevented).toBe(true);
    expect(modal.has(dialog)).toBe(false);
    expect(dialog.open).toBe(true);
    expect(toggle.textContent).toBe("Full screen");
    expect(document.activeElement).toBe(toggle);
    expect(container.querySelector(".gta-map-detail h2")?.textContent).toBe("Second location");
    await settle(() => toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await settle(() => { fake.frames.splice(0).forEach(frame => frame(0)); });
    expect(container.querySelector(".gta-map-detail")).toBeNull();
  });

  it.each([false, true])("toggles Leaflet handlers on expand and collapse (coarse pointer: %s)", async coarse => {
    fake.coarse = coarse;
    await settle(() => root.render(<MapViewport>{element}</MapViewport>));
    await settle(() => undefined);
    const map = fake.maps[0];
    const canvas = container.querySelector<HTMLElement>(".gta-map-canvas")!;
    const toggle = container.querySelector<HTMLButtonElement>(".map-viewport-toolbar button")!;
    expect(map.dragging[coarse ? "disable" : "enable"]).toHaveBeenCalled();
    expect(canvas.style.touchAction).toBe(coarse ? "pan-y" : "");
    expect(map.scrollWheelZoom.disable).toHaveBeenCalled();
    expect(map.touchZoom.enable).toHaveBeenCalled();
    await settle(() => toggle.click());
    expect(map.dragging.enable).toHaveBeenCalled();
    expect(map.scrollWheelZoom.enable).toHaveBeenCalled();
    expect(canvas.style.touchAction).toBe("");
    map.dragging.disable.mockClear();
    map.scrollWheelZoom.disable.mockClear();
    await settle(() => toggle.click());
    if (coarse) expect(map.dragging.disable).toHaveBeenCalledOnce();
    else expect(map.dragging.disable).not.toHaveBeenCalled();
    expect(map.scrollWheelZoom.disable).toHaveBeenCalledOnce();
    expect(canvas.style.touchAction).toBe(coarse ? "pan-y" : "");
    expect(map.invalidateSize.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(fake.maps).toHaveLength(1);
    expect(map.remove).not.toHaveBeenCalled();
  });

  it("keeps wheel scrolling native unless Ctrl/Cmd is held or the map is expanded", async () => {
    const listen = vi.spyOn(EventTarget.prototype, "addEventListener");
    await settle(() => root.render(<MapViewport>{element}</MapViewport>));
    // A passive listener could not cancel browser zoom on the first Ctrl/Cmd + wheel.
    expect(listen.mock.calls.some(([type, , options]) => type === "wheel"
      && typeof options === "object" && options.capture === true && options.passive === false)).toBe(true);
    listen.mockRestore();
    await settle(() => undefined);
    const canvas = container.querySelector<HTMLElement>(".gta-map-canvas")!;
    const wheel = (modifiers = {}) => new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true, ...modifiers });
    const ordinary = wheel();
    await settle(() => canvas.dispatchEvent(ordinary));
    expect(ordinary.defaultPrevented).toBe(false);
    expect(container.querySelector(".map-gesture-hint.is-visible")?.textContent).toBe("Use Ctrl + scroll to zoom");
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
      const modified = wheel(modifiers);
      await settle(() => canvas.dispatchEvent(modified));
      expect(modified.defaultPrevented).toBe(true);
      const nextOrdinary = wheel();
      await settle(() => canvas.dispatchEvent(nextOrdinary));
      expect(nextOrdinary.defaultPrevented).toBe(false);
    }
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    await settle(() => canvas.dispatchEvent(wheel()));
    expect(container.querySelector(".map-gesture-hint.is-visible")?.textContent).toBe("Use ⌘ + scroll to zoom");
    await settle(() => container.querySelector<HTMLButtonElement>(".map-viewport-toolbar button")!.click());
    const expandedWheel = wheel();
    await settle(() => canvas.dispatchEvent(expandedWheel));
    expect(expandedWheel.defaultPrevented).toBe(true);
    expect(container.querySelector(".map-gesture-hint.is-visible")).toBeNull();
  });

  it("shows a fading touch hint for a one-finger drag but leaves taps and two fingers alone", async () => {
    fake.coarse = true;
    await settle(() => root.render(<MapViewport>{element}</MapViewport>));
    await settle(() => undefined);
    const canvas = container.querySelector<HTMLElement>(".gta-map-canvas")!;
    const touch = (type: string, points: Array<{ clientX: number; clientY: number }>) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", { value: points });
      return event;
    };
    vi.useFakeTimers();
    flushSync(() => canvas.dispatchEvent(touch("touchstart", [{ clientX: 10, clientY: 10 }])));
    expect(container.querySelector(".map-gesture-hint.is-visible")).toBeNull();
    const move = touch("touchmove", [{ clientX: 10, clientY: 50 }]);
    flushSync(() => canvas.dispatchEvent(move));
    expect(move.defaultPrevented).toBe(false);
    expect(container.querySelector(".map-gesture-hint.is-visible")?.textContent).toBe("Use two fingers to move the map");
    flushSync(() => vi.advanceTimersByTime(1800));
    expect(container.querySelector(".map-gesture-hint.is-visible")).toBeNull();
    vi.useRealTimers();
    await settle(() => canvas.dispatchEvent(touch("touchstart", [{ clientX: 10, clientY: 10 }, { clientX: 30, clientY: 30 }])));
    const pinch = touch("touchmove", [{ clientX: 10, clientY: 30 }, { clientX: 30, clientY: 50 }]);
    await settle(() => canvas.dispatchEvent(pinch));
    expect(pinch.defaultPrevented).toBe(false);
    expect(container.querySelector(".map-gesture-hint.is-visible")).toBeNull();
    await settle(() => fake.pinClicks[1]());
    expect(container.querySelector(".gta-map-detail h2")?.textContent).toBe("Second location");
    await settle(() => container.querySelector<HTMLButtonElement>(".map-viewport-toolbar button")!.click());
    await settle(() => canvas.dispatchEvent(touch("touchstart", [{ clientX: 10, clientY: 10 }])));
    await settle(() => canvas.dispatchEvent(move));
    expect(container.querySelector(".map-gesture-hint.is-visible")).toBeNull();
  });

  it("keeps mouse dragging available on devices that also have a touchscreen", async () => {
    fake.coarse = true;
    await settle(() => root.render(<MapViewport>{element}</MapViewport>));
    await settle(() => undefined);
    const map = fake.maps[0];
    const canvas = container.querySelector<HTMLElement>(".gta-map-canvas")!;
    const pointer = (pointerType: string) => {
      const event = new Event("pointerdown", { bubbles: true });
      Object.defineProperty(event, "pointerType", { value: pointerType });
      return event;
    };
    map.dragging.enable.mockClear();
    await settle(() => canvas.dispatchEvent(pointer("mouse")));
    expect(map.dragging.enable).toHaveBeenCalledOnce();
    map.dragging.disable.mockClear();
    await settle(() => canvas.dispatchEvent(pointer("touch")));
    expect(map.dragging.disable).toHaveBeenCalledOnce();
  });
});
