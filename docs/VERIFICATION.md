# Verification evidence

## Reviewed integrated version

Desktop Codex independently ran the following checks against the integrated source on 5 October 2026. All passed:

| Check | Count | Evidence |
| --- | ---: | --- |
| Engine and browser-storage unit tests | 38 | puku1/engine.test.js and puku1/session.test.js |
| Browser acceptance including all five sample scenarios | 17 | screenshots/browser-results.json |
| Map keyboard focus, corridor costs, extreme finite coordinates | 6 | screenshots/map-results.json |
| Actual PNG downloads, signature/dimensions, Bangla and preserved route | 5 | screenshots/export-results.json |
| Saved progress, reload, original reset state, corruption and denied storage | 9 | screenshots/session-results.json |
| Mobile scrolling, overflow and actual keyboard-focus colors | 14 | screenshots/mobile-results.json |

Engine tests include an independent exhaustive simple-path oracle across 80 deterministic small graphs. Invalid imports and invalid saved snapshots preserve the current simulation. Closed exits are excluded as intermediate nodes. The PNG was downloaded, saved and checked, not only previewed. The mobile script uses the bundled Playwright path and installed Chrome; Desktop corrected its import/launcher and waits for the existing focus transition before reading final colors.

The static build succeeds and contains exactly ten allowlisted runtime assets. Node development tools, tests and documentation are excluded from the deployed image. The local development server was restarted to load its current SVG MIME support.

## Public release

Live HTTPS: https://smart-escape-practice-production.up.railway.app

The first deployment passed its original 15 acceptance checks and eight-asset content comparison. This is historical evidence only. The integrated release succeeded on Railway as deployment cc9e6432-83c5-4546-b77e-d9958fe00bf8, from source commit 0601c5e3aa5dd2681a3c117a40c0f48aa0e00785. All 51 browser assertions above then passed against the public HTTPS URL. All ten runtime files match the reviewed local build byte-for-byte, and five development-only paths return HTTP 404. Standard npm test passed all 38 assertions and npm run build succeeded. The subsequent evidence-only commit changes documentation and screenshots, with identical deployed app assets. docs/DEPLOYMENT_VERIFICATION.json records SHA-256 agreement between the public runtime assets and the local build, plus absent development-only paths.

## Practical limits

Tests establish observed behavior, not exhaustive correctness or certified evacuation planning. Supplied coincident coordinates and exceptionally long labels may overlap. Mobile maps use native horizontal scrolling. Progress is local to the current browser and site origin and requires an explicit Save/Restore action. Costs must be safe integers and files below 2 MB. Trial-hosting lifetime depends on actual Railway usage. The mock form has not been submitted by Codex.
