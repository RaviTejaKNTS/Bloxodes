import { StageFailure, type Decision } from "./article-pipeline";

export const REVIEW_CRITERIA = ["opening", "completeness", "structure", "explanation", "repetition", "evidence"] as const;
export type EditorialEvidence = {
  checks: { criterion: typeof REVIEW_CRITERIA[number]; verdict: "pass" | "revise"; quotes: string[]; assessment: string }[];
  faqs: { question: string; adds_information: boolean; assessment: string }[];
};
export const EDITORIAL_EVIDENCE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["checks", "faqs"], properties: {
    checks: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["criterion", "verdict", "quotes", "assessment"], properties: {
        criterion: { type: "string", enum: REVIEW_CRITERIA }, verdict: { type: "string", enum: ["pass", "revise"] },
        quotes: { type: "array", items: { type: "string" } }, assessment: { type: "string" }
      } } },
    faqs: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["question", "adds_information", "assessment"], properties: {
        question: { type: "string" }, adds_information: { type: "boolean" }, assessment: { type: "string" }
      } } }
  }
};

/** Proves that a review addresses this draft. Editorial judgment still belongs to the reviewer. */
export function validateEditorialEvidence(decision: Decision, value: unknown, final: { title: string; content_md: string; faq_json?: { q: string; a: string }[] }): EditorialEvidence {
  const evidence = value as EditorialEvidence;
  const fail = (message: string): never => { throw new StageFailure(`Editorial evidence rejected: ${message}`, true); };
  if (!evidence || !Array.isArray(evidence.checks) || !Array.isArray(evidence.faqs)) return fail("missing structured review.");
  const text = [final.title, final.content_md, ...(final.faq_json ?? []).flatMap(f => [f.q, f.a])].join("\n");
  for (const criterion of REVIEW_CRITERIA) {
    const checks = evidence.checks.filter(c => c.criterion === criterion);
    if (checks.length !== 1) return fail(`expected one ${criterion} assessment.`);
    const check = checks[0];
    if (!["pass", "revise"].includes(check.verdict) || typeof check.assessment !== "string" || !check.assessment.trim() || !Array.isArray(check.quotes) || !check.quotes.length || check.quotes.some(q => typeof q !== "string" || !q.trim() || !text.includes(q))) return fail(`${criterion} needs actual draft quotations and an assessment.`);
  }
  if (evidence.checks.length !== REVIEW_CRITERIA.length) return fail("unexpected or duplicate criteria.");
  const questions = (final.faq_json ?? []).map(f => f.q);
  if (evidence.faqs.length !== questions.length || questions.some(q => evidence.faqs.filter(f => f.question === q).length !== 1)) return fail("assess every FAQ question exactly once.");
  if (evidence.faqs.some(f => typeof f.adds_information !== "boolean" || typeof f.assessment !== "string" || !f.assessment.trim())) return fail("FAQ assessments are incomplete.");
  if (decision.status === "completed" && (evidence.checks.some(c => c.verdict === "revise") || evidence.faqs.some(f => !f.adds_information))) return fail("approval contradicts unresolved copy or redundant FAQs.");
  return evidence;
}
