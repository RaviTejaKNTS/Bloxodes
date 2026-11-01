"use client";
import { gameCollectionProgressOptions } from "@/lib/game-collection-progress-options";

import type { ReactNode } from "react";
import { CatalogSelectNav } from "@/components/CatalogSelectNav";
import {
  CollectionChecklist,
  type CollectionChecklistItem,
  type CollectionChecklistSection
} from "@/components/collection/CollectionChecklist";

export type GameCollectibleItem = CollectionChecklistItem;
export type GameCollectibleSection = CollectionChecklistSection;

export function GameCollectibleChecklist({
  namespace,
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
  namespace: string;
  code: string;
  gameName: string;
  collectionLabel: string;
  sections: GameCollectibleSection[];
  cardFields?: string[] | null;
  fieldLabels?: Record<string, string>;
  collectionOptions: Array<{ value: string; label: string; href: string; pageType?: "database" | "collectible" }>;
  beforeToolbar?: ReactNode;
  afterContent?: ReactNode;
}) {
  const progressOptions = gameCollectionProgressOptions(namespace);
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
      progressOptions={{ ...progressOptions, code }}
    />
  );
}
