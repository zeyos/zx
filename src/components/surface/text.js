// @ts-check
/**
 * Pure helpers around a surface's reply: which inputs are visible, the reply's shape per intent,
 * and the receipt as plain text.
 *
 * The module touches no DOM, so a server can build the same receipt for its audit log, or check
 * which inputs a reply may carry, with the code the page used.
 */
import { getLanguage, printf, translate } from '../../core/i18n.js';
import { defaultMessages } from '../../core/messages.js';
import { getPointer } from '../../internal/json-patch.js';
import { evaluate, isEmptyAnswer } from '../questionnaire/conditions.js';
import { CATALOG, REPLY_VERSION } from './catalog.js';
import { choicesOf } from './schema.js';
import { validateDocument } from './validate.js';

/** @typedef {import('./validate.js').SurfaceDocument} SurfaceDocument */
/** @typedef {import('./validate.js').SurfaceNode} SurfaceNode */
/** @typedef {import('./validate.js').SurfaceAction} SurfaceAction */
/** @typedef {import('./catalog.js').SurfaceIntent} SurfaceIntent */

/**
 * How the person confirmed the action: `clicked` in a confirmation dialog, `typed` the text a
 * type-to-confirm dialog asked for, or `null` when the application's policy asked for nothing, or
 * the surface was closed.
 * @typedef {'clicked'|'typed'|null} ReplyConfirmation
 */

/**
 * Why a surface ended without an action of its own: closed by the person, superseded by a newer
 * surface, stopped with its run, or destroyed unanswered.
 * @typedef {'cancelled'|'escape'|'closed'|'superseded'|'stopped'|'destroyed'|string} ReplyReason
 */

/**
 * What every surface ends in, exactly once. It records what the page did; it proves nothing, so
 * the application's server runs its policy again for the named tool before acting.
 * @typedef {Object} SurfaceReply
 * @property {'reply/1'} zx The reply format.
 * @property {string|null} surface The surface's id; `null` when a surface that never began had
 *   no valid id to name.
 * @property {string} action The action taken: an action id of the surface's own, a default one
 *   (`submit`, `confirm`, `approve`, `reject`), or `cancel` / `dismiss` when it was closed.
 * @property {string} key The idempotency key, `<surface>#<action>` (`#<action>` without a surface
 *   id): the same answer twice has the same key, so a server acts on it once.
 * @property {Record<string, unknown>} values The visible inputs' values by name; `{answers, path}`
 *   for a questionnaire; `{}` for `show`, `confirm`, `reject` and a closed surface.
 * @property {ReplyConfirmation} confirmation How the person confirmed.
 * @property {string} at Local ISO date-time of the answer, `YYYY-MM-DDTHH:MM:SS`.
 * @property {string} [token] The application's token, unchanged; only when it gave one.
 * @property {string[]} [removed] The ids of actions the application's policy denied, which were
 *   not drawn; only when there were any.
 * @property {ReplyReason} [reason] Why a closing reply (`cancel`, `dismiss`) was sent.
 */

/**
 * What `createReply()` takes.
 * @typedef {Object} ReplyDetails
 * @property {string} action The action id.
 * @property {Record<string, unknown>} [values] The values, before they are shaped for the intent.
 * @property {ReplyConfirmation} [confirmation=null]
 * @property {string|null} [token=null]
 * @property {string[]} [removed=[]]
 * @property {ReplyReason} [reason]
 * @property {Date|string} [at] The time of the answer; now when left out.
 */

/**
 * Which nodes and inputs of a surface are visible for a set of answers.
 * @typedef {Object} SurfaceVisibility
 * @property {Set<string>} hiddenNodes Ids of nodes hidden by their own condition or an ancestor's.
 * @property {Map<string, Set<string>>} hiddenFields Per `fields` node, the properties hidden by
 *   their `x-zx.visible` (not counting a hidden node).
 * @property {string[]} names The visible inputs' names, in the order they are declared.
 * @property {Map<string, string>} owners The node holding each input name.
 */

/**
 * The English texts of every message the surface shows: the `surface.*` entries of the library's
 * catalogue, read from it so there is one source. A host translates them through the Surface's
 * `msg` option or its translator; `surfaceText()` takes a `msg` function.
 * @type {Readonly<Record<string, string>>}
 */
export const SURFACE_MESSAGES = Object.freeze(Object.fromEntries(
  Object.entries(defaultMessages).filter(([key]) => key.startsWith('surface.'))
));

/** The verdict word of each action the format names, by action id. */
const VERDICT_KEYS = Object.freeze({
  submit: 'surface.submitted',
  confirm: 'surface.confirmed',
  approve: 'surface.approved',
  reject: 'surface.rejected',
  cancel: 'surface.cancelled',
  dismiss: 'surface.dismissed'
});

/** Actions that close a surface rather than answer it. */
export const CLOSING_ACTIONS = Object.freeze(['cancel', 'dismiss']);

/** Actions whose reply carries no values: the closing ones and a rejection. */
const VALUELESS_ACTIONS = new Set([...CLOSING_ACTIONS, 'reject']);

/** Intents whose reply carries no values whatever the action. */
const VALUELESS_INTENTS = new Set(['show', 'confirm']);

/**
 * The English message for a key, with `%1`, `%2`, … filled in. The default `msg` of
 * `surfaceText()`.
 * @param {string} key
 * @param {...unknown} args
 * @returns {string}
 */
export function surfaceMessage(key, ...args) {
  const text = /** @type {Record<string, string>} */ (SURFACE_MESSAGES)[key] ?? key;
  return text.replace(/%(\d+)/g, (match, digit) => {
    const value = args[Number(digit) - 1];
    return value === undefined ? match : String(value);
  });
}

/**
 * A message resolver that answers the way a Surface's own `msg()` does: the `msg` table for the
 * active language, then its flat entries, then the host translator (`setTranslator()`), then the
 * English catalogue, then the key.
 * @param {Record<string, any>|null|undefined} msg The `msg` option, flat or by language.
 * @param {string} [lang] The language; `getLanguage()` when absent, read at each call.
 * @returns {(key: string, ...args: unknown[]) => string}
 */
export function messageResolver(msg, lang) {
  const own = msg && typeof msg === 'object' && !Array.isArray(msg) ? msg : null;
  return (key, ...args) => {
    const active = lang ?? getLanguage();
    const table = own && own[active] && typeof own[active] === 'object' ? own[active] : null;
    const value = table && typeof table[key] === 'string' ? table[key]
      : own && Object.hasOwn(own, key) && typeof own[key] === 'string' ? own[key] : null;
    return value !== null ? printf(value, args) : translate(key, args);
  };
}

/**
 * Escapes the characters inline text reads as markup (`*`, `` ` ``, `[`, `\`), so untrusted text
 * — a server's message, an address — is drawn exactly as given by a `text` node. With `max`, the
 * escaped text is cut to at most that many characters, never between an escape and the character
 * it escapes, nor inside a surrogate pair.
 * @param {string} value
 * @param {number} [max=Infinity] The most characters the result may hold.
 * @returns {string}
 */
export function plainInline(value, max = Infinity) {
  const escaped = String(value).replace(INLINE_MARKUP, '\\$&');
  if (escaped.length <= max) return escaped;
  let out = '';
  for (const char of String(value)) {
    const piece = INLINE_MARKUP_CHAR.test(char) ? `\\${char}` : char;
    if (out.length + piece.length > max) break;
    out += piece;
  }
  return out;
}

/** The characters inline text reads as markup. */
const INLINE_MARKUP = /[*`[\\]/g;
const INLINE_MARKUP_CHAR = /^[*`[\\]$/;

/**
 * Reads a node property, resolving a `{"$data": "/pointer"}` binding against the surface data.
 * @param {SurfaceNode} node
 * @param {string} prop
 * @param {unknown} data
 * @returns {unknown} The value, or `undefined` when it is absent or its pointer finds nothing.
 */
export function readProp(node, prop, data) {
  const value = node[prop];
  if (isObject(value) && typeof value.$data === 'string' && Object.keys(value).length === 1) {
    try {
      return getPointer(data ?? {}, value.$data);
    } catch {
      return undefined;
    }
  }
  return value;
}

/**
 * The input names a node declares, in order: a `fields` node's schema properties, or the `name`
 * of any other input node (a table only while it is selectable).
 * @param {SurfaceNode} node
 * @param {unknown} data
 * @returns {string[]}
 */
export function inputNames(node, data) {
  const entry = Object.hasOwn(CATALOG.nodes, node.type) ? CATALOG.nodes[node.type] : null;
  if (!entry?.input) return [];
  if (node.type === 'fields') {
    const schema = readProp(node, 'schema', data);
    return isObject(schema) && isObject(schema.properties) ? Object.keys(schema.properties) : [];
  }
  if (node.type === 'table' && !readProp(node, 'selectable', data)) return [];
  if (node.type === 'questionnaire') return [];
  return typeof node.name === 'string' ? [node.name] : [];
}

/**
 * Decides which nodes and inputs are visible, walking the tree depth first from `root` as the
 * conditions are declared. A condition sees only the answers of visible inputs that come before
 * it, so hiding an input also hides what depends on it. A malformed condition counts as true:
 * the node stays visible, as validation reports it.
 * @param {SurfaceDocument|{root: string[], nodes: SurfaceNode[]|Map<string, SurfaceNode>, data?: unknown}} document
 * @param {Record<string, unknown>} answers The inputs' values by name, hidden ones included.
 * @returns {SurfaceVisibility}
 */
export function surfaceVisibility(document, answers) {
  const nodes = document.nodes instanceof Map
    ? document.nodes
    : new Map((Array.isArray(document.nodes) ? document.nodes : []).map((node) => [node.id, node]));
  const data = document.data ?? {};
  /** @type {SurfaceVisibility} */
  const result = { hiddenNodes: new Set(), hiddenFields: new Map(), names: [], owners: new Map() };
  /** @type {Record<string, unknown>} */
  const seen = {};
  const source = isObject(answers) ? answers : {};
  /** @type {Set<string>} Inputs met so far, visible or not. */
  const declared = new Set();
  const holds = (/** @type {unknown} */ condition) => {
    if (!isObject(condition)) return true;
    // A condition naming an input that has not arrived (yet) leaves its node visible.
    if (conditionFields(condition).some((field) => !declared.has(field))) return true;
    try {
      return evaluate(/** @type {any} */ (condition), seen);
    } catch {
      return true;
    }
  };
  const visited = new Set();
  /** @param {string} id @param {boolean} parentVisible @param {number} depth */
  const walk = (id, parentVisible, depth) => {
    if (visited.has(id) || depth > 64) return;
    visited.add(id);
    const node = nodes.get(id);
    if (!node) return;
    const visible = parentVisible && holds(node.visible);
    if (!visible) result.hiddenNodes.add(id);
    if (node.type === 'fields') {
      const schema = readProp(node, 'schema', data);
      /** @type {Set<string>} */
      const hidden = new Set();
      const properties = isObject(schema) && isObject(schema.properties) ? schema.properties : {};
      for (const [name, property] of Object.entries(properties)) {
        const shown = visible && holds(isObject(property) ? property['x-zx']?.visible : undefined);
        if (visible && !shown) hidden.add(name);
        result.owners.set(name, id);
        declared.add(name);
        if (shown) {
          result.names.push(name);
          if (Object.hasOwn(source, name)) seen[name] = source[name];
        }
      }
      result.hiddenFields.set(id, hidden);
    } else {
      for (const name of inputNames(node, data)) {
        result.owners.set(name, id);
        declared.add(name);
        if (!visible) continue;
        result.names.push(name);
        if (Object.hasOwn(source, name)) seen[name] = source[name];
      }
    }
    if (Array.isArray(node.children)) for (const child of node.children) walk(child, visible, depth + 1);
  };
  for (const id of Array.isArray(document.root) ? document.root : []) walk(id, true, 1);
  return result;
}

/**
 * The input names a condition refers to, at any depth.
 * @param {unknown} condition
 * @param {number} [depth=0]
 * @returns {string[]}
 */
function conditionFields(condition, depth = 0) {
  if (!isObject(condition) || depth > 8) return [];
  if (typeof condition.field === 'string') return [condition.field];
  /** @type {string[]} */
  const out = [];
  for (const key of ['all', 'any']) {
    if (Array.isArray(condition[key])) for (const entry of condition[key]) out.push(...conditionFields(entry, depth + 1));
  }
  if (Object.hasOwn(condition, 'not')) out.push(...conditionFields(condition.not, depth + 1));
  return out;
}

/**
 * Builds a reply. Values are shaped for the intent: `show` and `confirm` reply `{}`, as do
 * `reject` and a closed surface; a questionnaire's `submit` keeps `{answers, path}`; every other
 * reply keeps only the inputs that are visible for the values given, so a hidden input never
 * leaves the page.
 * @param {SurfaceDocument} document The surface, as validated.
 * @param {ReplyDetails} details
 * @returns {SurfaceReply}
 */
export function createReply(document, details) {
  const action = String(details.action);
  const intent = document.intent;
  const given = isObject(details.values) ? details.values : {};
  /** @type {Record<string, unknown>} */
  let values = {};
  if (!intent || VALUELESS_INTENTS.has(intent) || VALUELESS_ACTIONS.has(action)) {
    values = {};
  } else if (intent === 'questionnaire') {
    values = isObject(given.answers) ? { answers: clone(given.answers), path: Array.isArray(given.path) ? [...given.path] : [] } : {};
  } else {
    const { names } = surfaceVisibility(document, given);
    for (const name of names) {
      if (Object.hasOwn(given, name) && given[name] !== undefined) values[name] = clone(given[name]);
    }
  }
  /** @type {SurfaceReply} */
  const reply = {
    zx: /** @type {'reply/1'} */ (REPLY_VERSION),
    surface: document.surface,
    action,
    key: `${document.surface}#${action}`,
    values,
    confirmation: CLOSING_ACTIONS.includes(action) ? null : details.confirmation ?? null,
    at: localDateTime(details.at instanceof Date ? details.at : typeof details.at === 'string' ? details.at : new Date())
  };
  if (typeof details.token === 'string') reply.token = details.token;
  if (Array.isArray(details.removed) && details.removed.length) reply.removed = [...details.removed];
  if (details.reason && CLOSING_ACTIONS.includes(action)) reply.reason = details.reason;
  return reply;
}

/**
 * Options of `surfaceText()`.
 * @typedef {Object} SurfaceTextOptions
 * @property {(key: string, ...args: unknown[]) => string} [msg] Resolves a message key; English
 *   by default (`SURFACE_MESSAGES`).
 * @property {Iterable<string>|null} [entities=null] The record entities the document may name, as
 *   the Surface's `resolve.entities`.
 */

/**
 * The receipt of an answered surface as plain text, for an audit log or a notification: the
 * title, each answered value under its label (choice and enum titles rather than raw values), the
 * selected rows by their row id, the verdict and the time. Inputs hidden for the reply's values
 * are never included, whatever the reply carries. Pure.
 * @param {SurfaceDocument} document The surface, as given to the Surface or from `toDocument()`.
 * @param {SurfaceReply} reply Its reply.
 * @param {SurfaceTextOptions} [options]
 * @returns {string} Lines separated by `\n`.
 */
export function surfaceText(document, reply, options = {}) {
  const msg = typeof options.msg === 'function' ? options.msg : surfaceMessage;
  const checked = validateDocument(document, CATALOG, { entities: options.entities ?? null }).document;
  const doc = /** @type {SurfaceDocument} */ (checked ?? { zx: 'surface/1', surface: '', intent: null, root: [], nodes: [] });
  const values = isObject(reply?.values) ? reply.values : {};
  /** @type {string[]} */
  const lines = [];
  if (doc.title) lines.push(doc.title);
  const nodes = new Map(doc.nodes.map((node) => [node.id, node]));
  const data = doc.data ?? {};
  const action = typeof reply?.action === 'string' ? reply.action : '';
  const answered = Boolean(doc.intent) && !VALUELESS_INTENTS.has(/** @type {string} */ (doc.intent)) && !VALUELESS_ACTIONS.has(action);

  if (answered && doc.intent === 'questionnaire') {
    const node = doc.nodes.find((entry) => entry.type === 'questionnaire');
    const steps = node ? readProp(node, 'steps', data) : null;
    const answers = isObject(values.answers) ? values.answers : {};
    const path = Array.isArray(values.path) ? values.path : Object.keys(answers);
    for (const name of path) {
      const step = Array.isArray(steps) ? steps.find((entry) => isObject(entry) && entry.name === name) : null;
      if (!step || !Object.hasOwn(answers, name)) continue;
      const choices = Array.isArray(step.choices) ? step.choices.map((choice) => [choice.value, choice.label]) : [];
      lines.push(`${step.prompt}: ${display(answers[name], choices, msg)}`);
    }
  } else if (answered) {
    const visibility = surfaceVisibility(doc, values);
    for (const name of visibility.names) {
      if (!Object.hasOwn(values, name) || isEmptyAnswer(values[name])) continue;
      const node = nodes.get(/** @type {string} */ (visibility.owners.get(name)));
      if (!node) continue;
      lines.push(answerLine(node, name, values[name], data, msg));
    }
  }
  const time = typeof reply?.at === 'string' ? reply.at.replace('T', ' ').replace(/:\d\d(?:\.\d+)?$/, '') : '';
  const verdict = verdictText(action, doc.actions ?? [], msg);
  lines.push(time ? msg('surface.verdictAt', verdict, time) : verdict);
  return lines.join('\n');
}

/**
 * The verdict of an action: "Submitted", "Cancelled", …, or "Chose “<label>”" for an action of
 * the surface's own.
 * @param {string} action
 * @param {SurfaceAction[]} actions The surface's own actions.
 * @param {(key: string, ...args: unknown[]) => string} [msg]
 * @returns {string}
 */
export function verdictText(action, actions, msg = surfaceMessage) {
  const own = Array.isArray(actions) ? actions.find((entry) => entry.id === action) : null;
  if (own) return msg('surface.chose', own.label);
  const key = /** @type {Record<string, string>} */ (VERDICT_KEYS)[action];
  return key ? msg(key) : action;
}

/**
 * One answered value with its label.
 * @param {SurfaceNode} node @param {string} name @param {unknown} value @param {unknown} data
 * @param {(key: string, ...args: unknown[]) => string} msg
 * @returns {string}
 */
function answerLine(node, name, value, data, msg) {
  switch (node.type) {
    case 'fields': {
      const schema = /** @type {any} */ (readProp(node, 'schema', data));
      const property = schema?.properties?.[name] ?? {};
      const label = typeof property.title === 'string' && property.title ? property.title : name;
      return `${label}: ${display(value, choicesOf(property), msg)}`;
    }
    case 'choice': {
      const choices = readProp(node, 'choices', data);
      const list = Array.isArray(choices) ? choices.map((choice) => [choice.value, choice.label]) : [];
      return `${labelOf(node, name, data)}: ${display(value, list, msg)}`;
    }
    case 'diff': {
      const rows = readProp(node, 'rows', data);
      const accepted = Array.isArray(value) ? value : [value];
      const changes = (Array.isArray(rows) ? rows : [])
        .filter((row) => accepted.includes(row.id))
        .map((row) => `${row.label} (${cellText(row.before, msg)} → ${cellText(row.after, msg)})`);
      return `${labelOf(node, name, data)}: ${changes.length ? changes.join('; ') : msg('surface.noAnswer')}`;
    }
    default:
      return `${labelOf(node, name, data)}: ${display(value, [], msg)}`;
  }
}

/** @param {SurfaceNode} node @param {string} name @param {unknown} data @returns {string} */
function labelOf(node, name, data) {
  const label = readProp(node, 'label', data);
  return typeof label === 'string' && label ? label : name;
}

/**
 * @param {unknown} value @param {Array<[unknown, unknown]>|unknown[][]} choices
 * @param {(key: string, ...args: unknown[]) => string} msg
 * @returns {string}
 */
function display(value, choices, msg) {
  const title = (/** @type {unknown} */ entry) => {
    const match = choices.find((choice) => choice[0] === entry);
    return match ? String(match[1]) : cellText(entry, msg);
  };
  if (Array.isArray(value)) return value.length ? value.map(title).join(', ') : msg('surface.noAnswer');
  return title(value);
}

/** @param {unknown} value @param {(key: string, ...args: unknown[]) => string} msg @returns {string} */
function cellText(value, msg) {
  if (value === true) return msg('surface.yes');
  if (value === false) return msg('surface.no');
  if (value === null || value === undefined || value === '') return msg('surface.noAnswer');
  if (isObject(value) && typeof value.id === 'string') return value.id;
  return String(value);
}

/**
 * A local ISO date-time without a zone, `YYYY-MM-DDTHH:MM:SS`.
 * @param {Date|string} value
 * @returns {string}
 */
export function localDateTime(value) {
  if (typeof value === 'string') return value;
  const pad = (/** @type {number} */ number) => String(number).padStart(2, '0');
  return `${String(value.getFullYear()).padStart(4, '0')}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    + `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

/** @template T @param {T} value @returns {T} */
function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
