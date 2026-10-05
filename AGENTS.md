# Smart Escape practice workspace

This repository is practice for the Smart Escape mock challenge. It is not tomorrow's official contest entry. Do not claim that pre-contest code is eligible for the real contest.

Use plain HTML, CSS and JavaScript modules. The deployed app is frontend only, uses no keys or external services, and must work in Bangla and English. Node scripts are local development/build tools, not deployed backend code.

## Parallel ownership

- **Puku 1:** edit only `puku1/engine.js`, `puku1/engine.test.js`, `puku1/REPORT.md`, and the assigned explanation artifact `puku1/JUDGE_GUIDE.md`.
- **Puku 2:** edit only `puku2/map.js`, `puku2/styles.css`, and `puku2/REPORT.md`.
- **Codex:** owns `src/`, root files, documentation, sample data, scripts, screenshots and integration.
- Read `docs/CONTRACT.md` before modifying interfaces. Ask Codex to coordinate a contract change before changing exports or argument shapes.
- Each folder already has a working baseline. Read existing code before improving it. Do not replace the entire project or run starter generators.
- All folders share one Git repository and working tree. Puku sessions must not commit, push, reset, stash, rebase, checkout, merge or change shared dependencies. Codex integrates and manages Git after both sessions finish.
- Never create or modify secrets. Imported dataset text must be rendered with `textContent`, not HTML interpolation.
- Run relevant checks from the repository root. Report the actual results and remaining limitations; do not invent verification.

## Required behavior

Import and validate the full schema, draw supplied coordinates and corridor costs, select an unblocked room/junction, and calculate a minimum-cost route using undirected weighted edges. Exclude blocked nodes, blocked edges, and closed exits even as intermediate nodes. Break ties by exit ID, then lexicographic node-ID sequence, using case-sensitive code-point ordering. Update immediately when conditions change. Reset restores imported `initial_state`. Keep a blocked selected start selected so its specific error is shown. All principal labels, errors and instructions have English and Bangla translations; dataset labels remain unchanged.

Respect keyboard access, visible focus, mobile layouts and reduced motion. Do not add external APIs, AI keys, backend services or runtime network dependencies.
