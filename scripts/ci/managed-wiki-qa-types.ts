// Shared data contract for the GitHub fixture and browser tests. No runtime imports.
export type ExpectedMedia = {
  image_key: string | null; image_mime: string | null; image_width: number | null;
  image_height: number | null; image_bytes: number | null; image_sha256: string | null;
};
export type WikiQaItem = {
  id: string; name: string; section: string; sortOrder: number;
  fields: Record<string, unknown>; hasImage: boolean; image: string | null;
  media: ExpectedMedia;
};
export type WikiQaCollection = {
  path: string; code: string; universeId: number; pageType: 'database' | 'collectible';
  title: string; seoTitle: string; description: string; label: string;
  sectionOrder: string[]; cardFields: string[]; items: WikiQaItem[];
  metaJson: Record<string, unknown>; pageCopy: Record<string, unknown>; contentHash: string;
  pageId?: string; datasetId?: string;
};
export type WikiQaState = {
  version: 1; bundleHash: string; reviewedSourceSha: string; testHeadSha: string;
  managedQaRunId: string; predecessorArtifactId?: string; predecessorVerified?: boolean;
  runId: string; runAttempt: string; digest: string; batch: string;
  hubs: Array<{slug: string; expected: Record<string, unknown>; pageId?: string}>;
  urls: Array<{path: string; contains: string}>; collections: WikiQaCollection[];
};
