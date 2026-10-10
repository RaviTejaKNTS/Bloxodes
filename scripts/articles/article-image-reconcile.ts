import { readFile } from "node:fs/promises";
import path from "node:path";
import { classifyArticleImageSrc } from "@/lib/article-media";
import {
  articleImagePlacementHeading, checkArticleImageReadiness,
  findArticleImages, normalizeImageAlt, parseArticleImageManifest, type ArticleImageManifest,
} from "../content/article-image-readiness";
import { saveArticleControllerJson, StageFailure, type PipelineState, type Stage } from "./article-pipeline";

export function reconcileArticleImages(manifest: ArticleImageManifest, finalJson: { slug: string; content_md: string }, env?: NodeJS.ProcessEnv) {
  const reconciled = structuredClone(manifest);
  const images = findArticleImages(finalJson.content_md);
  for (const entry of reconciled.entries) {
    const src = entry.public_url?.trim();
    if (entry.status !== "verified" || !src || !classifyArticleImageSrc(src, manifest.article_slug, env).ok) continue;
    const placed = images.filter(image => image.src === src);
    if (!placed.length) continue;
    const heading = articleImagePlacementHeading(finalJson.content_md, src);
    const alt = normalizeImageAlt(placed[0]!.alt);
    if (heading && alt.length >= 8 && placed.every(image => normalizeImageAlt(image.alt) === alt)) {
      entry.placement_heading = heading;
      entry.alt = alt;
    }
  }
  return { manifest: reconciled, changed: JSON.stringify(manifest) !== JSON.stringify(reconciled),
    readiness: checkArticleImageReadiness({ manifest: reconciled, finalJson, env }) };
}

export async function reconcileWrittenArticleImages(runDir: string, state: PipelineState, stage: Stage, env?: NodeJS.ProcessEnv) {
  const workspace = path.join(runDir, "content");
  const manifest = parseArticleImageManifest(JSON.parse(await readFile(path.join(workspace, "media.json"), "utf8")));
  const finalJson = JSON.parse(await readFile(path.join(workspace, "final.json"), "utf8"));
  const result = reconcileArticleImages(manifest, finalJson, env);
  if (result.changed) {
    if (!state.ownershipInput) throw new StageFailure("Image reconciliation requires the recorded stage ownership input.");
    await saveArticleControllerJson(runDir, state, stage, state.ownershipInput, "content/media.json", result.manifest);
  }
  assertWritingImageReadiness(result.readiness);
  return result;
}

export function assertWritingImageReadiness(result: ReturnType<typeof checkArticleImageReadiness>) {
  if (!result.ready) throw new StageFailure(`Article body image readiness failed; repair final.json before publication:\n${result.errors.map(error => `- ${error}`).join("\n")}`, false, "writing");
}
