import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  assertArticleImageReadiness,
  checkArticleImageReadiness,
  readArticleImageManifest,
} from "./article-image-readiness";

type ArticleFinal = { slug: string; content_md: string };

function valueAfter(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`Missing value for ${option}`);
  return value;
}

async function main() {
  const argv = process.argv.slice(2);
  let manifestPath = "";
  let finalPath = "";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") {
      manifestPath = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === "--file") {
      finalPath = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npm run check:article-image-readiness -- --manifest <media.json> --file <final.json>"
      );
      return;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!manifestPath) throw new Error("--manifest is required");
  if (!finalPath) throw new Error("--file is required");

  const manifest = await readArticleImageManifest(manifestPath);
  const finalJson = JSON.parse(
    await readFile(path.resolve(process.cwd(), finalPath), "utf8")
  ) as ArticleFinal;
  if (!finalJson?.slug || !finalJson?.content_md) {
    throw new Error(`${finalPath} must contain slug and content_md`);
  }

  const result = checkArticleImageReadiness({ manifest, finalJson });
  const summary = result.summary;
  console.log(
    `Article image readiness: expected=${summary.expected} verified=${summary.verified} uploaded=${summary.uploaded} inserted=${summary.inserted} missing=${summary.missing} accepted_missing=${summary.acceptedMissing}`
  );
  assertArticleImageReadiness(result, manifestPath);
  console.log("Article image readiness passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
