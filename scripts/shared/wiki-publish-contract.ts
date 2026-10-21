import fs from "node:fs/promises";
import path from "node:path";
import { bundlePath } from "./roblox-wiki-bundle";

export async function readWikiContract(folder: string): Promise<"roblox-wiki@1" | "game-wiki@1"> {
  const root = await fs.realpath(path.resolve(folder));
  const bundle = JSON.parse(await fs.readFile(await bundlePath(root, "bundle.json"), "utf8"));
  if (bundle?.contract !== "roblox-wiki@1" && bundle?.contract !== "game-wiki@1") throw new Error(`Unsupported contract ${JSON.stringify(bundle?.contract)}. Supported versions: roblox-wiki@1, game-wiki@1. See contracts/roblox-wiki/v1/ and contracts/game-wiki/v1/.`);
  return bundle.contract;
}
