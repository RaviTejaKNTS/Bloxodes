import { mapPublishConcurrent, retryPublishNetwork } from "./publish-network.mjs";

type ImageIdentity = {
  namespace: string;
  mediaPrefix: string;
  gameSlug: string;
  collectionSlug: string;
  itemSlug: string;
  hash: string;
  extension: string;
};

export function collectionImageKey(image: ImageIdentity): string {
  const prefix = `${image.mediaPrefix}/${image.gameSlug}/${image.collectionSlug}`;
  if (image.namespace === "minecraft") {
    if (!/^[a-f0-9]{64}$/.test(image.hash) || !/^(png|jpg|webp|avif|gif)$/.test(image.extension)) {
      throw new Error("Minecraft media requires an exact SHA-256 and safe image extension.");
    }
    return `${prefix}/${image.hash}.${image.extension}`;
  }
  return `${prefix}/${image.itemSlug}-${image.hash.slice(0, 16)}.${image.extension}`;
}

type MediaItem = {
  image_key: string | null;
  image_mime: string | null;
  image_sha256: string | null;
  image_width: number | null;
  image_height: number | null;
  prepared_image: Uint8Array | null;
};

type MediaStore = {
  handlesRetries?: boolean;
  hasObject(key: string): Promise<boolean>;
  putObject(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    metadata: Record<string, string | number>;
  }): Promise<unknown>;
};

async function visitImages(items: MediaItem[], confirmedKeys: Set<string> | undefined, visit: (item: MediaItem) => Promise<void>, concurrency: number, store: MediaStore, label: string) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("Media concurrency must be an integer from 1 to 8.");
  // Minecraft keeps its invocation cache. Other namespaces still verify every row.
  const pending = confirmedKeys
    ? [...new Map(items.filter(item => item.image_key && !confirmedKeys.has(item.image_key)).map(item => [item.image_key, item])).values()]
    : items.filter(item => item.image_key);
  await mapPublishConcurrent(pending, item => store.handlesRetries ? visit(item) : retryPublishNetwork(() => visit(item)), { concurrency, label });
}

// The caller supplies this invocation-scoped cache only for Minecraft.
export async function uploadCollectionImages(items: MediaItem[], store: MediaStore, confirmedKeys?: Set<string>, concurrency = 8) {
  await visitImages(items, confirmedKeys, async item => {
    if (!item.image_key || !item.image_mime || !item.image_sha256 || !item.prepared_image) return;
    if (confirmedKeys?.has(item.image_key)) return;
    if (!(await store.hasObject(item.image_key))) {
      await store.putObject({
        key: item.image_key,
        body: item.prepared_image,
        contentType: item.image_mime,
        metadata: { width: item.image_width ?? 0, height: item.image_height ?? 0, sha256: item.image_sha256 }
      });
    }
    confirmedKeys?.add(item.image_key);
  }, concurrency, store, "upload images");
}

export async function verifyCollectionImages(items: MediaItem[], store: MediaStore, code: string, confirmedKeys?: Set<string>, concurrency = 8) {
  await visitImages(items, confirmedKeys, async item => {
    if (!item.image_key || confirmedKeys?.has(item.image_key)) return;
    if (!(await store.hasObject(item.image_key))) throw new Error(`Missing R2 image for ${code}/${item.image_key}.`);
    confirmedKeys?.add(item.image_key);
  }, concurrency, store, `${code} verify images`);
}
