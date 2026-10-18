import {expect, test, type Page, type TestInfo, type Response} from '@playwright/test';
import fs from 'node:fs';
import {buildCollectionPagination} from '../src/components/game-collections/collection-pagination';
import type {WikiQaCollection, WikiQaItem, WikiQaState} from '../../../scripts/ci/managed-wiki-qa-types';

// This suite includes authenticated sessions. Worker-scoped recording options
// belong at file scope, and session cookies must never enter traces or videos.
test.use({trace: 'off', video: 'off'});

const state: WikiQaState | null = process.env.MANAGED_WIKI_STATE
  ? JSON.parse(fs.readFileSync(process.env.MANAGED_WIKI_STATE, 'utf8')) : null;
const canonicalOrigin = 'https://bloxodes.com';
const sectionId = (label: string) => `section-${label.replace(/\+/g, ' plus ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
function sections(entry: WikiQaCollection) {
  const labels = [...new Set(entry.items.map(item => item.section))];
  const rank = (label: string) => {
    const index = entry.sectionOrder.indexOf(label);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  return labels.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map(label => ({
    id: sectionId(label), label,
    items: entry.items.filter(item => item.section === label).sort((a, b) => a.sortOrder - b.sortOrder).map(item => ({
      ...item.fields, id: item.id, name: item.name, image: item.image, __section: item.section, __sortOrder: item.sortOrder
    }))
  }));
}
function pagination(entry: WikiQaCollection, currentPage: number) {
  return buildCollectionPagination({sections: sections(entry), currentPage, basePath: entry.path});
}
async function htmlEvidence(response: Response | null, pathname: string, info: TestInfo) {
  expect(response, pathname).not.toBeNull();
  const bytes = (await response!.body()).byteLength;
  expect(bytes, `${pathname} uncompressed HTML bytes`).toBeLessThanOrEqual(2_000_000);
  await info.attach('http-html-size', {body: JSON.stringify({path: pathname, status: response!.status(), bytes}), contentType: 'application/json'});
}
async function metadata(page: Page, pathname: string, indexable: boolean) {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}${pathname}`);
  const values = await page.locator('meta[name="robots"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('content') ?? '').join(','));
  if (indexable) expect(values).not.toMatch(/noindex/i);
  else {
    expect(values).toMatch(/noindex/i);
    expect(values).toMatch(/(?:^|[\s,])follow(?:$|[\s,])/i);
  }
}
async function structuredData(page: Page, pathname: string, expected: WikiQaItem[], total: number) {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const nodes = scripts.flatMap(raw => {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed['@graph'] ?? [parsed];
  });
  expect(nodes.some(node => node['@type'] === 'WebPage' && node.url === `${canonicalOrigin}${pathname}`)).toBe(true);
  const list = nodes.find(node => node['@type'] === 'ItemList' && node.url === `${canonicalOrigin}${pathname}`);
  expect(list).toBeTruthy();
  expect(list.numberOfItems).toBe(total);
  expect(list.itemListElement.map((node: {item: {name: string}}) => node.item.name)).toEqual(expected.map(item => item.name));
  expect(list.itemListElement.map((node: {item: {url: string}}) => node.item.url)).toEqual(expected.map(item => `${canonicalOrigin}${pathname}#item-${item.id}`));
}
function fieldText(value: unknown, collectible: boolean): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return collectible ? String(value) : value.toLocaleString('en-US');
  if (typeof value === 'boolean') return collectible ? String(value) : value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(part => fieldText(part, collectible)).filter(Boolean).join('; ');
  if (typeof value === 'object') return ''; // Exact structured fields are compared by the managed readback helper.
  const text = String(value).replace(/\s+/g, ' ').trim();
  return !collectible && /^(none|n\/a|na|null)$/i.test(text) ? '' : text;
}
async function visibleRows(page: Page, entry: WikiQaCollection, items: WikiQaItem[]) {
  const cards = page.getByRole('button', {name: 'Cards', exact: true});
  if (await cards.count()) await cards.click();
  for (const item of items) {
    const row = page.locator(`[id="item-${item.id}"]:visible`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(item.name);
    for (const field of entry.cardFields) {
      const text = fieldText(item.fields[field], entry.pageType === 'collectible');
      if (text) await expect(row.locator('dl'), `${item.id}.${field}`).toContainText(text);
    }
    if (item.image) {
      const image = row.locator('img').first();
      await expect(image).toHaveAttribute('src', item.image);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    }
  }
}

// With no committed selection, this spec adds no tests to unrelated QA runs.
for (const url of state?.urls ?? []) {
  test(`${url.path} selected search, HTML size and JSON-LD readback`, async ({page}, info) => {
    const response = await page.goto(url.path);
    expect(response?.status()).toBe(200);
    await htmlEvidence(response, url.path, info);
    await metadata(page, url.path, true);
    if (url.path === state!.urls[0].path) {
      const health = await page.evaluate(async () => {
        const response = await fetch('/api/health?scope=deploy');
        return {status: response.status, body: await response.json()};
      });
      expect(health.status).toBe(200);
      expect(health.body.ok).toBe(true);
      expect(health.body.build.sha).toBe(state!.testHeadSha);
      await info.attach('preview-build', {body: JSON.stringify(health), contentType: 'application/json'});
    }
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(schemas.length).toBeGreaterThan(0);
    for (const raw of schemas) expect(JSON.parse(raw)).toBeTruthy();
    const query = state!.collections.find(entry => entry.path === url.path)?.title ?? url.contains;
    const result = await page.evaluate(async query => {
      const response = await fetch(`/api/search/all?scope=wiki&limit=200&q=${encodeURIComponent(query)}`);
      return {status: response.status, body: await response.json()};
    }, query);
    expect(result.status).toBe(200);
    expect(result.body.items.some((item: {type: string; url: string}) => item.type === 'wiki' && new URL(item.url, canonicalOrigin).pathname === url.path)).toBe(true);
    await info.attach('selected-search', {body: JSON.stringify({path: url.path, query, ...result}), contentType: 'application/json'});
  });
}
for (const entry of state?.collections ?? []) {
  const grouped = sections(entry);
  const totalPages = entry.pageType === 'collectible' ? 1 : pagination(entry, 1).info.totalPages;
  for (let current = 1; current <= totalPages; current++) {
    const pathname = current === 1 ? entry.path : `${entry.path}/page/${current}`;
    const selected = entry.pageType === 'collectible' ? grouped : pagination(entry, current).sections;
    const ids = selected.flatMap(section => section.items.map(item => item.id));
    const items = ids.map(id => entry.items.find(item => item.id === id)!);
    test(`${pathname} preserves selected rows, sections, fields and images`, async ({page}, info) => {
      test.setTimeout(180_000);
      const response = await page.goto(pathname);
      expect(response?.status()).toBe(200);
      await htmlEvidence(response, pathname, info);
      await metadata(page, pathname, current === 1);
      await expect(page.locator('h1')).toHaveText(current === 1 ? entry.title : `${entry.title} - Page ${current}`);
      await expect(page).toHaveTitle(current === 1 ? entry.seoTitle : `${entry.seoTitle} - Page ${current}`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', current === 1 ? entry.description : `${entry.description} Page ${current}.`);
      await structuredData(page, pathname, items, entry.items.length);
      await visibleRows(page, entry, items);
      for (const section of selected) await expect(page.locator(`[id="${section.id}"]`)).toContainText(section.label);
      const nav = page.getByRole('navigation', {name: 'Pagination', exact: true});
      if (totalPages === 1) await expect(nav).toHaveCount(0);
      else {
        await expect(nav.first()).toBeVisible();
        const next = current < totalPages ? current + 1 : current - 1;
        const href = next === 1 ? entry.path : `${entry.path}/page/${next}`;
        await nav.first().getByRole('link', {name: String(next), exact: true}).click();
        await expect(page).toHaveURL(new URL(href, page.url()).href);
        await metadata(page, href, next === 1);
        await page.goto(pathname);
      }
      if (entry.pageType === 'database' && grouped.length > 1) {
        for (const section of pagination(entry, current).sectionLinks) {
          await page.getByRole('combobox', {name: 'Jump to section', exact: true}).selectOption(section.id);
          await expect(page).toHaveURL(new URL(section.href, page.url()).href);
          await expect(page.locator(`[id="${section.id}"]`)).toBeVisible();
        }
      }
      await info.attach('frozen-selection', {body: JSON.stringify({bundleHash: state!.bundleHash, reviewedSourceSha: state!.reviewedSourceSha,
        testHeadSha: state!.testHeadSha, path: pathname, pageType: entry.pageType, totalPages, itemIds: ids}), contentType: 'application/json'});
      await page.screenshot({path: info.outputPath('selected-collection.png'), fullPage: true});
    });
  }
  test(`${entry.path} rejects the first nonexistent continuation`, async ({page}, info) => {
    const pathname = `${entry.path}/page/${totalPages + 1}`;
    const response = await page.goto(pathname);
    expect(response?.status()).toBe(404);
    await htmlEvidence(response, pathname, info);
    const robots = await page.locator('meta[name="robots"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('content')).join(','));
    expect(`${robots},${response?.headers()['x-robots-tag'] ?? ''}`).toMatch(/noindex/i);
    if (entry.pageType === 'collectible') {
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}${entry.path}`);
    }
    await info.attach('invalid-continuation-metadata', {body: JSON.stringify({path: pathname, robots,
      canonical: await page.locator('link[rel="canonical"]').first().getAttribute('href').catch(() => null)}), contentType: 'application/json'});
  });
  if (entry.pageType !== 'collectible') continue;
  const first = grouped[0].items[0];
  const checkedBox = (page: Page) => page.locator(`[id="item-${first.id}"] input[type="checkbox"]`);
  test(`${entry.path} keeps local ticks and supports filters and reset`, async ({page}, info) => {
    await page.goto(entry.path);
    const box = checkedBox(page);
    await expect(box).toBeEnabled();
    await expect(box).not.toBeChecked();
    await box.check();
    await page.reload();
    await expect(checkedBox(page)).toBeChecked();
    await checkedBox(page).uncheck();
    await page.reload();
    await expect(checkedBox(page)).not.toBeChecked();
    await checkedBox(page).check();
    await expect(page.getByRole('status').filter({hasText: 'completed'})).toContainText(`1 of ${entry.items.length} completed`);
    const progress = page.getByRole('combobox', {name: 'Filter by progress', exact: true});
    await progress.selectOption('completed');
    await expect(page.locator('main input[type="checkbox"]:visible')).toHaveCount(1);
    await expect(checkedBox(page)).toBeVisible();
    await progress.selectOption('remaining');
    await expect(page.locator('main input[type="checkbox"]:visible')).toHaveCount(entry.items.length - 1);
    await expect(checkedBox(page)).toHaveCount(0);
    await progress.selectOption('all');
    if (grouped.length > 1) {
      for (const section of grouped) {
        await page.getByRole('combobox', {name: 'Filter by section', exact: true}).selectOption(section.id);
        await expect(page.locator('main input[type="checkbox"]:visible')).toHaveCount(section.items.length);
        for (const item of section.items) await expect(page.locator(`[id="item-${item.id}"]`)).toBeVisible();
      }
      await page.getByRole('combobox', {name: 'Filter by section', exact: true}).selectOption('all');
    } else await expect(page.getByRole('combobox', {name: 'Filter by section', exact: true})).toHaveCount(0);
    await page.getByRole('button', {name: 'Reset', exact: true}).click();
    await expect(page.locator('main input[type="checkbox"]:checked')).toHaveCount(0);
    await page.reload();
    await expect(checkedBox(page)).not.toBeChecked();
    await expect(page.getByRole('navigation', {name: 'Pagination', exact: true})).toHaveCount(0);
    await page.screenshot({path: info.outputPath('collectible-local-reset.png'), fullPage: true});
  });
  test.describe(`${entry.path} temporary account`, () => {
    test('persists account ticks, filters and reset after local storage is cleared', async ({page, context}, info) => {
      test.setTimeout(120_000);
      const accounts: Array<{project: string; token: string}> = JSON.parse(fs.readFileSync(process.env.MANAGED_WIKI_AUTH!, 'utf8'));
      const account = accounts.find(account => account.project === info.project.name);
      if (!account) throw new Error('No temporary account for this browser project.');
      await context.addCookies([{name: 'app_session', value: account.token, url: info.project.use.baseURL!, httpOnly: true, sameSite: 'Lax'}]);
      const remote = (method: string) => page.waitForResponse(response => {
        const url = new URL(response.url());
        if (url.pathname !== '/api/wiki/collections/progress' || response.request().method() !== method) return false;
        return method === 'GET' ? url.searchParams.get('code') === entry.code : response.request().postDataJSON()?.code === entry.code;
      });
      const load = remote('GET');
      await page.goto(entry.path);
      const loaded = await load;
      expect(loaded.status()).toBe(200);
      const initial = await loaded.json();
      await expect(checkedBox(page)).toBeEnabled();
      await expect(checkedBox(page)).toBeChecked({checked: initial.checkedIds.includes(first.id)});
      async function toggle(checked: boolean) {
        const write = remote('PUT');
        await checkedBox(page).setChecked(checked);
        const saved = await write;
        expect(saved.status()).toBe(200);
        expect((await saved.json()).checkedIds).toEqual(checked ? [first.id] : []);
      }
      if (initial.checkedIds.includes(first.id)) await toggle(false); // Retry only touches this owned account.
      await toggle(true);
      async function reloadFromAccount(expected: string[]) {
        await page.evaluate(() => localStorage.clear());
        expect(await page.evaluate(() => localStorage.length)).toBe(0);
        const readback = remote('GET');
        await page.reload();
        const response = await readback;
        expect(response.status()).toBe(200);
        expect((await response.json()).checkedIds).toEqual(expected);
        await expect(checkedBox(page)).toBeChecked({checked: expected.length > 0});
      }
      await reloadFromAccount([first.id]);
      await toggle(false);
      await reloadFromAccount([]);
      await toggle(true);
      const progress = page.getByRole('combobox', {name: 'Filter by progress', exact: true});
      await progress.selectOption('completed');
      await expect(page.locator('main input[type="checkbox"]:visible')).toHaveCount(1);
      await expect(checkedBox(page)).toBeVisible();
      await progress.selectOption('remaining');
      await expect(page.locator('main input[type="checkbox"]:visible')).toHaveCount(entry.items.length - 1);
      await expect(checkedBox(page)).toHaveCount(0);
      await progress.selectOption('all');
      if (grouped.length > 1) {
        for (const section of grouped) {
          await page.getByRole('combobox', {name: 'Filter by section', exact: true}).selectOption(section.id);
          await expect(page.locator('main input[type="checkbox"]:visible')).toHaveCount(section.items.length);
        }
        await page.getByRole('combobox', {name: 'Filter by section', exact: true}).selectOption('all');
      }
      const reset = remote('PUT');
      await page.getByRole('button', {name: 'Reset', exact: true}).click();
      const cleared = await reset;
      expect(cleared.status()).toBe(200);
      expect((await cleared.json()).checkedIds).toEqual([]);
      await expect(page.locator('main input[type="checkbox"]:checked')).toHaveCount(0);
      await reloadFromAccount([]);
      await info.attach('account-progress', {body: JSON.stringify({code: entry.code, endpoint: '/api/wiki/collections/progress',
        successfulWriteAndReload: true, localStorageCleared: true, filtersAndServerReset: true}), contentType: 'application/json'});
      await page.screenshot({path: info.outputPath('collectible-account.png'), fullPage: true});
    });
  });
}
