import '../shared/load-env';
import { readFile } from 'node:fs/promises';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isManagedDevelopmentSupabaseUrl } from '../shared/supabase-target';
import type { RobloxEmoteCommand } from '@/lib/roblox-emote-commands';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: npm run seed:emote-commands -- [--file commands.json] [--apply] [--allow-prod]');
    return;
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file') { if (!args[++i]) throw new Error('Missing --file value'); }
    else if (!['--apply', '--allow-prod'].includes(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
  }
  const file = args.includes('--file') ? args[args.indexOf('--file') + 1] : 'data/roblox-emotes/commands.json';
  const input = JSON.parse(await readFile(file, 'utf8')) as Array<RobloxEmoteCommand & { is_published: boolean }>;
  const seen = new Set<string>();
  if (!Array.isArray(input) || !input.length) throw new Error('Command payload must be a nonempty array');
  const rows = input.map(row => {
    if (!/^[a-z0-9-]+$/.test(row.code) || seen.has(row.code)) throw new Error(`Invalid or duplicate code: ${row.code}`);
    seen.add(row.code);
    if (!row.name?.trim() || !/^\/e [^\r\n]+$/.test(row.command) || !row.description?.trim() || !row.requirements?.trim()) throw new Error(`Missing command text: ${row.code}`);
    if (!['default', 'avatar'].includes(row.kind) || (row.kind === 'default' ? row.asset_id !== null : !Number.isSafeInteger(row.asset_id) || row.asset_id! <= 0)) throw new Error(`Invalid item link: ${row.code}`);
    if (!['official_documentation', 'source_documentation', 'in_game_test'].includes(row.verification_method) || !Number.isFinite(Date.parse(row.verified_at))) throw new Error(`Invalid verification: ${row.code}`);
    if (!Array.isArray(row.source_urls) || !row.source_urls.length || row.source_urls.some(url => { try { return new URL(url).protocol !== 'https:'; } catch { return true; } })) throw new Error(`Missing HTTPS sources: ${row.code}`);
    return { code: row.code, name: row.name, command: row.command, asset_id: row.asset_id, kind: row.kind, description: row.description,
      requirements: row.requirements, source_urls: row.source_urls, verification_method: row.verification_method,
      verified_at: new Date(row.verified_at).toISOString(), sort_order: row.sort_order, is_published: row.is_published === true };
  });
  if (!args.includes('--apply')) { console.log(`Validated ${rows.length} command references (dry run).`); return; }
  const target = process.env.SUPABASE_URL ?? '';
  if (!isManagedDevelopmentSupabaseUrl(target) && !(args.includes('--allow-prod') && new URL(target).hostname === 'database.bloxodes.com')) throw new Error('Refusing unapproved database target');
  const sb = supabaseAdmin();
  const ids = rows.flatMap(row => row.asset_id === null ? [] : [row.asset_id]);
  const { data: items, error: itemError } = await sb.from('roblox_catalog_items').select('asset_id,asset_type_id').in('asset_id', ids);
  if (itemError) throw itemError;
  if (ids.some(id => !items?.some(item => item.asset_id === id && item.asset_type_id === 61))) throw new Error('Import the referenced Marketplace emotes before commands');
  const { data: existing, error: readError } = await sb.from('roblox_emote_commands').select('*').in('code', rows.map(row => row.code));
  if (readError) throw readError;
  const changed = rows.filter(row => {
    const old = existing?.find(entry => entry.code === row.code);
    return !old || Object.entries(row).some(([key, value]) => key === 'verified_at' ? Date.parse(old[key]) !== Date.parse(String(value)) : JSON.stringify(old[key]) !== JSON.stringify(value));
  });
  if (changed.length) {
    const { error } = await sb.from('roblox_emote_commands').upsert(changed.map(row => ({ ...row, updated_at: new Date().toISOString() })), { onConflict: 'code' });
    if (error) throw error;
  }
  console.log(`Saved ${changed.length} changed command references; ${rows.length - changed.length} unchanged.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
