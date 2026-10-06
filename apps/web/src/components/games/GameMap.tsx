"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GameMapData } from "@/lib/game-page-data";

export function GameMap({ data }: { data: GameMapData }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const categories = [...new Set(data.markers.map(marker => marker.category).filter(Boolean))] as string[];
  const markers = data.markers.filter(marker =>
    (category === "all" || marker.category === category) &&
    `${marker.title} ${marker.description ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );
  const markerNumbers = new Map(data.markers.map((marker, index) => [marker.id, index + 1]));
  const active = markers.find(marker => marker.id === selected);

  return (
    <section aria-label="Interactive map" className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input aria-label="Search map locations" placeholder="Search locations" value={query}
          onChange={event => setQuery(event.target.value)} className="max-w-sm" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Map category" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" aria-label="Zoom in" disabled={zoom >= 4}
          onClick={() => setZoom(value => Math.min(4, value + 0.5))}>+</Button>
        <Button variant="outline" aria-label="Zoom out" disabled={zoom <= 1}
          onClick={() => setZoom(value => Math.max(1, value - 0.5))}>−</Button>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-md border border-border">
        <div className="relative" style={{ width: `${zoom * 100}%`, aspectRatio: `${data.width}/${data.height}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.image} alt="Game map" width={data.width} height={data.height} className="absolute inset-0 h-full w-full" />
          {markers.map(marker => (
            <button key={marker.id} aria-label={marker.title} aria-pressed={selected === marker.id}
              onClick={() => setSelected(marker.id)}
              className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-background bg-accent text-xs font-semibold text-white focus-visible:ring-2 focus-visible:ring-foreground"
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>
              {markerNumbers.get(marker.id)}
            </button>
          ))}
        </div>
      </div>
      {active ? (
        <div aria-live="polite" className="space-y-2">
          <h2 className="text-2xl font-semibold">{active.title}</h2>
          {active.description ? <p>{active.description}</p> : null}
          {active.href ? <a href={active.href} className="text-accent underline">Open guide</a> : null}
        </div>
      ) : null}
      <p className="text-sm text-muted">{data.attribution}</p>
      <ul className="divide-y divide-border">
        {markers.map(marker => (
          <li key={marker.id} className="py-3">
            <button className="text-left text-lg font-semibold hover:text-accent"
              onClick={() => setSelected(marker.id)}>{marker.title}</button>
            {marker.description ? <p>{marker.description}</p> : null}
          </li>
        ))}
      </ul>
      {!markers.length ? <p>No locations match your search.</p> : null}
    </section>
  );
}
