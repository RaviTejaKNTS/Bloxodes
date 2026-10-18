import path from "node:path";
import fs from "node:fs/promises";
import { git } from "./worktree-storage.mjs";

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
