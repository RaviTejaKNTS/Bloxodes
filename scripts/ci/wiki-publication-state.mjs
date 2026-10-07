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
