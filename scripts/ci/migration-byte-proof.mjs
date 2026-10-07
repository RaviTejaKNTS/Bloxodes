export function verifiedMigrationHashes(migrations, ledger, policy) {
  const byVersion = new Map(migrations.map(row => [row.version,row]));
  const evidence = new Map();
  for (const entry of [...(policy.managed_dev_history_aliases ?? []), ...(policy.managed_dev_sql_equivalences ?? [])]) {
    if (!/^\d{14}$/.test(entry.version) || !/^[0-9a-f]{64}$/.test(entry.local_sha256) ||
        !/^[0-9a-f]{64}$/.test(entry.source_sha256) || !entry.reason?.trim() || evidence.has(entry.version) ||
        byVersion.get(entry.version)?.hash !== entry.local_sha256) throw new Error("Invalid or changed historical migration byte proof.");
    evidence.set(entry.version,entry);
  }
  const remote = new Map(ledger.map(row => [String(row.version),row]));
  const verified = [];
  for (const migration of migrations) {
    const row = remote.get(migration.version);
    if (!row) continue;
    const historical = evidence.get(migration.version);
    if (row.sql_hash !== migration.hash && (!historical || row.sql_hash !== historical.source_sha256)) {
      throw new Error(`Applied SQL bytes cannot be proven for ${migration.version}. Add a new forward migration; do not rewrite the applied file.`);
    }
    verified.push({version: migration.version,hash: migration.hash});
  }
  return verified;
}
