type BloxodesBackgroundRequest = {
  type?: string;
  placeId?: number | null;
  gameName?: string | null;
  gameSlug?: string | null;
  code?: string | null;
  used?: boolean;
};

type BloxodesExtensionCode = {
  code: string;
  rewardText: string | null;
  isNew: boolean;
  levelRequirement: number | null;
  addedAt: string | null;
};

type BloxodesExtensionUser = {
  id: string;
  display_name: string | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
};

type BloxodesStoredAuth = {
  token: string;
  expiresAt: string;
  user: BloxodesExtensionUser;
};

type BloxodesExtensionPayload = {
  ok: boolean;
  matched?: boolean;
  game?: {
    name: string;
    slug: string;
    url: string;
    robloxUrl: string | null;
    coverImage: string | null;
  };
  codes?: BloxodesExtensionCode[];
  usedCodes?: string[];
  signedIn?: boolean;
  totalActive?: number;
  shown?: number;
  hasMore?: boolean;
  lastCheckedAt?: string | null;
  fullListUrl?: string;
  codesHubUrl?: string;
  reason?: string;
  error?: string;
};

type BloxodesApiPayload = BloxodesExtensionPayload & {
  state?: string;
  token?: string;
  expiresAt?: string;
  user?: BloxodesExtensionUser | null;
  [key: string]: unknown;
};

type BloxodesBackgroundResponse =
  | {
      ok: true;
      payload: BloxodesApiPayload;
    }
  | {
      ok: false;
      error: string;
    };

const BLOXODES_EXTENSION_API_URL = "https://bloxodes.com/api/extension/roblox-game-codes";
const BLOXODES_EXTENSION_STATS_API_URL = "https://bloxodes.com/api/extension/roblox-game-stats";
const BLOXODES_EXTENSION_AUTH_COMPLETE_URL = "https://bloxodes.com/api/extension/auth/complete";
const BLOXODES_EXTENSION_AUTH_EXCHANGE_URL = "https://bloxodes.com/api/extension/auth/exchange";
const BLOXODES_EXTENSION_AUTH_SESSION_URL = "https://bloxodes.com/api/extension/auth/session";
const BLOXODES_EXTENSION_AUTH_LOGOUT_URL = "https://bloxodes.com/api/extension/auth/logout";
const BLOXODES_EXTENSION_PROGRESS_URL = "https://bloxodes.com/api/extension/codes/progress";
const BLOXODES_EXTENSION_VERSION = "6.0.0";
const AUTH_STORAGE_KEY = "authSession";
const LOCAL_PROGRESS_PREFIX = "codeProgress:";
const PROGRESS_MIGRATION_PREFIX = "codeProgressMigrated:";
const PROGRESS_OWNER_KEY = "codeProgressAccountOwner";
const MAX_USED_CODES = 1000;

class BloxodesApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function buildCodesUrl(message: BloxodesBackgroundRequest): string {
  const url = new URL(BLOXODES_EXTENSION_API_URL);
  if (typeof message.placeId === "number" && Number.isFinite(message.placeId)) {
    url.searchParams.set("placeId", String(message.placeId));
  }
  if (message.gameName) {
    url.searchParams.set("gameName", message.gameName);
  }
  url.searchParams.set("limit", "3");
  return url.toString();
}

function buildStatsUrl(placeId: number): string {
  const url = new URL(BLOXODES_EXTENSION_STATS_API_URL);
  url.searchParams.set("placeId", String(placeId));
  return url.toString();
}

function buildProgressUrl(gameSlug: string): string {
  const url = new URL(BLOXODES_EXTENSION_PROGRESS_URL);
  url.searchParams.set("slug", gameSlug);
  return url.toString();
}

function normalizeUsedCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || trimmed.length > 200 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= MAX_USED_CODES) break;
  }

  return result;
}

function normalizeGameSlug(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 200 ? trimmed : "";
}

function normalizeAuth(value: unknown): BloxodesStoredAuth | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<BloxodesStoredAuth>;
  if (
    typeof candidate.token !== "string" ||
    !candidate.token ||
    typeof candidate.expiresAt !== "string" ||
    !candidate.user ||
    typeof candidate.user.id !== "string"
  ) {
    return null;
  }

  const expiresAt = Date.parse(candidate.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return candidate as BloxodesStoredAuth;
}

function storageLocalGet(
  keys: string | string[] | Record<string, unknown> | null
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => {
      if (chrome.runtime.lastError) {
        resolve({});
        return;
      }
      resolve(items);
    });
  });
}

function storageLocalSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

function storageLocalRemove(keys: string | string[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

function progressStorageKey(gameSlug: string): string {
  return `${LOCAL_PROGRESS_PREFIX}${gameSlug.trim().toLowerCase()}`;
}

function progressMigrationKey(userId: string, gameSlug: string): string {
  return `${PROGRESS_MIGRATION_PREFIX}${userId}:${gameSlug.trim().toLowerCase()}`;
}

async function getLocalProgress(gameSlug: string): Promise<string[]> {
  const key = progressStorageKey(gameSlug);
  const items = await storageLocalGet(key);
  return normalizeUsedCodes(items[key]);
}

async function setLocalProgress(gameSlug: string, usedCodes: string[]): Promise<void> {
  await storageLocalSet({
    [progressStorageKey(gameSlug)]: normalizeUsedCodes(usedCodes)
  });
}

async function getStoredAuth(): Promise<BloxodesStoredAuth | null> {
  const items = await storageLocalGet(AUTH_STORAGE_KEY);
  const auth = normalizeAuth(items[AUTH_STORAGE_KEY]);
  if (!auth && items[AUTH_STORAGE_KEY]) {
    await storageLocalRemove(AUTH_STORAGE_KEY);
  }
  return auth;
}

async function setStoredAuth(auth: BloxodesStoredAuth): Promise<void> {
  await storageLocalSet({ [AUTH_STORAGE_KEY]: auth });
}

async function clearStoredAuth(): Promise<void> {
  await storageLocalRemove(AUTH_STORAGE_KEY);
}

async function resetProgressMigrations(userId: string): Promise<void> {
  const items = await storageLocalGet(null);
  const prefix = `${PROGRESS_MIGRATION_PREFIX}${userId}:`;
  const keys = Object.keys(items).filter((key) => key.startsWith(prefix));
  if (keys.length > 0) {
    await storageLocalRemove(keys);
  }
}

async function fetchPayload(
  url: string,
  init?: RequestInit,
  token?: string | null
): Promise<BloxodesApiPayload> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Bloxodes-Extension", `Bloxodes/${BLOXODES_EXTENSION_VERSION}`);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    ...init,
    headers
  });
  const payload = (await response.json().catch(() => ({}))) as BloxodesApiPayload;

  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : `Bloxodes returned ${response.status}`;
    throw new BloxodesApiError(message, response.status);
  }

  return payload;
}

function authPayload(auth: BloxodesStoredAuth | null): BloxodesApiPayload {
  return {
    ok: true,
    signedIn: Boolean(auth),
    user: auth?.user ?? null
  };
}

async function loadAuthSession(validate: boolean): Promise<BloxodesStoredAuth | null> {
  const auth = await getStoredAuth();
  if (!auth || !validate) return auth;

  try {
    const payload = await fetchPayload(BLOXODES_EXTENSION_AUTH_SESSION_URL, undefined, auth.token);
    if (!payload.user) {
      await clearStoredAuth();
      return null;
    }
    const refreshed = { ...auth, user: payload.user };
    await setStoredAuth(refreshed);
    return refreshed;
  } catch (error) {
    if (error instanceof BloxodesApiError && error.status === 401) {
      await clearStoredAuth();
      return null;
    }
    return auth;
  }
}

function createAuthState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let raw = "";
  bytes.forEach((byte) => {
    raw += String.fromCharCode(byte);
  });
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function launchAuthFlow(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (redirectUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message ?? "Sign-in was canceled."));
        return;
      }
      if (!redirectUrl) {
        reject(new Error("Bloxodes did not return a sign-in result."));
        return;
      }
      resolve(redirectUrl);
    });
  });
}

async function login(): Promise<BloxodesApiPayload> {
  const redirectUri = chrome.identity.getRedirectURL("bloxodes-auth");
  const state = createAuthState();
  const authUrl = new URL(BLOXODES_EXTENSION_AUTH_COMPLETE_URL);
  authUrl.searchParams.set("redirectUri", redirectUri);
  authUrl.searchParams.set("state", state);

  const finalRedirect = new URL(await launchAuthFlow(authUrl.toString()));
  if (
    finalRedirect.origin !== new URL(redirectUri).origin ||
    finalRedirect.pathname !== new URL(redirectUri).pathname ||
    finalRedirect.searchParams.get("state") !== state
  ) {
    throw new Error("Bloxodes returned an invalid sign-in response.");
  }

  const code = finalRedirect.searchParams.get("code");
  if (!code) {
    throw new Error(finalRedirect.searchParams.get("error") ?? "Sign-in did not complete.");
  }

  const payload = await fetchPayload(BLOXODES_EXTENSION_AUTH_EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri })
  });
  if (!payload.token || !payload.expiresAt || !payload.user) {
    throw new Error("Bloxodes returned an incomplete sign-in session.");
  }

  const auth: BloxodesStoredAuth = {
    token: payload.token,
    expiresAt: payload.expiresAt,
    user: payload.user
  };
  await setStoredAuth(auth);
  return authPayload(auth);
}

async function logout(): Promise<BloxodesApiPayload> {
  const auth = await getStoredAuth();
  if (auth) {
    try {
      await fetchPayload(
        BLOXODES_EXTENSION_AUTH_LOGOUT_URL,
        { method: "POST" },
        auth.token
      );
    } catch {
      // Local logout still completes if the server is temporarily unavailable.
    }
    await resetProgressMigrations(auth.user.id);
  }
  await clearStoredAuth();
  return authPayload(null);
}

async function loadCodeProgress(gameSlug: string): Promise<{
  usedCodes: string[];
  signedIn: boolean;
}> {
  const localUsedCodes = await getLocalProgress(gameSlug);
  const auth = await loadAuthSession(false);
  if (!auth) {
    return { usedCodes: localUsedCodes, signedIn: false };
  }

  try {
    const remotePayload = await fetchPayload(buildProgressUrl(gameSlug), undefined, auth.token);
    const remoteUsedCodes = normalizeUsedCodes(remotePayload.usedCodes);
    const migrationKey = progressMigrationKey(auth.user.id, gameSlug);
    const migrationState = await storageLocalGet([migrationKey, PROGRESS_OWNER_KEY]);
    const progressOwner =
      typeof migrationState[PROGRESS_OWNER_KEY] === "string"
        ? migrationState[PROGRESS_OWNER_KEY]
        : null;
    const canMigrate = !progressOwner || progressOwner === auth.user.id;

    if (canMigrate && migrationState[migrationKey] !== true) {
      const mergedUsedCodes = Array.from(new Set([...remoteUsedCodes, ...localUsedCodes]));
      let finalUsedCodes = mergedUsedCodes;
      const needsSave =
        mergedUsedCodes.length !== remoteUsedCodes.length ||
        mergedUsedCodes.some((code) => !remoteUsedCodes.includes(code));

      if (needsSave) {
        const saved = await fetchPayload(
          BLOXODES_EXTENSION_PROGRESS_URL,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: gameSlug, usedCodes: mergedUsedCodes })
          },
          auth.token
        );
        finalUsedCodes = normalizeUsedCodes(saved.usedCodes);
      }

      await storageLocalSet({
        [migrationKey]: true,
        [PROGRESS_OWNER_KEY]: auth.user.id
      });
      await setLocalProgress(gameSlug, finalUsedCodes);
      return { usedCodes: finalUsedCodes, signedIn: true };
    }

    await storageLocalSet({
      [migrationKey]: true,
      [PROGRESS_OWNER_KEY]: auth.user.id
    });
    await setLocalProgress(gameSlug, remoteUsedCodes);
    return { usedCodes: remoteUsedCodes, signedIn: true };
  } catch (error) {
    if (error instanceof BloxodesApiError && error.status === 401) {
      await clearStoredAuth();
      return { usedCodes: localUsedCodes, signedIn: false };
    }
    return { usedCodes: localUsedCodes, signedIn: true };
  }
}

async function saveCodeUsage(message: BloxodesBackgroundRequest): Promise<BloxodesApiPayload> {
  const gameSlug = normalizeGameSlug(message.gameSlug);
  const code = typeof message.code === "string" ? message.code.trim() : "";
  const used = typeof message.used === "boolean" ? message.used : null;
  if (!gameSlug || !code || code.length > 200 || used === null) {
    throw new Error("Invalid code progress update.");
  }

  const localUsedCodes = await getLocalProgress(gameSlug);
  const next = new Set(localUsedCodes);
  if (used) {
    next.add(code);
  } else {
    next.delete(code);
  }
  const optimisticUsedCodes = normalizeUsedCodes(Array.from(next));
  await setLocalProgress(gameSlug, optimisticUsedCodes);

  const auth = await loadAuthSession(false);
  if (!auth) {
    return {
      ok: true,
      usedCodes: optimisticUsedCodes,
      signedIn: false
    };
  }

  try {
    const payload = await fetchPayload(
      BLOXODES_EXTENSION_PROGRESS_URL,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: gameSlug, code, used })
      },
      auth.token
    );
    const usedCodes = normalizeUsedCodes(payload.usedCodes);
    await setLocalProgress(gameSlug, usedCodes);
    return {
      ok: true,
      usedCodes,
      signedIn: true
    };
  } catch (error) {
    if (error instanceof BloxodesApiError && error.status === 401) {
      await clearStoredAuth();
      return {
        ok: true,
        usedCodes: optimisticUsedCodes,
        signedIn: false
      };
    }
    throw error;
  }
}

const SUPPORTED_MESSAGES = new Set([
  "BLOXODES_GET_CODES",
  "BLOXODES_GET_HISTORY",
  "BLOXODES_AUTH_SESSION",
  "BLOXODES_AUTH_LOGIN",
  "BLOXODES_AUTH_LOGOUT",
  "BLOXODES_SAVE_CODE_PROGRESS"
]);

chrome.runtime.onMessage.addListener(
  (
    message: BloxodesBackgroundRequest,
    _sender: unknown,
    sendResponse: (response: BloxodesBackgroundResponse) => void
  ) => {
    if (!message?.type || !SUPPORTED_MESSAGES.has(message.type)) {
      return false;
    }

    void (async () => {
      try {
        if (message.type === "BLOXODES_AUTH_SESSION") {
          sendResponse({ ok: true, payload: authPayload(await loadAuthSession(true)) });
          return;
        }

        if (message.type === "BLOXODES_AUTH_LOGIN") {
          sendResponse({ ok: true, payload: await login() });
          return;
        }

        if (message.type === "BLOXODES_AUTH_LOGOUT") {
          sendResponse({ ok: true, payload: await logout() });
          return;
        }

        if (message.type === "BLOXODES_SAVE_CODE_PROGRESS") {
          sendResponse({ ok: true, payload: await saveCodeUsage(message) });
          return;
        }

        if (message.type === "BLOXODES_GET_CODES") {
          const payload = await fetchPayload(buildCodesUrl(message));
          if (payload.matched === true && payload.game?.slug) {
            const progress = await loadCodeProgress(payload.game.slug);
            payload.usedCodes = progress.usedCodes;
            payload.signedIn = progress.signedIn;
          }
          sendResponse({ ok: true, payload });
          return;
        }

        if (
          typeof message.placeId !== "number" ||
          !Number.isSafeInteger(message.placeId) ||
          message.placeId <= 0
        ) {
          sendResponse({ ok: false, error: "Invalid Roblox place ID" });
          return;
        }

        let payload = await fetchPayload(buildStatsUrl(message.placeId));
        if (payload.state === "untracked") {
          payload = await fetchPayload(BLOXODES_EXTENSION_STATS_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ placeId: message.placeId })
          });
        }
        sendResponse({ ok: true, payload });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Could not reach Bloxodes"
        });
      }
    })();

    return true;
  }
);
