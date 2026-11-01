/** Preserve browser keys used before the shared game renderer. */
export function gameCollectionProgressOptions(namespace: string) {
  return { endpoint: `/api/games/${namespace}/collections/progress`, requestKey: "code", storageKeyPrefix: `${namespace}-collection:`, eventName: `${namespace}-collection-progress`, analyticsPrefix: `${namespace.replaceAll("-", "_")}_collection` };
}
