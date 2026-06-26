/**
 * LOCAL-ONLY: rewrite the `catalog_pages` content for `roblox-decal-ids` to
 * match the depth/tone of the music IDs page, focused on decal-ID substance.
 * Refuses to run against a non-local Supabase URL.
 * Run: tsx scripts/dev/update-decal-catalog-content-local.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const localEnv = parseDotenv(fs.readFileSync(path.join(repoRoot, ".env.local")));

const CODE = "roblox-decal-ids";
const base = localEnv.SUPABASE_URL!;
const key = localEnv.SUPABASE_SERVICE_ROLE!;

if (!["localhost", "127.0.0.1", "::1"].includes(new URL(base).hostname)) {
  throw new Error(`Refusing to edit non-local Supabase: ${base}`);
}

const intro_md = `Bloxodes' Roblox decal IDs catalog is a large, verified collection of image asset codes you can drop straight into builds, signs, spray-paint art, roleplay scenes, and game UI. A decal ID is just a number, so once you find art you like, copy it and paste it into any Roblox game or Studio property that accepts a custom image.

Every entry is checked against live Roblox data before it appears, and previews load from Roblox thumbnail services, so moderated or removed assets get filtered out instead of lingering as broken codes. Search by decal name, creator, or ID, then grab the code with one click.

Looking for audio instead of images? Browse our [Roblox music IDs](https://bloxodes.com/catalog/roblox-music-ids) catalog.`;

const description_json: Record<string, string> = {
  "1": `## What is a Roblox decal ID?

A **decal** is an image that has been uploaded to Roblox as a reusable asset. When a creator uploads a picture, Roblox stores it and assigns it a **decal ID**, a unique number that points to that exact image.

Any Roblox experience or Studio property that accepts a custom image can load a decal from its ID. You do not need the original picture file; the number is enough. That is what makes decal IDs so useful: a single code can place the same artwork on a wall, a sign, a billboard, a piece of UI, or a spray-paint canvas.

A decal ID is always a number, and it only works where custom images are allowed. If a game or property does not accept image input, pasting an ID will do nothing.`,
  "2": `## Decal ID vs image ID: which number do you paste?

Roblox actually creates two linked assets when an image is uploaded:

- The **decal ID** is the public catalog ID you see in a decal's URL.
- The **image ID** (also called the texture or asset ID) is the underlying image the decal points to.

In most modern workflows you can paste the **decal ID** directly. Drop it into a \`Decal\` object's **Texture** property in Studio and Roblox resolves it to the underlying image automatically. Some older games and scripts, however, expect the **image ID** instead, which is why a card may list both numbers. If a decal refuses to load with one number, try the other; the image ID is usually within a digit or two of the decal ID.

Not sure which kind of ID you are holding, or want to pull the number out of a Roblox link? Paste it into the [Roblox ID Extractor](https://bloxodes.com/tools/roblox-id-extractor) and it will tell you exactly what the asset is.`,
  "3": `## Where Roblox decal IDs are used

Decal IDs show up anywhere Roblox lets you supply your own image. The most common places are:

- **Spray-paint and art games:** titles like Spray Paint!, Free Draw, and Starving Artists let you paste a decal ID to display an image on a canvas or wall.
- **Build and roleplay games:** signs, posters, picture frames, billboards, and shop displays that accept a custom image.
- **Roblox Studio builds:** \`Decal\` objects on parts, plus \`ImageLabel\`, \`ImageButton\`, and \`SurfaceGui\` image properties.
- **Menus and UI:** custom icons, logos, and backgrounds inside a game's interface.

Support always depends on the game. If an experience does not include a decal or image input, custom decals will not appear there, even with a valid ID. Matching your decals to the right build colors? Our [Roblox color codes](https://bloxodes.com/catalog/roblox-color-codes) catalog covers that side.`,
  "4": `## How to use a Roblox decal ID

**In a game that supports custom images:**

1. Join an experience with a decal, spray-paint, or image input, such as an art or build game.
2. Open the image, spray, or decal menu.
3. Copy a decal ID from this catalog.
4. Paste the ID into the input box and confirm.
5. The image loads if the ID is valid and the game allows that asset.

**In Roblox Studio:**

1. Select the part, surface, or UI element you want to decorate.
2. Insert a \`Decal\` for parts, or use an \`ImageLabel\` / \`ImageButton\` for UI.
3. Paste the decal ID into the **Texture** or **Image** property.
4. If it does not appear, swap in the image ID instead, or check that the asset is still public.`,
  "5": `## How to upload your own decal and find its ID

Want to use your own artwork? You can turn any picture into a decal:

1. Save your image as a **PNG** at a clean resolution such as 512×512 or 1024×1024. PNG keeps transparent backgrounds, while JPG does not.
2. Go to the **Creator Dashboard** at create.roblox.com and sign in.
3. Open **Creations → Decals**, click **Upload**, and confirm the asset type is Decal.
4. Wait for Roblox to moderate the upload. This usually takes a few minutes but can take longer.
5. Once approved, open the decal and copy its **Asset ID** from the three-dot menu. That number is your decal ID.

Every image you upload is reviewed by Roblox moderation, so only use art you are allowed to share.`,
  "6": `## Why a decal ID might not work (and how to fix it)

A blank, gray, or checkerboard image usually does not mean the catalog is wrong. It almost always points to something about the asset or the game. Common causes:

- The image was **moderated or removed** by Roblox after it was uploaded.
- The creator **deleted the asset or made it private**.
- The game **does not allow custom decals**, or runs its own content filter.
- You pasted the **wrong ID type**, so try the image ID instead of the decal ID.
- The asset is **still loading**, which is common on mobile or slow connections.

Quick things to try:

1. Copy and paste the ID again to rule out a typo.
2. Switch between the decal ID and the image ID.
3. Test the decal in a different game that supports custom images.
4. Confirm the asset still opens on Roblox and has not been taken down.
5. If nothing works, pick another decal from the catalog.`
};

const how_it_works_md = `## Decal moderation, safety, and copyright

Every image on Roblox passes through automatic and human moderation, both when it is uploaded and sometimes again later. That is why a decal that worked yesterday can turn into a gray placeholder today: if an asset is flagged, Roblox replaces it everywhere it is used.

A few things worth keeping in mind:

- **Use art you have the rights to.** Uploading copyrighted or inappropriate images can get the asset, and sometimes your account, moderated.
- **Availability is never guaranteed.** Even a verified decal can be pulled by Roblox or its creator at any time.
- **Some assets work in one game but not another**, because experiences can apply their own stricter image filters on top of Roblox moderation.

To keep this catalog useful rather than a list of dead links, Bloxodes re-checks decal assets and thumbnails against Roblox and filters out IDs that have been moderated, hidden, or removed.`;

const faq_json = [
  {
    q: "How do I use a Roblox decal ID in a game?",
    a: "Find a game that supports custom images, such as a spray-paint, art, or build game, then open its image or decal menu, paste the ID into the input box, and confirm. The image appears if the ID is valid and the game allows that asset. If a game has no image input, decals will not work there."
  },
  {
    q: "What's the difference between a decal ID and an image ID?",
    a: "The decal ID is the public catalog ID you see in a decal's URL. The image ID (also called the texture or asset ID) is the underlying image it points to. Pasting the decal ID works in most modern workflows, but some older games and scripts expect the image ID instead, which is why a card may show both. If one number does not load, try the other."
  },
  {
    q: "How do I get a decal ID from a Roblox image or link?",
    a: "Open the decal on Roblox and copy the number from its URL, or copy the Asset ID from the three-dot menu in the Creator Dashboard. The number in the link is the decal ID you paste into a game or Studio property."
  },
  {
    q: "Why does my decal show up as a gray checkerboard?",
    a: "That placeholder means the image is not available. Usually it was moderated, deleted, or made private, or you used the wrong ID type. Try the image ID instead of the decal ID, confirm the asset still opens on Roblox, or choose a different decal."
  },
  {
    q: "Can I use any decal ID in any game?",
    a: "Only in experiences that accept custom images. Spray-paint games, art canvases, and many build and roleplay games support decal input; games without an image field do not. Some experiences also apply their own filters that block certain assets."
  },
  {
    q: "Are Roblox decals free to use?",
    a: "Browsing and applying existing decal IDs is free. Uploading your own decal is also free, though every image is reviewed by Roblox moderation before it can be used."
  },
  {
    q: "Can a verified decal ID stop working later?",
    a: "Yes. Roblox can moderate, remove, or privatize an asset at any time after it is verified. Bloxodes re-checks assets and thumbnails so broken rows can be filtered out, but availability is never guaranteed."
  }
];

async function rest(pathAndQuery: string, init?: RequestInit) {
  const res = await fetch(`${base}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res;
}

async function main() {
  const payload = {
    seo_title: "Roblox Decal IDs [24K+ Image Codes]",
    intro_md,
    description_md: null,
    description_json,
    how_it_works_md,
    faq_json
  };
  await rest(`catalog_pages?code=eq.${CODE}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload)
  });
  console.log(`Updated local catalog_pages content for ${CODE}.`);
  console.log(`description_json sections: ${Object.keys(description_json).length}, faq: ${faq_json.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
