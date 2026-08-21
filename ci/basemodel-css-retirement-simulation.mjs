import postcss from 'postcss';
import { chromium, webkit } from 'playwright';

const BASE = 'https://basemodel-preview.vercel.app';
const routes = ['/', '/research/seed-openevo/results/', '/guide/openevo-webshop-alfworld/'];
const viewports = [
  { width: 390, height: 844, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1440, height: 1000, name: 'desktop' },
];
const themes = ['light', 'dark'];
const properties = [
  'display', 'position', 'minHeight', 'height', 'width', 'maxWidth', 'gap', 'flex',
  'whiteSpace', 'overflow', 'overflowX', 'paddingLeft', 'backgroundColor', 'color', 'zIndex',
];
const selectors = [
  '.site-header', '.nav-inner', '.brand', '.brand small', '.brand span:last-child',
  '.desktop-nav', '.desktop-nav a', '.command-search-trigger', '.command-search-trigger kbd',
  '.lang-switch', '.theme-toggle', '.menu-toggle', '.mobile-menu',
];

const normalizeSelector = (value = '') => value.replace(/\s+/g, '');
const selectorIs = (selector, expected) => normalizeSelector(selector) === normalizeSelector(expected);
const hasAllSelectors = (selector, names) => {
  const normalized = normalizeSelector(selector);
  return names.every((name) => normalized.includes(normalizeSelector(name)));
};
const mediaMatches = (media, px) => (media || '').replace(/\s+/g, '').toLowerCase().includes(`${px}px`);

function nearestMedia(rule) {
  let parent = rule.parent;
  while (parent) {
    if (parent.type === 'atrule' && parent.name === 'media') return parent.params || '';
    parent = parent.parent;
  }
  return '';
}

function declarations(rule) {
  const out = new Map();
  for (const node of rule.nodes || []) {
    if (node.type === 'decl') out.set(node.prop, node.value);
  }
  return out;
}

function isTargetDesignRefinementHeaderRule(rule) {
  const selector = rule.selector || '';
  const media = nearestMedia(rule);
  const d = declarations(rule);

  if (!media) {
    if (selectorIs(selector, '.nav-inner') && d.get('min-height') === '66px' && d.get('gap') === '14px') return true;
    if (hasAllSelectors(selector, ['.command-search-trigger', '.lang-switch', '.theme-toggle', '.menu-toggle']) && d.has('flex')) return true;
    if (selectorIs(selector, '.desktop-nav a') && d.get('white-space') === 'nowrap') return true;
  }

  if (mediaMatches(media, 1080)) {
    if (selectorIs(selector, '.nav-inner') && d.get('gap') === '10px') return true;
    if (selectorIs(selector, '.brand small') && d.get('display') === 'none') return true;
    if (hasAllSelectors(selector, ['.nav-primary', '.nav-secondary']) && d.get('gap') === '11px') return true;
    if (selectorIs(selector, '.nav-secondary') && d.get('padding-left') === '11px') return true;
  }

  if (mediaMatches(media, 960)) {
    if (hasAllSelectors(selector, ['.desktop-nav', '.nav-inner > .lang-switch']) && d.get('display') === 'none') return true;
    if (selectorIs(selector, '.menu-toggle') && d.get('display') === 'flex') return true;
    if (selectorIs(selector, '.mobile-menu.is-open') && d.get('display') === 'block') return true;
  }

  if (mediaMatches(media, 520)) {
    if (selectorIs(selector, '.nav-inner') && d.get('min-height') === '60px') return true;
    if (selectorIs(selector, '.brand span:last-child') && d.get('display') === 'none') return true;
    if (selectorIs(selector, '.command-search-trigger') && d.get('max-width') === '104px' && d.get('overflow') === 'hidden') return true;
    if (selectorIs(selector, '.command-search-trigger kbd') && d.get('display') === 'none') return true;
  }

  return false;
}

function retireDesignRefinementHeaderRules(css) {
  const root = postcss.parse(css);
  const removed = [];
  root.walkRules((rule) => {
    if (!isTargetDesignRefinementHeaderRule(rule)) return;
    removed.push({ selector: rule.selector, media: nearestMedia(rule), css: rule.toString() });
    rule.remove();
  });
  return { css: root.toString(), removed };
}

async function setTheme(context, theme) {
  await context.addInitScript((value) => {
    try { localStorage.setItem('atlas-theme', value); } catch {}
  }, theme);
}

async function snapshot(page) {
  return page.evaluate(({ selectors, properties }) => {
    const result = {};
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) {
        result[selector] = null;
        continue;
      }
      const style = getComputedStyle(element);
      const values = {};
      for (const property of properties) values[property] = style[property];
      const rect = element.getBoundingClientRect();
      values.rect = {
        x: Math.round(rect.x * 10) / 10,
        y: Math.round(rect.y * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
      };
      result[selector] = values;
    }
    result.document = {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
    return result;
  }, { selectors, properties });
}

async function preparePage(page, viewportWidth) {
  await page.locator('.site-header').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts?.ready);
  if (viewportWidth <= 1080) {
    await page.locator('[data-menu-toggle]').click();
    await page.locator('[data-mobile-menu].is-open').waitFor({ state: 'visible' });
  }
}

async function closeMobileMenu(page, viewportWidth) {
  if (viewportWidth > 1080) return;
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-mobile-menu]')?.getAttribute('aria-hidden') === 'true');
}

async function runBrowser(browserType, name) {
  const browser = await browserType.launch();
  try {
    let cases = 0;
    for (const viewport of viewports) {
      for (const theme of themes) {
        const context = await browser.newContext({ viewport });
        await setTheme(context, theme);

        for (const route of routes) {
          const baseline = await context.newPage();
          const candidate = await context.newPage();
          let interceptionCount = 0;
          let removedRules = null;

          await candidate.route('**/_astro/AppLayout.*.css', async (intercepted) => {
            const response = await intercepted.fetch();
            const css = await response.text();
            const retired = retireDesignRefinementHeaderRules(css);
            removedRules = retired.removed;
            interceptionCount += 1;
            await intercepted.fulfill({ response, body: retired.css, contentType: 'text/css; charset=utf-8' });
          });

          const [baselineResponse, candidateResponse] = await Promise.all([
            baseline.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 }),
            candidate.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 }),
          ]);
          if (!baselineResponse?.ok() || !candidateResponse?.ok()) {
            throw new Error(`${name}/${viewport.name}/${theme}/${route}: HTTP baseline=${baselineResponse?.status()} candidate=${candidateResponse?.status()}`);
          }
          if (interceptionCount !== 1) throw new Error(`${name}/${route}: expected one AppLayout CSS interception, got ${interceptionCount}`);
          if (!removedRules || removedRules.length !== 14) {
            console.error('REMOVED_RULES', JSON.stringify(removedRules, null, 2));
            throw new Error(`${name}/${route}: expected 14 design-refinement Header rules, removed ${removedRules?.length ?? 0}`);
          }

          await Promise.all([
            preparePage(baseline, viewport.width),
            preparePage(candidate, viewport.width),
          ]);

          const [before, after] = await Promise.all([snapshot(baseline), snapshot(candidate)]);
          if (JSON.stringify(before) !== JSON.stringify(after)) {
            console.error('BASELINE', JSON.stringify(before, null, 2));
            console.error('CANDIDATE', JSON.stringify(after, null, 2));
            throw new Error(`${name}/${viewport.name}/${theme}/${route}: computed Header snapshot changed after legacy-rule removal`);
          }
          if (after.document.scrollWidth > after.document.clientWidth + 1 || after.document.bodyScrollWidth > after.document.clientWidth + 1) {
            throw new Error(`${name}/${viewport.name}/${theme}/${route}: horizontal overflow after removal`);
          }

          await Promise.all([
            closeMobileMenu(baseline, viewport.width),
            closeMobileMenu(candidate, viewport.width),
          ]);
          await baseline.close();
          await candidate.close();
          cases += 1;
        }
        await context.close();
      }
    }
    console.log(`${name.toUpperCase()}_CSS_RETIREMENT_EQUIVALENCE_PASS ${cases}`);
  } finally {
    await browser.close();
  }
}

await runBrowser(chromium, 'chromium');
await runBrowser(webkit, 'webkit');
console.log('BASEMODEL_DESIGN_REFINEMENT_HEADER_RETIREMENT_SIMULATION_PASS');
