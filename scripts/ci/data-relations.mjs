// Only views need handwritten provenance. Table relationships come from the manifest.
export function attachRelations(contracts, tables, manifest, relations, views) {
  for (const [source, targets] of Object.entries(relations)) for (const target of Object.keys(targets)) {
    if (!contracts[source] || !contracts[target]) throw new Error(`Unknown CI seed relation ${source}.${target}`);
    const sourceBase = views[source]?.table ?? source, targetBase = views[target]?.table ?? target;
    const candidates = [];
    for (const [owner, other, many] of [[sourceBase, targetBase, false], [targetBase, sourceBase, true]]) {
      for (const key of manifest.tables[owner]?.foreignKeys ?? []) {
        if (key.target !== other) continue;
        // A view must name a real base-table constraint, including inverse joins.
        if ([source, target].some(name => views[name] && !views[name].foreignKeys.some(fk => fk.table === owner &&
          manifest.tables[owner]?.foreignKeys.some(actual => actual.name === fk.name && actual.target === other)))) continue;
        const local = many ? key.targetColumns : key.columns, remote = many ? key.columns : key.targetColumns;
        if (!local.length || local.length !== remote.length || local.some(column => !contracts[source].columns.has(column)) ||
          remote.some(column => !contracts[target].columns.has(column))) continue;
        candidates.push({
          hints: [key.name, ...(key.columns.length === 1 ? key.columns : []), ...(key.targetColumns.length === 1 ? key.targetColumns : [])],
          contract: contracts[target],
          read: row => {
            const matches = tables[target].filter(otherRow => local.every((column, index) =>
              row[column] != null && otherRow[remote[index]] != null && String(row[column]) === String(otherRow[remote[index]])));
            return many ? matches : matches[0] ?? null;
          }
        });
      }
    }
    contracts[source].relations[target] = candidates;
  }
}
