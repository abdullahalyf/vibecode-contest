import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateBuilding, createState, findRoute } from './engine.js';

const sample = JSON.parse(readFileSync(new URL('../data/building.json', import.meta.url), 'utf8'));
const fresh = () => validateBuilding(structuredClone(sample));
function fixture(ids, exits, edges) {
  return validateBuilding({ building: 'Unit-test graph', nodes: ids.map((id, i) => ({ id, label: id, type: exits.includes(id) ? 'exit' : 'junction', x: i, y: 0 })),
    edges: edges.map(([from, to, cost], i) => ({ id: `edge${i}`, from, to, cost })), initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] } });
}
test('official baseline: R1 to E1 costs 7', () => {
  const b = fresh(), r = findRoute(b, createState(b), 'R1');
  assert.equal(r.status, 'ok'); assert.equal(r.cost, 7); assert.equal(r.exitId, 'E1');
  assert.deepEqual(r.nodeIds, ['R1', 'C1', 'C2', 'E1']); assert.deepEqual(r.edgeIds, ['L01', 'L02', 'L03']);
});
test('official reroute after C2 is blocked costs 11', () => {
  const b = fresh(), s = createState(b); s.blocked_nodes.push('C2');
  const r = findRoute(b, s, 'R1'); assert.equal(r.cost, 11); assert.equal(r.exitId, 'E2');
  assert.deepEqual(r.nodeIds, ['R1', 'C1', 'C3', 'C4', 'E2']);
});
test('official closed exits leave no route', () => {
  const b = fresh(), s = createState(b); s.closed_exits.push('E1', 'E2');
  assert.equal(findRoute(b, s, 'R1').status, 'no_route');
});
test('official R2 route costs 7', () => {
  const b = fresh(), r = findRoute(b, createState(b), 'R2');
  assert.equal(r.cost, 7); assert.deepEqual(r.nodeIds, ['R2', 'C3', 'C4', 'E2']);
});
test('official blocked start is a distinct status', () => {
  const b = fresh(), s = createState(b); s.blocked_nodes.push('R1');
  assert.equal(findRoute(b, s, 'R1').status, 'start_blocked');
});
test('blocked corridor removes only its connection', () => {
  const b = fresh(), s = createState(b); s.blocked_edges.push('L03');
  const r = findRoute(b, s, 'R1'); assert.equal(r.exitId, 'E2'); assert.equal(r.cost, 10);
  assert.deepEqual(r.nodeIds, ['R1', 'C1', 'C2', 'C4', 'E2']);
});
test('exit ID wins equal-cost ties even when another path sorts first', () => {
  const b = fixture(['S', 'a', 'z', 'E1', 'E2'], ['E1', 'E2'], [['S', 'a', 1], ['a', 'E2', 2], ['S', 'z', 1], ['z', 'E1', 2]]);
  assert.equal(findRoute(b, createState(b), 'S').exitId, 'E1');
});
test('equal paths compare full node sequences without locale ordering', () => {
  const b = fixture(['S', 'a', 'A', 'E'], ['E'], [['S', 'a', 1], ['a', 'E', 2], ['S', 'A', 2], ['A', 'E', 1]]);
  assert.deepEqual(findRoute(b, createState(b), 'S').nodeIds, ['S', 'A', 'E']);
});
test('path comparison uses IDs, not joined strings', () => {
  const b = fixture(['S', 'A', 'A!', 'E'], ['E'], [['S', 'A!', 1], ['A!', 'E', 2], ['S', 'A', 1], ['A', 'E', 2]]);
  assert.deepEqual(findRoute(b, createState(b), 'S').nodeIds, ['S', 'A', 'E']);
});
test('closed exits cannot be intermediate nodes', () => {
  const b = fixture(['S', 'E1', 'E2'], ['E1', 'E2'], [['S', 'E1', 1], ['E1', 'E2', 1]]);
  const s = createState(b); s.closed_exits.push('E1');
  assert.equal(findRoute(b, s, 'S').status, 'no_route');
});
test('undirected corridors, disconnected nodes and coordinates do not affect costs', () => {
  const b = fixture(['S', 'X', 'E'], ['E'], [['E', 'S', 4]]);
  b.nodes[0].x = 1e100;
  assert.equal(findRoute(b, createState(b), 'S').cost, 4);
  assert.equal(findRoute(b, createState(b), 'X').status, 'no_route');
});
test('start must be a room or junction', () => {
  const b = fresh();
  for (const id of ['', 'missing', 'E1']) assert.equal(findRoute(b, createState(b), id).status, 'select_start');
});
test('reset restores imported hazards without aliasing initial_state', () => {
  const input = structuredClone(sample); input.initial_state.blocked_nodes = ['C2']; input.initial_state.blocked_edges = ['L04']; input.initial_state.closed_exits = ['E1'];
  const b = validateBuilding(input), s = createState(b); s.blocked_nodes.push('R1'); s.blocked_edges.length = 0; s.closed_exits.length = 0;
  assert.deepEqual(createState(b), input.initial_state); assert.notEqual(createState(b).blocked_nodes, b.initial_state.blocked_nodes);
});
test('validation rejects malformed or inconsistent input', () => {
  const mutations = [
    v => { v.building = ' '; }, v => { v.nodes = []; }, v => { v.edges = []; },
    v => { v.nodes[1].id = v.nodes[0].id; }, v => { v.nodes[0].x = '60'; }, v => { v.nodes[0].y = Infinity; },
    v => { v.nodes[0].type = 'hall'; }, v => { v.nodes.forEach(n => n.type = 'room'); },
    v => { v.edges[0].cost = 0; }, v => { v.edges[0].cost = 1.5; }, v => { v.edges[0].to = 'missing'; },
    v => { v.edges[1].id = v.edges[0].id; }, v => { v.edges[0].to = v.edges[0].from; },
    v => { v.edges.push({ id: 'duplicatePair', from: v.edges[0].to, to: v.edges[0].from, cost: 1 }); },
    v => { delete v.initial_state; }, v => { v.initial_state.blocked_nodes = ['E1']; },
    v => { v.initial_state.closed_exits = ['R1']; }, v => { v.initial_state.blocked_edges = ['missing']; },
    v => { v.initial_state.blocked_nodes = 'C1'; }, v => { v.edges[0].cost = Number.MAX_SAFE_INTEGER; }
  ];
  for (const mutate of mutations) { const v = structuredClone(sample); mutate(v); assert.throws(() => validateBuilding(v), { name: 'ValidationError' }); }
  for (const v of [null, [], 'hello', 1]) assert.throws(() => validateBuilding(v));
});
test('routing agrees with an exhaustive simple-path oracle on small deterministic graphs', () => {
  let seed = 17;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  function oracle(b, s) {
    const forbidden = new Set([...s.blocked_nodes, ...s.closed_exits]);
    const paths = [];
    function visit(id, ids, cost) {
      if (b.nodes.find(n => n.id === id).type === 'exit') paths.push({ exitId: id, nodeIds: ids, cost });
      for (const e of b.edges) {
        if (s.blocked_edges.includes(e.id)) continue;
        const to = e.from === id ? e.to : e.to === id ? e.from : null;
        if (to && !forbidden.has(to) && !ids.includes(to)) visit(to, [...ids, to], cost + e.cost);
      }
    }
    visit('S', ['S'], 0);
    paths.sort((a, b) => {
      const head = a.cost - b.cost || lexical(a.exitId, b.exitId); if (head) return head;
      for (let i = 0; i < Math.min(a.nodeIds.length, b.nodeIds.length); i++) { const order = lexical(a.nodeIds[i], b.nodeIds[i]); if (order) return order; }
      return a.nodeIds.length - b.nodeIds.length;
    }); return paths[0];
  }
  for (let run = 0; run < 80; run++) {
    const ids = ['S', 'A', 'B', 'C', 'E1', 'E2'], edges = [['S', 'A', 1]];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (i === 0 && j === 1) continue;
      if (random() < .45) edges.push([ids[i], ids[j], 1 + Math.floor(random() * 4)]);
    }
    const b = fixture(ids, ['E1', 'E2'], edges), s = createState(b);
    if (random() < .5) s.blocked_nodes.push('B'); if (random() < .5) s.closed_exits.push('E1'); if (random() < .5) s.blocked_edges.push('edge0');
    const expected = oracle(b, s), actual = findRoute(b, s, 'S');
    if (!expected) assert.equal(actual.status, 'no_route');
    else { assert.equal(actual.cost, expected.cost); assert.equal(actual.exitId, expected.exitId); assert.deepEqual(actual.nodeIds, expected.nodeIds); }
  }
});

// --- Puku 1 review additions: targeted, non-duplicating regression tests ---

// 1. Mixed-case exit IDs break ties by case-sensitive code-point order.
test('exit tie-break is case-sensitive even when path ordering would pick another exit', () => {
  // Both exits are reachable at cost 3. Path through `a` reaches `e1` first
  // alphabetically; path through `B` reaches `E1` first alphabetically.
  // The engine must still prefer the lower exit ID by ordinal compare
  // (`'E1'` (0x45) < `'e1'` (0x65)).
  const b = fixture(
    ['S', 'B', 'a', 'E1', 'e1'],
    ['E1', 'e1'],
    [['S', 'B', 1], ['B', 'E1', 2], ['S', 'a', 1], ['a', 'e1', 2]]
  );
  const r = findRoute(b, createState(b), 'S');
  assert.equal(r.status, 'ok');
  assert.equal(r.cost, 3);
  assert.equal(r.exitId, 'E1');
});

// 2. validateBuilding does not alias input objects or arrays.
test('validateBuilding never reads through to the input after returning', () => {
  const input = {
    building: 'Isolation probe',
    nodes: [
      { id: 'R1', label: 'Room 1', type: 'room', x: 0, y: 0 },
      { id: 'E1', label: 'Exit 1', type: 'exit', x: 10, y: 0 }
    ],
    edges: [{ id: 'L01', from: 'R1', to: 'E1', cost: 5 }],
    initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] }
  };
  const building = validateBuilding(input);
  // Mutate the input after validation.
  input.nodes[0].label = 'MUTATED';
  input.nodes[0].x = 999;
  input.initial_state.blocked_nodes.push('E1');
  input.initial_state.blocked_edges.push('L01');
  input.initial_state.closed_exits.push('E1');
  // The validated building must be unchanged.
  assert.equal(building.nodes[0].label, 'Room 1');
  assert.equal(building.nodes[0].x, 0);
  assert.deepEqual(building.initial_state.blocked_nodes, []);
  assert.deepEqual(building.initial_state.blocked_edges, []);
  assert.deepEqual(building.initial_state.closed_exits, []);
});

// 3. findRoute returns fresh arrays on every call; callers may mutate the result.
test('findRoute returns fresh node/edge arrays that are safe to mutate', () => {
  const b = fresh();
  const s = createState(b);
  const r1 = findRoute(b, s, 'R1');
  const r2 = findRoute(b, s, 'R1');
  // Mutate the first result heavily.
  r1.nodeIds.length = 0;
  r1.nodeIds.push('HACK', 'STOLEN');
  r1.edgeIds.length = 0;
  r1.edgeIds.push('HACK');
  r1.cost = -1;
  // Second call must be unaffected.
  assert.equal(r2.status, 'ok');
  assert.equal(r2.cost, 7);
  assert.deepEqual(r2.nodeIds, ['R1', 'C1', 'C2', 'E1']);
  assert.deepEqual(r2.edgeIds, ['L01', 'L02', 'L03']);
  // And the engine's own internal state must not be affected either —
  // a fresh call after mutation still returns the canonical route.
  const r3 = findRoute(b, s, 'R1');
  assert.equal(r3.cost, 7);
  assert.deepEqual(r3.nodeIds, ['R1', 'C1', 'C2', 'E1']);
});

// 4. The contract size ceiling (60 nodes / 150 edges) is enforced at the boundary.
test('60 nodes and 150 edges pass validation; 61 nodes and 151 edges fail', () => {
  // Build a valid 60-node / 150-edge graph: 58 junctions + 2 exits, with a
  // 59-edge line chain through all 60 nodes plus 91 non-pair-duplicating
  // cross-edges that connect junction pairs which are not already adjacent in
  // the chain.
  const nodes = [];
  for (let i = 0; i < 58; i++) nodes.push({ id: `J${i}`, label: `Junction ${i}`, type: 'junction', x: i, y: 0 });
  nodes.push({ id: 'EXIT_A', label: 'Exit A', type: 'exit', x: 58, y: 0 });
  nodes.push({ id: 'EXIT_B', label: 'Exit B', type: 'exit', x: 59, y: 0 });
  const ids = nodes.map(n => n.id);
  // Line chain: 59 edges, J0 -> J1 -> ... -> J57 -> EXIT_A -> EXIT_B.
  const edges = [];
  for (let i = 0; i < 59; i++) edges.push({ id: `L${i}`, from: ids[i], to: ids[i + 1], cost: 1 });
  // 91 cross-edges between non-adjacent junctions. Skip any pair already used
  // in the line chain so we never trigger the 'pair' validation code.
  const chainPairs = new Set(edges.map(e => JSON.stringify([e.from, e.to].sort())));
  let crossCount = 0, edgeSerial = 0;
  outer: for (let span = 2; span <= 20; span++) {
    for (let i = 0; i + span < 58; i++) {
      const key = JSON.stringify([`J${i}`, `J${i + span}`].sort());
      if (chainPairs.has(key)) continue;
      chainPairs.add(key);
      edges.push({ id: `X${edgeSerial++}`, from: `J${i}`, to: `J${i + span}`, cost: 5 });
      crossCount++;
      if (crossCount === 91) break outer;
    }
  }
  assert.equal(nodes.length, 60);
  assert.equal(edges.length, 150);
  assert.equal(crossCount, 91);
  const building = validateBuilding({
    building: 'Boundary fixture',
    nodes,
    edges,
    initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] }
  });
  assert.equal(building.nodes.length, 60);
  assert.equal(building.edges.length, 150);
  // Routing must succeed and exit choices are well-defined (two exits exist).
  const r = findRoute(building, createState(building), 'J0');
  assert.equal(r.status, 'ok');
  assert.ok(['EXIT_A', 'EXIT_B'].includes(r.exitId));
  assert.ok(r.cost >= 3);

  // 61 nodes must throw with code 'nodes'.
  const tooManyNodes = { building: 'X', nodes: [...nodes, { id: 'J60', label: 'Extra', type: 'junction', x: 60, y: 0 }], edges, initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] } };
  assert.throws(() => validateBuilding(tooManyNodes), { name: 'ValidationError', code: 'nodes' });

  // 151 edges must throw with code 'edges'.
  const tooManyEdges = { building: 'X', nodes, edges: [...edges, { id: 'EXTRA', from: 'EXIT_A', to: 'J0', cost: 1 }], initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] } };
  assert.throws(() => validateBuilding(tooManyEdges), { name: 'ValidationError', code: 'edges' });
});
