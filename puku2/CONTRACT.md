# Integration contract (version 1)

Paths resolve relative to the repository root. Puku folders are source modules in a single project, not independent apps or Git repositories.

## Puku 1: engine

`puku1/engine.js` exports:

```js
validateBuilding(parsedJson) // returns sanitized copy; throws ValidationError with .code
createState(validatedBuilding) // deep copy of the three initial_state arrays
findRoute(validatedBuilding, state, startId) // pure; does not mutate inputs
ValidationError
compareIds(a, b)
comparePaths(nodeIdsA, nodeIdsB)
```

State: `{ blocked_nodes: string[], blocked_edges: string[], closed_exits: string[] }`.

Route success: `{ status: 'ok', exitId: string, cost: number, nodeIds: string[], edgeIds: string[] }`.

Route failure: `{ status: 'select_start' | 'start_blocked' | 'no_route' }`.

Validation codes: `object`, `building`, `nodes`, `edges`, `node`, `nodeId`, `categories`, `edge`, `edgeId`, `loop`, `pair`, `costRange`, `state`, `stateId`. Changes to these codes need corresponding translations coordinated with Codex.

Use JS ordinal string comparisons (`<`/`>`) and compare node arrays element by element. Do not use localeCompare or join path IDs into one string. Route cost is the sum of positive edge weights, independent of coordinates. Node and edge IDs occupy separate categories and may overlap. State IDs must match their categories. Disconnected graphs are valid.

## Puku 2: map and styles

`puku2/map.js` exports:

```js
renderMap(container, {
  building, state, startId, route,
  mode, // 'select' | 'hazard'
  t, // translation function, t(key) -> localized string
  onNode, // callback(nodeId)
  onEdge, // callback(edgeId)
}) // updates the supplied container; does not mutate input state
```

The renderer handles SVG drawing and keyboard interactions. Codex handles the meaning of click events, routing, language and state changes. Puku 2 owns all CSS in `puku2/styles.css`; preserve class names used in `src/app.js` or coordinate changes.

Required map states: node type, selected start, highlighted route, blocked room/junction, closed exit, blocked corridor and corridors disabled by their endpoint. Show labels and edge costs. Layout must preserve supplied coordinates after a uniform scaling/translation. IDs and labels are untrusted text. All state changes have brief, non-flashing transitions. Respect `prefers-reduced-motion`.

If the map needs a translation key, document it in `puku2/REPORT.md` and ask Codex to add both translations to `src/i18n.js` before integration.

## Codex integration

`src/app.js` imports these modules with relative paths. Codex owns import controls, current state, start selection, hazard lists, reset, status panels, language switching, and translations. Invalid imports leave the current valid building and its state intact.
