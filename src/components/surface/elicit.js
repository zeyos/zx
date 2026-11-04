// @ts-check
/**
 * `elicit()`: a form-mode elicitation request — a message and a restricted JSON Schema — drawn as
 * an `ask` surface, answered as `accept`, `decline` or `cancel`. It is the renderer a client of the
 * MCP protocol's form-mode elicitation needs; transport stays with the application.
 */
import { uid } from '../../core/util.js';
import { LIMITS } from './catalog.js';
import { unsupported } from './schema.js';
import { openSurface } from './surface.js';
import { messageResolver, plainInline } from './text.js';

/** @typedef {import('./schema.js').InputSchema} InputSchema */
/** @typedef {import('./surface.js').OpenSurfaceOptions} OpenSurfaceOptions */

/**
 * A form-mode elicitation request.
 * @typedef {Object} ElicitRequest
 * @property {string} message What is asked, and why.
 * @property {InputSchema} requestedSchema One flat object of `string`, `number`, `integer`,
 *   `boolean` and multiple-choice properties.
 */

/**
 * The person's answer.
 * @typedef {Object} ElicitResult
 * @property {'accept'|'decline'|'cancel'} action `accept` with the content, `decline` when the
 *   person refused, `cancel` when they closed the form.
 * @property {Record<string, string|number|boolean|string[]>} [content] The submitted values,
 *   checked against the schema; only with `accept`.
 */

/**
 * Options of `elicit()`: where the form goes, who asks, and the Surface's own options.
 * @typedef {Omit<OpenSurfaceOptions, 'document'> & {
 *   title?: string,
 *   author?: string,
 *   lang?: string,
 *   msg?: Record<string, string>|Record<string, Record<string, string>>
 * }} ElicitOptions
 */

/**
 * The `ask` surface `elicit()` draws for a request: the server's message as plain text — its
 * characters drawn as given, never read as markup — and the form, with Submit and Decline. Labels
 * resolve as a Surface's own do: `options.msg` for the active language, then its flat entries, the
 * host translator, and English. Pure: it draws nothing.
 * @param {ElicitRequest} request
 * @param {ElicitOptions} [options] `title`, `author`, `msg` and `lang` are read.
 * @returns {import('./validate.js').SurfaceDocument}
 * @throws {TypeError} When the schema lies outside the subset, naming what is unsupported.
 */
export function elicitDocument(request, options = {}) {
  const message = typeof request?.message === 'string' ? request.message : '';
  const schema = request?.requestedSchema;
  const problems = unsupported(schema);
  if (problems.length) {
    throw new TypeError(`The requested schema is not supported: ${problems.map((problem) => (problem.path ? `${problem.path}: ${problem.message}` : problem.message)).join('; ')}`);
  }
  const { title, author = 'server' } = options;
  const lang = /** @type {any} */ (options).lang ?? /** @type {any} */ (options).language;
  const text = messageResolver(/** @type {Record<string, any>|undefined} */ (options.msg), typeof lang === 'string' ? lang : undefined);
  const short = message.trim() && message.length <= LIMITS.label;
  /** @type {Array<Record<string, unknown>>} */
  const nodes = [];
  if (message.trim() && (title || !short)) nodes.push({ id: 'message', type: 'text', text: plainInline(message, LIMITS.string) });
  nodes.push({ id: 'form', type: 'fields', schema: structuredClone(schema) });
  return /** @type {any} */ ({
    zx: 'surface/1',
    surface: uid('elicit'),
    intent: 'ask',
    // A title is drawn as text, never as markup.
    title: (title ?? (short ? message : text('surface.requested'))).slice(0, LIMITS.label),
    author,
    root: nodes.map((node) => node.id),
    nodes,
    actions: [
      { id: 'submit', label: text('surface.submit'), kind: 'primary' },
      { id: 'reject', label: text('surface.decline') }
    ]
  });
}

/**
 * Asks the person for the values a request names, in a Dialog — or inline in `options.target` —
 * and resolves with their answer: Submit resolves `accept` with the values checked against the
 * schema, Decline resolves `decline`, and Escape or closing resolves `cancel`. The surface is
 * `elicitDocument()`'s. `options.signal` withdraws the request: when it aborts — or if it already
 * has — the form is cancelled (a dialog closes, an inline form stays as its receipt) and the
 * promise resolves `cancel`.
 * @param {ElicitRequest} request
 * @param {ElicitOptions} [options]
 * @returns {Promise<ElicitResult>}
 * @throws {TypeError} Rejects when the schema lies outside the subset, naming what is unsupported.
 */
export async function elicit(request, options = {}) {
  const document = elicitDocument(request, options);
  const { title, author, target = null, placement, ...rest } = options;
  const reply = await openSurface(document, {
    ...rest,
    target,
    placement: placement ?? (target ? 'inline' : 'dialog')
  });
  if (reply.action === 'submit') return { action: 'accept', content: /** @type {any} */ (reply.values) };
  if (reply.action === 'reject') return { action: 'decline' };
  return { action: 'cancel' };
}
