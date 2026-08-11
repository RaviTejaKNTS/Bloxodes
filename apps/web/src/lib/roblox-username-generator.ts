import {
  ROBLOX_USERNAME_BLOCKED_FRAGMENTS,
  ROBLOX_USERNAME_INVENTED_PREFIXES,
  ROBLOX_USERNAME_INVENTED_SUFFIXES,
  ROBLOX_USERNAME_PARTS,
  ROBLOX_USERNAME_SUFFIXES,
  ROBLOX_USERNAME_VIBES,
  type RobloxUsernameVibe
} from "@/data/roblox-username-parts";

export type UsernamePreference = "clean" | "balanced" | "unique";
export type UsernameGenerationMode = "generate" | "remix";

export type UsernameGeneratorOptions = {
  mode: UsernameGenerationMode;
  keyword: string;
  sourceUsername: string;
  vibes: RobloxUsernameVibe[];
  minLength: number;
  maxLength: number;
  allowNumbers: boolean;
  allowUnderscore: boolean;
  alliteration: boolean;
  mustIncludeKeyword: boolean;
  preference: UsernamePreference;
  amount: number;
};

export type UsernameCandidate = {
  username: string;
  score: number;
  tags: string[];
};

export type RobloxUsernameValidationStatus =
  | "available"
  | "taken"
  | "inappropriate"
  | "invalid"
  | "unverified";

export type RobloxUsernameValidation = {
  status: RobloxUsernameValidationStatus;
  code: number | null;
  message: string;
};

export type CheckedUsernameResult = {
  username: string;
  status: RobloxUsernameValidationStatus;
  message: string;
  checkedAt: string | null;
  length: number;
  tags: string[];
};

type NormalizeSuccess = { ok: true; options: UsernameGeneratorOptions };
type NormalizeFailure = { ok: false; error: { code: string; message: string } };
export type NormalizeUsernameOptionsResult = NormalizeSuccess | NormalizeFailure;

const ALL_CONCRETE_VIBES = ROBLOX_USERNAME_VIBES.filter(
  (vibe): vibe is Exclude<RobloxUsernameVibe, "any"> => vibe !== "any"
);

const DEFAULT_OPTIONS: UsernameGeneratorOptions = {
  mode: "generate",
  keyword: "",
  sourceUsername: "",
  vibes: ["any"],
  minLength: 8,
  maxLength: 14,
  allowNumbers: true,
  allowUnderscore: false,
  alliteration: false,
  mustIncludeKeyword: true,
  preference: "balanced",
  amount: 12
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function looksLikePersonalInformation(value: string): boolean {
  const compactDigits = value.replace(/\D/g, "");
  return (
    /@/.test(value) ||
    /(?:https?:\/\/|www\.)/i.test(value) ||
    compactDigits.length >= 7 ||
    value.trim().split(/\s+/).filter(Boolean).length > 1
  );
}

function normalizeKeyword(value: unknown): { value: string; error?: string } {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { value: "" };
  if (looksLikePersonalInformation(raw)) {
    return {
      value: "",
      error: "Use one safe nickname or theme word. Do not enter a real full name, email, phone number, URL, or birthday."
    };
  }
  if (!/^[A-Za-z0-9]+$/.test(raw)) {
    return { value: "", error: "The keyword can use letters and numbers only, with no spaces or symbols." };
  }
  if (raw.length > 12) {
    return { value: "", error: "Keep the keyword to 12 characters or fewer." };
  }
  if (containsBlockedFragment(raw)) {
    return { value: "", error: "Choose a personal theme word instead of an official-looking or account-related term." };
  }
  return { value: raw };
}

function normalizeSourceUsername(value: unknown): { value: string; error?: string } {
  const raw = typeof value === "string" ? value.trim().replace(/^@+/, "") : "";
  if (!raw) return { value: "" };
  if (!/^[A-Za-z0-9_]{3,20}$/.test(raw) || raw.startsWith("_") || raw.endsWith("_") || (raw.match(/_/g)?.length ?? 0) > 1) {
    return { value: "", error: "Enter a Roblox-style username with 3 to 20 letters, numbers, and at most one internal underscore." };
  }
  return { value: raw };
}

export function normalizeUsernameGeneratorOptions(input: unknown): NormalizeUsernameOptionsResult {
  const payload = isRecord(input) ? input : {};
  const mode: UsernameGenerationMode = payload.mode === "remix" ? "remix" : "generate";
  const keyword = normalizeKeyword(payload.keyword);
  if (keyword.error) return { ok: false, error: { code: "UNSAFE_KEYWORD", message: keyword.error } };

  const sourceUsername = normalizeSourceUsername(payload.sourceUsername);
  if (sourceUsername.error) return { ok: false, error: { code: "INVALID_SOURCE_USERNAME", message: sourceUsername.error } };
  if (mode === "remix" && !sourceUsername.value) {
    return { ok: false, error: { code: "MISSING_SOURCE_USERNAME", message: "Choose a username to remix." } };
  }

  const minLength = boundedInteger(payload.minLength, DEFAULT_OPTIONS.minLength, 3, 20);
  const maxLength = boundedInteger(payload.maxLength, DEFAULT_OPTIONS.maxLength, 3, 20);
  if (minLength > maxLength) {
    return { ok: false, error: { code: "INVALID_LENGTH_RANGE", message: "Minimum length cannot be greater than maximum length." } };
  }
  if (keyword.value && optionalBoolean(payload.mustIncludeKeyword, true) && keyword.value.length > maxLength) {
    return {
      ok: false,
      error: { code: "KEYWORD_TOO_LONG", message: "Raise the maximum length or use a shorter keyword so it can fit." }
    };
  }

  const requestedVibes = Array.isArray(payload.vibes) ? payload.vibes : DEFAULT_OPTIONS.vibes;
  const vibes = Array.from(
    new Set(
      requestedVibes.filter(
        (value): value is RobloxUsernameVibe => typeof value === "string" && ROBLOX_USERNAME_VIBES.includes(value as RobloxUsernameVibe)
      )
    )
  ).slice(0, 4);

  const preference: UsernamePreference =
    payload.preference === "clean" || payload.preference === "unique" ? payload.preference : "balanced";

  return {
    ok: true,
    options: {
      mode,
      keyword: keyword.value,
      sourceUsername: sourceUsername.value,
      vibes: vibes.length ? vibes : ["any"],
      minLength,
      maxLength,
      allowNumbers: optionalBoolean(payload.allowNumbers, DEFAULT_OPTIONS.allowNumbers),
      allowUnderscore: optionalBoolean(payload.allowUnderscore, DEFAULT_OPTIONS.allowUnderscore),
      alliteration: optionalBoolean(payload.alliteration, DEFAULT_OPTIONS.alliteration),
      mustIncludeKeyword: optionalBoolean(payload.mustIncludeKeyword, Boolean(keyword.value)),
      preference,
      amount: boundedInteger(payload.amount, DEFAULT_OPTIONS.amount, 4, 20)
    }
  };
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: string | number): () => number {
  let state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

function capitalize(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function concreteVibes(vibes: RobloxUsernameVibe[]): Exclude<RobloxUsernameVibe, "any">[] {
  if (!vibes.length || vibes.includes("any")) return [...ALL_CONCRETE_VIBES];
  return vibes.filter((vibe): vibe is Exclude<RobloxUsernameVibe, "any"> => vibe !== "any");
}

function usernameParts(vibes: Exclude<RobloxUsernameVibe, "any">[]) {
  return {
    first: vibes.flatMap((vibe) => ROBLOX_USERNAME_PARTS[vibe].first),
    second: vibes.flatMap((vibe) => ROBLOX_USERNAME_PARTS[vibe].second)
  };
}

function safeJoin(first: string, second: string, useUnderscore: boolean): string {
  return `${first}${useUnderscore ? "_" : ""}${second}`;
}

function normalizedCandidate(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

function containsBlockedFragment(value: string): boolean {
  const normalized = value.toLowerCase();
  return ROBLOX_USERNAME_BLOCKED_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function isStructurallyValid(value: string, options: UsernameGeneratorOptions): boolean {
  if (value.length < options.minLength || value.length > options.maxLength) return false;
  if (!/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?$/.test(value)) return false;
  if (!options.allowUnderscore && value.includes("_")) return false;
  if (!options.allowNumbers && /\d/.test(value)) return false;
  if (/(.)\1\1/i.test(value)) return false;
  if (value.length % 2 === 0) {
    const half = value.length / 2;
    if (value.slice(0, half).toLowerCase() === value.slice(half).toLowerCase()) return false;
  }
  if (containsBlockedFragment(value)) return false;
  if (options.keyword && options.mustIncludeKeyword && !value.toLowerCase().includes(options.keyword.toLowerCase())) return false;
  return true;
}

function candidateScore(value: string, options: UsernameGeneratorOptions): number {
  const length = value.length;
  let score = 100;
  if (length >= 7 && length <= 14) score += 12;
  score -= Math.abs(length - 10) * 1.5;

  const digitCount = (value.match(/\d/g) ?? []).length;
  const underscoreCount = (value.match(/_/g) ?? []).length;
  if (digitCount === 0) score += options.preference === "clean" ? 10 : 5;
  if (digitCount > 2) score -= 16;
  if (underscoreCount === 0) score += options.preference === "clean" ? 8 : 3;
  if (/[lI1]{2,}|[O0]{2,}/.test(value)) score -= 8;
  if (/\d{3,}/.test(value)) score -= 14;
  if (/(.)\1/i.test(value)) score -= 6;

  const letters = value.replace(/[^A-Za-z]/g, "");
  const vowels = (letters.match(/[aeiouy]/gi) ?? []).length;
  const vowelRatio = letters.length ? vowels / letters.length : 0;
  if (vowelRatio >= 0.25 && vowelRatio <= 0.6) score += 6;
  else score -= 8;

  if (options.keyword && value.toLowerCase().includes(options.keyword.toLowerCase())) score += 14;
  if (options.alliteration) score += 4;
  if (options.preference === "unique" && (digitCount > 0 || /(?:lia|lyn|mira|nori|ren|rio|sora|ven|vix|zen)$/i.test(value))) {
    score += 8;
  }
  return Math.round(score * 10) / 10;
}

function candidateTags(value: string, options: UsernameGeneratorOptions, isRemix: boolean): string[] {
  const tags: string[] = [];
  if (isRemix) tags.push("Remix");
  if (options.keyword && value.toLowerCase().includes(options.keyword.toLowerCase())) {
    tags.push(`Includes ${capitalize(options.keyword)}`);
  }
  if (!/\d/.test(value)) tags.push("No numbers");
  if (value.length <= 10) tags.push("Short");
  if (options.alliteration) tags.push("Alliteration");
  return tags.slice(0, 3);
}

function alliterativeSecond(first: string, seconds: readonly string[], random: () => number): string {
  const matching = seconds.filter((part) => part.charAt(0).toLowerCase() === first.charAt(0).toLowerCase());
  return matching.length ? pick(matching, random) : pick(seconds, random);
}

function addLengthHelper(value: string, options: UsernameGeneratorOptions, random: () => number): string {
  if (value.length >= options.minLength) return value;
  const missing = options.minLength - value.length;
  if (options.allowNumbers && missing <= 2 && value.length + missing <= options.maxLength) {
    const lowerBound = missing === 1 ? 1 : 10;
    const range = missing === 1 ? 9 : 90;
    return `${value}${lowerBound + Math.floor(random() * range)}`;
  }

  const helpers = [...ROBLOX_USERNAME_SUFFIXES, ...ROBLOX_USERNAME_INVENTED_SUFFIXES]
    .filter((suffix) => value.length + suffix.length >= options.minLength && value.length + suffix.length <= options.maxLength)
    .sort((left, right) => left.length - right.length);
  return helpers.length ? `${value}${pick(helpers.slice(0, Math.min(4, helpers.length)), random)}` : value;
}

function buildStandardCandidate(options: UsernameGeneratorOptions, random: () => number): string {
  const parts = usernameParts(concreteVibes(options.vibes));
  const keyword = capitalize(options.keyword);
  const alliterativeFirst = options.alliteration
    ? parts.first.filter((part) =>
        parts.second.some((candidate) => candidate.charAt(0).toLowerCase() === part.charAt(0).toLowerCase())
      )
    : [];
  const first = pick(alliterativeFirst.length ? alliterativeFirst : parts.first, random);
  const second = options.alliteration ? alliterativeSecond(first, parts.second, random) : pick(parts.second, random);
  const inventedPrefix = pick(ROBLOX_USERNAME_INVENTED_PREFIXES, random);
  const inventedSuffix = pick(ROBLOX_USERNAME_INVENTED_SUFFIXES, random);
  const suffix = pick(ROBLOX_USERNAME_SUFFIXES, random);
  const underscoreChance = options.preference === "unique" ? 0.28 : 0.14;
  const useUnderscore = options.allowUnderscore && random() < underscoreChance;
  const template = Math.floor(random() * (keyword ? 10 : 8));

  let value: string;
  if (keyword && (options.mustIncludeKeyword || template >= 6)) {
    const keywordTemplate = Math.floor(random() * (options.alliteration ? 2 : 5));
    const globalPartners = usernameParts(ALL_CONCRETE_VIBES);
    const keywordPartners = [...globalPartners.first, ...globalPartners.second, ...ROBLOX_USERNAME_SUFFIXES].filter(
      (part) => part.charAt(0).toLowerCase() === keyword.charAt(0).toLowerCase()
    );
    const keywordPartner = keywordPartners.length
      ? pick(keywordPartners, random)
      : `${keyword.charAt(0).toUpperCase()}${inventedSuffix}`;
    const keywordSecond = options.alliteration ? keywordPartner : second;
    const keywordFirst = options.alliteration ? keywordPartner : first;
    value =
      keywordTemplate === 0
        ? safeJoin(keyword, keywordSecond, useUnderscore)
        : keywordTemplate === 1
          ? safeJoin(keywordFirst, keyword, useUnderscore)
          : keywordTemplate === 2
            ? `${keyword}${suffix}`
            : keywordTemplate === 3
              ? `${inventedPrefix}${keyword}`
              : `${keyword}${inventedSuffix}`;
  } else {
    value =
      template === 0
        ? safeJoin(first, second, useUnderscore)
        : template === 1
          ? safeJoin(second, first, useUnderscore)
          : template === 2
            ? `${inventedPrefix}${inventedSuffix}`
            : template === 3
              ? `${first}${suffix}`
              : template === 4
                ? `${second}${suffix}`
                : template === 5
                  ? `${inventedPrefix}${second}`
                  : template === 6
                    ? `${first}${inventedSuffix}`
                    : `${second}${inventedSuffix}`;
  }

  const numberChance = options.preference === "unique" ? 0.45 : options.preference === "balanced" ? 0.22 : 0.06;
  if (options.allowNumbers && random() < numberChance) {
    value += String(10 + Math.floor(random() * 90));
  }
  return addLengthHelper(normalizedCandidate(value), options, random);
}

function buildRemixCandidate(options: UsernameGeneratorOptions, random: () => number): string {
  const parts = usernameParts(concreteVibes(options.vibes));
  const source = normalizedCandidate(options.sourceUsername);
  const withoutDigits = source.replace(/\d+$/g, "").replace(/_/g, "");
  const maximumCoreLength = Math.max(3, options.maxLength - 3);
  const core = (withoutDigits || source).slice(0, maximumCoreLength);
  const first = pick(parts.first, random);
  const second = pick(parts.second, random);
  const suffix = pick(ROBLOX_USERNAME_SUFFIXES, random);
  const number = String(10 + Math.floor(random() * 90));
  const template = Math.floor(random() * 6);
  const roomForPrefix = Math.max(2, options.maxLength - core.length);
  const shortFirst = first.slice(0, roomForPrefix);
  const shortSecond = second.slice(0, roomForPrefix);
  const shortSuffix = suffix.slice(0, roomForPrefix);
  const matchingPartners = [...parts.first, ...parts.second, ...ROBLOX_USERNAME_SUFFIXES].filter(
    (part) => part.charAt(0).toLowerCase() === core.charAt(0).toLowerCase()
  );
  const alliterativePartner = matchingPartners.length
    ? pick(matchingPartners, random).slice(0, roomForPrefix)
    : `${core.charAt(0).toUpperCase()}${pick(ROBLOX_USERNAME_INVENTED_SUFFIXES, random)}`.slice(0, roomForPrefix);

  let value = options.alliteration
    ? random() < 0.5
      ? `${core}${alliterativePartner}`
      : `${alliterativePartner}${core}`
    :
    template === 0
      ? `${core}${shortSuffix}`
      : template === 1
        ? `${shortFirst}${core}`
        : template === 2
          ? `${core}${shortSecond}`
          : template === 3 && options.allowUnderscore
            ? `${core}_${shortSecond}`
            : template === 4 && options.allowNumbers
              ? `${core.slice(0, Math.max(3, options.maxLength - 2))}${number}`
              : `${core}${pick(ROBLOX_USERNAME_INVENTED_SUFFIXES, random).slice(0, roomForPrefix)}`;

  value = addLengthHelper(normalizedCandidate(value), options, random);
  return value.toLowerCase() === source.toLowerCase() ? `${core.slice(0, Math.max(3, options.maxLength - 2))}${number}` : value;
}

export function generateUsernameCandidates(
  options: UsernameGeneratorOptions,
  seed: string | number,
  poolSize = 300
): UsernameCandidate[] {
  const random = createRandom(seed);
  const unique = new Map<string, UsernameCandidate>();
  const attempts = Math.min(2000, Math.max(poolSize * 8, 200));

  for (let index = 0; index < attempts && unique.size < poolSize; index += 1) {
    const isRemix = options.mode === "remix";
    const username = isRemix ? buildRemixCandidate(options, random) : buildStandardCandidate(options, random);
    if (!isStructurallyValid(username, options)) continue;
    const key = username.toLowerCase();
    if (unique.has(key)) continue;
    unique.set(key, {
      username,
      score: candidateScore(username, options),
      tags: candidateTags(username, options, isRemix)
    });
  }

  // Modern JavaScript sorting is stable, so equal-scoring ideas keep their
  // seeded generation order instead of clustering around one prefix or suffix.
  return Array.from(unique.values()).sort((left, right) => right.score - left.score);
}

export function mapRobloxValidationResponse(code: unknown, message: unknown): RobloxUsernameValidation {
  const numericCode = typeof code === "number" && Number.isFinite(code) ? code : null;
  const upstreamMessage = typeof message === "string" ? message.trim() : "";

  if (numericCode === 0) return { status: "available", code: 0, message: "Available when checked" };
  if (numericCode === 1) return { status: "taken", code: 1, message: "This username is already taken." };
  if (numericCode === 2) {
    return { status: "inappropriate", code: 2, message: "Roblox did not accept this username." };
  }
  if (numericCode !== null && numericCode >= 3 && numericCode <= 7) {
    return { status: "invalid", code: numericCode, message: upstreamMessage || "This username does not follow Roblox's format rules." };
  }
  return { status: "unverified", code: numericCode, message: "Could not verify this username with Roblox." };
}

export function isRobloxUsernameFormat(value: string): boolean {
  return /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?$/.test(value) && value.length >= 3 && value.length <= 20;
}
