import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { StatsReport } from '../../contracts/stats-report/v1/schema';
import { compact } from './format';
import type { Row } from './model';
const xml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
/** Uses the monthly-report skill generator's wordmark, layout and typography. */
export async function featureImage(report: StatsReport, data: Row): Promise<Buffer> {
  const logo = await fs.readFile(path.resolve('apps/web/public/Bloxodes-dark.png'));
  const accent = '#84a9ff';
  const words = report.title.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 30) {
      lines.push(line);
      line = word;
    }
    else
      line = (line + ' ' + word).trim();
  }
  if (line)
    lines.push(line);
  // Shrink the font when a longer editorial title needs more than three lines.
  const headlineLines = lines.length <= 3 ? lines : [lines[0], lines[1], lines.slice(2).join(' ')];
  const fontSize = Math.min(62, 620 / Math.max(...headlineLines.map(text => text.length)) * 1.7);
  const points = data.charts['players-daily'].data as {
    value: number | null;
  }[];
  const values = points.flatMap(point => point.value === null ? [] : [point.value]);
  const min = Math.min(...values), max = Math.max(...values);
  let drawing = false;
  let end = {
    x: 775,
    y: 475
  };
  const chart = points.map((point, index) => {
    if (point.value === null) {
      drawing = false;
      return '';
    }
    end = {
      x: 775 + index / Math.max(1, points.length - 1) * 355,
      y: 475 - (point.value - min) / Math.max(1, max - min) * 250
    };
    const command = `${drawing ? 'L' : 'M'}${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
    drawing = true;
    return command;
  }).join(' ');
  const month = new Date(report.month + '-01T00:00:00Z').toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC'
  });
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <style>.label{font:600 21px Inter,Arial,Helvetica,sans-serif;letter-spacing:-.2px;fill:${accent}}.headline{font:700 ${fontSize}px Inter,Arial,Helvetica,sans-serif;letter-spacing:-2.4px;fill:#eef1f7}.metric{font:600 27px Inter,Arial,Helvetica,sans-serif;letter-spacing:-.5px;fill:${accent}}</style>
    <rect width="1200" height="630" fill="#050608"/>
    <image href="data:image/png;base64,${logo.toString('base64')}" x="952" y="62" width="180" height="61" preserveAspectRatio="xMidYMid meet"/>
    <text x="68" y="145" class="label">Roblox ${xml(month)} Stats Report</text>
    ${headlineLines.map((text, index) => `<text x="68" y="${226 + index * 72}" class="headline">${xml(text)}</text>`).join('')}
    <text x="68" y="${438 + Math.max(0, headlineLines.length - 2) * 44}" class="metric">${compact(data.facts.avgPlayers)} average players</text>
    <path d="${chart}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="10" fill="#0c0e12" stroke="${accent}" stroke-width="5"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png({
    compressionLevel: 9,
    palette: true
  }).toBuffer();
}
