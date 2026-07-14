export type CodesIndexItem = {
  id: string;
  name: string;
  slug: string;
  coverImage: string | null;
  activeCount: number;
  latestCodeFirstSeenAt: string | null;
  contentUpdatedAt: string | null;
  genre: string | null;
  url: string;
};

export type CodesIndexResponse = {
  ok: true;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  games: CodesIndexItem[];
};

export type CodeItem = {
  id: string;
  code: string;
  status: "active" | "expired" | "check";
  rewardText: string | null;
  levelRequirement: number | null;
  isNew: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

export type CodeDetailResponse = {
  ok: true;
  game: {
    id: string;
    name: string;
    slug: string;
    coverImage: string | null;
    description: string | null;
    url: string;
    robloxUrl: string | null;
    contentUpdatedAt: string | null;
  };
  activeCodes: CodeItem[];
  expiredCodes: CodeItem[];
};

export type ApiErrorResponse = {
  ok: false;
  error: string;
};

export type MobileContentKind = "articles" | "catalog" | "checklists" | "events" | "quizzes" | "tools" | "wiki";

export type MobileContentItem = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  url: string;
  badge: string | null;
};

export type MobileContentIndexResponse = {
  ok: true;
  kind: MobileContentKind;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  latestUpdatedAt: string | null;
  query?: string | null;
  items: MobileContentItem[];
};

export type MobileContentDetailItem = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  badge: string | null;
  image: string | null;
  startAt?: string | null;
  endAt?: string | null;
  status?: "upcoming" | "current" | "past" | null;
  fields?: Array<{
    key: string;
    label: string;
    value: string;
    kind: "chip" | "detail" | "text";
  }>;
};

export type MobileContentDetailSection = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  items: MobileContentDetailItem[];
  variant?: "collection-items" | "collection-details" | "faq" | "links" | "markdown" | "prose" | "stats" | "timeline";
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  query?: string | null;
};

export type MobileContentDetailResponse = {
  ok: true;
  kind: MobileContentKind;
  title: string;
  subtitle: string | null;
  summary: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  url: string;
  badge: string | null;
  layout?: "default" | "events" | "wiki" | "wiki_collection";
  sections: MobileContentDetailSection[];
};

export type SearchItemType =
  | "article"
  | "author"
  | "catalog"
  | "checklist"
  | "codes"
  | "event"
  | "music"
  | "quiz"
  | "tool"
  | "wiki";

export type SearchItem = {
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
  type: SearchItemType;
  updatedAt: string | null;
  badge: string | null;
};

export type SearchResponse = {
  items: SearchItem[];
};

export type MobileHomeResponse = {
  ok: true;
  codes: CodesIndexResponse;
  sections: MobileContentIndexResponse[];
};

export type SessionUser = {
  id: string;
  role: "admin" | "user";
  display_name: string | null;
  roblox_user_id: number | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_profile_url: string | null;
};

export type MobileAuthSessionResponse = {
  ok: true;
  user: SessionUser | null;
};

export type MobileAuthExchangeResponse = {
  ok: true;
  token: string;
  expiresAt: string;
  user: SessionUser;
};

export type CodeProgressResponse = {
  usedCodes: string[];
};

export type ChecklistProgressResponse = {
  checkedIds: string[];
};

export type ChecklistProgressSummary = {
  slug: string;
  checkedCount: number;
};

export type QuizProgressResponse = {
  seenQuestionIds: string[];
  lastScore: number | null;
  lastTotal: number | null;
  lastBreakdown: Record<string, { correct: number; total: number }>;
  lastAttemptAt: string | null;
};

export type QuizProgressSummary = {
  code: string;
  seenCount: number;
  lastScore: number | null;
  lastTotal: number | null;
};

export type QuizOption = {
  id: string;
  text: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  image?: string | null;
};

export type QuizData = {
  easy: QuizQuestion[];
  medium: QuizQuestion[];
  hard: QuizQuestion[];
};

export type QuizPlayResponse = {
  ok: true;
  code: string;
  title: string;
  description: string | null;
  universeName: string | null;
  coverImage: string | null;
  quizData: QuizData;
};

export type StatsGame = {
  universeId: number;
  slug: string;
  rootPlaceId: number | null;
  name: string;
  displayName: string;
  description: string | null;
  creatorName: string | null;
  creatorType: string | null;
  creatorId: number | null;
  genre: string | null;
  subgenre: string | null;
  ageRating: string | null;
  iconUrl: string | null;
  thumbnailUrls: string[];
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  ratingPercent: number | null;
  statsTier: "NEW" | "HOT" | "WARM" | "COLD" | null;
  createdAtApi: string | null;
  updatedAtApi: string | null;
  rank?: number | null;
  growth24hPercent?: number | null;
  growth7dPercent?: number | null;
  peakPlaying24h?: number | null;
  peakPlaying7d?: number | null;
};

export type StatsGamesResponse = {
  games: StatsGame[];
  total: number;
  page: number;
  totalPages: number;
};

export type StatsGameDetailResponse = {
  game: (StatsGame & { rank: number | null }) | null;
};

export type StatsChartPoint = {
  label: string;
  tooltipLabel?: string;
  sampledAt: string;
  players: number | null;
  peakPlayers: number | null;
  avgPlayers: number | null;
  visits: number | null;
  favorites: number | null;
  rating: number | null;
  samples: number | null;
};

export type StatsGameChartResponse = {
  range: string;
  resolution: string;
  points: StatsChartPoint[];
};
