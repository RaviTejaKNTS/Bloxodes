export type GameTopNavToolLink = {
  label: string;
  href: string;
  active?: boolean;
};

export type GameTopNavLink = {
  label: string;
  href: string;
  type: "wiki" | "stats" | "codes" | "events" | "checklists" | "quizzes";
  active?: boolean;
};

export type GameTopNavContext = {
  gameName: string;
  thumbnailUrl: string | null;
  links: GameTopNavLink[];
  tools: GameTopNavToolLink[];
  toolsActive?: boolean;
};

export type CatalogTopNavLink = {
  label: string;
  href: string;
  active?: boolean;
};

export type CatalogTopNavContext = {
  title: string;
  links: CatalogTopNavLink[];
};
