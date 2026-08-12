import assert from "node:assert/strict";
import test from "node:test";

import {
  checkArticleImageReadiness,
  type ArticleImageManifest,
} from "../article-image-readiness";

const manifest: ArticleImageManifest = {
  schema: 1,
  article_slug: "lineage-piece-orihime-reiatsu-locations",
  visual_type: "locations",
  required: true,
  expected_count: 2,
  entries: [
    {
      id: "jujutsu-high-school",
      label: "Jujutsu High School",
      placement_heading: "Jujutsu High School",
      status: "verified",
      source_page_url: "https://lineage-piece.example/wiki/Jujutsu_High_School",
      original_image_url: "https://images.example/jujutsu-high.png",
      match_evidence: "The wiki caption and nearby heading identify the school landmark.",
      rights_note: "Wiki media with source attribution recorded.",
      alt: "Orihime Reiatsu at Jujutsu High School",
      uploaded_path:
        "articles/lineage-piece-orihime-reiatsu-locations/sources/jujutsu-high-school-a1b2c3.webp",
      public_url:
        "https://media.bloxodes.com/storage/v1/object/public/media/articles/lineage-piece-orihime-reiatsu-locations/sources/jujutsu-high-school-a1b2c3.webp",
      width: 1280,
      height: 720,
    },
    {
      id: "scorched-ruins",
      label: "Scorched Ruins",
      placement_heading: "Scorched Ruins",
      status: "verified",
      source_page_url: "https://lineage-piece.example/wiki/Scorched_Ruins",
      original_image_url: "https://images.example/scorched-ruins.png",
      match_evidence: "The location page labels the ruins and shows the matching structure.",
      rights_note: "Wiki media with source attribution recorded.",
      alt: "Orihime Reiatsu beside the Scorched Ruins",
      uploaded_path:
        "articles/lineage-piece-orihime-reiatsu-locations/sources/scorched-ruins-d4e5f6.webp",
      public_url:
        "https://media.bloxodes.com/storage/v1/object/public/media/articles/lineage-piece-orihime-reiatsu-locations/sources/scorched-ruins-d4e5f6.webp",
      width: 1280,
      height: 720,
    },
  ],
};

function contentFor(input: ArticleImageManifest): string {
  return input.entries
    .map(
      (entry) =>
        `### ${entry.placement_heading}\n\nWalk to the marked area.\n\n![${entry.alt}](${entry.public_url})`
    )
    .join("\n\n");
}

test("passes a complete exact-match location image set", () => {
  const result = checkArticleImageReadiness({
    manifest,
    finalJson: { slug: manifest.article_slug, content_md: contentFor(manifest) },
  });

  assert.equal(result.ready, true);
  assert.deepEqual(result.summary, {
    expected: 2,
    verified: 2,
    uploaded: 2,
    inserted: 2,
    missing: 0,
    acceptedMissing: 0,
  });
});

test("fails when a required location is still missing", () => {
  const missingManifest = structuredClone(manifest);
  missingManifest.entries[1] = {
    id: "scorched-ruins",
    label: "Scorched Ruins",
    placement_heading: "Scorched Ruins",
    status: "missing",
    missing_reason: "No exact-match image found after documented source fan-out.",
  };

  const result = checkArticleImageReadiness({
    manifest: missingManifest,
    finalJson: { slug: manifest.article_slug, content_md: contentFor(manifest) },
  });

  assert.equal(result.ready, false);
  assert.match(result.errors.join("\n"), /required visual is still missing/);
});

test("fails when an image is placed under the wrong location", () => {
  const content = `### Jujutsu High School\n\n![${manifest.entries[0]!.alt}](${manifest.entries[0]!.public_url})\n\n![${manifest.entries[1]!.alt}](${manifest.entries[1]!.public_url})\n\n### Scorched Ruins\n\nWalk to the ruins.`;
  const result = checkArticleImageReadiness({
    manifest,
    finalJson: { slug: manifest.article_slug, content_md: content },
  });

  assert.equal(result.ready, false);
  assert.match(result.errors.join("\n"), /image is not inside its Scorched Ruins section/);
});

test("allows an explicitly accepted missing visual", () => {
  const acceptedManifest = structuredClone(manifest);
  acceptedManifest.entries[1] = {
    id: "scorched-ruins",
    label: "Scorched Ruins",
    placement_heading: "Scorched Ruins",
    status: "accepted_missing",
    missing_reason: "No exact-match clean source image was found after wiki and guide searches.",
    acceptance_note: "Parent approved prose-only coverage for this one location.",
  };
  const result = checkArticleImageReadiness({
    manifest: acceptedManifest,
    finalJson: {
      slug: manifest.article_slug,
      content_md: `### Jujutsu High School\n\n![${manifest.entries[0]!.alt}](${manifest.entries[0]!.public_url})\n\n### Scorched Ruins\n\nWalk to the ruins.`,
    },
  });

  assert.equal(result.ready, true);
  assert.equal(result.summary.acceptedMissing, 1);
});
