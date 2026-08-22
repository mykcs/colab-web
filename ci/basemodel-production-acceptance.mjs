import { webkit } from 'playwright';

const BASE = (process.env.BASEMODEL_URL || 'https://basemodel-preview.vercel.app').replace(/\/$/, '');
const routes = [
  '/',
  '/en/',
  '/families/',
  '/en/families/',
  '/papers/agentbench/',
  '/en/papers/agentbench/',
  '/landscape/',
  '/en/landscape/',
  '/research/seed-openevo/results/',
  '/en/research/seed-openevo/results/',
  '/research/seed-openevo/results/webshop-training/',
  '/en/research/seed-openevo/results/webshop-training/',
  '/guide/openevo-webshop-alfworld/',
  '/en/guide/openevo-webshop-alfworld/',
];
const viewports = [
  { width: 390, height: 844, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1440, height: 1000, name: 'desktop' },
];
const themes = ['light', 'dark'];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function newContext(browser, viewport, theme) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((value) => {
    try { localStorage.setItem('atlas-theme', value); } catch {}
  }, theme);
  return context;
}

async function waitForOwnerHydrated(page, selector) {
  await page.waitForFunction((targetSelector) => {
    const target = document.querySelector(targetSelector);
    const island = target?.closest('astro-island');
    return Boolean(island && !island.hasAttribute('ssr'));
  }, selector, { timeout: 15000 });
}

async function waitForComponentHydrated(page, componentName) {
  await page.waitForFunction((needle) => {
    const island = [...document.querySelectorAll('astro-island')].find((node) =>
      (node.getAttribute('component-url') || '').includes(needle),
    );
    return Boolean(island && !island.hasAttribute('ssr'));
  }, componentName, { timeout: 15000 });
}

async function basicMatrix(browser) {
  let count = 0;
  for (const viewport of viewports) {
    for (const theme of themes) {
      const context = await newContext(browser, viewport, theme);
      const page = await context.newPage();
      for (const route of routes) {
        const response = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        assert(response && response.ok(), `${viewport.name}/${theme} ${route}: HTTP ${response && response.status()}`);
        await page.locator('.site-header').waitFor({ state: 'visible', timeout: 10000 });
        const currentTheme = await page.locator('html').getAttribute('data-theme');
        assert(currentTheme === theme, `${viewport.name}/${route}: expected theme ${theme}, got ${currentTheme}`);
        const overflow = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
          body: document.body.scrollWidth,
        }));
        assert(overflow.scroll <= overflow.client + 1, `${viewport.name}/${theme} ${route}: document overflow ${overflow.scroll}/${overflow.client}`);
        assert(overflow.body <= overflow.client + 1, `${viewport.name}/${theme} ${route}: body overflow ${overflow.body}/${overflow.client}`);
        count += 1;
      }
      await context.close();
    }
  }
  console.log(`BASIC_MATRIX_PASS ${count}`);
}

async function focusedInteractions(browser) {
  const mobile = await newContext(browser, { width: 390, height: 844 }, 'light');
  const page = await mobile.newPage();

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  assert(await page.locator('.global-quick-view').count() === 0, 'home unexpectedly mounts global quick view');
  await page.locator('[data-menu-toggle]').click();
  await page.locator('[data-mobile-menu].is-open').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-mobile-menu]')?.getAttribute('aria-hidden') === 'true');

  await page.goto(`${BASE}/families/`, { waitUntil: 'domcontentloaded' });
  const familyTrigger = page.locator('.tree-quick-view').first();
  await familyTrigger.scrollIntoViewIfNeeded();
  await familyTrigger.waitFor({ state: 'visible' });
  await waitForOwnerHydrated(page, '.tree-quick-view');
  await waitForComponentHydrated(page, 'GlobalModelQuickView');
  await familyTrigger.click();
  await page.locator('.global-quick-view[open]').waitFor({ state: 'visible', timeout: 10000 });
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/papers/agentbench/`, { waitUntil: 'domcontentloaded' });
  const paperTrigger = page.locator('.role-model-quick-view').first();
  await paperTrigger.scrollIntoViewIfNeeded();
  await paperTrigger.waitFor({ state: 'visible', timeout: 10000 });
  await waitForOwnerHydrated(page, '.role-model-quick-view');
  await waitForComponentHydrated(page, 'GlobalModelQuickView');
  await paperTrigger.click();
  await page.locator('.global-quick-view[open]').waitFor({ state: 'visible', timeout: 10000 });
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/landscape/`, { waitUntil: 'domcontentloaded' });
  await page.locator('.landscape-learning-list').waitFor({ state: 'visible' });
  const fullView = page.getByRole('button', { name: '完整视图' });
  await fullView.scrollIntoViewIfNeeded();
  await waitForComponentHydrated(page, 'LandscapePrototype');
  await fullView.click();
  await page.locator('.landscape-view-note').waitFor({ state: 'visible', timeout: 10000 });

  await mobile.close();

  const desktop = await newContext(browser, { width: 1440, height: 1000 }, 'light');
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  const resources = desktopPage.locator('[data-resource-menu]');
  await resources.locator('summary').click();
  assert(await resources.getAttribute('open') !== null, 'resource menu did not open');
  await resources.locator('.resource-menu__links a').first().waitFor({ state: 'visible' });

  const search = desktopPage.locator('.command-search-trigger');
  await waitForOwnerHydrated(desktopPage, '.command-search-trigger');
  await search.click();
  await desktopPage.locator('.command-menu[open]').waitFor({ state: 'visible', timeout: 10000 });
  await desktopPage.keyboard.press('Escape');

  const before = await desktopPage.locator('html').getAttribute('data-theme');
  await desktopPage.locator('[data-theme-toggle]').click();
  const after = await desktopPage.locator('html').getAttribute('data-theme');
  assert(before === 'light' && after === 'dark', `theme switch failed: ${before} -> ${after}`);
  await desktopPage.locator('[data-theme-toggle]').click();
  assert(await desktopPage.locator('html').getAttribute('data-theme') === 'light', 'theme did not switch back to light');

  await desktop.close();
  console.log('FOCUSED_INTERACTIONS_PASS');
}

const browser = await webkit.launch();
try {
  console.log(`TARGET ${BASE}`);
  console.log(`WEBKIT_VERSION ${browser.version()}`);
  await basicMatrix(browser);
  await focusedInteractions(browser);
  console.log('BASEMODEL_PRODUCTION_WEBKIT_PASS');
} finally {
  await browser.close();
}
