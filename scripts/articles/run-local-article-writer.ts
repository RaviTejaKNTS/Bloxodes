// Compatibility entrypoint: local/homelab one-row jobs use the same code-controlled pipeline.
// Queue writes remain opt-in with --apply; this entrypoint never opts into publication.
import { spawn } from "node:child_process";
import path from "node:path";
const args = process.argv.slice(2);
if (args.includes("--release-completed")) throw new Error("Use the explicit batch/release command for production publication.");
const child = spawn(process.execPath, ["--import", "tsx", path.join(import.meta.dirname, "run-homelab-article-batch.ts"), ...args, "--limit", "1", "--skip-production-release"], { stdio: "inherit", env: process.env });
const stop = () => child.kill("SIGTERM");
process.once("SIGTERM", stop); process.once("SIGINT", stop);
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("close", code => { process.off("SIGTERM", stop); process.off("SIGINT", stop); process.exitCode = code ?? 1; });
