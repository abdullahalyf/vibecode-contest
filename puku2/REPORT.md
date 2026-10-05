# Puku 2 — planning notes

Scope of this folder: `map.js` (SVG renderer) and `styles.css` only. Codex owns `src/`, contracts, i18n keys, routing and Git.

## Baseline review

- Renderer is DOM/SVG only and stateless. It draws nodes, corridors, route highlight, blocked/closed state, cost badges, and a hazard × on every unavailable node.
- Keyboard activation is wired (Enter / Space) on every node and corridor, and both carry a localized `aria-label` covering type, cost, and current toggle verb (`block` / `unblock` / `close` / `reopen` / `selectStart`).
- Layout uses a uniform scale + translation so supplied coordinates are preserved regardless of input range.
- CSS uses a 1280-px workspace, a `1fr / 300px` grid that collapses at 950 px and 720 px, and `prefers-reduced-motion` strips transitions.
- Route highlight reuses the route corridor's stroke colour and a short fade-in animation (suppressed for reduced motion).

## Round 3 implementation — focus identity, visible focus, overflow-safe coordinates

This round is scoped strictly to the three asks:

1. Stable `data-focus` identifiers on every node and corridor SVG group, so the
   root app's focus-restoration logic can address them.
2. Visible `:focus-visible` styling on SVG groups, carried by their shapes and
   corridor lines (not the default outline ring, which is hard to see on small
   SVG circles), with reduced-motion honoured.
3. Overflow-safe uniform coordinate normalization that handles every finite
   x / y, including opposite signs near `Number.MAX_VALUE`, coincident
   coordinates, and zero spans. The renderer API and supplied relative
   positions are preserved.

### Files touched

- `puku2/map.js` — added a `normalize()` helper, attached `data-focus` to both
  the corridor and node `<g>` elements, and rewrote the top of `renderMap` to
  derive width / height / positions from the normalized space.
- `puku2/styles.css` — added a small `:focus-visible` block for `.location`
  (highlights the `.node-shape`) and `.corridor` (highlights the
  `.corridor-line`). The underlying `transition` rules already strip under
  `prefers-reduced-motion`, and the new rules do not introduce any new motion.

### What stayed the same

- `renderMap` API (`container, { building, state, startId, route, mode, t, onNode, onEdge }`).
- All class names used by `src/app.js`.
- All corridor costs remain visible at all times (no hidden badges).
- Enter / Space activation, the existing `keyAction` helper, and the existing
  `tabindex=0` on every SVG group (full Tab navigation across the map).
- No new translation keys; the existing `aria-label` shape is unchanged.
- No gestures, roving focus, pan/zoom, additional live region, or backend.

### Coordinate normalization details (Round 3a — divide-before-subtract)

The first draft of Round 3 normalized the origin to `(-maxAbs, -maxAbs)` and
multiplied by `680 / (2 * maxAbs)`. The browser map-check still produced
`NaN` / `Infinity` in the SVG `viewBox`, `width`, `height`, edge endpoints
and node `transform` for inputs at `±Number.MAX_VALUE`. Root cause:
`2 * maxAbs` and `n.x - (-maxAbs)` can overflow because
`Number.MAX_VALUE * 2 > Number.MAX_VALUE`. Merely naming an origin
normalized does not normalize its numeric magnitude.

The arithmetic order is now:

1. **Shared magnitude** = `max(|x|, |y|)` across every finite node. Use `1`
   when the magnitude is `0` so the next division is safe.
2. **Divide each x and y by magnitude first.** Divided coordinates are
   bounded in `[-1, 1]`. Every subtraction from here is bounded by `2`.
3. **Compute min / max / spans from the divided coordinates**, not the
   originals. `spanX` and `spanY` are bounded by `2`.
4. `extent = max(spanX, spanY)`, or `1` if both spans are zero.
5. **Divide by extent BEFORE multiplying by 680.** Positions are
   `100 + ((dividedX - minX) / extent) * 680`. The product is in
   `[-680, 680]` and never overflows.
6. Width and height track the real input rectangle:
   `width = max(200, 200 + (spanX / extent) * 680)`,
   `height = max(300, 200 + (spanY / extent) * 680)`. Division by `extent`
   happens before multiplication by 680, so `spanX` and `spanY` (bounded by
   2) can never overflow the width / height either.

Edge cases:

- **Coincident coords / zero magnitude.** `magnitude = 1`, every divided
  coordinate is `0`, `spanX = spanY = 0`, `extent = 1`. Positions all sit
  at `(100, 100)`. Width = `200`, height = `300`. No `NaN`, no division
  by zero.
- **Empty node list.** Returns `{ positions: new Map(), width: 200, height: 300 }`.
  The renderer still emits a valid empty SVG.

Trace for an extreme case (`x = ±Number.MAX_VALUE`, `y = 0`):

- `magnitude = Number.MAX_VALUE`.
- `divided = [-1, 0]` and `[1, 0]`.
- `spanX = 2, spanY = 0, extent = 2`.
- Positions: `100 + (0..2)/2 * 680` → `(100, 100)` and `(780, 100)`.
- Width: `max(200, 200 + 2/2 * 680) = 880`. Height: same = `880`.

Every multiplication is preceded by a division. All arithmetic is bounded
by `2`, so opposite maximal finite values are safe.

### Focus identity details

Each SVG group now carries a stable, identifier-shaped attribute:

- `<g class="corridor ..." data-focus="map-edge:L01" ...>`
- `<g class="location ..." data-focus="map-node:R1" ...>`

The existing `aria-label` and class-name keys are unchanged, so the root
app's `data-focus` lookup can address nodes and corridors without inspecting
SVG hierarchy or text content. IDs and labels remain untrusted text — they
only appear inside `aria-label` and `<title>`, never inside the data-focus
prefix that Codex controls.

### Focus styling details

```css
.location:focus-visible { outline:none; }
.location:focus-visible .node-shape { stroke:var(--ink); stroke-width:4; fill:#fff8d6; }
.corridor:focus-visible { outline:none; }
.corridor:focus-visible .corridor-line { stroke:#b67d20; stroke-width:8; stroke-linecap:round; }
```

- The default outline ring (`outline:3px solid #b67d20; outline-offset:4px;`)
  is suppressed on SVG groups so the highlight lives on the shape itself
  rather than around it.
- The focused node's `.node-shape` switches to an ink-coloured stroke at 4 px
  with a warm fill, unmistakable against the paper background even at small
  sizes.
- The focused corridor's `.corridor-line` thickens to 8 px in the brand
  accent colour with a rounded cap, lifting the stroke above the default
  5 px line.
- The existing `transition` on `.node-shape` (fill / stroke, 180 ms) and on
  `.corridor-line` (stroke, 200 ms) is the only motion involved, and it is
  already stripped globally by `@media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none!important; transition:none!important; } }`.
  No new transitions or animations are introduced.

### Verification status

Browser tests were not run by me in this round. The previous browser
failure was in `scripts/map-check.mjs` for `x = ±Number.MAX_VALUE`: the SVG
contained `NaN` / `Infinity` in `viewBox`, `width`, `height`, edge
endpoints and node `transform` attributes. The root cause was the Round 3
normalization arithmetic, not the focus attribute / style work, which passed
real browser checks.

Round 3a replaces the `normalize()` helper so every multiplication is
preceded by a division, bounding all arithmetic by 2. The expected
re-test by Desktop Codex should show finite values for
`±Number.MAX_VALUE` inputs, with the same focus attributes and visible
focus styling as Round 3.

### Round 3b — focused selected-start text contrast

A follow-up defect: when the selected start (`.location.is-start`) received
keyboard focus, the default focus-visible rule applied the pale `#fff8d6`
fill to `.node-shape` while the pre-existing `.location.is-start .node-id`
rule continued to paint the label white, producing white text on a pale
background. Correct the selected-start focused text using a higher-specificity
selector.

Added to `styles.css` directly after the focus-visible block:

```css
/* Selected start + keyboard focus: the default `.is-start .node-id` rule
  paints the label white, which would clash with the pale focus fill on the
  shape. Outrank those rules so the focused start keeps the warm pale fill
  AND the label stays dark. The `:focus-visible` triple-class selector beats
  both `.location:focus-visible .node-shape` and `.location.is-start .node-id`. */
.location.is-start:focus-visible .node-shape { fill:#fff8d6; stroke:var(--ink); stroke-width:4; }
.location.is-start:focus-visible .node-id { fill:var(--ink); }
```

- `.location.is-start:focus-visible .node-shape` has specificity (0,0,3,1)
  and outranks both `.location:focus-visible .node-shape` and
  `.location.is-start .node-shape` (both 0,0,2,1), so the pale focus fill is
  restored for the focused start instead of the dark ink start fill. The
  focused-start stroke stays ink-coloured and 4 px wide, keeping the focus
  ring visible against the dark start identity.
- `.location.is-start:focus-visible .node-id` (0,0,3,1) outranks
  `.location.is-start .node-id` (0,0,2,1), so the label falls back to the
  default dark ink. Result: dark ink text on the pale `#fff8d6` shape, with
  adequate contrast for both themes.
- No motion, animation, or transition is introduced. The existing
  `prefers-reduced-motion` block continues to strip motion globally.
- No change to `map.js`, contracts, engine, tests, scripts, Git, or
  deployment.

Verification should confirm:
- Default start (not focused): dark ink fill, white label — unchanged.
- Default node (not start, focused): white fill, dark label — unchanged.
- Selected start (focused): pale `#fff8d6` fill, dark ink label, ink stroke
  at 4 px — fixed.

### Open coordination notes

- No translation keys added; nothing for `src/i18n.js` to do.
- No changes to `src/app.js` are required to consume `data-focus`; the root
  app already consumes that identifier shape.
- Puku 1 engine tests remain untouched (last round shipped 19/19 passing).

## Round 4 — mobile map readability

The 680-unit SVG was shrinking to roughly 360 px on a 390 px viewport,
compressing node IDs, labels and cost badges below a readable size. The
existing `.map-canvas` already has `overflow:auto`, so the fix is to
give the SVG a minimum width inside that scroll container rather than
letting it shrink to the viewport.

### Change (styles.css only)

Inside `@media (max-width:720px)`:

- `body { overflow-x:hidden; }` — guarantees the page itself never
  scrolls horizontally, so a wider SVG header can't push the workspace
  around.
- `.map-canvas` — switched `padding` to `8px 0 8px 8px` and
  `justify-content:flex-start` so the SVG hugs the left edge of the
  scroll container and the user lands at the start of the map on first
  paint. Added `-webkit-overflow-scrolling:touch` for momentum on iOS.
- `.map-canvas svg` — `width:auto; min-width:560px; max-width:none;` so
  the SVG keeps its native size (no label shrink) and scrolls
  natively. The desktop rule `width:100%` is overridden only inside this
  media query, so the workspace-grid, conditions grid and desktop
  layouts are untouched.

The 560 px minimum matches the typical viewport where labels become
unreadable (around 390 px). On wider mobile devices (e.g. iPad portrait
at 768 px) the `<=720px` rule does not apply and the SVG fills the
panel as before.

### Preserved

- Every cost badge, hazard ×, node label and route highlight is still
  drawn by the renderer; no labels hidden, no `visibility:hidden` /
  `opacity:0` / `display:none` introduced.
- `:focus-visible` styling on `.location` and `.corridor` (Round 3) is
  unchanged; keyboard tabbing through every SVG group still works.
- `prefers-reduced-motion:reduce` still strips transitions and
  animations globally.
- Desktop layout, the 950 px breakpoint, the workspace grid, the
  conditions grid, the legend, the toolbar, the route panel, the footer,
  the empty state and the error banner — unchanged.

### Actual checks

- Confirmed only `styles.css` was modified. `map.js`, `src/app.js`,
  `package.json`, `data/building.json` are byte-identical to Round 3.
- Diff size: one media block (`@media (max-width:720px)`) expanded
  onto multiple lines, three new rules (`body`, `.map-canvas`,
  `.map-canvas svg`) and a comment added; nothing else touched.
- Parser check by reading the file: `@media (max-width:950px)` and
  `@media (prefers-reduced-motion:reduce)` rules are intact at lines
  137 and 148, the new block lives between them. No stray braces, no
  dangling selectors.
- No browser test was run by Puku 2 in this round (same as Round 3).
  Expected behaviour: on a 390 px viewport the map panel offers
  horizontal scrolling via `.map-canvas`'s `overflow:auto`; the
  workspace, conditions grid, route panel, header and footer never
  overflow horizontally; native touch scrolling pans the SVG on
  touch devices.
- Engine tests still 19/19 (Puku 1 untouched).
- No git mutations; no dependency or package changes.

### Round 4b — mobile-check.mjs (development-only)

To back the Round 4 styles.css change with a real browser check, Puku 2
added a single new file: `puku2/mobile-check.mjs`. It is structured after
`../scripts/map-check.mjs` (Chromium headless, `SMART_ESCAPE_URL` env,
pageerror/console capture, screenshots + JSON output) and runs only on
Desktop — Puku 2 does not execute it.

The script uses Playwright via `process.env.SMART_ESCAPE_PLAYWRIGHT`
(falling back to `'playwright'`) at a 390×844 mobile viewport. It loads
the sample data set, picks `R1` from `.start-select`, then asserts:

- `svg.clientWidth >= 560` (the new min-width on `.map-canvas svg`)
- `.map-canvas.scrollWidth > .map-canvas.clientWidth` (native scroll exists)
- `document.documentElement.scrollWidth <= window.innerWidth` (page never
  overflows horizontally)
- After setting `scrollLeft = 200`, `.map-canvas.scrollLeft > 0` (native
  horizontal scrolling actually responds)
- After keyboard-tabbing to the `.location[data-focus="map-node:R1"]`
  group, the focused `.node-shape` fill matches `rgb(255, 248, 214)` and
  the `.node-id` label fill matches `rgb(20, 43, 40)` (dark ink on pale),
  and is explicitly not `rgb(255, 255, 255)` — guarding the Round 3b
  contrast fix on a 390 px viewport
- After switching the language toggle to Bangla, the same SVG
  min-width and `scrollLeft > 0` invariants still hold

It writes `screenshots/mobile-initial.png`, `screenshots/mobile-final.png`
and `screenshots/mobile-results.json`. It does not change `styles.css`,
`map.js`, `src/app.js`, contracts, i18n, `package.json`, Git state or any
file outside `puku2/`.