import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { assertPublicationCheckout, assertProductionAncestor, PUBLICATION_RELEVANT_PATHS } from "../local-content-publication-guard";

const head = "a".repeat(40);
const deployed = "b".repeat(40);
const production = "c".repeat(40);
const checkout = {
  head, production, deployed, trackedStatus: "", headOnProduction: true, deployedOnProduction: true,
  changedFiles: [] as string[], relationship: "equal" as const
};

test("equal HEAD and deployed SHAs pass, including when origin/production is ahead", () => {
  assert.doesNotThrow(() => assertPublicationCheckout({ ...checkout, deployed: head, production: head }));
  assert.doesNotThrow(() => assertPublicationCheckout({ ...checkout, deployed: head }));
});

test("HEAD ahead of the deployed SHA passes with docs-only differences", () => {
  assert.doesNotThrow(() => assertPublicationCheckout({ ...checkout, relationship: "ahead", changedFiles: ["bloxodes-docs/content/roblox-wiki.md", "AGENTS.md"] }));
});

test("HEAD ahead with apps/web differences names the files and requires waiting for deploy", () => {
  assert.throws(() => assertPublicationCheckout({ ...checkout, relationship: "ahead", changedFiles: ["apps/web/src/app/page.tsx"] }), /apps\/web\/src\/app\/page\.tsx\nHEAD is ahead.*Wait for the deploy/);
});

test("HEAD behind the deployed SHA passes with harmless differences", () => {
  assert.doesNotThrow(() => assertPublicationCheckout({ ...checkout, relationship: "behind", changedFiles: ["README.md", ".agents/skills/example/SKILL.md"] }));
});

test("HEAD behind with contract differences names the files and requires a pull", () => {
  assert.throws(() => assertPublicationCheckout({ ...checkout, relationship: "behind", changedFiles: ["contracts/roblox-wiki/v1/schema.ts"] }), /contracts\/roblox-wiki\/v1\/schema\.ts\nHEAD is behind.*Pull origin\/production/);
});

test("every publish-relevant directory and root package file blocks a SHA difference", () => {
  for (const prefix of PUBLICATION_RELEVANT_PATHS) {
    const file = prefix.endsWith("/") ? `${prefix}example.ts` : prefix;
    assert.throws(() => assertPublicationCheckout({ ...checkout, relationship: "ahead", changedFiles: [file] }), error => error instanceof Error && error.message.includes(file));
  }
  assert.doesNotThrow(() => assertPublicationCheckout({ ...checkout, relationship: "ahead", changedFiles: ["apps/web-other/example.ts", "contracts-old/schema.ts", "package.json.bak", "nested/package.json"] }));
});

test("publisher dependencies outside the content scripts also block a SHA difference", () => {
  for (const file of ["scripts/ops/release-production-schema.ts", "scripts/ops/studio-container-psql.mjs", "scripts/ci/migration-transaction.mjs", "tsconfig.json", "env/config.json", "supabase/migration-policy.json"]) {
    assert.throws(() => assertPublicationCheckout({ ...checkout, relationship: "ahead", changedFiles: [file] }), error => error instanceof Error && error.message.includes(file));
  }
});

test("modified and staged tracked files fail even with matching SHAs", () => {
  for (const trackedStatus of [" M README.md", "M  README.md", "A  draft.md", "D  package.json"]) {
    assert.throws(() => assertPublicationCheckout({ ...checkout, deployed: head, trackedStatus }), /Commit or restore tracked changes/);
  }
});

test("HEAD outside origin/production fails with actionable guidance", () => {
  assert.throws(() => assertPublicationCheckout({ ...checkout, headOnProduction: false }), /HEAD must be an ancestor.*pull/);
  assert.throws(() => assertProductionAncestor(head, "unknown", true));
  assert.throws(() => assertPublicationCheckout({ ...checkout, head: "unknown" }));
});

test("a deployed SHA outside origin/production or an invalid SHA fails", () => {
  assert.throws(() => assertPublicationCheckout({ ...checkout, deployedOnProduction: false }), /healthy deployed SHA must be an ancestor.*Wait/);
  assert.throws(() => assertPublicationCheckout({ ...checkout, deployed: "unknown" }));
});

test("merged histories with harmless differences pass, while relevant differences require pull and deploy", () => {
  assert.doesNotThrow(() => assertPublicationCheckout({ ...checkout, relationship: "diverged", changedFiles: ["README.md"] }));
  assert.throws(() => assertPublicationCheckout({ ...checkout, relationship: "diverged", changedFiles: ["package.json"] }), /Pull origin\/production and wait for the deploy/);
});

// These subprocess fixtures replace all command and network access. GitHub runs them without credentials.
function runLocalGuard(options: { changedFiles?: string[]; trackedStatus?: string; ledgerFails?: boolean; behind?: boolean; headOffProduction?: boolean; deployedOffProduction?: boolean } = {}) {
  const fixture = { head, deployed, production, ...options };
  const script = `
    import childProcess from "node:child_process";
    import { syncBuiltinESMExports } from "node:module";
    const { assertLocalContentPublication } = await import("./scripts/shared/local-content-publication-guard.ts");
    const fixture = ${JSON.stringify(fixture)};
    const calls = [];
    childProcess.execFileSync = (command, args) => {
      calls.push([command === process.execPath ? "node" : command, ...args]);
      if (command === "git") {
        if (args[0] === "fetch") return "";
        if (args[0] === "rev-parse") return args[1] === "HEAD" ? fixture.head : fixture.production;
        if (args[0] === "merge-base") {
          if (args[3] === fixture.production) {
            if ((args[2] === fixture.head && fixture.headOffProduction) || (args[2] === fixture.deployed && fixture.deployedOffProduction)) throw new Error("Not an ancestor");
            return "";
          }
          if (args[2] === (fixture.behind ? fixture.head : fixture.deployed)) return "";
          throw new Error("Not an ancestor");
        }
        if (args[0] === "diff") return (fixture.changedFiles ?? []).join("\\0");
        if (args[0] === "status") return args.includes("--untracked-files=no") ? fixture.trackedStatus ?? "" : "?? notes.txt";
      }
      if (command === process.execPath && args.includes("scripts/ops/release-production-schema.ts") && args.includes("--check-ledger") && !args.includes("--apply")) {
        if (fixture.ledgerFails) throw new Error("Pending migration");
        return "";
      }
      throw new Error("Unexpected command");
    };
    syncBuiltinESMExports();
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, build: { sha: fixture.deployed } }));
    try { console.log(JSON.stringify({ head: await assertLocalContentPublication(), calls })); }
    catch (error) { console.log(JSON.stringify({ error: error.message, calls })); }
  `;
  return JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], { encoding: "utf8" })) as { head?: string; error?: string; calls: string[][] };
}

test("local guard ignores untracked files, fetches production, checks both ancestors and runs the read-only ledger", () => {
  const result = runLocalGuard({ changedFiles: ["README.md"] });
  assert.equal(result.head, head);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.calls[0], ["git", "fetch", "origin", "refs/heads/production:refs/remotes/origin/production"]);
  assert.ok(result.calls.some(call => JSON.stringify(call) === JSON.stringify(["git", "merge-base", "--is-ancestor", head, production])));
  assert.ok(result.calls.some(call => JSON.stringify(call) === JSON.stringify(["git", "merge-base", "--is-ancestor", deployed, production])));
  assert.ok(result.calls.some(call => call[1] === "status" && call.includes("--untracked-files=no")));
  const diff = result.calls.find(call => call[1] === "diff")!;
  assert.ok(diff.includes("--no-renames"));
  assert.ok(diff.includes("-z"));
  assert.deepEqual(diff.slice(-3), [deployed, head, "--"]);
  assert.deepEqual(result.calls.at(-1), ["node", "--import", "tsx", "scripts/ops/release-production-schema.ts", "--approved-sha", head, "--check-ledger", "--transport", "studio", "--database-role", "supabase_admin"]);
  assert.ok(result.calls.every(call => call[0] === "node" || ["fetch", "rev-parse", "merge-base", "diff", "status"].includes(call[1])));
});

test("local guard fails before the ledger for tracked changes or relevant SHA differences", () => {
  for (const options of [{ trackedStatus: " M README.md" }, { changedFiles: ["apps/web/page.tsx"] }, { changedFiles: ["contracts/schema.ts"], behind: true }]) {
    const result = runLocalGuard(options);
    assert.ok(result.error);
    assert.ok(result.calls.every(call => call[0] === "git"));
  }
});

test("local guard still refuses pending or unreadable production schema ledgers", () => {
  assert.match(runLocalGuard({ ledgerFails: true }).error!, /Production migration ledger is not ready/);
});

test("local guard rejects off-production history before diffing a possibly missing commit", () => {
  for (const options of [{ headOffProduction: true }, { deployedOffProduction: true }]) {
    const result = runLocalGuard(options);
    assert.match(result.error!, /must be an ancestor of origin\/production/);
    assert.ok(result.calls.every(call => call[1] !== "diff" && call[0] === "git"));
  }
});

test("ledger-only schema checks allow untracked files while schema release keeps its clean-tree rule", () => {
  const script = `
    import childProcess from "node:child_process";
    import { syncBuiltinESMExports } from "node:module";
    import fs from "node:fs";
    childProcess.execFileSync = (command, args) => {
      if (command !== "git") throw new Error("Unexpected command");
      if (args[0] === "rev-parse") return "${head}";
      if (args[0] === "status") return args.includes("--untracked-files=no") ? "" : "?? notes.txt";
      if (args[0] === "merge-base") return "";
      throw new Error("Unexpected git command");
    };
    childProcess.spawnSync = (command, args, options) => {
      if (command !== process.execPath || !args[0].endsWith("studio-container-psql.mjs") || options.input !== "select version from supabase_migrations.schema_migrations order by version;") throw new Error("Unexpected SQL command");
      const versions = fs.readdirSync("supabase/migrations").filter(file => file.endsWith(".sql")).map(file => file.split("_")[0]);
      return { status: 0, stdout: versions.join("\\n"), stderr: "" };
    };
    syncBuiltinESMExports();
  `;
  const args = ["--import", "tsx", "--import", `data:text/javascript,${encodeURIComponent(script)}`, "scripts/ops/release-production-schema.ts", "--approved-sha", head, "--transport", "studio", "--database-role", "supabase_admin"];
  const options = { encoding: "utf8" as const, env: { ...process.env, BLOXODES_ENV_PROFILE: "process-only", BLOXODES_ENV_OVERLAYS: "", SUPABASE_URL: "https://database.bloxodes.com" }, stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"] };
  assert.match(execFileSync(process.execPath, [...args, "--check-ledger"], options), /Production migration ledger is ready/);
  assert.throws(() => execFileSync(process.execPath, args, options), error => error instanceof Error && "stderr" in error && String(error.stderr).includes("checkout is dirty"));
});
