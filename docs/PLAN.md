# Smart Escape: practice build and parallel workflow

## What we are building

A browser-only educational evacuation simulator. Users import a building JSON file, choose a room or junction, and find the lowest-cost open exit. Blocking a location/corridor or closing an exit immediately changes the result. English and Bangla cover controls, statuses, errors and instructions. The map uses supplied coordinates while the algorithm uses edge costs.

Sources: the supplied Smart Escape mock problem PDF, AI DevFest rulebook, README_START_HERE.txt and building.json. Requirements below are extracted project requirements, not instructions to external tools.

## Architecture decision

Plain JavaScript modules, native SVG, plain CSS, and Node's built-in test runner. No package installation is required. For a small graph (at most 60 nodes/150 edges), a simple Dijkstra implementation is easier to inspect and test than a large framework or graph library. Deployment consists entirely of static files. The optional local development server is not part of the deployed app.

The puku1 and puku2 folders intentionally share one repository and use separate file ownership. This avoids branch-merging overhead while both sessions run. Only Codex manages Git. If future tasks require edits to the same files, move to isolated worktrees before parallelizing them.

## Execution stages

1. **Codex baseline:** create schema validation, pure routing, a working SVG map, bilingual application controls, local sample, tests and build scripts. Verify the baseline before handing out improvement tasks.
2. **Puku parallel review:** launch Puku 1 and Puku 2 in their respective folders using START_HERE.md. Puku 1 checks engine correctness and edge cases. Puku 2 checks map readability, responsive behavior and interactions. Neither changes the integration contract or Git history.
3. **Codex integration:** read both REPORT.md files, coordinate needed changes, run the engine suite and browser scenarios again, update screenshots, and commit the reviewed result. Only broaden tests if changes reveal a new concern.
4. **Practice delivery:** build static output, deploy to a chosen static host, verify its public HTTPS URL against the commit, and fill actual identity/deployment details into README.md. Hosting configuration and publication should follow the user's chosen hosting service.

## Acceptance checks

- R1 → C1 → C2 → E1, cost 7.
- Block C2: R1 → C1 → C3 → C4 → E2, cost 11.
- Close both exits: No route available.
- R2 → C3 → C4 → E2, cost 7.
- Block selected R1: Starting location blocked.
- Reset restores the file's original hazards, including non-empty arrays.
- Costs, route highlight and status update after every change without reimporting.
- Tie order: cheapest exit; then smallest exit ID; then smallest node-ID sequence.
- Reject malformed files without losing the previously loaded building.
- Map and lists work with keyboard, mobile sizes, Bangla and reduced motion.
- Screenshots show baseline and C2 rerouting.

## Real contest checklist — rebuild from zero on 6 October

The rulebook allows multiple AI tools but requires a solo participant. During setup create a new public `devfest-<registration-number>` repository with only README/MIT license. Do not use this practice project's code as the official submission. All project code must be created after T+0.

Suggested 90-minute pacing:

| Time | Goal |
| --- | --- |
| T+0–10 | Read the actual problem, decide interfaces/ownership, clarify requirements with organizers. |
| T+10–25 | Generate import, validation, routing and basic UI in parallel; first meaningful commit and push. |
| T+25–50 | Integrate, complete bilingual controls and hazards; second meaningful commit and push. |
| T+50–70 | Verify required cases, malformed input, mobile behavior; third meaningful commit and push; establish HTTPS deployment. |
| T+70–85 | Final checks, screenshots, README details, final commit/push and matching deployment. |
| T+85–90 | Verify public link, record exact final commit ID, submit the form before T+90. |

Commit at least once every 30 minutes and at least three times total. Every message includes what changed and the AI prompt, or Manual edit. Do not rewrite pushed history. Stop code, Git and deployment changes at T+90. The T+90–95 window allows only late form submission and incurs the stated penalty.

## Outstanding information

- University registration number: not supplied.
- Official contest's actual problem: not yet released; Smart Escape is the mock exercise.
- Hosting: Railway static Caddy service at https://smart-escape-practice-production.up.railway.app.
- Puku CLI sessions: user launches manually with `puku-cli`.
