import { permanentRedirect } from "next/navigation";

type RetiredListTarget = {
  genre?: string;
  subgenre?: string;
};

const TRENDING_LIST_REDIRECTS: Record<string, RetiredListTarget> = {
  "top-trending-roblox-games": {},
  "top-trending-roblox-action-games": { genre: "Action" },
  "top-trending-roblox-battlegrounds-fighting-games": { genre: "Action", subgenre: "Battlegrounds & Fighting" },
  "top-trending-roblox-music-rhythm-games": { genre: "Action", subgenre: "Music & Rhythm" },
  "top-trending-roblox-open-world-action-games": { genre: "Action", subgenre: "Open World Action" },
  "top-trending-roblox-adventure-games": { genre: "Adventure" },
  "top-trending-roblox-exploration-games": { genre: "Adventure", subgenre: "Exploration" },
  "top-trending-roblox-scavenger-hunt-games": { genre: "Adventure", subgenre: "Scavenger Hunt" },
  "top-trending-roblox-story-games": { genre: "Adventure", subgenre: "Story" },
  "top-trending-roblox-education-games": { genre: "Education" },
  "top-trending-roblox-entertainment-games": { genre: "Entertainment" },
  "top-trending-roblox-music-audio-games": { genre: "Entertainment", subgenre: "Music & Audio" },
  "top-trending-roblox-showcase-hub-games": { genre: "Entertainment", subgenre: "Showcase & Hub" },
  "top-trending-roblox-video-games": { genre: "Entertainment", subgenre: "Video" },
  "top-trending-roblox-obby-platformer-games": { genre: "Obby & Platformer" },
  "top-trending-roblox-classic-obby-games": { genre: "Obby & Platformer", subgenre: "Classic Obby" },
  "top-trending-roblox-runner-games": { genre: "Obby & Platformer", subgenre: "Runner" },
  "top-trending-roblox-tower-obby-games": { genre: "Obby & Platformer", subgenre: "Tower Obby" },
  "top-trending-roblox-party-casual-games": { genre: "Party & Casual" },
  "top-trending-roblox-childhood-game-games": { genre: "Party & Casual", subgenre: "Childhood Game" },
  "top-trending-roblox-coloring-drawing-games": { genre: "Party & Casual", subgenre: "Coloring & Drawing" },
  "top-trending-roblox-minigame-games": { genre: "Party & Casual", subgenre: "Minigame" },
  "top-trending-roblox-quiz-games": { genre: "Party & Casual", subgenre: "Quiz" },
  "top-trending-roblox-puzzle-games": { genre: "Puzzle" },
  "top-trending-roblox-escape-room-games": { genre: "Puzzle", subgenre: "Escape Room" },
  "top-trending-roblox-match-merge-games": { genre: "Puzzle", subgenre: "Match & Merge" },
  "top-trending-roblox-word-games": { genre: "Puzzle", subgenre: "Word" },
  "top-trending-roblox-rpg-games": { genre: "RPG" },
  "top-trending-roblox-action-rpg-games": { genre: "RPG", subgenre: "Action RPG" },
  "top-trending-roblox-open-world-survival-rpg-games": { genre: "RPG", subgenre: "Open World & Survival RPG" },
  "top-trending-roblox-turn-based-rpg-games": { genre: "RPG", subgenre: "Turn-based RPG" },
  "top-trending-roblox-roleplay-avatar-sim-games": { genre: "Roleplay & Avatar Sim" },
  "top-trending-roblox-animal-sim-games": { genre: "Roleplay & Avatar Sim", subgenre: "Animal Sim" },
  "top-trending-roblox-dress-up-games": { genre: "Roleplay & Avatar Sim", subgenre: "Dress Up" },
  "top-trending-roblox-life-games": { genre: "Roleplay & Avatar Sim", subgenre: "Life" },
  "top-trending-roblox-morph-roleplay-games": { genre: "Roleplay & Avatar Sim", subgenre: "Morph Roleplay" },
  "top-trending-roblox-pet-care-games": { genre: "Roleplay & Avatar Sim", subgenre: "Pet Care" },
  "top-trending-roblox-shooter-games": { genre: "Shooter" },
  "top-trending-roblox-battle-royale-games": { genre: "Shooter", subgenre: "Battle Royale" },
  "top-trending-roblox-deathmatch-shooter-games": { genre: "Shooter", subgenre: "Deathmatch Shooter" },
  "top-trending-roblox-pve-shooter-games": { genre: "Shooter", subgenre: "PvE Shooter" },
  "top-trending-roblox-shopping-games": { genre: "Shopping" },
  "top-trending-roblox-avatar-shopping-games": { genre: "Shopping", subgenre: "Avatar Shopping" },
  "top-trending-roblox-simulation-games": { genre: "Simulation" },
  "top-trending-roblox-idle-games": { genre: "Simulation", subgenre: "Idle" },
  "top-trending-roblox-incremental-simulator-games": { genre: "Simulation", subgenre: "Incremental Simulator" },
  "top-trending-roblox-physics-sim-games": { genre: "Simulation", subgenre: "Physics Sim" },
  "top-trending-roblox-sandbox-games": { genre: "Simulation", subgenre: "Sandbox" },
  "top-trending-roblox-tycoon-games": { genre: "Simulation", subgenre: "Tycoon" },
  "top-trending-roblox-vehicle-sim-games": { genre: "Simulation", subgenre: "Vehicle Sim" },
  "top-trending-roblox-social-games": { genre: "Social" },
  "top-trending-roblox-sports-racing-games": { genre: "Sports & Racing" },
  "top-trending-roblox-racing-games": { genre: "Sports & Racing", subgenre: "Racing" },
  "top-trending-roblox-sports-games": { genre: "Sports & Racing", subgenre: "Sports" },
  "top-trending-roblox-strategy-games": { genre: "Strategy" },
  "top-trending-roblox-board-card-games": { genre: "Strategy", subgenre: "Board & Card Games" },
  "top-trending-roblox-tower-defense-games": { genre: "Strategy", subgenre: "Tower Defense" },
  "top-trending-roblox-survival-games": { genre: "Survival" },
  "top-trending-roblox-1-vs-all-games": { genre: "Survival", subgenre: "1 vs All" },
  "top-trending-roblox-escape-games": { genre: "Survival", subgenre: "Escape" },
  "top-trending-roblox-utility-other-games": { genre: "Utility & Other" }
};

function statsGamesTarget(target: RetiredListTarget) {
  const params = new URLSearchParams();
  if (target.genre) params.set("genre", target.genre);
  if (target.subgenre) params.set("subgenre", target.subgenre);
  const query = params.toString();
  return query ? `/stats/games?${query}` : "/stats/games";
}

export default async function RetiredListsRedirectPage({
  params
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const listSlug = slug?.[0]?.toLowerCase();
  const target = listSlug ? TRENDING_LIST_REDIRECTS[listSlug] : null;

  permanentRedirect(target ? statsGamesTarget(target) : "/stats");
}
