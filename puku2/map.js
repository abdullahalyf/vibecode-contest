// DOM-only renderer. API ownership: Puku 2. No routing or state mutation here.
const NS = 'http://www.w3.org/2000/svg';
function element(name, attrs = {}, content) {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (content !== undefined) el.textContent = content;
  return el;
}

// Safe coordinate normalization for every finite x / y, including opposite
// signs near +/-Number.MAX_VALUE. Order of operations is the trick:
//
//   1. Pick shared magnitude = max(|x|, |y|) across all finite nodes.
//      Use 1 when magnitude is 0.
//   2. Divide each x and y by magnitude first. They are bounded in [-1, 1].
//   3. Compute min / max / spans from the divided coordinates.
//   4. Divide by extent (max of the two spans) BEFORE multiplying by 680,
//      so the numerator is in [-1, 1] and never overflows.
//   5. Width / height track the real input rectangle, with a 100 px gutter
//      and minimums of 200 / 300.
//
// Every multiplication is preceded by a division, so all arithmetic is
// bounded by 2. Opposite maximal finite values are safe.
function normalize(nodes) {
  const valid = nodes.filter(n => Number.isFinite(n.x) && Number.isFinite(n.y));
  if (!valid.length) return { positions: new Map(), width: 200, height: 300 };
  let magnitude = 0;
  for (const n of valid) {
    if (Math.abs(n.x) > magnitude) magnitude = Math.abs(n.x);
    if (Math.abs(n.y) > magnitude) magnitude = Math.abs(n.y);
  }
  if (magnitude === 0) magnitude = 1;
  // Divide FIRST. Divided coordinates are bounded in [-1, 1] and all
  // subsequent subtraction is bounded by 2.
  const divided = valid.map(n => ({ id: n.id, x: n.x / magnitude, y: n.y / magnitude }));
  let minX = divided[0].x, maxX = divided[0].x, minY = divided[0].y, maxY = divided[0].y;
  for (const d of divided) {
    if (d.x < minX) minX = d.x;
    if (d.x > maxX) maxX = d.x;
    if (d.y < minY) minY = d.y;
    if (d.y > maxY) maxY = d.y;
  }
  const spanX = maxX - minX, spanY = maxY - minY;
  // Extent drives the uniform scale. Use 1 when both spans collapse so we
  // never divide by zero.
  let extent = spanX > spanY ? spanX : spanY;
  if (extent === 0) extent = 1;
  // Divide by extent BEFORE multiplying by 680. Divided coordinates are in
  // [-1, 1]; the result is in [-680, 680] and never overflows.
  const positions = new Map(divided.map(d => [d.id, {
    x: 100 + ((d.x - minX) / extent) * 680,
    y: 100 + ((d.y - minY) / extent) * 680
  }]));
  // Width / height fit the actual input rectangle plus a 100 px gutter,
  // with minimums that keep a coincident-coord fallback legible.
  const width = Math.max(200, 200 + (spanX / extent) * 680);
  const height = Math.max(300, 200 + (spanY / extent) * 680);
  return { positions, width, height };
}

export function renderMap(container, { building, state, startId, route, mode, t, onNode, onEdge }) {
  container.replaceChildren();
  const norm = normalize(building.nodes);
  const positions = norm.positions;
  const width = norm.width, height = norm.height;
  const svg = element('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': t('map') });
  const blocked = new Set(state.blocked_nodes), closed = new Set(state.closed_exits), blockedEdges = new Set(state.blocked_edges);
  const routeEdges = new Set(route.status === 'ok' ? route.edgeIds : []);
  const routeNodes = new Set(route.status === 'ok' ? route.nodeIds : []);
  const defs = element('defs');
  const pattern = element('pattern', { id: 'map-grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' });
  pattern.append(element('circle', { cx: 2, cy: 2, r: 1, fill: '#cdd8d3' }));
  defs.append(pattern); svg.append(defs, element('rect', { width, height, fill: 'url(#map-grid)' }));
  const keyAction = action => event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };
  for (const edge of building.edges) {
    const a = positions.get(edge.from), b = positions.get(edge.to);
    const unavailable = blockedEdges.has(edge.id) || blocked.has(edge.from) || blocked.has(edge.to) || closed.has(edge.from) || closed.has(edge.to);
    const g = element('g', { class: `corridor ${unavailable ? 'unavailable' : ''} ${routeEdges.has(edge.id) ? 'on-route' : ''}`, role: 'button', tabindex: 0,
      'aria-label': `${edge.id}: ${edge.from} ↔ ${edge.to}, ${t('cost')} ${edge.cost}. ${t(blockedEdges.has(edge.id) ? 'unblock' : 'block')}`,
      'aria-pressed': blockedEdges.has(edge.id), 'data-focus': `map-edge:${edge.id}` });
    const lineAttrs = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    g.append(element('line', { ...lineAttrs, class: 'corridor-hit' }), element('line', { ...lineAttrs, class: 'corridor-line' }));
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    g.append(element('rect', { x: midX - 16, y: midY - 13, width: 32, height: 26, rx: 7, class: 'cost-badge' }),
      element('text', { x: midX, y: midY + 5, class: 'cost-label' }, edge.cost));
    const action = () => onEdge(edge.id);
    g.addEventListener('click', action); g.addEventListener('keydown', keyAction(action));
    g.append(element('title', {}, `${edge.id} · ${edge.from} ↔ ${edge.to}`)); svg.append(g);
  }
  for (const node of building.nodes) {
    const p = positions.get(node.id), unavailable = blocked.has(node.id) || closed.has(node.id);
    const g = element('g', { transform: `translate(${p.x},${p.y})`, class: `location ${node.type} ${unavailable ? 'unavailable' : ''} ${routeNodes.has(node.id) ? 'on-route' : ''} ${node.id === startId ? 'is-start' : ''}`,
      role: 'button', tabindex: 0, 'aria-label': `${node.label} (${node.id}), ${t(node.type)}. ${t(node.type === 'exit' ? (closed.has(node.id) ? 'reopen' : 'close') : mode === 'hazard' ? (blocked.has(node.id) ? 'unblock' : 'block') : 'selectStart')}`,
      'data-focus': `map-node:${node.id}` });
    if (node.type === 'exit') g.append(element('rect', { x: -21, y: -21, width: 42, height: 42, rx: 10, class: 'node-shape' }));
    else g.append(element('circle', { r: node.type === 'room' ? 23 : 18, class: 'node-shape' }));
    g.append(element('text', { y: 5, class: 'node-id' }, node.id), element('text', { y: 43, class: 'node-label' }, node.label));
    if (unavailable) g.append(element('text', { x: 22, y: -19, class: 'hazard-mark', 'aria-hidden': true }, '×'));
    const action = () => onNode(node.id);
    g.addEventListener('click', action); g.addEventListener('keydown', keyAction(action)); svg.append(g);
  }
  container.append(svg);
}