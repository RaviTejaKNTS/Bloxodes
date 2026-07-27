type BloxodesBackgroundRequest = {
  type?: string;
  placeId?: number | null;
  gameName?: string | null;
};

type BloxodesExtensionCode = {
  code: string;
  rewardText: string | null;
  isNew: boolean;
  levelRequirement: number | null;
  addedAt: string | null;
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
const BLOXODES_EXTENSION_VERSION = "5.0.0";

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

async function fetchPayload(url: string, init?: RequestInit): Promise<BloxodesApiPayload> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Bloxodes-Extension": `Bloxodes/${BLOXODES_EXTENSION_VERSION}`
    },
    credentials: "omit",
    cache: "no-store",
    ...init
  });

  if (!response.ok) {
    throw new Error(`Bloxodes returned ${response.status}`);
  }

  return (await response.json()) as BloxodesApiPayload;
}

chrome.runtime.onMessage.addListener((message: BloxodesBackgroundRequest, _sender: unknown, sendResponse: (response: BloxodesBackgroundResponse) => void) => {
  if (message?.type !== "BLOXODES_GET_CODES" && message?.type !== "BLOXODES_GET_HISTORY") {
    return false;
  }

  void (async () => {
    try {
      if (message.type === "BLOXODES_GET_CODES") {
        const payload = await fetchPayload(buildCodesUrl(message));
        sendResponse({ ok: true, payload });
        return;
      }

      if (typeof message.placeId !== "number" || !Number.isSafeInteger(message.placeId) || message.placeId <= 0) {
        sendResponse({ ok: false, error: "Invalid Roblox place ID" });
        return;
      }

      let payload = await fetchPayload(buildStatsUrl(message.placeId));
      if (payload.state === "untracked") {
        payload = await fetchPayload(BLOXODES_EXTENSION_STATS_API_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Bloxodes-Extension": `Bloxodes/${BLOXODES_EXTENSION_VERSION}`
          },
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
});
