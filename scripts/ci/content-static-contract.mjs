import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assertCiContentFinal, batchPath, ownedPath, parseBatch } from "./content-contract.mjs";

// PRs validate committed bytes and path contracts. Publisher dryplans, database
// readback and browser QA remain mandatory in the selected publication jobs.
export function verifyStaticBatch(input, { tracked = file => execFileSync("git", ["ls-files", "--error-unmatch", "--", file], { stdio: "pipe" }) } = {}) {
  const file = batchPath(input);
  const base = path.dirname(file);
  const inspect = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Content bundles cannot contain symlinks.");
      if (entry.isDirectory()) inspect(name);
      else {
        if (!entry.isFile()) throw new Error("Content bundles require regular files.");
        tracked(name);
        if (name.endsWith(".json")) JSON.parse(fs.readFileSync(name, "utf8"));
      }
    }
  };
  if (fs.lstatSync(base).isSymbolicLink()) throw new Error("Content bundles cannot contain symlinks.");
  inspect(base);
  const batch = parseBatch(JSON.parse(fs.readFileSync(file, "utf8")));
  function requireInput(relative, directory = base, isDirectory = false) {
    const selected = ownedPath(directory, relative);
    if (!fs.realpathSync(selected).startsWith(`${fs.realpathSync(base)}${path.sep}`)) throw new Error("Input escapes its content bundle.");
    const stat = fs.statSync(selected);
    if (isDirectory ? !stat.isDirectory() : !stat.isFile()) throw new Error("Selected content input has the wrong type.");
    return selected;
  }
  for (const operation of batch.operations) {
    if (operation.workspace) requireInput(operation.workspace, base, true);
    if (!operation.file) continue;
    const selected = requireInput(operation.file);
    const payload = JSON.parse(fs.readFileSync(selected, "utf8"));
    if (operation.publisher === "content-final") assertCiContentFinal(payload);
    if (operation.publisher === "roblox-codes-page" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug ?? "")) throw new Error("Codes setup requires an exact reviewed editorial slug.");
    if (["roblox-collection", "franchise-collection"].includes(operation.publisher)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.game?.slug ?? "") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.collection?.slug ?? "")) throw new Error("Collection manifests require game and collection slugs.");
      requireInput(payload.dataset, path.dirname(selected));
      if (payload.finalJson) requireInput(payload.finalJson, path.dirname(selected));
    }
  }
  return batch;
}
