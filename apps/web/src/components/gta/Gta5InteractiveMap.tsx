"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { SiteLogo } from "@/components/SiteLogo";
import { ArrowLeft, ArrowUpRight, Check, Crosshair, Info, Layers3, Link2, Map as MapIcon, Minus, Plus, Search, X } from "lucide-react";
import type * as Leaflet from "leaflet";
import { useCollectionChecklistProgress } from "@/lib/collection-checklist-progress-client";
import { GTA5_MAP_LAYERS, type Gta5MapLayerSlug, type Gta5MapMarker } from "@/lib/gta-map-types";

const PROGRESS_BASE = {
  endpoint: "/api/gta/collections/progress",
  requestKey: "code",
  storageKeyPrefix: "gta-collection:",
  eventName: "gta-collection-progress",
  analyticsPrefix: "gta_collection"
} as const;
const MAP_BOUNDS: Leaflet.LatLngBoundsExpression = [[-640, 360], [-295, 660]];
const MAP_LIMITS: Leaflet.LatLngBoundsExpression = [[-672, 328], [-240, 728]];
const TILE_BOUNDS: Record<"roadmap" | "satellite", Leaflet.LatLngBoundsExpression> = {
  roadmap: [[-639.99, 328.01], [-248.01, 727.99]],
  satellite: [[-671.99, 376.01], [-248.01, 671.99]]
};
const TILE_ATTRIBUTION = '<a href="https://github.com/rolux/gtadb.org" target="_blank" rel="noreferrer">GTADB tiles & places</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>';

function gameToMap(point: Pick<Gta5MapMarker, "x" | "y">): Leaflet.LatLngExpression {
  return [(point.y - 16384) / 32, (point.x + 16384) / 32];
}
function pointSearchText(marker: Gta5MapMarker): string {
  return `${marker.name} ${marker.number || ""} ${marker.area} ${marker.description} ${marker.facts.map((fact) => fact.value).join(" ")}`
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function PointDetails({ marker, checked, toggle, clear, share, copyStatus }: {
  marker: Gta5MapMarker;
  checked: boolean;
  toggle: () => void;
  clear: () => void;
  share: () => void;
  copyStatus: string;
}) {
  const layer = GTA5_MAP_LAYERS.find((entry) => entry.slug === marker.layer)!;
  const isPlace = !marker.collectionCode;
  return <>
    <div className="gta-map-detail__top">
      <span className="gta-map-eyebrow"><span className="gta-map-swatch" style={{ background: layer.color }} />{layer.label}{isPlace ? "" : ` · ${marker.number} of ${layer.count}`}</span>
      <button type="button" onClick={clear} aria-label="Close location details" className="gta-map-icon-button"><X size={19} /></button>
    </div>
    {marker.image ? <div className="gta-map-detail__image"><img src={marker.image} alt={`${marker.name} location in GTA 5`} loading="eager" /></div> : null}
    <div className="gta-map-detail__body">
      <h2>{marker.name}</h2>
      {marker.area && marker.area !== marker.name ? <p className="gta-map-detail__area">{marker.area}</p> : null}
      {marker.description && !marker.description.toLowerCase().startsWith(marker.area.toLowerCase()) ? <p className="gta-map-detail__summary">{marker.description}</p> : null}
      {marker.facts.length ? <dl className="gta-map-detail__facts">{marker.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}
      {marker.layer === "hidden-packages" && marker.number >= 12 ? <p className="gta-map-detail__note">Four cases share the Altruist Camp area. The pin marks the camp, so check around its southern cabins for each case.</p> : null}
      {marker.layer === "hidden-packages" && marker.number === 5 ? <p className="gta-map-detail__note">This case is at the offshore plane wreck east of Terminal. Follow the guide imagery for the dive.</p> : null}
      <div className="gta-map-detail__actions">
        {!isPlace ? <button type="button" className={`gta-map-complete ${checked ? "is-checked" : ""}`} onClick={toggle} aria-pressed={checked}><Check size={16} />{checked ? "Completed" : "Mark complete"}</button> : null}
        {marker.guideUrl ? <Link className="gta-map-guide-link" href={marker.guideUrl}>Open guide <ArrowUpRight size={16} /></Link> : null}
        {marker.walkthroughUrl ? <a className="gta-map-guide-link" href={marker.walkthroughUrl} target="_blank" rel="noopener noreferrer">Video walkthrough <ArrowUpRight size={16} /></a> : null}
      </div>
      <button type="button" onClick={share} className="gta-map-share"><Link2 size={15} />{copyStatus || "Copy link to this location"}</button>
      {isPlace ? <p className="gta-map-detail__source">Place name and position from GTADB contributors (CC BY 4.0).</p> : null}
    </div>
  </>;
}

export function Gta5InteractiveMap({ markers, children }: { markers: Gta5MapMarker[]; children: ReactNode }) {
  const parts = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-spaceship-parts" });
  const letters = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-letter-scraps" });
  const jumps = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-stunt-jumps" });
  const bridges = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-under-the-bridge" });
  const flights = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-knife-flights" });
  const nuclear = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-nuclear-waste" });
  const submarine = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-submarine-pieces" });
  const mosaics = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-monkey-mosaics" });
  const peyote = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-peyote-plants" });
  const epsilon = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-epsilon-tracts" });
  const packages = useCollectionChecklistProgress({ ...PROGRESS_BASE, code: "gta-5-hidden-packages" });
  const progress: Record<string, ReturnType<typeof useCollectionChecklistProgress>> = {
    "spaceship-parts": parts, "letter-scraps": letters, "stunt-jumps": jumps,
    "under-the-bridge": bridges, "knife-flights": flights, "nuclear-waste": nuclear,
    "submarine-pieces": submarine, "monkey-mosaics": mosaics, "peyote-plants": peyote,
    "epsilon-tracts": epsilon, "hidden-packages": packages
  };
  const [query, setQuery] = useState("");
  const [activeLayers, setActiveLayers] = useState<Set<Gta5MapLayerSlug>>(
    new Set(GTA5_MAP_LAYERS.filter((layer) => layer.group !== "Places").map((layer) => layer.slug))
  );
  const [onlyRemaining, setOnlyRemaining] = useState(false);
  const [style, setStyle] = useState<"roadmap" | "satellite">("roadmap");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const tilesRef = useRef<Leaflet.TileLayer | null>(null);
  const clusterRef = useRef<Leaflet.MarkerClusterGroup | null>(null);
  const pinRefs = useRef<Map<string, Leaflet.Marker>>(new Map());
  const selected = markers.find((marker) => marker.id === selectedId) ?? null;
  const collectionMarkers = markers.filter((marker) => marker.collectionCode);
  const isChecked = useCallback((marker: Gta5MapMarker) => Boolean(progress[marker.layer]?.checked.has(marker.id)), [
    parts.checked, letters.checked, jumps.checked, bridges.checked, flights.checked,
    nuclear.checked, submarine.checked, mosaics.checked, peyote.checked, epsilon.checked, packages.checked
  ]);
  const completedCount = collectionMarkers.filter(isChecked).length;
  const filtered = useMemo(() => {
    const terms = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
    return markers.filter((marker) => activeLayers.has(marker.layer)
      && (!onlyRemaining || !marker.collectionCode || !isChecked(marker))
      && (!terms.length || terms.every((term) => {
        if (/^\d+$/.test(term) && marker.number) return String(marker.number) === term;
        return pointSearchText(marker).split(" ").some((word) => /^\d+$/.test(term) ? word === term : word.startsWith(term));
      })));
  }, [markers, activeLayers, onlyRemaining, query, isChecked]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const map = mapElement.current;
    const main = map?.closest("main");
    const shell = main?.parentElement;
    const shellRoot = shell?.parentElement;
    const hiddenShell = [
      main?.querySelector(":scope > header"),
      shell?.querySelector(":scope > footer"),
      shellRoot?.querySelector(":scope > aside"),
      shellRoot?.querySelector(":scope > header")
    ].filter((element): element is HTMLElement => element instanceof HTMLElement);
    const previousInert = hiddenShell.map((element) => element.inert);
    hiddenShell.forEach((element) => { element.inert = true; });
    return () => {
      document.body.style.overflow = previous;
      hiddenShell.forEach((element, index) => { element.inert = previousInert[index]; });
    };
  }, []);
  useEffect(() => {
    if (!mapReady || query.trim().length < 2 || !filtered.length) return;
    const timeout = window.setTimeout(() => {
      const map = mapRef.current;
      const L = leafletRef.current;
      if (!map || !L) return;
      if (filtered.length === 1) map.flyTo(gameToMap(filtered[0]), Math.max(map.getZoom(), 4), { duration: 0.35 });
      else map.fitBounds(L.latLngBounds(filtered.map(gameToMap)), { padding: [50, 50], maxZoom: 5 });
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [query, filtered, mapReady]);
  const selectPoint = useCallback((id: string | null, writeUrl = true) => {
    setSelectedId(id);
    setInfoOpen(false);
    setCopyStatus("");
    if (id && window.matchMedia("(max-width: 800px)").matches) setListOpen(false);
    if (writeUrl) {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("point", id);
      else url.searchParams.delete("point");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const marker = markers.find((item) => item.id === id);
    if (marker && mapRef.current) mapRef.current.flyTo(gameToMap(marker), Math.max(mapRef.current.getZoom(), 4), { duration: 0.45 });
  }, [markers]);
  useEffect(() => {
    const fromUrl = () => {
      const id = new URLSearchParams(window.location.search).get("point");
      if (id && markers.some((marker) => marker.id === id)) selectPoint(id, false);
      else setSelectedId(null);
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
  }, [markers, selectPoint]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { selectPoint(null); setInfoOpen(false); setListOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectPoint]);
  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    let cancelled = false;
    void import("leaflet").then(async (leafletModule) => {
      await import("leaflet.markercluster");
      if (cancelled || !mapElement.current) return;
      const L = leafletModule.default;
      leafletRef.current = L;
      const map = L.map(mapElement.current, {
        crs: L.CRS.Simple, minZoom: 0, maxZoom: 7, zoomSnap: 0.25, zoomControl: false,
        attributionControl: true, maxBounds: MAP_LIMITS, maxBoundsViscosity: 1, preferCanvas: true
      });
      mapRef.current = map;
      tilesRef.current = L.tileLayer("/gta/maps/gta5/roadmap/{z}/{z},{y},{x}.jpg", {
        tileSize: 256, minZoom: 0, maxNativeZoom: 5, maxZoom: 7, noWrap: true,
        bounds: TILE_BOUNDS.roadmap, attribution: TILE_ATTRIBUTION
      }).addTo(map);
      map.fitBounds(MAP_BOUNDS, { padding: [18, 18] });
      const clusters = L.markerClusterGroup({
        maxClusterRadius: 48, disableClusteringAtZoom: 5, showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => L.divIcon({
          className: "gta-map-cluster-wrap", html: `<span class="gta-map-cluster">${cluster.getChildCount()}</span>`,
          iconSize: [40, 40], iconAnchor: [20, 20]
        })
      });
      clusterRef.current = clusters;
      for (const marker of markers) {
        const layer = GTA5_MAP_LAYERS.find((item) => item.slug === marker.layer)!;
        const icon = L.divIcon({
          className: "gta-map-pin-wrap",
          html: `<span class="gta-map-pin" style="--pin-color:${layer.color}">${marker.number || "•"}</span>`,
          iconSize: [30, 30], iconAnchor: [15, 15]
        });
        const pin = L.marker(gameToMap(marker), { icon, title: `${marker.name} — ${marker.area}`, keyboard: true, riseOnHover: true });
        pin.on("click", () => selectPoint(marker.id));
        clusters.addLayer(pin);
        pinRefs.current.set(marker.id, pin);
      }
      clusters.addTo(map);
      const initialId = new URLSearchParams(window.location.search).get("point");
      const initial = markers.find((marker) => marker.id === initialId);
      if (initial) map.flyTo(gameToMap(initial), 4, { duration: 0 });
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 100);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tilesRef.current = null;
      clusterRef.current = null;
      pinRefs.current.clear();
    };
  }, [markers, selectPoint]);
  useEffect(() => {
    if (!mapReady) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    tilesRef.current?.remove();
    tilesRef.current = L.tileLayer(`/gta/maps/gta5/${style}/{z}/{z},{y},{x}.jpg`, {
      tileSize: 256, minZoom: 0, maxNativeZoom: 5, maxZoom: 7, noWrap: true,
      bounds: TILE_BOUNDS[style], attribution: TILE_ATTRIBUTION
    }).addTo(map);
    tilesRef.current.bringToBack();
  }, [style, mapReady]);
  useEffect(() => {
    if (!mapReady) return;
    const L = leafletRef.current;
    const clusters = clusterRef.current;
    if (!L || !clusters) return;
    const visibleIds = new Set(filtered.map((marker) => marker.id));
    clusters.clearLayers();
    const visiblePins: Leaflet.Marker[] = [];
    for (const marker of markers) {
      const pin = pinRefs.current.get(marker.id);
      if (!pin) continue;
      const layer = GTA5_MAP_LAYERS.find((entry) => entry.slug === marker.layer)!;
      const checked = isChecked(marker);
      pin.setIcon(L.divIcon({
        className: "gta-map-pin-wrap",
        html: `<span class="gta-map-pin${checked ? " is-complete" : ""}${selectedId === marker.id ? " is-selected" : ""}" style="--pin-color:${layer.color}">${checked ? "✓" : marker.number || "•"}</span>`,
        iconSize: [30, 30], iconAnchor: [15, 15]
      }));
      if (visibleIds.has(marker.id)) visiblePins.push(pin);
    }
    clusters.addLayers(visiblePins);
  }, [filtered, markers, selectedId, isChecked, mapReady]);
  const toggleLayer = (slug: Gta5MapLayerSlug) => setActiveLayers((previous) => {
    const next = new Set(previous);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    return next;
  });
  const sharePoint = async () => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set("point", selected.id);
    try { await navigator.clipboard.writeText(url.toString()); setCopyStatus("Link copied"); }
    catch { setCopyStatus("Copy from address bar"); }
  };
  return <section className="gta-map-app" aria-label="GTA 5 interactive map">
    <div ref={mapElement} className="gta-map-canvas" role="application" aria-label="Zoomable GTA 5 map with selectable location pins" />
    <header className="gta-map-topbar">
      <Link href="/gta/wiki/gta-5" className="gta-map-back" aria-label="Back to GTA 5 wiki"><ArrowLeft size={17} /></Link>
      <div className="gta-map-title"><SiteLogo className="h-6" /><span className="gta-map-title__separator" aria-hidden="true">.</span><h1>GTA 5 Story Mode interactive map</h1></div>
      <div className="gta-map-topbar__actions">
        <button type="button" onClick={() => { setInfoOpen(false); setListOpen(!listOpen); }} aria-label="Toggle map layers and locations" aria-expanded={listOpen}><Layers3 size={17} /><span>Layers</span></button>
        <button type="button" onClick={() => { setListOpen(false); setInfoOpen(!infoOpen); }} aria-label="About this map" aria-expanded={infoOpen}><Info size={17} /><span>About</span></button>
      </div>
    </header>
    <aside className={`gta-map-sidebar ${listOpen ? "is-open" : ""}`} aria-label="Map layers and locations">
      <div className="gta-map-sidebar__header"><div><strong>Explore the map</strong><span>{completedCount} of {collectionMarkers.length} completed</span></div><button type="button" onClick={() => setListOpen(false)} aria-label="Close layers"><X size={18} /></button></div>
      <label className="gta-map-sidebar__search"><Search size={17} aria-hidden /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search locations, places, clues…" aria-label="Search map locations" /></label>
      <div className="gta-map-sidebar__scroll">
        {(["Collectibles", "Challenges", "Places"] as const).map((group) => <div className="gta-map-layer-group" key={group}>
          <h2>{group}</h2>
          {GTA5_MAP_LAYERS.filter((layer) => layer.group === group).map((layer) => {
            const done = markers.filter((marker) => marker.layer === layer.slug && isChecked(marker)).length;
            return <button key={layer.slug} type="button" aria-pressed={activeLayers.has(layer.slug)} onClick={() => toggleLayer(layer.slug)} className={`gta-map-layer ${activeLayers.has(layer.slug) ? "is-active" : ""}`} style={{ "--layer-color": layer.color } as CSSProperties}>
              <span className="gta-map-layer__check">{activeLayers.has(layer.slug) ? <Check size={13} /> : null}</span><span className="gta-map-swatch" /><span>{layer.label}</span><small>{group === "Places" ? layer.count : `${done}/${layer.count}`}</small>
            </button>;
          })}
        </div>)}
        <button type="button" className={`gta-map-remaining ${onlyRemaining ? "is-active" : ""}`} aria-pressed={onlyRemaining} onClick={() => setOnlyRemaining(!onlyRemaining)}>Hide completed locations</button>
        <div className="gta-map-sidebar__list-head"><strong>{filtered.length} visible locations</strong><span>{query ? "Search results" : "Choose a location"}</span></div>
        <div className="gta-map-location-list">{filtered.length ? filtered.slice(0, 120).map((marker) => {
          const layer = GTA5_MAP_LAYERS.find((entry) => entry.slug === marker.layer)!;
          return <button key={marker.id} type="button" className={`gta-map-location ${selectedId === marker.id ? "is-selected" : ""}`} onClick={() => selectPoint(marker.id)}>
            <span className={`gta-map-location__number ${isChecked(marker) ? "is-complete" : ""}`} style={{ "--layer-color": layer.color } as CSSProperties}>{isChecked(marker) ? <Check size={15} /> : marker.number || "•"}</span>
            <span className="gta-map-location__text"><strong>{marker.name}</strong><small>{marker.area}</small></span><ArrowUpRight size={15} aria-hidden />
          </button>;
        }) : <p className="gta-map-empty">No locations match these filters.</p>}
        {filtered.length > 120 ? <p className="gta-map-list-more">Showing the first 120. Search or choose a layer to narrow the list; all pins are on the map.</p> : null}</div>
      </div>
    </aside>
    <div className="gta-map-style-switch" role="group" aria-label="Map style">
      <button type="button" className={style === "roadmap" ? "is-active" : ""} onClick={() => setStyle("roadmap")} aria-pressed={style === "roadmap"}><MapIcon size={15} />Map</button>
      <button type="button" className={style === "satellite" ? "is-active" : ""} onClick={() => setStyle("satellite")} aria-pressed={style === "satellite"}>Satellite</button>
    </div>
    <div className="gta-map-controls" role="group" aria-label="Map zoom controls">
      <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></button>
      <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></button>
      <button type="button" aria-label="Show full map" onClick={() => mapRef.current?.fitBounds(MAP_BOUNDS, { padding: [18, 18] })}><Crosshair size={17} /></button>
    </div>
    {selected ? <aside className="gta-map-detail" role="dialog" aria-label={`${selected.name} details`} aria-modal="false">
      <PointDetails marker={selected} checked={isChecked(selected)} toggle={() => progress[selected.layer]?.toggle(selected.id)} clear={() => selectPoint(null)} share={sharePoint} copyStatus={copyStatus} />
    </aside> : null}
    <aside className={`gta-map-about ${infoOpen ? "is-open" : ""}`} aria-label="About the GTA 5 map">
      <div className="gta-map-about__header"><h2>About this map</h2><button type="button" aria-label="Close about panel" onClick={() => setInfoOpen(false)}><X size={18} /></button></div>
      <div className="gta-map-about__body">{children}</div>
    </aside>
  </section>;
}
