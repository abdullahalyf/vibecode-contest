// Browser-local saved progress for Smart Escape.
// API owner: Puku 1. Consumed by Codex via the controls integration.
// Storage backend: window.localStorage (one versioned key).
//
// The snapshot is intentionally minimal — just enough to recreate the
// current session on page reload:
//   { version, building, state, startId, language, mode }
//
// `building` is the ORIGINAL pre-validation object the application
// supplied. We re-validate on load so the saved hazards are confirmed
// against the engine's own rules before being handed back.
//
// `state` is the three hazard arrays the user had at save time. It is
// fully decoupled from `building.initial_state` after `loadSession`
// returns — Reset remains correct because `createState(building)`
// always reads from the freshly-validated `building.initial_state`.

import { validateBuilding, ValidationError } from './engine.js';

const STORAGE_KEY = 'puku1:smart-escape:session:v1';
const SNAPSHOT_VERSION = 1;
const ALLOWED_LANGUAGES = new Set(['en', 'bn']);
const ALLOWED_MODES = new Set(['select', 'hazard']);

export const SESSION_ERROR_CODE = 'sessionError';

class SessionError extends Error {
  constructor(reason) {
    super(reason || 'session error');
    this.name = 'SessionError';
    this.code = SESSION_ERROR_CODE;
  }
}

function getStorage() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch (_) { /* localStorage access can throw in some sandboxes */ }
  return null;
}

function safeCloneBuilding(building) {
  // structuredClone is available in all modern browsers and Node 17+;
  // buildings are plain JSON data so a JSON round-trip is safe as a
  // fallback for older runtimes.
  if (typeof structuredClone === 'function') return structuredClone(building);
  return JSON.parse(JSON.stringify(building));
}

function normalizeArrays(value) {
  // Strict: missing or non-array values are an error, not silently empty.
  if (!Array.isArray(value)) {
    throw new SessionError('state field must be an array');
  }
  // Reject non-string entries up front so we surface corrupt saved data
  // instead of silently coercing.
  for (const id of value) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new SessionError('state IDs must be non-empty strings');
    }
  }
  return [...new Set(value)];
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function ensureValidBuilding(building) {
  if (!isPlainObject(building)) throw new SessionError('building must be an object');
  try { validateBuilding(building); }
  catch (e) {
    if (e instanceof ValidationError) throw new SessionError('invalid building: ' + e.code);
    throw new SessionError('building validation failed');
  }
}

// Build a probe building whose `initial_state` is the caller's CURRENT
// state, so the engine confirms the IDs are still real and in the right
// category (exits can't be in blocked_nodes, blocked_edges must be real
// edges, closed_exits must be exits, etc.). The validated building's
// `initial_state` is then discarded — we return the ORIGINAL validated
// building unchanged so Reset semantics are preserved.
function validateStateAgainstBuilding(validatedOriginalBuilding, currentState) {
  if (!isPlainObject(currentState)) throw new SessionError('snapshot.state required');
  const checkedNodes = normalizeArrays(currentState.blocked_nodes);
  const checkedEdges = normalizeArrays(currentState.blocked_edges);
  const checkedExits = normalizeArrays(currentState.closed_exits);

  const probe = {
    building: validatedOriginalBuilding.building,
    nodes: validatedOriginalBuilding.nodes,
    edges: validatedOriginalBuilding.edges,
    initial_state: {
      blocked_nodes: checkedNodes,
      blocked_edges: checkedEdges,
      closed_exits: checkedExits,
    },
  };
  try { validateBuilding(probe); }
  catch (e) {
    if (e instanceof ValidationError) throw new SessionError('invalid state: ' + e.code);
    throw new SessionError('state validation failed');
  }

  return {
    state: {
      blocked_nodes: checkedNodes,
      blocked_edges: checkedEdges,
      closed_exits: checkedExits,
    },
  };
}

function validateStart(startId, validatedBuilding) {
  if (startId === null) return null;
  if (typeof startId === 'string' && startId.length === 0) return null;
  if (typeof startId !== 'string') throw new SessionError('startId must be a string or null');
  const node = validatedBuilding.nodes.find(n => n.id === startId);
  if (!node) throw new SessionError('startId references unknown node');
  if (node.type === 'exit') throw new SessionError('startId must not be an exit');
  return startId;
}

function validateLanguage(value) {
  if (typeof value !== 'string') throw new SessionError('language must be a string');
  if (!ALLOWED_LANGUAGES.has(value)) throw new SessionError('language must be en or bn');
  return value;
}

function validateMode(value) {
  if (typeof value !== 'string') throw new SessionError('mode must be a string');
  if (!ALLOWED_MODES.has(value)) throw new SessionError('mode must be select or hazard');
  return value;
}

function validateSnapshotShape(snapshot) {
  if (!isPlainObject(snapshot)) throw new SessionError('snapshot must be an object');
  if (!isPlainObject(snapshot.building)) throw new SessionError('snapshot.building required');
  // The state shape (plain object with the three array fields) is
  // checked up-front so a missing/non-array field is a single, clear
  // error rather than a silent empty default.
  if (!isPlainObject(snapshot.state)) throw new SessionError('snapshot.state required');
  if (!('blocked_nodes' in snapshot.state)) throw new SessionError('snapshot.state.blocked_nodes required');
  if (!('blocked_edges' in snapshot.state)) throw new SessionError('snapshot.state.blocked_edges required');
  if (!('closed_exits' in snapshot.state)) throw new SessionError('snapshot.state.closed_exits required');
}

export function saveSession(snapshot) {
  const store = getStorage();
  if (!store) throw new SessionError('localStorage unavailable');

  // Shape check first so missing/non-array state fields fail with a
  // specific message instead of the generic validation one.
  validateSnapshotShape(snapshot);

  // Pre-validate the building on its own, then validate the caller's
  // CURRENT state against it. The original validated building (with
  // its original initial_state) is the one that gets persisted — only
  // the current state is checked.
  ensureValidBuilding(snapshot.building);
  const originalValidated = validateBuilding(snapshot.building);
  const { state: checkedState } = validateStateAgainstBuilding(originalValidated, snapshot.state);

  const validatedStart = validateStart(snapshot.startId, originalValidated);
  const validatedLanguage = validateLanguage(snapshot.language);
  const validatedMode = validateMode(snapshot.mode);

  const payload = {
    version: SNAPSHOT_VERSION,
    building: safeCloneBuilding(snapshot.building),
    state: checkedState,
    startId: validatedStart,
    language: validatedLanguage,
    mode: validatedMode,
  };
  let text;
  try { text = JSON.stringify(payload); }
  catch (_) { throw new SessionError('snapshot not serializable'); }

  try { store.setItem(STORAGE_KEY, text); }
  catch (_) { throw new SessionError('localStorage write failed'); }
}

export function loadSession() {
  const store = getStorage();
  if (!store) throw new SessionError('localStorage unavailable');

  let raw;
  try { raw = store.getItem(STORAGE_KEY); }
  catch (_) { throw new SessionError('localStorage read failed'); }
  // Per spec: an absent saved item returns null (not an error).
  if (raw == null) return null;

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (_) { throw new SessionError('saved snapshot is not valid JSON'); }
  if (!isPlainObject(parsed)) throw new SessionError('saved snapshot is not an object');
  if (parsed.version !== SNAPSHOT_VERSION) throw new SessionError('unsupported snapshot version');

  // Same shape check as save: the three state fields must all be arrays.
  if (!isPlainObject(parsed.building)) throw new SessionError('saved snapshot missing building');
  if (!isPlainObject(parsed.state)) throw new SessionError('saved snapshot missing state');
  if (!('blocked_nodes' in parsed.state)) throw new SessionError('saved state.blocked_nodes required');
  if (!('blocked_edges' in parsed.state)) throw new SessionError('saved state.blocked_edges required');
  if (!('closed_exits' in parsed.state)) throw new SessionError('saved state.closed_exits required');

  // Validate the building on its own so the engine checks the schema
  // (including the original `initial_state`).
  const building = (function () {
    try { return validateBuilding(parsed.building); }
    catch (e) {
      if (e instanceof ValidationError) throw new SessionError('saved building invalid: ' + e.code);
      throw new SessionError('saved building validation failed');
    }
  })();

  // Now validate the SAVED current state against the validated
  // building. This rejects snapshots whose current IDs no longer exist
  // or are in the wrong category. We then return the ORIGINAL
  // validated building (with its original `initial_state`) so Reset
  // semantics are preserved.
  const { state } = validateStateAgainstBuilding(building, parsed.state);

  // startId / language / mode are validated here too — anything
  // malformed in a saved snapshot is treated as corrupt data.
  const startId = validateStart(parsed.startId, building);
  const language = validateLanguage(parsed.language);
  const mode = validateMode(parsed.mode);

  return {
    version: SNAPSHOT_VERSION,
    building,
    state,
    startId,
    language,
    mode,
  };
}

export function clearSession() {
  const store = getStorage();
  if (!store) throw new SessionError('localStorage unavailable');
  try { store.removeItem(STORAGE_KEY); }
  catch (_) { throw new SessionError('localStorage remove failed'); }
}
