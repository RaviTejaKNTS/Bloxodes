#!/usr/bin/env tsx

import { supabaseAdmin } from "@/lib/supabase-admin";

const now = new Date().toISOString();

const PAGE = {
  code: "roblox-decal-ids",
  title: "Roblox Decal IDs",
  seo_title: "Roblox Decal IDs [24K+ Image Codes]",
  meta_description:
    "Find Roblox decal IDs for images, logos, memes, faces, signs, and builds. Search visual previews, creators, dates, ratings, and copy-ready decal codes.",
  intro_md:
    "Use this Roblox decal IDs catalog to find copy-ready image assets for builds, signs, thumbnails, roleplay details, and other Roblox creations. Each row is verified against Roblox data before it appears here, and the preview image comes from Roblox thumbnail services so stale or removed assets can be refreshed instead of kept as old local files.",
  how_it_works_md:
    "The decal database is collected from Roblox first. The refresh jobs discover decal assets through Roblox Creator Store search, import extra candidate IDs from older Bloxodes data and supported public lists, verify that each candidate is still a decal, refresh the thumbnail, and rank the result by Roblox signals such as votes, creator verification, source coverage, and recent availability.",
  description_json: {
    "1": "## What is a Roblox decal ID?\n\nA Roblox decal ID is the asset identifier for an uploaded image-style asset. Creators use these IDs when a Roblox experience, plugin, or Studio workflow asks for an image or decal asset. Some rows also show an image or texture ID when Roblox exposes a separate underlying image asset.",
    "2": "## Why some decals disappear\n\nRoblox assets can be renamed, moderated, made private, or fail thumbnail generation after they are first discovered. The verification job keeps inactive, private, moderated, and non-decal candidates out of the public table so this page stays useful instead of becoming a graveyard of broken IDs.",
    "3": "## How to use this page\n\nSearch by decal name, creator name, description, decal ID, or image ID. Use the copy button on the card, then paste the ID into the Roblox field that asks for a decal or image asset. Open the Roblox link when you want to inspect the source asset directly."
  },
  faq_json: [
    {
      q: "Are these Roblox decal IDs downloaded and stored by Bloxodes?",
      a: "No. The catalog stores Roblox asset metadata and thumbnail URLs, then displays images through Roblox thumbnail services. That keeps the page lighter and lets thumbnails change when Roblox updates or moderates an asset."
    },
    {
      q: "Why does a card sometimes show both Decal ID and Image ID?",
      a: "Roblox can expose a decal asset ID and a separate texture or image ID. Different Roblox workflows ask for different identifiers, so the card shows both when Roblox provides both values."
    },
    {
      q: "Can a verified decal ID stop working later?",
      a: "Yes. Roblox assets can be removed, moderated, or made private after verification. The refresh scripts re-check assets and thumbnails so broken rows can be moved out of the public catalog."
    }
  ],
  schema_ld_json: null,
  thumb_url: null,
  is_published: true,
  published_at: now,
  updated_at: now,
  description_md:
    "A refreshable Roblox decal ID catalog backed by Roblox discovery and verification scripts.",
  wiki_md: null,
  wiki_sort_order: null,
  universe_id: null
};

async function main() {
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("catalog_pages")
    .upsert(PAGE, { onConflict: "code" });

  if (error) {
    throw new Error(`Failed to seed roblox-decal-ids catalog page: ${error.message}`);
  }

  console.log("Seeded catalog_pages row for roblox-decal-ids");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
