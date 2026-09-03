"use client";

import {
  CollectionChecklist,
  type CollectionChecklistItem,
  type CollectionChecklistSection
} from "@/components/collection/CollectionChecklist";

export type RobloxCollectionChecklistItem = CollectionChecklistItem;
export type RobloxCollectionChecklistSection = CollectionChecklistSection;

const ROBLOX_PROGRESS_OPTIONS = {
  endpoint: "/api/wiki/collections/progress",
  requestKey: "code",
  storageKeyPrefix: "wiki-collection:",
  eventName: "wiki-collection-progress",
  analyticsPrefix: "wiki_collection"
} as const;

export function RobloxCollectionChecklist({
  code,
  gameName,
  collectionLabel,
  sections,
  cardFields
}: {
  code: string;
  gameName: string;
  collectionLabel: string;
  sections: RobloxCollectionChecklistSection[];
  cardFields?: string[] | null;
}) {
  return (
    <CollectionChecklist
      code={code}
      gameName={gameName}
      collectionLabel={collectionLabel}
      sections={sections}
      cardFields={cardFields}
      progressOptions={{ ...ROBLOX_PROGRESS_OPTIONS, code }}
    />
  );
}
