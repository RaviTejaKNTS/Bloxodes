export function matchingArticleRun(runs, intent) {
  if (!/^[0-9a-f]{64}$/.test(intent.dispatchHash || '') || !Number.isFinite(Date.parse(intent.submittedAt || ''))) throw new Error('Invalid recorded article dispatch.');
  return runs.find(run => run.display_title === `Selected content ${intent.dispatchHash}` &&
    run.event === 'workflow_dispatch' && run.head_branch === 'production' &&
    (!intent.githubRunId || intent.githubRunId === run.id) &&
    Date.parse(run.created_at) >= Math.floor(Date.parse(intent.submittedAt) / 1000) * 1000) || null;
}
export function articleRunOutcome(run) {
  if (!run || run.status !== 'completed') return 'pending';
  return run.conclusion === 'success' ? 'receipt-needed' : 'retry';
}
