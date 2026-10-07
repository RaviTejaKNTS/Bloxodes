const guidance = /^(?:docs\/|dev-docs\/|agents\/|\.agents\/|\.claude\/|\.codex\/|Writing plans\/)/;
const runtime = /^(?:apps\/|scripts\/|one-off-scripts\/|workers\/|supabase\/|data\/|env\/|types\/|\.github\/|package(?:-lock)?\.json$|Dockerfile(?:\..*)?$|(?:docker-)?compose[^/]*\.ya?ml$|\.dockerignore$|\.npmrc$|\.nvmrc$|t3\.json$|tsconfig[^/]*\.json$|(?:eslint|next|postcss|tailwind|babel|jest|vitest|playwright)\.config\.)/;

export function needsCodexReview(files) {
  return files.some(file => {
    if (guidance.test(file) || /(?:^|\/)(?:AGENTS|DESIGN)\.md$/.test(file)) return false;
    // Review prompts affect CI behavior even though their source is Markdown.
    if (file.startsWith(".github/codex/")) return true;
    if (/\.(?:md|txt|rst)$/i.test(file)) return false;
    return runtime.test(file) || /\.(?:[cm]?[jt]sx?|py|sh|sql|mdx)$/i.test(file);
  });
}

export function selectCodexReview({ eventName, eventAction, draft, state, baseBranch, baseRepository, headRepository, files }) {
  if (state !== "open" || baseBranch !== "production" || !headRepository || headRepository !== baseRepository) {
    return { review: false, reason: "Only open, same-repository production PRs can use the API credential." };
  }
  if (draft) return { review: false, reason: "Draft PRs wait until they are ready for review." };
  if (!needsCodexReview(files)) return { review: false, reason: "Documentation, skills or content only. No paid code review." };
  if (eventName === "workflow_dispatch" || ["opened", "ready_for_review", "reopened"].includes(eventAction)) {
    return { review: true, reason: "Review the current code diff." };
  }
  return { review: false, reason: "Push cancelled any stale review. Request a fresh review when fixes are ready." };
}
