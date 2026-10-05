# Puku 1 — routing and validation

Launch `puku-cli` in this folder, then paste the following prompt:

> Read ../AGENTS.md, ../docs/CONTRACT.md and ../docs/PLAN.md. You are Puku 1. A working baseline exists. Your task is to review and strengthen engine.js and engine.test.js for the Smart Escape practice challenge. Work only in engine.js, engine.test.js and REPORT.md inside this folder. Keep all exports, input shapes, route statuses and validation error codes compatible with CONTRACT.md. Check the five official examples, equal-cost exit and path ties, case-sensitive and prefix IDs, closed exits as intermediate nodes, disconnected graphs, reset with non-empty initial_state, malformed schema, maximum graph size and non-mutation. Look for real bugs before changing code. Add only meaningful regression tests. Run npm test and npm run build from the parent folder. Write REPORT.md with changes, test results and any concerns requiring Codex. Do not touch UI, shared files, dependencies or Git history. Do not commit or push. This is practice code and must not be represented as an official contest submission.

Use `Set-Location ..` temporarily to run project commands, then return here. The routing algorithm is independent of the DOM and can be tested directly with Node.
