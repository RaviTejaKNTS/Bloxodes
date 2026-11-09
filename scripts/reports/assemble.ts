import fs from 'node:fs/promises';
import path from 'node:path';
import type { StatsReport } from '../../contracts/stats-report/v1/schema';
import { CHARTS } from './model';
import { reportSlug, validateReport } from './validate';
export const SECTION_IDS = ['players', 'top-games', 'gainers-losers', 'genres', 'ratings-session', 'events-updates', 'top-100'] as const;
const SECTION_PREFIXES = [/^Roblox player numbers in /, /^Top 20 Roblox games in /, /^Biggest gainers and losers among Roblox games in /, /^Roblox genres in /, /^Ratings and session length:/, /^Roblox events and game updates in /, /^Top 100 Roblox games in /];
const CHART_SECTIONS = [0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 6];
export function parseReply(reply: string, month: string, omitted: Record<string, string> = {}): StatsReport {
  const lines = reply.replaceAll('\r\n', '\n').split('\n');
  let cursor = 0;
  const fail = (message: string): never => {
    throw Error(`Line ${cursor + 1}: ${message}`);
  };
  const skip = () => {
    while (cursor < lines.length && !lines[cursor].trim())
      cursor++;
  };
  const field = (label: string) => {
    skip();
    const line = lines[cursor] ?? '';
    if (!line.startsWith(label))
      fail(`Expected ${label}`);
    const value = line.slice(label.length).trim();
    if (!value)
      fail(`Empty ${label}`);
    cursor++;
    return value;
  };
  const title = field('Title:');
  const meta_description = field('Meta:');
  const dek = field('Dek:');
  skip();
  if (lines[cursor]?.trim() !== 'Short version:')
    fail('Expected Short version:');
  cursor++;
  const short_version: string[] = [];
  skip();
  while (lines[cursor]?.startsWith('- '))
    short_version.push(lines[cursor++].slice(2).trim());
  if (short_version.length !== 4 || short_version.some(text => !text))
    fail('Expected four short-version bullets');
  skip();
  if (lines[cursor]?.trim() !== 'Markers:')
    fail('Expected Markers:');
  cursor++;
  skip();
  const markers: StatsReport['markers'] = [];
  while (lines[cursor]?.startsWith('- ')) {
    const match = lines[cursor].match(/^- (\d{4}-\d{2}-\d{2}) \| (.{1,24})$/);
    if (!match || !validDate(match[1], month))
      fail('Expected YYYY-MM-DD | label, within the report month');
    markers.push({
      date: match![1],
      label: match![2]
    });
    cursor++;
  }
  if (markers.length > 3)
    fail('At most three markers');
  const body: StatsReport['body'] = [];
  let section = -1;
  while (cursor < lines.length) {
    skip();
    if (cursor >= lines.length)
      break;
    const line = lines[cursor].trim();
    if (line.startsWith('## ')) {
      section++;
      if (!SECTION_PREFIXES[section]?.test(line.slice(3)))
        fail('Unexpected section or section order');
      body.push({
        type: 'h2',
        id: SECTION_IDS[section],
        text: line.slice(3)
      });
      cursor++;
    }
    else if (line.startsWith('[[chart:')) {
      const match = line.match(/^\[\[chart:([a-z0-9-]+)\]\]$/);
      if (!match || section < 0)
        fail('Malformed chart slot');
      const id = match![1];
      if (body.some(block => block.type === 'chart' && block.id === id)) fail('Duplicate chart slot');
      if (id.startsWith('extra-') && body.filter(block => block.type === 'chart' && block.id.startsWith('extra-')).length >= 3) fail('At most three extras');
      const index = CHARTS.indexOf(id as typeof CHARTS[number]);
      if (index < 0 && !/^extra-\d+$/.test(id))
        fail('Unknown chart');
      if (index >= 0 && CHART_SECTIONS[index] !== section)
        fail('Chart is in the wrong section');
      if (!omitted[id])
        body.push({
          type: 'chart',
          id
        });
      cursor++;
    }
    else if (line === '[[dates]]') {
      if (section !== 5 || body.some(block => block.type === 'dates'))
        fail('Dates belong once in Events and updates');
      cursor++;
      const rows: {
        date: string;
        md: string;
      }[] = [];
      while (lines[cursor]?.startsWith('- ')) {
        const match = lines[cursor].match(/^- ([A-Z][a-z]{2}) (\d{1,2}) \| (.+)$/);
        const expectedMonth = new Date(month + '-01T00:00:00Z').toLocaleString('en-US', {
          month: 'short',
          timeZone: 'UTC'
        });
        if (!match || match[1] !== expectedMonth)
          fail('Expected Mon D | markdown in the report month');
        const date = `${month}-${match![2].padStart(2, '0')}`;
        if (!validDate(date, month))
          fail('Invalid date');
        rows.push({
          date,
          md: match![3]
        });
        cursor++;
      }
      if (rows.length < 3 || rows.length > 6)
        fail('Expected three to six date rows');
      body.push({
        type: 'dates',
        rows
      });
    }
    else {
      if (section < 0 || /^(?:\[\[|#|- |Title:|Meta:|Dek:|Markers:|Short version:)/.test(line))
        fail('Unexpected structure');
      const paragraph: string[] = [];
      while (cursor < lines.length && lines[cursor].trim() && !/^(?:##|\[\[)/.test(lines[cursor].trim())) {
        if (/^(?:#|- |Title:|Meta:|Dek:|Markers:|Short version:)/.test(lines[cursor].trim()))
          fail('Unexpected structure in paragraph');
        paragraph.push(lines[cursor++].trim());
      }
      body.push({
        type: 'p',
        md: paragraph.join(' ')
      });
    }
  }
  if (section !== 6)
    fail('Missing sections');
  if (!body.some(block => block.type === 'dates'))
    fail('Missing dates');
  const expected = CHARTS.filter(id => !omitted[id]);
  const actual = body.flatMap(block => block.type === 'chart' && !block.id.startsWith('extra-') ? [block.id] : []);
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    fail('Missing, duplicate or out-of-order chart slots');
  return {
    contract: 'stats-report@1',
    month,
    slug: reportSlug(month),
    title,
    meta_description,
    dek,
    short_version,
    markers,
    body
  };
}
function validDate(date: string, month: string): boolean {
  return date.startsWith(month + '-') && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const value = args[args.indexOf(name) + 1];
    if (!args.includes(name) || !value || value.startsWith('--'))
      throw Error(`Missing ${name}`);
    return value;
  };
  const root = path.resolve(arg('--bundle'));
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'data/manifest.json'), 'utf8'));
  const check = JSON.parse(await fs.readFile(path.join(root, 'data/data-check.json'), 'utf8'));
  const reply = await fs.readFile(arg('--reply'), 'utf8');
  const report = parseReply(reply, manifest.month, check.omitted_charts);
  await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  try {
    await validateReport(root);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const lines = reply.split(/\r?\n/);
    const index = lines.findIndex(line => {
      const copy = line.replace(/^(?:Title:|Meta:|Dek:|- )\s*/, '').trim();
      return copy.length > 3 && message.includes(copy) || line.includes('—');
    });
    throw Error(`Line ${index < 0 ? 1 : index + 1}: ${message}`);
  }
  console.log(`PASS assembled and validated ${report.slug}; no database calls`);
}
if (process.argv[1]?.endsWith('/assemble.ts'))
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
