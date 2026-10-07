const sameSet = (left, right) => Array.isArray(left) && Array.isArray(right) && left.length === right.length && new Set(left).size === left.length && [...left].sort().join("\n") === [...right].sort().join("\n");

export function assertWikiBatchBinding(row, batch, artifacts, verifiedHash) {
  const binding = row.production_receipt?.artifact_binding;
  if (!binding || !/^[0-9a-f]{64}$/.test(verifiedHash ?? "") || binding.bundle_hash !== verifiedHash) throw new Error("Wiki receipt requires its exact approved private bundle.");
  const approved = row.approved_collections;
  if (!Array.isArray(approved) || !approved.length || !sameSet(binding.collections?.map(item => item.slug), approved) ||
      !sameSet(binding.collections.map(item => item.source_path),row.collection_manifests) || binding.wiki?.source_path !== row.wiki_final_path) throw new Error("Wiki receipt artifact paths differ from its stored result.");
  const hub = artifacts.filter(item => item.publisher === "roblox-wiki");
  const collections = artifacts.filter(item => item.publisher === "roblox-collection");
  if (hub.length !== 1 || artifacts.length !== approved.length + 1 || collections.length !== approved.length ||
      hub[0].file !== binding.wiki.file || hub[0].hash !== binding.wiki.sha256 ||
      hub[0].data.slug !== row.wiki_slug || Number(hub[0].data.universe_id) !== Number(row.universe_id)) throw new Error("Wiki receipt does not match the selected hub.");
  for (const item of collections) {
    const expected = binding.collections.find(value => value.slug === item.data.collection?.slug);
    if (!expected || expected.file !== item.file || expected.sha256 !== item.hash || item.data.game?.slug !== row.wiki_slug || Number(item.data.game?.universeId) !== Number(row.universe_id)) throw new Error("Wiki receipt does not match the selected collection.");
  }
  if (!sameSet(collections.map(item => item.data.collection.slug),approved)) throw new Error("Wiki receipt collections differ from its approved set.");
  const paths = [`/wiki/${row.wiki_slug}`, ...approved.map(slug => `/wiki/${row.wiki_slug}/${slug}`)];
  if (!sameSet(batch.urls.map(url => url.path), paths)) throw new Error("Wiki receipt URLs differ from its canonical routes.");
  const events = [`wiki:${row.wiki_slug}`, ...approved.map(slug => `wiki_collection:${row.wiki_slug}/${slug}`)];
  if (!sameSet(batch.events.map(event => `${event.type}:${event.slug}`),events)) throw new Error("Wiki receipt cache events differ from its selected pages.");
}
