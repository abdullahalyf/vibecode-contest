# Puku 1 — Smart Escape Report

## 1. Baseline summary

`engine.js` (`puku1/engine.js`, API owner Puku 1) already implements the full
contract documented in `puku1/CONTRACT.md`:

- `validateBuilding(parsedJson)` — schema check, ID/edge/pair uniqueness,
  total-cost overflow guard, category requirement (≥1 exit + ≥1 non-exit),
  defensive copy that strips unknown fields, and an initial_state that
  aliases nothing from the caller.
- `createState(validatedBuilding)` — fresh shallow copies of the three
  hazard arrays. Arrays contain string IDs (primitives), so shallow =
  deep here.
- `findRoute(validatedBuilding, state, startId)` — pure Dijkstra with
  two-tier tie-break (cost → path lex order → exit lex order) and
  short-circuit returns for `select_start`, `start_blocked`, `no_route`.

`puku1/engine.test.js` pins 15 official/scenarios + 4 Puku 1 review additions
= **19 tests** in total.

## 2. Audit results — no engine defects found

I traced every branch of `engine.js` against the contract and the test
suite:

| Branch | Result |
| --- | --- |
| `validateBuilding` object/array shape | Correct; throws `object` / `building` / `nodes` / `edges` / `state`. |
| Node schema (`id`, `label`, `type ∈ {room, junction, exit}`, finite `x`, `y`) | Correct; throws `node`. |
| Duplicate node id | Correct; throws `nodeId`. |
| Category requirement (≥1 exit, ≥1 non-exit) | Correct; throws `categories`. |
| Edge schema (`id`, `from`/`to` ∈ nodes, safe-integer `cost > 0`) | Correct; throws `edge`. |
| Duplicate edge id | Correct; throws `edgeId`. |
| Self-loop (`from === to`) | Correct; throws `loop`. |
| Pair dedup via `JSON.stringify([from, to].sort(compareIds))` | Correct; throws `pair`. IDs are plain strings so collisions are impossible. |
| Total-cost overflow (`Number.isSafeInteger(totalCost)`) | Correct; throws `costRange`. |
| State ID category check (`blocked_nodes` excludes exits; `closed_exits` requires exits; `blocked_edges` ⊆ edge ids) | Correct; throws `stateId`. |
| Initial-state dedup + filter to known keys | Correct. |
| Non-mutation of input / fresh copies for nodes/edges | Correct: per-node/edge map returns new objects; `value.building` is captured by value; `initial_state` is filtered and `[...new Set(ids)]`. |
| `createState` fresh arrays | Correct: `[...ids]` per key; no aliasing back to `building.initial_state`. |
| `findRoute` start check | Correct: missing or exit type → `select_start`; excluded start → `start_blocked`. |
| `findRoute` adjacency excludes closed/blocked endpoints AND closed-exit nodes | Correct: this is what enforces "closed exits cannot be intermediate nodes". |
| Dijkstra with `comparePaths` element-wise lex order | Correct: shorter path wins only after a full element-wise compare, then `length` (shorter is "wins" on full match because `comparePaths` returns `a.length - b.length` only when prior elements were equal). |
| Exit-tie via `compareIds(a.id, b.id)` | Correct: ordinal string compare. |
| Pure: `findRoute` never mutates `building` or `state` | Correct: builds local `excluded`, `blockedEdges`, `adjacent`, `best`, `settled`. Returns fresh arrays. |

No `engine.js` edits were required.

## 3. Tests added / fixed

Four new regression tests were added (lines 122–227 of `engine.test.js`):

1. **`exit tie-break is case-sensitive even when path ordering would pick another exit`** — pins ordinal `'E1' (0x45)` < `'e1' (0x65)` despite a path-tie that would otherwise favor the other exit.
2. **`validateBuilding never reads through to the input after returning`** — pins that mutating the input object, its node fields, or its initial_state arrays does not leak into the returned building. (See §4 — the original draft of this test had a contradictory final assertion; that has been removed.)
3. **`findRoute returns fresh node/edge arrays that are safe to mutate`** — pins that two calls return distinct array identities and that internal engine state is not exposed by aliasing.
4. **`60 nodes and 150 edges pass validation; 61 nodes and 151 edges fail`** — pins the contract ceiling inclusive at 60/150 and exclusive at 61/151.

The test for the 60/150 boundary was originally drafted with invalid
edge endpoints referencing IDs like `J60..J92`, which fail validation
with `code: 'edge'` before the size check runs. That has been corrected
to a 60-node graph with a 59-edge line chain plus 91 cross-edges
between non-adjacent junctions, all referencing existing node IDs.

## 4. Test results

Command (from project root):

```
node --test --test-isolation=none puku1/engine.test.js
```

Result: **19/19 tests pass**, 0 fail, 0 cancelled, 0 skipped.

```
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ duration_ms 27.34
```

Per-test (full list):

```
✔ official baseline: R1 to E1 costs 7
✔ official reroute after C2 is blocked costs 11
✔ official closed exits leave no route
✔ official R2 route costs 7
✔ official blocked start is a distinct status
✔ blocked corridor removes only its connection
✔ exit ID wins equal-cost ties even when another path sorts first
✔ equal paths compare full node sequences without locale ordering
✔ path comparison uses IDs, not joined strings
✔ closed exits cannot be intermediate nodes
✔ undirected corridors, disconnected nodes and coordinates do not affect costs
✔ start must be a room or junction
✔ reset restores imported hazards without aliasing initial_state
✔ validation rejects malformed or inconsistent input
✔ routing agrees with an exhaustive simple-path oracle on small deterministic graphs
✔ exit tie-break is case-sensitive even when path ordering would pick another exit
✔ validateBuilding never reads through to the input after returning
✔ findRoute returns fresh node/edge arrays that are safe to mutate
✔ 60 nodes and 150 edges pass validation; 61 nodes and 151 edges fail
```

## 5. Files touched

- `puku1/engine.test.js` — added 4 new regression tests, removed one
  contradictory assertion in the validation-isolation test, fixed the
  60/150 boundary fixture so all edge endpoints exist.

`puku1/engine.js` was **not** modified — the baseline passed the audit.

## 6. Open questions for Codex

These don't block this round but are worth resolving before the next:

1. The randomized oracle test uses `compareIds` semantics that match
   `compareIds(a, b) { return a < b ? -1 : a > b ? 1 : 0 }`. The current
   `comparePaths` returns `a.length - b.length` after a full element
   match — so if one path is a strict prefix of another, the shorter
   one is preferred. Is that the intended tie-break for the path tie?
2. The contract says "`createState` is a deep copy of the three
   initial_state arrays". For arrays of primitive string IDs, shallow
   copy is sufficient. Should we still defensively deep-copy on
   principle, or is shallow copy acceptable as the contract text
   suggests? (No test or runtime failure hinges on this — it is a
   documentation question.)
3. The 60-node / 150-edge ceiling allows graphs that strain Dijkstra
   slightly when re-running from a freshly mutated state. Is there a
   target wall-clock budget for `findRoute` (e.g. <5 ms)? Current
   measurement on the 60/150 fixture is <1 ms.

## 7. Status

Implementation complete. All tests pass. No engine changes. No files
outside `puku1/engine.test.js` and `puku1/REPORT.md` were touched.
No git mutations.

---

# 8. `puku1/session.js` — saved-progress API

A new module, `puku1/session.js`, ships browser-local saved progress.
It is consumed by Codex's integration; the engine does not depend on it.

## 8.1 Storage

- One versioned key: `puku1:smart-escape:session:v1`.
- Backend: `window.localStorage`. If `localStorage` is not exposed or
  throws on access, every API call throws `SessionError` with
  `code: 'sessionError'`.

## 8.2 Exports

```js
import {
  saveSession,    // (snapshot) => void, throws SessionError(code='sessionError')
  loadSession,    // () => snapshot, throws SessionError(code='sessionError')
  clearSession,   // () => void, throws SessionError(code='sessionError')
} from './session.js';

// Also exportable for matching without an extra engine import:
//   SESSION_ERROR_CODE === 'sessionError'
```

`SessionError` is a subclass with `.name = 'SessionError'` and
`.code = 'sessionError'`. Callers should match on `e.code === 'sessionError'`.

## 8.3 Snapshot shape

```ts
type Mode = 'select' | 'hazard';

interface Snapshot {
  version: 1;
  building: object;          // original pre-validation building
  state: {
    blocked_nodes: string[];
    blocked_edges: string[];
    closed_exits: string[];
  };
  startId: string | null;
  language: string;          // defaults to 'en' when missing or non-string
  mode: Mode;                // anything other than 'hazard' -> 'select'
}
```

## 8.4 `saveSession(snapshot)`

Pre-validates `snapshot.building` against the engine before persisting;
any `ValidationError` is converted to `SessionError('invalid building: <code>')`.

Writes a JSON payload containing:

- `version: 1`
- a deep clone of `snapshot.building` (via `structuredClone` with a JSON
  fallback)
- a normalized copy of the three hazard arrays (deduped, fresh array
  identities)
- `startId`, `language`, `mode` (each defaulted if missing or wrong type).

Throws `SessionError('sessionError')` if:

- `snapshot` / `snapshot.building` / `snapshot.state` are missing
- the building fails validation
- JSON serialization throws (circular refs)
- `localStorage.setItem` throws (quota exceeded, blocked by browser)

## 8.5 `loadSession()`

Reads the key, parses JSON, validates:

- `parsed.version === 1` (otherwise `SessionError('unsupported snapshot version')`)
- `parsed.building` and `parsed.state` are plain objects

Re-runs `validateBuilding(parsed.building)` and returns:

```js
{
  version: 1,
  building,           // freshly-validated; initial_state arrays are
                      // brand-new (validateBuilding dedupes each one
                      // via `new Set(ids)`)
  state,              // three fresh hazard arrays, NOT aliased to
                      // building.initial_state
  startId,            // string or null
  language,           // string ('en' default)
  mode                // 'select' | 'hazard'
}
```

Throws `SessionError('sessionError')` if:

- storage is unavailable
- the key is missing (`'no saved session'`)
- JSON parsing fails
- the snapshot is not a plain object
- the version is not 1
- the building fails re-validation (message: 'saved building invalid: <code>')

## 8.6 `clearSession()`

Calls `localStorage.removeItem(KEY)`. Throws `SessionError` if storage
is unavailable or the remove throws. Idempotent — does not throw when
the key was already absent.

## 8.7 Reset semantics

`building.initial_state` returned by `loadSession` is always the
**pristine validated copy** of the saved building, never the user's
current `state`. So `createState(building)` from the engine returns the
original three arrays; Reset still means "back to the imported hazards",
even after the user reloads a session with custom hazards.

This is guaranteed by two facts:

1. `validateBuilding` (engine.js) rebuilds each `initial_state` array
   with `[...new Set(ids)]`, so any caller mutation prior to save does
   not reach the validated copy.
2. `loadSession` reconstructs the returned `state` from the
   just-parsed JSON, giving it fresh array identities unrelated to
   `building.initial_state`.

## 8.8 Checks performed by Codex integration

The integration layer (`src/app.js`, owned by Codex) should observe:

| Situation | Expected `e.code` | Expected `e.message` contains |
| --- | --- | --- |
| `localStorage` not available | `'sessionError'` | `'localStorage unavailable'` |
| No key present (first visit, after clear) | `'sessionError'` | `'no saved session'` |
| Stored value not valid JSON | `'sessionError'` | `'not valid JSON'` |
| Stored value not an object | `'sessionError'` | `'not an object'` |
| Stored `version` !== 1 | `'sessionError'` | `'unsupported snapshot version'` |
| Saved building fails re-validation | `'sessionError'` | `'saved building invalid: <code>'` |
| Save with invalid building | `'sessionError'` | `'invalid building: <code>'` |
| Save with non-serializable snapshot | `'sessionError'` | `'not serializable'` |
| Quota exceeded on write | `'sessionError'` | `'localStorage write failed'` |

The integration should treat `'sessionError'` as a recoverable
condition: continue with a fresh in-memory session, do not show a
hard error.

## 8.9 Files

- `puku1/session.js` — new file, ~115 lines.
- No other files were touched.

## 9. Desktop integration review supersedes section 8 API details

Puku 1's focused follow-up added strict current-hazard category/ID validation on both save and load, required array fields, nonexit start validation (blocked selected starts remain valid), en/bn language and select/hazard mode validation. An absent saved item now returns null. Corrupt or unavailable storage still throws code sessionError. The original building initial_state is retained separately from saved current hazards.

Desktop independently ran all 19 engine tests plus 19 new session tests: 38 passed, 0 failed. Nine real Chrome saved-progress checks also passed, including reload/restore, all original reset arrays, corrupt and invalid saved state preservation, clear and unavailable storage. Actual public verification is recorded separately in docs/VERIFICATION.md. Do not pattern-match English error messages in the UI; use the code and localized messages.
