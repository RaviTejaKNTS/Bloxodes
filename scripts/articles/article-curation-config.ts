export const ARTICLE_CURATION_PROMPT_VERSION = "article-curation-v3-2026-08-10";

export const ARTICLE_CURATION_REVISIT_REASON_CODES = [
  "existing_coverage",
  "thin_topic",
  "insufficient_evidence",
  "unsupported_article_type",
  "wiki",
  "other"
] as const;

export const ARTICLE_CURATION_ZERO_APPROVAL_WARN_RUNS = 3;
