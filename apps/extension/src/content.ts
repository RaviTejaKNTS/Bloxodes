type BloxodesContentRequest = {
  type: "BLOXODES_GET_CODES";
  placeId: number | null;
  robloxUrl: string;
  gameName: string | null;
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

const BLOXODES_PANEL_ID = "bloxodes-codes-extension";
const BLOXODES_CODES_HUB_URL = "https://bloxodes.com/codes";
const BLOXODES_LOGO_DARK_URL = chrome.runtime.getURL("brand/Bloxodes-dark.png");
const BLOXODES_LOGO_LIGHT_URL = chrome.runtime.getURL("brand/Bloxodes-light.png");
const BLOXODES_STATE = {
  lastHiddenRequestKey: "",
  lastMatchedPayload: null as BloxodesContentPayload | null,
  lastRequestKey: "",
  observer: null as MutationObserver | null,
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

function removePanel(): void {
  document.getElementById(BLOXODES_PANEL_ID)?.remove();
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

function syncPanelTheme(panel = document.getElementById(BLOXODES_PANEL_ID)): void {
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

async function run(): Promise<void> {
  const placeId = parsePlaceId(location.href);
  if (!placeId) {
    document.getElementById(BLOXODES_PANEL_ID)?.remove();
    return;
  }

  const gameName = readGameName();
  const requestKey = `${placeId}:${gameName ?? ""}:${location.pathname}`;
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
    robloxUrl: location.href,
    gameName
  });

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

function scheduleRun(): void {
  window.setTimeout(() => {
    void run();
  }, 250);
}

function start(): void {
  scheduleRun();

  BLOXODES_STATE.observer?.disconnect();
  BLOXODES_STATE.observer = new MutationObserver(() => {
    const panel = document.getElementById(BLOXODES_PANEL_ID);
    if (!panel) {
      scheduleRun();
    } else {
      syncPanelTheme(panel);
    }
  });
  BLOXODES_STATE.observer.observe(document.documentElement, { childList: true, subtree: true });

  let lastUrl = location.href;
  window.clearInterval(BLOXODES_STATE.urlPoll);
  BLOXODES_STATE.urlPoll = window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      BLOXODES_STATE.lastHiddenRequestKey = "";
      BLOXODES_STATE.lastMatchedPayload = null;
      BLOXODES_STATE.lastRequestKey = "";
      scheduleRun();
    }
  }, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
