type ModerationResult = {
  flagged?: boolean;
  categories?: Record<string, boolean>;
  category_scores?: Record<string, number>;
};

type ModerationResponse = {
  results?: ModerationResult[];
};

type ModerationRequestResult = {
  moderation: ModerationResponse | null;
  failureReason: string | null;
  httpStatus: number | null;
};

export type CommentModerationDecision = {
  approved: boolean;
  moderation: Record<string, unknown>;
};

const CATEGORY_SCORE_THRESHOLDS: Record<string, number> = {
  sexual: 0.1,
  "sexual/minors": 0.01,
  harassment: 0.5,
  "harassment/threatening": 0.2,
  hate: 0.5,
  "hate/threatening": 0.2,
  violence: 0.5,
  "violence/graphic": 0.2,
  "self-harm": 0.5,
  "self-harm/intent": 0.2,
  "self-harm/instructions": 0.2,
  illicit: 0.5,
  "illicit/violent": 0.2
};

function isCategoryHit(categories?: Record<string, boolean>): boolean {
  if (!categories) return false;
  return Object.values(categories).some(Boolean);
}

function isScoreHit(scores?: Record<string, number>): boolean {
  if (!scores) return false;
  for (const [key, threshold] of Object.entries(CATEGORY_SCORE_THRESHOLDS)) {
    const score = scores[key];
    if (typeof score === "number" && score >= threshold) {
      return true;
    }
  }
  return false;
}

export function evaluateModerationResponse(moderation: ModerationResponse | null): boolean {
  if (!moderation) return false;
  const result = moderation.results?.[0];
  if (!result) return false;
  const flagged = result.flagged === true;
  const categoryHit = isCategoryHit(result.categories);
  const scoreHit = isScoreHit(result.category_scores);
  return !(flagged || categoryHit || scoreHit);
}

async function runOpenAiModeration(input: string): Promise<ModerationRequestResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      moderation: null,
      failureReason: "missing_openai_api_key",
      httpStatus: null
    };
  }

  const model = process.env.OPENAI_MODERATION_MODEL ?? "omni-moderation-latest";

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model, input })
    });

    if (!res.ok) {
      const message = await res.text().catch(() => "");
      console.error("Moderation request failed", { status: res.status, message });
      return {
        moderation: null,
        failureReason: `http_${res.status}`,
        httpStatus: res.status
      };
    }

    return {
      moderation: (await res.json()) as ModerationResponse,
      failureReason: null,
      httpStatus: res.status
    };
  } catch (error) {
    console.error("Moderation request crashed", error);
    return {
      moderation: null,
      failureReason: "request_failed",
      httpStatus: null
    };
  }
}

export async function moderateCommentBody(input: string): Promise<CommentModerationDecision> {
  const openAiResult = await runOpenAiModeration(input);
  const approved = evaluateModerationResponse(openAiResult.moderation);

  return {
    approved,
    moderation: {
      provider: "openai",
      approved,
      failure_reason: approved ? null : (openAiResult.failureReason ?? "unsafe_or_invalid_openai_response"),
      http_status: openAiResult.httpStatus,
      response: openAiResult.moderation
    }
  };
}
