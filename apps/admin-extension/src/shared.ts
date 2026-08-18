export const LINK_FIELDS = ["roblox_link", "community_link", "discord_link", "twitter_link", "youtube_link"] as const;
export const TEXT_FIELDS = [
  "seo_title",
  "seo_description",
  "cover_image",
  "intro_md",
  "redeem_md",
  "find_codes_md",
  "troubleshoot_md",
  "rewards_md"
] as const;

export type LinkField = (typeof LINK_FIELDS)[number];
export type TextField = (typeof TEXT_FIELDS)[number];

export type AdminCodePage = {
  id: string;
  slug: string;
  name: string;
  is_published: boolean;
  universe_id: number | null;
  sources: Array<string | null>;
  updated_at: string;
} & Record<LinkField, string | null> &
  Record<TextField, string | null>;

export type Family = "codes" | "articles";
export type Target = { origin: string; family: Family; slug: string };

export type AdminArticle = {
  id: string;
  slug: string;
  title: string;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
  word_count: number | null;
  meta_description: string | null;
  cover_image: string | null;
  universe_id: number | null;
  author_id: string | null;
  author_name: string | null;
  content_md: string;
  tags: string[];
  sources: string[];
  faq_json: Array<{ q: string; a: string }>;
};

export type AdminPage = AdminCodePage | AdminArticle;

export const FAMILY_LABEL: Record<Family, string> = { codes: "Codes page", articles: "Article" };

/** Slots always shown in the UI. Slots 6-10 appear only when they already hold a value. */
export const VISIBLE_SOURCE_SLOTS = 5;

const ALLOWED_HOSTS = new Set(["bloxodes.com", "www.bloxodes.com", "localhost"]);

export function resolveTarget(rawUrl: string | null): Target | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) return null;
  const match = /^\/(codes|articles)\/([a-z0-9-]+)\/?$/i.exec(url.pathname);
  if (!match) return null;
  const family = match[1].toLowerCase() as Family;
  const slug = match[2].toLowerCase();
  // Index/listing routes that share the same depth as a detail slug.
  if (family === "articles" && (slug === "games" || slug === "page")) return null;
  // The web proxy 301s www -> apex and browsers drop Authorization on cross-origin redirects, so always call the apex.
  const origin = url.hostname === "www.bloxodes.com" ? "https://bloxodes.com" : url.origin;
  return { origin, family, slug };
}

export function pageTitle(page: AdminPage): string {
  return "title" in page ? page.title : page.name;
}

export function pagePath(target: Target): string {
  return `/${target.family}/${target.slug}`;
}

export function activeTabUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]?.url ?? null));
  });
}

export function host(origin: string) {
  return origin.replace(/^https?:\/\//, "");
}

/** Environment badge derived from repo conventions: bloxodes.com and localhost:5000 both hit the production database. */
export function environmentLabel(origin: string): { label: string; production: boolean } {
  const h = host(origin);
  if (h.endsWith("bloxodes.com")) return { label: "production", production: true };
  if (h === "localhost:5000") return { label: "prod db", production: true };
  return { label: "dev", production: false };
}

function tokenKey(origin: string) {
  return `token:${origin}`;
}

export function getToken(origin: string): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(tokenKey(origin), (items) => {
      const value = items[tokenKey(origin)];
      resolve(typeof value === "string" && value ? value : null);
    });
  });
}

export function setToken(origin: string, token: string): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.set({ [tokenKey(origin)]: token }, () => resolve()));
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  target: Target,
  token: string,
  init: RequestInit & { query?: Record<string, string> } = {}
): Promise<T> {
  const url = new URL(`/api/admin/${target.family}`, target.origin);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {})
    }
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new ApiError(response.status, body.error ?? `Request failed (${response.status})`);
  return body;
}

export function fetchPage<T extends AdminPage = AdminPage>(target: Target, token: string) {
  return api<{ page: T }>(target, token, { query: { slug: target.slug } });
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string; dataset?: Record<string, string> } = {},
  children: Array<Node | string | null | false | undefined> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { dataset, ...rest } = props;
  Object.assign(node, rest);
  if (dataset) Object.assign(node.dataset, dataset);
  for (const child of children) if (child) node.append(child);
  return node;
}

export function badge(text: string, tone: "ok" | "warn" | "muted" = "muted") {
  return el("span", { className: `badge ${tone}`, textContent: text });
}

/** Splits a URL into host and path for compact display. */
export function splitUrl(value: string): { host: string; path: string } {
  try {
    const url = new URL(value);
    const path = `${url.pathname}${url.search}`.replace(/\/$/, "");
    return { host: url.host.replace(/^www\./, ""), path: path === "" ? "" : path };
  } catch {
    return { host: value, path: "" };
  }
}

export function urlCell(value: string | null) {
  if (!value) return el("span", { className: "empty", textContent: "—" });
  const { host: h, path } = splitUrl(value);
  return el("a", { className: "url", href: value, target: "_blank", rel: "noreferrer", title: value }, [
    el("span", { className: "url-host", textContent: h }),
    path ? el("span", { className: "url-path", textContent: path }) : null
  ]);
}

export function tokenForm(target: Target, onSaved: () => void, error?: string) {
  const input = el("input", { type: "password", placeholder: `Admin token for ${host(target.origin)}`, autofocus: true });
  const save = el("button", { className: "btn primary", textContent: "Save", type: "button" });
  const submit = async () => {
    const value = input.value.trim();
    if (!value) return;
    await setToken(target.origin, value);
    onSaved();
  };
  save.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void submit();
  });
  return el("div", { className: "token" }, [
    el("div", { className: "row-inline" }, [input, save]),
    error ? el("p", { className: "error", textContent: error }) : null
  ]);
}

/* Theme: dark by default; the choice is shared by popup and editor via chrome.storage.local. */

export type Theme = "dark" | "light";

export function getTheme(): Promise<Theme> {
  return new Promise((resolve) => {
    chrome.storage.local.get("theme", (items) => resolve(items.theme === "light" ? "light" : "dark"));
  });
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme): Promise<void> {
  applyTheme(theme);
  return new Promise((resolve) => chrome.storage.local.set({ theme }, () => resolve()));
}

export function themeToggle(): HTMLButtonElement {
  const button = el("button", { className: "btn ghost icon", type: "button", title: "Toggle theme" });
  const paint = () => {
    button.textContent = document.documentElement.dataset.theme === "light" ? "☾" : "☀";
  };
  paint();
  button.addEventListener("click", () => {
    void setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light").then(paint);
  });
  return button;
}
