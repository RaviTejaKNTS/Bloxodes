export type MusicGameDatasetPreset = "short-sounds" | "music";
export type DecalGameDatasetPreset = "crosshairs" | "faces" | "decor" | "jjs-images" | "spray-paint";

export type MusicGameIdPage = {
  slug: string;
  title: string;
  description: string;
  datasetPreset: MusicGameDatasetPreset;
  idLabel: "Sound ID" | "Music ID";
  seoCountLabel: string;
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
    title: "Jujutsu Shenanigans Music IDs",
    description: "Find short Roblox audio IDs suited to Jujutsu Shenanigans kill sounds, death sounds, and Boombox clips.",
    datasetPreset: "short-sounds",
    idLabel: "Sound ID",
    seoCountLabel: "Kill & Death Sounds"
  },
  {
    slug: "murder-mystery-2",
    title: "Murder Mystery 2 Music IDs",
    description: "Browse Roblox music IDs for the Murder Mystery 2 Radio and copy a song for your saved playlist.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "MM2 Radio Codes"
  },
  {
    slug: "the-strongest-battlegrounds",
    title: "The Strongest Battlegrounds Music IDs",
    description: "Browse short Roblox audio IDs that fit The Strongest Battlegrounds custom kill-sound field.",
    datasetPreset: "short-sounds",
    idLabel: "Sound ID",
    seoCountLabel: "Kill Sound Codes"
  },
  {
    slug: "forsaken",
    title: "Forsaken Music IDs",
    description: "Find short Roblox audio IDs for Forsaken hit sounds, kill sounds, and other custom sound slots.",
    datasetPreset: "short-sounds",
    idLabel: "Sound ID",
    seoCountLabel: "Hit & Kill Sounds"
  },
  {
    slug: "adopt-me",
    title: "Adopt Me Music IDs",
    description: "Browse Roblox music IDs for Adopt Me house builds, Jukeboxes, and soundtrack searches.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Jukebox Songs"
  },
  {
    slug: "brookhaven-rp",
    title: "Brookhaven RP Music IDs",
    description: "Browse Roblox music IDs associated with Brookhaven RP and learn how its speaker and music search controls work.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Speaker Songs"
  },
  {
    slug: "fisch",
    title: "Fisch Music IDs",
    description: "Browse Roblox music IDs for Fisch's Radio Pass and find songs to play while you fish.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Radio Songs"
  },
  {
    slug: "driving-empire",
    title: "Driving Empire Music IDs",
    description: "Find Roblox music IDs for Driving Empire's radio and custom music player while you drive.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Radio Songs"
  },
  {
    slug: "evade",
    title: "Evade Music IDs",
    description: "Browse Roblox music IDs for Evade's Boombox and soundtrack-friendly runs.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Boombox Songs"
  },
  {
    slug: "3008",
    title: "3008 Music IDs",
    description: "Find Roblox music IDs for the 3008 music menu, daily themes, and custom soundtrack slots.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Music Menu Songs"
  },
  {
    slug: "a-dusty-trip",
    title: "A Dusty Trip Music IDs",
    description: "Browse Roblox music IDs for A Dusty Trip's car radio and long desert drives.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Radio Songs"
  },
  {
    slug: "work-at-a-pizza-place",
    title: "Work at a Pizza Place Music IDs",
    description: "Find Roblox music IDs for Work at a Pizza Place's car radio and Radio pass.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Radio Songs"
  },
  {
    slug: "basketball-zero",
    title: "Basketball Zero Music IDs",
    description: "Browse Roblox music IDs for Basketball Zero's lobby Boombox and custom song controls.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Boombox Songs"
  },
  {
    slug: "grand-piece-online",
    title: "Grand Piece Online Music IDs",
    description: "Find Roblox music IDs for Grand Piece Online's Music Snail and your next voyage.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Music Snail Songs"
  },
  {
    slug: "da-hood",
    title: "Da Hood Music IDs",
    description: "Browse Roblox music IDs for Da Hood's Boombox and custom music controls.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Boombox Songs"
  },
  {
    slug: "retail-tycoon-2",
    title: "Retail Tycoon 2 Music IDs",
    description: "Browse Retail Tycoon 2 playlist and custom-radio music IDs, with track names and copy-ready numbers.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Playlist Songs"
  },
  {
    slug: "nicos-nextbots",
    title: "Nico's Nextbots Music IDs",
    description: "Find Roblox music IDs for Nico's Nextbots soundtrack references and Boombox controls.",
    datasetPreset: "music",
    idLabel: "Music ID",
    seoCountLabel: "Boombox Songs"
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
