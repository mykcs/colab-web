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

function normalizeSnapshot(value) {
  return JSON.stringify(value);
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

async function removeDesignRefinementHeaderRules(page) {
  return page.evaluate(() => {
    const normalizeMedia = (value = '') => value.replace(/\s+/g, '').toLowerCase();
    const selectorIs = (selector, expected) => selector.replace(/\s+/g, ' ').trim() === expected;
    const hasAllSelectors = (selector, names) => names.every((name) => selector.includes(name));
    const mediaMatches = (media, px) => normalizeMedia(media).includes(`${px}px`);

    const matches = (rule, media) => {
      if (!(rule instanceof CSSStyleRule)) return false;
      const s = rule.selectorText || '';
      const style = rule.style;
      const m = media || '';

      if (!m) {
        if (selectorIs(s, '.nav-inner') && style.minHeight === '66px' && style.gap === '14px') return true;
        if (hasAllSelectors(s, ['.command-search-trigger', '.lang-switch', '.theme-toggle', '.menu-toggle']) && style.flex) return true;
        if (selectorIs(s, '.desktop-nav a') && style.whiteSpace === 'nowrap') return true;
      }

      if (mediaMatches(m, 1080)) {
        if (selectorIs(s, '.nav-inner') && style.gap === '10px') return true;
        if (selectorIs(s, '.brand small') && style.display === 'none') return true;
        if (hasAllSelectors(s, ['.nav-primary', '.nav-secondary']) && style.gap === '11px') return true;
        if (selectorIs(s, '.nav-secondary') && style.paddingLeft === '11px') return true;
      }

      if (mediaMatches(m, 960)) {
        if (hasAllSelectors(s, ['.desktop-nav', '.nav-inner > .lang-switch']) && style.display === 'none') return true;
        if (selectorIs(s, '.menu-toggle') && style.display === 'flex') return true;
        if (selectorIs(s, '.mobile-menu.is-open') && style.display === 'block') return true;
      }

      if (mediaMatches(m, 520)) {
        if (selectorIs(s, '.nav-inner') && style.minHeight === '60px') return true;
        if (selectorIs(s, '.brand span:last-child') && style.display === 'none') return true;
        if (selectorIs(s, '.command-search-trigger') && style.maxWidth === '104px' && style.overflow === 'hidden') return true;
        if (selectorIs(s, '.command-search-trigger kbd') && style.display === 'none') return true;
      }

      return false;
    };

    let removed = 0;
    const walk = (rules, media = '') => {
      for (let index = rules.length - 1; index >= 0; index -= 1) {
        const rule = rules[index];
        if (rule instanceof CSSMediaRule) {
          walk(rule.cssRules, rule.conditionText || media);
          continue;
        }
        if (matches(rule, media)) {
          rules.deleteRule(index);
          removed += 1;
        }
      }
    };

    for (const sheet of [...document.styleSheets]) {
      try { walk(sheet.cssRules); } catch {}
    }
    return removed;
  });
}

async function runBrowser(browserType, name) {
  const browser = await browserType.launch();
  try {
    let cases = 0;
    for (const viewport of viewports) {
      for (const theme of themes) {
        const context = await browser.newContext({ viewport });
        await setTheme(context, theme);
        const page = await context.newPage();
        for (const route of routes) {
          const response = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
          if (!response?.ok()) throw new Error(`${name}/${viewport.name}/${theme}/${route} HTTP ${response?.status()}`);
          await page.locator('.site-header').waitFor({ state: 'visible' });

          if (viewport.width <= 1080) {
            await page.locator('[data-menu-toggle]').click();
            await page.locator('[data-mobile-menu].is-open').waitFor({ state: 'visible' });
          }

          const before = await snapshot(page);
          const removed = await removeDesignRefinementHeaderRules(page);
          if (removed !== 14) throw new Error(`${name}/${route}: expected 14 design-refinement Header rules, removed ${removed}`);
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const after = await snapshot(page);

          if (normalizeSnapshot(before) !== normalizeSnapshot(after)) {
            console.error('BEFORE', JSON.stringify(before, null, 2));
            console.error('AFTER', JSON.stringify(after, null, 2));
            throw new Error(`${name}/${viewport.name}/${theme}/${route}: computed Header snapshot changed after legacy-rule removal`);
          }
          if (after.document.scrollWidth > after.document.clientWidth + 1 || after.document.bodyScrollWidth > after.document.clientWidth + 1) {
            throw new Error(`${name}/${viewport.name}/${theme}/${route}: horizontal overflow after removal`);
          }

          if (viewport.width <= 1080) {
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => document.querySelector('[data-mobile-menu]')?.getAttribute('aria-hidden') === 'true');
          }
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
