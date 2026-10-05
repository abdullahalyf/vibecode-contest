# Active Puku 2 implementation task

The human user explicitly asked Codex to give stopped workers work immediately, then continue delivery. This is the next authorized implementation round for Puku 2, superseding the prior planning-only round.

Read the local CONTRACT.md and current map.js/styles.css. Spend at most 8 minutes implementing only:

1. Stable `data-focus="map-node:ID"` and `data-focus="map-edge:ID"` attributes on SVG buttons. Root app focus restoration already consumes those identifiers. Keep all corridor costs visible, Enter/Space behavior and normal Tab navigation.
2. Clearly visible `:focus-visible` styling for SVG node and corridor groups through their shapes/lines. Respect reduced motion.
3. Safe uniform coordinate normalization for every finite numeric x/y, including opposite values near +/-Number.MAX_VALUE. Normalize all x/y by a shared maximum absolute magnitude before subtracting extrema so subtraction cannot overflow, then compute a uniform display scale. Handle coincident coordinates and zero spans. Preserve supplied relative positions and the renderer API.

Edit only map.js, styles.css and REPORT.md. Do not touch Puku 1 tests, application integration, dependency/package files, Git, or patch.cjs. Do not add gestures, roving focus, hidden cost badges, backend services or another live region. No new translation keys are needed.

Finish by reporting exactly what changed. Say browser tests were not run by you; Desktop Codex will run scripts/map-check.mjs and the full browser suite. Work now rather than asking for another planning/permission round within this scope.
