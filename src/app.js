import { validateBuilding, createState, findRoute } from '../puku1/engine.js';
import { renderMap } from '../puku2/map.js';
import { translator } from './i18n.js';
import { downloadMapPng } from './export.js';
import { saveSession, loadSession, clearSession } from '../puku1/session.js';

let language = 'en', building = null, state = null, startId = '', mode = 'select', errorCode = '', notice = '', importVersion = 0;
let route = { status: 'select_start' };
let exporting = false;
const app = document.querySelector('#app');
const icon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 17V7h7v10M11 12h9m-4-4 4 4-4 4M4 17H2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(text, action, className = 'button', disabled = false, focusId = '') {
  const b = make('button', className, text); b.type = 'button'; b.disabled = disabled;
  if (focusId) b.dataset.focus = focusId;
  b.addEventListener('click', action); return b;
}
function toggle(key, id) {
  const set = new Set(state[key]); set.has(id) ? set.delete(id) : set.add(id); state[key] = [...set]; notice = ''; update();
}
function onNode(id) {
  const node = building.nodes.find(n => n.id === id);
  if (node.type === 'exit') toggle('closed_exits', id);
  else if (mode === 'hazard') toggle('blocked_nodes', id);
  else if (!state.blocked_nodes.includes(id)) { startId = id; notice = ''; update(); }
}
function accept(value) {
  const validated = validateBuilding(value);
  building = validated; state = createState(building); startId = ''; mode = 'select'; errorCode = ''; notice = 'imported'; update();
}
function update() {
  route = building ? findRoute(building, state, startId) : { status: 'select_start' };
  render();
}
async function loadSample() {
  const version = ++importVersion;
  try {
    const response = await fetch(new URL('../data/building.json', import.meta.url));
    if (!response.ok) throw new Error('sampleError');
    const value = await response.json();
    if (version === importVersion) accept(value);
  } catch { if (version === importVersion) { errorCode = 'sampleError'; render(); } }
}
function importFile() {
  const input = make('input'); input.type = 'file'; input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    const version = ++importVersion;
    if (file.size > 2 * 1024 * 1024) { errorCode = 'size'; render(); return; }
    let text;
    try { text = await file.text(); } catch { if (version === importVersion) { errorCode = 'file'; render(); } return; }
    if (version !== importVersion) return;
    let value;
    try { value = JSON.parse(text); } catch { errorCode = 'json'; render(); return; }
    try { accept(value); } catch (error) {
      errorCode = { building: 'buildingError', nodes: 'nodesError', edges: 'edgesError' }[error.code] || error.code || 'object'; render();
    }
  }); input.click();
}
async function exportMap() {
  if (exporting) return;
  const svg = app.querySelector('.map-canvas svg');
  exporting = true;
  const control = app.querySelector('[data-focus="export-map"]');
  if (control) { control.textContent = translator(language)('exporting'); control.setAttribute('aria-busy', 'true'); }
  try { await downloadMapPng(svg); if (errorCode === 'exportError') errorCode = ''; notice = 'exportDone'; }
  catch { errorCode = 'exportError'; notice = ''; }
  finally { exporting = false; render(); }
}
function sessionAction(action) {
  try {
    if (action === 'save') {
      saveSession({ building, state, startId, language, mode }); notice = 'sessionSaved';
    } else if (action === 'restore') {
      const saved = loadSession();
      if (!saved) { notice = 'sessionAbsent'; errorCode = ''; render(); return; }
      // The storage module validates the entire snapshot before current state changes.
      ++importVersion;
      ({ building, state, language, mode } = saved); startId = saved.startId || '';
      notice = 'sessionRestored';
    } else { clearSession(); notice = 'sessionCleared'; }
    errorCode = ''; update();
  } catch { errorCode = 'sessionError'; notice = ''; render(); }
}
function render() {
  // Restore keyboard focus after state changes, using stable element identities.
  const focusId = document.activeElement?.dataset?.focus;
  const activeSvg = document.activeElement?.closest?.('svg') ? document.activeElement.getAttribute('aria-label') : null;
  const oldDetails = [...app.querySelectorAll('details')].map(d => d.open);
  const oldMap = app.querySelector('.map-canvas');
  const mapScroll = { left: oldMap?.scrollLeft || 0, top: oldMap?.scrollTop || 0 };
  const t = translator(language); document.documentElement.lang = language;
  document.title = `${t('brand')} — ${t('tagline')}`;
  app.replaceChildren();
  const header = make('header', 'site-header');
  const brand = make('div', 'brand');
  const mark = make('span', 'brand-mark'); mark.innerHTML = icon;
  const brandText = make('div'); brandText.append(make('strong', '', t('brand')), make('span', 'brand-subtitle', t('tagline'))); brand.append(mark, brandText);
  const actions = make('div', 'header-actions');
  const lang = button(t('language'), () => { language = language === 'en' ? 'bn' : 'en'; render(); }, 'button language-button'); lang.dataset.focus = 'language'; lang.setAttribute('aria-label', language === 'en' ? 'Switch to Bangla' : 'ইংরেজিতে পরিবর্তন করুন');
  actions.append(lang, button(t('import'), importFile, 'button button-dark', false, 'import-header')); header.append(brand, actions); app.append(header);
  const main = make('main', 'workspace');
  const intro = make('div', 'intro'); intro.append(make('p', 'eyebrow', t('eyebrow')), make('h1', '', t('title')), make('p', 'subtitle', t('subtitle'))); main.append(intro);
  if (errorCode) {
    const error = make('div', 'error-banner'); error.setAttribute('role', 'alert');
    error.append(make('strong', '', t(errorCode === 'exportError' ? 'exportErrorHeading' : errorCode === 'sessionError' ? 'sessionErrorHeading' : 'errorHeading')), make('span', '', t(errorCode)), button('×', () => { errorCode = ''; render(); }, 'dismiss', false, 'dismiss-error'));
    error.lastChild.setAttribute('aria-label', t('dismiss')); main.append(error);
  }
  if (!building) {
    const empty = make('section', 'empty-state'); const illustration = make('div', 'empty-icon'); illustration.innerHTML = icon;
    const choices = make('div', 'empty-actions'); choices.append(button(t('import'), importFile, 'button button-dark', false, 'import-empty'), button(t('sample'), loadSample));
    empty.append(illustration, make('h2', '', t('emptyTitle')), make('p', '', t('emptyText')), choices, make('small', '', t('local'))); main.append(empty);
  } else {
    const buildingBar = make('div', 'building-bar'), name = make('div'); name.append(make('p', 'eyebrow', t('building')), make('h2', '', building.building));
    const counts = make('div', 'building-stats');
    for (const [value, key] of [[building.nodes.length, 'locations'], [building.edges.length, 'corridors'], [building.nodes.filter(n => n.type === 'exit' && !state.closed_exits.includes(n.id)).length, 'openExits']]) {
      const stat = make('div'); stat.append(make('strong', '', value), make('span', '', t(key))); counts.append(stat);
    }
    const reset = button(t('reset'), () => { state = createState(building); notice = 'resetDone'; errorCode = ''; update(); }, 'button reset-button'); reset.dataset.focus = 'reset';
    const exportButton = button(t(exporting ? 'exporting' : 'exportPng'), exportMap, 'button', false, 'export-map');
    exportButton.setAttribute('aria-busy', exporting);
    buildingBar.append(name, counts, reset, exportButton); main.append(buildingBar);
    const grid = make('div', 'workspace-grid'), mapPanel = make('section', 'map-panel');
    const toolbar = make('div', 'map-toolbar'), tabs = make('div', 'mode-tabs');
    for (const [value, label] of [['select', 'selectMode'], ['hazard', 'hazardMode']]) {
      const tab = button(t(label), () => { mode = value; render(); }, `mode-tab ${mode === value ? 'active' : ''}`); tab.dataset.focus = value; tab.setAttribute('aria-pressed', mode === value); tabs.append(tab);
    }
    toolbar.append(tabs, make('span', 'local-note', t('local'))); mapPanel.append(toolbar);
    const map = make('div', 'map-canvas');
    renderMap(map, { building, state, startId, route, mode, t, onNode, onEdge: id => toggle('blocked_edges', id) }); mapPanel.append(map);
    const legend = make('div', 'map-legend');
    for (const key of ['room', 'junction', 'exit', 'route', 'blocked']) { const item = make('span'); item.append(make('i', `legend-dot ${key}`), document.createTextNode(t(key))); legend.append(item); }
    mapPanel.append(legend, make('p', 'map-hint', t(mode === 'select' ? 'selectHint' : 'hazardHint'))); grid.append(mapPanel);
    const sidebar = make('aside', 'route-panel'); sidebar.append(make('p', 'eyebrow', t('routeHeading')));
    const startLabel = make('label', 'field-label', t('start')); startLabel.htmlFor = 'start-select';
    const select = make('select', 'start-select'); select.id = 'start-select'; select.dataset.focus = 'start-select';
    const placeholder = make('option', '', t('emptyStart')); placeholder.value = ''; select.append(placeholder);
    for (const n of building.nodes.filter(n => n.type !== 'exit')) {
      const opt = make('option', '', `${n.label} (${n.id})${state.blocked_nodes.includes(n.id) ? ` — ${t('blocked')}` : ''}`);
      opt.value = n.id; opt.disabled = state.blocked_nodes.includes(n.id); select.append(opt);
    }
    select.value = startId; select.addEventListener('change', () => { startId = select.value; notice = ''; update(); }); sidebar.append(startLabel, select);
    const result = make('div', `route-result ${route.status}`); result.setAttribute('role', 'status'); result.setAttribute('aria-live', 'polite');
    result.append(make('span', 'status-pill', t(route.status === 'ok' ? 'ready' : route.status)));
    if (route.status === 'ok') {
      const cost = make('div', 'route-cost'); cost.append(make('strong', '', route.cost), make('span', '', t('totalCost'))); result.append(cost);
      const exit = building.nodes.find(n => n.id === route.exitId);
      result.append(make('p', 'destination-label', t('destination')), make('h3', 'destination-name', exit.label), make('p', 'route-steps', `${route.edgeIds.length} ${t('steps')}`));
      const sequence = make('ol', 'route-sequence'); sequence.setAttribute('aria-label', t('sequence'));
      for (const id of route.nodeIds) { const node = building.nodes.find(n => n.id === id), step = make('li'); step.append(make('span', 'sequence-id', id), make('span', '', node.label)); sequence.append(step); }
      result.append(sequence);
    } else result.append(make('p', 'status-description', t(route.status === 'start_blocked' ? 'blockedDescription' : route.status === 'no_route' ? 'noRouteDescription' : 'selectDescription')));
    sidebar.append(result, make('p', 'routing-note', t('explain'))); grid.append(sidebar); main.append(grid);
    const conditions = make('section', 'conditions'); const conditionsHeader = make('div', 'conditions-header'); conditionsHeader.append(make('h2', '', t('conditions')), make('p', '', t('conditionsHint'))); conditions.append(conditionsHeader);
    const conditionGrid = make('div', 'conditions-grid');
    for (const [index, key, category] of [[0, 'blocked_nodes', 'nodes'], [1, 'blocked_edges', 'edges'], [2, 'closed_exits', 'exits']]) {
      const details = make('details', 'condition-group'); details.open = oldDetails[index] ?? true;
      const summary = make('summary', '', t(category)); details.append(summary);
      const items = category === 'edges' ? building.edges : building.nodes.filter(n => category === 'exits' ? n.type === 'exit' : n.type !== 'exit');
      for (const item of items) {
        const row = make('div', 'condition-row'); const desc = make('div');
        desc.append(make('strong', '', item.id), make('span', '', category === 'edges' ? `${item.from} ↔ ${item.to} · ${t('cost')} ${item.cost}` : item.label));
        const unavailable = state[key].includes(item.id), action = category === 'exits' ? unavailable ? 'reopen' : 'close' : unavailable ? 'unblock' : 'block';
        const control = button(t(action), () => toggle(key, item.id), `condition-button ${unavailable ? 'is-blocked' : ''}`); control.dataset.focus = `${key}-${item.id}`; control.setAttribute('aria-pressed', unavailable); control.setAttribute('aria-label', `${t(action)}: ${item.label || item.id}`);
        row.append(desc, control); details.append(row);
      }
      conditionGrid.append(details);
    }
    conditions.append(conditionGrid); main.append(conditions);
  }
  const sessionControls = make('div', 'header-actions');
  sessionControls.style.flexWrap = 'wrap'; sessionControls.style.margin = '18px 0';
  sessionControls.append(button(t('saveProgress'), () => sessionAction('save'), 'button', !building, 'save-session'), button(t('restoreProgress'), () => sessionAction('restore'), 'button', false, 'restore-session'), button(t('clearProgress'), () => sessionAction('clear'), 'button', false, 'clear-session'));
  main.append(sessionControls, make('p', 'routing-note', t('sessionLocal')));
  if (notice.startsWith('session')) { const feedback = make('p', 'status-description', t(notice)); feedback.setAttribute('role', 'status'); main.append(feedback); }
  const noticeArea = make('div', 'sr-only', notice ? t(notice) : ''); noticeArea.setAttribute('role', 'status'); main.append(noticeArea);
  app.append(main); const footer = make('footer', 'footer'); footer.append(make('span', '', t('simulation')), make('span', 'footer-name', t('practiceFooter'))); app.append(footer);
  if (focusId) {
    const controls = [...app.querySelectorAll('[data-focus]')];
    // These controls disappear after a successful import or error dismissal.
    const target = controls.find(el => el.dataset.focus === focusId)
      ?? (['import-empty', 'dismiss-error'].includes(focusId) ? controls.find(el => el.dataset.focus === 'import-header') : null);
    target?.focus({ preventScroll: true });
  }
  else if (activeSvg) [...app.querySelectorAll('svg [role="button"]')].find(el => el.getAttribute('aria-label') === activeSvg)?.focus({ preventScroll: true });
  const nextMap = app.querySelector('.map-canvas');
  if (nextMap) { nextMap.scrollLeft = mapScroll.left; nextMap.scrollTop = mapScroll.top; }
}
render();
