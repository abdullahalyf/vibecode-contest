# Smart Escape practice submission values

Copy the four values below into the mock submission portal. This repository is a practice project created before the official contest; it is not eligible as a fresh official-contest entry.

## Project title

Smart Escape — Interactive Evacuation Route Simulator

## Description / abstract

Smart Escape is a browser-based educational evacuation route simulator in English and Bangla. Users import a building JSON file, choose a room or junction, and view a minimum-cost route to an open exit using corridor weights. Blocking locations or corridors and closing exits updates the route immediately. The app validates input, reports blocked starts and unavailable routes, and resets hazards to the imported initial state. Imported data and routing calculations stay in the browser.

## Live demo link

https://smart-escape-practice-production.up.railway.app

## GitHub repository link

https://github.com/abdullahalyf/vibecode-contest

## Final delivery handoff to Desktop Codex

- Submission title, concise abstract and both supplied links are ready to copy. Links were not reverified during this documentation review.
- The judge guide now describes repeated candidate sorting and path copying, removes the unsupported `O(V² + E)`/operation-count claims, and states cost → exit ID → node-ID sequence priority with ordinal UTF-16 code-unit comparisons.
- Existing evidence in `docs/VERIFICATION.md` describes the first public deployment. The current `screenshots/browser-results.json` records 17 checks against the local development URL; it does not establish final public-deployment verification. No tests, build or browser checks were run in this documentation round.
- Confirm the final public build matches the final pushed commit and record its hash and deployment ID. Include `src/export.js` in the static build and public-asset verification if PNG export ships.
- Review README feature metadata: the reviewed README still says PNG export is not implemented. Update it only after confirming the delivered feature. Final screenshot review belongs to Desktop Codex.
- Required screenshots: `screenshots/baseline.png` and `screenshots/reroute-c2.png`; optional Bangla mobile evidence: `screenshots/bangla-mobile.png`.
- Confirm full-name spelling and obtain the registration number if the form requests them; neither should be invented.

The supplied challenge requires identity, repository URL, final commit ID and a public HTTPS live link, plus source, README, MIT license and baseline/reroute screenshots in the repository. The portal screenshot shows title, abstract and links but does not establish all form fields; follow the actual mock form. This review does not certify official-contest eligibility or suitability for real evacuation planning.
