// @ts-check
/**
 * Validates surface operations and documents.
 *
 * Rendering is tolerant and reporting strict: an invalid property is dropped, an invalid node is
 * kept only as its id and type (the surface draws a quiet fallback for it), and every problem is
 * listed as an error an application can hand back to the model that wrote the surface. Three shape
 * mistakes that can only mean one thing are repaired, and reported with `repaired: true`:
 *
 * - `root` or `children` given as one id string is wrapped in a list;
 * - a non-empty `$data` pointer without its leading `/` gets one;
 * - a child given inline as a whole node with an `id` and a `type` is lifted out as its own
 *   `node` operation and replaced by its id.
 *
 * Nothing else is guessed at. The module touches no DOM, so a server can validate what its model
 * wrote before it forwards it, and again when a reply comes back.
 */
import { safeHref } from '../../core/dom.js';
import { parsePointer } from '../../internal/json-patch.js';
import { checkCondition, checkNext, checkRuleList, MAX_CONDITION_DEPTH, NEXT_REVIEW, NEXT_SUBMIT } from '../questionnaire/conditions.js';
import {
  assertCatalog, CATALOG, FORBIDDEN_KEYS, HREF_PATTERN, ICON_PATTERN, ID_PATTERN, LIMITS, NAME_PATTERN, PLACEMENTS, RESERVED_ACTIONS, SURFACE_VERSION
} from './catalog.js';
import { unsupported } from './schema.js';

/** @typedef {import('./catalog.js').SurfaceCatalog} SurfaceCatalog */
/** @typedef {import('./catalog.js').CatalogNode} CatalogNode */
/** @typedef {import('./catalog.js').CatalogProp} CatalogProp */
/** @typedef {import('./catalog.js').SurfaceIntent} SurfaceIntent */
/** @typedef {import('./catalog.js').SurfacePlacement} SurfacePlacement */
/** @typedef {import('../questionnaire/conditions.js').Condition} Condition */

/**
 * What went wrong. Codes are stable; messages are English and written for the model.
 * - `invalid-op`: the operation is not an object.
 * - `unknown-op`: `op` is not one of the operations.
 * - `version`: `zx` is not `surface/1`; the surface is refused.
 * - `no-begin`, `duplicate-begin`, `ended`: an operation out of order; it is refused.
 * - `unknown-intent`: the intent is unknown or outside the catalog; the surface draws no controls.
 * - `unknown-type`: the node type is unknown or outside the catalog; the node is a fallback.
 * - `not-allowed`: the node or property does not belong in this surface.
 * - `unknown-node`: a `patch`, `append` or `remove` names a node that does not exist.
 * - `unknown-key`: a key the format does not have; dropped.
 * - `token-refused`: a `token`, which only the application can set; dropped.
 * - `confirmation-ignored`: an action trying to set its own confirmation; dropped.
 * - `forbidden-key`: `__proto__`, `constructor` or `prototype`; dropped at any depth.
 * - `not-finite`: a number that is not finite; dropped.
 * - `limit`: over one of the limits; dropped.
 * - `invalid-value`: the wrong type or a value outside its choices; dropped.
 * - `missing`: something required is absent.
 * - `link-refused`: a link that is not a plain `https:` address.
 * - `ref-refused`: a record whose entity the application does not offer.
 * - `pointer-invalid`: a malformed JSON Pointer.
 * - `data-path`: a `data` path that runs through a value that is not an object or a list, or
 *   whose parent does not exist.
 * - `condition`: a `visible`, `when` or `next` that breaks the condition grammar, nests too deep or
 *   names an input that does not come earlier; dropped, so the node stays visible.
 * - `unsupported-schema`: a schema construct outside the input subset; dropped.
 * - `untitled-property`: a schema property without a `title`.
 * - `duplicate-name`: an input name used twice; the later one is dropped.
 * - `draw-failed`: a node or the surface could not be drawn; the rest stands, and it still replies.
 * - `cycle`: a child that is the node itself or one of its ancestors, or already placed elsewhere.
 * - `missing-node`: a child id that never arrived by `end`.
 * - `unreachable`: a node that no list of children reaches from `root`.
 * - `needs`: the intent lacks the node it needs.
 * - `wrapped-list`, `pointer-slash`, `lifted-child`: the three repairs, with `repaired: true`.
 * @typedef {'invalid-op'|'unknown-op'|'version'|'no-begin'|'duplicate-begin'|'ended'|'unknown-intent'
 *   |'unknown-type'|'not-allowed'|'unknown-node'|'unknown-key'|'token-refused'|'confirmation-ignored'
 *   |'forbidden-key'|'not-finite'|'limit'|'invalid-value'|'missing'|'link-refused'|'ref-refused'
 *   |'pointer-invalid'|'data-path'|'condition'|'unsupported-schema'|'untitled-property'|'duplicate-name'
 *   |'cycle'|'missing-node'|'unreachable'|'needs'|'wrapped-list'|'pointer-slash'|'lifted-child'
 *   |'draw-failed'} SurfaceErrorCode
 */

/**
 * One problem, in a shape an application can return to the model as it is.
 * @typedef {Object} SurfaceError
 * @property {SurfaceErrorCode} code What went wrong.
 * @property {string} message What went wrong, for the model.
 * @property {string} [surface] The surface it concerns.
 * @property {string} [id] The node or action it concerns.
 * @property {string} [path] JSON Pointer to the problem inside the operation line, or inside the
 *   document for `validateDocument()`.
 * @property {true} [repaired] Present when the problem was repaired rather than dropped.
 */

/**
 * A node: its id, its type, its properties, and optionally `visible` and `children`.
 * @typedef {{id: string, type: string, visible?: Condition, children?: string[], [key: string]: unknown}} SurfaceNode
 */

/**
 * One operation line, after validation. Every line names its `surface`.
 * @typedef {{op: 'begin', zx: string, surface: string, intent: SurfaceIntent|null, title?: string, author?: string, root: string[], placement?: SurfacePlacement, description?: string}
 *   | ({op: 'node', surface: string} & SurfaceNode)
 *   | {op: 'patch', surface: string, id: string, props: Record<string, unknown>}
 *   | {op: 'append', surface: string, id: string, text: string}
 *   | {op: 'remove', surface: string, id: string}
 *   | {op: 'data', surface: string, path: string, value?: unknown, remove?: true}
 *   | {op: 'actions', surface: string, items: SurfaceAction[]}
 *   | {op: 'end', surface: string, sources?: SurfaceSource[]}} SurfaceOp
 */

/**
 * An action of the surface's own. What it needs before it runs is the application's decision.
 * @typedef {Object} SurfaceAction
 * @property {string} id Reported as the reply's `action`.
 * @property {string} label The button text.
 * @property {'primary'|'secondary'|'danger'} [kind] How it looks; `danger` is presentation only.
 * @property {string} [tool] The tool the action triggers, for the application's policy.
 * @property {string} [description] A supporting line.
 */

/**
 * A source a surface's citation markers refer to.
 * @typedef {Object} SurfaceSource
 * @property {number} n The marker's number, `[n]`.
 * @property {string} [title] What the source is.
 * @property {string} [call] The trace step it came from.
 * @property {{$ref: string, id: string}} [ref] The record it is.
 */

/**
 * The document form: a whole surface as one object, the shape the `show_surface` and `ask_user`
 * tools take and `Surface({document})` renders. It mirrors the operations: the `begin` members,
 * then every `node`, the `data`, the `actions` and the `end`'s `sources`. A key whose value is
 * `null` counts as absent, so arguments written for strict structured output are read as given.
 * @typedef {Object} SurfaceDocument
 * @property {'surface/1'} zx The format version.
 * @property {string} surface The surface's id.
 * @property {SurfaceIntent|null} intent The intent; `null` after validation when it was invalid.
 * @property {string} [title] What the surface is about; also its accessible name.
 * @property {string} [author] Who composed it, a key into the application's authors.
 * @property {string[]} root The ids of the top-level nodes, in order.
 * @property {SurfacePlacement} [placement] Where the surface asks to be placed.
 * @property {string} [description] A supporting line under the title.
 * @property {SurfaceNode[]} nodes Every node, each once.
 * @property {Record<string, unknown>} [data] Data that `{"$data": "/pointer"}` properties bind to.
 * @property {SurfaceAction[]} [actions] The surface's own actions.
 * @property {SurfaceSource[]} [sources] The sources of its citation markers.
 */

/**
 * What `validateOp()` returns. Apply `ops` in order: the operation itself, preceded or followed by
 * what validation adds — lifted inline children after the node that held them, and at `end` the
 * patches that drop what the whole surface showed to be invalid.
 * @typedef {Object} OpResult
 * @property {SurfaceOp|null} op The operation as it may be applied, or `null` when it is refused.
 * @property {SurfaceError[]} errors Everything found, repairs included.
 * @property {SurfaceOp[]} ops Every operation to apply, in order.
 */

/**
 * Options of `createValidationState()` and `validateDocument()`.
 * @typedef {Object} ValidationSettings
 * @property {Iterable<string>|null} [entities=null] The record entities `{"$ref": …}` may name, as
 *   the Surface's `resolve.entities`. Without them every record is refused.
 */

/**
 * What the validator knows of the surfaces of one stream. Create it with
 * `createValidationState()`, pass it to every `validateOp()` of the stream, and read a surface back
 * with `stateToDocument()`. Opaque otherwise.
 * @typedef {Object} ValidationState
 * @property {Set<string>|null} entities The entities records may name.
 * @property {Map<string, SurfaceTrack>} surfaces The surfaces begun so far.
 */

/**
 * @typedef {Object} SurfaceTrack
 * @property {string} id
 * @property {SurfaceIntent|null} intent
 * @property {string} [title]
 * @property {string} [author]
 * @property {SurfacePlacement} [placement]
 * @property {string} [description]
 * @property {string[]} root
 * @property {Map<string, SurfaceNode>} nodes
 * @property {Map<string, number>} seq Arrival order of each node id.
 * @property {number} counter
 * @property {Map<string, string>} parent Parent id of each child id; `ROOT` for the top level.
 * @property {Map<string, {owner: string, seq: number}>} names Input names and the node holding them.
 * @property {Record<string, unknown>} data
 * @property {number} dataSize Characters of `data` written as JSON.
 * @property {SurfaceAction[]|null} actions
 * @property {SurfaceSource[]|null} sources
 * @property {boolean} ended
 */

/**
 * @typedef {Object} Context
 * @property {string} surface
 * @property {SurfaceError[]} errors
 * @property {(path: string) => string} at Maps a path inside the operation to the reported path.
 * @property {Set<string>|null} entities
 */

const ROOT = '\u0000root';
const OPS = new Set(['begin', 'node', 'patch', 'append', 'remove', 'data', 'actions', 'end']);
const FORBIDDEN = new Set(FORBIDDEN_KEYS);
const ID = new RegExp(ID_PATTERN);
const NAME = new RegExp(NAME_PATTERN);
const ICON = new RegExp(ICON_PATTERN);
const HREF = new RegExp(HREF_PATTERN);
const ASSET = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const CONFIRMATION_KEYS = new Set(['confirmation', 'confirm', 'confirmText', 'confirmed', 'policy', 'skipConfirmation', 'noConfirm', 'requireConfirmation', 'requiresConfirmation']);
const VALUELESS = new Set(['empty', 'filled']);
/** Properties that define inputs, so names, limits and conditions can be checked: never bound to data. */
const UNBOUND_PROPS = new Set(['name', 'schema', 'steps']);
/** An array index as RFC 6901 writes it. */
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;
const INPUT_INTENTS_EXCLUDED = new Set(['show', 'confirm']);

/**
 * Creates the state one stream's operations are validated against.
 * @param {ValidationSettings} [options]
 * @returns {ValidationState}
 */
export function createValidationState(options = {}) {
  const entities = options.entities == null ? null : new Set([...options.entities].filter((entity) => typeof entity === 'string'));
  return { entities, surfaces: new Map() };
}

/**
 * Validates one operation against the stream's state and the catalog, and records it in the state.
 * @param {unknown} op The operation, as parsed from its line.
 * @param {ValidationState} state From `createValidationState()`.
 * @param {SurfaceCatalog} [catalog=CATALOG] The catalog, or a narrowed one.
 * @returns {OpResult}
 * @throws {TypeError} When the state or the catalog is not one of the library's.
 */
export function validateOp(op, state, catalog = CATALOG) {
  if (!state || !(state.surfaces instanceof Map)) throw new TypeError('validateOp() needs a state from createValidationState()');
  assertCatalog(catalog);
  return validateOpAt(op, state, catalog, (path) => path);
}

/**
 * Validates a whole document. The result is the document as it may be rendered: repairs applied,
 * inline children lifted, invalid parts dropped, `null` members removed.
 * @param {unknown} document The document.
 * @param {SurfaceCatalog} [catalog=CATALOG] The catalog, or a narrowed one.
 * @param {ValidationSettings} [options]
 * @returns {{document: SurfaceDocument|null, errors: SurfaceError[]}} `document` is `null` when
 *   the document could not be read as a surface at all.
 * @throws {TypeError} When the catalog is not one of the library's.
 */
export function validateDocument(document, catalog = CATALOG, options = {}) {
  assertCatalog(catalog);
  /** @type {SurfaceError[]} */
  const errors = [];
  if (!isObject(document)) {
    errors.push({ code: 'invalid-op', message: 'A surface document must be an object', path: '' });
    return { document: null, errors };
  }
  const state = createValidationState(options);
  const surface = document.surface;
  /** @param {SurfaceError} error */
  const report = (error) => errors.push(typeof surface === 'string' ? { surface, ...error } : error);
  const known = new Set(['zx', 'surface', 'intent', 'title', 'author', 'root', 'placement', 'description', 'nodes', 'data', 'actions', 'sources']);
  for (const key of Object.keys(document)) {
    if (known.has(key) || document[key] === null) continue;
    if (key === 'token') report({ code: 'token-refused', message: 'A surface cannot set its own token; only the application gives one', path: '/token' });
    else report({ code: FORBIDDEN.has(key) ? 'forbidden-key' : 'unknown-key', message: `Unknown key "${key}"`, path: `/${escapeKey(key)}` });
  }
  /** @param {unknown} op @param {(path: string) => string} at */
  const run = (op, at) => {
    const result = validateOpAt(op, state, catalog, at);
    errors.push(...result.errors);
    return result;
  };
  /** @type {Record<string, unknown>} */
  const begin = { op: 'begin' };
  for (const key of ['zx', 'surface', 'intent', 'title', 'author', 'root', 'placement', 'description']) {
    if (Object.hasOwn(document, key)) begin[key] = document[key];
  }
  if (!run(begin, (path) => path).op) return { document: null, errors };
  const id = /** @type {string} */ (surface);

  if (present(document.data)) {
    run({ op: 'data', surface: id, path: '', value: document.data }, (path) => path.replace(/^\/value/, '/data'));
  }
  if (present(document.nodes)) {
    if (!Array.isArray(document.nodes)) {
      report({ code: 'invalid-value', message: '"nodes" must be a list of nodes', path: '/nodes' });
    } else {
      if (document.nodes.length > LIMITS.nodes) {
        report({ code: 'limit', message: `A surface has at most ${LIMITS.nodes} nodes; the rest were dropped`, path: '/nodes' });
      }
      document.nodes.slice(0, LIMITS.nodes).forEach((node, index) => {
        const at = (/** @type {string} */ path) => `/nodes/${index}${path}`;
        if (!isObject(node)) {
          report({ code: 'invalid-value', message: 'A node must be an object', path: at('') });
          return;
        }
        if (Object.hasOwn(node, 'op') || Object.hasOwn(node, 'surface')) {
          report({ code: 'unknown-key', message: 'A node in a document carries no "op" or "surface"', path: at('') });
        }
        run({ ...node, op: 'node', surface: id }, at);
      });
    }
  } else {
    report({ code: 'missing', message: 'A document needs "nodes", even an empty list', path: '/nodes' });
  }
  if (present(document.actions)) run({ op: 'actions', surface: id, items: document.actions }, (path) => path.replace(/^\/items/, '/actions'));
  /** @type {Record<string, unknown>} */
  const end = { op: 'end', surface: id };
  if (present(document.sources)) end.sources = document.sources;
  run(end, (path) => path);
  return { document: stateToDocument(state, id), errors };
}

/**
 * Reads one surface back from a validation state as a document.
 * @param {ValidationState} state
 * @param {string} surface The surface's id.
 * @returns {SurfaceDocument|null} `null` when the surface has not begun.
 */
export function stateToDocument(state, surface) {
  const track = state?.surfaces?.get(surface);
  if (!track) return null;
  /** @type {Record<string, unknown>} */
  const out = { zx: SURFACE_VERSION, surface: track.id, intent: track.intent };
  if (track.title !== undefined) out.title = track.title;
  if (track.author !== undefined) out.author = track.author;
  out.root = [...track.root];
  if (track.placement !== undefined) out.placement = track.placement;
  if (track.description !== undefined) out.description = track.description;
  out.nodes = [...track.nodes.values()]
    .sort((a, b) => (track.seq.get(a.id) ?? 0) - (track.seq.get(b.id) ?? 0))
    .map((node) => clone(node));
  if (Object.keys(track.data).length) out.data = clone(track.data);
  if (track.actions) out.actions = clone(track.actions);
  if (track.sources) out.sources = clone(track.sources);
  return /** @type {SurfaceDocument} */ (out);
}

/**
 * Checks a value bound with `{"$data": …}` once it is resolved, as it would have been checked had
 * the model written it into the node.
 * @param {string} type The node type.
 * @param {string} prop The property.
 * @param {unknown} value The resolved value.
 * @param {ValidationSettings & {node?: SurfaceNode}} [options] `node` gives a table's columns, for
 *   rows written as lists.
 * @returns {{value: unknown, errors: SurfaceError[]}} `value` is `undefined` when it was dropped.
 */
export function validateValue(type, prop, value, options = {}) {
  /** @type {Context} */
  const ctx = {
    surface: '',
    errors: [],
    at: (path) => path,
    entities: options.entities == null ? null : new Set(options.entities)
  };
  const node = typeof type === 'string' && Object.hasOwn(CATALOG.nodes, type) ? CATALOG.nodes[type] : null;
  const entry = node && typeof prop === 'string' && Object.hasOwn(node.props, prop) ? node.props[prop] : null;
  if (!entry) {
    ctx.errors.push({ code: 'unknown-key', message: `"${type}" nodes have no "${prop}"`, path: '' });
    return { value: undefined, errors: ctx.errors };
  }
  if (UNBOUND_PROPS.has(prop)) {
    ctx.errors.push({ code: 'not-allowed', message: `"${prop}" cannot be bound to data`, path: '' });
    return { value: undefined, errors: ctx.errors };
  }
  const clean = sanitize(value, '', 2, ctx);
  if (clean === undefined) return { value: undefined, errors: ctx.errors.map(stripSurface) };
  const checked = checkProp(entry, prop, clean, ctx, '', options.node ?? null);
  return { value: checked, errors: ctx.errors.map(stripSurface) };
}

/* ------------------------------------------------------------------------------------------------
 * Operations
 * --------------------------------------------------------------------------------------------- */

/**
 * @param {unknown} raw @param {ValidationState} state @param {SurfaceCatalog} catalog
 * @param {(path: string) => string} at
 * @returns {OpResult}
 */
function validateOpAt(raw, state, catalog, at) {
  /** @type {SurfaceError[]} */
  const errors = [];
  /** @type {OpResult} */
  const refused = { op: null, errors, ops: [] };
  if (!isObject(raw)) {
    errors.push({ code: 'invalid-op', message: 'An operation must be a JSON object', path: at('') });
    return refused;
  }
  const surface = raw.surface;
  /** @type {Context} */
  const ctx = { surface: typeof surface === 'string' ? surface : '', errors, at, entities: state.entities };
  if (typeof raw.op !== 'string' || !OPS.has(raw.op)) {
    report(ctx, 'unknown-op', `Unknown operation ${JSON.stringify(raw.op ?? null)}; use one of ${[...OPS].join(', ')}`, { path: '/op' });
    return refused;
  }
  if (typeof surface !== 'string' || !ID.test(surface)) {
    report(ctx, 'invalid-value', 'Every operation names its "surface" with an id of letters, digits, "_", ".", ":" or "-"', { path: '/surface' });
    return refused;
  }
  const op = raw.op;
  const track = state.surfaces.get(surface);
  if (op === 'begin') {
    if (track) {
      report(ctx, 'duplicate-begin', `The surface "${surface}" has already begun`, { path: '/op' });
      return refused;
    }
    return validateBegin(raw, state, catalog, ctx);
  }
  if (!track) {
    report(ctx, 'no-begin', `The surface "${surface}" has not begun; send "begin" first`, { path: '/op' });
    return refused;
  }
  if (track.ended) {
    report(ctx, 'ended', `The surface "${surface}" has ended`, { path: '/op' });
    return refused;
  }
  switch (op) {
    case 'node': return validateNodeOp(raw, track, catalog, ctx);
    case 'patch': return validatePatch(raw, track, catalog, ctx);
    case 'append': return validateAppend(raw, track, ctx);
    case 'remove': return validateRemove(raw, track, ctx);
    case 'data': return validateData(raw, track, ctx);
    case 'actions': return validateActions(raw, track, ctx);
    default: return validateEnd(raw, track, catalog, ctx);
  }
}

/**
 * @param {Record<string, unknown>} raw @param {ValidationState} state @param {SurfaceCatalog} catalog
 * @param {Context} ctx @returns {OpResult}
 */
function validateBegin(raw, state, catalog, ctx) {
  const input = sanitizeOp(raw, ctx);
  checkKeys(input, ['op', 'zx', 'surface', 'intent', 'title', 'author', 'root', 'placement', 'description'], ctx, '');
  if (input.zx !== SURFACE_VERSION) {
    report(ctx, 'version', `"zx" must be "${SURFACE_VERSION}"`, { path: '/zx' });
    return { op: null, errors: ctx.errors, ops: [] };
  }
  /** @type {SurfaceTrack} */
  const track = {
    id: ctx.surface, intent: null, root: [], nodes: new Map(), seq: new Map(), counter: 0, parent: new Map(),
    names: new Map(), data: {}, dataSize: 2, actions: null, sources: null, ended: false
  };
  if (typeof input.intent === 'string' && Object.hasOwn(catalog.intents, input.intent)) {
    track.intent = /** @type {SurfaceIntent} */ (input.intent);
  } else {
    const allowed = Object.keys(catalog.intents);
    report(ctx, 'unknown-intent', `Unknown intent ${JSON.stringify(input.intent ?? null)}; this surface may use ${allowed.join(', ')}. Without an intent it shows no controls.`, { path: '/intent' });
  }
  track.title = text(input, 'title', LIMITS.label, ctx, { required: true });
  const author = text(input, 'author', LIMITS.name, ctx, { required: true });
  if (author !== undefined && !NAME.test(author)) report(ctx, 'invalid-value', '"author" is a key: letters, digits, "_", "." or "-"', { path: '/author' });
  else track.author = author;
  track.description = text(input, 'description', LIMITS.description, ctx);
  if (present(input.placement)) {
    if (PLACEMENTS.includes(/** @type {SurfacePlacement} */ (input.placement))) track.placement = /** @type {SurfacePlacement} */ (input.placement);
    else report(ctx, 'invalid-value', `"placement" must be one of ${PLACEMENTS.join(', ')}`, { path: '/placement' });
  }
  state.surfaces.set(ctx.surface, track);
  /** @type {SurfaceOp[]} */
  const lifted = [];
  if (present(input.root)) {
    track.root = childList(input.root, ROOT, track, catalog, ctx, '/root', lifted);
  } else {
    report(ctx, 'missing', '"begin" needs "root", the list of top-level node ids', { path: '/root' });
  }
  /** @type {SurfaceOp} */
  const op = { op: 'begin', zx: SURFACE_VERSION, surface: ctx.surface, intent: track.intent, root: [...track.root] };
  for (const key of /** @type {const} */ (['title', 'author', 'placement', 'description'])) {
    if (track[key] !== undefined) /** @type {Record<string, unknown>} */ (op)[key] = track[key];
  }
  return { op, errors: ctx.errors, ops: [op, ...lifted] };
}

/**
 * @param {Record<string, unknown>} raw @param {SurfaceTrack} track @param {SurfaceCatalog} catalog
 * @param {Context} ctx @returns {OpResult}
 */
function validateNodeOp(raw, track, catalog, ctx) {
  const input = sanitizeOp(raw, ctx);
  /** @type {SurfaceOp[]} */
  const lifted = [];
  const node = validateNode(input, track, catalog, ctx, '', lifted);
  if (!node) return { op: null, errors: ctx.errors, ops: [] };
  const op = /** @type {SurfaceOp} */ ({ op: 'node', surface: ctx.surface, ...node });
  return { op, errors: ctx.errors, ops: [op, ...lifted] };
}

/**
 * Validates a node and records it. Returns the node as it may be applied, or null when refused.
 * @param {Record<string, unknown>} input Sanitized node, possibly still carrying `op` and `surface`.
 * @param {SurfaceTrack} track @param {SurfaceCatalog} catalog @param {Context} ctx
 * @param {string} path Where the node is inside the operation.
 * @param {SurfaceOp[]} lifted Receives the node operations of lifted inline children.
 * @returns {SurfaceNode|null}
 */
function validateNode(input, track, catalog, ctx, path, lifted) {
  const id = input.id;
  if (typeof id !== 'string' || !ID.test(id)) {
    report(ctx, typeof id === 'string' ? 'invalid-value' : 'missing', 'A node needs an "id" of letters, digits, "_", ".", ":" or "-"', { path: `${path}/id` });
    return null;
  }
  const exists = track.nodes.has(id);
  if (!exists && track.nodes.size >= LIMITS.nodes) {
    report(ctx, 'limit', `A surface has at most ${LIMITS.nodes} nodes`, { id, path });
    return null;
  }
  const type = input.type;
  /** @type {SurfaceNode} */
  const node = { id, type: typeof type === 'string' ? type : '' };
  const entry = typeof type === 'string' && Object.hasOwn(catalog.nodes, type) ? catalog.nodes[type] : undefined;

  const release = () => {
    if (!exists) return;
    for (const [name, owner] of track.names) if (owner.owner === id) track.names.delete(name);
    for (const [child, parent] of track.parent) if (parent === id) track.parent.delete(child);
  };
  const record = () => {
    release();
    track.nodes.set(id, node);
    if (!track.seq.has(id)) track.seq.set(id, track.counter++);
  };

  if (!entry) {
    const known = typeof type === 'string' && Object.hasOwn(CATALOG.nodes, type);
    report(ctx, typeof type === 'string' ? 'unknown-type' : 'missing', typeof type !== 'string'
      ? 'A node needs a "type"'
      : known ? `The node type "${type}" is not available in this surface` : `Unknown node type "${type}"; use one of ${Object.keys(catalog.nodes).join(', ')}`, { id, path: `${path}/type` });
    record();
    return node;
  }
  if (entry.intentOnly && entry.intentOnly !== track.intent) {
    report(ctx, 'not-allowed', `A "${entry.type}" node belongs only in a "${entry.intentOnly}" surface`, { id, path: `${path}/type` });
    record();
    return node;
  }
  const inputsBarred = track.intent !== null && INPUT_INTENTS_EXCLUDED.has(track.intent);
  if (entry.input && entry.type !== 'table' && inputsBarred) {
    report(ctx, 'not-allowed', `A "${track.intent}" surface takes no inputs; "${entry.type}" is one`, { id, path: `${path}/type` });
    record();
    return node;
  }

  const allowed = new Set(['op', 'surface', 'id', 'type', 'visible', ...Object.keys(entry.props)]);
  if (entry.children) allowed.add('children');
  for (const key of Object.keys(input)) {
    if (allowed.has(key) || input[key] === null) continue;
    unknownKey(key, ctx, `${path}/${escapeKey(key)}`, id);
  }

  release();
  for (const [name, member] of Object.entries(entry.props)) {
    if (!present(input[name])) continue;
    const at = `${path}/${escapeKey(name)}`;
    const value = input[name];
    if (isBinding(value)) {
      if (UNBOUND_PROPS.has(name)) {
        report(ctx, 'not-allowed', `"${name}" defines the surface's inputs and cannot be bound to data; write it into the node`, { id, path: at });
        continue;
      }
      const pointer = bindingPointer(value.$data, ctx, `${at}/$data`, id);
      if (pointer !== null) node[name] = { $data: pointer };
      continue;
    }
    const checked = checkProp(member, name, value, ctx, at, input, id);
    if (checked !== undefined) node[name] = checked;
  }

  if (entry.type === 'table' && present(node.selectable)) {
    if (inputsBarred) {
      report(ctx, 'not-allowed', `A "${track.intent}" surface takes no inputs; the table is shown without selection`, { id, path: `${path}/selectable` });
      delete node.selectable;
    } else {
      for (const needed of ['name', 'rowId']) {
        if (!present(node[needed])) {
          report(ctx, 'missing', `A selectable table needs "${needed}"; it is shown without selection`, { id, path: `${path}/${needed}` });
          delete node.selectable;
        }
      }
    }
  }

  // Input names: unique within the surface, and the order conditions may rely on.
  const seq = track.seq.get(id) ?? track.counter;
  if (entry.input && typeof node.name === 'string' && (entry.type !== 'table' || node.selectable)) {
    const owner = track.names.get(node.name);
    if (owner && owner.owner !== id) {
      report(ctx, 'duplicate-name', `The input name "${node.name}" is already used in this surface`, { id, path: `${path}/name` });
      delete node.name;
    }
  }
  /** @type {string[]} */
  const fieldNames = [];
  if (entry.type === 'fields' && isObject(node.schema) && isObject(node.schema.properties)) {
    const schema = /** @type {{properties: Record<string, any>, required?: string[]}} */ (node.schema);
    let room = LIMITS.fields - countFields(track, id);
    for (const name of Object.keys(schema.properties)) {
      const owner = track.names.get(name);
      if (owner && owner.owner !== id) {
        report(ctx, 'duplicate-name', `The input name "${name}" is already used in this surface`, { id, path: `${path}/schema/properties/${escapeKey(name)}` });
        dropProperty(schema, name);
        continue;
      }
      if (room <= 0) {
        report(ctx, 'limit', `A surface has at most ${LIMITS.fields} fields`, { id, path: `${path}/schema/properties/${escapeKey(name)}` });
        dropProperty(schema, name);
        continue;
      }
      room -= 1;
      fieldNames.push(name);
    }
  }

  // Conditions: the grammar now. Which inputs come earlier depends on the tree, which is only
  // known at `end`; there the order is checked depth first from `root`. Within one schema the
  // order is already known, so a property naming itself or a later property is dropped now.
  if (present(input.visible)) {
    const own = new Set(entry.type === 'fields' && isObject(node.schema) && isObject(node.schema.properties) ? Object.keys(node.schema.properties) : []);
    const visible = checkVisible(input.visible, null, ctx, `${path}/visible`, id, 'node', own);
    if (visible) node.visible = visible;
  }
  if (entry.type === 'fields' && isObject(node.schema) && isObject(node.schema.properties)) {
    const schema = /** @type {{properties: Record<string, any>}} */ (node.schema);
    const names = Object.keys(schema.properties);
    names.forEach((name, index) => {
      const hint = schema.properties[name]['x-zx'];
      if (isObject(hint) && present(hint.visible)) {
        const visible = checkVisible(hint.visible, null, ctx, `${path}/schema/properties/${escapeKey(name)}/x-zx/visible`, id, 'node', new Set(names.slice(index)));
        if (visible) hint.visible = visible;
        else delete hint.visible;
        if (!Object.keys(hint).length) delete schema.properties[name]['x-zx'];
      }
    });
  }

  // Recorded before its children, so a lifted child finds its parent and follows it in order.
  record();
  if (entry.children && present(input.children)) {
    node.children = childList(input.children, id, track, catalog, ctx, `${path}/children`, lifted, id);
  }
  if (entry.input && typeof node.name === 'string' && (entry.type !== 'table' || node.selectable)) {
    track.names.set(node.name, { owner: id, seq: track.seq.get(id) ?? seq });
  }
  for (const name of fieldNames) track.names.set(name, { owner: id, seq: track.seq.get(id) ?? seq });
  if (node.children) for (const child of node.children) track.parent.set(child, id);
  return node;
}

/**
 * Checks a list of child ids, applies the repairs, and lifts inline children.
 * @param {unknown} value @param {string} parentId `ROOT` or the node's id
 * @param {SurfaceTrack} track @param {SurfaceCatalog} catalog @param {Context} ctx
 * @param {string} path @param {SurfaceOp[]} lifted @param {string} [nodeId]
 * @returns {string[]}
 */
function childList(value, parentId, track, catalog, ctx, path, lifted, nodeId) {
  const key = parentId === ROOT ? '"root"' : '"children"';
  if (typeof value === 'string') {
    report(ctx, 'wrapped-list', `${key} must be a list of ids; the single id was wrapped in one`, { id: nodeId, path, repaired: true });
  } else if (!Array.isArray(value)) {
    report(ctx, 'invalid-value', `${key} must be a list of node ids`, { id: nodeId, path });
    return [];
  }
  /** @type {unknown[]} */
  let list = typeof value === 'string' ? [value] : /** @type {unknown[]} */ (value);
  if (list.length > LIMITS.nodes) {
    report(ctx, 'limit', `${key} lists at most ${LIMITS.nodes} ids; the rest were dropped`, { id: nodeId, path });
    list = list.slice(0, LIMITS.nodes);
  }
  const ancestors = new Set(parentId === ROOT ? [] : [parentId, ...ancestorsOf(parentId, track)]);
  const parentDepth = parentId === ROOT ? 0 : depthOf(parentId, track);
  /** @type {string[]} */
  const ids = [];
  /** @type {Array<{node: Record<string, unknown>, path: string}>} */
  const inline = [];
  list.forEach((child, index) => {
    const at = `${path}/${index}`;
    let id = child;
    if (isObject(child)) {
      if (typeof child.id !== 'string' || !ID.test(child.id) || typeof child.type !== 'string') {
        report(ctx, 'invalid-value', 'An inline child needs an "id" and a "type"; send it as its own "node" operation and list its id', { id: nodeId, path: at });
        return;
      }
      report(ctx, 'lifted-child', `The inline node "${child.id}" was lifted out as its own node; list its id instead`, { id: child.id, path: at, repaired: true });
      inline.push({ node: child, path: at });
      id = child.id;
    }
    if (typeof id !== 'string' || !ID.test(id)) {
      report(ctx, 'invalid-value', `${key} must hold node ids`, { id: nodeId, path: at });
      return;
    }
    if (ids.includes(id)) {
      report(ctx, 'cycle', `"${id}" is listed twice`, { id: nodeId, path: at });
      return;
    }
    if (ancestors.has(id)) {
      report(ctx, 'cycle', `"${id}" cannot be a child of itself or of its own descendant`, { id: nodeId, path: at });
      return;
    }
    const placed = track.parent.get(id);
    if (placed !== undefined && placed !== parentId && stillLists(placed, id, track)) {
      report(ctx, 'cycle', `"${id}" is already placed elsewhere; a node has one place`, { id: nodeId, path: at });
      return;
    }
    if (parentDepth !== null && parentDepth + 1 > LIMITS.depth) {
      report(ctx, 'limit', `The node tree is at most ${LIMITS.depth} deep`, { id: nodeId, path: at });
      return;
    }
    ids.push(id);
  });
  // Children are placed before the inline ones are validated, so those know their depth.
  for (const id of ids) track.parent.set(id, parentId);
  for (const { node, path: at } of inline) {
    if (!ids.includes(/** @type {string} */ (node.id))) continue;
    const sub = validateNode(node, track, catalog, ctx, at, lifted);
    if (sub) lifted.push(/** @type {SurfaceOp} */ ({ op: 'node', surface: ctx.surface, ...sub }));
  }
  // A lifted child's own lifted children were pushed before it; put every parent before its children.
  lifted.sort((a, b) => (track.seq.get(/** @type {{id: string}} */ (a).id) ?? 0) - (track.seq.get(/** @type {{id: string}} */ (b).id) ?? 0));
  return ids;
}

/**
 * @param {Record<string, unknown>} raw @param {SurfaceTrack} track @param {SurfaceCatalog} catalog
 * @param {Context} ctx @returns {OpResult}
 */
function validatePatch(raw, track, catalog, ctx) {
  const input = sanitizeOp(raw, ctx);
  checkKeys(input, ['op', 'surface', 'id', 'props'], ctx, '');
  const refused = { op: null, errors: ctx.errors, ops: [] };
  const id = input.id;
  const existing = typeof id === 'string' ? track.nodes.get(id) : undefined;
  if (!existing) {
    report(ctx, 'unknown-node', `There is no node ${JSON.stringify(id ?? null)} to patch`, { path: '/id' });
    return refused;
  }
  if (!isObject(input.props)) {
    report(ctx, 'invalid-value', '"patch" needs "props", an object of properties', { id: existing.id, path: '/props' });
    return refused;
  }
  const props = input.props;
  /** @type {Record<string, unknown>} */
  const merged = { ...existing };
  for (const [key, value] of Object.entries(props)) {
    if (key === 'id' || key === 'type') {
      report(ctx, 'not-allowed', `A patch cannot change "${key}"; send a whole "node" instead`, { id: existing.id, path: `/props/${key}` });
      continue;
    }
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  /** @type {SurfaceOp[]} */
  const lifted = [];
  // Errors on the merged node can only come from what the patch sets: the rest was clean already.
  let node = validateNode(merged, track, catalog, { ...ctx, at: (path) => ctx.at(path.replace(/^(\/[^/]+)/, '/props$1')) }, '', lifted);
  if (!node) return refused;
  // A value the patch could not set leaves the current one in place, rather than removing it.
  const kept = Object.keys(props).filter((key) => key !== 'id' && key !== 'type' && props[key] !== null
    && !Object.hasOwn(node, key) && Object.hasOwn(existing, key));
  if (kept.length) {
    for (const key of kept) merged[key] = existing[key];
    node = validateNode(merged, track, catalog, { ...ctx, errors: [] }, '', []) ?? node;
  }
  /** @type {Record<string, unknown>} */
  const applied = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === 'id' || key === 'type') continue;
    if (kept.includes(key)) continue;
    if (Object.hasOwn(node, key)) applied[key] = node[key];
    else if (value === null || Object.hasOwn(existing, key)) applied[key] = null;
  }
  // The fields' own conditions may have been cleaned as the merged node was checked.
  if (Object.hasOwn(props, 'schema') && Object.hasOwn(node, 'schema') && !kept.includes('schema')) applied.schema = node.schema;
  const op = /** @type {SurfaceOp} */ ({ op: 'patch', surface: ctx.surface, id: existing.id, props: clone(applied) });
  return { op, errors: ctx.errors, ops: [op, ...lifted] };
}

/**
 * @param {Record<string, unknown>} raw @param {SurfaceTrack} track @param {Context} ctx
 * @returns {OpResult}
 */
function validateAppend(raw, track, ctx) {
  const input = sanitizeOp(raw, ctx);
  checkKeys(input, ['op', 'surface', 'id', 'text'], ctx, '');
  const refused = { op: null, errors: ctx.errors, ops: [] };
  const node = typeof input.id === 'string' ? track.nodes.get(input.id) : undefined;
  if (!node) {
    report(ctx, 'unknown-node', `There is no node ${JSON.stringify(input.id ?? null)} to append to`, { path: '/id' });
    return refused;
  }
  if (node.type !== 'text' || isBinding(node.text)) {
    report(ctx, 'not-allowed', '"append" adds text to a "text" node whose text is not bound to data', { id: node.id, path: '/id' });
    return refused;
  }
  if (typeof input.text !== 'string') {
    report(ctx, 'invalid-value', '"append" needs "text"', { id: node.id, path: '/text' });
    return refused;
  }
  const current = typeof node.text === 'string' ? node.text : '';
  if (current.length + input.text.length > LIMITS.string) {
    report(ctx, 'limit', `A text node holds at most ${LIMITS.string} characters`, { id: node.id, path: '/text' });
    return refused;
  }
  node.text = current + input.text;
  const op = /** @type {SurfaceOp} */ ({ op: 'append', surface: ctx.surface, id: node.id, text: input.text });
  return { op, errors: ctx.errors, ops: [op] };
}

/**
 * @param {Record<string, unknown>} raw @param {SurfaceTrack} track @param {Context} ctx
 * @returns {OpResult}
 */
function validateRemove(raw, track, ctx) {
  const input = sanitizeOp(raw, ctx);
  checkKeys(input, ['op', 'surface', 'id'], ctx, '');
  const id = input.id;
  if (typeof id !== 'string' || !track.nodes.has(id)) {
    report(ctx, 'unknown-node', `There is no node ${JSON.stringify(id ?? null)} to remove`, { path: '/id' });
    return { op: null, errors: ctx.errors, ops: [] };
  }
  track.nodes.delete(id);
  for (const [name, owner] of track.names) if (owner.owner === id) track.names.delete(name);
  for (const [child, parent] of track.parent) if (parent === id) track.parent.delete(child);
  const parent = track.parent.get(id);
  track.parent.delete(id);
  if (parent === ROOT) track.root = track.root.filter((entry) => entry !== id);
  else if (parent !== undefined) {
    const holder = track.nodes.get(parent);
    if (holder?.children) holder.children = holder.children.filter((entry) => entry !== id);
  }
  const op = /** @type {SurfaceOp} */ ({ op: 'remove', surface: ctx.surface, id });
  return { op, errors: ctx.errors, ops: [op] };
}

/**
 * @param {Record<string, unknown>} raw @param {SurfaceTrack} track @param {Context} ctx
 * @returns {OpResult}
 */
function validateData(raw, track, ctx) {
  const input = sanitizeOp(raw, ctx);
  const removing = input.remove === true;
  checkKeys(input, removing ? ['op', 'surface', 'path', 'remove'] : ['op', 'surface', 'path', 'value', 'remove'], ctx, '');
  const refused = { op: null, errors: ctx.errors, ops: [] };
  const path = input.path;
  if (typeof path !== 'string') {
    report(ctx, 'missing', '"data" needs a "path", a JSON Pointer such as "/rows"', { path: '/path' });
    return refused;
  }
  try {
    parsePointer(path);
  } catch (error) {
    report(ctx, 'pointer-invalid', `${error instanceof Error ? error.message : 'Invalid pointer'}`, { path: '/path' });
    return refused;
  }
  if (present(input.remove) && input.remove !== true) {
    report(ctx, 'invalid-value', '"remove" is true or left out', { path: '/remove' });
    return refused;
  }
  if (!removing && !Object.hasOwn(input, 'value')) {
    report(ctx, 'missing', '"data" needs a "value", or "remove": true', { path: '/value' });
    return refused;
  }
  if (removing && path === '') {
    report(ctx, 'invalid-value', 'The whole data cannot be removed; set "/" paths one by one, or replace it with {}', { path: '/path' });
    return refused;
  }
  if (!removing && path === '' && !isObject(input.value)) {
    report(ctx, 'invalid-value', 'The whole data must be an object', { path: '/value' });
    return refused;
  }
  const applied = applyData(track, parsePointer(path), removing, input.value);
  if (typeof applied === 'object') {
    report(ctx, applied.code, applied.message, { path: applied.code === 'limit' && !removing ? '/value' : '/path' });
    return refused;
  }
  const op = /** @type {SurfaceOp} */ (removing
    ? { op: 'data', surface: ctx.surface, path, remove: true }
    : { op: 'data', surface: ctx.surface, path, value: clone(input.value) });
  return { op, errors: ctx.errors, ops: [op] };
}

/**
 * Stores or removes a data value in place. The whole tree stays within the value depth, and its
 * JSON size is kept up to date from what changes, so an operation costs what it touches rather
 * than what the surface already holds.
 * @param {SurfaceTrack} track @param {string[]} segments @param {boolean} removing @param {unknown} value
 * @returns {true|{code: SurfaceErrorCode, message: string}}
 */
function applyData(track, segments, removing, value) {
  const pointer = `/${segments.join('/')}`;
  if (!removing && segments.length + depthOfValue(value) > LIMITS.value) {
    return { code: 'limit', message: `The data nests at most ${LIMITS.value} levels deep, counting the path` };
  }
  const tooBig = { code: /** @type {SurfaceErrorCode} */ ('limit'), message: `A surface holds at most ${LIMITS.data.toLocaleString('en-US')} characters of data` };
  if (segments.length === 0) {
    const size = jsonLength(value);
    if (size > LIMITS.data) return tooBig;
    track.data = /** @type {Record<string, unknown>} */ (clone(value));
    track.dataSize = size;
    return true;
  }
  /** @type {unknown} */
  let parent = track.data;
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(parent)) {
      if (!ARRAY_INDEX.test(segment) || Number(segment) >= parent.length) return { code: 'data-path', message: `The path "${pointer}" has no parent to hold the value; set the parent first` };
      parent = parent[Number(segment)];
    } else if (isObject(parent)) {
      if (!Object.hasOwn(parent, segment)) return { code: 'data-path', message: `The path "${pointer}" has no parent to hold the value; set the parent first` };
      parent = parent[segment];
    } else {
      return { code: 'data-path', message: `The path "${pointer}" runs through a value that is not an object or a list` };
    }
  }
  const key = /** @type {string} */ (segments.at(-1));
  if (Array.isArray(parent)) {
    const index = key === '-' ? parent.length : ARRAY_INDEX.test(key) ? Number(key) : -1;
    const exists = index >= 0 && index < parent.length;
    if (index < 0 || index > parent.length || (removing && !exists)) return { code: 'data-path', message: `"${key}" is not an index of the list at "${pointer}"` };
    if (removing) {
      track.dataSize -= jsonLength(parent[index]) + (parent.length > 1 ? 1 : 0);
      parent.splice(index, 1);
      return true;
    }
    const size = track.dataSize + jsonLength(value) - (exists ? jsonLength(parent[index]) : (parent.length ? -1 : 0));
    if (size > LIMITS.data) return tooBig;
    parent[index] = clone(value);
    track.dataSize = size;
    return true;
  }
  if (!isObject(parent)) return { code: 'data-path', message: `The path "${pointer}" runs through a value that is not an object or a list` };
  const exists = Object.hasOwn(parent, key);
  const member = JSON.stringify(key).length + 1;
  if (removing) {
    if (!exists) return { code: 'data-path', message: `There is nothing at "${pointer}" to remove` };
    track.dataSize -= member + jsonLength(parent[key]) + (Object.keys(parent).length > 1 ? 1 : 0);
    delete parent[key];
    return true;
  }
  const size = track.dataSize + jsonLength(value) - (exists ? jsonLength(parent[key]) : -(member + (Object.keys(parent).length ? 1 : 0)));
  if (size > LIMITS.data) return tooBig;
  parent[key] = clone(value);
  track.dataSize = size;
  return true;
}

/** @param {unknown} value @returns {number} Characters of the value written as JSON. */
function jsonLength(value) {
  return JSON.stringify(value).length;
}

/** @param {unknown} value @param {number} [level=0] @returns {number} Nesting of objects and lists; 0 for a scalar. */
function depthOfValue(value, level = 0) {
  if (value === null || typeof value !== 'object' || level > LIMITS.value) return 0;
  let deepest = 0;
  for (const member of Object.values(value)) deepest = Math.max(deepest, depthOfValue(member, level + 1));
  return deepest + 1;
}

/**
 * @param {Record<string, unknown>} raw @param {SurfaceTrack} track @param {Context} ctx
 * @returns {OpResult}
 */
function validateActions(raw, track, ctx) {
  const input = sanitizeOp(raw, ctx);
  checkKeys(input, ['op', 'surface', 'items'], ctx, '');
  if (!Array.isArray(input.items)) {
    report(ctx, 'invalid-value', '"actions" needs "items", a list of actions', { path: '/items' });
    return { op: null, errors: ctx.errors, ops: [] };
  }
  let items = /** @type {unknown[]} */ (input.items);
  if (track.intent === 'questionnaire' && items.length) {
    report(ctx, 'not-allowed', 'A questionnaire answers with its own steps; its actions were dropped', { path: '/items' });
    items = [];
  }
  if (items.length > LIMITS.actions) {
    report(ctx, 'limit', `A surface has at most ${LIMITS.actions} actions; the rest were dropped`, { path: '/items' });
    items = items.slice(0, LIMITS.actions);
  }
  /** @type {SurfaceAction[]} */
  const actions = [];
  items.forEach((item, index) => {
    const action = checkAction(item, ctx, `/items/${index}`);
    if (!action) return;
    if (RESERVED_ACTIONS.includes(action.id)) {
      report(ctx, 'not-allowed', `The action id "${action.id}" is reserved for closing the surface; the action was dropped`, { id: action.id, path: `/items/${index}/id` });
      return;
    }
    if (actions.some((other) => other.id === action.id)) {
      report(ctx, 'invalid-value', `The action id "${action.id}" is used twice`, { id: action.id, path: `/items/${index}/id` });
      return;
    }
    actions.push(action);
  });
  track.actions = actions;
  const op = /** @type {SurfaceOp} */ ({ op: 'actions', surface: ctx.surface, items: clone(actions) });
  return { op, errors: ctx.errors, ops: [op] };
}

/**
 * @param {unknown} item @param {Context} ctx @param {string} path
 * @returns {SurfaceAction|null}
 */
function checkAction(item, ctx, path) {
  if (!isObject(item)) {
    report(ctx, 'invalid-value', 'An action must be an object', { path });
    return null;
  }
  for (const key of Object.keys(item)) {
    if (['id', 'label', 'kind', 'tool', 'description'].includes(key) || item[key] === null) continue;
    if (CONFIRMATION_KEYS.has(key)) {
      report(ctx, 'confirmation-ignored', 'An action cannot set its own confirmation; the application decides what each action needs', { id: typeof item.id === 'string' ? item.id : undefined, path: `${path}/${escapeKey(key)}` });
    } else {
      unknownKey(key, ctx, `${path}/${escapeKey(key)}`, typeof item.id === 'string' ? item.id : undefined);
    }
  }
  if (typeof item.id !== 'string' || !ID.test(item.id)) {
    report(ctx, typeof item.id === 'string' ? 'invalid-value' : 'missing', 'An action needs an "id" of letters, digits, "_", ".", ":" or "-"', { path: `${path}/id` });
    return null;
  }
  const id = item.id;
  const label = text(item, 'label', LIMITS.label, ctx, { required: true, base: path, id });
  if (!label || !label.trim()) {
    if (label !== undefined) report(ctx, 'missing', 'An action needs a "label"', { id, path: `${path}/label` });
    return null;
  }
  /** @type {SurfaceAction} */
  const action = { id, label };
  if (present(item.kind)) {
    if (['primary', 'secondary', 'danger'].includes(/** @type {string} */ (item.kind))) action.kind = /** @type {SurfaceAction['kind']} */ (item.kind);
    else report(ctx, 'invalid-value', '"kind" must be primary, secondary or danger', { id, path: `${path}/kind` });
  }
  const tool = text(item, 'tool', 128, ctx, { base: path, id });
  if (tool !== undefined) {
    if (/^[A-Za-z0-9_][A-Za-z0-9_.:/-]*$/.test(tool)) action.tool = tool;
    else report(ctx, 'invalid-value', '"tool" names a tool: letters, digits, "_", ".", ":", "/" or "-"', { id, path: `${path}/tool` });
  }
  const description = text(item, 'description', LIMITS.description, ctx, { base: path, id });
  if (description !== undefined) action.description = description;
  return action;
}

/**
 * Ends a surface and checks it as a whole: required properties, the intent's needs, the tree and
 * the order of the inputs its conditions name.
 * @param {Record<string, unknown>} raw @param {SurfaceTrack} track @param {SurfaceCatalog} catalog
 * @param {Context} ctx @returns {OpResult}
 */
function validateEnd(raw, track, catalog, ctx) {
  const input = sanitizeOp(raw, ctx);
  checkKeys(input, ['op', 'surface', 'sources'], ctx, '');
  /** @type {SurfaceOp} */
  const op = { op: 'end', surface: ctx.surface };
  if (present(input.sources)) {
    const sources = checkSources(input.sources, ctx);
    if (sources) {
      op.sources = sources;
      track.sources = sources;
    }
  }
  /** @type {SurfaceOp[]} */
  const patches = [];
  const at = (/** @type {string} */ id) => `/nodes/${escapeKey(id)}`;

  // Depth-first from root: the order inputs are declared in, the depth, and what is missing.
  /** @type {Set<string>} */
  const reached = new Set();
  const seen = new Set();
  /** @type {Array<{id: string, depth: number}>} */
  const stack = [...track.root].reverse().map((id) => ({ id, depth: 1 }));
  while (stack.length) {
    const { id, depth } = /** @type {{id: string, depth: number}} */ (stack.pop());
    if (reached.has(id)) continue;
    const node = track.nodes.get(id);
    if (!node) {
      report(ctx, 'missing-node', `The node "${id}" is listed but was never sent`, { id });
      continue;
    }
    reached.add(id);
    const entry = Object.hasOwn(catalog.nodes, node.type) ? catalog.nodes[node.type] : undefined;
    // Conditions against the inputs that come earlier in the tree.
    if (node.visible) {
      const problems = checkCondition(node.visible, { fields: seen, maxDepth: MAX_CONDITION_DEPTH });
      if (problems.length) {
        report(ctx, 'condition', `The condition of "${id}" names an input that does not exist or does not come before it in the surface; the condition was dropped and the node stays visible`, { id, path: `${at(id)}/visible` });
        delete node.visible;
        patches.push(/** @type {SurfaceOp} */ ({ op: 'patch', surface: ctx.surface, id, props: { visible: null } }));
      }
    }
    if (node.type === 'fields' && isObject(node.schema) && isObject(node.schema.properties)) {
      const schema = /** @type {{properties: Record<string, any>}} */ (node.schema);
      const local = new Set(seen);
      let changed = false;
      for (const name of Object.keys(schema.properties)) {
        const hint = schema.properties[name]['x-zx'];
        if (isObject(hint) && hint.visible && checkCondition(hint.visible, { fields: local, maxDepth: MAX_CONDITION_DEPTH }).length) {
          report(ctx, 'condition', `The field "${name}" names an input that does not exist or does not come before it; its condition was dropped and it stays visible`, { id, path: `${at(id)}/schema/properties/${escapeKey(name)}/x-zx/visible` });
          delete hint.visible;
          if (!Object.keys(hint).length) delete schema.properties[name]['x-zx'];
          changed = true;
        }
        local.add(name);
      }
      if (changed) patches.push(/** @type {SurfaceOp} */ ({ op: 'patch', surface: ctx.surface, id, props: { schema: clone(node.schema) } }));
    }
    for (const [name, owner] of track.names) if (owner.owner === id) seen.add(name);
    if (entry) {
      for (const [name, member] of Object.entries(entry.props)) {
        if (member.required && !present(node[name])) {
          report(ctx, 'missing', `The "${node.type}" node "${id}" needs "${name}"; it is shown as a placeholder`, { id, path: `${at(id)}/${escapeKey(name)}` });
        }
      }
    }
    if (Array.isArray(node.children)) {
      const kept = [];
      for (const child of node.children) {
        if (depth + 1 > LIMITS.depth) {
          report(ctx, 'limit', `The node tree is at most ${LIMITS.depth} deep; "${child}" was dropped`, { id, path: `${at(id)}/children` });
          continue;
        }
        kept.push(child);
      }
      if (kept.length !== node.children.length) {
        node.children = kept;
        patches.push(/** @type {SurfaceOp} */ ({ op: 'patch', surface: ctx.surface, id, props: { children: [...kept] } }));
      }
      for (let index = kept.length - 1; index >= 0; index -= 1) stack.push({ id: kept[index], depth: depth + 1 });
    }
  }
  for (const id of track.nodes.keys()) {
    if (!reached.has(id)) report(ctx, 'unreachable', `The node "${id}" is not listed in "root" or any "children"; it is not shown`, { id });
  }

  // The intent's needs.
  if (track.intent) {
    const entry = Object.hasOwn(catalog.intents, track.intent) ? catalog.intents[track.intent] : undefined;
    const shown = [...reached].map((id) => /** @type {SurfaceNode} */ (track.nodes.get(id)));
    const usable = (/** @type {SurfaceNode} */ node) => entry?.requires.includes(node.type) && (node.type !== 'table' || Boolean(node.selectable));
    if (entry && entry.requires.length) {
      const found = shown.filter(usable);
      if (!found.length) {
        const what = entry.requires.map((type) => (type === 'table' ? 'a selectable "table"' : `a "${type}"`)).join(' or ');
        report(ctx, 'needs', `A "${track.intent}" surface needs ${what} node`, { path: '/intent' });
      } else if ((track.intent === 'choose' || track.intent === 'questionnaire') && found.length > 1) {
        report(ctx, 'needs', `A "${track.intent}" surface has exactly one "${entry.requires[0]}" node`, { path: '/intent' });
      }
    }
  }
  track.ended = true;
  return { op, errors: ctx.errors, ops: [...patches, op] };
}

/**
 * @param {unknown} value @param {Context} ctx
 * @returns {SurfaceSource[]|null}
 */
function checkSources(value, ctx) {
  if (!Array.isArray(value)) {
    report(ctx, 'invalid-value', '"sources" must be a list', { path: '/sources' });
    return null;
  }
  let list = value;
  if (list.length > LIMITS.sources) {
    report(ctx, 'limit', `At most ${LIMITS.sources} sources; the rest were dropped`, { path: '/sources' });
    list = list.slice(0, LIMITS.sources);
  }
  /** @type {SurfaceSource[]} */
  const sources = [];
  list.forEach((item, index) => {
    const path = `/sources/${index}`;
    if (!isObject(item)) {
      report(ctx, 'invalid-value', 'A source must be an object', { path });
      return;
    }
    checkKeys(item, ['n', 'title', 'call', 'ref'], ctx, path);
    if (!Number.isInteger(item.n) || /** @type {number} */ (item.n) < 1 || /** @type {number} */ (item.n) > 999) {
      report(ctx, 'invalid-value', 'A source needs "n", the number of its [n] marker', { path: `${path}/n` });
      return;
    }
    /** @type {SurfaceSource} */
    const source = { n: /** @type {number} */ (item.n) };
    const title = text(item, 'title', LIMITS.label, ctx, { base: path });
    if (title !== undefined) source.title = title;
    const call = text(item, 'call', 128, ctx, { base: path });
    if (call !== undefined) source.call = call;
    if (present(item.ref)) {
      const ref = checkRef(item.ref, ctx, `${path}/ref`);
      if (ref) source.ref = ref;
    }
    if (sources.some((other) => other.n === source.n)) {
      report(ctx, 'invalid-value', `Source ${source.n} is listed twice`, { path: `${path}/n` });
      return;
    }
    sources.push(source);
  });
  return sources;
}

/* ------------------------------------------------------------------------------------------------
 * Values
 * --------------------------------------------------------------------------------------------- */

/**
 * Removes what may not appear anywhere in an operation: forbidden keys, values that are not JSON,
 * numbers that are not finite, strings over the limit and nesting past the value depth. Returns a
 * copy; the input is never changed.
 * @param {Record<string, unknown>} raw @param {Context} ctx
 * @returns {Record<string, unknown>}
 */
function sanitizeOp(raw, ctx) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(raw)) {
    const value = sanitize(raw[key], `/${escapeKey(key)}`, 2, ctx, key);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * @param {unknown} value @param {string} path @param {number} depth @param {Context} ctx
 * @param {string} [key] The key holding the value, to report forbidden keys.
 * @returns {unknown} The cleaned value, or `undefined` when it is dropped.
 */
function sanitize(value, path, depth, ctx, key) {
  if (key !== undefined && FORBIDDEN.has(key)) {
    report(ctx, 'forbidden-key', `The key "${key}" is not allowed`, { path });
    return undefined;
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    report(ctx, 'not-finite', 'Numbers must be finite', { path });
    return undefined;
  }
  if (typeof value === 'string') {
    if (value.length <= LIMITS.string) return value;
    report(ctx, 'limit', `Strings hold at most ${LIMITS.string} characters`, { path });
    return undefined;
  }
  if (typeof value !== 'object' || value instanceof Date) {
    report(ctx, 'invalid-value', 'Only JSON values are allowed', { path });
    return undefined;
  }
  if (depth > LIMITS.value) {
    report(ctx, 'limit', `Values nest at most ${LIMITS.value} levels deep`, { path });
    return undefined;
  }
  if (Array.isArray(value)) {
    if (value.length > LIMITS.rows) {
      report(ctx, 'limit', `Lists hold at most ${LIMITS.rows} entries`, { path });
      return undefined;
    }
    /** @type {unknown[]} */
    const out = [];
    value.forEach((entry, index) => {
      const clean = sanitize(entry, `${path}/${index}`, depth + 1, ctx);
      if (clean !== undefined) out.push(clean);
    });
    return out;
  }
  const keys = Object.keys(value);
  if (keys.length > LIMITS.rows) {
    report(ctx, 'limit', `Objects hold at most ${LIMITS.rows} keys`, { path });
    return undefined;
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const member of keys) {
    const clean = sanitize(/** @type {Record<string, unknown>} */ (value)[member], `${path}/${escapeKey(member)}`, depth + 1, ctx, member);
    if (clean !== undefined) out[member] = clean;
  }
  if (Object.hasOwn(out, '$ref')) return checkRef(out, ctx, path) ?? undefined;
  if (Object.hasOwn(out, '$asset')) return checkAsset(out, ctx, path) ?? undefined;
  return out;
}

/**
 * Checks a property's value against its catalog entry.
 * @param {CatalogProp} member @param {string} name @param {unknown} value @param {Context} ctx
 * @param {string} path @param {Record<string, unknown>|null} node The node, for context.
 * @param {string} [id] The node's id.
 * @returns {unknown} The value, or `undefined` when it is dropped.
 */
function checkProp(member, name, value, ctx, path, node, id) {
  const fail = (/** @type {string} */ message, /** @type {SurfaceErrorCode} */ code = 'invalid-value') => {
    report(ctx, code, message, { id, path });
    return undefined;
  };
  const max = member.max ?? LIMITS.string;
  if (member.enum) {
    return member.enum.includes(/** @type {string|number} */ (value)) ? value : fail(`"${name}" must be one of ${member.enum.map((entry) => JSON.stringify(entry)).join(', ')}`);
  }
  switch (member.type) {
    case 'string':
      if (typeof value !== 'string') return fail(`"${name}" must be text`);
      if (value.length > max) return fail(`"${name}" holds at most ${max} characters`, 'limit');
      if ((name === 'name' || name === 'rowId') && !NAME.test(value)) return fail(`"${name}" is a key: a letter or "_", then letters, digits, "_", "." or "-"`);
      if (name === 'currency' && !/^[A-Z]{3}$/.test(value)) return fail('"currency" is a three-letter ISO 4217 code');
      return value;
    case 'integer':
      return Number.isInteger(value) ? value : fail(`"${name}" must be a whole number`);
    case 'number':
      return typeof value === 'number' ? value : fail(`"${name}" must be a number`);
    case 'boolean':
      return typeof value === 'boolean' ? value : fail(`"${name}" must be true or false`);
    case 'number|string':
      if (typeof value === 'number') return value;
      if (typeof value !== 'string') return fail(`"${name}" must be a number or text`);
      return value.length > max ? fail(`"${name}" holds at most ${max} characters`, 'limit') : value;
    case 'string[]': {
      if (!Array.isArray(value)) return fail(`"${name}" must be a list of texts`);
      if (value.length > max) return fail(`"${name}" holds at most ${max} entries`, 'limit');
      return value.filter((entry, index) => {
        if (typeof entry === 'string') return true;
        report(ctx, 'invalid-value', 'Each entry must be text', { id, path: `${path}/${index}` });
        return false;
      });
    }
    case 'Href':
      return checkLink(value, ctx, path, id);
    case 'Ref':
      return isObject(value) ? checkRef(value, ctx, path, id) ?? undefined : fail(`"${name}" must be a record {"$ref", "id"}`);
    case 'Column[]':
      return listOf(value, max, ctx, path, id, name, (item, at) => checkColumn(item, ctx, at, id), 'id');
    case 'Row[]':
      return checkRows(value, max, node, ctx, path, id);
    case 'Figure[]':
      return listOf(value, max, ctx, path, id, name, (item, at) => {
        const row = closed(item, ['label', 'value', 'detail'], ctx, at, id);
        if (!row) return null;
        const label = text(row, 'label', LIMITS.label, ctx, { base: at, id, required: true });
        const figure = row.value;
        if (label === undefined) return null;
        if (typeof figure !== 'string' && typeof figure !== 'number') {
          report(ctx, figure === undefined ? 'missing' : 'invalid-value', 'A figure needs a "value": text or a number', { id, path: `${at}/value` });
          return null;
        }
        /** @type {Record<string, unknown>} */
        const out = { label, value: figure };
        const detail = text(row, 'detail', LIMITS.label, ctx, { base: at, id });
        if (detail !== undefined) out.detail = detail;
        return out;
      });
    case 'ChartData':
      return checkChartData(value, ctx, path, id);
    case 'Choice[]':
      return listOf(value, max, ctx, path, id, name, (item, at) => checkChoice(item, ctx, at, id), 'value');
    case 'DiffRow[]':
      return listOf(value, max, ctx, path, id, name, (item, at) => checkDiffRow(item, ctx, at, id), 'id');
    case 'Schema':
      return checkSchema(value, ctx, path, id);
    case 'Step[]':
      return checkSteps(value, max, ctx, path, id);
    default:
      return fail(`"${name}" cannot be checked`);
  }
}

/**
 * Checks each entry of a list, keeping the ones that pass and, with `unique`, the first of each
 * value of that member.
 * @param {unknown} value @param {number} max @param {Context} ctx @param {string} path
 * @param {string|undefined} id @param {string} name
 * @param {(item: unknown, path: string) => Record<string, unknown>|null} check
 * @param {string} [unique]
 * @returns {Record<string, unknown>[]|undefined}
 */
function listOf(value, max, ctx, path, id, name, check, unique) {
  if (!Array.isArray(value)) {
    report(ctx, 'invalid-value', `"${name}" must be a list`, { id, path });
    return undefined;
  }
  if (value.length > max) {
    report(ctx, 'limit', `"${name}" holds at most ${max} entries`, { id, path });
    return undefined;
  }
  /** @type {Record<string, unknown>[]} */
  const out = [];
  const seen = new Set();
  value.forEach((item, index) => {
    const at = `${path}/${index}`;
    const checked = check(item, at);
    if (!checked) return;
    if (unique) {
      const key = checked[unique];
      if (seen.has(key)) {
        report(ctx, 'invalid-value', `"${unique}" ${JSON.stringify(key)} is used twice`, { id, path: `${at}/${unique}` });
        return;
      }
      seen.add(key);
    }
    out.push(checked);
  });
  return out;
}

/** @param {unknown} item @param {Context} ctx @param {string} path @param {string} [id] */
function checkColumn(item, ctx, path, id) {
  const column = closed(item, ['id', 'label', 'align', 'format', 'currency'], ctx, path, id);
  if (!column) return null;
  if (typeof column.id !== 'string' || !NAME.test(column.id)) {
    report(ctx, column.id === undefined ? 'missing' : 'invalid-value', 'A column needs an "id", the row key it shows', { id, path: `${path}/id` });
    return null;
  }
  const label = text(column, 'label', LIMITS.label, ctx, { base: path, id, required: true });
  if (label === undefined) return null;
  /** @type {Record<string, unknown>} */
  const out = { id: column.id, label };
  if (present(column.align)) {
    if (['start', 'center', 'end'].includes(/** @type {string} */ (column.align))) out.align = column.align;
    else report(ctx, 'invalid-value', '"align" must be start, center or end', { id, path: `${path}/align` });
  }
  if (present(column.format)) {
    if (['text', 'number', 'currency', 'percent', 'date'].includes(/** @type {string} */ (column.format))) out.format = column.format;
    else report(ctx, 'invalid-value', '"format" must be text, number, currency, percent or date', { id, path: `${path}/format` });
  }
  if (present(column.currency)) {
    if (typeof column.currency === 'string' && /^[A-Z]{3}$/.test(column.currency)) out.currency = column.currency;
    else report(ctx, 'invalid-value', '"currency" is a three-letter ISO 4217 code', { id, path: `${path}/currency` });
  }
  return out;
}

/**
 * Table rows: objects keyed by column id, or lists of cells in column order, which become objects.
 * @param {unknown} value @param {number} max @param {Record<string, unknown>|null} node
 * @param {Context} ctx @param {string} path @param {string} [id]
 * @returns {Record<string, unknown>[]|undefined}
 */
function checkRows(value, max, node, ctx, path, id) {
  if (!Array.isArray(value)) {
    report(ctx, 'invalid-value', '"rows" must be a list of rows', { id, path });
    return undefined;
  }
  if (value.length > max) {
    report(ctx, 'limit', `A table holds at most ${max} rows`, { id, path });
    return undefined;
  }
  const columns = Array.isArray(node?.columns) && node.columns.every(isObject)
    ? node.columns.map((column) => /** @type {Record<string, unknown>} */ (column).id) : null;
  /** @type {Record<string, unknown>[]} */
  const rows = [];
  value.forEach((row, index) => {
    const at = `${path}/${index}`;
    /** @type {Record<string, unknown>} */
    let object;
    if (Array.isArray(row)) {
      if (!columns || columns.some((column) => typeof column !== 'string')) {
        report(ctx, 'invalid-value', 'A row written as a list needs the table\'s "columns" in the same node', { id, path: at });
        return;
      }
      if (row.length > columns.length) report(ctx, 'invalid-value', 'The row has more cells than the table has columns; the rest were dropped', { id, path: at });
      // Keyed by column ids the model wrote: a map without a prototype, so no id can reach one.
      object = Object.create(null);
      columns.forEach((column, position) => {
        if (position >= row.length) return;
        if (!NAME.test(/** @type {string} */ (column))) {
          report(ctx, FORBIDDEN.has(/** @type {string} */ (column)) ? 'forbidden-key' : 'invalid-value', `"${column}" is not a usable column id; its cell was dropped`, { id, path: `${at}/${position}` });
          return;
        }
        object[/** @type {string} */ (column)] = row[position];
      });
    } else if (isObject(row)) {
      object = row;
    } else {
      report(ctx, 'invalid-value', 'A row is an object keyed by column id', { id, path: at });
      return;
    }
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, cell] of Object.entries(object)) {
      const cellPath = Array.isArray(row) ? `${at}/${columns?.indexOf(key)}` : `${at}/${escapeKey(key)}`;
      if (FORBIDDEN.has(key)) continue;
      if (!NAME.test(key)) {
        report(ctx, 'invalid-value', `"${key}" is not a usable column id`, { id, path: cellPath });
        continue;
      }
      if (cell === null || typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean' || (isObject(cell) && Object.hasOwn(cell, '$ref'))) {
        out[key] = cell;
      } else {
        report(ctx, 'invalid-value', 'A cell is text, a number, true or false, null or a record', { id, path: cellPath });
      }
    }
    rows.push(out);
  });
  return rows;
}

/** @param {unknown} value @param {Context} ctx @param {string} path @param {string} [id] */
function checkChartData(value, ctx, path, id) {
  const data = closed(value, ['labels', 'datasets'], ctx, path, id);
  if (!data) return undefined;
  const labels = data.labels;
  if (!Array.isArray(labels) || !labels.every((label) => typeof label === 'string' || typeof label === 'number')) {
    report(ctx, labels === undefined ? 'missing' : 'invalid-value', 'Chart data needs "labels", a list of texts or numbers', { id, path: `${path}/labels` });
    return undefined;
  }
  const datasets = data.datasets;
  if (!Array.isArray(datasets) || datasets.length === 0) {
    report(ctx, datasets === undefined ? 'missing' : 'invalid-value', 'Chart data needs "datasets", a non-empty list', { id, path: `${path}/datasets` });
    return undefined;
  }
  if (datasets.length > LIMITS.datasets) {
    report(ctx, 'limit', `A chart has at most ${LIMITS.datasets} datasets`, { id, path: `${path}/datasets` });
    return undefined;
  }
  /** @type {Array<{label: string, data: Array<number|null>}>} */
  const sets = [];
  datasets.forEach((set, index) => {
    const at = `${path}/datasets/${index}`;
    const dataset = closed(set, ['label', 'data'], ctx, at, id);
    if (!dataset) return;
    const label = text(dataset, 'label', LIMITS.label, ctx, { base: at, id, required: true });
    if (label === undefined) return;
    if (!Array.isArray(dataset.data) || !dataset.data.every((entry) => entry === null || typeof entry === 'number')) {
      report(ctx, dataset.data === undefined ? 'missing' : 'invalid-value', 'A dataset needs "data", a list of numbers or null', { id, path: `${at}/data` });
      return;
    }
    sets.push({ label, data: /** @type {Array<number|null>} */ (dataset.data) });
  });
  return sets.length ? { labels, datasets: sets } : undefined;
}

/** @param {unknown} item @param {Context} ctx @param {string} path @param {string} [id] */
function checkChoice(item, ctx, path, id) {
  const choice = closed(item, ['value', 'label', 'description', 'icon'], ctx, path, id);
  if (!choice) return null;
  if (typeof choice.value !== 'string' || choice.value === '' || choice.value.length > LIMITS.label) {
    report(ctx, choice.value === undefined ? 'missing' : 'invalid-value', 'A choice needs a "value": non-empty text', { id, path: `${path}/value` });
    return null;
  }
  const label = text(choice, 'label', LIMITS.label, ctx, { base: path, id, required: true });
  if (label === undefined) return null;
  /** @type {Record<string, unknown>} */
  const out = { value: choice.value, label };
  const description = text(choice, 'description', LIMITS.description, ctx, { base: path, id });
  if (description !== undefined) out.description = description;
  if (present(choice.icon)) {
    if (typeof choice.icon === 'string' && ICON.test(choice.icon)) out.icon = choice.icon;
    else report(ctx, 'invalid-value', '"icon" is an icon name: lowercase letters, digits and "-"', { id, path: `${path}/icon` });
  }
  return out;
}

/** @param {unknown} item @param {Context} ctx @param {string} path @param {string} [id] */
function checkDiffRow(item, ctx, path, id) {
  const row = closed(item, ['id', 'field', 'label', 'before', 'after', 'ref'], ctx, path, id);
  if (!row) return null;
  if (typeof row.id !== 'string' || !ID.test(row.id)) {
    report(ctx, row.id === undefined ? 'missing' : 'invalid-value', 'A change needs an "id"', { id, path: `${path}/id` });
    return null;
  }
  if (typeof row.field !== 'string' || !NAME.test(row.field)) {
    report(ctx, row.field === undefined ? 'missing' : 'invalid-value', 'A change needs a "field", the key of the changed value', { id, path: `${path}/field` });
    return null;
  }
  const label = text(row, 'label', LIMITS.label, ctx, { base: path, id, required: true });
  if (label === undefined) return null;
  /** @type {Record<string, unknown>} */
  const out = { id: row.id, field: row.field, label };
  for (const key of ['before', 'after']) {
    const value = Object.hasOwn(row, key) ? row[key] : undefined;
    if (value === undefined) {
      report(ctx, 'missing', `A change needs "${key}"; write null for none`, { id, path: `${path}/${key}` });
      return null;
    }
    if (!(value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
      report(ctx, 'invalid-value', `"${key}" is text, a number, true or false, or null`, { id, path: `${path}/${key}` });
      return null;
    }
    out[key] = value;
  }
  if (present(row.ref)) {
    const ref = isObject(row.ref) ? checkRef(row.ref, ctx, `${path}/ref`, id) : null;
    if (ref) out.ref = ref;
    else if (!isObject(row.ref)) report(ctx, 'invalid-value', '"ref" is a record {"$ref", "id"}', { id, path: `${path}/ref` });
  }
  return out;
}

/**
 * An input schema: the list form of `properties` becomes the object form, `null` members are
 * dropped, and every construct outside the subset is dropped with its property.
 * @param {unknown} value @param {Context} ctx @param {string} path @param {string} [id]
 * @returns {Record<string, unknown>|undefined}
 */
function checkSchema(value, ctx, path, id) {
  if (!isObject(value)) {
    report(ctx, 'invalid-value', '"schema" must be a JSON Schema object', { id, path });
    return undefined;
  }
  /** @type {Record<string, unknown>} */
  const schema = withoutNulls(value);
  /** @type {Map<string, string>} Property name → its path in the input. */
  const paths = new Map();
  if (Array.isArray(schema.properties)) {
    /** @type {Record<string, unknown>} */
    const properties = {};
    schema.properties.forEach((entry, index) => {
      const at = `${path}/properties/${index}`;
      if (!isObject(entry) || typeof entry.name !== 'string') {
        report(ctx, 'invalid-value', 'A property in a list needs a "name"', { id, path: at });
        return;
      }
      // Refused before it becomes a key: `__proto__` would otherwise set the prototype.
      if (!NAME.test(entry.name)) {
        report(ctx, FORBIDDEN.has(entry.name) ? 'forbidden-key' : 'invalid-value', `"${entry.name}" is not a usable property name; the property was dropped`, { id, path: `${at}/name` });
        return;
      }
      if (Object.hasOwn(properties, entry.name)) {
        report(ctx, 'duplicate-name', `The property "${entry.name}" is listed twice`, { id, path: `${at}/name` });
        return;
      }
      const { name, ...property } = entry;
      properties[name] = property;
      paths.set(name, at);
    });
    schema.properties = properties;
  } else if (isObject(schema.properties)) {
    for (const name of Object.keys(schema.properties)) paths.set(name, `${path}/properties/${escapeKey(name)}`);
  }
  if (isObject(schema.properties)) {
    for (const [name, property] of Object.entries(schema.properties)) {
      if (!isObject(property)) continue;
      const clean = withoutNulls(property);
      for (const key of ['items', 'x-zx']) if (isObject(clean[key])) clean[key] = withoutNulls(clean[key]);
      if (isObject(clean['x-zx']) && isObject(clean['x-zx'].visible)) clean['x-zx'].visible = normalizeCondition(clean['x-zx'].visible);
      /** @type {Record<string, unknown>} */ (schema.properties)[name] = clean;
    }
  }
  const problems = unsupported(schema);
  /** @type {Set<string>} */
  const dropped = new Set();
  let whole = false;
  for (const problem of problems) {
    const match = /^\/properties\/([^/]+)(.*)$/.exec(problem.path);
    if (match && isObject(schema.properties)) {
      const name = match[1].replace(/~1/g, '/').replace(/~0/g, '~');
      const base = paths.get(name) ?? `${path}/properties/${match[1]}`;
      report(ctx, 'unsupported-schema', `${problem.message}; the property "${name}" was dropped`, { id, path: `${base}${match[2]}` });
      dropped.add(name);
    } else if (problem.path.startsWith('/required')) {
      report(ctx, 'unsupported-schema', problem.message, { id, path: `${path}${problem.path}` });
    } else {
      report(ctx, 'unsupported-schema', problem.message, { id, path: `${path}${problem.path}` });
      whole = true;
    }
  }
  if (whole) return undefined;
  const properties = /** @type {Record<string, Record<string, unknown>>} */ (schema.properties);
  for (const name of dropped) delete properties[name];
  if (Array.isArray(schema.required)) {
    schema.required = schema.required.filter((name) => typeof name === 'string' && Object.hasOwn(properties, name));
  }
  for (const [name, property] of Object.entries(properties)) {
    if (typeof property.title !== 'string' || !property.title.trim()) {
      report(ctx, 'untitled-property', `The property "${name}" has no "title"; its name is shown instead`, { id, path: `${paths.get(name)}/title` });
    }
  }
  /** @type {Record<string, unknown>} */
  const out = { type: 'object', properties };
  if (Array.isArray(schema.required) && schema.required.length) out.required = schema.required;
  return out;
}

/**
 * Questionnaire steps, with their declarative `when`, `next` and `validate`.
 * @param {unknown} value @param {number} max @param {Context} ctx @param {string} path
 * @param {string} [id]
 * @returns {Record<string, unknown>[]|undefined}
 */
function checkSteps(value, max, ctx, path, id) {
  if (!Array.isArray(value) || value.length === 0) {
    report(ctx, 'invalid-value', '"steps" must be a non-empty list of steps', { id, path });
    return undefined;
  }
  if (value.length > max) {
    report(ctx, 'limit', `A questionnaire has at most ${max} steps`, { id, path });
    return undefined;
  }
  const names = value.map((step) => (isObject(step) && typeof step.name === 'string' ? step.name : null));
  /** @type {Record<string, unknown>[]} */
  const steps = [];
  /** @type {string[]} */
  const earlier = [];
  value.forEach((raw, index) => {
    const at = `${path}/${index}`;
    const step = closed(raw, ['name', 'prompt', 'description', 'section', 'required', 'multiple', 'skippable', 'choices', 'input', 'when', 'next', 'validate'], ctx, at, id);
    if (!step) return;
    if (typeof step.name !== 'string' || !NAME.test(step.name) || earlier.includes(step.name)) {
      report(ctx, step.name === undefined ? 'missing' : 'invalid-value', 'A step needs a unique "name"', { id, path: `${at}/name` });
      return;
    }
    const prompt = text(step, 'prompt', LIMITS.label, ctx, { base: at, id, required: true });
    if (prompt === undefined) return;
    /** @type {Record<string, unknown>} */
    const out = { name: step.name, prompt };
    for (const key of ['description', 'section']) {
      const member = text(step, key, key === 'description' ? LIMITS.description : LIMITS.label, ctx, { base: at, id });
      if (member !== undefined) out[key] = member;
    }
    for (const key of ['required', 'multiple', 'skippable']) {
      if (!present(step[key])) continue;
      if (typeof step[key] === 'boolean') out[key] = step[key];
      else report(ctx, 'invalid-value', `"${key}" must be true or false`, { id, path: `${at}/${key}` });
    }
    if (present(step.choices)) {
      const choices = listOf(step.choices, LIMITS.choices, ctx, `${at}/choices`, id, 'choices', (item, where) => checkChoice(item, ctx, where, id), 'value');
      if (choices) out.choices = choices;
    }
    if (present(step.input)) {
      const input = closed(step.input, ['label', 'placeholder', 'multiline', 'maxLength'], ctx, `${at}/input`, id);
      if (input) {
        /** @type {Record<string, unknown>} */
        const field = {};
        for (const key of ['label', 'placeholder']) {
          const member = text(input, key, LIMITS.label, ctx, { base: `${at}/input`, id });
          if (member !== undefined) field[key] = member;
        }
        if (present(input.multiline)) {
          if (typeof input.multiline === 'boolean') field.multiline = input.multiline;
          else report(ctx, 'invalid-value', '"multiline" must be true or false', { id, path: `${at}/input/multiline` });
        }
        if (present(input.maxLength)) {
          if (Number.isInteger(input.maxLength) && /** @type {number} */ (input.maxLength) >= 0 && /** @type {number} */ (input.maxLength) <= LIMITS.string) field.maxLength = input.maxLength;
          else report(ctx, 'invalid-value', `"maxLength" is a whole number up to ${LIMITS.string}`, { id, path: `${at}/input/maxLength` });
        }
        out.input = field;
      }
    }
    if (present(step.when)) {
      const when = checkVisible(step.when, new Set(earlier), ctx, `${at}/when`, id, 'step');
      if (when) out.when = when;
    }
    if (present(step.next)) {
      const next = typeof step.next === 'string' ? step.next : Array.isArray(step.next)
        ? step.next.map((branch) => {
          if (!isObject(branch)) return branch;
          const copy = withoutNulls(branch);
          if (isObject(copy.if)) copy.if = normalizeCondition(copy.if);
          return copy;
        })
        : step.next;
      const targets = names.filter((name) => typeof name === 'string' && name !== step.name);
      const problems = checkNext(next, { targets: [...targets, NEXT_REVIEW, NEXT_SUBMIT], fields: [...earlier, step.name] });
      if (problems.length) {
        for (const problem of problems) report(ctx, 'condition', `"next": ${problem.message}; it was dropped`, { id, path: `${at}/next${problem.path}` });
      } else {
        out.next = next;
      }
    }
    if (present(step.validate)) {
      const rules = Array.isArray(step.validate) ? step.validate.map((rule) => (isObject(rule) ? withoutNulls(rule) : rule)) : step.validate;
      const problems = checkRuleList(rules);
      if (problems.length) {
        for (const problem of problems) report(ctx, 'invalid-value', `"validate": ${problem.message}; it was dropped`, { id, path: `${at}/validate${problem.path}` });
      } else {
        out.validate = rules;
      }
    }
    earlier.push(step.name);
    steps.push(out);
  });
  return steps.length ? steps : undefined;
}

/**
 * A `visible` or `when` condition: the grammar, at most four levels, and — when `fields` is given
 * — only those inputs. Names in `later` are refused outright: inputs known to come after it.
 * @param {unknown} value @param {Set<string>|null} fields @param {Context} ctx @param {string} path
 * @param {string} [id] @param {'node'|'step'} [kind='node'] @param {Set<string>} [later]
 * @returns {Condition|undefined}
 */
function checkVisible(value, fields, ctx, path, id, kind = 'node', later = new Set()) {
  const condition = normalizeCondition(value);
  const problems = checkCondition(condition, { fields, maxDepth: MAX_CONDITION_DEPTH });
  if (!problems.length) {
    const named = conditionFields(condition).find((field) => later.has(field));
    if (named === undefined) return /** @type {Condition} */ (condition);
    problems.push({ path: '', message: `"${named}" is not an input declared before this condition` });
  }
  const effect = kind === 'step' ? 'the condition was dropped and the step is always asked' : 'the condition was dropped and the node stays visible';
  for (const problem of problems) {
    const message = problem.message.endsWith('is not an input declared before this condition')
      ? problem.message.replace('is not an input declared before this condition', 'is not an input that comes earlier in the surface')
      : problem.message;
    report(ctx, 'condition', `${message}; ${effect}`, { id, path: `${path}${problem.path}` });
  }
  return undefined;
}

/**
 * The input names a well-formed condition tests.
 * @param {unknown} condition @param {number} [depth=0]
 * @returns {string[]}
 */
function conditionFields(condition, depth = 0) {
  if (!isObject(condition) || depth > MAX_CONDITION_DEPTH) return [];
  if (Array.isArray(condition.all)) return condition.all.flatMap((entry) => conditionFields(entry, depth + 1));
  if (Array.isArray(condition.any)) return condition.any.flatMap((entry) => conditionFields(entry, depth + 1));
  if (Object.hasOwn(condition, 'not')) return conditionFields(condition.not, depth + 1);
  return typeof condition.field === 'string' ? [condition.field] : [];
}

/**
 * Brings a condition written for strict structured output back to the grammar: `null` members are
 * absent, and an `empty` or `filled` test carries no value.
 * @param {unknown} value @param {number} [depth=0]
 * @returns {unknown}
 */
function normalizeCondition(value, depth = 0) {
  if (!isObject(value) || depth > MAX_CONDITION_DEPTH + 1) return value;
  const condition = withoutNulls(value);
  if (Array.isArray(condition.all)) condition.all = condition.all.map((entry) => normalizeCondition(entry, depth + 1));
  if (Array.isArray(condition.any)) condition.any = condition.any.map((entry) => normalizeCondition(entry, depth + 1));
  if (Object.hasOwn(condition, 'not')) condition.not = normalizeCondition(condition.not, depth + 1);
  if (VALUELESS.has(/** @type {string} */ (condition.op)) && Object.hasOwn(value, 'value') && value.value === null) delete condition.value;
  if (!VALUELESS.has(/** @type {string} */ (condition.op)) && Object.hasOwn(value, 'value') && value.value === null && Object.hasOwn(value, 'field')) condition.value = null;
  return condition;
}

/**
 * A link address, checked and normalised: `https:` only, absolute, in lower case, without
 * credentials, spaces, backslashes, control or invisible formatting characters, at most
 * `LIMITS.href` characters, and passing `safeHref()`. The address returned is the parsed one
 * (`url.href`: Punycode host, default port dropped), so the host shown and the address opened come
 * from the same string. Pure: it reports nothing, and is shared by every place that opens an
 * address a surface or a server gave.
 * @param {unknown} value The address as given.
 * @returns {{href: string, problem: null}|{href: null, problem: string}} The normalised address,
 *   or why it is refused (English, written for the model).
 */
export function normaliseLink(value) {
  const refuse = (/** @type {string} */ problem) => ({ href: null, problem });
  if (typeof value !== 'string') return refuse('A link address is text');
  if (value.length > LIMITS.href) return refuse(`A link address holds at most ${LIMITS.href} characters`);
  if (!HREF.test(value) || /\p{Cf}/u.test(value)) {
    return refuse('A link must be an absolute "https://" address, in lower case, without credentials, spaces, backslashes, control or invisible formatting characters');
  }
  /** @type {URL} */
  let url;
  try {
    url = new URL(value);
  } catch {
    return refuse('The link address is malformed');
  }
  if (url.protocol !== 'https:' || !url.hostname) return refuse('A link must be an absolute "https://" address');
  if (url.username || url.password) return refuse('A link address carries no user name or password');
  const href = url.href;
  if (href.length > LIMITS.href || !HREF.test(href) || safeHref(href) === null) return refuse('The link address is not safe');
  return { href, problem: null };
}

/**
 * A link address through `normaliseLink()`; a refused one is reported and dropped.
 * @param {unknown} value @param {Context} ctx @param {string} path @param {string} [id]
 * @returns {string|undefined}
 */
function checkLink(value, ctx, path, id) {
  const link = normaliseLink(value);
  if (link.href !== null) return link.href;
  report(ctx, 'link-refused', `${link.problem}; the link was dropped`, { id, path });
  return undefined;
}

/**
 * A record: exactly `{"$ref", "id"}`, naming an entity the application offers.
 * @param {Record<string, unknown>} value @param {Context} ctx @param {string} path @param {string} [id]
 * @returns {{$ref: string, id: string}|null}
 */
function checkRef(value, ctx, path, id) {
  if (!isObject(value)) {
    report(ctx, 'invalid-value', 'A record is {"$ref": "<entity>", "id": "…"}', { id, path });
    return null;
  }
  const keys = Object.keys(value);
  if (keys.some((key) => key !== '$ref' && key !== 'id') || typeof value.$ref !== 'string' || typeof value.id !== 'string' || value.id === '' || value.id.length > LIMITS.label) {
    report(ctx, 'invalid-value', 'A record is exactly {"$ref": "<entity>", "id": "…"}, both text', { id, path });
    return null;
  }
  if (!ctx.entities || !ctx.entities.has(value.$ref)) {
    report(ctx, 'ref-refused', `The entity "${value.$ref}" is not one this application resolves; the record was dropped`, { id, path });
    return null;
  }
  return { $ref: value.$ref, id: value.id };
}

/**
 * An image the application provides: exactly `{"$asset": "<name>"}`. A name, never an address.
 * @param {Record<string, unknown>} value @param {Context} ctx @param {string} path
 * @returns {{$asset: string}|null}
 */
function checkAsset(value, ctx, path) {
  if (Object.keys(value).length !== 1 || typeof value.$asset !== 'string' || !ASSET.test(value.$asset)) {
    report(ctx, 'invalid-value', 'An asset is exactly {"$asset": "<name>"}: a name the application resolves, never an address', { path });
    return null;
  }
  return { $asset: value.$asset };
}

/**
 * A `$data` pointer, with the leading-slash repair.
 * @param {unknown} pointer @param {Context} ctx @param {string} path @param {string} [id]
 * @returns {string|null}
 */
function bindingPointer(pointer, ctx, path, id) {
  if (typeof pointer !== 'string') {
    report(ctx, 'pointer-invalid', '"$data" is a JSON Pointer such as "/rows"', { id, path });
    return null;
  }
  let value = pointer;
  if (value !== '' && !value.startsWith('/')) {
    value = `/${value}`;
    report(ctx, 'pointer-slash', `A pointer starts with "/"; "${pointer}" was read as "${value}"`, { id, path, repaired: true });
  }
  try {
    parsePointer(value);
  } catch (error) {
    report(ctx, 'pointer-invalid', error instanceof Error ? error.message : 'Invalid pointer', { id, path });
    return null;
  }
  return value;
}

/**
 * Reads an optional or required text member.
 * @param {Record<string, unknown>} object @param {string} key @param {number} max @param {Context} ctx
 * @param {{required?: boolean, base?: string, id?: string}} [options]
 * @returns {string|undefined}
 */
function text(object, key, max, ctx, options = {}) {
  const value = object[key];
  const path = `${options.base ?? ''}/${key}`;
  if (!present(value)) {
    if (options.required) report(ctx, 'missing', `"${key}" is required`, { id: options.id, path });
    return undefined;
  }
  if (typeof value !== 'string') {
    report(ctx, 'invalid-value', `"${key}" must be text`, { id: options.id, path });
    return undefined;
  }
  if (value.length > max) {
    report(ctx, 'limit', `"${key}" holds at most ${max} characters`, { id: options.id, path });
    return undefined;
  }
  return value;
}

/**
 * An object with a closed set of members: unknown ones are reported and `null` ones dropped.
 * @param {unknown} value @param {string[]} keys @param {Context} ctx @param {string} path @param {string} [id]
 * @returns {Record<string, unknown>|null}
 */
function closed(value, keys, ctx, path, id) {
  if (!isObject(value)) {
    report(ctx, 'invalid-value', 'Expected an object', { id, path });
    return null;
  }
  checkKeys(value, keys, ctx, path, id);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of keys) if (present(value[key])) out[key] = value[key];
  return out;
}

/**
 * Reports the keys of an object outside a set; `null` ones count as absent.
 * @param {Record<string, unknown>} value @param {string[]} keys @param {Context} ctx @param {string} path
 * @param {string} [id]
 */
function checkKeys(value, keys, ctx, path, id) {
  for (const key of Object.keys(value)) {
    if (keys.includes(key) || value[key] === null) continue;
    unknownKey(key, ctx, `${path}/${escapeKey(key)}`, id);
  }
}

/** @param {string} key @param {Context} ctx @param {string} path @param {string} [id] */
function unknownKey(key, ctx, path, id) {
  if (key === 'token') report(ctx, 'token-refused', 'A surface cannot set its own token; only the application gives one', { id, path });
  else report(ctx, 'unknown-key', `Unknown key "${key}"; it was dropped`, { id, path });
}

/**
 * @param {Context} ctx @param {SurfaceErrorCode} code @param {string} message
 * @param {{id?: string, path?: string, repaired?: boolean}} [where]
 */
function report(ctx, code, message, where = {}) {
  /** @type {SurfaceError} */
  const error = { code, message };
  if (ctx.surface) error.surface = ctx.surface;
  if (where.id !== undefined) error.id = where.id;
  if (where.path !== undefined) error.path = ctx.at(where.path);
  if (where.repaired) error.repaired = true;
  ctx.errors.push(error);
}

/* ------------------------------------------------------------------------------------------------
 * The tree
 * --------------------------------------------------------------------------------------------- */

/** @param {string} id @param {SurfaceTrack} track @returns {string[]} The node's ancestors, nearest first. */
function ancestorsOf(id, track) {
  const out = [];
  let current = track.parent.get(id);
  while (current !== undefined && current !== ROOT && !out.includes(current)) {
    out.push(current);
    current = track.parent.get(current);
  }
  return out;
}

/** @param {string} id @param {SurfaceTrack} track @returns {number|null} Depth from root, or null when not yet placed under it. */
function depthOf(id, track) {
  let depth = 1;
  let current = track.parent.get(id);
  const seen = new Set([id]);
  while (current !== ROOT) {
    if (current === undefined || seen.has(current)) return null;
    seen.add(current);
    depth += 1;
    current = track.parent.get(current);
  }
  return depth;
}

/** @param {string} parent @param {string} child @param {SurfaceTrack} track @returns {boolean} */
function stillLists(parent, child, track) {
  if (parent === ROOT) return track.root.includes(child);
  return Boolean(track.nodes.get(parent)?.children?.includes(child));
}

/** @param {SurfaceTrack} track @param {string} except @returns {number} Fields declared by fields nodes other than `except`. */
function countFields(track, except) {
  let count = 0;
  for (const owner of track.names.values()) {
    if (owner.owner === except) continue;
    if (track.nodes.get(owner.owner)?.type === 'fields') count += 1;
  }
  return count;
}

/** @param {{properties: Record<string, unknown>, required?: string[]}} schema @param {string} name */
function dropProperty(schema, name) {
  delete schema.properties[name];
  if (Array.isArray(schema.required)) schema.required = schema.required.filter((entry) => entry !== name);
}

/* ------------------------------------------------------------------------------------------------ */

/** @param {unknown} value @returns {value is {$data: unknown}} */
function isBinding(value) {
  return isObject(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$data');
}

/** @param {unknown} value @returns {boolean} Whether a member counts as given: `null` does not. */
function present(value) {
  return value !== null && value !== undefined;
}

/** @param {Record<string, unknown>} value @returns {Record<string, any>} A shallow copy without `null` members. */
function withoutNulls(value) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, member] of Object.entries(value)) if (member !== null) out[key] = member;
  return out;
}

/** @template T @param {T} value @returns {T} */
function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/** @param {SurfaceError} error @returns {SurfaceError} */
function stripSurface(error) {
  const { surface, ...rest } = error;
  void surface;
  return rest;
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {string} key @returns {string} */
function escapeKey(key) {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}
