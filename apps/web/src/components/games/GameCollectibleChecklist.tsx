"use client";

import { CatalogSelectNav } from "@/components/CatalogSelectNav";
import {
  CollectionChecklist,
  type CollectionChecklistItem,
  type CollectionChecklistSection
} from "@/components/collection/CollectionChecklist";

export type GameCollectibleItem = CollectionChecklistItem;
export type GameCollectibleSection = CollectionChecklistSection;

const LEGACY_PROGRESS_OPTIONS = {
  endpoint: "/api/gta/collections/progress",
  requestKey: "code",
  storageKeyPrefix: "gta-collection:",
  eventName: "gta-collection-progress",
  analyticsPrefix: "gta_collection"
} as const;

export function GameCollectibleChecklist({
  namespace,
  code,
  gameName,
  collectionLabel,
  sections,
  cardFields,
  fieldLabels,
  collectionOptions
}: {
  namespace: string;
  code: string;
  gameName: string;
  collectionLabel: string;
  sections: GameCollectibleSection[];
  cardFields?: string[] | null;
  fieldLabels?: Record<string, string>;
  collectionOptions: Array<{ value: string; label: string; href: string; pageType?: "database" | "collectible" }>;
}) {
  const progressOptions = namespace === "gta" ? LEGACY_PROGRESS_OPTIONS : {
    endpoint: namespace === "red-dead" ? "/api/red-dead/collections/progress" : `/api/games/${namespace}/collections/progress`,
    requestKey: "code", storageKeyPrefix: `${namespace}-collection:`,
    eventName: `${namespace}-collection-progress`, analyticsPrefix: `${namespace.replaceAll("-", "_")}_collection`
  };
  return (
    <CollectionChecklist
      code={code}
      gameName={gameName}
      collectionLabel={collectionLabel}
      sections={sections}
      cardFields={cardFields}
      fieldLabels={fieldLabels}
      toolbar={
        <CatalogSelectNav
          label={`${gameName} collection`}
          value={code}
          options={collectionOptions}
          className="max-w-none"
        />
      }
      progressOptions={{ ...progressOptions, code }}
    />
  );
}
