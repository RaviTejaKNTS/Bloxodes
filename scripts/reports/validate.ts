import { bundlePath } from '../shared/roblox-wiki-bundle';
import fs from 'node:fs/promises';
import path from 'node:path';
import { reportSchema } from '../../contracts/stats-report/v1/schema';
import { CHARTS, type Row } from './model';
import { hash, dataFileHash } from './build';
import { publicCopyFindings } from '../content/check-public-copy';
export function reportSlug(month: string) {
  return `roblox-${new Date(month + '-01T00:00:00Z').toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC'
  }).toLowerCase()}-${month.slice(0, 4)}`;
}
const LINK_HOSTS = ['roblox.com', 'www.roblox.com', 'devforum.roblox.com', 'about.roblox.com', 'create.roblox.com'];
export function resolveLinks(md: string, games: Row) {
  if (/<\/?[a-z][^>]*>/i.test(md.replace(/<https:\/\/[^>]+>/g, '')))
    throw Error('Raw HTML is not allowed in report prose');
  // Only inline links are allowed: reference links, link definitions and HTML entities could hide a destination.
  if (/\]\s*\[[^\]]*\]|^\s{0,3}\[[^\]]+\]:/m.test(md))
    throw Error('Reference-style links are not allowed in report prose');
  if (/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(md))
    throw Error('HTML entities are not allowed in report prose');
  for (const match of md.matchAll(/https?:\/\/[^\s)<>]+/g)) {
    const url = new URL(match[0]);
    if (url.protocol !== 'https:' || !LINK_HOSTS.includes(url.hostname))
      throw Error(`Disallowed report link: ${match[0]}`);
  }
  return md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_whole, label, url) => {
    if (/^game:\d+$/.test(url)) {
      const g = games[url.slice(5)];
      if (!g?.slug || !/^[a-z0-9-]+$/.test(g.slug))
        throw Error(`Missing stats slug for ${url}`);
      return `[${label}](/stats/games/${g.slug})`;
    }
    const u = new URL(url);
    if (u.protocol !== 'https:' || !LINK_HOSTS.includes(u.hostname))
      throw Error(`Disallowed report link: ${url}`);
    return `[${label}](${url})`;
  });
}
// Layout and index fields (hour of day, weekday number, positions, universe IDs) aren't facts a
// writer can quote, so they never count as a match for a number in the copy.
const STRUCTURAL_KEYS = new Set(['hour', 'weekday', 'index', 'position', 'throughRank', 'id', 'universe_id', 'leaderId', 'loser', 'leader_id', 'biggest']);
export function numericValues(value: unknown, result: number[] = []): number[] {
  if (typeof value === 'number' && Number.isFinite(value))
    result.push(value, Math.abs(value));
  else if (Array.isArray(value))
    for (const v of value)
      numericValues(v, result);
  else if (value && typeof value === 'object')
    for (const [key, v] of Object.entries(value))
      if (!STRUCTURAL_KEYS.has(key))
        numericValues(v, result);
  return result;
}
export function numberFindings(text: string, values: number[]) {
  const findings: string[] = [];
  const clean = text
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\b(?:,?\s*\d{4})?/gi, '')
    .replace(/\b(?:week\s+\d+(?:st|nd|rd|th)?|\d+(?:st|nd|rd|th)\s+week)\b/gi, '');
  for (const match of clean.matchAll(/[-+−]?\d[\d,]*(?:\.\d+)?(?:\s*[KMB]\b|%)?/gi)) {
    const token = match[0].trim().replace('−', '-');
    if (/^(?:19\d{2}|20\d{2}|2100)$/.test(token))
      continue;
    const number = parseFloat(token.replaceAll(',', ''));
    const scale = /K$/i.test(token) ? 1e3 : /M$/i.test(token) ? 1e6 : /B$/i.test(token) ? 1e9 : 1;
    const decimals = token.match(/\.(\d+)/)?.[1].length ?? 0;
    const rounded = number.toFixed(decimals);
    if (!values.some(value => Number((value / scale).toFixed(decimals)) === Number(rounded))) {
      findings.push(`Unmatched number ${token}: ${text}`);
    }
  }
  return findings;
}
export async function validateReport(root: string) {
  root = await fs.realpath(root);
  const report = reportSchema.parse(JSON.parse(await fs.readFile(await bundlePath(root, 'report.json'), 'utf8')));
  if (report.slug !== reportSlug(report.month))
    throw Error('Report month/slug mismatch');
  const manifest = JSON.parse(await fs.readFile(await bundlePath(root, 'data/manifest.json'), 'utf8'));
  if (manifest.contract !== 'stats-report-data@1' || manifest.month !== report.month)
    throw Error('Data contract/month mismatch');
  if (JSON.stringify(manifest.hash_exclusions) !== JSON.stringify({
    'data-check.json': ['built_at']
  }))
    throw Error('Unsupported manifest hash exclusions');
  const data: Row = {
    charts: {}
  };
  const required = ['facts.json', 'games.json', 'insights.json', 'data-check.json', 'writer-notes.md'];
  for (const name of required)
    if (!manifest.files[name])
      throw Error(`Missing manifest file ${name}`);
  for (const [file, sha] of Object.entries(manifest.files)) {
    if (file === 'writer-notes.md') {
      const bytes = await fs.readFile(await bundlePath(root, 'data/' + file));
      if (dataFileHash(file, bytes) !== sha)
        throw Error(`Hash mismatch: ${file}`);
      continue;
    }
    if (!/^(?:charts\/[a-z0-9-]+|facts|games|insights|data-check)\.json$/.test(file))
      throw Error('Unsafe manifest path');
    const bytes = await fs.readFile(await bundlePath(root, 'data/' + file));
    if (dataFileHash(file, bytes) !== sha)
      throw Error(`Hash mismatch: ${file}`);
    const value = JSON.parse(bytes.toString());
    if (file.startsWith('charts/'))
      data.charts[path.basename(file, '.json')] = value;
    else
      data[file.slice(0, -5)] = value;
  }
  if (data['data-check'].status !== 'ready')
    throw Error(`Report data is ${data['data-check'].status}`);
  const expected = CHARTS.filter(id => !data['data-check'].omitted_charts[id]);
  const actual = report.body.filter(b => b.type === 'chart').map(b => b.id);
  if (JSON.stringify(actual.filter(id => !(id.startsWith('extra-')))) !== JSON.stringify(expected))
    throw Error('Predefined charts must appear once in mock-up order');
  if (actual.filter(id => id.startsWith('extra-')).length > 3 || new Set(actual).size !== actual.length)
    throw Error('Duplicate chart or more than 3 extras');
  for (const id of actual)
    if (!data.charts[id])
      throw Error(`Missing chart ${id}`);
  const headings = report.body.filter(b => b.type === 'h2').map(b => b.id);
  if (new Set(headings).size !== headings.length)
    throw Error('Duplicate section anchor');
  const bodyCopy = report.body.flatMap(block => {
    switch (block.type) {
      case 'p': return [block.md];
      case 'dates': return block.rows.map(row => row.md);
      case 'h2': return [block.text];
      default: return [];
    }
  });
  const prose = [report.title, report.meta_description, report.dek, ...report.short_version, ...bodyCopy];
  const values = numericValues([data.facts, data.insights, data.charts, data.games]);
  const findings = prose.flatMap(t => numberFindings(t, values));
  if (findings.length)
    throw Error(findings.join('\n'));
  const copy = publicCopyFindings({
    title: report.title,
    meta_description: report.meta_description,
    description_md: prose.join('\n'),
    markers: report.markers,
    chart_titles: report.chart_titles
  }, 'report.json');
  if (copy.length)
    throw Error(JSON.stringify(copy));
  for (const text of [...prose, report.meta_description, ...report.markers.map(m => m.label)]) {
    if (text.includes('—'))
      throw Error('Em dashes are not allowed');
    resolveLinks(text, data.games);
  }
  const topIds = new Set(data.charts.top100.data.map((g: Row) => g.id));
  if (report.rating_labels?.some(id => !topIds.has(id)))
    throw Error('Rating label must belong to top100');
  return {
    report,
    data,
    sha: hash(JSON.stringify({
      report,
      files: manifest.files
    }))
  };
}
/** A rerun without --visibility keeps the stored visibility; a new report starts hidden. */
export function nextVisibility(requested: 'hidden' | 'public' | undefined, existing: Row | null): 'hidden' | 'public' {
  return requested ?? (existing?.visibility === 'public' ? 'public' : 'hidden');
}
export function canReplace(existing: Row | null, sha: string, update = false) {
  if (existing?.visibility === 'public' && existing.data_sha256 !== sha && !update)
    throw Error('Changing a public report requires --update-published');
}
