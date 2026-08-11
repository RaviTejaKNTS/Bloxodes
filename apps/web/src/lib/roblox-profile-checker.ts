export type ProfileCore = {
  userId: number;
  username: string;
  displayName: string;
  description: string | null;
  created: string | null;
  isBanned: boolean;
  hasVerifiedBadge: boolean;
  avatarUrl: string | null;
  headshotUrl: string | null;
};

export type ProfileStats = {
  friends: number | null;
  followers: number | null;
  following: number | null;
  totalPlaceVisits: number | null;
};

export type PresenceStatus = "offline" | "online" | "in-game" | "in-studio" | "invisible";

export type PresenceInfo = {
  status: PresenceStatus;
  lastLocation: string | null;
};

export type WornItem = {
  assetId: number;
  name: string;
  assetType: string;
  imageUrl: string | null;
};

export type CollectibleItem = {
  assetId: number;
  name: string;
  recentAveragePrice: number | null;
  serialNumber: number | null;
  imageUrl: string | null;
};

export type InventoryStatus = "public" | "private" | "unavailable";

export type CollectiblesInfo = {
  status: InventoryStatus;
  /** Kept for consumers of the original profile-checker response. */
  canView: boolean;
  totalRap: number | null;
  rapIsPartial: boolean;
  itemCount: number;
  fetchedItemCount: number;
  hasMore: boolean;
  items: CollectibleItem[];
};

export type GroupMembership = {
  groupId: number;
  name: string;
  memberCount: number | null;
  role: string | null;
  rank: number | null;
  hasVerifiedBadge: boolean;
  imageUrl: string | null;
};

export type PlatformBadge = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

export type GameEntry = {
  universeId: number;
  rootPlaceId: number | null;
  name: string;
  placeVisits: number | null;
  imageUrl: string | null;
};

export type ProfileResponseOk = {
  ok: true;
  checkedAt: string;
  profile: ProfileCore;
  stats: ProfileStats;
  presence: PresenceInfo | null;
  previousUsernames: string[];
  wearing: WornItem[];
  collectibles: CollectiblesInfo;
  groups: GroupMembership[];
  robloxBadges: PlatformBadge[];
  socialLinks: Record<string, string>;
  createdGames: GameEntry[];
  favoriteGames: GameEntry[];
  profileUrl: string;
  warnings: string[];
};

export type ProfileSuggestion = {
  username: string;
  displayName: string;
  hasVerifiedBadge: boolean;
};

export type ProfileResponseError = {
  ok: false;
  error: { code: string; message: string; hint?: string };
  suggestions?: ProfileSuggestion[];
};

export type ProfileResponse = ProfileResponseOk | ProfileResponseError;
