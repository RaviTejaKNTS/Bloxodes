"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { SiteLogo } from "@/components/SiteLogo";
import { ArrowLeft, ArrowUpRight, Check, Crosshair, Info, Layers3, Link2, Minus, Plus, Search, X } from "lucide-react";
import type * as Leaflet from "leaflet";
import { useCollectionChecklistProgress } from "@/lib/collection-checklist-progress-client";
import type { GtaMapLayer, GtaMapMarker, GtaMapPageData } from "@/lib/gta-interactive-map-types";

const PROGRESS_BASE = {
  endpoint: "/api/gta/collections/progress",
  requestKey: "code",
  storageKeyPrefix: "gta-collection:",
  eventName: "gta-collection-progress",
  analyticsPrefix: "gta_collection"
} as const;

type ProgressValue = {
  checked: Set<string>;
  toggle: (id: string) => void;
};

function ProgressBridge({ code, onChange }: { code: string; onChange: (code: string, value: ProgressValue) => void }) {
  const progress = useCollectionChecklistProgress({ ...PROGRESS_BASE, code });
  const toggleRef = useRef(progress.toggle);
  toggleRef.current = progress.toggle;
  const stableToggle = useCallback((id: string) => toggleRef.current(id), []);
  useEffect(() => {
    onChange(code, { checked: progress.checked, toggle: stableToggle });
  }, [code, progress.checked, stableToggle, onChange]);
  return null;
}

function pointSearchText(marker: GtaMapMarker): string {
  return [
    marker.name,
    marker.title,
    marker.number === null ? "" : String(marker.number),
    marker.collectionNumber === null ? "" : String(marker.collectionNumber),
    marker.area,
    marker.description,
    marker.category,
    marker.facts.map((fact) => fact.value).join(" ")
  ].join(" ").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function mapBounds(view: GtaMapPageData["config"]["views"][number]): Leaflet.LatLngTuple[] {
  return [[0, 0], [view.height, view.width]];
}

function pointLatLng(point: GtaMapMarker): Leaflet.LatLngExpression {
  return [point.y, point.x];
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pointPinText(marker: GtaMapMarker, checked: boolean): string {
  if (checked) return "✓";
  if (marker.number === null || marker.number < 0 || marker.number > 99) return "•";
  return String(marker.number);
}

function layerItemCount(layer: GtaMapLayer, markers: GtaMapMarker[]): number {
  if (layer.collectionCode && layer.collectionCount !== null) return layer.collectionCount;
  return markers.filter((marker) => marker.layer === layer.slug).length;
}

function PointDetails({
  marker,
  checked,
  toggle,
  clear,
  share,
  copyStatus
}: {
  marker: GtaMapMarker;
  checked: boolean;
  toggle: () => void;
  clear: () => void;
  share: () => void;
  copyStatus: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const tracked = Boolean(marker.collectionCode && marker.checkId);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [marker.id]);
  return (
    <>
      <div className="gta-map-detail__top">
        <span className="gta-map-eyebrow">
          <span className="gta-map-swatch" style={{ background: marker.color }} />
          {marker.layerLabel}{marker.number === null ? "" : " · #" + marker.number}
        </span>
        <button ref={closeRef} type="button" onClick={clear} aria-label="Close location details" className="gta-map-icon-button gta-map-detail__close"><X size={19} aria-hidden="true" /></button>
      </div>
      {marker.image ? (
        <div className="gta-map-detail__image">
          <img src={marker.image} alt={marker.name + " in " + marker.layerLabel} width="420" height="220" loading="lazy" decoding="async" />
        </div>
      ) : null}
      <div className="gta-map-detail__body">
        <h2>{marker.name}</h2>
        {marker.area && marker.area !== marker.name ? <p className="gta-map-detail__area">{marker.area}</p> : null}
        {marker.description ? <p className="gta-map-detail__summary">{marker.description}</p> : null}
        {marker.facts.length ? (
          <dl className="gta-map-detail__facts">
            {marker.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
          </dl>
        ) : null}
        {marker.category ? <p className="gta-map-detail__category">Map category: {marker.category}</p> : null}
        {marker.note ? <p className="gta-map-detail__note">{marker.note}</p> : null}
        <div className="gta-map-detail__actions">
          {tracked ? (
            <button type="button" className={"gta-map-complete" + (checked ? " is-checked" : "")} onClick={toggle} aria-pressed={checked}>
              <Check size={16} aria-hidden="true" />{checked ? "Completed" : "Mark complete"}
            </button>
          ) : null}
          {marker.guideUrl ? <Link className="gta-map-guide-link" href={marker.guideUrl}>Open guide <ArrowUpRight size={16} aria-hidden="true" /></Link> : null}
        </div>
        <button type="button" onClick={share} className="gta-map-share"><Link2 size={15} aria-hidden="true" /><span aria-live="polite" aria-atomic="true">{copyStatus || "Copy link to this location"}</span></button>
        <p className="gta-map-detail__source">
          Coordinates: <a href={marker.sourceUrl} target="_blank" rel="noreferrer">GTA Wiki map page</a>. Map artwork © Rockstar Games.
        </p>
      </div>
    </>
  );
}

export function GtaInteractiveMap({ map, children }: { map: GtaMapPageData; children: ReactNode }) {
  const { config, layers, markers, guides, hubPath } = map;
  const [query, setQuery] = useState("");
  const [activeLayers, setActiveLayers] = useState<Set<string>>(() => new Set(layers.filter((layer) => layer.defaultEnabled).map((layer) => layer.slug)));
  const [onlyRemaining, setOnlyRemaining] = useState(false);
  const [selectedView, setSelectedView] = useState(config.views[0]?.slug ?? "");
  const [selectedMode, setSelectedMode] = useState(config.defaultMode ?? config.modes[0]?.value ?? "");
  const [selectedEdition, setSelectedEdition] = useState(config.defaultEdition ?? config.editionOptions[0]?.value ?? "");
  const [selectedVariant, setSelectedVariant] = useState(config.defaultVariant ?? config.variantOptions[0]?.value ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [mapImageStatus, setMapImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [listOpen, setListOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [progressRevision, setProgressRevision] = useState(0);
  const [progressByCode, setProgressByCode] = useState<Map<string, ProgressValue>>(() => new Map());
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const selectedViewRef = useRef(selectedView);
  const overlayViewRef = useRef<string | null>(null);
  const pendingFocusRef = useRef<string | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const clusterRef = useRef<Leaflet.MarkerClusterGroup | null>(null);
  const overlayRef = useRef<Leaflet.ImageOverlay | null>(null);
  const attributionRef = useRef<string | null>(null);
  const pinRefs = useRef<Map<string, Leaflet.Marker>>(new Map());
  const selected = markers.find((marker) => marker.id === selectedId) ?? null;
  const layerBySlug = useMemo(() => new Map(layers.map((layer) => [layer.slug, layer])), [layers]);
  const viewBySlug = useMemo(() => new Map(config.views.map((view) => [view.slug, view])), [config.views]);

  const onProgressChange = useCallback((code: string, value: ProgressValue) => {
    setProgressByCode((current) => {
      const next = new Map(current);
      next.set(code, value);
      return next;
    });
    setProgressRevision((value) => value + 1);
  }, []);
  const progressCodes = Array.from(new Set(layers.map((layer) => layer.collectionCode).filter((code): code is string => Boolean(code))));

  const isChecked = useCallback((marker: GtaMapMarker) => {
    return Boolean(marker.collectionCode && marker.checkId && progressByCode.get(marker.collectionCode)?.checked.has(marker.checkId));
  }, [progressByCode, progressRevision]);

  const currentModeLayers = useMemo(() => layers.filter((layer) =>
    !selectedMode || !layer.mode || layer.mode.includes(selectedMode)
  ), [layers, selectedMode]);
  const currentLayerSlugs = useMemo(() => new Set(currentModeLayers.map((layer) => layer.slug)), [currentModeLayers]);
  const visibleLayers = currentModeLayers.filter((layer) => activeLayers.has(layer.slug));
  const activeMarkers = useMemo(() => markers.filter((marker) => {
    const layer = layerBySlug.get(marker.layer);
    if (!layer || !activeLayers.has(marker.layer) || !currentLayerSlugs.has(marker.layer)) return false;
    if (marker.edition && selectedEdition && marker.edition !== selectedEdition) return false;
    if (marker.variant && selectedVariant && marker.variant !== selectedVariant) return false;
    if (onlyRemaining && marker.checkId && isChecked(marker)) return false;
    const terms = query.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (terms.length) {
      const words = pointSearchText(marker).split(" ");
      if (!terms.every((term) => words.some((word) => word.startsWith(term)))) return false;
    }
    return true;
  }), [markers, layerBySlug, activeLayers, currentLayerSlugs, selectedEdition, selectedVariant, onlyRemaining, query, isChecked]);
  const shownMarkers = useMemo(() => activeMarkers.filter((marker) => marker.view === selectedView), [activeMarkers, selectedView]);
  const trackedLocations = useMemo(() => {
    const keys = new Set(markers.flatMap((marker) => marker.collectionCode && marker.checkId ? [marker.collectionCode + ":" + marker.checkId] : []));
    return Array.from(keys);
  }, [markers]);
  const completedLocations = trackedLocations.filter((key) => {
    const separator = key.indexOf(":");
    const code = key.slice(0, separator);
    const id = key.slice(separator + 1);
    return progressByCode.get(code)?.checked.has(id) ?? false;
  }).length;

  const selectPoint = useCallback((id: string | null, writeUrl = true) => {
    setSelectedId(id);
    setInfoOpen(false);
    setCopyStatus("");
    if (id && window.matchMedia("(max-width: 800px)").matches) setListOpen(false);
    const point = markers.find((marker) => marker.id === id);
    let changedView = false;
    if (point) {
      changedView = point.view !== selectedViewRef.current;
      if (changedView) pendingFocusRef.current = point.id;
      selectedViewRef.current = point.view;
      setSelectedView(point.view);
      setActiveLayers((current) => current.has(point.layer) ? current : new Set([...current, point.layer]));
      const layer = layers.find((entry) => entry.slug === point.layer);
      if (layer?.mode?.length === 1) setSelectedMode(layer.mode[0]);
      if (point.edition) setSelectedEdition(point.edition);
      if (point.variant) setSelectedVariant(point.variant);
    }
    if (writeUrl) {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("point", id);
      else url.searchParams.delete("point");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    if (point && mapRef.current && !changedView) {
      const view = viewBySlug.get(point.view);
      const zoom = Math.max(mapRef.current.getZoom(), view ? -1 : 0);
      mapRef.current.flyTo(pointLatLng(point), zoom, { duration: 0.45 });
    }
  }, [markers, layers, viewBySlug]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const main = mapElement.current?.closest("main");
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
      document.body.style.overflow = previousOverflow;
      hiddenShell.forEach((element, index) => { element.inert = previousInert[index]; });
    };
  }, []);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    let cancelled = false;
    void import("leaflet").then(async (leafletModule) => {
      await import("leaflet.markercluster");
      if (cancelled || !mapElement.current) return;
      const L = leafletModule.default;
      leafletRef.current = L;
      const requestedPointId = new URLSearchParams(window.location.search).get("point");
      const requestedPoint = markers.find((marker) => marker.id === requestedPointId);
      const initialView = viewBySlug.get(requestedPoint?.view ?? config.views[0]?.slug ?? "") ?? config.views[0];
      if (!initialView) return;
      const bounds = mapBounds(initialView);
      const mapInstance = L.map(mapElement.current, {
        crs: L.CRS.Simple,
        minZoom: -4,
        maxZoom: 7,
        zoomSnap: 0.25,
        zoomControl: false,
        attributionControl: true,
        maxBounds: L.latLngBounds(bounds).pad(0.22),
        maxBoundsViscosity: 1,
        preferCanvas: true
      });
      mapRef.current = mapInstance;
      mapInstance.attributionControl.setPrefix(false);
      mapInstance.fitBounds(bounds, { paddingTopLeft: [30, 82], paddingBottomRight: [30, 28] });
      const image = L.imageOverlay(initialView.image, bounds, {
        alt: initialView.label + " game map artwork",
        interactive: false,
        className: "gta-map-image-overlay"
      });
      overlayViewRef.current = initialView.slug;
      image.once("load", () => {
        if (overlayViewRef.current === initialView.slug) setMapImageStatus("loaded");
      });
      image.once("error", () => {
        if (overlayViewRef.current === initialView.slug) setMapImageStatus("error");
      });
      image.addTo(mapInstance);
      overlayRef.current = image;
      const attribution = '<a href="' + escapeHtml(initialView.sourceUrl) + '" target="_blank" rel="noreferrer">GTA Wiki map data</a> · © Rockstar Games';
      attributionRef.current = attribution;
      mapInstance.attributionControl.addAttribution(attribution);
      const clusters = L.markerClusterGroup({
        maxClusterRadius: 44,
        disableClusteringAtZoom: 2,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => L.divIcon({
          className: "gta-map-cluster-wrap",
          html: '<span class="gta-map-cluster">' + cluster.getChildCount() + "</span>",
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      });
      clusterRef.current = clusters;
      for (const marker of markers) {
        const icon = L.divIcon({
          className: "gta-map-pin-wrap",
          html: '<span class="gta-map-pin" style="--pin-color:' + marker.color + '">' + pointPinText(marker, false) + "</span>",
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        const pin = L.marker(pointLatLng(marker), {
          icon,
          title: marker.name + (marker.area ? " — " + marker.area : ""),
          keyboard: true,
          riseOnHover: true
        });
        pin.on("click", () => selectPoint(marker.id));
        pinRefs.current.set(marker.id, pin);
      }
      clusters.addTo(mapInstance);
      if (requestedPoint) {
        mapInstance.flyTo(pointLatLng(requestedPoint), 1, { duration: 0 });
      }
      setMapReady(true);
      window.setTimeout(() => mapInstance.invalidateSize(), 120);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
      overlayRef.current = null;
      overlayViewRef.current = null;
      attributionRef.current = null;
      pinRefs.current.clear();
    };
  }, [config.views, markers, selectPoint, viewBySlug]);

  useEffect(() => {
    if (!mapReady) return;
    const L = leafletRef.current;
    const mapInstance = mapRef.current;
    const view = viewBySlug.get(selectedView);
    if (!L || !mapInstance || !view) return;
    const bounds = mapBounds(view);
    if (overlayViewRef.current !== view.slug) {
      overlayRef.current?.remove();
      setMapImageStatus("loading");
      const image = L.imageOverlay(view.image, bounds, {
        alt: view.label + " game map artwork",
        interactive: false,
        className: "gta-map-image-overlay"
      });
      overlayViewRef.current = view.slug;
      image.once("load", () => {
        if (overlayViewRef.current === view.slug) setMapImageStatus("loaded");
      });
      image.once("error", () => {
        if (overlayViewRef.current === view.slug) setMapImageStatus("error");
      });
      image.addTo(mapInstance);
      overlayRef.current = image;
      mapInstance.attributionControl.setPrefix(false);
      if (attributionRef.current) mapInstance.attributionControl.removeAttribution(attributionRef.current);
      const attribution = '<a href="' + escapeHtml(view.sourceUrl) + '" target="_blank" rel="noreferrer">GTA Wiki map data</a> · © Rockstar Games';
      attributionRef.current = attribution;
      mapInstance.attributionControl.addAttribution(attribution);
    }
    mapInstance.setMaxBounds(L.latLngBounds(bounds).pad(0.22));
    mapInstance.fitBounds(bounds, { paddingTopLeft: [30, 82], paddingBottomRight: [30, 28], animate: false });
    const focusId = pendingFocusRef.current;
    const focusPoint = focusId ? markers.find((marker) => marker.id === focusId && marker.view === selectedView) : null;
    pendingFocusRef.current = null;
    if (focusPoint) {
      window.requestAnimationFrame(() => mapInstance.flyTo(pointLatLng(focusPoint), Math.max(mapInstance.getZoom(), 0), { duration: 0.35 }));
    }
    window.setTimeout(() => mapInstance.invalidateSize(), 80);
  }, [mapReady, selectedView, viewBySlug, markers]);

  useEffect(() => {
    if (!mapReady) return;
    const L = leafletRef.current;
    const clusters = clusterRef.current;
    if (!L || !clusters) return;
    const visible = new Set(shownMarkers.map((marker) => marker.id));
    clusters.clearLayers();
    const visiblePins: Leaflet.Marker[] = [];
    for (const marker of markers) {
      const pin = pinRefs.current.get(marker.id);
      if (!pin) continue;
      const checked = isChecked(marker);
      pin.setIcon(L.divIcon({
        className: "gta-map-pin-wrap",
        html: '<span class="gta-map-pin' + (checked ? " is-complete" : "") + (selectedId === marker.id ? " is-selected" : "")
          + '" style="--pin-color:' + marker.color + '">' + pointPinText(marker, checked) + "</span>",
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      }));
      if (visible.has(marker.id)) visiblePins.push(pin);
    }
    clusters.addLayers(visiblePins);
  }, [mapReady, markers, shownMarkers, isChecked, selectedId, progressRevision]);

  useEffect(() => {
    const fromUrl = () => {
      const id = new URLSearchParams(window.location.search).get("point");
      const marker = markers.find((point) => point.id === id);
      if (marker) selectPoint(marker.id, false);
      else setSelectedId(null);
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
  }, [markers, selectPoint]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const pin = selectedId ? pinRefs.current.get(selectedId) : null;
        selectPoint(null);
        setInfoOpen(false);
        setListOpen(false);
        window.requestAnimationFrame(() => pin?.getElement()?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectPoint, selectedId]);

  useEffect(() => {
    if (!mapReady || query.trim().length < 2 || activeMarkers.length !== 1) return;
    const timeout = window.setTimeout(() => {
      const result = activeMarkers[0];
      if (result.view !== selectedView) setSelectedView(result.view);
      const mapInstance = mapRef.current;
      if (mapInstance) mapInstance.flyTo(pointLatLng(result), Math.max(mapInstance.getZoom(), 0), { duration: 0.35 });
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [query, activeMarkers, mapReady, selectedView]);

  const toggleLayer = (slug: string) => setActiveLayers((previous) => {
    const next = new Set(previous);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    return next;
  });

  const changeView = (viewSlug: string) => {
    selectedViewRef.current = viewSlug;
    pendingFocusRef.current = null;
    selectPoint(null);
    setSelectedView(viewSlug);
  };

  const sharePoint = async () => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set("point", selected.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyStatus("Link copied");
    } catch {
      setCopyStatus("Copy from address bar");
    }
  };

  const currentView = viewBySlug.get(selectedView) ?? config.views[0];
  const visibleCount = shownMarkers.length;
  const groupedLayers = Array.from(new Set(visibleLayers.map((layer) => layer.group)));
  const listLimit = query.trim() ? 180 : 100;

  return (
    <section className="gta-map-app gta-interactive-map" aria-label={config.mapTitle}>
      <div ref={mapElement} className="gta-map-canvas" role="application" aria-label={"Zoomable " + config.title + " map with selectable location pins"} />
      {mapImageStatus === "loading" ? <div className="gta-map-image-status" role="status" aria-live="polite">Loading map artwork…</div> : null}
      {mapImageStatus === "error" ? <div className="gta-map-image-status is-error" role="alert">Map artwork didn’t load. Refresh the page to retry.</div> : null}
      <header className="gta-map-topbar">
        <Link href={hubPath} className="gta-map-back" aria-label={"Back to " + map.hubTitle + " wiki"}><ArrowLeft size={17} aria-hidden="true" /></Link>
        <div className="gta-map-title">
          <SiteLogo className="h-6" />
          <span className="gta-map-title__separator" aria-hidden="true">.</span>
          <h1>{config.mapTitle}</h1>
        </div>
        <div className="gta-map-topbar__actions">
          <button type="button" onClick={() => { setInfoOpen(false); setListOpen(!listOpen); }} aria-label="Toggle map layers and locations" aria-expanded={listOpen}>
            <Layers3 size={17} aria-hidden="true" /><span>Layers</span>
          </button>
          <button type="button" onClick={() => { setListOpen(false); setInfoOpen(!infoOpen); }} aria-label="About this map" aria-expanded={infoOpen}>
            <Info size={17} aria-hidden="true" /><span>About</span>
          </button>
        </div>
      </header>

      <aside className={"gta-map-sidebar" + (listOpen ? " is-open" : "")} aria-label="Map layers and locations" aria-hidden={!listOpen}>
        <div className="gta-map-sidebar__header">
          <div><strong>Explore the map</strong><span aria-live="polite">{completedLocations} of {trackedLocations.length} guide items completed</span></div>
          <button type="button" onClick={() => setListOpen(false)} aria-label="Close layers"><X size={18} aria-hidden="true" /></button>
        </div>
        <label className="gta-map-sidebar__search">
          <Search size={17} aria-hidden />
          <input type="search" name="mapSearch" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search items, areas, and clues…" aria-label="Search map locations" />
        </label>
        <div className="gta-map-sidebar__scroll">
          {config.modes.length ? (
            <label className="gta-map-filter">
              <span>Game mode</span>
              <select value={selectedMode} onChange={(event) => setSelectedMode(event.target.value)}>
                {config.modes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
          {config.editionOptions.length ? (
            <label className="gta-map-filter">
              <span>Game edition</span>
              <select value={selectedEdition} onChange={(event) => setSelectedEdition(event.target.value)}>
                {config.editionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
          {config.variantOptions.length ? (
            <label className="gta-map-filter">
              <span>Location variant</span>
              <select value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)}>
                {config.variantOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
          {config.views.length > 1 ? (
            <label className="gta-map-filter">
              <span>Map area</span>
              <select value={selectedView} onChange={(event) => changeView(event.target.value)}>
                {config.views.map((view) => <option key={view.slug} value={view.slug}>{view.label}</option>)}
              </select>
            </label>
          ) : null}
          <div className="gta-map-layer-count" aria-live="polite"><span>{visibleCount} locations shown</span><span>{currentView?.label}</span></div>
          {groupedLayers.map((group) => (
            <div className="gta-map-layer-group" key={group}>
              <h2>{group}</h2>
              {visibleLayers.filter((layer) => layer.group === group).map((layer) => {
                const tracked = markers.filter((marker) => marker.layer === layer.slug && marker.collectionCode && marker.checkId);
                const complete = new Set(tracked.filter(isChecked).map((marker) => marker.collectionCode + ":" + marker.checkId)).size;
                const count = layerItemCount(layer, markers);
                return (
                  <button
                    key={layer.slug}
                    type="button"
                    aria-pressed={activeLayers.has(layer.slug)}
                    onClick={() => toggleLayer(layer.slug)}
                    className={"gta-map-layer" + (activeLayers.has(layer.slug) ? " is-active" : "")}
                    style={{ "--layer-color": layer.color } as CSSProperties}
                  >
                    <span className="gta-map-layer__check">{activeLayers.has(layer.slug) ? <Check size={13} aria-hidden="true" /> : null}</span>
                    <span className="gta-map-swatch" />
                    <span className="gta-map-layer__label">{layer.label}</span>
                    <small>{layer.collectionCode ? complete + "/" + count : layer.pointCount}</small>
                  </button>
                );
              })}
            </div>
          ))}
          {visibleLayers.some((layer) => layer.note) ? (
            <div className="gta-map-layer-notes">
              {visibleLayers.filter((layer) => layer.note).map((layer) => <p key={layer.slug}><strong>{layer.label}:</strong> {layer.note}</p>)}
            </div>
          ) : null}
          <button type="button" className={"gta-map-remaining" + (onlyRemaining ? " is-active" : "")} aria-pressed={onlyRemaining} onClick={() => setOnlyRemaining(!onlyRemaining)}>
            Hide completed locations
          </button>
          <div className="gta-map-sidebar__list-head"><strong>{activeMarkers.length} matching locations</strong><span>{query ? "Search results" : "Current map area"}</span></div>
          <div className="gta-map-location-list">
            {activeMarkers.length ? activeMarkers.slice(0, listLimit).map((marker) => {
              const checked = isChecked(marker);
              const pointView = viewBySlug.get(marker.view);
              return (
                <button key={marker.id} type="button" className={"gta-map-location" + (selectedId === marker.id ? " is-selected" : "")} onClick={() => selectPoint(marker.id)}>
                  <span className={"gta-map-location__number" + (checked ? " is-complete" : "")} style={{ "--layer-color": marker.color } as CSSProperties}>
                    {checked ? <Check size={15} aria-hidden="true" /> : marker.number === null ? "•" : marker.number}
                  </span>
                  <span className="gta-map-location__text">
                    <strong>{marker.name}</strong>
                    <small>{marker.area || marker.category || pointView?.label || marker.layerLabel}{query && marker.view !== selectedView ? " · " + (pointView?.label ?? "") : ""}</small>
                  </span>
                  <ArrowUpRight size={15} aria-hidden />
                </button>
              );
            }) : <p className="gta-map-empty">No locations match these filters.</p>}
            {activeMarkers.length > listLimit ? (
              <p className="gta-map-list-more">Showing the first {listLimit}. Search or switch off layers to narrow the list; every active pin is on the map.</p>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="gta-map-controls" role="group" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} aria-hidden="true" /></button>
        <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} aria-hidden="true" /></button>
        <button type="button" aria-label="Show full map" onClick={() => currentView && mapRef.current?.fitBounds(mapBounds(currentView), { paddingTopLeft: [30, 82], paddingBottomRight: [30, 28] })}><Crosshair size={17} aria-hidden="true" /></button>
      </div>

      {selected ? (
        <aside className="gta-map-detail" role="dialog" aria-label={selected.name + " details"} aria-modal="false">
          <PointDetails
            marker={selected}
            checked={isChecked(selected)}
            toggle={() => {
              if (selected.collectionCode && selected.checkId) progressByCode.get(selected.collectionCode)?.toggle(selected.checkId);
            }}
            clear={() => {
              const pin = pinRefs.current.get(selected.id);
              selectPoint(null);
              window.requestAnimationFrame(() => pin?.getElement()?.focus());
            }}
            share={sharePoint}
            copyStatus={copyStatus}
          />
        </aside>
      ) : null}

      <aside className={"gta-map-about" + (infoOpen ? " is-open" : "")} aria-label="About this map" aria-hidden={!infoOpen}>
        <div className="gta-map-about__header">
          <h2>About {config.title}</h2>
          <button type="button" aria-label="Close about panel" onClick={() => setInfoOpen(false)}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="gta-map-about__body">{children}</div>
      </aside>

      <div className="gta-map-progress-bridges" aria-hidden="true">
        {progressCodes.map((code) => <ProgressBridge key={code} code={code} onChange={onProgressChange} />)}
      </div>
    </section>
  );
}
