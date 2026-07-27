export {};

type BloxodesWidgetSettings = {
  showCodes: boolean;
  showHistory: boolean;
};

type BloxodesExtensionUser = {
  id: string;
  display_name: string | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
};

type BloxodesPopupResponse =
  | {
      ok: true;
      payload: {
        ok: boolean;
        signedIn?: boolean;
        user?: BloxodesExtensionUser | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

const SETTINGS_KEY = "widgetSettings";
const AUTH_STORAGE_KEY = "authSession";
const DEFAULT_SETTINGS: BloxodesWidgetSettings = {
  showCodes: true,
  showHistory: true
};

const codesToggle = document.querySelector<HTMLInputElement>("#show-codes");
const historyToggle = document.querySelector<HTMLInputElement>("#show-history");
const saveStatus = document.querySelector<HTMLElement>("#save-status");
const authLoading = document.querySelector<HTMLElement>("#auth-loading");
const signedOut = document.querySelector<HTMLElement>("#signed-out");
const signedIn = document.querySelector<HTMLElement>("#signed-in");
const signInButton = document.querySelector<HTMLButtonElement>("#sign-in");
const signOutButton = document.querySelector<HTMLButtonElement>("#sign-out");
const authStatus = document.querySelector<HTMLElement>("#auth-status");
const accountName = document.querySelector<HTMLElement>("#account-name");
const accountUsername = document.querySelector<HTMLElement>("#account-username");
const accountAvatar = document.querySelector<HTMLImageElement>("#account-avatar");
const accountAvatarFallback = document.querySelector<HTMLElement>("#account-avatar-fallback");

function normalizeSettings(value: unknown): BloxodesWidgetSettings {
  const settings =
    value && typeof value === "object"
      ? (value as Partial<BloxodesWidgetSettings>)
      : {};
  return {
    showCodes:
      typeof settings.showCodes === "boolean"
        ? settings.showCodes
        : DEFAULT_SETTINGS.showCodes,
    showHistory:
      typeof settings.showHistory === "boolean"
        ? settings.showHistory
        : DEFAULT_SETTINGS.showHistory
  };
}

function readSettings(): Promise<BloxodesWidgetSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_KEY, (items) => {
      if (chrome.runtime.lastError) {
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }
      resolve(normalizeSettings(items[SETTINGS_KEY]));
    });
  });
}

function writeSettings(settings: BloxodesWidgetSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, resolve);
  });
}

function sendRequest(type: string): Promise<BloxodesPopupResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (response?: BloxodesPopupResponse) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message ?? "Extension request failed"
        });
        return;
      }
      resolve(response ?? { ok: false, error: "No response from Bloxodes extension" });
    });
  });
}

function setAuthLoading(loading: boolean) {
  if (authLoading) authLoading.hidden = !loading;
  if (signInButton) signInButton.disabled = loading;
  if (signOutButton) signOutButton.disabled = loading;
}

function renderAuth(user: BloxodesExtensionUser | null) {
  setAuthLoading(false);
  if (signedOut) signedOut.hidden = Boolean(user);
  if (signedIn) signedIn.hidden = !user;

  if (!user) {
    if (accountAvatar) {
      accountAvatar.hidden = true;
      accountAvatar.removeAttribute("src");
    }
    if (accountAvatarFallback) accountAvatarFallback.hidden = false;
    return;
  }

  const displayName =
    user.display_name ??
    user.roblox_display_name ??
    user.roblox_username ??
    "Bloxodes user";
  if (accountName) accountName.textContent = displayName;
  if (accountUsername) {
    accountUsername.textContent = user.roblox_username ? `@${user.roblox_username}` : "";
  }

  if (accountAvatar && user.roblox_avatar_url) {
    accountAvatar.src = user.roblox_avatar_url;
    accountAvatar.alt = `${displayName} avatar`;
    accountAvatar.hidden = false;
    if (accountAvatarFallback) accountAvatarFallback.hidden = true;
  } else {
    if (accountAvatar) accountAvatar.hidden = true;
    if (accountAvatarFallback) {
      accountAvatarFallback.textContent = displayName.slice(0, 1).toUpperCase();
      accountAvatarFallback.hidden = false;
    }
  }
}

async function loadSession(): Promise<void> {
  setAuthLoading(true);
  const response = await sendRequest("BLOXODES_AUTH_SESSION");
  if (!response.ok) {
    renderAuth(null);
    if (authStatus) authStatus.textContent = response.error;
    return;
  }
  renderAuth(response.payload.user ?? null);
}

async function login(): Promise<void> {
  setAuthLoading(true);
  if (authStatus) authStatus.textContent = "Complete sign-in in the window that opens.";
  const response = await sendRequest("BLOXODES_AUTH_LOGIN");
  if (!response.ok) {
    setAuthLoading(false);
    if (authStatus) authStatus.textContent = response.error;
    return;
  }
  renderAuth(response.payload.user ?? null);
  if (authStatus) authStatus.textContent = "Code progress is now synced.";
}

async function logout(): Promise<void> {
  setAuthLoading(true);
  const response = await sendRequest("BLOXODES_AUTH_LOGOUT");
  renderAuth(null);
  if (authStatus) {
    authStatus.textContent = response.ok ? "Signed out of this extension." : response.error;
  }
}

async function save(): Promise<void> {
  if (!codesToggle || !historyToggle) return;
  if (saveStatus) saveStatus.textContent = "Saving…";
  await writeSettings({
    showCodes: codesToggle.checked,
    showHistory: historyToggle.checked
  });
  if (saveStatus) saveStatus.textContent = "Changes applied.";
}

async function start(): Promise<void> {
  const settings = await readSettings();
  if (codesToggle) {
    codesToggle.checked = settings.showCodes;
    codesToggle.addEventListener("change", () => void save());
  }
  if (historyToggle) {
    historyToggle.checked = settings.showHistory;
    historyToggle.addEventListener("change", () => void save());
  }
  signInButton?.addEventListener("click", () => void login());
  signOutButton?.addEventListener("click", () => void logout());

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[AUTH_STORAGE_KEY]) {
      void loadSession();
    }
  });

  await loadSession();
}

void start();
