// Development-only Playwright check for the mobile map readability fix.
// Verifies the Round 4 styles.css change (no runtime code touched):
//   * SVG keeps a readable minimum width inside the scrolling map canvas
//   * Native horizontal scrolling is available on the map canvas
//   * The page itself never overflows horizontally
//   * Keyboard focus on a selected start still keeps a dark label on pale fill
//   * Switching to Bangla keeps the map scrollable
//
// Mirrors the structure of ../scripts/map-check.mjs (Playwright + Chrome
// headless, environment-driven URL, pageerror collection, JSON + PNG output).
// Runs in a browser with `SMART_ESCAPE_PLAYWRIGHT` already imported. This file
// does not import Playwright itself or add dependencies.
//
// Desktop runs this script. Puku 2 does not execute it.

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLAYWRIGHT_MODULE = process.env.SMART_ESCAPE_PLAYWRIGHT || 'playwright';
const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_MODULE);
const URL_RAW = process.env.SMART_ESCAPE_URL;
if (!URL_RAW) {
  console.error('SMART_ESCAPE_URL is not set; nothing to check.');
  process.exit(2);
}
const TARGET_URL = URL_RAW;

const SHOTS_DIR = resolve(__dirname, '../screenshots');
const RESULTS_PATH = resolve(SHOTS_DIR, 'mobile-results.json');
const FINAL_SHOT = resolve(SHOTS_DIR, 'mobile-final.png');

const VIEWPORT = { width: 390, height: 844 };

const results = {
  url: TARGET_URL,
  viewport: VIEWPORT,
  startedAt: new Date().toISOString(),
  steps: [],
  errors: [],
  pageErrors: [],
  assertions: [],
  pass: false,
};

function record(name, ok, details = {}) {
  const entry = { name, ...details, pass: !!ok };
  results.assertions.push(entry);
  console.log(`${ok ? 'PASS' : 'FAIL'} :: ${name}`, details.ok === false ? details : '');
}

function recordStep(step) {
  results.steps.push(step);
  console.log(`STEP :: ${step}`);
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function getMapMetrics(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('.map-canvas svg');
    const canvas = document.querySelector('.map-canvas');
    if (!svg || !canvas) return null;
    const cs = getComputedStyle(svg);
    return {
      svgMinWidth: svg.clientWidth,
      svgComputedMinWidth: cs.minWidth,
      svgComputedWidth: cs.width,
      svgViewBox: svg.getAttribute('viewBox') || '',
      canvasScrollWidth: canvas.scrollWidth,
      canvasClientWidth: canvas.clientWidth,
      canvasScrollLeft: canvas.scrollLeft,
      bodyScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.documentElement.clientWidth,
      viewportInnerWidth: window.innerWidth,
    };
  });
}

async function scrollMapRight(page, amount = 200) {
  await page.evaluate((px) => {
    const canvas = document.querySelector('.map-canvas');
    if (!canvas) return;
    canvas.scrollLeft = px;
  }, amount);
}

async function getFocusedNode(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return null;
    const g = active.closest && active.closest('.location');
    if (!g) return null;
    const shape = g.querySelector('.node-shape');
    const id = g.querySelector('.node-id');
    const get = (el, prop) => (el ? getComputedStyle(el).getPropertyValue(prop).trim() : '');
    return {
      tabIndex: active.getAttribute('tabindex'),
      dataFocus: g.getAttribute('data-focus') || '',
      isStart: g.classList.contains('is-start'),
      shapeFill: get(shape, 'fill'),
      shapeStroke: get(shape, 'stroke'),
      shapeStrokeWidth: get(shape, 'stroke-width'),
      idFill: get(id, 'fill'),
    };
  });
}

async function readStartSelect(page) {
  return page.evaluate(() => {
    const sel = document.querySelector('.start-select');
    if (!sel) return null;
    const opts = Array.from(sel.options).map((o) => ({ value: o.value, text: o.textContent.trim() }));
    return { value: sel.value, options: opts };
  });
}

async function focusR1ByTab(page) {
  // Reset focus to body, then Tab repeatedly until the focused element's
  // data-focus is map-node:R1. Caps at 60 tabs to avoid runaway loops.
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    document.body.focus && document.body.focus();
  });
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const f = await getFocusedNode(page);
    if (f && /:R1$/.test(f.dataFocus)) {
      // Read the final focus colors after the existing 180ms transition.
      await page.waitForTimeout(250);
      return getFocusedNode(page);
    }
  }
  return null;
}

function rgbStringToTuple(s) {
  // Parses "rgb(20, 43, 40)" or "rgb(255 248 214)" into [r,g,b].
  const m = s.match(/(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function colorNear(actual, expected, tol = 2) {
  const a = rgbStringToTuple(actual);
  const e = rgbStringToTuple(expected);
  if (!a || !e) return false;
  return Math.abs(a[0] - e[0]) <= tol && Math.abs(a[1] - e[1]) <= tol && Math.abs(a[2] - e[2]) <= tol;
}

(async () => {
  let browser;
  try {
    await ensureDir(SHOTS_DIR);
    recordStep('launch chromium headless @ 390x844');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    page.on('pageerror', (err) => {
      const msg = err && err.message ? err.message : String(err);
      results.pageErrors.push(msg);
      console.log('PAGE-ERROR ::', msg);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        results.pageErrors.push(text);
        console.log('CONSOLE-ERROR ::', text);
      }
    });

    recordStep(`goto ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    // Load the sample data set. The exact label matches the wording in the
    // sample button used by the root app.
    const sampleBtn = page.getByRole('button', { name: /load sample/i });
    if (await sampleBtn.count()) {
      recordStep('click "Load sample building"');
      await sampleBtn.first().click();
    } else {
      recordStep('load-sample button not found; continuing');
    }

    // Wait for the map canvas to mount.
    await page.waitForSelector('.map-canvas svg', { timeout: 10_000 });

    // Select R1 in the start-select.
    const selectInfo = await readStartSelect(page);
    record('start-select discovered', !!selectInfo, { optionsCount: selectInfo ? selectInfo.options.length : 0 });
    if (selectInfo) {
      const r1 = selectInfo.options.find((o) => o.value === 'R1' || /R1\b/.test(o.text));
      if (r1) {
        recordStep(`select start = ${r1.value}`);
        await page.selectOption('.start-select', r1.value);
      } else {
        record('select R1', false, { reason: 'no R1 option', options: selectInfo.options });
      }
    }

    // Give the route highlight a frame to paint.
    await page.waitForTimeout(150);

    // Screenshot before scrolling, with R1 selected.
    await page.screenshot({ path: resolve(SHOTS_DIR, 'mobile-initial.png'), fullPage: false });

    // Assertion 1: SVG minimum width >= 560 and the canvas scrolls.
    const m1 = await getMapMetrics(page);
    recordStep('read initial map metrics');
    if (m1) {
      record('svg min-width >= 560', m1.svgMinWidth >= 560, {
        svgMinWidth: m1.svgMinWidth,
        svgComputedMinWidth: m1.svgComputedMinWidth,
        svgComputedWidth: m1.svgComputedWidth,
      });
      record('map.scrollWidth > map.clientWidth', m1.canvasScrollWidth > m1.canvasClientWidth, {
        scrollWidth: m1.canvasScrollWidth,
        clientWidth: m1.canvasClientWidth,
      });
      record('document has no horizontal overflow', m1.bodyScrollWidth <= m1.viewportInnerWidth, {
        bodyScrollWidth: m1.bodyScrollWidth,
        viewportInnerWidth: m1.viewportInnerWidth,
        bodyClientWidth: m1.bodyClientWidth,
      });
    } else {
      record('svg present', false, { reason: 'no .map-canvas svg' });
    }

    // Assertion 2: scrollLeft can become positive (native scroll available).
    await scrollMapRight(page, 200);
    const m2 = await getMapMetrics(page);
    recordStep('scroll map right by 200px');
    if (m2) {
      record('map.scrollLeft can become positive', m2.canvasScrollLeft > 0, {
        scrollLeft: m2.canvasScrollLeft,
      });
      record('document still has no horizontal overflow after scrolling', m2.bodyScrollWidth <= m2.viewportInnerWidth, {
        bodyScrollWidth: m2.bodyScrollWidth,
        viewportInnerWidth: m2.viewportInnerWidth,
      });
    }

    // Reset scroll so the next checks start at the left edge.
    await scrollMapRight(page, 0);

    // Assertion 3: Keyboard focus R1 via Tab. Label must be dark ink on pale fill.
    recordStep('keyboard-focus R1 via Tab');
    const focused = await focusR1ByTab(page);
    if (focused) {
      record('R1 reached by Tab and is selected-start', focused.isStart, { dataFocus: focused.dataFocus });
      record('R1 focused shape fill is pale rgb(255,248,214)', colorNear(focused.shapeFill, 'rgb(255, 248, 214)'), {
        shapeFill: focused.shapeFill,
      });
      record('R1 focused label fill is dark rgb(20,43,40)', colorNear(focused.idFill, 'rgb(20, 43, 40)'), {
        idFill: focused.idFill,
      });
      record('R1 focused label is NOT white', focused.idFill !== 'rgb(255, 255, 255)' && focused.idFill !== '#fff', {
        idFill: focused.idFill,
      });
    } else {
      record('R1 reached by Tab', false, { reason: 'Tab did not land on .location[data-focus$=":R1"]' });
    }

    // Assertion 4: Switch to Bangla. Map must still scroll (R1 label becomes
    // a localized string, but the data-focus identifier is stable).
    recordStep('switch language to Bangla');
    const langBtn = page.getByRole('button', { name: /bangla|বাংলা/i });
    if (await langBtn.count()) {
      await langBtn.first().click();
      await page.waitForTimeout(150);
      const langAfter = await page.evaluate(() => document.documentElement.lang || '');
      record('language switched (Bangla active)', /bn/i.test(langAfter), { lang: langAfter });
    } else {
      record('language switch button present', false, { reason: 'no Bangla toggle found' });
    }

    await page.waitForTimeout(150);
    const m3 = await getMapMetrics(page);
    recordStep('re-check scroll metrics after language switch');
    if (m3) {
      record('after Bangla: svg min-width >= 560', m3.svgMinWidth >= 560, { svgMinWidth: m3.svgMinWidth });
      record('after Bangla: map.scrollWidth > map.clientWidth', m3.canvasScrollWidth > m3.canvasClientWidth, {
        scrollWidth: m3.canvasScrollWidth,
        clientWidth: m3.canvasClientWidth,
      });
      await scrollMapRight(page, 200);
      const m4 = await getMapMetrics(page);
      if (m4) {
        record('after Bangla: map.scrollLeft can become positive', m4.canvasScrollLeft > 0, {
          scrollLeft: m4.canvasScrollLeft,
        });
      }
    }

    // Final screenshot for visual inspection.
    await page.screenshot({ path: FINAL_SHOT, fullPage: false });

    results.pass = results.assertions.every((a) => a.pass) && results.pageErrors.length === 0;
    results.finishedAt = new Date().toISOString();
  } catch (err) {
    results.pass = false;
    results.errors.push((err && err.message) || String(err));
    console.error('FATAL ::', err);
  } finally {
    await mkdir(SHOTS_DIR, { recursive: true }).catch(() => {});
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(RESULTS_PATH, JSON.stringify(results, null, 2)).catch(() => {})
    );
    if (browser) await browser.close().catch(() => {});
  }

  // Print the final verdict without exiting non-zero: Desktop decides what to
  // do with the JSON. Print PASS/FAIL clearly for the runner log.
  console.log(`\nMOBILE-CHECK :: ${results.pass ? 'PASS' : 'FAIL'} :: assertions=${results.assertions.length} pageErrors=${results.pageErrors.length} errors=${results.errors.length}`);
  process.exit(results.pass ? 0 : 1);
})();
