"use client";

import { CatalogSelectNav } from "@/components/CatalogSelectNav";
import {
  CollectionChecklist,
  type CollectionChecklistItem,
  type CollectionChecklistSection
} from "@/components/collection/CollectionChecklist";

export type RedDeadCollectionItem = CollectionChecklistItem;
export type RedDeadCollectionSection = CollectionChecklistSection;

const RED_DEAD_PROGRESS_OPTIONS = {
  endpoint: "/api/red-dead/collections/progress",
  requestKey: "code",
  storageKeyPrefix: "red-dead-collection:",
  eventName: "red-dead-collection-progress",
  analyticsPrefix: "red_dead_collection"
} as const;

export function RedDeadCollectionChecklist({
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
  sections: RedDeadCollectionSection[];
  cardFields?: string[] | null;
  collectionOptions: Array<{ value: string; label: string; href: string; pageType?: "database" | "collectible" }>;
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
      progressOptions={{ ...RED_DEAD_PROGRESS_OPTIONS, code }}
    />
  );
}
