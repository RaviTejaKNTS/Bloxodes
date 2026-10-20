"use client";

import type { ReactNode } from "react";
import { CatalogSelectNav } from "@/components/CatalogSelectNav";
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
  cardFields,
  fieldLabels,
  collectionOptions,
  beforeToolbar,
  afterContent
}: {
  code: string;
  gameName: string;
  collectionLabel: string;
  sections: RobloxCollectionChecklistSection[];
  cardFields?: string[] | null;
  fieldLabels?: Record<string, string>;
  beforeToolbar?: ReactNode;
  afterContent?: ReactNode;
  collectionOptions: Array<{ value: string; label: string; href: string }>;
}) {
  return (
    <CollectionChecklist
      stream
      beforeToolbar={beforeToolbar}
      afterContent={afterContent}
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
      progressOptions={{ ...ROBLOX_PROGRESS_OPTIONS, code }}
    />
  );
}
