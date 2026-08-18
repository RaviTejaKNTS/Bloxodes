import {
  ApiError,
  LINK_FIELDS,
  VISIBLE_SOURCE_SLOTS,
  api,
  applyTheme,
  badge,
  el,
  environmentLabel,
  fetchPage,
  getTheme,
  getToken,
  host,
  pagePath,
  pageTitle,
  themeToggle,
  tokenForm,
  type AdminArticle,
  type AdminCodePage,
  type AdminPage,
  type Family,
  type Target
} from "./shared.js";

/* ---------- Field model ---------- */

type Kind = "title" | "text" | "number" | "textarea" | "image" | "slots" | "list" | "faq";

type Field = {
  /** Patch key sent to the API. */
  key: string;
  label: string;
  kind: Kind;
  placeholder?: string;
  rows?: number;
  /** For "slots"/"list": placeholder per row. */
  rowPlaceholder?: (index: number) => string;
  /** Initial value from the loaded page: string, string[] (slots/list) or {q,a}[] (faq). */
  read: (page: AdminPage) => unknown;
  /** Converts the control value into the API value. */
  write: (value: unknown) => unknown;
};

type Panel = { title: string; fields: Field[]; open?: boolean };

/** Editor layout: one title field, long-form blocks in the main column, settings panels in the sidebar. */
type Layout = { title: Field; main: Field[]; sidebar: Panel[] };

type Control = { field: Field; node: HTMLElement; value: () => unknown };

const str = (key: string, page: AdminPage) => {
  const value = (page as unknown as Record<string, unknown>)[key];
  return value === null || value === undefined ? "" : String(value);
};

const nullable = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

const textField = (key: string, label: string, opts: Partial<Field> = {}): Field => ({
  key,
  label,
  kind: "text",
  read: (page) => str(key, page),
  write: nullable,
  ...opts
});

const universeField: Field = {
  key: "universe_id",
  label: "Universe ID",
  kind: "number",
  read: (page) => str("universe_id", page),
  write: (value) => (typeof value === "string" && value.trim() ? Number(value) : null)
};

const coverField = textField("cover_image", "Cover image", { kind: "image", placeholder: "URL or /path" });

const codesLayout = (page: AdminCodePage): Layout => {
  const slotCount = Math.max(VISIBLE_SOURCE_SLOTS, page.sources.reduce((last, value, index) => (value ? index + 1 : last), 0));
  const linkLabels: Record<(typeof LINK_FIELDS)[number], string> = {
    roblox_link: "Roblox",
    community_link: "Community",
    discord_link: "Discord",
    twitter_link: "Twitter / X",
    youtube_link: "YouTube"
  };
  return {
    title: textField("name", "Name", { kind: "title", placeholder: "Game name" }),
    main: [
      textField("intro_md", "Intro", { kind: "textarea" }),
      textField("redeem_md", "How to redeem", { kind: "textarea" }),
      textField("find_codes_md", "Where to find codes", { kind: "textarea" }),
      textField("troubleshoot_md", "Troubleshooting", { kind: "textarea" }),
      textField("rewards_md", "Rewards", { kind: "textarea" })
    ],
    sidebar: [
      { title: "Details", fields: [universeField] },
      {
        title: "SEO",
        fields: [
          textField("seo_title", "SEO title", { placeholder: "Empty = default title" }),
          textField("seo_description", "SEO description", { kind: "textarea", rows: 4 })
        ]
      },
      { title: "Cover image", fields: [coverField] },
      {
        title: "Sources",
        fields: [
          {
            key: "sources",
            label: "Sources",
            kind: "slots",
            rowPlaceholder: (index) => (index === 0 ? "RobloxDen" : index === 1 ? "Beebom" : "https://"),
            read: (p) => Array.from({ length: slotCount }, (_, index) => (p as AdminCodePage).sources[index] ?? ""),
            write: (value) => (value as string[]).map((item) => nullable(item))
          }
        ]
      },
      { title: "Links", fields: LINK_FIELDS.map((key) => textField(key, linkLabels[key], { placeholder: "https://" })) }
    ]
  };
};

const articleLayout = (): Layout => ({
  title: textField("title", "Title", { kind: "title", placeholder: "Article title" }),
  main: [
    textField("content_md", "Body", { kind: "textarea", rows: 24 }),
    {
      key: "faq_json",
      label: "FAQ",
      kind: "faq",
      read: (page) => (page as AdminArticle).faq_json.map((entry) => ({ q: entry.q, a: entry.a })),
      write: (value) =>
        (value as Array<{ q: string; a: string }>).map((entry) => ({ q: entry.q.trim(), a: entry.a.trim() })).filter((entry) => entry.q || entry.a)
    }
  ],
  sidebar: [
    { title: "Details", fields: [universeField, textField("author_id", "Author ID", { placeholder: "UUID" })] },
    { title: "Meta description", fields: [textField("meta_description", "Meta description", { kind: "textarea", rows: 4 })] },
    { title: "Cover image", fields: [coverField] },
    {
      title: "Tags",
      fields: [
        {
          key: "tags",
          label: "Tags",
          kind: "text",
          placeholder: "comma-separated",
          read: (page) => (page as AdminArticle).tags.join(", "),
          write: (value) =>
            String(value)
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
        }
      ]
    },
    {
      title: "Sources",
      fields: [
        {
          key: "sources",
          label: "Sources",
          kind: "list",
          rowPlaceholder: () => "https://",
          read: (page) => [...(page as AdminArticle).sources],
          write: (value) => (value as string[]).map((item) => item.trim()).filter(Boolean)
        }
      ]
    }
  ]
});

const LAYOUTS: Record<Family, (page: AdminPage) => Layout> = {
  codes: (page) => codesLayout(page as AdminCodePage),
  articles: () => articleLayout()
};

/* ---------- State ---------- */

const app = document.getElementById("app") as HTMLElement;
let snapshot: AdminPage | null = null;
let controlsList: Control[] = [];
let initial = new Map<string, string>();
let currentTarget: Target | null = null;
let flashTimer: number | undefined;

const statusNode = el("span", { className: "status" });
const bannerNode = el("div", { className: "banner", hidden: true });
const saveButton = el("button", { className: "btn primary", textContent: "Save", type: "button" });
const discardButton = el("button", { className: "btn ghost", textContent: "Discard", type: "button" });

function render(...children: Array<Node | string | null>) {
  app.replaceChildren(...children.filter((child): child is Node | string => Boolean(child)));
}

/* ---------- Controls ---------- */

function autoGrow(area: HTMLTextAreaElement) {
  const grow = () => {
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight + 2}px`;
  };
  area.addEventListener("input", grow);
  // Grow once the node is attached and has layout.
  requestAnimationFrame(grow);
}

function labelled(field: Field, node: HTMLElement, id: string, extra: HTMLElement[] = []) {
  return el("div", { className: "field" }, [el("label", { htmlFor: id, textContent: field.label }), node, ...extra]);
}

function makeControl(field: Field, value: unknown, placement: "main" | "sidebar"): Control {
  const id = `f-${field.key}`;

  if (field.kind === "title") {
    const input = el("input", { id, className: "title-input", type: "text", value: String(value ?? ""), placeholder: field.placeholder ?? "" });
    input.addEventListener("input", refreshBar);
    return { field, node: input, value: () => input.value };
  }

  if (field.kind === "text" || field.kind === "number" || field.kind === "image") {
    const input = el("input", { id, type: field.kind === "number" ? "number" : "text", value: String(value ?? ""), placeholder: field.placeholder ?? "" });
    if (field.kind === "number") input.min = "1";
    input.addEventListener("input", refreshBar);
    const extras: HTMLElement[] = [];
    if (field.kind === "image") {
      const preview = el("img", { className: "preview", alt: "", hidden: true });
      const paint = () => {
        const src = input.value.trim();
        preview.hidden = !src;
        if (src) preview.src = src;
      };
      preview.addEventListener("error", () => (preview.hidden = true));
      input.addEventListener("input", paint);
      paint();
      extras.push(preview);
    }
    return { field, node: labelled(field, input, id, extras), value: () => input.value };
  }

  if (field.kind === "textarea") {
    const area = el("textarea", { id, value: String(value ?? ""), rows: field.rows ?? 4, spellcheck: true });
    area.addEventListener("input", refreshBar);
    if (placement === "main") {
      autoGrow(area);
      return {
        field,
        node: el("div", { className: "block" }, [el("label", { className: "block-label", htmlFor: id, textContent: field.label }), area]),
        value: () => area.value
      };
    }
    return { field, node: labelled(field, area, id), value: () => area.value };
  }

  if (field.kind === "slots") {
    const inputs = (value as string[]).map((item, index) => {
      const input = el("input", { type: "text", value: item, placeholder: field.rowPlaceholder?.(index) ?? "" });
      input.addEventListener("input", refreshBar);
      return input;
    });
    const rows = inputs.map((input, index) => el("div", { className: "slot" }, [el("span", { className: "slot-label", textContent: `${index + 1}` }), input]));
    return { field, node: el("div", { className: "stack" }, rows), value: () => inputs.map((input) => input.value) };
  }

  if (field.kind === "list") {
    const list = el("div", { className: "stack" });
    const inputs: HTMLInputElement[] = [];
    const renumber = () => list.querySelectorAll<HTMLElement>(".slot-label").forEach((node, index) => (node.textContent = `${index + 1}`));
    const addRow = (item = "") => {
      const input = el("input", { type: "text", value: item, placeholder: field.rowPlaceholder?.(inputs.length) ?? "" });
      const remove = el("button", { className: "btn ghost icon", textContent: "×", type: "button", title: "Remove" });
      const row = el("div", { className: "slot" }, [el("span", { className: "slot-label", textContent: `${inputs.length + 1}` }), input, remove]);
      inputs.push(input);
      list.append(row);
      input.addEventListener("input", refreshBar);
      remove.addEventListener("click", () => {
        inputs.splice(inputs.indexOf(input), 1);
        row.remove();
        renumber();
        refreshBar();
      });
    };
    (value as string[]).forEach((item) => addRow(item));
    const add = el("button", { className: "btn link", textContent: "+ Add source", type: "button" });
    add.addEventListener("click", () => {
      addRow();
      inputs[inputs.length - 1].focus();
      refreshBar();
    });
    return { field, node: el("div", { className: "field" }, [list, add]), value: () => inputs.map((input) => input.value) };
  }

  // faq (main column block)
  const list = el("div", { className: "stack" });
  const entries: Array<{ q: HTMLInputElement; a: HTMLTextAreaElement }> = [];
  const renumber = () => list.querySelectorAll<HTMLElement>(".faq-n").forEach((node, index) => (node.textContent = `${index + 1}`));
  const addEntry = (entry = { q: "", a: "" }) => {
    const q = el("input", { type: "text", value: entry.q, placeholder: "Question" });
    const a = el("textarea", { value: entry.a, rows: 2, placeholder: "Answer" });
    const remove = el("button", { className: "btn ghost icon", textContent: "×", type: "button", title: "Remove" });
    const record = { q, a };
    const card = el("div", { className: "faq" }, [
      el("div", { className: "faq-head" }, [el("span", { className: "faq-n", textContent: `${entries.length + 1}` }), q, remove]),
      a
    ]);
    entries.push(record);
    list.append(card);
    q.addEventListener("input", refreshBar);
    a.addEventListener("input", refreshBar);
    autoGrow(a);
    remove.addEventListener("click", () => {
      entries.splice(entries.indexOf(record), 1);
      card.remove();
      renumber();
      refreshBar();
    });
  };
  (value as Array<{ q: string; a: string }>).forEach((entry) => addEntry(entry));
  const add = el("button", { className: "btn link faq-add", textContent: "+ Add question", type: "button" });
  add.addEventListener("click", () => {
    addEntry();
    entries[entries.length - 1].q.focus();
    refreshBar();
  });
  return {
    field,
    node: el("div", { className: "block" }, [el("span", { className: "block-label", textContent: field.label }), list, add]),
    value: () => entries.map((entry) => ({ q: entry.q.value, a: entry.a.value }))
  };
}

/* ---------- Dirty tracking / save ---------- */

const serialize = (value: unknown) => JSON.stringify(value);

function dirtyControls(): Control[] {
  return controlsList.filter((control) => serialize(control.value()) !== initial.get(control.field.key));
}

function refreshBar() {
  const count = dirtyControls().length;
  saveButton.disabled = count === 0;
  discardButton.disabled = count === 0;
  saveButton.textContent = "Save";
  statusNode.textContent = count === 0 ? "Saved" : `${count} unsaved change${count === 1 ? "" : "s"}`;
  statusNode.className = `status${count === 0 ? "" : " warn-text"}`;
}

function flash(text: string) {
  statusNode.textContent = text;
  statusNode.className = "status ok-text";
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(refreshBar, 2000);
}

async function save() {
  const target = currentTarget;
  if (!target || !snapshot) return;
  const changed = dirtyControls();
  if (changed.length === 0) return;
  const token = await getToken(target.origin);
  if (!token) return render(tokenForm(target, () => void load(target)));

  saveButton.disabled = true;
  discardButton.disabled = true;
  saveButton.textContent = "Saving…";
  bannerNode.hidden = true;

  const patch: Record<string, unknown> = { slug: target.slug };
  for (const control of changed) patch[control.field.key] = control.field.write(control.value());

  try {
    const result = await api<{ page: AdminPage }>(target, token, { method: "PATCH", body: JSON.stringify(patch) });
    renderEditor(target, result.page);
    flash("Saved just now");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return render(tokenForm(target, () => void load(target), "Token rejected"));
    bannerNode.textContent = err instanceof Error ? err.message : "Save failed";
    bannerNode.hidden = false;
    refreshBar();
  }
}

/* ---------- Layout ---------- */

function register(field: Field, page: AdminPage, placement: "main" | "sidebar", options: { hideLabel?: boolean } = {}): HTMLElement {
  const control = makeControl(field, field.read(page), placement);
  controlsList.push(control);
  initial.set(field.key, serialize(control.value()));
  if (options.hideLabel) control.node.querySelector(":scope > label")?.remove();
  return control.node;
}

function renderEditor(target: Target, page: AdminPage) {
  currentTarget = target;
  snapshot = page;
  controlsList = [];
  initial = new Map();
  bannerNode.hidden = true;

  const env = environmentLabel(target.origin);
  const title = pageTitle(page);
  document.title = `${title} · Bloxodes Admin`;
  const layout = LAYOUTS[target.family](page);

  const topbar = el("header", { className: "topbar" }, [
    el("div", { className: "crumb" }, [
      el("span", { className: "brand", textContent: "Bloxodes" }),
      el("span", { className: "sep", textContent: "/" }),
      el("span", { textContent: target.family }),
      el("span", { className: "sep", textContent: "/" }),
      el("a", { className: "mono", href: `${target.origin}${pagePath(target)}`, target: "_blank", rel: "noreferrer", textContent: target.slug, title: "Open page" })
    ]),
    el("div", { className: "topbar-spacer" }),
    statusNode,
    badge(env.label, env.production ? "warn" : "muted"),
    badge(page.is_published ? "Published" : "Draft", page.is_published ? "ok" : "muted"),
    themeToggle(),
    discardButton,
    saveButton
  ]);

  const main = el("main", { className: "main" }, [
    el("div", { className: "main-inner" }, [
      bannerNode,
      register(layout.title, page, "main"),
      ...layout.main.map((field) => register(field, page, "main"))
    ])
  ]);

  const sidebar = el("aside", { className: "sidebar" }, [
    el("div", { className: "sidebar-inner" }, [
      el("details", { className: "panel", open: true }, [
        el("summary", { textContent: "Status" }),
        el("div", { className: "panel-body" }, [
          el("div", { className: "kv-line" }, [
            el("span", { className: "muted", textContent: page.is_published ? "Published" : "Draft" }),
            el("span", { className: "muted mono", textContent: ` · ${host(target.origin)}` })
          ]),
          el("span", { className: "muted", textContent: `Updated ${new Date(page.updated_at).toLocaleString()}` })
        ])
      ]),
      ...layout.sidebar.map((panel) =>
        el("details", { className: "panel", open: panel.open ?? true }, [
          el("summary", { textContent: panel.title }),
          el("div", { className: "panel-body" }, panel.fields.map((field) => register(field, page, "sidebar", { hideLabel: panel.fields.length === 1 })))
        ])
      )
    ])
  ]);

  render(topbar, el("div", { className: "editor" }, [main, sidebar]));
  refreshBar();
  window.scrollTo(0, 0);
}

async function load(target: Target) {
  const token = await getToken(target.origin);
  if (!token) return render(el("div", { className: "main" }, [el("div", { className: "main-inner" }, [tokenForm(target, () => void load(target))])]));
  render(el("p", { className: "muted center", textContent: "Loading…" }));
  try {
    const result = await fetchPage(target, token);
    renderEditor(target, result.page);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return render(el("div", { className: "main" }, [el("div", { className: "main-inner" }, [tokenForm(target, () => void load(target), "Token rejected")])]));
    }
    render(el("p", { className: "error center", textContent: err instanceof Error ? err.message : "Failed to load" }));
  }
}

/* ---------- Wiring ---------- */

saveButton.addEventListener("click", () => void save());
discardButton.addEventListener("click", () => {
  if (currentTarget && snapshot) renderEditor(currentTarget, snapshot);
});

window.addEventListener("beforeunload", (event) => {
  if (dirtyControls().length > 0) event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (!saveButton.disabled) void save();
  }
});

function readTarget(): Target | null {
  const params = new URLSearchParams(location.search);
  const origin = params.get("origin");
  const family = params.get("family");
  const slug = params.get("slug");
  if (!origin || !slug || (family !== "codes" && family !== "articles")) return null;
  return { origin, family, slug };
}

const target = readTarget();
void getTheme().then((theme) => {
  applyTheme(theme);
  if (!target) render(el("p", { className: "error center", textContent: "Missing origin, family, or slug." }));
  else void load(target);
});
