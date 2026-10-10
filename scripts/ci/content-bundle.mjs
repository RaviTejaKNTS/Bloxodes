import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

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

export async function folderInputs(directory, destination) {
  const inputs = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Frozen workspaces cannot contain symlinks.");
    if (entry.isDirectory()) inputs.push(...await folderInputs(source, `${destination}/${entry.name}`));
    else if (/\.(json|md|png|jpg|jpeg|webp)$/.test(entry.name) && !/^(session|logs?|receipt|history)/.test(entry.name)) inputs.push({ source, destination: `${destination}/${entry.name}` });
  }
  return inputs;
}

// A files-only bundle loses an empty media directory. Recreate the selected
// manifest's declared directory without changing approved files or sync guards.
export async function extractBundle(bundle, base) {
  const mediaDirectories = [];
  for (const operation of bundle.batch.operations ?? []) {
    if (operation.publisher !== "roblox-collection") continue;
    const file = bundle.files.find(file => file.path === operation.file);
    if (!file) throw new Error("Selected collection manifest is missing from the bundle.");
    const manifest = JSON.parse(Buffer.from(file.base64, "base64").toString("utf8"));
    if (typeof manifest.mediaRoot !== "string" || !/^[a-zA-Z0-9_/-]+$/.test(manifest.mediaRoot) || manifest.mediaRoot.split("/").some(part => !part || part === "." || part === "..") || path.isAbsolute(manifest.mediaRoot)) throw new Error("Unsafe frozen collection media directory.");
    const directory = path.join(path.dirname(file.path), manifest.mediaRoot);
    if (bundle.files.some(file => file.path === directory || directory.startsWith(`${file.path}/`))) throw new Error("Frozen media directory conflicts with a file.");
    mediaDirectories.push(directory);
  }
  await fs.mkdir(base); // Refuse any retained destination, including symlinks.
  for (const directory of mediaDirectories) await fs.mkdir(path.join(base, directory), { recursive: true });
  for (const file of bundle.files) {
    const destination = path.join(base, file.path);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, Buffer.from(file.base64, "base64"), { flag: "wx" });
  }
  await fs.writeFile(path.join(base, "batch.json"), JSON.stringify(bundle.batch), { flag: "wx" });
}
