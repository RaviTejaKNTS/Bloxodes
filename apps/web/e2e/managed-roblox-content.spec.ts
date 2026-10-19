import {expect, test, type Page, type TestInfo} from '@playwright/test';
import fs from 'node:fs';

type Fact = {key: string; label: string; text: string; description: boolean};
type RenderedValue = {text: string; parts: string[]};
type RenderedField = RenderedValue & {label: string};
type Item = {item: {name: string}; system: {slug: string; section: string}; image: string | null; facts: Record<'cards' | 'list', Fact[]>};
type SelectedPage = {path: string; title: string; metaDescription: string; image: string | null};
type Collection = SelectedPage & {pageType: 'database' | 'collectible'; code: string; label: string; count: number; items: Item[]};
type Selection = {urls: Array<{path: string; contains: string}>; pages: SelectedPage[]; collections: Collection[]};
const selectedFile = process.env.SELECTED_ROBLOX_BROWSER;
if (selectedFile && (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.BLOXODES_SELECTED_ROBLOX_QA !== 'true' || process.env.BLOXODES_MANAGED_QA !== 'true' || process.env.SUPABASE_URL !== 'https://bbtcaurrtyoukvjbxbbj.supabase.co' || process.env.TEST_BASE_URL !== 'http://bloxodes.test:3000')) throw new Error('Selected Roblox browser QA requires the managed GitHub runner preview.');
if (process.env.BLOXODES_SELECTED_ROBLOX_QA === 'true' && !selectedFile) throw new Error('Selected Roblox browser inventory is required.');
const selected: Selection = selectedFile ? JSON.parse(fs.readFileSync(selectedFile, 'utf8')) : {urls: [], pages: [], collections: []};
const body = (page: Page) => page.locator('#article-body');
const boxes = (page: Page) => body(page).locator('input[type=checkbox]:visible');
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
// A database stat can render as ordered <li> parts. Mirror splitStatParts,
// retaining every part and its order; scalar values require complete equality.
function expectedStatParts(label: string, value: string): string[] | null {
  const parts = value.split(/\s*;\s*/).map(normalize).filter(Boolean);
  const stat = /bonus|stat/.test(label.toLowerCase());
  if (parts.length > 1 && (stat || parts.every(part => /^[+-]?\d|\b(level|lv\.|rank|tier)\b|:/.test(part.toLowerCase())))) return parts;
  const signed = value.replace(/\s+-\s+/g, ' ').match(/[+-]\s*\d[\s\S]*?(?=\s+[+-]\s*\d|$)/g)?.map(part => normalize(part.replace(/\s+-\s+/g, ' ')));
  return signed && signed.length > 1 && (stat || value.length > 56) ? signed : null;
}
function expectFactValue(actual: RenderedValue | undefined, fact: Fact, pageType: Collection['pageType']) {
  expect(actual, `Missing field ${fact.key}`).toBeDefined();
  const expected = normalize(fact.text);
  if (actual!.parts.length) {
    expect(pageType).toBe('database');
    expect(actual!.parts.map(normalize)).toEqual(expectedStatParts(fact.label, expected));
    expect(actual!.text.replace(/\s/g, '')).toBe(actual!.parts.join('').replace(/\s/g, ''));
  } else expect(normalize(actual!.text), fact.key).toBe(expected);
}
function expectCollectibleFields(fields: RenderedField[], facts: Fact[], view: 'cards' | 'list') {
  // List cells use '-' for nulls. Cards omit them. Neither view may fabricate
  // optional facts, including rows with no authored values at all.
  const meaningful = fields.filter(field => !(view === 'list' && ['-', '—', ''].includes(normalize(field.text))));
  expect(meaningful.map(field => normalize(field.label))).toEqual(facts.map(fact => fact.label));
  meaningful.forEach((field, index) => expectFactValue(field, facts[index], 'collectible'));
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({page}) => { const messages: string[] = []; errors.set(page, messages); page.on('pageerror', error => messages.push(error.message)); });
test.afterEach(async ({page}) => { expect(errors.get(page)).toEqual([]); });
async function screenshot(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path: info.outputPath(`${name}-viewport.png`)});
  await page.screenshot({path: info.outputPath(`${name}-full.png`), fullPage: true});
}
async function loadedImages(page: Page) {
  for (const image of await page.locator('main img:visible').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0), {timeout: 30_000}).toBe(true);
  }
}
async function htmlEvidence(page: Page, info: TestInfo, entry: SelectedPage, route = entry.path) {
  const response = await page.goto(route, {waitUntil: 'load'});
  expect(response?.status()).toBe(200);
  const bytes = (await response!.body()).length;
  await info.attach(`html-${route.replaceAll('/', '-')}.json`, {body: JSON.stringify({path: route, bytes, warning: bytes > 1_000_000, warnBytes: 1_000_000, limitBytes: 1_800_000}), contentType: 'application/json'});
  if (bytes > 1_000_000) info.annotations.push({type: 'HTML size warning', description: `${route}: ${bytes} bytes`});
  expect(bytes, `${route} uncompressed HTML size`).toBeLessThanOrEqual(1_800_000);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toContainText(entry.title);
  await expect(page.locator('h1')).not.toContainText('{count}');
  await expect(page).toHaveTitle(/\S/);
  expect(await page.title()).not.toContain('{count}');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://bloxodes.com${route}`);
  const paginated = route !== entry.path;
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', paginated ? `${entry.metaDescription} Page ${route.split('/').pop()}.` : entry.metaDescription);
  if (paginated) await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  expect(entry.image, 'A selected item image or approved page thumbnail is required for social artwork').toBeTruthy();
  const imageUrl = new URL(entry.image!, 'https://bloxodes.com').href;
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', imageUrl);
  const image = await page.request.get(imageUrl, {timeout: 30_000});
  expect(image.status()).toBe(200); expect(image.headers()['content-type']).toMatch(/^image\//);
  await loadedImages(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

// Read actual rendered cards/table cells once, then compare every row against
// authored fields. The List snapshot includes <th scope=row> in column order.
async function renderedFacts(page: Page, entry: Collection, view: 'cards' | 'list') {
  const selector = view === 'cards' ? '[id^="item-"]:is(article,label):visible' : 'tr[id^="item-"]:visible';
  const rendered = await body(page).locator(selector).evaluateAll(elements => {
    const value = (element: Element | null): RenderedValue => ({text: element?.textContent ?? '', parts: Array.from(element?.querySelectorAll(':scope > ul > li') ?? []).map(part => part.textContent ?? '')});
    return elements.map(element => ({
      id: element.id,
      text: element.textContent ?? '',
      description: value(element.querySelector('p')),
      fields: Array.from(element.querySelectorAll('dl > div')).map(field => ({label: field.querySelector('dt')?.textContent ?? '', ...value(field.querySelector('dd'))})),
      headers: Array.from(element.closest('table')?.querySelectorAll('thead th') ?? []).map(header => header.textContent ?? ''),
      cells: Array.from(element.querySelectorAll(':scope > th, :scope > td')).map(cell => value(cell)),
      images: Array.from(element.querySelectorAll('img')).map(image => image.getAttribute('src'))
    }));
  });
  expect(rendered.length, `${entry.path} has actual ${view} rows`).toBeGreaterThan(0);
  const slugs: string[] = [];
  let useful = 0, expectedUseful = 0;
  for (const row of rendered) {
    const suffix = view === 'list' && entry.pageType === 'collectible' ? '-row' : '';
    const authored = entry.items.find(item => row.id === `item-${item.system.slug}${suffix}`);
    expect(authored, `Unexpected rendered row ${row.id}`).toBeTruthy();
    slugs.push(authored!.system.slug);
    expect(normalize(row.text)).toContain(normalize(authored!.item.name));
    const facts = authored!.facts[view];
    expectedUseful += facts.length;
    if (entry.pageType === 'collectible') {
      const fields = view === 'cards' ? row.fields : row.cells.map((cell, index) => ({...cell, label: normalize(row.headers[index])})).filter(field => !['Done', 'Entry', 'Image'].includes(field.label));
      expectCollectibleFields(fields, facts, view);
    }
    for (const fact of facts) {
      let actual: RenderedValue | undefined;
      if (view === 'cards') actual = fact.description ? row.description : row.fields.find(field => normalize(field.label) === fact.label);
      else actual = row.cells[row.headers.findIndex(label => normalize(label) === fact.label)];
      expectFactValue(actual, fact, entry.pageType); useful++;
    }
    if (authored!.image) expect(row.images, `Mapped image for ${authored!.system.slug}`).toContain(authored!.image);
    else expect(row.images, `Accepted text-only row ${authored!.system.slug}`).toHaveLength(0);
  }
  expect(useful, `${view} must compare every available authored fact`).toBe(expectedUseful);
  await loadedImages(page);
  return slugs;
}
for (const entry of [...selected.pages, ...selected.collections]) {
  test(`${entry.path} selected SEO, images and HTML size`, async ({page}, info) => {
    await htmlEvidence(page, info, entry);
    const expected = selected.urls.find(url => url.path === entry.path)!;
    await expect(page.locator('main')).toContainText(expected.contains, {ignoreCase: true});
    await screenshot(page, info, 'selected-page');
  });
}
for (const entry of selected.collections) {
  test(`${entry.path} all Cards/List facts, counts and pagination`, async ({page}, info) => {
    const pending = [entry.path], visited = new Set<string>(), cards: string[] = [], list: string[] = [];
    while (pending.length) {
      const route = pending.shift()!;
      if (visited.has(route)) continue;
      expect(visited.size).toBeLessThanOrEqual(entry.count);
      visited.add(route);
      await htmlEvidence(page, info, entry, route);
      const view = page.locator('[data-game-collection-view]');
      await expect(view).toHaveAttribute('data-game-collection-view', 'cards');
      cards.push(...await renderedFacts(page, entry, 'cards'));
      if (entry.pageType === 'database') await expect(body(page).locator('input[type=checkbox]')).toHaveCount(0);
      await screenshot(page, info, `cards-${visited.size}`);
      await page.getByRole('button', {name: 'List', exact: true}).click();
      await expect(view).toHaveAttribute('data-game-collection-view', 'list');
      list.push(...await renderedFacts(page, entry, 'list'));
      await screenshot(page, info, `list-${visited.size}`);
      const hrefs = await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')!));
      const pattern = new RegExp(`^${entry.path}/page/([0-9]+)$`);
      pending.push(...hrefs.filter(href => Number(href.match(pattern)?.[1] ?? 0) >= 2 && !visited.has(href)));
    }
    const expected = entry.items.map(item => item.system.slug).sort();
    expect(cards.sort()).toEqual(expected); expect(list.sort()).toEqual(expected);
    expect(cards).toHaveLength(entry.count);
    const pageTwo = await page.request.get(`http://127.0.0.1:3000${entry.path}/page/2`, {maxRedirects: 0, timeout: 30_000});
    expect(pageTwo.status()).toBe(visited.size > 1 ? 200 : 404);
    if (entry.pageType === 'collectible') expect(visited.size).toBe(1);
    const availableOptionalFacts = Object.fromEntries((['cards', 'list'] as const).map(view => [view, entry.items.reduce((count, item) => count + item.facts[view].length, 0)]));
    await info.attach('rendered-inventory.json', {body: JSON.stringify({path: entry.path, routes: [...visited], count: cards.length, availableOptionalFacts, allAuthoredFactsCompared: true}), contentType: 'application/json'});
    if (entry.pageType === 'database') {
      await page.goto(entry.path);
      const sections = page.getByRole('combobox', {name: 'Jump to section', exact: true});
      if (await sections.count()) {
        const option = await sections.locator('option').last().getAttribute('value');
        await sections.selectOption(option!);
        await expect.poll(() => new URL(page.url()).hash).not.toBe('');
        const id = decodeURIComponent(new URL(page.url()).hash.slice(1));
        await expect(page.locator(`[id=${JSON.stringify(id)}]`)).toBeVisible();
        await screenshot(page, info, 'section-navigation');
      }
    }
  });
  if (entry.pageType === 'collectible') {
    test(`${entry.path} local persistence, filters, search and reset`, async ({page}, info) => {
      await page.goto(entry.path);
      await expect(boxes(page)).toHaveCount(entry.count);
      const first = boxes(page).first(); await expect(first).toBeEnabled();
      const id = await first.getAttribute('id');
      await first.check(); await page.reload();
      await expect(page.locator(`[id=${JSON.stringify(id)}]`)).toBeChecked();
      await page.getByRole('combobox', {name: 'Filter by progress'}).selectOption('completed');
      await expect(boxes(page)).toHaveCount(1);
      await page.getByRole('combobox', {name: 'Filter by progress'}).selectOption('remaining');
      await expect(boxes(page)).toHaveCount(entry.count - 1);
      await page.getByRole('combobox', {name: 'Filter by progress'}).selectOption('all');
      const sections = page.getByRole('combobox', {name: 'Filter by section'});
      if (await sections.count()) {
        const label = await sections.locator('option').nth(1).textContent();
        await sections.selectOption({label: label!});
        await expect(boxes(page)).toHaveCount(entry.items.filter(item => item.system.section === label).length);
        await sections.selectOption('all');
      }
      const search = page.getByRole('textbox', {name: `Search ${entry.label}`, exact: true});
      await search.fill('qa-no-match-7cc5'); await expect(boxes(page)).toHaveCount(0);
      await expect(page.getByText('No entries match those filters.', {exact: true})).toBeVisible();
      const firstSlug = id!.slice(`collection-check-${entry.code}-`.length);
      const name = entry.items.find(item => item.system.slug === firstSlug)!.item.name;
      await search.fill(name); await expect(page.locator(`[id=${JSON.stringify(id)}]`)).toBeVisible();
      await search.fill(''); await page.getByRole('button', {name: 'Reset', exact: true}).click();
      await page.reload(); await expect(body(page).locator('input[type=checkbox]:checked')).toHaveCount(0);
      await screenshot(page, info, 'local-reset');
    });
    test.describe(`${entry.path} authenticated fixture`, () => {
      // Cookie operations and authenticated requests must never enter traces.
      test.use({trace: 'off'});
      test('owned account persists after localStorage clear', async ({page, context}, info) => {
        const accounts: Array<{project: string; token: string}> = JSON.parse(fs.readFileSync(process.env.SELECTED_ROBLOX_AUTH!, 'utf8'));
        const account = accounts.find(candidate => candidate.project === info.project.name);
        expect(account).toBeTruthy();
        await context.addCookies([{name: 'app_session', value: account!.token, url: 'http://bloxodes.test:3000', httpOnly: true, sameSite: 'Lax'}]);
        const endpoint = '/api/wiki/collections/progress';
        const loaded = page.waitForResponse(response => response.url().includes(`${endpoint}?code=${entry.code}`) && response.request().method() === 'GET' && response.status() === 200);
        await page.goto(entry.path); await loaded;
        const box = boxes(page).first(); await expect(box).toBeEnabled();
        const mutate = (checked: boolean) => {
          const response = page.waitForResponse(response => response.url().endsWith(endpoint) && response.request().method() === 'PUT' && response.request().postDataJSON()?.code === entry.code);
          return Promise.all([box.setChecked(checked), response]).then(([, saved]) => expect(saved.status()).toBe(200));
        };
        if (await box.isChecked()) await mutate(false);
        await mutate(true);
        await page.evaluate(() => localStorage.clear()); await page.reload(); await expect(boxes(page).first()).toBeChecked();
        await mutate(false);
        await page.evaluate(() => localStorage.clear()); await page.reload(); await expect(boxes(page).first()).not.toBeChecked();
        const saved = await page.evaluate(async ({endpoint, code}) => {
          const response = await fetch(`${endpoint}?code=${encodeURIComponent(code)}`);
          return {status: response.status, body: await response.json()};
        }, {endpoint, code: entry.code});
        expect(saved).toEqual({status: 200, body: {checkedIds: []}});
        await info.attach('account-progress-status.json', {body: JSON.stringify({code: entry.code, project: info.project.name, status: saved.status, restoredAfterLocalStorageClear: true, resetVerified: true}), contentType: 'application/json'});
        await screenshot(page, info, 'account-progress');
      });
    });
  }
}

// These regressions run in the selected GitHub browser job, using the same
// comparison functions as both real views. No managed fixture is needed here.
for (const view of ['cards', 'list'] as const) {
  test(`${view} compares complete facts and ordered stat parts`, () => {
    for (const [expected, wrong] of [['6 s', '16 s'], ['Free', 'Not Free']]) {
      const fact = {key: 'value', label: 'Value', text: expected, description: false};
      expectFactValue({text: expected, parts: []}, fact, 'database');
      expect(() => expectFactValue({text: wrong, parts: []}, fact, 'database')).toThrow();
      expect(() => expectFactValue({text: wrong, parts: []}, fact, 'collectible')).toThrow();
    }
    const fact = {key: 'stats', label: 'Stats', text: '+5 Speed; +10 Health', description: false};
    expectFactValue({text: '+5 Speed+10 Health', parts: ['+5 Speed', '+10 Health']}, fact, 'database');
    expect(() => expectFactValue({text: '+10 Health+5 Speed', parts: ['+10 Health', '+5 Speed']}, fact, 'database')).toThrow();
    expect(() => expectFactValue({text: '+5 Speed', parts: ['+5 Speed']}, fact, 'database')).toThrow();
    expect(() => expectFactValue({text: '+5 Speed+10 Health invented', parts: ['+5 Speed', '+10 Health']}, fact, 'database')).toThrow();
  });
  test(`${view} requires known sparse facts and rejects fabricated unknown facts`, () => {
    const facts = ['Epic', 'Alien Egg', 'Circle in the lobby'].map((text, index) => ({key: ['rarity', 'egg', 'hatchingLocation'][index], label: ['Rarity', 'Egg', 'Hatching Location'][index], text, description: false}));
    const fields = facts.map(fact => ({label: fact.label, text: fact.text, parts: []}));
    expectCollectibleFields(fields, facts, view);
    expect(() => expectCollectibleFields(fields.slice(1), facts, view)).toThrow();
    expectCollectibleFields(view === 'list' ? fields.map(field => ({...field, text: '-'})) : [], [], view);
    expect(() => expectCollectibleFields(fields, [], view)).toThrow();
  });
}
