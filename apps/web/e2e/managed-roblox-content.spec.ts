import {expect, test, type Page, type TestInfo, type Locator} from '@playwright/test';
import fs from 'node:fs';
import {assertEnvironment, robloxMetadata} from '../../../scripts/ci/selected-roblox-qa-contract';

type Fact = {key: string; label: string; text: string; description: boolean};
type Item = {item: {name: string; imageCreditUrl?: unknown}; system: {slug: string; section: string}; image: string | null; facts: Record<'cards' | 'list', Fact[]>};
type Collection = {path: string; code: string; label: string; pageType: 'database' | 'collectible'; final: {title: string; seo_title: string; meta_description: string; thumb_url?: string}; items: Item[]};
type Hub = {path: string; icon: string; thumb: string; final: Collection['final']};
// Traces contain cookies and request headers; account tokens must stay private.
test.use({trace: 'off', video: 'off'});
const selectedFile = process.env.SELECTED_ROBLOX_BROWSER;
if (selectedFile || process.env.BLOXODES_SELECTED_ROBLOX_QA === 'true') {
  assertEnvironment(process.env);
  if (!selectedFile) throw new Error('Missing selected Roblox browser inventory.');
}
const selected: {urls: {path: string; contains: string}[]; collections: Collection[]; hubs: Hub[]} = selectedFile ? JSON.parse(fs.readFileSync(selectedFile, 'utf8')) : {urls: [], collections: [], hubs: []};
const body = (page: Page) => page.locator('#article-body');
const boxes = (page: Page) => body(page).locator('input[type=checkbox]:visible');
const itemLocator = (page: Page, item: Item, view: 'cards' | 'list', collectible: boolean) => body(page).locator(`[id=${JSON.stringify(`item-${item.system.slug}${collectible && view === 'list' ? '-row' : ''}`)}]:visible`);
async function layout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
async function capture(page: Page, info: TestInfo, name: string) {
  await layout(page);
  await page.screenshot({path: info.outputPath(`${name}-viewport.png`)});
  await page.screenshot({path: info.outputPath(`${name}.png`), fullPage: true});
}
async function html(page: Page, info: TestInfo, route: string, paginated = false) {
  const response = await page.goto(route, {waitUntil: 'load'});
  expect(response?.status()).toBe(200);
  const bytes = (await response!.body()).length;
  await info.attach(`html-${route.replaceAll('/', '-')}.json`, {body: JSON.stringify({route, bytes, warnBytes: 1_000_000, limitBytes: 1_800_000, warning: bytes > 1_000_000}), contentType: 'application/json'});
  expect(bytes, `HTML size for ${route}`).toBeLessThanOrEqual(1_800_000);
  if (bytes > 1_000_000) info.annotations.push({type: 'HTML size warning', description: `${route}: ${bytes} bytes`});
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://bloxodes.com${route}`);
  if (paginated) await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex.*follow/);
  else expect(await page.locator('meta[name=robots]').getAttribute('content')).not.toContain('noindex');
  await layout(page);
}
async function loadedImage(image: Locator, expected: string) {
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element, source) => {
    const image = element as HTMLImageElement;
    const actual = new URL(image.currentSrc || image.src, location.origin);
    return image.complete && image.naturalWidth > 0 && (actual.searchParams.get('url') ?? actual.href) === source;
  }, expected), {timeout: 30_000}).toBe(true);
}
async function metadata(page: Page, expected: ReturnType<typeof robloxMetadata>, image?: string, timeout = 10_000) {
  await expect(page).toHaveTitle(expected.title, {timeout});
  await expect(page.locator('h1')).toHaveText(expected.heading, {timeout});
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', expected.canonical, {timeout});
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', expected.description, {timeout});
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', expected.canonical, {timeout});
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) await expect(page.locator(selector)).toHaveAttribute('content', expected.title, {timeout});
  for (const selector of ['meta[property="og:description"]', 'meta[name="twitter:description"]']) await expect(page.locator(selector)).toHaveAttribute('content', expected.description, {timeout});
  if (image) {
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', image, {timeout});
    await expect(page.locator('meta[name="twitter:image"]').first()).toHaveAttribute('content', image, {timeout});
  }
}
async function facts(page: Page, entry: Collection, view: 'cards' | 'list', items: Item[]) {
  for (const item of items) {
    const row = itemLocator(page, item, view, entry.pageType === 'collectible');
    await expect(row).toContainText(item.item.name);
    expect(item.facts[view].length, `${item.system.slug} useful ${view} fields`).toBeGreaterThan(0);
    for (const fact of item.facts[view]) {
      if (view === 'cards') {
        const value = fact.description ? row.locator('p').first() : row.getByText(fact.label, {exact: true}).locator('..').locator('dd');
        await expect(value, `${item.system.slug}.${fact.key}`).toContainText(fact.text);
      } else {
        const headers = await row.locator('xpath=ancestor::table').locator('thead th').allTextContents();
        const index = headers.findIndex(label => label.trim() === fact.label);
        expect(index, `${item.system.slug}.${fact.key} table header`).toBeGreaterThanOrEqual(0);
        await expect(row.locator(':scope > th, :scope > td').nth(index)).toContainText(fact.text);
      }
    }
    const images = row.locator('img');
    if (item.image) { await expect(images).toHaveCount(1); await loadedImage(images, item.image); }
    else await expect(images).toHaveCount(0);
  }
}
async function missingPage(page: Page, route: string) {
  // APIRequestContext does not use Chromium's bloxodes.test DNS mapping.
  const response = await page.request.get(`http://127.0.0.1:3000${route}`, {maxRedirects: 0, timeout: 30_000});
  expect(response.status()).toBe(404);
  expect(await response.text()).toMatch(/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/);
}
test.beforeEach(async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  (page as Page & {qaErrors?: string[]}).qaErrors = errors;
});
test.afterEach(async ({page}) => { expect((page as Page & {qaErrors?: string[]}).qaErrors).toEqual([]); });
if (selectedFile) test('exact metadata assertions reject suffixes, stale social copy and wrong page canonicals', async ({page}) => {
  const final = {title: 'QA collection', seo_title: '  QA %month% %year%  ', meta_description: 'Approved description.'};
  const image = 'https://bloxodes.com/Bloxodes.png';
  for (const pageNumber of [1, 2]) {
    const expected = robloxMetadata(final, '/wiki/example/pets', 'database', pageNumber);
    // Exercise the same DOM assertions as selected content, including Page N.
    await page.setContent('<title></title><link rel="canonical"><meta name="description"><meta property="og:url"><meta property="og:title"><meta name="twitter:title"><meta property="og:description"><meta name="twitter:description"><meta property="og:image"><meta name="twitter:image"><h1></h1>');
    await page.evaluate(({expected, image}) => {
      document.title = expected.title;
      document.querySelector('h1')!.textContent = expected.heading;
      document.querySelector('link')!.setAttribute('href', expected.canonical);
      for (const meta of document.querySelectorAll('meta')) {
        const key = meta.getAttribute('property') ?? meta.getAttribute('name')!;
        meta.setAttribute('content', key.endsWith('title') ? expected.title : key.endsWith('description') ? expected.description : key.endsWith('image') ? image : expected.canonical);
      }
    }, {expected, image});
    await metadata(page, expected, image);
    const corruptions = [
      {selector: 'title', attribute: null, wrong: `${expected.title} unexpected suffix`},
      ...['og:title', 'twitter:title', 'og:description', 'twitter:description', 'og:url', 'og:image', 'twitter:image'].map(key => ({selector: `meta[${key.startsWith('og:') ? 'property' : 'name'}="${key}"]`, attribute: 'content', wrong: key.endsWith('title') ? `${expected.title} unexpected suffix` : 'Wrong inherited value'})),
      {selector: 'meta[name=description]', attribute: 'content', wrong: final.meta_description + ' unexpected suffix'},
      {selector: 'link[rel=canonical]', attribute: 'href', wrong: 'https://bloxodes.com/wiki/wrong'}
    ];
    for (const change of corruptions) {
      const original = await page.locator(change.selector).evaluate((element, attribute) => attribute ? element.getAttribute(attribute)! : element.textContent!, change.attribute);
      const set = (value: string) => page.locator(change.selector).evaluate((element, {attribute, value}) => { if (attribute) element.setAttribute(attribute, value); else element.textContent = value; }, {attribute: change.attribute, value});
      await set(change.wrong);
      await expect(metadata(page, expected, image, 100), change.selector).rejects.toThrow();
      await set(original);
    }
    await metadata(page, expected, image);
  }
});
for (const url of selected.urls) test(`${url.path} selected wiki sitemap and HTML`, async ({page}, info) => {
  await html(page, info, url.path);
  await expect(page.locator('main')).toContainText(url.contains, {ignoreCase: true});
  const response = await page.request.get('http://127.0.0.1:3000/sitemaps/wiki.xml', {timeout: 30_000});
  expect(response.status()).toBe(200);
  const sitemap = await response.text();
  expect(sitemap).toContain(`<loc>https://bloxodes.com${url.path}</loc>`);
  expect(sitemap).not.toContain(`<loc>https://bloxodes.com${url.path}/page/`);
});
for (const hub of selected.hubs) test(`${hub.path} official artwork, metadata and selected collection CTAs`, async ({page}, info) => {
  await html(page, info, hub.path); await metadata(page, robloxMetadata(hub.final, hub.path, 'hub'), hub.thumb);
  const headerImage = page.locator('main header img').first();
  await loadedImage(headerImage, hub.icon);
  for (const entry of selected.collections.filter(entry => entry.path.startsWith(`${hub.path}/`))) {
    const cta = body(page).locator(`a[href="${entry.path}"]`);
    await expect(cta).toHaveCount(1);
    const section = cta.locator('..');
    await expect(section.locator('.article-content')).toContainText(/\S/);
    expect(await section.evaluate(element => {
      const copy = element.querySelector('.article-content'), link = element.querySelector(':scope > a');
      return Boolean(copy && link && (copy.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING));
    })).toBe(true);
    const expected = [...new Set(entry.items.filter(item => item.image && item.item.imageCreditUrl == null).slice(0, 6).map(item => item.image!))];
    await expect(cta.locator('img')).toHaveCount(expected.length);
    for (const [index, image] of (await cta.locator('img').all()).entries()) await loadedImage(image, expected[index]);
  }
  await capture(page, info, 'hub-artwork');
});
for (const entry of selected.collections) {
  test(`${entry.path} complete card/list fields, exact images and pagination`, async ({page}, info) => {
    await html(page, info, entry.path);
    const socialImage = entry.items.find(item => item.image && item.item.imageCreditUrl == null)?.image ?? entry.final.thumb_url ?? 'https://bloxodes.com/Bloxodes.png';
    const routes = new Set([entry.path]);
    const seen = new Set<string>();
    for (const route of routes) {
      await html(page, info, route, route !== entry.path);
      const pageNumber = route === entry.path ? 1 : Number(route.slice(`${entry.path}/page/`.length));
      await metadata(page, robloxMetadata(entry.final, entry.path, entry.pageType, pageNumber), socialImage);
      // Discover every actual page, then prove the full selected inventory occurs once.
      for (const href of await body(page).locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')!))) {
        if (href.startsWith(`${entry.path}/page/`) && /^\d+$/.test(href.slice(`${entry.path}/page/`.length))) routes.add(href);
      }
      expect(routes.size).toBeLessThanOrEqual(500);
      const view = page.locator('[data-game-collection-view]');
      await expect(view).toHaveAttribute('data-game-collection-view', 'cards');
      const ids = await body(page).locator('[id^="item-"]:visible').evaluateAll(rows => rows.map(row => row.id.slice(5)));
      const items = ids.map(id => { const item = entry.items.find(item => item.system.slug === id); expect(item, `Unexpected row ${id}`).toBeTruthy(); return item!; });
      expect(items.length).toBeGreaterThan(0);
      for (const id of ids) { expect(seen.has(id), `Duplicate item across pages: ${id}`).toBe(false); seen.add(id); }
      await facts(page, entry, 'cards', items); await capture(page, info, `cards-${routes.size}-${seen.size}`);
      await page.getByRole('button', {name: 'List', exact: true}).click();
      await expect(view).toHaveAttribute('data-game-collection-view', 'list');
      await facts(page, entry, 'list', items); await capture(page, info, `list-${seen.size}`);
      if (entry.pageType === 'database') await expect(body(page).locator('input[type=checkbox]')).toHaveCount(0);
    }
    expect([...seen].sort()).toEqual(entry.items.map(item => item.system.slug).sort());
    if (entry.pageType === 'collectible') {
      expect([...routes]).toEqual([entry.path]);
      await expect(body(page).locator(`a[href^="${entry.path}/page/"]`)).toHaveCount(0);
    }
    if (routes.size === 1) await missingPage(page, `${entry.path}/page/2`);
    else expect(routes.has(`${entry.path}/page/2`)).toBe(true);
    await info.attach('inventory.json', {body: JSON.stringify({routes: [...routes], items: [...seen]}), contentType: 'application/json'});
    if (entry.pageType !== 'database') return;
    await page.goto(entry.path);
    const sections = page.getByRole('combobox', {name: 'Jump to section', exact: true});
    const sectionCount = new Set(entry.items.map(item => item.system.section)).size;
    if (sectionCount > 1) {
      await expect(sections).toBeVisible();
      const option = await sections.locator('option').last().getAttribute('value');
      await sections.selectOption(option!);
      await expect.poll(() => new URL(page.url()).hash).not.toBe('');
      const id = decodeURIComponent(new URL(page.url()).hash.slice(1));
      await expect(page.locator(`[id=${JSON.stringify(id)}]`)).toBeVisible();
      await capture(page, info, 'section-selection');
    }
    await page.goto(entry.path);
    const finder = page.getByRole('searchbox', {name: 'Find an item in this collection', exact: true});
    if (entry.items.length >= 100) {
      const item = entry.items[entry.items.length - 1];
      await finder.fill(item.item.name);
      const match = body(page).getByRole('link').filter({hasText: item.item.name}).first();
      await expect(match).toBeVisible(); await match.click();
      await expect(itemLocator(page, item, 'cards', false)).toBeVisible();
    } else await expect(finder).toHaveCount(0); // Actual database UI threshold; no invented filters.
  });
  if (entry.pageType !== 'collectible') continue;
  for (const accountMode of [false, true]) test(`${entry.path} ${accountMode ? 'isolated account' : 'local'} progress and filters`, async ({page, context}, info) => {
    if (accountMode) {
      const ledger = JSON.parse(fs.readFileSync(process.env.SELECTED_ROBLOX_AUTH!, 'utf8'));
      const account = ledger.accounts.find((candidate: {project: string}) => candidate.project === info.project.name);
      expect(account).toBeTruthy();
      await context.addCookies([{name: 'app_session', value: account.token, url: 'http://bloxodes.test:3000', httpOnly: true, sameSite: 'Lax'}]);
    }
    const endpoint = '/api/wiki/collections/progress';
    const waitSave = () => page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT' && response.status() === 200, {timeout: 30_000});
    const loaded = accountMode ? page.waitForResponse(response => response.url().includes(`${endpoint}?code=${entry.code}`) && response.status() === 200) : null;
    await page.goto(entry.path); if (loaded) await loaded;
    await expect(boxes(page)).toHaveCount(entry.items.length);
    await expect(boxes(page).first()).toBeEnabled();
    // Retry cleanup stays on this browser project's isolated account.
    const reset = async () => { const button = page.getByRole('button', {name: 'Reset', exact: true}); if (await button.count()) { const saved = accountMode ? waitSave() : null; await button.click(); if (saved) await saved; } };
    await reset();
    const first = entry.items[0], checkbox = () => itemLocator(page, first, 'cards', true).locator('input[type=checkbox]');
    const mutate = async (checked: boolean) => { const saved = accountMode ? waitSave() : null; await checkbox().setChecked(checked); if (saved) await saved; };
    const reload = async () => {
      if (accountMode) await page.evaluate(() => localStorage.clear());
      const loaded = accountMode ? page.waitForResponse(response => response.url().includes(`${endpoint}?code=${entry.code}`) && response.status() === 200) : null;
      await page.reload(); if (loaded) await loaded;
    };
    const serverProgress = async (expected: string[]) => {
      if (!accountMode) return;
      const data = await page.evaluate(async ({endpoint, code}) => { const response = await fetch(`${endpoint}?code=${code}`); return {status: response.status, data: await response.json()}; }, {endpoint, code: entry.code});
      expect(data.status).toBe(200); expect(data.data.checkedIds).toEqual(expected);
    };
    try {
      await expect(checkbox()).toBeEnabled();
      await mutate(true); await serverProgress([first.system.slug]);
      await reload(); await expect(checkbox()).toBeChecked();
      await mutate(false); await serverProgress([]);
      await reload(); await expect(checkbox()).not.toBeChecked();
      await mutate(true);
      const progress = page.getByRole('combobox', {name: 'Filter by progress'});
      await progress.selectOption('completed'); await expect(boxes(page)).toHaveCount(1);
      await progress.selectOption('remaining'); await expect(boxes(page)).toHaveCount(entry.items.length - 1);
      await progress.selectOption('all');
      const section = page.getByRole('combobox', {name: 'Filter by section'});
      if (new Set(entry.items.map(item => item.system.section)).size > 1) {
        const label = await section.locator('option').nth(1).textContent();
        await section.selectOption({label: label!});
        await expect(boxes(page)).toHaveCount(entry.items.filter(item => item.system.section === label).length);
        await section.selectOption('all');
      } else await expect(section).toHaveCount(0);
      const search = page.getByRole('textbox', {name: `Search ${entry.label}`, exact: true});
      await search.fill('qa-no-such-entry-59db4'); await expect(boxes(page)).toHaveCount(0);
      await expect(page.getByText('No entries match those filters.', {exact: true})).toBeVisible();
      await search.fill(first.item.name); await expect(checkbox()).toBeVisible();
      await search.fill(''); await expect(boxes(page)).toHaveCount(entry.items.length);
      await reset(); await serverProgress([]); await reload();
      await expect(body(page).locator('input[type=checkbox]:checked')).toHaveCount(0);
      await capture(page, info, accountMode ? 'account-reset' : 'local-reset');
    } finally {
      // The workflow's always() cleanup also removes server rows if the browser fails.
      await page.goto(entry.path); await reset();
    }
  });
}
