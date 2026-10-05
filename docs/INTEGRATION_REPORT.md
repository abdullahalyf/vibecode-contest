# Smart Escape PNG export — round 3

Implemented the single PNG-export bonus on 5 October 2026. Edited only `src/app.js`, `src/i18n.js`, new `src/export.js`, and this report.

## Desktop Codex handoff — required before the next build

**Add `src/export.js` to the explicit runtime asset list in `scripts/build.mjs`, and include `/src/export.js` in the public-asset/content-match verification.** `app.js` now imports `./export.js`; omitting that file from delivery will prevent the app module from loading. This session did not edit the build script or deployment files, run the build, or change Git. Desktop Codex owns those steps and final verification.

## Implementation

- Added a button using the existing `.button` style, visible once a building is loaded: `Download map PNG` / `মানচিত্রের PNG ডাউনলোড`. It has stable `data-focus="export-map"`, localized preparing/download-started feedback, and a guard against concurrent exports.
- `downloadMapPng(svg)` snapshots the currently rendered SVG and copies computed SVG paint and typography into its clone. Localizes pattern fragment references, preserves labels through XML serialization, includes bounds/padding to reduce label clipping, and removes animation from the snapshot. Canvas background matches the map; output is up to 3× resolution with a 4096-pixel maximum dimension.
- Blob URLs, SVG image decoding and PNG canvas encoding run entirely in the browser. Download filename is `smart-escape-map.png`; transient elements and object URLs are cleaned up. No services, dependencies, keys or map/engine interface changes.
- Export failures use their own translated heading/message in the existing alert banner. A successful retry clears a previous export error. Import-error wording remains unchanged. Export does not modify the selected start, hazard arrays or route.

## Actual checks

- `node --check` passed separately for `src/export.js`, `src/app.js` and `src/i18n.js` (all exit 0).
- Real Chrome page at `http://127.0.0.1:5173/`: invoked the download button and the actual browser anchor click, inspected the generated blob and decoded the PNG using the browser image decoder. Baseline PNG: **212,885 bytes**, MIME `image/png`, **2784 × 1380**, correct PNG signature `137 80 78 71 13 10 26 10`; route-colour pixels were present. R1 remained cost 7 and button focus was restored.
- Bangla button, preparing/success feedback and failure heading/message were exercised. With C2 blocked and R1 explicitly selected, the reroute export produced **220,563 bytes** at **2784 × 1380**; before/after start was R1, cost 11, sequence R1 → C1 → C3 → C4 → E2, and focus returned to `export-map`.
- Visually inspected the decoded exported PNG through an in-memory browser preview. Node labels, all corridor cost badges, route colour, blocked-node cross and dashed unavailable corridors were visible and readable on the sample. No screenshot artifact was written by this session.
- Forced canvas-context failure in the browser: localized Bangla export alert appeared, button focus returned, the route remained available, and dismissal removed the banner. This is a real failure-path check, not a claim that browser download permissions can always be detected.
- Browser tools rejected navigation to `chrome://downloads/`, and no matching PNG appeared in the local user's Downloads folder. Therefore the PNG bytes/decoding and actual download initiation are verified, but the browser-managed saved-file location/completion is not independently verified here. Desktop Codex should verify the download event/file in its final browser pass.

Limitations: export is a map snapshot, not a route report or legend. Existing overlapping labels remain overlapping; resolution does not solve dense-map layout. Only Chromium was exercised. Mandatory behavior is unchanged; final build/public delivery and Puku 2's repaired-coordinate checks remain with their owners.

---

# Historical integration implementation — round 2

Completed the assigned integration changes on 5 October 2026. This section supersedes the round-1 next-task status below; the earlier review remains as historical evidence.

## Changes in this round

- `src/i18n.js`: added `practiceFooter` in English (`SMART ESCAPE / PRACTICE`) and Bangla (`স্মার্ট এস্কেপ / অনুশীলন`).
- `src/app.js`: footer now renders that translation through `textContent`.
- Added distinct stable `data-focus` identifiers for the header import button (`import-header`), empty-state import button (`import-empty`) and error dismiss button (`dismiss-error`). Identifiers remain unchanged across language and status changes.
- When the focused dismiss button disappears after dismissal, focus returns to the header import button. The same fallback handles the empty-state import button disappearing after a successful import. Restoration continues to use `preventScroll: true`.
- Existing focus restoration consumes Puku 2's stable map identifiers through the existing `[data-focus]` lookup. No renderer arguments, exports, engine behavior or dataset labels were changed. The legacy accessible-label fallback remains for map elements without those identifiers.

Only `src/app.js`, `src/i18n.js` and this report were edited. No scripts, screenshots, engine/map/CSS files, README, Railway files, dependencies, Git state or deployment were changed. No build was run in this round because generated delivery output belongs to Desktop Codex.

## Actual checks in this round

- `node --check src/app.js`: passed, exit 0.
- `node --check src/i18n.js`: passed, exit 0.
- In-memory dictionary verification through `node --input-type=module`: passed, exit 0. Both dictionaries have the same **78 keys**, each with non-empty text. **29** selected status, description, import-error, notice, dismiss and footer translations differ between English and Bangla; the Bangla footer contains Bangla characters. These checks establish key coverage, not a linguistic review of every translation.
- In-memory app integration verification through `node --input-type=module`: passed, exit 0, **18 checks**. Exercised footer rendering in both languages; select-start, route-ready, blocked-start and no-route titles in both languages; blocked/no-route descriptions; import/dismiss focus across replacement; fallback after dismissal and successful import; language-button focus; repeated condition toggles; and consumption of a stable map-edge focus ID while its action label changes. Used the actual engine and translator with a small DOM/renderer stub, without writing a test or script file. This is not browser, native file-picker, CSS, SVG-renderer or screen-reader verification.
- Initial ad-hoc check attempts failed because of check-harness assumptions (a legitimate English value matching its key, PowerShell's piped Bangla literal encoding, VM parsing of `import.meta`, and a missing mock `lastChild`). The corrected checks above passed; none of those failures demonstrated an application defect.
- Read `screenshots/browser-results.json`: Desktop Codex's earlier run records **15 scenarios** with an empty error list, covering core routes, invalid-import preservation, non-empty reset, blocked selected start, Bangla failures, mobile overflow, untrusted text, condition focus, repeated local import and reduced motion. Read `docs/DELIVERY_STATUS.md` to respect current ownership. Those browser results predate this patch and are attributed to Desktop Codex; they were not rerun by this session.

## Handoff and remaining verification

The demonstrated footer and disappearing-control focus issues are fixed within the shared contract. Puku 2 still owns map focus identifiers and SVG focus styling; Puku 1 still owns engine regressions. Desktop Codex should include the localized footer and import/dismiss focus in its next browser pass, including native file-picker return focus and map keyboard toggles after Puku 2's patch. Screen-reader announcements remain unverified here. Do not add another live-region system under this deadline.

---

# Historical integration review — round 1

Planning review on 5 October 2026. This is the practice workspace, not an official contest entry. Only this report was edited; the requested build generated ignored `dist/` output. No implementation, dependency, interface, Git-history or deployment changes were made.

## Evidence and checks

Read `AGENTS.md`, `docs/CONTRACT.md`, `docs/PLAN.md`, `src/app.js`, `src/i18n.js`, both engine/map implementations, `package.json` and the build script.

- `npm test`: exit 1. Node's test runner could not spawn its worker (`spawn EPERM`); assertions did not run. This command did not pass.
- `node --test --test-isolation=none puku1/engine.test.js`: exit 0, **15 passed, 0 failed**. This workaround runs the existing suite in the current process without modifying the package script. It covers baseline costs, rerouting, closed exits, blocked start, weighted undirected routing, ties, reset, validation and a deterministic exhaustive-path oracle.
- `npm run build`: exit 0, reported `Static website built in dist/`. The script copies static assets; it does not verify browser behavior or syntax by bundling.
- No browser checks, screen-reader checks, screenshots or deployed-site checks were run this round. Engine test results do not prove DOM interactions.
- Puku 1's planning report was available; Puku 2's report was absent at the initial read. Continued without waiting. Puku 1 reports 18 existing behaviors, but the actual runner reports 15 tests; use the actual count.

## Integration findings and priorities

| Area | Current evidence | Remaining work |
| --- | --- | --- |
| Local file import — P0 verification | `File.text()` and JSON parsing feed `validateBuilding`; validation happens before replacement of the current building/state. File read, JSON, size and schema errors have messages. Import-version checks suppress stale completed reads. Imported strings use `textContent`; the HTML icon is a fixed literal. | In a browser, import a valid local file, then malformed JSON and invalid schema; confirm the original building, hazards, start and route remain intact. Check selecting the same file again and rapid successive imports. |
| Immediate hazards — P0 verification | Map callbacks and condition buttons call `toggle → update → findRoute → render`. Exit closure and corridor blocking are available in both modes; room/junction blocking uses hazard mode. Engine rerouting and closed-exit tests passed through the workaround. | Verify cost, route highlight and condition controls update together after each map/list action, without reimport. Demonstrate R1 cost 7, block C2 cost 11, close both exits no route. |
| Reset to imported initial_state — P0 verification | Reset calls `createState(building)`, clears import error and recomputes. The engine's reset/aliasing test passed. Reset retains the selected start; importing a new building clears it. | Import a fixture with all three non-empty hazard arrays; change each category and reset. Confirm exact original hazards and recalculated result, including when the retained start becomes blocked by reset. |
| Blocked start / no route — P0 verification | Blocking does not clear `startId`. The dropdown disables blocked choices but reapplies the selected ID. Separate status titles and descriptions exist for `start_blocked`, `no_route` and `select_start`; failed routes remove success details/highlights on render. Engine tests passed. | Browser-check that a selected disabled option remains visibly selected; blocking R1 must show its specific error rather than silently choosing another start. Unblocking must recover immediately. |
| Bilingual messages — P0 small fix + verification | Both dictionaries contain current principal controls, route statuses, import errors and every contracted validation code (with three application aliases). Dataset labels are preserved. UTF-8 reads show valid Bangla text; earlier default PowerShell decoding displayed mojibake. | Footer `SMART ESCAPE / PRACTICE` is hard-coded English in both languages. Localize it. Exercise errors/statuses in both languages and verify any Puku-requested keys exist in both dictionaries. |
| Keyboard continuity — P1 defect | Condition buttons, reset, mode tabs and language have stable `data-focus`. SVG focus is restored by its complete accessible label; block/unblock or close/reopen changes that label, so lookup can fail. Import/dismiss buttons have no stable focus identity. | Coordinate stable node/edge focus identifiers with Puku 2 and preserve them through re-render. Verify repeated Enter/Space toggles, visible focus and collapsed condition sections. Replacing live regions on every render also needs a browser/accessibility check; announcement failure is not established. |
| Map and mobile — P1 review | SVG uses supplied coordinates with a uniform transform and shows costs and unavailable endpoints. These findings are source inspection only. | Puku 2 should verify mobile/Bangla readability, focus and reduced motion. Finite coordinates with extreme opposite signs can overflow subtraction in the transform; report or fix within the existing map API if reproducible. Defer decorative redesign. |

No missing implementation of the five main flows was established by this source review. The largest gap is browser evidence across those flows, especially non-empty reset and blocked selected start.

## Contract answers for Puku 1

These are coordination answers, not contract changes:

- Read access to root guidance is permitted; ownership restricts edits. Read `../docs/CONTRACT.md` and `../AGENTS.md` before continuing.
- Keep the existing exports, arguments, statuses and `ValidationError.code`. No new metadata or codes are needed. Contracted codes are `object`, `building`, `nodes`, `edges`, `node`, `nodeId`, `categories`, `edge`, `edgeId`, `loop`, `pair`, `costRange`, `state`, `stateId`.
- State arrays contain string IDs, not node objects. Fresh copies of all three arrays satisfy reset isolation. Preserve non-mutation and fresh route arrays.
- Final tie order is cost, then exit ID, then lexicographic node-ID sequence for that exit. Compare elements with `<`/`>`; a strict prefix sorts before its longer sequence. The current implementation returns the shorter prefix first.
- Preserve JSON-encoded endpoint pairs; delimiter joining introduces ambiguity. No extra ID restriction or adjacency cache is needed. Do not spend time on microbenchmarks or speculative optimization.

## Remaining-time plan

Budget about 55 minutes after this round; later rounds require the user's instructions. Times below are elapsed from the next round, and each block has a hard stop.

| Minutes | Concrete outcome |
| --- | --- |
| 0–10 | Codex fixes the footer translation; Puku 1 adds only high-value missing regressions; Puku 2 fixes keyboard continuity and required map issues. Preserve interfaces and ownership. |
| 10–25 | Codex runs browser acceptance: valid/invalid imports, baseline/reroute, blocked start, both exits closed, and reset with all initial hazards. Check both languages and map/list agreement. |
| 25–35 | Fix only failures revealed by those scenarios. Check keyboard, narrow viewport and reduced motion. Integrate Puku reports and any translation keys. |
| 35–45 | Run relevant tests and build after changes; verify built static output. Capture baseline and C2 reroute screenshots; document actual results/limitations. |
| 45–55 | Buffer for one remaining mandatory defect and final handoff. Git or publication only under later round instructions; hosting is still unspecified. |

Defer optional features, new dependencies, framework conversion, architecture changes, algorithm optimization and visual redesign. A build alone is insufficient acceptance evidence.

## Next small tasks (not executed this round)

**Codex:** Localize the practice footer in `src/i18n.js` and consume the new key in `src/app.js`. Keep dataset text unchanged and verify the footer in both languages during the browser round.

**Prompt for Puku 1:**

> Read `../AGENTS.md` and `../docs/CONTRACT.md` (read access is allowed; edits remain limited to your owned files). Keep the current API and routing algorithm unless a regression demonstrates a defect. Spend at most 10 minutes adding focused missing tests for reset with all three non-empty initial-state arrays and mutation isolation, mixed-case exit-ID ties, and input/output non-mutation; inspect existing coverage first to avoid duplication. Final ties are cost → exit ID → element-wise node-ID sequence, shorter prefix first. State arrays hold string IDs; keep JSON-encoded endpoint pair keys. Run `npm test` from root; if worker spawn is denied, also run `node --test --test-isolation=none puku1/engine.test.js` and distinguish the results. Update `puku1/REPORT.md` with exact counts, changes and limitations. No Git/dependencies/interface changes.

**Prompt for Puku 2:**

> Read `../AGENTS.md` and `../docs/CONTRACT.md`. Spend at most 10 minutes on keyboard continuity in the existing map: add stable `data-focus` values to SVG node/edge buttons, prefixed separately (for example `map-node:` and `map-edge:` plus the raw ID). Codex's current restoration already uses `data-focus`; accessible labels must remain localized and describe the current action. Verify repeated Enter/Space hazard toggles retain focus, visible focus works at a narrow viewport, and reduced motion remains respected. Preserve coordinates, costs, existing classes and renderMap arguments. If time remains, check extreme finite-coordinate transform overflow; record unverified cases instead of claiming them passed. Edit only your owned map/styles/report files; document any new translation keys for Codex. No redesign, dependencies or Git changes.
