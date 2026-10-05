// Focused regression verification for Puku 2's map changes, not runtime application code.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SMART_ESCAPE_PLAYWRIGHT || 'playwright');
const url = process.env.SMART_ESCAPE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const pass = label => { checks.push(label); console.log(`PASS ${label}`); };
const focusToken = () => page.evaluate(() => document.activeElement?.dataset?.focus);
try {
  await page.goto(url); await page.getByRole('button', { name: 'Load sample', exact: true }).click();
  await page.locator('#start-select').selectOption('R1');
  await page.getByRole('button', { name: 'Edit hazards', exact: true }).click();
  const node = page.locator('[data-focus="map-node:C2"]');
  assert.equal(await node.count(), 1, 'Node needs a stable focus identifier');
  await node.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.route-cost strong').innerText(), '11'); assert.equal(await focusToken(), 'map-node:C2');
  await page.keyboard.press('Space');
  assert.equal(await page.locator('.route-cost strong').innerText(), '7'); assert.equal(await focusToken(), 'map-node:C2');
  pass('map node Enter/Space toggles retain focus and reroute');
  const edge = page.locator('[data-focus="map-edge:L03"]');
  await edge.focus(); await page.keyboard.press('Enter'); assert.equal(await focusToken(), 'map-edge:L03');
  assert.equal(await page.locator('.route-cost strong').innerText(), '10');
  await page.keyboard.press('Space'); assert.equal(await focusToken(), 'map-edge:L03');
  assert.equal(await page.locator('.route-cost strong').innerText(), '7'); pass('map corridor toggles retain focus and correct costs');
  await page.locator('[data-focus="map-node:E1"]').focus(); await page.keyboard.press('Enter');
  assert.equal(await focusToken(), 'map-node:E1'); assert.equal(await page.locator('.destination-name').innerText(), 'South Exit');
  await page.keyboard.press('Space'); assert.equal(await focusToken(), 'map-node:E1');
  assert.equal(await page.locator('.destination-name').innerText(), 'North Exit'); pass('map exit toggles retain focus and restore destination');
  await page.screenshot({ path: 'screenshots/map-keyboard-focus.png', fullPage: true });
  assert.equal(await page.locator('.cost-label').count(), 9);
  assert.equal(await page.locator('.cost-label').evaluateAll(els => els.every(el => {
    const css = getComputedStyle(el); return css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) > 0;
  })), true); pass('all corridor costs remain visible');
  const temp = await mkdtemp(join(tmpdir(), 'smart-escape-extreme-'));
  const extreme = { building: 'Finite extreme coordinates', nodes: [
    { id: 'R', label: 'Room', type: 'room', x: -Number.MAX_VALUE, y: -Number.MAX_VALUE },
    { id: 'E', label: 'Exit', type: 'exit', x: Number.MAX_VALUE, y: Number.MAX_VALUE }
  ], edges: [{ id: 'L', from: 'R', to: 'E', cost: 1 }], initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] } };
  const file = join(temp, 'extreme.json'); await writeFile(file, JSON.stringify(extreme));
  const pending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import building', exact: true }).first().click();
  await (await pending).setFiles(file);
  await page.waitForFunction(() => document.querySelector('.building-bar h2')?.textContent === 'Finite extreme coordinates');
  await page.locator('#start-select').selectOption('R');
  assert.equal(await page.locator('.route-cost strong').innerText(), '1');
  const badAttributes = await page.locator('.map-canvas svg').evaluate(svg => [...svg.querySelectorAll('*'), svg].flatMap(el => [...el.attributes]).filter(a => /NaN|Infinity/.test(a.value)).map(a => a.name));
  assert.deepEqual(badAttributes, []); pass('finite extreme coordinates produce a finite map and correct route');
  assert.deepEqual(errors, []); pass('map changes introduce no uncaught browser exceptions');
  await writeFile('screenshots/map-results.json', JSON.stringify({ url, checks, count: checks.length, errors }, null, 2));
  console.log(`Map checks passed: ${checks.length}`);
} finally { await browser.close(); }
