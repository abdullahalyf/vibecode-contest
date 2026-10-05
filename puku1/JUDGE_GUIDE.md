# Puku 1 — Judge Explanation Guide

This guide explains the engine module (`puku1/engine.js`) to judges. It covers what the module does, why the algorithm works, and how the tests support the claims. It does **not** cover the map/UI (Puku 2) or the integration glue (Codex); those are outside the review of this module.

---

## 1. What this app does

The engine is a pure-JavaScript route finder for a small indoor graph. It receives a validated building description (rooms, junctions, exits, undirected corridors with positive costs) and a hazard state (blocked rooms/junctions, blocked corridors, closed exits). Given a starting node, it returns:

- `status: 'ok'` with the **lowest-cost exit**, the total cost, the sequence of node IDs, and the sequence of edge IDs, or
- a failure status: `select_start`, `start_blocked`, or `no_route`.

The cost is the **sum of positive integer weights on the corridors traversed**, in the order they are traversed. **Coordinates (x, y) are layout-only and never affect the answer.** That is why corridor weights, not coordinates, determine route cost: the algorithm walks the graph, and the only thing it sums is `edge.cost`.

The module is intentionally small and pure: it does not touch the DOM, has no external dependencies, and does not mutate its inputs. The test file covers sample routes and selected regressions, including mixed-case exit IDs, input isolation, fresh result arrays, and the 60-node / 150-edge size boundary. Tests provide evidence, not exhaustive coverage of every possible input.

---

## 2. Why Dijkstra works here

Dijkstra's algorithm finds the cheapest path from a source to every reachable node in a graph with **non-negative** edge weights. Validation requires every `edge.cost` to be a positive safe integer (`edge` rejects invalid individual costs). It also rejects an unsafe sum of all edge costs (`costRange`), keeping simple-path totals exact within JavaScript's safe integer range. Therefore the algorithm's weight precondition holds. Strictly positive costs also mean every predecessor on a shortest path has a lower cost than its successor, allowing tied paths to be compared before that successor is settled.

### Implementation cost and size limits

Validation caps the graph at **60 nodes and 150 edges**. The implementation maintains `best` and `settled`, but it rebuilds, filters and **sorts** the candidate array on every iteration. It also copies node/edge path arrays during relaxation and compares full node-ID sequences on cost ties. It does not use a heap or a linear minimum scan.

The textbook `O(V² + E)` bound for a linear-scan implementation does not describe this code. There are at most V settling iterations, each sorting up to V candidates; relaxation additionally incurs path-copy and comparison costs. Those costs depend on path length and ID string length, and JavaScript's sorting implementation also matters. This guide makes no measured latency, exact operation-count or blanket complexity claim for the current implementation. The boundary test exercises an accepted maximum-size fixture; it is not a performance benchmark.

### The algorithm in plain English

1. Mark the starting node as reachable with cost 0, node path `[startId]` and an empty edge path.
2. Repeatedly pick the cheapest unsettled node, "settle" it, and relax its neighbours: if a neighbour can be reached more cheaply (or equally cheaply with a lexicographically smaller path) through the settled one, update it.
3. Stop when no unsettled node remains.
4. Among all exits the algorithm reached, return the one with the lowest cost (and the lowest exit ID on ties). If no exit was reached, return `no_route`.

### বাংলায় সংক্ষিপ্ত ব্যাখ্যা

প্রতিটি করিডোরের খরচ ধনাত্মক হওয়ায় ডাইকস্ট্রা অ্যালগরিদম ব্যবহার করা যায়। শুরু থেকে সর্বনিম্ন খরচের পথ বের করা হয়। সমান খরচে আগে বহির্গমনের ID তুলনা করা হয়; একই বহির্গমনের একাধিক পথ সমান হলে নোডের ID ক্রম তুলনা করা হয়। বন্ধ বহির্গমন বা অবরুদ্ধ নোড দিয়ে পথ যেতে পারে না। এই বাস্তবায়ন প্রতিটি ধাপে প্রার্থীদের সাজায় এবং পথের অ্যারে কপি করে; এখানে নির্দিষ্ট গতি বা অপারেশনসংখ্যার দাবি করা হচ্ছে না।

---

## 3. Tie-breaking — exact rule

The final answer is ordered by **total cost, then exit ID, then node-ID sequence for that exit**. Path order must never override exit-ID priority between distinct equal-cost exits. IDs use **JavaScript ordinal UTF-16 code-unit comparison** through the built-in string `<`/`>` operators. This is case-sensitive, not locale-aware or Unicode code-point ordering; supplementary characters use surrogate pairs.

The implementation applies that rule at three points:

1. **Per-edge relaxation:** when a neighbour can be reached at the same cost as the best known route to it, the engine keeps the route with the lexicographically smaller node-ID sequence (see `comparePaths`). The shorter path wins if one node sequence is a strict prefix of the other.
2. **Among candidate exits:** all reachable exits are sorted by `(cost, exitId)` and the first is chosen.
3. **Among candidate nodes at each step:** the unsettled node with the smallest `(cost, path)` is settled next.

### One short example

Suppose the start is `S` and two exits are reachable, both at cost 3:

- Path A: `S → A → e1` (exit ID `e1`, lowercase)
- Path B: `S → z → E1` (exit ID `E1`, uppercase)

Path A's node sequence sorts first because `'A' < 'z'`. Nevertheless, the result is **Path B**, because exit ID `'E1'` sorts before `'e1'` (first UTF-16 code units `0x0045` and `0x0065`). Exit-ID priority decides between these exits. Only after fixing the chosen exit does node-sequence priority decide between its equal-cost paths.

The test "exit ID wins equal-cost ties even when another path sorts first" specifically checks exit priority against conflicting path order. The separate mixed-case exit test checks case-sensitive exit ordering; its fixture has path and exit ordering pointing to the same winner, so it alone does not establish conflicting-priority behavior.

---

## 4. How blocked nodes, blocked corridors, and closed exits are removed

`findRoute` builds a single `excluded` set containing both `state.blocked_nodes` and `state.closed_exits`. Before any routing work begins, every neighbour list is built with one rule: an edge is **only** added to the adjacency map if its ID is not in `state.blocked_edges` **and** neither endpoint is in `excluded`. After this filtering pass, all routing uses only the resulting adjacency map, so:

- **Blocked nodes (rooms/junctions)** vanish from the graph entirely. Any path that would have passed through them is impossible.
- **Blocked corridors** are removed one by one; the two endpoint nodes remain (unless they are themselves blocked).
- **Closed exits** are treated like blocked nodes. Critically, a closed exit cannot be used as an **intermediate** stop on the way to another exit either — the regression test "closed exits cannot be intermediate nodes" verifies exactly this. If the only path to a still-open exit ran through a closed exit, the result is `no_route`.

If the start itself is in `excluded`, the engine returns the distinct `start_blocked` status without doing any search.

---

## 5. Why `reset` copies the original three arrays

`createState(validatedBuilding)` does this:

```js
return Object.fromEntries(Object.entries(building.initial_state)
  .map(([key, ids]) => [key, [...ids]]));
```

It produces a **shallow copy** of each array. That is sufficient because:

- The arrays contain only **string IDs** (room, junction, exit, or corridor IDs). Strings are immutable in JavaScript, so no caller can ever mutate an ID *through* the array.
- Operations like `push`, `pop`, `splice`, or whole-array assignment only change the array itself, not the IDs inside. The shallow copy ensures the underlying initial-state arrays on the validated building object are untouched.

The "reset restores imported hazards without aliasing initial_state" test verifies two things at once: after mutating a fresh state, `createState(...)` reproduces the **original** arrays (`deepEqual`), and the returned array is **not the same reference** as the one stored on the building (`notEqual`).

The same aliasing protection lives in `validateBuilding`: it reconstructs node, edge, and state objects from scratch so callers can keep mutating the input they passed in without any effect on the validated building. The "validateBuilding never reads through to the input after returning" test pins this down.

---

## 6. The exhaustive-path oracle test

Sample assertions cover known answers. Additional evidence comes from a seeded differential check over **80 deterministically generated small graphs** (six nodes and two exits, with generated edges and hazards). A separate `oracle(b, s)` enumerates every permitted simple path from `S` to an exit, sorts results by `(cost, exitId, node-sequence)`, and returns the first. The test compares the engine's status, cost, exit ID and node sequence with that result. A disagreement needs investigation in the engine, oracle or fixture; the oracle itself is not infallible.

This is **evidence beyond sample routes**: it probes many random topologies and hazard combinations that no human would hand-curate. It does not prove correctness on graphs of the maximum allowed size (60 nodes / 150 edges) — that would be a brute-force explosion — but together with the boundary test "60 nodes and 150 edges pass validation" it gives confidence in both the small-graph logic and the upper-bound behaviour.

---

## 7. What the user must still verify

The module targets the shared contract and is **educational software**, not a certified evacuation tool. Its scope and verification limits are:

- It is **not** a real-time fire model. Edge costs are static numbers from the building file; they do not update as a hazard spreads.
- It does **not** model crowd dynamics, capacity, smoke, or door width.
- It does **not** guarantee performance for graphs larger than 60 nodes / 150 edges. The validation step rejects anything bigger.
- The visual quality of the map, keyboard navigation, screen-reader behaviour, colour choices, and animations are owned by Puku 2 and are **outside this review**.
- Translation strings, hazard editing controls, language switching, and import/export flow are owned by Codex and are **outside this review**.
- This documentation review inspected the engine and test source; it did not run tests, a build or browser checks. Earlier results are recorded in `docs/VERIFICATION.md`; final integrated/public verification is Desktop Codex's responsibility.
- This repository is pre-contest practice code and does not establish eligibility for the official contest.

---

## 8. Summary for the judge

Puku 1 is a pure, dependency-free JavaScript module for minimum-cost routing on positive-cost undirected edges. Final ties use **exit ID before node-ID sequence**, compared with ordinal UTF-16 code units. Closed exits are excluded as destinations and intermediates. Validation and state creation copy schema objects/arrays to isolate them from caller mutation. Sample regressions and a seeded exhaustive-path differential test provide evidence within their tested cases. Candidate sorting and path copying mean the textbook linear-scan complexity claim does not apply. The map and application shell are separate modules and are outside this engine explanation.
