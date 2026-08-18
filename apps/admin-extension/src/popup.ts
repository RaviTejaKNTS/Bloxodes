import {
  ApiError,
  VISIBLE_SOURCE_SLOTS,
  activeTabUrl,
  applyTheme,
  badge,
  el,
  environmentLabel,
  fetchPage,
  getTheme,
  getToken,
  host,
  pageTitle,
  resolveTarget,
  tokenForm,
  urlCell,
  type AdminArticle,
  type AdminCodePage,
  type AdminPage,
  type Target
} from "./shared.js";

const app = document.getElementById("app") as HTMLElement;

function render(...children: Array<Node | string | null>) {
  app.replaceChildren(...children.filter((child): child is Node | string => Boolean(child)));
}

function message(text: string) {
  render(el("p", { className: "muted center", textContent: text }));
}

function row(key: string, value: Node) {
  return el("div", { className: "kv" }, [el("span", { className: "k", textContent: key }), el("span", { className: "v" }, [value])]);
}

function plain(value: string | number | null | undefined, mono = false) {
  return value === null || value === undefined || value === ""
    ? el("span", { className: "empty", textContent: "—" })
    : el("span", { className: mono ? "mono" : "", textContent: String(value), title: String(value) });
}

function codesRows(page: AdminCodePage): Node[] {
  const slotCount = Math.max(VISIBLE_SOURCE_SLOTS, page.sources.reduce((last, value, index) => (value ? index + 1 : last), 0));
  return [
    row("Roblox", urlCell(page.roblox_link)),
    row("Universe", plain(page.universe_id, true)),
    ...Array.from({ length: slotCount }, (_, index) => row(`Source ${index + 1}`, urlCell(page.sources[index] ?? null)))
  ];
}

function articleRows(page: AdminArticle): Node[] {
  return [
    row("Author", plain(page.author_name?.trim() || page.author_id)),
    row("Universe", plain(page.universe_id, true)),
    row("Words", plain(page.word_count, true)),
    row("Tags", plain(page.tags.join(", "))),
    row("FAQ", plain(page.faq_json.length ? `${page.faq_json.length} entries` : null)),
    ...(page.sources.length ? page.sources : [null]).map((source, index) => row(`Source ${index + 1}`, urlCell(source)))
  ];
}

function renderView(target: Target, page: AdminPage) {
  const env = environmentLabel(target.origin);
  const edit = el("button", { className: "btn primary", textContent: "Edit", type: "button" });
  edit.addEventListener("click", () => {
    const params = new URLSearchParams({ origin: target.origin, family: target.family, slug: target.slug });
    chrome.tabs.create({ url: chrome.runtime.getURL(`edit.html?${params.toString()}`) });
    window.close();
  });

  const title = pageTitle(page);
  render(
    el("header", { className: "head" }, [
      el("div", { className: "head-title" }, [
        el("h1", { textContent: title, title }),
        badge(page.is_published ? "Published" : "Draft", page.is_published ? "ok" : "muted")
      ]),
      el("div", { className: "head-sub" }, [
        el("span", { className: "mono", textContent: `${host(target.origin)}/${target.family}` }),
        badge(env.label, env.production ? "warn" : "muted")
      ])
    ]),
    el("section", { className: "card" }, target.family === "codes" ? codesRows(page as AdminCodePage) : articleRows(page as AdminArticle)),
    el("footer", { className: "foot" }, [edit])
  );
}

async function load(target: Target) {
  const token = await getToken(target.origin);
  if (!token) return render(tokenForm(target, () => void load(target)));
  message("Loading…");
  try {
    const result = await fetchPage(target, token);
    renderView(target, result.page);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return render(tokenForm(target, () => void load(target), "Token rejected"));
    if (err instanceof ApiError && err.status === 404) return message(`No ${target.family === "codes" ? "codes page" : "article"} for “${target.slug}” on ${host(target.origin)}.`);
    message(err instanceof Error ? err.message : "Failed to load");
  }
}

async function main() {
  applyTheme(await getTheme());
  const target = resolveTarget(await activeTabUrl());
  if (!target) return message("Open a /codes/<slug> or /articles/<slug> page on Bloxodes.");
  await load(target);
}

void main();
