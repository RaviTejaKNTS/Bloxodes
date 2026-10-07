import { createHash } from "node:crypto";

export function decodeBundle(buffer, expectedHash) {
  if (!/^[0-9a-f]{64}$/.test(expectedHash ?? "") || buffer.length > 100 * 1024 * 1024 || createHash("sha256").update(buffer).digest("hex") !== expectedHash) throw new Error("Frozen content bundle hash or size mismatch.");
  const bundle = JSON.parse(buffer.toString("utf8"));
  if (bundle.version !== 1 || !bundle.batch || !Array.isArray(bundle.files) || !bundle.files.length || bundle.files.length > 20000) throw new Error("Invalid frozen bundle.");
  const names = new Set();
  for (const file of bundle.files) {
    if (typeof file.path !== "string" || !/^[a-zA-Z0-9_./-]+\.(json|md|png|jpg|jpeg|webp)$/.test(file.path) || file.path.split("/").some(part => !part || part === "." || part === ".." || part.startsWith(".")) || names.has(file.path) || typeof file.base64 !== "string" || Buffer.from(file.base64, "base64").length > 20 * 1024 * 1024) throw new Error("Unsafe or duplicate frozen input.");
    names.add(file.path);
  }
  if (names.has("batch.json")) throw new Error("The frozen batch owns batch.json.");
  return bundle;
}
