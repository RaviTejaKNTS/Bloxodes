export type MusicGameDatasetPreset = "short-sounds" | "music";
export type DecalGameDatasetPreset = "crosshairs" | "faces" | "decor" | "jjs-images" | "spray-paint";

export type MusicGameIdPage = {
  slug: string;
  title: string;
  description: string;
  datasetPreset: MusicGameDatasetPreset;
  idLabel: "Sound ID" | "Music ID";
};

export type DecalGameIdPage = {
  slug: string;
  title: string;
  description: string;
  datasetPreset: DecalGameDatasetPreset;
  idLabel: "Crosshair ID" | "Face or Eye ID" | "Picture ID" | "Image ID" | "Spray Paint ID";
  copyTextureId: boolean;
};

export const MUSIC_GAME_ID_PAGES: MusicGameIdPage[] = [
  {
    slug: "jujutsu-shenanigans",
    title: "Jujutsu Shenanigans Sound IDs",
    description: "Find short Roblox audio IDs suited to Jujutsu Shenanigans kill sounds, death sounds, and Boombox clips.",
    datasetPreset: "short-sounds",
    idLabel: "Sound ID"
  },
  {
    slug: "murder-mystery-2",
    title: "Murder Mystery 2 Music IDs",
    description: "Browse Roblox music IDs for the Murder Mystery 2 Radio and copy a song for your saved playlist.",
    datasetPreset: "music",
    idLabel: "Music ID"
  },
  {
    slug: "the-strongest-battlegrounds",
    title: "The Strongest Battlegrounds Kill Sound IDs",
    description: "Browse short Roblox audio IDs that fit The Strongest Battlegrounds custom kill-sound field.",
    datasetPreset: "short-sounds",
    idLabel: "Sound ID"
  },
  {
    slug: "forsaken",
    title: "Forsaken Sound IDs",
    description: "Find short Roblox audio IDs for Forsaken hit sounds, kill sounds, and other custom sound slots.",
    datasetPreset: "short-sounds",
    idLabel: "Sound ID"
  },
  {
    slug: "adopt-me",
    title: "Adopt Me Music IDs",
    description: "Browse Roblox music IDs for Adopt Me house builds, Jukeboxes, and soundtrack searches.",
    datasetPreset: "music",
    idLabel: "Music ID"
  }
];

export const DECAL_GAME_ID_PAGES: DecalGameIdPage[] = [
  {
    slug: "da-hood",
    title: "Da Hood Crosshair IDs",
    description: "Browse Roblox crosshair image IDs for Da Hood, with clear previews and one-click copying.",
    datasetPreset: "crosshairs",
    idLabel: "Crosshair ID",
    copyTextureId: false
  },
  {
    slug: "shindo-life",
    title: "Shindo Life Face and Eye IDs",
    description: "Find Roblox face and eye image IDs for Shindo Life character customization.",
    datasetPreset: "faces",
    idLabel: "Face or Eye ID",
    copyTextureId: true
  },
  {
    slug: "berry-avenue",
    title: "Berry Avenue Picture Codes",
    description: "Browse picture, wall-art, and rug image IDs for Berry Avenue house decoration.",
    datasetPreset: "decor",
    idLabel: "Picture ID",
    copyTextureId: false
  },
  {
    slug: "bloxburg",
    title: "Bloxburg Decal IDs",
    description: "Find picture, poster, pattern, and texture IDs for Bloxburg paintings and custom build details.",
    datasetPreset: "decor",
    idLabel: "Picture ID",
    copyTextureId: true
  },
  {
    slug: "jujutsu-shenanigans",
    title: "Jujutsu Shenanigans Image IDs",
    description: "Browse anime, meme, character, and poster image IDs for Jujutsu Shenanigans billboards and Workshop cards.",
    datasetPreset: "jjs-images",
    idLabel: "Image ID",
    copyTextureId: true
  },
  {
    slug: "spray-paint",
    title: "Roblox Spray Paint IDs",
    description: "Browse previewed Roblox images and copy public Decal IDs for the classic Spray Paint tool.",
    datasetPreset: "spray-paint",
    idLabel: "Spray Paint ID",
    copyTextureId: false
  },
  {
    slug: "bloxstrike",
    title: "BloxStrike Crosshair IDs",
    description: "Browse Roblox crosshair image IDs for BloxStrike's custom Image crosshair setting.",
    datasetPreset: "crosshairs",
    idLabel: "Crosshair ID",
    copyTextureId: false
  }
];

export function getMusicGameIdPage(slug: string): MusicGameIdPage | null {
  return MUSIC_GAME_ID_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getDecalGameIdPage(slug: string): DecalGameIdPage | null {
  return DECAL_GAME_ID_PAGES.find((page) => page.slug === slug) ?? null;
}

export function musicGameCatalogCode(slug: string): string {
  return `roblox-music-ids/games/${slug}`;
}

export function decalGameCatalogCode(slug: string): string {
  return `roblox-decal-ids/games/${slug}`;
}
