export function wikiReceiptMatches(row, ticket, now = Date.now()) {
  return Boolean(row && (row.status === "publishing" ||
    (row.status === "processing" && Date.parse(row.lease_expires_at) > now)) &&
    row.production_receipt?.request_id === ticket.requestId && row.production_receipt?.state === "publishing");
}

export function wikiDispatchReady(row, now = Date.now()) {
  const receipt = row.production_receipt;
  return Boolean((row.status === "publishing" ||
    (row.status === "processing" && Date.parse(row.lease_expires_at) > now)) &&
    (receipt?.state === "requested" || (receipt?.state === "failed" &&
      Number(receipt.dispatch_attempts || 0) < 3 && now - Date.parse(receipt.failed_at || "") > 15 * 60_000)));
}

export function wikiDispatchRecovery(row, now = Date.now()) {
  if (!wikiReceiptMatches(row, {requestId: row.production_receipt?.request_id}, now)) return null;
  const receipt = row.production_receipt;
  if (!(now - Date.parse(receipt.started_at || "") > 15 * 60_000)) return null;
  if (receipt.dispatch_phase === "preparing") return "retry";
  if (receipt.dispatch_phase === "submitted") return "inspect";
  return null;
}

export function wikiDispatchClaimMatches(row, ticket, claim, now = Date.now()) {
  return wikiReceiptMatches(row, ticket, now) &&
    row.production_receipt.started_at === claim.started_at && row.production_receipt.dispatch_phase === "preparing";
}

export function matchingWikiRun(runs, receipt) {
  const hash = receipt.artifact_binding?.bundle_hash;
  if (!/^[0-9a-f]{64}$/.test(hash || "")) return null;
  return runs.find(run => run.display_title === `Selected content ${hash}` &&
    run.event === "workflow_dispatch" && run.head_branch === "production" &&
    Date.parse(run.created_at) >= Math.floor(Date.parse(receipt.started_at) / 1000) * 1000) || null;
}

export function wikiRunRecoveryReceipt(receipt, run, now = Date.now()) {
  if (!matchingWikiRun([run], receipt) ||
    (receipt.github_run_id && receipt.github_run_id !== run.id)) return null;
  const recorded = {...receipt, github_run_id: run.id, github_run_url: run.html_url};
  if (run.status === "completed" && run.conclusion && run.conclusion !== "success") {
    return {...recorded, state: "failed", failed_at: new Date(now).toISOString(), error: `GitHub publication ended with ${run.conclusion}. Inspect run ${run.id} before retrying.`};
  }
  return recorded;
}

export async function findWikiDispatchCandidate(readPage, now = Date.now()) {
  const pageSize = 20;
  for (let offset = 0; ; offset += pageSize) {
    const rows = await readPage(offset, pageSize);
    const row = rows.find(candidate => wikiDispatchReady(candidate, now));
    if (row) return row;
    if (rows.length < pageSize) return null;
  }
}
