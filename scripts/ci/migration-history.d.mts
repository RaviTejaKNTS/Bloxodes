export function historyRepairs(
  aliases: ReadonlyArray<Record<string, string>>,
  migrations: ReadonlyArray<{version: string; hash: string; name?: string}>,
  ledger: ReadonlyArray<Record<string, unknown>>
): Array<{version: string; source_version: string; source_sha256: string; local_sha256: string; name: string}>;
export function repairHistorySql(repairs: ReturnType<typeof historyRepairs>): string[];
