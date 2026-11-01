import {expect, test, type Page, type TestInfo} from '@playwright/test';
import fs from 'node:fs';

type VisibleFact = {key: string; label: string; text: string; description: boolean};
type CollectionEntry = {path: string; hubPath: string; pageType: 'database' | 'collectible'; count: number; code: string; label: string; imageCount: number; reviewImages: string[]; display: Record<string, unknown>; visibleFacts: Record<'cards' | 'list', VisibleFact[]>; items: Array<{item: {name: string; [key: string]: unknown}; system: {section: string; slug: string}}>};
type SelectedPage = {kind: 'hub' | 'quiz'; path: string; row: {slug: string}};
type BrowserSelection = {namespace: string; urls: Array<{path: string; contains: string}>; collections: CollectionEntry[]; pages: SelectedPage[]};
type Account = {project: string; token: string};

const selectedFile = process.env.SELECTED_FRANCHISE_BROWSER;
if (selectedFile && (process.env.GITHUB_ACTIONS !== 'true' || process.env.BLOXODES_SELECTED_FRANCHISE_QA !== 'true' || process.env.SUPABASE_URL !== 'https://bbtcaurrtyoukvjbxbbj.supabase.co' || process.env.TEST_BASE_URL !== 'http://bloxodes.test:3000')) throw new Error('Selected browser QA runs only on the managed GitHub preview.');
const selected: BrowserSelection = selectedFile ? JSON.parse(fs.readFileSync(selectedFile, 'utf8')) : {namespace: '', urls: [], collections: [], pages: []};
const collectionBody = (page: Page) => page.locator('#article-body');
const visibleBoxes = (page: Page) => collectionBody(page).locator('input[type=checkbox]:visible');
async function layout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  await layout(page);
  await page.screenshot({path: info.outputPath(`${name}-viewport.png`)});
  await page.screenshot({path: info.outputPath(`${name}.png`), fullPage: true});
}
async function usefulFields(page: Page, entry: CollectionEntry, view: 'cards' | 'list') {
  const authored = entry.items[0];
  const suffix = view === 'list' && entry.pageType === 'collectible' ? '-row' : '';
  const item = collectionBody(page).locator(`[id=${JSON.stringify(`item-${authored.system.slug}${suffix}`)}]`);
  await expect(item).toBeVisible();
  await expect(item).toContainText(authored.item.name);
  const facts = entry.visibleFacts[view];
  expect(facts.length, 'At least one visible non-identity authored fact is required').toBeGreaterThan(0);
  for (const fact of facts) {
    if (view === 'cards') {
      const value = fact.description ? item.locator('p').first() : item.getByText(fact.label, {exact: true}).locator('..').locator('dd');
      await expect(value, `${fact.key} in ${view}`).toContainText(fact.text);
    } else {
      const headers = await item.locator('xpath=ancestor::table').locator('thead th').allTextContents();
      const column = headers.findIndex(label => label.trim() === fact.label);
      expect(column, `Visible table column for ${fact.key}`).toBeGreaterThanOrEqual(0);
      await expect(item.locator(':scope > th, :scope > td').nth(column), `${fact.key} in ${view}`).toContainText(fact.text);
    }
  }
}
async function htmlEvidence(page: Page, info: TestInfo, route: string, pageTwo = false) {
  const response = await page.goto(route, {waitUntil: 'load'});
  expect(response?.status()).toBe(200);
  expect(response?.request().redirectedFrom(), route).toBeNull();
  expect(new URL(page.url()).pathname).toBe(route);
  const body = await response!.body();
  const result = {path: route, previewUrl: page.url(), status: response!.status(), bytes: body.length, warning: body.length > 1_000_000, limitBytes: 1_800_000, warnBytes: 1_000_000};
  await info.attach(`html-size-${route.replaceAll('/', '-')}.json`, {body: JSON.stringify(result), contentType: 'application/json'});
  expect(body.length, `HTML hard limit: ${route}`).toBeLessThanOrEqual(1_800_000);
  if (result.warning) info.annotations.push({type: 'HTML size warning', description: `${route}: ${body.length} bytes`});
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://bloxodes.com${route}`);
  if (pageTwo) await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  await layout(page);
}
test.beforeEach(async ({page}) => {
  // Fail client exceptions as part of the focused tests as well as smoke QA.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  (page as Page & {qaErrors?: string[]}).qaErrors = errors;
});
test.afterEach(async ({page}) => {
  expect((page as Page & {qaErrors?: string[]}).qaErrors).toEqual([]);
});
test('collectible List facts include the Entry row header in column positions', async ({page}) => {
  await page.setContent('<div id="article-body"><table><thead><tr><th>Done</th><th>Entry</th><th>Nearby course</th><th>Approach</th><th>Location</th></tr></thead><tbody><tr id="item-first-row"><td><input type="checkbox"></td><th scope="row">First mission</th><td>Peach Stadium</td><td>Approach placeholder</td><td>Beneath the raised track</td></tr></tbody></table></div>');
  const entry: CollectionEntry = {
    path: '/example/wiki/world/missions', hubPath: '/example/wiki/world', pageType: 'collectible', count: 1,
    code: 'world-missions', label: 'Missions', imageCount: 0, reviewImages: [], display: {},
    items: [{item: {name: 'First mission'}, system: {slug: 'first', section: 'Central'}}],
    visibleFacts: {cards: [], list: [
      {key: 'nearbyCourse', label: 'Nearby course', text: 'Peach Stadium', description: false},
      {key: 'location', label: 'Location', text: 'Beneath the raised track', description: false}
    ]}
  };
  await usefulFields(page, entry, 'list');
});
for (const url of selected.urls) {
  test(`${url.path} selected HTML size and sitemap`, async ({page}, info) => {
    await htmlEvidence(page, info, url.path);
    await expect(page.locator('main')).toContainText(url.contains, {ignoreCase: true});
    // APIRequestContext does not use Chromium's test-host DNS mapping.
    const sitemap = await page.request.get('http://127.0.0.1:3000/sitemaps/games.xml', {timeout: 30_000});
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain(`<loc>https://bloxodes.com${url.path}</loc>`);
    for (const collection of selected.collections) {
      expect(xml).not.toContain(`<loc>https://bloxodes.com${collection.path}/page/`);
    }
  });
}
for (const hub of selected.pages.filter(page => page.kind === 'hub')) {
  test(`${hub.path} hosted artwork loads before visual review`, async ({page}, info) => {
    await page.goto(hub.path, {waitUntil: 'load'});
    const images = page.locator('main img[src^="https://media.bloxodes.com/"]');
    expect(await images.count(), 'Selected wiki artwork must be present').toBeGreaterThan(0);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(element => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0), {timeout: 30_000}).toBe(true);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot(page, info, 'hub-loaded-artwork');
  });
}
for (const entry of selected.collections) {
  test(`${entry.path} collection controls and route behavior`, async ({page}, info) => {
    await page.goto(entry.path);
    const view = page.locator('[data-game-collection-view]');
    await expect(view).toHaveAttribute('data-game-collection-view', 'cards');
    await usefulFields(page, entry, 'cards');
    await screenshot(page, info, 'cards');
    await page.getByRole('button', {name: 'List', exact: true}).click();
    await expect(view).toHaveAttribute('data-game-collection-view', 'list');
    await expect(collectionBody(page).locator('table').first()).toBeVisible();
    // Collectible list rows use the same stable slug with an explicit row suffix.
    await usefulFields(page, entry, 'list');
    await screenshot(page, info, 'list');
    await page.getByRole('button', {name: 'Cards', exact: true}).click();
    await expect(view).toHaveAttribute('data-game-collection-view', 'cards');
    if (entry.pageType === 'database') {
      await expect(collectionBody(page).locator('input[type=checkbox]')).toHaveCount(0);
      const sections = page.getByRole('combobox', {name: 'Jump to section', exact: true});
      if (await sections.count()) {
        const option = await sections.locator('option').last().getAttribute('value');
        await sections.selectOption(option!);
        await expect.poll(() => new URL(page.url()).hash).not.toBe('');
        const targetId = decodeURIComponent(new URL(page.url()).hash.slice(1));
        await expect(page.locator(`[id=${JSON.stringify(targetId)}]`)).toBeVisible();
        await screenshot(page, info, 'section-navigation');
        await page.goto(entry.path);
      } else info.annotations.push({type: 'not applicable', description: 'Single section: no section navigator.'});
      const finder = page.getByRole('searchbox', {name: 'Find an item in this collection', exact: true});
      if (entry.count >= 100) {
        await expect(finder).toBeVisible();
        const item = entry.items[entry.items.length - 1].item.name;
        await finder.fill(item);
        const match = collectionBody(page).getByRole('link').filter({hasText: item}).first();
        await expect(match).toBeVisible();
        await match.click();
        await expect.poll(() => new URL(page.url()).hash).not.toBe('');
        await screenshot(page, info, 'item-finder');
        await page.goto(entry.path);
      } else info.annotations.push({type: 'not applicable', description: 'Runtime exposes item finding at 100 rows; no database filters below that threshold.'});
      const pageTwo = page.locator(`a[href="${entry.path}/page/2"]`).first();
      if (await pageTwo.count()) {
        await htmlEvidence(page, info, `${entry.path}/page/2`, true);
        await expect(collectionBody(page).locator('input[type=checkbox]')).toHaveCount(0);
        await screenshot(page, info, 'page-two');
      } else {
        const response = await page.request.get(`http://127.0.0.1:3000${entry.path}/page/2`, {maxRedirects: 0, timeout: 30_000});
        expect(response.status()).toBe(404);
        info.annotations.push({type: 'not applicable', description: 'Database fits on one page; page/2 returns 404.'});
      }
      if (entry.imageCount) {
        await page.goto(entry.path);
        const targets = entry.reviewImages.length ? entry.reviewImages : [entry.items[0].item.name];
        await info.attach('targeted-image-inventory.json', {body: JSON.stringify({collection: entry.path, targets}), contentType: 'application/json'});
        for (const [index, name] of targets.entries()) {
          const preview = page.getByRole('button', {name: `Open larger image for ${name}`, exact: true});
          await expect(async () => {
            await preview.scrollIntoViewIfNeeded();
            await expect(preview).toBeVisible();
          }).toPass({timeout: 30_000});
          await expect.poll(() => preview.locator('img').evaluate(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
          // Capture the card background as well as the enlarged image for contrast review.
          await page.screenshot({path: info.outputPath(`image-card-${index}.png`)});
          await preview.click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          await expect.poll(() => dialog.locator('img').evaluate(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
          await page.screenshot({path: info.outputPath(`larger-image-${index}.png`)});
          await page.getByRole('button', {name: 'Close', exact: true}).click();
          await expect(dialog).toHaveCount(0);
        }
      }
      return;
    }
    await expect(visibleBoxes(page)).toHaveCount(entry.count);
    const first = visibleBoxes(page).first();
    await expect(first).toBeEnabled();
    const firstId = await first.getAttribute('id');
    await first.check();
    await expect(first).toBeChecked();
    await page.reload();
    const restored = page.locator(`[id=${JSON.stringify(firstId)}]`);
    await expect(restored).toBeChecked();
    await restored.uncheck();
    await page.reload();
    await expect(page.locator(`[id=${JSON.stringify(firstId)}]`)).not.toBeChecked();
    await visibleBoxes(page).first().check();
    await page.getByRole('combobox', {name: 'Filter by progress'}).selectOption('completed');
    await expect(visibleBoxes(page)).toHaveCount(1);
    await page.getByRole('combobox', {name: 'Filter by progress'}).selectOption('remaining');
    await expect(visibleBoxes(page)).toHaveCount(entry.count - 1);
    await page.getByRole('combobox', {name: 'Filter by progress'}).selectOption('all');
    const sectionFilter = page.getByRole('combobox', {name: 'Filter by section'});
    if (await sectionFilter.count()) {
      const sectionLabel = await sectionFilter.locator('option').nth(1).textContent();
      await sectionFilter.selectOption({label: sectionLabel!});
      const sectionCount = entry.items.filter(row => row.system.section === sectionLabel).length;
      await expect(visibleBoxes(page)).toHaveCount(sectionCount);
      await sectionFilter.selectOption('all');
    }
    const search = page.getByRole('textbox', {name: `Search ${entry.label}`, exact: true});
    await search.fill('qa-no-such-collectible-7cc5');
    await expect(visibleBoxes(page)).toHaveCount(0);
    await expect(page.getByText('No entries match those filters.', {exact: true})).toBeVisible();
    await search.fill(entry.items[0].item.name);
    await expect(visibleBoxes(page).first()).toBeVisible();
    await search.fill('');
    await page.getByRole('button', {name: 'Reset', exact: true}).click();
    await page.reload();
    await expect(collectionBody(page).locator('input[type=checkbox]:checked')).toHaveCount(0);
    await screenshot(page, info, 'collectible-reset');
    const response = await page.request.get(`http://127.0.0.1:3000${entry.path}/page/2`, {maxRedirects: 0, timeout: 30_000});
    expect(response.status()).toBe(404);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://bloxodes.com${entry.path}`);
  });
  if (entry.pageType === 'collectible') test(`${entry.path} isolated account saves and clears progress`, async ({page, context}, info) => {
    const accounts: Account[] = JSON.parse(fs.readFileSync(process.env.SELECTED_FRANCHISE_AUTH!, 'utf8'));
    const account = accounts.find(candidate => candidate.project === info.project.name);
    expect(account).toBeTruthy();
    await context.addCookies([{name: 'app_session', value: account!.token, url: 'http://bloxodes.test:3000', httpOnly: true, sameSite: 'Lax'}]);
    const endpoint = `/api/games/${selected.namespace}/collections/progress`;
    const loaded = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'GET' && response.status() === 200);
    await page.goto(entry.path); await loaded;
    const box = visibleBoxes(page).first();
    // A Playwright retry reuses only this project's own QA account.
    if (await box.isChecked()) {
      const reset = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT' && response.status() === 200);
      await box.uncheck(); await reset;
    }
    const saved = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT' && response.status() === 200);
    await box.check(); await saved;
    await page.evaluate(() => localStorage.clear());
    await page.reload(); await expect(visibleBoxes(page).first()).toBeChecked();
    const cleared = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT' && response.status() === 200);
    await visibleBoxes(page).first().uncheck(); await cleared;
    await page.evaluate(() => localStorage.clear());
    await page.reload(); await expect(visibleBoxes(page).first()).not.toBeChecked();
    await screenshot(page, info, 'account-progress');
  });
}
for (const hub of [...new Set(selected.collections.map(entry => entry.hubPath))]) {
  test(`${hub} collection copy precedes real-image CTAs`, async ({page}, info) => {
    await htmlEvidence(page, info, hub);
    for (const entry of selected.collections.filter(entry => entry.hubPath === hub)) {
      const cta = collectionBody(page).locator(`a[href="${entry.path}"]`);
      await expect(cta).toHaveCount(1);
      const section = cta.locator('..');
      await expect(section.locator('.article-content')).toContainText(/\S/);
      expect(await section.evaluate(element => {
        const copy = element.querySelector('.article-content'), link = element.querySelector(':scope > a');
        return Boolean(copy && link && (copy.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING));
      })).toBe(true);
      if (entry.imageCount) {
        await cta.scrollIntoViewIfNeeded();
        await expect.poll(() => cta.locator('img').evaluateAll(images => images.length > 0 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
      } else await expect(cta.locator('img')).toHaveCount(0);
    }
    await screenshot(page, info, 'hub-collections');
  });
}
for (const quiz of selected.pages.filter(page => page.kind === 'quiz')) {
  for (const accountMode of [false, true]) test(`${quiz.path} ${accountMode ? 'account result' : 'anonymous attempt and reload'}`, async ({page, context}, info) => {
    if (accountMode) {
      const accounts: Account[] = JSON.parse(fs.readFileSync(process.env.SELECTED_FRANCHISE_AUTH!, 'utf8'));
      const account = accounts.find(candidate => candidate.project === info.project.name);
      expect(account).toBeTruthy();
      await context.addCookies([{name: 'app_session', value: account!.token, url: 'http://bloxodes.test:3000', httpOnly: true, sameSite: 'Lax'}]);
    }
    await page.goto(quiz.path);
    const question = page.getByText(/^Question \d+ of \d+$/);
    await expect(question).toBeVisible();
    const progress = (await question.textContent())?.match(/of\s+(\d+)/i);
    expect(progress).toBeTruthy();
    const total = Number(progress![1]);
    expect(total).toBeGreaterThan(0); expect(total).toBeLessThanOrEqual(15);
    const endpoint = `/api/games/${selected.namespace}/quizzes/progress`;
    let savedResult: Promise<import('@playwright/test').Response> | null = null;
    for (let index = 1; index <= total; index++) {
      await expect(question).toHaveText(`Question ${index} of ${total}`);
      await page.getByRole('button', {name: /^[A-D] /}).first().click();
      if (index === total && accountMode) savedResult = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT', {timeout: 30_000});
      await page.getByRole('button', {name: index === total ? 'Finish' : 'Next', exact: true}).click();
      if (!accountMode && index === 1 && total > 1) {
        await expect(question).toHaveText(`Question 2 of ${total}`);
        await page.reload(); await expect(question).toHaveText(`Question 2 of ${total}`);
      }
    }
    await expect(page.getByText('Final Score', {exact: true})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Answer review'})).toBeVisible();
    if (savedResult) expect((await savedResult).status()).toBe(200);
    await screenshot(page, info, 'quiz-result');
    await page.reload();
    await expect(page.getByText('Final Score', {exact: true})).toBeVisible();
    if (accountMode) {
      const result = await page.evaluate(async ({endpoint, code}) => {
        const response = await fetch(`${endpoint}?code=${encodeURIComponent(code)}`);
        return {status: response.status, data: await response.json()};
      }, {endpoint, code: `${selected.namespace}:${quiz.row.slug}`});
      expect(result.status).toBe(200); expect(result.data.lastTotal).toBe(total);
      expect(result.data.seenQuestionIds.length).toBeGreaterThanOrEqual(total);
    }
    await page.getByRole('button', {name: 'Reload Quiz', exact: true}).click();
    await expect(question).toHaveText(`Question 1 of ${total}`);
    await expect(page.getByRole('button', {name: 'Next', exact: true})).toBeDisabled();
    await screenshot(page, info, 'quiz-reload');
  });
}
