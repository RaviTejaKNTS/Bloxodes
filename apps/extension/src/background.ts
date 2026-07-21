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

type BloxodesBackgroundResponse =
  | {
      ok: true;
      payload: BloxodesExtensionPayload;
    }
  | {
      ok: false;
      error: string;
    };

const BLOXODES_EXTENSION_API_URL = "https://bloxodes.com/api/extension/roblox-game-codes";

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

chrome.runtime.onMessage.addListener((message: BloxodesBackgroundRequest, _sender: unknown, sendResponse: (response: BloxodesBackgroundResponse) => void) => {
  if (message?.type !== "BLOXODES_GET_CODES") {
    return false;
  }

  void (async () => {
    try {
      const response = await fetch(buildCodesUrl(message), {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        credentials: "omit",
        cache: "no-store"
      });

      if (!response.ok) {
        sendResponse({ ok: false, error: `Bloxodes returned ${response.status}` });
        return;
      }

      const payload = (await response.json()) as BloxodesExtensionPayload;
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
