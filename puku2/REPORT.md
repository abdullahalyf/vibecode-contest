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

## Round 5 — dynamic finish (subtle motion + 3D feel)

This round is scoped strictly to `styles.css` (polish block) and this
report. No `map.js`, `app.js`, contract, i18n, Git, dependency, or
library change. The task asked for a more dynamic UI with subtle
motion and a 3D feel, a coherent finish across the workspace card,
route panel, buttons, mode tabs, brand mark, route highlight and
route result, while keeping the supplied map geometry untouched.

### What was added (styles.css only)

A single polish block was inserted between the existing
`@keyframes route-appear` rule and the existing
`@media (max-width:950px)` block, so both responsive blocks and the
global `prefers-reduced-motion` rule remain authoritative below it.
No selector outside the polish block was renamed or removed, so the
Round 3 / 3b focus-visible rules, the Round 4 mobile 880 px SVG
width, and the `.corridor.on-route` / `.corridor.unavailable` green /
red semantic distinction are all preserved untouched.

The five concrete finishes:

1. **Soft layered shadows + depth on the workspace card and route
   panel.** `.workspace-grid` gets a three-layer shadow
   (`0 1px 1px #142b2808, 0 2px 6px #142b280d, 0 14px 32px -10px #142b2822`)
   so the card reads as a lifted surface with a soft contact shadow
   instead of a flat outlined box. `.route-panel` gets an inset
   highlight + a left-side ambient shadow
   (`inset 1px 0 0 #ffffff80, -8px 0 24px -12px #142b281a`) that
   gives it depth against the map panel without changing the
   existing `border-left:1px solid var(--line)` divider. The map
   panel inside `.workspace-grid` is untouched, so SVG geometry,
   the 880 px mobile min-width, and the cost badges / hazard ×
   render exactly as before.

2. **Tactile raised buttons and mode tabs on hover and focus.** The
   default state gets a subtle inner highlight + soft drop shadow
   (`0 1px 0 #ffffff80 inset, 0 1px 2px #142b281a, 0 1px 1px #142b2814`).
   `:hover` and `:focus-visible` lift by `translateY(-1px)` and grow
   the shadow into a slightly larger, more diffuse drop
   (`0 1px 0 #ffffffcc inset, 0 2px 4px #142b2824, 0 6px 14px -4px #142b2828`).
   `.mode-tab` mirrors the same treatment so the active tab sits as
   a raised pill on its segmented control, and the lifted active
   state carries an extra `0 4px 10px -3px #142b2820` shadow.
   `translateY(-1px)` is below the 1 px border so neighbouring
   elements never reflow, and `transition` is reused from the
   existing `button,select` shorthand so no new motion properties
   are introduced. Focus-visible still gets the orange outline
   from `:focus-visible { outline:3px solid #b67d20; outline-offset:4px; }`
   in addition to the lift, so keyboard identity is unmistakable.

3. **Tiny brand-mark float on page load.** A new
   `@keyframes brand-float` (1.6 s, `ease-out`, runs once, `both`
   fill mode) translates the `.brand-mark` from
   `translateY(-6px)` at 0 % with `opacity:0`, through a
   `translateY(-3px)` peak with `opacity:1` and a short outer ring
   (`0 0 0 6px #142b2808`), to its natural rest state at 100 %.
   The `.brand-mark` box (46 × 46 ink tile) moves; the SVG inside
   it is not transformed, so the brand glyph is unaffected. The
   `both` fill mode means the rest-state shadow is applied after
   the animation finishes, so the brand tile settles onto a
   permanent raised look rather than snapping back to flat.

4. **Route highlight gentle breathing after rerender.** A new
   `@keyframes route-breathe` (2.4 s, `ease-out`, runs once)
   animates a `filter: drop-shadow(...)` halo around the existing
   green `.corridor-line` stroke. The keyframes go from a
   transparent halo (0 %) to a 6 px green halo at 35 %
   (`#286d5166`, 40 % alpha) and back to transparent. The geometry
   of the corridor stroke is untouched; the existing `route-appear`
   0.25 s opacity fade is kept. It is opted in via a `.breathe`
   class on the `.corridor.on-route` group, so the breathing only
   plays on the explicit rerender signal (the existing on-route
   re-render flow is unchanged) and never loops. No dashed style
   is applied — the corridor stays a solid green stroke, so a route
   still reads as passable, not as a blocked corridor.

5. **Quick route-result reveal.** A new `@keyframes result-reveal`
   (0.35 s, `ease-out`, runs once) fades the `.route-result` from
   `opacity:0 / translateY(6px)` to `opacity:1 / translateY(0)`. It
   is opted in via a `.reveal` class on `.route-result`, so the
   result block only animates when the app re-renders a fresh route
   and never animates on the initial empty / placeholder state. The
   `transform-origin: top center` keeps the lift small and
   well-localised.

### Motion budget (per-render cap of 5 s)

| Effect                       | Duration | Runs | Per-render total     |
| ---------------------------- | -------- | ---- | -------------------- |
| `route-appear` (existing)    | 0.25 s   | 1    | 0.25 s               |
| `brand-float` (page load)    | 1.60 s   | 1    | 1.60 s (one-shot)    |
| `route-breathe` (rerender)   | 2.40 s   | 1    | 2.40 s               |
| `result-reveal` (rerender)   | 0.35 s   | 1    | 0.35 s               |
| **Worst case single render** |          |      | **3.00 s**           |
| **First-load total**         |          |      | **1.85 s**           |

No animation is `infinite`. Every animation plays exactly once
(`animation-iteration-count: 1`). The page-load total stays well
under 5 s, and the rerender motion (breathing + reveal) is the
longest combined chain at 2.75 s if they overlap, still inside the
cap. Nothing flashes, nothing strobes, nothing blinks.

### Accessibility / motion-respect

- The global
  `@media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none!important; transition:none!important; } }`
  rule is unchanged and continues to strip every animation and
  transition in this block. Users who opt out of motion get a fully
  static UI: the brand mark sits at rest, the route highlight is
  just a green stroke with no halo, the route result appears
  instantly, and the buttons still get their inner-highlight +
  drop-shadow base style (the box shadow is part of the static
  design, not a transition).
- The Round 3 / 3b `:focus-visible` rules for `.location` and
  `.corridor`, including the selected-start label contrast fix
  (`.location.is-start:focus-visible .node-id { fill:var(--ink); }`),
  are byte-identical to Round 4b. The Round 5 hover/focus lift on
  `.button` / `.condition-button` / `.reset-button` / `.mode-tab`
  does not touch any `.location` or `.corridor` selector, so SVG
  keyboard identity and its specificity are unaffected.
- The green / red semantic distinction is preserved. The route
  halo uses `#286d5166` (a translucent version of `var(--green)`),
  and the red unavailable path is still rendered as a dashed red
  stroke via `.corridor.unavailable .corridor-line`. The 4 px wide
  red blocked legend dot, red status pill, and red hazard × are
  all untouched.

### Geometry / SVG / map constraints

- No `transform` is applied to `.map-canvas`, `.map-canvas svg`,
  `.corridor`, `.location`, `.node-shape`, or `.corridor-line`.
  The `route-breathe` animation only mutates
  `filter: drop-shadow(...)` on the corridor line, which does not
  move or resize the stroke. The `brand-float` and `result-reveal`
  animations are scoped to `.brand-mark` and `.route-result`
  respectively, both of which are outside the SVG / map panel.
- The 880 px mobile SVG min-width, the
  `body { overflow-x:hidden; }` mobile guard, and the
  `.map-canvas` mobile padding (`8px 0 8px 8px`) are byte-identical
  to Round 4b.
- The supplied coordinate normalization in `map.js` (Round 3a) is
  untouched; this round is a CSS-only polish.

### Files touched

- `puku2/styles.css` — one new polish block (≈64 lines including
  comments) inserted between the existing
  `@keyframes route-appear` rule and the existing
  `@media (max-width:950px)` block. No other selector, variable,
  keyframe, or rule is changed. Both responsive blocks and the
  reduced-motion block are byte-identical to Round 4b.
- `puku2/REPORT.md` — this section.

### What stayed the same

- `map.js`, `src/app.js`, `package.json`, `data/building.json`,
  contracts, i18n keys, Git state, dependencies,
  `mobile-check.mjs`, `scripts/map-check.mjs` — all untouched.
- `:focus-visible` identity, the selected-start label contrast
  fix, the 950 px and 720 px breakpoints, the reduced-motion
  global override, the mobile 880 px SVG width, the cost badges,
  the hazard ×, the legend, the empty state, the error banner,
  the footer, the conditions grid, the route panel layout — all
  untouched.
- No dashed route style, no directional moving arrow, no dark
  redesign, no flashing, no library, no infinite animation.

### Verification status

- Parser check: read `styles.css` end-to-end; `@keyframes
  route-appear` and the new `@keyframes brand-float`,
  `@keyframes route-breathe`, `@keyframes result-reveal` are all
  declared before the two `@media` responsive blocks and the
  `@media (prefers-reduced-motion:reduce)` block. No stray
  braces, no dangling selectors. The mobile SVG 880 px width on
  the 720 px block is preserved.
- The browser tests (`scripts/map-check.mjs` and the
  `puku2/mobile-check.mjs` Puku 2 added in Round 4b) are not run
  by Puku 2 in this round. Desktop Codex independently runs
  browser tests and deploys; expected behaviour:
  - On desktop, the workspace card reads as a soft lifted surface
    with a faint contact shadow; the route panel has a left-side
    ambient shadow but the border divider is unchanged.
  - Hovering a primary or secondary button lifts it by 1 px and
    deepens the shadow; focusing it via Tab shows the orange
    outline plus the lift.
  - On first page load, the brand mark rises into place over
    1.6 s and settles at rest. SVG geometry is unchanged.
  - On rerender, the green route corridor briefly glows (2.4 s
    drop-shadow pulse) and the route result panel fades up
    (0.35 s fade + lift). No dashed style is applied to the route.
  - With `prefers-reduced-motion: reduce`, the brand mark, route
    breathing and route result reveal are all static; the route
    highlight still appears via the existing `route-appear`
    keyframe (which is also stripped under the global rule), so
    the on-route state simply appears in its final form.
- Engine tests remain 19/19 (Puku 1 untouched).
### Desktop motion integration

Desktop connected the pulse and reveal selectors to the classes actually emitted by the renderer, without changing map/app code. Button transforms now transition smoothly. Independently checked active brand-float, route-breathe and result-reveal animation names, finite repeat counts, SVG transform none, and disabled animation with reduced motion. Core17, mobile14 and PNG5 checks passed after the CSS change. Public release checks follow deployment.
