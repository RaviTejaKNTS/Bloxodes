import path from "node:path";

export function imageLocalPath(value: string, datasetPath: string): string | null {
  if (/^https?:\/\//i.test(value)) return null;
  const withoutQuery = value.split("?")[0] ?? value;
  const decoded = decodeURIComponent(withoutQuery.replace(/^\/+/, ""));
  const mediaRoot = path.resolve(path.dirname(datasetPath), "media");
  const mediaRelative = decoded.replace(/^media\//, "");
  const resolved = path.resolve(mediaRoot, mediaRelative);
  const relative = path.relative(mediaRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}
