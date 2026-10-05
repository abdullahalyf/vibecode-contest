// Puku 1 — tests for session.js. localStorage is mocked via globalThis.
import test from 'node:test';
import assert from 'node:assert/strict';

function smallBuilding() {
  return {
    building: 'Test graph',
    nodes: [
      { id: 'R1', label: 'Room 1', type: 'room', x: 0, y: 0 },
      { id: 'R2', label: 'Room 2', type: 'room', x: 10, y: 0 },
      { id: 'J1', label: 'Junction 1', type: 'junction', x: 5, y: 0 },
      { id: 'J2', label: 'Junction 2', type: 'junction', x: 5, y: 5 },
      { id: 'E1', label: 'Exit 1', type: 'exit', x: 20, y: 0 },
      { id: 'E2', label: 'Exit 2', type: 'exit', x: 20, y: 5 },
    ],
    edges: [
      { id: 'L01', from: 'R1', to: 'J1', cost: 1 },
      { id: 'L02', from: 'J1', to: 'J2', cost: 1 },
      { id: 'L03', from: 'J2', to: 'R2', cost: 1 },
      { id: 'L04', from: 'J1', to: 'E1', cost: 1 },
      { id: 'L05', from: 'J2', to: 'E2', cost: 1 },
    ],
    initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] },
  };
}

function freshSnapshot(overrides = {}) {
  const building = overrides.building !== undefined ? overrides.building : smallBuilding();
  const state = overrides.state !== undefined ? overrides.state : { blocked_nodes: [], blocked_edges: [], closed_exits: [] };
  return {
    building,
    state,
    startId: overrides.startId !== undefined ? overrides.startId : 'R1',
    language: overrides.language !== undefined ? overrides.language : 'en',
    mode: overrides.mode !== undefined ? overrides.mode : 'select',
  };
}

class MemoryStorage {
  constructor(initial = {}) { this.map = new Map(Object.entries(initial)); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

let throwOnSet = null;
let throwOnGet = null;

class FlakyStorage extends MemoryStorage {
  setItem(k, v) { if (throwOnSet) throw throwOnSet; super.setItem(k, v); }
  getItem(k) { if (throwOnGet) throw throwOnGet; return super.getItem(k); }
}

function installStorage(initial) {
  const store = new FlakyStorage(initial);
  globalThis.localStorage = store;
  return store;
}

function uninstallStorage() {
  delete globalThis.localStorage;
}

async function loadSessionModule() {
  return await import('./session.js?t=' + Math.random().toString(36).slice(2));
}

test('save then load round-trips a valid snapshot; building initial_state is preserved and reset semantics hold', async () => {
  installStorage();
  const { saveSession, loadSession, clearSession, SESSION_ERROR_CODE } = await loadSessionModule();
  const building = smallBuilding();
  building.initial_state = { blocked_nodes: ['R2'], blocked_edges: ['L02'], closed_exits: ['E2'] };

  saveSession({
    building,
    state: { blocked_nodes: ['J1'], blocked_edges: ['L01'], closed_exits: ['E1'] },
    startId: 'R1',
    language: 'en',
    mode: 'hazard',
  });

  const loaded = loadSession();
  assert.ok(loaded, 'loadSession should return a snapshot');
  assert.equal(loaded.version, 1);
  assert.equal(loaded.startId, 'R1');
  assert.equal(loaded.language, 'en');
  assert.equal(loaded.mode, 'hazard');
  assert.deepEqual(loaded.state.blocked_nodes, ['J1']);
  assert.deepEqual(loaded.state.blocked_edges, ['L01']);
  assert.deepEqual(loaded.state.closed_exits, ['E1']);
  // The original initial_state is preserved on the returned building so
  // Reset still means "back to the imported hazards".
  assert.deepEqual(loaded.building.initial_state, { blocked_nodes: ['R2'], blocked_edges: ['L02'], closed_exits: ['E2'] });
  // The returned state must not be aliased to building.initial_state.
  assert.notEqual(loaded.state.blocked_nodes, loaded.building.initial_state.blocked_nodes);
  assert.notEqual(loaded.state.closed_exits, loaded.building.initial_state.closed_exits);
  assert.notEqual(loaded.state.blocked_edges, loaded.building.initial_state.blocked_edges);

  // After mutating the returned state, the building's initial_state
  // (and a fresh createState-like copy) is unchanged — reset semantics.
  loaded.state.blocked_nodes.push('GHOST');
  loaded.state.blocked_edges.length = 0;
  loaded.state.closed_exits.length = 0;
  assert.deepEqual(loaded.building.initial_state, { blocked_nodes: ['R2'], blocked_edges: ['L02'], closed_exits: ['E2'] });

  clearSession();
  uninstallStorage();
  assert.equal(SESSION_ERROR_CODE, 'sessionError');
});

test('loadSession returns null when no saved item is present (not an error)', async () => {
  installStorage();
  const { loadSession } = await loadSessionModule();
  const result = loadSession();
  assert.equal(result, null);
  uninstallStorage();
});

test('save rejects a snapshot whose current hazards reference IDs that do not exist or are wrong category', async () => {
  installStorage();
  const { saveSession } = await loadSessionModule();
  assert.throws(
    () => saveSession(freshSnapshot({ state: { blocked_nodes: ['NOPE'], blocked_edges: [], closed_exits: [] } })),
    err => err.code === 'sessionError' && /invalid state/.test(err.message),
    'unknown node id in blocked_nodes must be rejected'
  );
  assert.throws(
    () => saveSession(freshSnapshot({ state: { blocked_nodes: [], blocked_edges: ['L99'], closed_exits: [] } })),
    err => err.code === 'sessionError' && /invalid state/.test(err.message),
    'unknown edge id must be rejected'
  );
  assert.throws(
    () => saveSession(freshSnapshot({ state: { blocked_nodes: [], blocked_edges: [], closed_exits: ['R1'] } })),
    err => err.code === 'sessionError' && /invalid state/.test(err.message),
    'non-exit id in closed_exits must be rejected'
  );
  assert.throws(
    () => saveSession(freshSnapshot({ state: { blocked_nodes: ['E1'], blocked_edges: [], closed_exits: [] } })),
    err => err.code === 'sessionError' && /invalid state/.test(err.message),
    'exit id in blocked_nodes must be rejected'
  );
  uninstallStorage();
});

test('load rejects a saved snapshot whose current hazards reference IDs that do not exist', async () => {
  installStorage({
    'puku1:smart-escape:session:v1': JSON.stringify({
      version: 1,
      building: smallBuilding(),
      state: { blocked_nodes: ['NOT_A_NODE'], blocked_edges: [], closed_exits: [] },
      startId: 'R1', language: 'en', mode: 'select',
    }),
  });
  const { loadSession } = await loadSessionModule();
  assert.throws(
    () => loadSession(),
    err => err.code === 'sessionError' && /invalid state/.test(err.message)
  );
  uninstallStorage();
});

test('save rejects a snapshot whose state has missing or non-array fields (not silent defaults)', async () => {
  installStorage();
  const { saveSession } = await loadSessionModule();
  // state is not an object at all.
  assert.throws(
    () => saveSession({
      building: smallBuilding(),
      state: null,
      startId: 'R1', language: 'en', mode: 'select',
    }),
    err => err.code === 'sessionError' && /state required/.test(err.message),
    'null state must fail'
  );
  // Missing blocked_nodes entirely.
  assert.throws(
    () => saveSession({
      building: smallBuilding(),
      state: { blocked_edges: [], closed_exits: [] },
      startId: 'R1', language: 'en', mode: 'select',
    }),
    err => err.code === 'sessionError' && /blocked_nodes/.test(err.message),
    'missing blocked_nodes field must fail'
  );
  // Non-array blocked_nodes.
  assert.throws(
    () => saveSession(freshSnapshot({ state: { blocked_nodes: 'R1', blocked_edges: [], closed_exits: [] } })),
    err => err.code === 'sessionError' && /state field must be an array/.test(err.message),
    'non-array blocked_nodes must fail'
  );
  // Non-array blocked_edges.
  assert.throws(
    () => saveSession(freshSnapshot({ state: { blocked_nodes: [], blocked_edges: 'L01', closed_exits: [] } })),
    err => err.code === 'sessionError' && /state field must be an array/.test(err.message),
    'non-array blocked_edges must fail'
  );
  // Non-array closed_exits.
  assert.throws(
    () => saveSession(freshSnapshot({ state: { blocked_nodes: [], blocked_edges: [], closed_exits: null } })),
    err => err.code === 'sessionError',
    'non-array closed_exits must fail'
  );
  uninstallStorage();
});

test('load rejects a saved snapshot whose state has missing or non-array fields', async () => {
  const base = {
    version: 1,
    building: smallBuilding(),
    state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] },
    startId: 'R1', language: 'en', mode: 'select',
  };
  const cases = [
    { ...base, state: { blocked_edges: [], closed_exits: [] } },
    { ...base, state: { blocked_nodes: [], blocked_edges: 'L01', closed_exits: [] } },
    { ...base, state: { blocked_nodes: [], blocked_edges: [], closed_exits: 42 } },
  ];
  for (const c of cases) {
    installStorage({ 'puku1:smart-escape:session:v1': JSON.stringify(c) });
    const { loadSession } = await loadSessionModule();
    assert.throws(
      () => loadSession(),
      err => err.code === 'sessionError',
      'expected throw for state: ' + JSON.stringify(c.state)
    );
    uninstallStorage();
  }
});

test('save rejects an invalid language (not en/bn)', async () => {
  installStorage();
  const { saveSession } = await loadSessionModule();
  assert.throws(
    () => saveSession(freshSnapshot({ language: 'fr' })),
    err => err.code === 'sessionError' && /language must be en or bn/.test(err.message)
  );
  assert.throws(
    () => saveSession(freshSnapshot({ language: 42 })),
    err => err.code === 'sessionError'
  );
  uninstallStorage();
});

test('load rejects a saved snapshot with an invalid language', async () => {
  installStorage({
    'puku1:smart-escape:session:v1': JSON.stringify({
      version: 1,
      building: smallBuilding(),
      state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] },
      startId: 'R1', language: 'fr', mode: 'select',
    }),
  });
  const { loadSession } = await loadSessionModule();
  assert.throws(
    () => loadSession(),
    err => err.code === 'sessionError' && /language must be en or bn/.test(err.message)
  );
  uninstallStorage();
});

test('language "bn" and mode "hazard" are accepted on both save and load', async () => {
  installStorage();
  const { saveSession, loadSession, clearSession } = await loadSessionModule();
  saveSession(freshSnapshot({ language: 'bn', mode: 'hazard', startId: 'J1' }));
  const loaded = loadSession();
  assert.equal(loaded.language, 'bn');
  assert.equal(loaded.mode, 'hazard');
  assert.equal(loaded.startId, 'J1');
  clearSession();
  uninstallStorage();
});

test('save rejects an invalid startId (exit, unknown, or wrong type)', async () => {
  installStorage();
  const { saveSession } = await loadSessionModule();
  assert.throws(
    () => saveSession(freshSnapshot({ startId: 'E1' })),
    err => err.code === 'sessionError' && /startId must not be an exit/.test(err.message),
    'exit type startId must be rejected'
  );
  assert.throws(
    () => saveSession(freshSnapshot({ startId: 'NOT_A_NODE' })),
    err => err.code === 'sessionError' && /startId references unknown node/.test(err.message),
    'unknown node id must be rejected'
  );
  assert.throws(
    () => saveSession(freshSnapshot({ startId: 42 })),
    err => err.code === 'sessionError',
    'non-string startId must be rejected'
  );
  uninstallStorage();
});

test('load rejects a saved snapshot with an invalid startId', async () => {
  const base = {
    version: 1,
    building: smallBuilding(),
    state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] },
    language: 'en', mode: 'select',
  };
  installStorage({ 'puku1:smart-escape:session:v1': JSON.stringify({ ...base, startId: 'E1' }) });
  const m1 = await loadSessionModule();
  assert.throws(
    () => m1.loadSession(),
    err => err.code === 'sessionError' && /startId must not be an exit/.test(err.message)
  );
  uninstallStorage();
  installStorage({ 'puku1:smart-escape:session:v1': JSON.stringify({ ...base, startId: 'GHOST' }) });
  const m2 = await loadSessionModule();
  assert.throws(
    () => m2.loadSession(),
    err => err.code === 'sessionError' && /startId references unknown node/.test(err.message)
  );
  uninstallStorage();
});

test('save rejects an invalid mode (not select/hazard)', async () => {
  installStorage();
  const { saveSession } = await loadSessionModule();
  assert.throws(
    () => saveSession(freshSnapshot({ mode: 'edit' })),
    err => err.code === 'sessionError' && /mode must be select or hazard/.test(err.message)
  );
  uninstallStorage();
});

test('startId: null and empty string are accepted on save and load', async () => {
  installStorage();
  const { saveSession, loadSession, clearSession } = await loadSessionModule();
  for (const startId of [null, '']) {
    saveSession(freshSnapshot({ startId }));
    const loaded = loadSession();
    assert.equal(loaded.startId, null);
    clearSession();
  }
  uninstallStorage();
});

test('loadSession throws a sessionError when storage returns corrupt JSON', async () => {
  installStorage({ 'puku1:smart-escape:session:v1': '{not json' });
  const { loadSession } = await loadSessionModule();
  assert.throws(
    () => loadSession(),
    err => err.code === 'sessionError' && /not valid JSON/.test(err.message)
  );
  uninstallStorage();
});

test('loadSession throws a sessionError when the stored value is not an object', async () => {
  installStorage({ 'puku1:smart-escape:session:v1': '"a string"' });
  const { loadSession } = await loadSessionModule();
  assert.throws(
    () => loadSession(),
    err => err.code === 'sessionError' && /not an object/.test(err.message)
  );
  uninstallStorage();
});

test('saveSession and loadSession throw a sessionError when localStorage is unavailable', async () => {
  uninstallStorage();
  const { saveSession, loadSession, clearSession } = await loadSessionModule();
  assert.throws(() => saveSession(freshSnapshot()), err => err.code === 'sessionError' && /unavailable/.test(err.message));
  assert.throws(() => loadSession(), err => err.code === 'sessionError' && /unavailable/.test(err.message));
  assert.throws(() => clearSession(), err => err.code === 'sessionError' && /unavailable/.test(err.message));
});

test('saveSession throws a sessionError when localStorage.setItem throws (e.g. quota exceeded)', async () => {
  installStorage();
  const { saveSession } = await loadSessionModule();
  throwOnSet = new Error('QuotaExceededError');
  try {
    assert.throws(
      () => saveSession(freshSnapshot()),
      err => err.code === 'sessionError' && /localStorage write failed/.test(err.message)
    );
  } finally {
    throwOnSet = null;
    uninstallStorage();
  }
});

test('saveSession throws a sessionError when the building itself is invalid', async () => {
  installStorage();
  const { saveSession } = await loadSessionModule();
  const bad = smallBuilding();
  delete bad.initial_state;
  assert.throws(
    () => saveSession(freshSnapshot({ building: bad })),
    err => err.code === 'sessionError' && /invalid building/.test(err.message)
  );
  uninstallStorage();
});

test('saveSession dedupes duplicate state IDs', async () => {
  installStorage();
  const { saveSession, loadSession, clearSession } = await loadSessionModule();
  saveSession(freshSnapshot({
    state: { blocked_nodes: ['R1', 'R1', 'R1'], blocked_edges: ['L01', 'L01'], closed_exits: ['E1', 'E1'] },
  }));
  const loaded = loadSession();
  assert.deepEqual(loaded.state.blocked_nodes, ['R1']);
  assert.deepEqual(loaded.state.blocked_edges, ['L01']);
  assert.deepEqual(loaded.state.closed_exits, ['E1']);
  clearSession();
  uninstallStorage();
});