import os from "node:os";

export const QUEUE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function exactQueueIds(ids: string[]) {
  if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length || ids.some(id => !QUEUE_UUID.test(id))) {
    throw new Error("Owner action requires 1-20 exact unique lowercase queue UUIDs.");
  }
}
export function ownerEvidence(operator: string, reason: string) {
  if (!operator?.trim() || !reason?.trim()) throw new Error("Owner action requires --operator and --reason.");
  return { operator: operator.trim(), reason: reason.trim(), localUser: os.userInfo().username, host: os.hostname(), at: new Date().toISOString() };
}
export function parseOwnerArgs(args: string[], allowHash = false) {
  const ids: string[] = [];
  let operator = "", reason = "", expectedHash = "", apply = false;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag !== "--queue-id" && seen.has(flag)) throw new Error(`Duplicate option ${flag}.`);
    seen.add(flag);
    if (flag === "--apply") { apply = true; continue; }
    if (!["--queue-id", "--operator", "--reason", ...(allowHash ? ["--expected-final-hash"] : [])].includes(flag) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Invalid owner option ${flag}.`);
    const value = args[++i];
    if (flag === "--queue-id") ids.push(value);
    else if (flag === "--operator") operator = value;
    else if (flag === "--reason") reason = value;
    else expectedHash = value;
  }
  exactQueueIds(ids); ownerEvidence(operator, reason);
  if (!apply) throw new Error("Owner action requires explicit --apply.");
  if (allowHash && (ids.length !== 1 || !/^[0-9a-f]{64}$/.test(expectedHash))) throw new Error("Approval requires one exact queue ID and --expected-final-hash SHA256.");
  return { ids, operator, reason, expectedHash };
}
