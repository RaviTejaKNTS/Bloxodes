import { COMMENT_TLDS } from "./comment-tlds";

export const COMMENT_LINK_ERROR = "Links aren't allowed in comments. Please remove the link and try again.";

export type CommentLinkMatch = {
  reason: "url" | "markdown_link" | "html_link_or_embed" | "email" | "domain";
  matched: string;
};

function normalizeLinkText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\p{Cf}\u034f\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/gu, "")
    .replace(/[。．｡]/g, ".")
    .replace(/&#(?:0*46|x0*2e);?|&(?:period|dot);/gi, ".")
    .replace(/\s*(?:\[\s*(?:\.|dot)\s*\]|\(\s*(?:\.|dot)\s*\)|\{\s*(?:\.|dot)\s*\}|<\s*(?:\.|dot)\s*>)\s*/gi, ".")
    .replace(/\s+dot\s+/gi, ".")
    // A space before the dot marks an obfuscation such as "site . com".
    // Spaces only after a dot stay intact so "Nice. Online servers work." stays text.
    .replace(/\s+\.\s*/g, ".");
}

const URL_PATTERN = /\b(?:h\s*(?:t\s*t|x\s*x)\s*p\s*s?|f\s*t\s*p)\s*:\s*[/\\]\s*[/\\]|\bwww\.|\btinyurl\s*\//i;
const MARKDOWN_LINK_PATTERN = /!?\[[^\]\n]*\]\s*(?:\([^)]*\)|\[[^\]\n]*\])|^\s*\[[^\]\n]+\]:\s*\S+/m;
const HTML_LINK_PATTERN = /<\s*\/?\s*(?:a|img|iframe|embed|object|video|audio|source|link|script|svg)\b/i;
const EMAIL_PATTERN = /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+\s*@\s*[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?\.[\p{L}]{2,63}\b/u;

// Labels use hostname characters and have no leading/trailing hyphen.
// Hyphens cannot bound a candidate; Markdown emphasis characters can, including "_".
// Read spaces after separators, then require a path or known host for spaced dots.
const DOMAIN_PATTERN = /(?<![\p{L}\p{N}-])[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?:[.,]\s*[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?)+(?![\p{L}\p{N}-])/giu;

// Exclude ordinary English/game words, including "co" for co-op and "live" for live servers.
// Those suffixes still count with a path, a multi-label hostname, or a known spam host.
const BARE_DOMAIN_TLDS = new Set(
  "com net org io xyz ly app dev site online store shop link click top info biz ru cn tk ml ga cf gq cc ws tv uk fm zip mov icu buzz vip club".split(" ")
);

const KNOWN_SPAM_HOSTS = new Set(
  "discord.gg dsc.gg bit.ly tinyurl.com t.co goo.gl is.gd cutt.ly rebrand.ly linktr.ee youtu.be".split(" ")
);

function isKnownSpamHost(hostname: string, suffix: string): boolean {
  for (const host of KNOWN_SPAM_HOSTS) {
    if (hostname === host || hostname.endsWith(`.${host}`)) return true;
  }
  return ((hostname === "discord.com" || hostname.endsWith(".discord.com")) && /^\/invite(?:[/?#]|$)/i.test(suffix))
    || ((hostname === "roblox.com" || hostname.endsWith(".roblox.com")) && /^\/share(?:[/?#]|$)/i.test(suffix));
}

function isHostnameLikeLabel(label: string): boolean {
  // Require a lowercase letter or a hyphen, rather than punctuation-separated numbers or title-case words.
  return /^[\p{Ll}\p{N}-]+$/u.test(label) && /[\p{Ll}-]/u.test(label);
}

export function detectCommentLink(value: string): CommentLinkMatch | null {
  const normalized = normalizeLinkText(value);
  for (const [reason, pattern] of [
    ["url", URL_PATTERN],
    ["markdown_link", MARKDOWN_LINK_PATTERN],
    ["html_link_or_embed", HTML_LINK_PATTERN],
    ["email", EMAIL_PATTERN]
  ] as const) {
    const match = normalized.match(pattern);
    if (match) return { reason, matched: match[0] };
  }

  for (const match of normalized.matchAll(DOMAIN_PATTERN)) {
    const parts = match[0].split(/([.,]\s*)/u);
    let candidate = parts[0];
    let hostname = parts[0].toLowerCase();
    let bareCandidate = parts[0];
    let bareLabels = [parts[0]];
    for (let index = 2; index < parts.length; index += 2) {
      const separator = parts[index - 1];
      const label = parts[index];
      const tld = label.toLowerCase();
      candidate += separator + label;
      hostname += `.${tld}`;
      const isTextBoundary = separator.startsWith(",") || /^\.\s+/u.test(separator);
      if (isTextBoundary) {
        bareCandidate = label;
        bareLabels = [label];
      } else {
        bareCandidate += separator + label;
        bareLabels.push(label);
      }
      if (!COMMENT_TLDS.has(tld)) continue;

      const suffix = normalized.slice(match.index + candidate.length);
      if (/^[/?#]/.test(suffix) || isKnownSpamHost(hostname, suffix)) {
        return { reason: "domain", matched: candidate };
      }
      // Commas require a path or a known host, so "site,com" and "ok,info" stay text.
      // Restart bare-domain checks after punctuation so "Thanks,site.com" still blocks.
      if (isTextBoundary) continue;
      if (BARE_DOMAIN_TLDS.has(tld) || (bareLabels.length >= 3 && bareLabels.slice(0, -1).some(isHostnameLikeLabel))) {
        return { reason: "domain", matched: bareCandidate };
      }
    }
  }
  return null;
}
