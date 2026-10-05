// Pure browser-compatible functions. API ownership: Puku 1.
export class ValidationError extends Error {
  constructor(code) { super(code); this.name = 'ValidationError'; this.code = code; }
}

export function validateBuilding(value) {
  const fail = code => { throw new ValidationError(code); };
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = v => typeof v === 'string' && v.trim().length > 0;
  if (!object(value)) fail('object');
  if (!text(value.building)) fail('building');
  if (!Array.isArray(value.nodes) || value.nodes.length < 2 || value.nodes.length > 60) fail('nodes');
  if (!Array.isArray(value.edges) || value.edges.length < 1 || value.edges.length > 150) fail('edges');
  const nodes = new Map();
  for (const node of value.nodes) {
    if (!object(node) || !text(node.id) || !text(node.label) ||
        !['room', 'junction', 'exit'].includes(node.type) ||
        !Number.isFinite(node.x) || !Number.isFinite(node.y)) fail('node');
    if (nodes.has(node.id)) fail('nodeId');
    nodes.set(node.id, node);
  }
  if (!value.nodes.some(n => n.type === 'exit') || !value.nodes.some(n => n.type !== 'exit')) fail('categories');
  const edges = new Set(), pairs = new Set();
  let totalCost = 0;
  for (const edge of value.edges) {
    if (!object(edge) || !text(edge.id) || !nodes.has(edge.from) || !nodes.has(edge.to) ||
        !Number.isSafeInteger(edge.cost) || edge.cost <= 0) fail('edge');
    if (edges.has(edge.id)) fail('edgeId');
    if (edge.from === edge.to) fail('loop');
    const pair = JSON.stringify([edge.from, edge.to].sort(compareIds));
    if (pairs.has(pair)) fail('pair');
    edges.add(edge.id); pairs.add(pair);
    totalCost += edge.cost;
    if (!Number.isSafeInteger(totalCost)) fail('costRange');
  }
  if (!object(value.initial_state)) fail('state');
  for (const key of ['blocked_nodes', 'blocked_edges', 'closed_exits']) {
    const ids = value.initial_state[key];
    if (!Array.isArray(ids)) fail('state');
    for (const id of ids) {
      if (key === 'blocked_edges' ? !edges.has(id) :
          !nodes.has(id) || (key === 'closed_exits' ? nodes.get(id).type !== 'exit' : nodes.get(id).type === 'exit')) fail('stateId');
    }
  }
  // Copy only the schema fields. Callers never mutate the imported object.
  return {
    building: value.building,
    nodes: value.nodes.map(({ id, label, type, x, y }) => ({ id, label, type, x, y })),
    edges: value.edges.map(({ id, from, to, cost }) => ({ id, from, to, cost })),
    initial_state: Object.fromEntries(Object.entries(value.initial_state)
      .filter(([key]) => ['blocked_nodes', 'blocked_edges', 'closed_exits'].includes(key))
      .map(([key, ids]) => [key, [...new Set(ids)]]))
  };
}

export function createState(building) {
  return Object.fromEntries(Object.entries(building.initial_state).map(([key, ids]) => [key, [...ids]]));
}

export function compareIds(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
export function comparePaths(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const order = compareIds(a[i], b[i]);
    if (order) return order;
  }
  return a.length - b.length;
}

export function findRoute(building, state, startId) {
  const start = building.nodes.find(n => n.id === startId);
  if (!start || start.type === 'exit') return { status: 'select_start' };
  const excluded = new Set([...state.blocked_nodes, ...state.closed_exits]);
  if (excluded.has(startId)) return { status: 'start_blocked' };
  const blockedEdges = new Set(state.blocked_edges);
  const adjacent = new Map(building.nodes.map(n => [n.id, []]));
  for (const edge of building.edges) {
    if (blockedEdges.has(edge.id) || excluded.has(edge.from) || excluded.has(edge.to)) continue;
    adjacent.get(edge.from).push({ node: edge.to, edge });
    adjacent.get(edge.to).push({ node: edge.from, edge });
  }
  const best = new Map([[startId, { cost: 0, nodeIds: [startId], edgeIds: [] }]]);
  const settled = new Set();
  // At most 60 nodes: sort candidates by cost and full path on each iteration.
  while (true) {
    const candidate = [...best.entries()].filter(([id]) => !settled.has(id)).sort((a, b) =>
      a[1].cost - b[1].cost || comparePaths(a[1].nodeIds, b[1].nodeIds))[0];
    if (!candidate) break;
    const [id, path] = candidate;
    settled.add(id);
    for (const { node, edge } of adjacent.get(id)) {
      if (settled.has(node)) continue;
      const next = { cost: path.cost + edge.cost, nodeIds: [...path.nodeIds, node], edgeIds: [...path.edgeIds, edge.id] };
      const previous = best.get(node);
      if (!previous || next.cost < previous.cost ||
          (next.cost === previous.cost && comparePaths(next.nodeIds, previous.nodeIds) < 0)) best.set(node, next);
    }
  }
  const exits = building.nodes.filter(n => n.type === 'exit' && !excluded.has(n.id) && best.has(n.id))
    .sort((a, b) => best.get(a.id).cost - best.get(b.id).cost || compareIds(a.id, b.id));
  if (!exits.length) return { status: 'no_route' };
  return { status: 'ok', exitId: exits[0].id, ...best.get(exits[0].id) };
}
