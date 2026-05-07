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

export type MobileContentKind = "articles" | "catalog" | "checklists" | "events" | "lists" | "quizzes" | "tools" | "wiki";

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
  items: MobileContentItem[];
};

export type SearchItemType =
  | "article"
  | "author"
  | "catalog"
  | "checklist"
  | "codes"
  | "event"
  | "list"
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
