# Smart Escape

Browser-only evacuation route simulator for the **Smart Escape practice challenge**. This repository is practice, created before the official contest. Do not reuse its project code as a fresh contest submission.

## Run and verify

Requires Node.js 20 or later. No packages need installing.

```powershell
npm run dev
npm test
npm run build
```

Open http://127.0.0.1:5173. Choose **Load sample**, then select **R1**. To import another dataset, use **Import building**. Build output is in `dist/`; publish that folder to a static HTTPS host. The deployed app has no server, database, external runtime API, or credentials. All imported files stay in the browser.

## Parallel Puku sessions

Open two terminals:

```powershell
# Terminal 1
Set-Location 'C:\Users\Abdullah Alif\Desktop\vibecode\puku1'
puku-cli
```

```powershell
# Terminal 2
Set-Location 'C:\Users\Abdullah Alif\Desktop\vibecode\puku2'
puku-cli
```

Paste each folder's START_HERE.md prompt. Puku 1 owns routing/validation. Puku 2 owns the map/CSS. Codex owns integration and Git. Both folders are inside one repository; do not let Puku sessions run Git mutations. The initial baseline already works, so each session can review and improve its part independently.

See `docs/PLAN.md`, `docs/CONTRACT.md` and `AGENTS.md` for requirements, interfaces and file ownership.

## Features

- Validated local JSON import and supplied sample building.
- SVG map with supplied coordinates, distinct node types and corridor costs.
- Minimum-cost undirected routing, with exact exit and path tie-breaking.
- Block/unblock rooms, junctions and corridors; close/reopen exits.
- Immediate rerouting, blocked-start and no-route statuses, and reset to imported initial state.
- English/Bangla controls, errors, statuses and instructions.
- Keyboard controls, reduced-motion support, responsive layout and brief route transitions.

Optional extensions implemented: keyboard access and reduced-motion support. Alternative routes, PNG export and saved progress are not implemented.

## Published sample checks

| Scenario | Expected |
| --- | --- |
| R1 baseline | R1 → C1 → C2 → E1, cost 7 |
| R1 with C2 blocked | R1 → C1 → C3 → C4 → E2, cost 11 |
| E1 and E2 closed | No route available |
| R2 baseline | R2 → C3 → C4 → E2, cost 7 |
| Selected R1 then blocked | Starting location blocked |

Screenshots: [baseline](screenshots/baseline.png), [C2 reroute](screenshots/reroute-c2.png), and [Bangla mobile view](screenshots/bangla-mobile.png). Tests also cover synthetic edge cases for routing and validation; no personal or private data is used.

An optional development-only browser acceptance script is available as `npm run check:browser`. It requires Playwright and installed Chrome; neither is shipped to the live app. Set `SMART_ESCAPE_PLAYWRIGHT` to an existing Playwright module path when using a bundled runtime. Set `SMART_ESCAPE_URL` to test a public deployment rather than the local development server. Actual results are saved in `screenshots/browser-results.json`.

For restricted environments where Node cannot launch test workers, Node 22+ can run `node --test --test-isolation=none puku1/engine.test.js`. This runs the same assertions in the current process; it does not bypass failing tests.

## Deployment

Railway configuration is included for standard Caddy static-file hosting. Build tools run only in the image's build stage; the deployed image serves the runtime assets and does not run the development Node server. No database or volume is used. See `docs/DEPLOYMENT.md` for setup and verification.

## Submission information

- Name: Abdullah Alif (confirm official spelling before submission).
- Registration number: not supplied.
- Public HTTPS live link: https://smart-escape-practice-production.up.railway.app
- AI tools used: Codex and two parallel Puku CLI sessions, with separate ownership for engine, map and integration work.
- Useful prompt: “Build Smart Escape as a browser-only bilingual simulator with strict schema validation, undirected minimum-cost routing, exact exit/path tie-breaking, immediate hazard updates and reset to imported initial state. Separate pure engine, SVG map and integration modules, then verify the five official sample cases and unseen-graph edge cases.”
- Known limitations: crowded layouts/long map labels need further review; registration number is not supplied. Input files are limited to 2 MB and costs must remain within JavaScript's safe integer range. Railway availability depends on remaining trial credits.

Educational simulation only; not a certified real-world evacuation planning tool.

## License

MIT. Supplied sample data remains attributed to AI DevFest's Smart Escape practice materials.
