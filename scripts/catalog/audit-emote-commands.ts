import '../shared/load-env';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Item = { asset_id: number; name: string | null; is_deleted: boolean };
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Usage: npm run audit:emote-commands -- [--baseline inventory.json] [--out report.json]'); return; }
  for (let i = 0; i < args.length; i++) {
    if (!['--baseline', '--out'].includes(args[i]) || !args[++i]) throw new Error('Expected --baseline or --out with a path');
  }
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'tmp/emotes/coverage.json';
  const sb = supabaseAdmin();
  const items: Item[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await sb.from('roblox_catalog_items').select('asset_id,name,is_deleted').eq('asset_type_id', 61).eq('is_deleted', false).order('asset_id').range(start, start + 999);
    if (error) throw error;
    items.push(...data);
    if (data.length < 1000) break;
  }
  const { data: references, error } = await sb.from('roblox_emote_commands').select('code,command,asset_id,kind,verification_method').eq('is_published', true);
  if (error) throw error;
  const known = new Set(references?.flatMap(row => row.asset_id ? [row.asset_id] : []));
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = (item.name ?? '').replace(/[A-Z]/g, value => value.toLowerCase());
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  let baseline: Item[] | null = null;
  if (args.includes('--baseline')) baseline = JSON.parse(await readFile(args[args.indexOf('--baseline') + 1], 'utf8')).items;
  const baselineIds = new Set(baseline?.map(item => item.asset_id));
  const ids = new Set(items.map(item => item.asset_id));
  const missingThumbnails: Item[] = [];
  for (let start = 0; start < items.length; start += 100) {
    const batch = items.slice(start, start + 100);
    const { data, error: imageError } = await sb.from('roblox_catalog_item_images').select('asset_id,image_url,state').in('asset_id', batch.map(item => item.asset_id));
    if (imageError) throw imageError;
    missingThumbnails.push(...batch.filter(item => !data.some(image => image.asset_id === item.asset_id && image.image_url && image.state?.toLowerCase() === 'completed')));
  }
  const report = {
    checkedAt: new Date().toISOString(),
    target: new URL(process.env.SUPABASE_URL!).hostname,
    totals: { marketplaceItems: items.length, documentedReferences: references?.length ?? 0,
      defaultCommands: references?.filter(row => row.kind === 'default').length ?? 0,
      linkedMarketplaceCommands: known.size,
      duplicateNameGroups: [...groups.values()].filter(group => group.length > 1).length,
      missingThumbnails: missingThumbnails.length, additionalItems: baseline ? items.filter(item => !baselineIds.has(item.asset_id)).length : null },
    verification: 'Only explicitly published command references count as verified. Marketplace names are not converted into commands. Discovery is a bounded sample, not a complete Marketplace census.',
    duplicateNames: [...groups.entries()].filter(([, group]) => group.length > 1).map(([name, items]) => ({ name, items })),
    missingThumbnails, additionalItems: baseline ? items.filter(item => !baselineIds.has(item.asset_id)) : null,
    baselineItemsNotPresent: baseline?.filter(item => !item.is_deleted && !ids.has(item.asset_id)) ?? null,
    references
  };
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.totals));
  console.log(`Report: ${out}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
