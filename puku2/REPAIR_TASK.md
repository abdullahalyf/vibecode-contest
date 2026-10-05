# Fix the failed coordinate regression now

Your keyboard changes passed the real browser checks. Your normalization arithmetic failed `scripts/map-check.mjs` for x/y = +/-Number.MAX_VALUE: the SVG contains NaN/Infinity in width, height, endpoints, transform and viewBox. This is a demonstrated defect, not a hypothetical concern.

Root cause: `2 * maxAbs` and `n.x - (-maxAbs)` can overflow. Merely naming an origin normalized does not normalize its numeric magnitude.

Spend at most 3 minutes repairing only map.js and updating REPORT.md. Keep the successful focus attributes/styles and API. Use this arithmetic order:

1. Find shared magnitude = max(abs(x), abs(y)) over all nodes; use 1 only if magnitude is zero.
2. FIRST divide each x and y by magnitude. The resulting coordinates are bounded in [-1, 1].
3. Compute min/max and spans from THOSE divided coordinates, not original coordinates. Let extent = max(spanX, spanY), or 1 when both spans are zero.
4. Compute positions as `100 + ((normalizedX - minNormalizedX) / extent) * 680` (same for y). Divide by extent BEFORE multiplying by 680. Do not derive a scale factor `680/extent`, which can itself overflow for a tiny extent.
5. Width = `200 + (spanX / extent) * 680`, with an appropriate minimum; height similarly with minimum 300. Return positions and dimensions from the helper. This fits the actual input bounds rather than a huge origin-based square.

All arithmetic preceding the division is bounded by 2, so opposite maximal finite values are safe. Sample input should still fill its original rectangular view while preserving one uniform scale and a 100-pixel gutter.

Do not run Git or modify other files. Report the previous browser failure accurately. Desktop Codex will rerun tests after you finish. Do not claim this was browser-verified by you.
