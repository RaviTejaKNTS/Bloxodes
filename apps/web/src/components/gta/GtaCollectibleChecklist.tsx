"use client";

import { CatalogSelectNav } from "@/components/CatalogSelectNav";
import {
  CollectionChecklist,
  type CollectionChecklistItem,
  type CollectionChecklistSection
} from "@/components/collection/CollectionChecklist";

export type GtaCollectibleItem = CollectionChecklistItem;
export type GtaCollectibleSection = CollectionChecklistSection;

const GTA_PROGRESS_OPTIONS = {
  endpoint: "/api/gta/collections/progress",
  requestKey: "code",
  storageKeyPrefix: "gta-collection:",
  eventName: "gta-collection-progress",
  analyticsPrefix: "gta_collection"
} as const;

export function GtaCollectibleChecklist({
  code,
  gameName,
  collectionLabel,
  sections,
  cardFields,
  collectionOptions
}: {
  code: string;
  gameName: string;
  collectionLabel: string;
  sections: GtaCollectibleSection[];
  cardFields?: string[] | null;
  collectionOptions: Array<{ value: string; label: string; href: string; pageType?: "database" | "checklist" }>;
}) {
  return (
    <CollectionChecklist
      code={code}
      gameName={gameName}
      collectionLabel={collectionLabel}
      sections={sections}
      cardFields={cardFields}
      toolbar={
        <CatalogSelectNav
          label={`${gameName} collection`}
          value={code}
          options={collectionOptions}
          className="max-w-none"
        />
      }
      progressOptions={{ ...GTA_PROGRESS_OPTIONS, code }}
    />
  );
}
