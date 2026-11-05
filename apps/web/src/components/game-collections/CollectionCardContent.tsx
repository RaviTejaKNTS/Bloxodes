"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

export type CollectionFact = {
  key: string;
  label: string;
  value: string | null;
  parts?: string[];
  kind?: string;
  tone?: string;
};

export type CollectionCardLayout = {
  fields: CollectionFact[];
  image: boolean;
  description: boolean;
  tracks: boolean;
  details: boolean;
  rowCount: number;
};

export function capitalizeCollectionLabel(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function collectionFactColor(field: CollectionFact) {
  if (capitalizeCollectionLabel(field.label) !== "Status") return "text-foreground";
  if (field.tone === "negative") return "text-rose-300";
  if (field.tone === "warning") return "text-amber-300";
  if (field.tone === "positive" || field.kind === "highlight") return "text-emerald-300";
  return "text-foreground";
}

/** Union by key, in the supplied field order. Empty fields disappear for the whole row. */
export function buildCollectionCardLayout(cards: {
  fields: CollectionFact[];
  image?: boolean;
  description?: boolean;
  tracks?: boolean;
  details?: boolean;
}[]): CollectionCardLayout {
  const fields = new Map<string, CollectionFact>();
  for (const card of cards) for (const field of card.fields) {
    if (!fields.has(field.key)) fields.set(field.key, field);
  }
  const visible = [...fields.values()].filter(field => cards.some(card =>
    card.fields.some(candidate => candidate.key === field.key && Boolean(candidate.value))
  ));
  const image = cards.some(card => card.image);
  const description = cards.some(card => card.description);
  const tracks = cards.some(card => card.tracks);
  const details = cards.some(card => card.details);
  return { fields: visible, image, description, tracks, details,
    rowCount: 1 + Number(image) + Number(description) + visible.length + Number(tracks) + Number(details) };
}

export function collectionRowStyle(layout?: CollectionCardLayout): CSSProperties | undefined {
  return layout ? { "--collection-card-rows": layout.rowCount } as CSSProperties : undefined;
}

/** All text stays in the HTML; only CSS clips the closed state. */
export function CollectionReadMore({ text, children, description = false }: {
  text: string;
  children?: ReactNode;
  description?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = text.length > (description ? 135 : 100);
  return <div className={description ? "text-sm leading-relaxed text-muted" : "text-sm leading-snug"}>
    <div className={`whitespace-pre-line [overflow-wrap:anywhere] ${collapsible && !expanded ? description ? "line-clamp-3" : "line-clamp-4" : ""}`}>{children ?? text}</div>
    {collapsible ? <button type="button" aria-expanded={expanded}
      onClick={event => { event.preventDefault(); event.stopPropagation(); setExpanded(value => !value); }}
      className="mt-1 text-xs text-muted underline underline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-accent">
      {expanded ? "Show less" : "Read more"}
    </button> : null}
  </div>;
}

function factValue(field: CollectionFact, renderValue?: (field: CollectionFact) => ReactNode) {
  if (renderValue) return renderValue(field);
  return field.parts?.length ? <ul>{field.parts.map((part, index) => <li key={index}>{part}</li>)}</ul> : field.value;
}

export function CollectionFactRows({ fields, layout, renderValue }: {
  fields: CollectionFact[];
  layout?: CollectionCardLayout;
  renderValue?: (field: CollectionFact) => ReactNode;
}) {
  const rows = layout ? layout.fields.map(template => fields.find(field => field.key === template.key) ?? { ...template, value: null })
    : fields.filter(field => field.value);
  if (!rows.length) return null;
  return <dl className="collection-card-facts" style={{ "--collection-fact-rows": rows.length } as CSSProperties}>
    {rows.map(field => <div key={field.key} className="collection-card-fact">
      <dt className="text-sm leading-snug text-muted [overflow-wrap:anywhere]">{capitalizeCollectionLabel(field.label)}</dt>
      <dd className={`text-right font-medium ${collectionFactColor(field)}`}>
        {!field.value ? <span className="text-muted">-</span> : field.parts?.length || field.kind === "link"
          /* Lists and links are never cut: Read more is only for long text. */
          ? <div className="text-sm leading-snug [overflow-wrap:anywhere]">{factValue(field, renderValue)}</div>
          : <CollectionReadMore text={field.value}>{factValue(field, renderValue)}</CollectionReadMore>}
      </dd>
    </div>)}
  </dl>;
}
