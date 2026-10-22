// Shared by the CLI and both publishers. Kept separate so importing a
// publisher's types doesn't pull the CLI's dynamic imports into other builds.
export type ContentOptions = {
  command: "publish" | "status" | "candidates" | "deployed-sha";
  target: "managed-dev" | "production";
  apply: boolean;
  allowProd: boolean;
  bundle?: string;
  game?: string;
  namespace?: string;
  kind?: "game" | "franchise";
  only?: string[];
  approvedHubCoverSha256?: string;
};

export function parseContentOptions(argv: string[]): ContentOptions {
  const command = argv[0];
  if (command !== "publish" && command !== "status" && command !== "candidates" && command !== "deployed-sha") {
    throw new Error("Expected publish, status, candidates or deployed-sha.");
  }
  const options: ContentOptions = { command, target: "managed-dev", apply: false, allowProd: false };
  const seen = new Set<string>();
  for (let index = 1; index < argv.length; index += 1) {
    const raw = argv[index];
    const [flag, inline] = raw.split(/=(.*)/s, 2);
    if (!raw.startsWith("--")) {
      if (command !== "publish" || options.bundle) throw new Error(`Unexpected argument: ${raw}`);
      options.bundle = raw;
      continue;
    }
    if (seen.has(flag) && flag !== "--only") throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--apply" || flag === "--allow-prod") {
      if (inline !== undefined) throw new Error(`${flag} takes no value.`);
      if (flag === "--apply") options.apply = true;
      else options.allowProd = true;
      continue;
    }
    if (!["--target", "--bundle", "--game", "--namespace", "--kind", "--only", "--approved-hub-cover-sha256"].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = inline ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value.`);
    if (flag === "--only") {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error("--only must be hub or a collection slug.");
      (options.only ??= []).push(value);
    } else if (flag === "--target") {
      if (value !== "managed-dev" && value !== "production") throw new Error("--target must be managed-dev or production.");
      options.target = value;
    } else if (flag === "--approved-hub-cover-sha256") options.approvedHubCoverSha256 = value;
    else if (flag === "--bundle") {
      if (options.bundle) throw new Error("Supply one bundle folder.");
      options.bundle = value;
    } else if (flag === "--namespace") options.namespace = value;
    else if (flag === "--kind") {
      if (value !== "game" && value !== "franchise") throw new Error("--kind must be game or franchise.");
      options.kind = value;
    } else options.game = value;
  }
  assertApprovedHubCoverOption(options);
  if (command === "publish" && !options.bundle) throw new Error("Supply a bundle folder, for example: npm run content:publish -- /path/to/game-bundle");
  if (command !== "publish" && (options.bundle || options.apply || options.allowProd || options.only)) throw new Error(`${command} is read-only; bundle, --only and apply flags are invalid.`);
  if (command === "deployed-sha" && seen.size) throw new Error("deployed-sha takes no options.");
  if (command === "status" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.game ?? "")) throw new Error("status requires --game <editorial-slug>.");
  if (command !== "status" && options.game) throw new Error("--game is only valid for status. Publish identity belongs in bundle.json.");
  if (options.namespace && (command !== "status" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.namespace))) throw new Error("--namespace requires status and a valid non-Roblox namespace.");
  if (options.kind && (command !== "status" || !options.namespace)) throw new Error("--kind requires franchise status with --namespace.");
  if (options.namespace === "roblox") throw new Error("Omit --namespace for Roblox status.");
  if (options.allowProd && (!options.apply || options.target !== "production")) throw new Error("--allow-prod requires --target production --apply.");
  if (options.apply && options.target === "production" && !options.allowProd) throw new Error("Production apply requires --allow-prod.");
  return options;
}

function assertApprovedHubCoverOption(options: ContentOptions) {
  if (options.approvedHubCoverSha256 === undefined) return;
  if (options.approvedHubCoverSha256.length !== 64 || !/^[a-f0-9]{64}$/i.test(options.approvedHubCoverSha256)) throw new Error("--approved-hub-cover-sha256 must be exactly 64 hexadecimal characters.");
  if (options.command !== "publish") throw new Error("--approved-hub-cover-sha256 is only valid for publish.");
  if (options.only?.length && !options.only.includes("hub")) throw new Error("--approved-hub-cover-sha256 requires a selected hub; include --only hub.");
}

// Check the resolved selection before any publisher reads or writes target data.
export function assertApprovedHubCoverScope(options: ContentOptions, contract: string, hub?: { coverImage?: string }) {
  assertApprovedHubCoverOption(options);
  if (options.approvedHubCoverSha256 === undefined) return;
  if (contract !== "roblox-wiki@1") throw new Error("--approved-hub-cover-sha256 is only valid for Roblox hub publication, not franchise bundles.");
  if (!hub?.coverImage) throw new Error("--approved-hub-cover-sha256 requires a selected Roblox hub with an explicit local hub.coverImage path.");
}
