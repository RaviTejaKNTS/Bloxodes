import { isDeepStrictEqual } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { featureImage } from '../reports/feature-image';
import { createClient } from '@supabase/supabase-js';
import type { ContentOptions } from './wiki-content-options';
import { validateReport, canReplace, resolveLinks } from '../reports/validate';
import { assertLocalContentPublication } from '../shared/local-content-publication-guard';
import { revalidatePublishedContent } from '../shared/revalidate-published-content';
import { hash } from '../reports/build';
const client = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    fetch: (input, init) => fetch(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000)
    })
  }
});
const xml = (v: string) => v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export async function publishStatsReport(options: ContentOptions) {
  if (options.only?.length || options.approvedHubCoverSha256)
    throw Error('Stats reports do not accept wiki options');
  const root = path.resolve(options.bundle!), { report, data, sha } = await validateReport(root);
  console.log(`Validated stats-report@1 ${report.slug}, ${Object.keys(data.charts).length} charts`);
  if (options.target === 'production') {
    await assertLocalContentPublication();
    if (new URL(process.env.SUPABASE_MEDIA_PUBLIC_URL || 'https://invalid.example').origin !== 'https://media.bloxodes.com')
      throw Error('Production requires SUPABASE_MEDIA_PUBLIC_URL=https://media.bloxodes.com');
  }
  const db = client();
  const { data: existing, error } = await db.from('stats_reports').select('*').eq('slug', report.slug).abortSignal(AbortSignal.timeout(30000)).maybeSingle();
  if (error)
    throw error;
  canReplace(existing, sha, options.updatePublished);
  if (!options.apply) {
    console.log('PASS dry run: no database or storage writes');
    return;
  }
  if (options.target === 'production' && !options.allowProd)
    throw Error('Production requires --allow-prod');
  const bucket = process.env.SUPABASE_MEDIA_BUCKET;
  if (!bucket)
    throw Error('Missing SUPABASE_MEDIA_BUCKET');
  const png = await featureImage(report, data);
  await fs.writeFile(path.join(root, 'feature.png'), png);
  const mediaPath = `stats-reports/${report.slug}/${hash(png)}.png`;
  if (options.target === 'production')
    await assertLocalContentPublication();
  const upload = await db.storage.from(bucket).upload(mediaPath, png, {
    contentType: 'image/png',
    upsert: true
  });
  if (upload.error)
    throw upload.error;
  const mediaOrigin = process.env.SUPABASE_MEDIA_PUBLIC_URL || process.env.SUPABASE_URL!;
  const feature_image_url = `${mediaOrigin.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${mediaPath}`;
  const media = await fetch(feature_image_url, {
    signal: AbortSignal.timeout(30000)
  });
  if (!media.ok || hash(Buffer.from(await media.arrayBuffer())) !== hash(png))
    throw Error('Feature media readback failed');
  const now = new Date().toISOString();
  const resolvedContent = {
    ...report,
    short_version: report.short_version.map(text => resolveLinks(text, data.games)),
    body: report.body.map(block => block.type === 'p' ? {
      ...block,
      md: resolveLinks(block.md, data.games)
    } : block.type === 'dates' ? {
      ...block,
      rows: block.rows.map(row => ({
        ...row,
        md: resolveLinks(row.md, data.games)
      }))
    } : block)
  };
  const gameIds = new Set<string>();
  const collectIds = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(collectIds);
      return;
    }
    if (value && typeof value === 'object')
      for (const [key, item] of Object.entries(value)) {
        if ((key === 'id' || key === 'biggest') && typeof item === 'number')
          gameIds.add(String(item));
        else
          collectIds(item);
      }
  };
  collectIds(data.charts);
  for (const match of JSON.stringify(report).matchAll(/game:(\d+)/g))
    gameIds.add(match[1]);
  const renderData = {
    facts: data.facts,
    charts: data.charts,
    games: Object.fromEntries([...gameIds].filter(id => data.games[id]).map(id => [id, data.games[id]]))
  };
  const row = {
    slug: report.slug,
    month: report.month + '-01',
    title: report.title,
    meta_description: report.meta_description,
    dek: report.dek,
    content: resolvedContent,
    data: renderData,
    feature_image_url,
    visibility: options.visibility ?? 'hidden',
    contract: report.contract,
    data_sha256: sha,
    published_at: existing?.published_at ?? now,
    updated_at: now
  };
  if (options.target === 'production')
    await assertLocalContentPublication();
  const written = await db.from('stats_reports').upsert(row, {
    onConflict: 'slug'
  }).select('*').abortSignal(AbortSignal.timeout(30000)).single();
  if (written.error)
    throw written.error;
  for (const key of Object.keys(row)) {
    if (key === 'updated_at' || key === 'published_at') {
      if (Date.parse(written.data[key]) !== Date.parse(String((row as Record<string, unknown>)[key])))
        throw Error(`Report readback mismatch ${key}`);
    }
    else if (!isDeepStrictEqual(written.data[key], (row as Record<string, unknown>)[key]))
      throw Error(`Report readback mismatch ${key}`);
  }
  if (options.target === 'production') {
    await revalidatePublishedContent(process.env, [{
      type: 'stats',
      slug: `reports/${report.slug}`
    }]);
    const response = await fetch(`https://bloxodes.com/stats/reports/${report.slug}`, {
      signal: AbortSignal.timeout(30000)
    });
    const html = await response.text();
    if (response.status !== 200 || !html.includes(`<title>${xml(report.title)}`) || !html.includes(`rel="canonical" href="https://bloxodes.com/stats/reports/${report.slug}"`) || !html.includes(`property="og:image" content="${feature_image_url}"`) || row.visibility === 'hidden' && !html.includes('noindex') || report.body.filter(block => block.type === 'chart').some(block => !html.includes(`data-report-chart="${block.id}"`)))
      throw Error('Live report verification failed');
  }
  console.log(`PASS published ${report.slug} ${row.visibility}`);
}
export async function statsReportStatus(options: ContentOptions) {
  const { data, error } = await client().from('stats_reports').select('slug,month,visibility,title,data_sha256,feature_image_url,updated_at').eq('slug', options.statsReport!).abortSignal(AbortSignal.timeout(30000)).maybeSingle();
  if (error)
    throw error;
  console.log(JSON.stringify(data, null, 2));
}
