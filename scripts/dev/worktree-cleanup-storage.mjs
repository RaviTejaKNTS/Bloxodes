import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { existing, git } from "./worktree-storage.mjs";

async function hash(file) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}

export async function inspectPrivatePaths(root, main) {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.name === ".env" || entry.name === ".envs" || entry.name.startsWith(".env.")) {
      const file = path.join(root, entry.name);
      if (!entry.isSymbolicLink() || entry.name !== ".envs" || await fs.realpath(file) !== await fs.realpath(path.join(main, ".envs"))) {
        throw new Error(`Keep this task intact and preserve its checkout-owned env storage first: ${file}`);
      }
    }
  }
  // Refuse unknown ignored data outside tmp instead of assuming it is disposable.
  const ignored = git(root, "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z").split("\0").filter(Boolean);
  const disposable = /^(node_modules\/|apps\/(web|mobile)\/node_modules\/|apps\/web\/\.next(?:-[^/]*)?(?:\/|$)|apps\/(?:extension|admin-extension)\/dist\/|apps\/mobile\/(?:\.expo|dist)\/|(?:\.npm|\.cache|\.expo-home|coverage|test-results|playwright-report)\/|(?:apps\/web\/)?[^/]*\.tsbuildinfo$|\.DS_Store$|\.eslintcache$)/;
  for (const name of ignored) {
    if (name === ".envs" || name.startsWith("tmp/") || disposable.test(name)) continue;
    throw new Error(`Preserve ignored data outside task scratch before cleanup: ${name}`);
  }
}

export async function assertNoContentClaims(main, target) {
  const directory = path.join(main, "tmp/content-claims");
  if (!await existing(directory)) return;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const claim = JSON.parse(await fs.readFile(path.join(directory, entry.name), "utf8"));
    if (claim.worktree === target) throw new Error(`Release the shared content claim before cleanup: ${entry.name}`);
  }
}

export async function archiveScratch(source, archive) {
  if (!await existing(source)) return;
  const excluded = new Set(["node_modules", ".next", "node-compile-cache", "tsx-1000", "test-reports", "content-claims", "worktree-reference"]);
  const manifest = [];
  async function copy(folder, output) {
    await fs.mkdir(output, { recursive: true, mode: 0o700 });
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const input = path.join(folder, entry.name);
      const destination = path.join(output, entry.name);
      if (entry.isSymbolicLink()) {
        manifest.push({ path: path.relative(source, input), symlink: await fs.readlink(input) });
      } else if (entry.isDirectory()) await copy(input, destination);
      else if (entry.isFile()) {
        await fs.copyFile(input, destination, fs.constants.COPYFILE_EXCL);
        await fs.chmod(destination, 0o600);
        const original = await hash(input);
        if (original !== await hash(destination)) throw new Error(`Archive readback mismatch: ${input}`);
        manifest.push({ path: path.relative(source, input), sha256: original });
      } else throw new Error(`Keep the task intact until its special file is handled: ${input}`);
    }
  }
  await copy(source, path.join(archive, "tmp"));
  await fs.writeFile(path.join(archive, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}
