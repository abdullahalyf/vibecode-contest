# Puku 1 — judge explanation guide

Your 19-test implementation round passed independent verification. The human user asked us to keep the parallel workers doing useful finishing work.

Next task, maximum 5 minutes: create JUDGE_GUIDE.md in this folder. Read engine.js, engine.test.js and CONTRACT.md. Do not modify engine/tests. Write a concise, accurate explanation that a student can use to answer judges:

- What this app does and why corridor weights, not coordinates, determine route cost.
- Why Dijkstra works with positive edge costs; its implementation complexity at the actual 60-node/150-edge limits.
- Exact tie order, with one short exit-ID/path-ID example.
- How blocked nodes, blocked corridors and closed exits are removed, including closed exits as intermediate nodes.
- Why reset copies the original three arrays and why copies of string IDs are sufficient.
- How the independent exhaustive-path oracle provides evidence beyond hard-coded sample routes.
- What the user must still verify, and why this is educational rather than a certified evacuation tool.

Use plain English and a short Bangla explanation of the core algorithm. Do not invent features, test results, performance guarantees or use of external AI at runtime. Mark map/presentation claims as outside your review. No Git, no dependencies, no edits to other files. Finish with a brief report of the guide produced.
