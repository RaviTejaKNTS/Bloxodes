type BloxodesContentRequest = {
  type: "BLOXODES_GET_CODES";
  placeId: number | null;
  gameName: string | null;
};

type BloxodesHistoryRequest = {
  type: "BLOXODES_GET_HISTORY";
  placeId: number;
};

type BloxodesContentCode = {
  code: string;
  rewardText: string | null;
  isNew: boolean;
  levelRequirement: number | null;
  addedAt: string | null;
};

type BloxodesContentPayload = {
  ok: boolean;
  matched?: boolean;
  game?: {
    name: string;
    slug: string;
    url: string;
    robloxUrl: string | null;
    coverImage: string | null;
  };
  codes?: BloxodesContentCode[];
  totalActive?: number;
  shown?: number;
  hasMore?: boolean;
  lastCheckedAt?: string | null;
  fullListUrl?: string;
  codesHubUrl?: string;
  reason?: string;
  error?: string;
};

type BloxodesContentResponse =
  | {
      ok: true;
      payload: BloxodesContentPayload;
    }
  | {
      ok: false;
      error: string;
    };

type BloxodesHistoryPoint = {
  sampledAt: string;
  players: number;
};

type BloxodesHistoryPayload =
  | {
      ok: true;
      state: "ready";
      game: {
        universeId: number;
        name: string;
      };
      range: "7d";
      points: BloxodesHistoryPoint[];
      lastUpdatedAt: string | null;
      fullStatsUrl: string;
    }
  | {
      ok: true;
      state: "pending";
      reason: "collecting-history";
      game: {
        universeId: number;
        name: string;
      };
      range: "7d";
      points: BloxodesHistoryPoint[];
      lastUpdatedAt: string | null;
      fullStatsUrl: string;
    }
  | {
      ok: true;
      state: "untracked" | "unavailable";
      reason: "not-tracked" | "not-found";
    };

type BloxodesHistoryResponse =
  | {
      ok: true;
      payload: BloxodesHistoryPayload;
    }
  | {
      ok: false;
      error: string;
    };

type BloxodesWidgetSettings = {
  showCodes: boolean;
  showHistory: boolean;
};

const BLOXODES_PANEL_ID = "bloxodes-codes-extension";
const BLOXODES_STATS_PANEL_ID = "bloxodes-stats-extension";
const BLOXODES_CODES_HUB_URL = "https://bloxodes.com/codes";
const BLOXODES_LOGO_DARK_URL = chrome.runtime.getURL("brand/Bloxodes-dark.png");
const BLOXODES_LOGO_LIGHT_URL = chrome.runtime.getURL("brand/Bloxodes-light.png");
const BLOXODES_SETTINGS_KEY = "widgetSettings";
const BLOXODES_DEFAULT_SETTINGS: BloxodesWidgetSettings = {
  showCodes: true,
  showHistory: true
};
const BLOXODES_STATE = {
  lastHiddenRequestKey: "",
  lastMatchedPayload: null as BloxodesContentPayload | null,
  lastRequestKey: "",
  lastStatsHiddenRequestKey: "",
  lastStatsPayload: null as BloxodesHistoryPayload | null,
  lastStatsRequestKey: "",
  observer: null as MutationObserver | null,
  runTimer: 0,
  settings: { ...BLOXODES_DEFAULT_SETTINGS },
  urlPoll: 0
};

type BloxodesTheme = "light" | "dark";

function parsePlaceId(url: string): number | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/games\/(\d+)/);
    if (!match) return null;
    const placeId = Number(match[1]);
    return Number.isSafeInteger(placeId) && placeId > 0 ? placeId : null;
  } catch {
    return null;
  }
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
}

function readGameName(): string | null {
  const candidates = [
    document.querySelector<HTMLElement>("[data-testid='game-title']"),
    document.querySelector<HTMLElement>("h1.game-name"),
    document.querySelector<HTMLElement>("h1")
  ];

  for (const candidate of candidates) {
    const text = normalizeText(candidate?.textContent);
    if (text) return text;
  }

  const ogTitle = normalizeText(document.querySelector<HTMLMetaElement>("meta[property='og:title']")?.content);
  if (ogTitle) return ogTitle.replace(/\s+-\s+Roblox$/i, "").trim();

  return normalizeText(document.title.replace(/\s+-\s+Roblox$/i, ""));
}

function findInsertionTarget(): Element | null {
  const selectors = [
    ".col-xs-12.section-content.game-main-content.remove-panel.follow-button-enabled",
    ".game-main-content",
    ".game-calls-to-action",
    "[data-testid='game-details']",
    "main"
  ];

  for (const selector of selectors) {
    const target = document.querySelector(selector);
    if (target) return target;
  }

  return document.body;
}

function findStatsInsertionTarget(): Element | null {
  return (
    document.querySelector("ul.game-stat-container") ??
    document.querySelector(".game-stat-container")
  );
}

function removePanel(): void {
  document.getElementById(BLOXODES_PANEL_ID)?.remove();
}

function removeStatsPanel(): void {
  document.getElementById(BLOXODES_STATS_PANEL_ID)?.remove();
}

function getRgbFromColor(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function getColorLuminance([red, green, blue]: [number, number, number]): number {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function detectRobloxTheme(): BloxodesTheme {
  const themeText = [
    document.documentElement.className,
    document.body.className,
    document.documentElement.getAttribute("data-theme"),
    document.body.getAttribute("data-theme")
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(dark|dark-theme|theme-dark)\b/.test(themeText)) return "dark";
  if (/\b(light|light-theme|theme-light)\b/.test(themeText)) return "light";

  const bodyColor = getRgbFromColor(getComputedStyle(document.body).backgroundColor);
  if (bodyColor) {
    return getColorLuminance(bodyColor) < 0.45 ? "dark" : "light";
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function syncPanelTheme(panel: Element | null = document.getElementById(BLOXODES_PANEL_ID)): void {
  panel?.setAttribute("data-bloxodes-theme", detectRobloxTheme());
}

function ensurePanel(): HTMLElement {
  const existing = document.getElementById(BLOXODES_PANEL_ID);
  if (existing) {
    syncPanelTheme(existing);
    return existing;
  }

  const panel = document.createElement("section");
  panel.id = BLOXODES_PANEL_ID;
  panel.className = "Bloxodes-codes-panel";
  panel.setAttribute("aria-label", "Bloxodes Roblox game codes");
  syncPanelTheme(panel);

  const target = findInsertionTarget();
  if (target?.parentElement && target.tagName.toLowerCase() !== "body") {
    target.insertAdjacentElement("afterend", panel);
  } else {
    document.body.prepend(panel);
  }

  return panel;
}

function ensureStatsPanel(): HTMLElement | null {
  const target = findStatsInsertionTarget();
  if (!target) return null;

  const existing = document.getElementById(BLOXODES_STATS_PANEL_ID);
  if (existing) {
    if (existing.previousElementSibling !== target) {
      target.insertAdjacentElement("afterend", existing);
    }
    syncPanelTheme(existing);
    return existing;
  }

  const panel = document.createElement("section");
  panel.id = BLOXODES_STATS_PANEL_ID;
  panel.className = "Bloxodes-stats-panel";
  panel.setAttribute("aria-label", "Bloxodes Roblox player history");
  syncPanelTheme(panel);
  target.insertAdjacentElement("afterend", panel);
  return panel;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return char;
    }
  });
}

function formatAddedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatLastChecked(value: string | null | undefined): string {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function renderShell(title: string, status: string, badge: string, body: string, footer = ""): void {
  const panel = ensurePanel();
  panel.innerHTML = `
    <div class="bloxodes-card">
      <div class="bloxodes-card-header">
        <div class="bloxodes-heading-group">
          <h2 class="bloxodes-title">${escapeHtml(title)}</h2>
          <p class="bloxodes-status">
            <span class="bloxodes-check" aria-hidden="true">✓</span>
            <span>${escapeHtml(status)}</span>
          </p>
        </div>
        <span class="bloxodes-badge">${escapeHtml(badge)}</span>
      </div>
      <div class="bloxodes-card-body">${body}</div>
      ${footer ? `<div class="bloxodes-card-footer">${footer}</div>` : ""}
    </div>
  `;
}

function renderFullListLink(fullListUrl: string): string {
  return `
    <a class="bloxodes-link" href="${escapeHtml(fullListUrl)}" target="_blank" rel="noopener noreferrer">
      <span>Open full list on</span>
      <span class="bloxodes-logo-wrap" aria-label="Bloxodes">
        <img class="bloxodes-logo bloxodes-logo-light" src="${escapeHtml(BLOXODES_LOGO_LIGHT_URL)}" alt="Bloxodes" />
        <img class="bloxodes-logo bloxodes-logo-dark" src="${escapeHtml(BLOXODES_LOGO_DARK_URL)}" alt="" aria-hidden="true" />
      </span>
    </a>
  `;
}

function formatPlayers(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value)));
}

function formatAxisPlayers(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 100_000 ? 0 : 1
  }).format(Math.max(0, Math.round(value)));
}

function formatChartDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatChartTooltip(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function renderHistoryChart(points: BloxodesHistoryPoint[]): string {
  const width = 760;
  const height = 210;
  const padding = {
    top: 18,
    right: 16,
    bottom: 34,
    left: 54
  };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.players);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(rawMax - rawMin, rawMax * 0.08, 1);
  const minValue = Math.max(0, rawMin - spread * 0.08);
  const maxValue = rawMax + spread * 0.08;
  const valueRange = Math.max(maxValue - minValue, 1);

  const coordinates = points.map((point, index) => {
    const x =
      padding.left +
      (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const y =
      padding.top +
      (1 - (point.players - minValue) / valueRange) * plotHeight;
    return { ...point, x, y };
  });

  const line = coordinates
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const area = [
    `${padding.left},${padding.top + plotHeight}`,
    line,
    `${padding.left + plotWidth},${padding.top + plotHeight}`
  ].join(" ");
  const middleValue = minValue + valueRange / 2;
  const gridRows = [maxValue, middleValue, minValue]
    .map((value, index) => {
      const y = padding.top + (index / 2) * plotHeight;
      return `
        <line class="bloxodes-chart-grid" x1="${padding.left}" y1="${y}" x2="${padding.left + plotWidth}" y2="${y}"></line>
        <text class="bloxodes-chart-axis" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(formatAxisPlayers(value))}</text>
      `;
    })
    .join("");
  const pointTargets = coordinates
    .map(
      (point) => `
        <circle class="bloxodes-chart-point" cx="${point.x}" cy="${point.y}" r="3.5">
          <title>${escapeHtml(`${formatChartTooltip(point.sampledAt)}: ${formatPlayers(point.players)} players`)}</title>
        </circle>
        <circle class="bloxodes-chart-hit" cx="${point.x}" cy="${point.y}" r="9">
          <title>${escapeHtml(`${formatChartTooltip(point.sampledAt)}: ${formatPlayers(point.players)} players`)}</title>
        </circle>
      `
    )
    .join("");

  return `
    <div class="bloxodes-chart-wrap">
      <svg class="bloxodes-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Player count history for the last seven days">
        <polygon class="bloxodes-chart-area" points="${area}"></polygon>
        ${gridRows}
        <polyline class="bloxodes-chart-line" points="${line}"></polyline>
        ${pointTargets}
        <text class="bloxodes-chart-axis" x="${padding.left}" y="${height - 8}" text-anchor="start">${escapeHtml(formatChartDate(points[0]?.sampledAt ?? ""))}</text>
        <text class="bloxodes-chart-axis" x="${padding.left + plotWidth}" y="${height - 8}" text-anchor="end">${escapeHtml(formatChartDate(points[points.length - 1]?.sampledAt ?? ""))}</text>
      </svg>
    </div>
  `;
}

function renderStatsFooter(lastUpdatedAt: string | null, fullStatsUrl: string): string {
  const lastUpdated = formatChartTooltip(lastUpdatedAt ?? "");
  return `
    <span>${escapeHtml(lastUpdated ? `Last tracked ${lastUpdated}` : "Bloxodes player tracking")}</span>
    <a class="bloxodes-link" href="${escapeHtml(fullStatsUrl)}" target="_blank" rel="noopener noreferrer">
      <span>View full history on</span>
      <span class="bloxodes-logo-wrap" aria-label="Bloxodes">
        <img class="bloxodes-logo bloxodes-logo-light" src="${escapeHtml(BLOXODES_LOGO_LIGHT_URL)}" alt="Bloxodes" />
        <img class="bloxodes-logo bloxodes-logo-dark" src="${escapeHtml(BLOXODES_LOGO_DARK_URL)}" alt="" aria-hidden="true" />
      </span>
    </a>
  `;
}

function renderHistory(payload: Extract<BloxodesHistoryPayload, { state: "ready" }>): void {
  const panel = ensureStatsPanel();
  if (!panel) return;
  panel.innerHTML = `
    <div class="bloxodes-card">
      <div class="bloxodes-card-header">
        <div class="bloxodes-heading-group">
          <h2 class="bloxodes-title">${escapeHtml(`${payload.game.name} Player History`)}</h2>
          <p class="bloxodes-status">
            <span class="bloxodes-check" aria-hidden="true">✓</span>
            <span>Player activity over the last 7 days</span>
          </p>
        </div>
        <span class="bloxodes-badge">7 days</span>
      </div>
      <div class="bloxodes-card-body">${renderHistoryChart(payload.points)}</div>
      <div class="bloxodes-card-footer">${renderStatsFooter(payload.lastUpdatedAt, payload.fullStatsUrl)}</div>
    </div>
  `;
}

function renderHistoryPending(payload: Extract<BloxodesHistoryPayload, { state: "pending" }>): void {
  const panel = ensureStatsPanel();
  if (!panel) return;
  panel.innerHTML = `
    <div class="bloxodes-card">
      <div class="bloxodes-card-header">
        <div class="bloxodes-heading-group">
          <h2 class="bloxodes-title">${escapeHtml(`${payload.game.name} Player History`)}</h2>
          <p class="bloxodes-status">
            <span class="bloxodes-check" aria-hidden="true">✓</span>
            <span>Bloxodes has started tracking this game</span>
          </p>
        </div>
        <span class="bloxodes-badge">Tracking</span>
      </div>
      <div class="bloxodes-card-body">
        <div class="bloxodes-empty">
          <p class="bloxodes-empty-title">Building player history</p>
          <p>The graph will appear after Bloxodes has collected enough player-count samples.</p>
        </div>
      </div>
      <div class="bloxodes-card-footer">${renderStatsFooter(payload.lastUpdatedAt, payload.fullStatsUrl)}</div>
    </div>
  `;
}

function renderStatsPayload(payload: BloxodesHistoryPayload): void {
  if (payload.state === "ready") {
    renderHistory(payload);
    return;
  }
  if (payload.state === "pending") {
    renderHistoryPending(payload);
    return;
  }
  removeStatsPanel();
}

function renderCodes(payload: BloxodesContentPayload): void {
  const gameName = payload.game?.name ?? "Roblox";
  const codes = payload.codes ?? [];
  const totalActive = payload.totalActive ?? codes.length;
  const fullListUrl = payload.fullListUrl ?? payload.game?.url ?? BLOXODES_CODES_HUB_URL;
  const body = codes.length
    ? `<div class="bloxodes-code-list">
        ${codes
          .map((code, index) => {
            const reward = code.rewardText
              ? /this code gives you/i.test(code.rewardText)
                ? code.rewardText
                : `You get ${code.rewardText}`
              : "No reward listed yet.";
            const addedAt = formatAddedAt(code.addedAt);
            return `
              <article class="bloxodes-code-row">
                <span class="bloxodes-code-index">${index + 1}</span>
                <div class="bloxodes-code-main">
                  <div class="bloxodes-code-line">
                    <code>${escapeHtml(code.code)}</code>
                    ${code.isNew ? `<span class="bloxodes-mini-badge">New</span>` : ""}
                    ${code.levelRequirement != null ? `<span class="bloxodes-mini-badge">Level ${code.levelRequirement}+</span>` : ""}
                  </div>
                  <p>${escapeHtml(reward)}</p>
                </div>
                <div class="bloxodes-code-actions">
                  <button class="bloxodes-copy-button" type="button" data-code="${escapeHtml(code.code)}" aria-label="Copy code ${escapeHtml(code.code)}">
                    <svg aria-hidden="true" class="bloxodes-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <g class="bloxodes-copy-icon-copy">
                        <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                        <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8"></path>
                      </g>
                      <path class="bloxodes-copy-icon-check" d="m5 13 4 4L19 7"></path>
                    </svg>
                    <span class="bloxodes-copy-label">Copy</span>
                  </button>
                  ${addedAt ? `<span class="bloxodes-added">Added ${escapeHtml(addedAt)}</span>` : ""}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>`
    : `
      <div class="bloxodes-empty">
        <p class="bloxodes-empty-title">No active codes right now</p>
        <p>Bloxodes has a page for this game, but no working codes are confirmed at the moment.</p>
      </div>
    `;

  const shownCopy = totalActive > codes.length ? `Showing ${codes.length} of ${totalActive} active codes` : `${totalActive} active codes`;
  renderShell(
    `Active ${gameName} Codes`,
    `Checked and verified on ${formatLastChecked(payload.lastCheckedAt)}`,
    `${totalActive} active`,
    body,
    `<span>${escapeHtml(shownCopy)}</span>${renderFullListLink(fullListUrl)}`
  );

  attachCopyHandlers();
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function attachCopyHandlers(): void {
  document.querySelectorAll<HTMLButtonElement>(".bloxodes-copy-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.dataset.code;
      if (!code) return;
      try {
        await copyText(code);
        button.classList.add("is-copied");
        const label = button.querySelector("span:last-child");
        if (label) label.textContent = "Copied";
        window.setTimeout(() => {
          button.classList.remove("is-copied");
          if (label) label.textContent = "Copy";
        }, 1800);
      } catch {
        const label = button.querySelector("span:last-child");
        if (label) label.textContent = "Copy failed";
      }
    });
  });
}

function requestCodes(message: BloxodesContentRequest): Promise<BloxodesContentResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response?: BloxodesContentResponse) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message ?? "Extension request failed" });
        return;
      }
      resolve(response ?? { ok: false, error: "No response from Bloxodes extension" });
    });
  });
}

function requestHistory(message: BloxodesHistoryRequest): Promise<BloxodesHistoryResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response?: BloxodesHistoryResponse) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message ?? "Extension request failed" });
        return;
      }
      resolve(response ?? { ok: false, error: "No response from Bloxodes extension" });
    });
  });
}

function normalizeWidgetSettings(value: unknown): BloxodesWidgetSettings {
  const settings =
    value && typeof value === "object"
      ? (value as Partial<BloxodesWidgetSettings>)
      : {};
  return {
    showCodes:
      typeof settings.showCodes === "boolean"
        ? settings.showCodes
        : BLOXODES_DEFAULT_SETTINGS.showCodes,
    showHistory:
      typeof settings.showHistory === "boolean"
        ? settings.showHistory
        : BLOXODES_DEFAULT_SETTINGS.showHistory
  };
}

function readWidgetSettings(): Promise<BloxodesWidgetSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(BLOXODES_SETTINGS_KEY, (items) => {
      if (chrome.runtime.lastError) {
        resolve({ ...BLOXODES_DEFAULT_SETTINGS });
        return;
      }
      resolve(normalizeWidgetSettings(items[BLOXODES_SETTINGS_KEY]));
    });
  });
}

async function runCodes(
  placeId: number,
  gameName: string | null,
  requestKey: string
): Promise<void> {
  if (!BLOXODES_STATE.settings.showCodes) {
    removePanel();
    return;
  }

  if (BLOXODES_STATE.lastRequestKey === requestKey) {
    const panel = document.getElementById(BLOXODES_PANEL_ID);
    if (panel) {
      syncPanelTheme(panel);
      return;
    }
    if (BLOXODES_STATE.lastMatchedPayload) {
      renderCodes(BLOXODES_STATE.lastMatchedPayload);
      return;
    }
    if (BLOXODES_STATE.lastHiddenRequestKey === requestKey) {
      removePanel();
      return;
    }
    return;
  }
  BLOXODES_STATE.lastRequestKey = requestKey;

  const response = await requestCodes({
    type: "BLOXODES_GET_CODES",
    placeId,
    gameName
  });
  if (BLOXODES_STATE.lastRequestKey !== requestKey) return;

  if (!response.ok) {
    BLOXODES_STATE.lastHiddenRequestKey = requestKey;
    BLOXODES_STATE.lastMatchedPayload = null;
    removePanel();
    return;
  }

  if (!response.payload.ok || response.payload.matched !== true) {
    BLOXODES_STATE.lastHiddenRequestKey = requestKey;
    BLOXODES_STATE.lastMatchedPayload = null;
    removePanel();
    return;
  }

  BLOXODES_STATE.lastHiddenRequestKey = "";
  BLOXODES_STATE.lastMatchedPayload = response.payload;
  renderCodes(response.payload);
}

async function runHistory(placeId: number, requestKey: string): Promise<void> {
  if (!BLOXODES_STATE.settings.showHistory) {
    removeStatsPanel();
    return;
  }

  if (BLOXODES_STATE.lastStatsRequestKey === requestKey) {
    const panel = document.getElementById(BLOXODES_STATS_PANEL_ID);
    if (panel) {
      syncPanelTheme(panel);
      return;
    }
    if (BLOXODES_STATE.lastStatsPayload) {
      renderStatsPayload(BLOXODES_STATE.lastStatsPayload);
      return;
    }
    if (BLOXODES_STATE.lastStatsHiddenRequestKey === requestKey) {
      removeStatsPanel();
      return;
    }
    return;
  }
  BLOXODES_STATE.lastStatsRequestKey = requestKey;

  const response = await requestHistory({
    type: "BLOXODES_GET_HISTORY",
    placeId
  });
  if (BLOXODES_STATE.lastStatsRequestKey !== requestKey) return;

  if (!response.ok) {
    BLOXODES_STATE.lastStatsHiddenRequestKey = requestKey;
    BLOXODES_STATE.lastStatsPayload = null;
    removeStatsPanel();
    return;
  }

  if (response.payload.state !== "ready" && response.payload.state !== "pending") {
    BLOXODES_STATE.lastStatsHiddenRequestKey = requestKey;
    BLOXODES_STATE.lastStatsPayload = null;
    removeStatsPanel();
    return;
  }

  BLOXODES_STATE.lastStatsHiddenRequestKey = "";
  BLOXODES_STATE.lastStatsPayload = response.payload;
  renderStatsPayload(response.payload);
}

async function run(): Promise<void> {
  const placeId = parsePlaceId(location.href);
  if (!placeId) {
    removePanel();
    removeStatsPanel();
    return;
  }

  const gameName = readGameName();
  const requestKey = `${placeId}:${gameName ?? ""}:${location.pathname}`;
  await Promise.all([
    runCodes(placeId, gameName, requestKey),
    runHistory(placeId, requestKey)
  ]);
}

function scheduleRun(): void {
  window.clearTimeout(BLOXODES_STATE.runTimer);
  BLOXODES_STATE.runTimer = window.setTimeout(() => {
    void run();
  }, 250);
}

function resetWidgetRequestState(): void {
  BLOXODES_STATE.lastHiddenRequestKey = "";
  BLOXODES_STATE.lastMatchedPayload = null;
  BLOXODES_STATE.lastRequestKey = "";
  BLOXODES_STATE.lastStatsHiddenRequestKey = "";
  BLOXODES_STATE.lastStatsPayload = null;
  BLOXODES_STATE.lastStatsRequestKey = "";
}

async function start(): Promise<void> {
  BLOXODES_STATE.settings = await readWidgetSettings();
  scheduleRun();

  BLOXODES_STATE.observer?.disconnect();
  BLOXODES_STATE.observer = new MutationObserver(() => {
    const codesPanel = document.getElementById(BLOXODES_PANEL_ID);
    const statsPanel = document.getElementById(BLOXODES_STATS_PANEL_ID);
    const missingExpectedCodes =
      BLOXODES_STATE.settings.showCodes &&
      BLOXODES_STATE.lastMatchedPayload != null &&
      !codesPanel;
    const missingExpectedStats =
      BLOXODES_STATE.settings.showHistory &&
      BLOXODES_STATE.lastStatsPayload != null &&
      !statsPanel;

    if (missingExpectedCodes || missingExpectedStats) {
      scheduleRun();
    } else {
      syncPanelTheme(codesPanel);
      syncPanelTheme(statsPanel);
    }
  });
  BLOXODES_STATE.observer.observe(document.documentElement, { childList: true, subtree: true });

  let lastUrl = location.href;
  window.clearInterval(BLOXODES_STATE.urlPoll);
  BLOXODES_STATE.urlPoll = window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      resetWidgetRequestState();
      scheduleRun();
    }
  }, 1000);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    const change = changes[BLOXODES_SETTINGS_KEY];
    if (!change) return;

    BLOXODES_STATE.settings = normalizeWidgetSettings(change.newValue);
    resetWidgetRequestState();
    if (!BLOXODES_STATE.settings.showCodes) removePanel();
    if (!BLOXODES_STATE.settings.showHistory) removeStatsPanel();
    scheduleRun();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
} else {
  void start();
}
