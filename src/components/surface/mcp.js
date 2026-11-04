// @ts-check
/**
 * `elicitationHandler()`: answers MCP elicitation requests with surfaces.
 *
 * In MCP, a server asks the client for input in one of two modes. In form mode it sends a message
 * and a restricted JSON Schema, and the person fills a form. In URL mode it sends a message and an
 * address, and the person is sent to that page. The handler takes the request's `params` already
 * parsed, whether they came as an `elicitation/create` request or as an `inputRequests` entry of
 * an `input_required` result, and resolves the result the client sends back. The application owns
 * the MCP client: transport, sessions and authentication stay with it.
 */
import { uid } from '../../core/util.js';
import { LIMITS } from './catalog.js';
import { elicit } from './elicit.js';
import { openSurface } from './surface.js';
import { messageResolver, plainInline } from './text.js';
import { normaliseLink } from './validate.js';

/** @typedef {import('./elicit.js').ElicitResult} ElicitResult */
/** @typedef {import('./schema.js').InputSchema} InputSchema */
/** @typedef {import('./surface.js').SurfaceReply} SurfaceReply */

/** The MCP revision whose elicitation the handler implements. */
export const MCP_ELICITATION_VERSION = '2026-07-28';

/** The author key every elicitation surface is drawn under; its name is the server's. */
const AUTHOR = 'mcp-server';

/**
 * An elicitation request's `params`. Form mode is the default when `mode` is absent; fields a mode
 * does not use, such as the `elicitationId` of earlier revisions, are ignored.
 * @typedef {Object} ElicitationParams
 * @property {'form'|'url'} [mode] How the server asks.
 * @property {string} message What is asked, and why.
 * @property {InputSchema} [requestedSchema] Form mode: one flat object of primitive and
 *   multiple-choice properties.
 * @property {string} [url] URL mode: the page the person is sent to, `https:` only.
 * @property {string} [elicitationId] Sent by servers of the 2025-11-25 revision; ignored.
 */

/**
 * Options of `elicitationHandler()`.
 * @typedef {Object} ElicitationHandlerOptions
 * @property {string} serverName The name of the server that asks, as the client knows it; shown as
 *   "Asked by <server>". Required: the person must always see who asks.
 * @property {Record<string, {name: string}>} [authors={}] Display names by key; when it lists
 *   `serverName`, that entry's name is shown instead.
 * @property {Element|string|null} [target=null] Where the surface goes inline; a Dialog without one.
 * @property {(url: string) => boolean|void} [open] Opens the page in URL mode, after the person
 *   agreed. It receives the normalised address and must open it in a new browsing context that
 *   cannot reach the application; returning `false` or throwing means it was not opened, and the
 *   request answers `cancel`. The default opens a new tab with `noopener` and `noreferrer`.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized
 *   messages, flat or by language: the `mcp.*` keys, and the `surface.*` keys of the form.
 */

/**
 * What the client knows about one request beyond its `params`.
 * @typedef {Object} ElicitationContext
 * @property {AbortSignal|null} [signal] Withdraws the request — the server cancelled it, the call
 *   timed out, the session closed: the surface is cancelled with the reason `stopped` (a dialog
 *   closes, an inline surface stays as its receipt), nothing opens, and the request resolves
 *   `cancel`. Already aborted, it resolves `cancel` without drawing anything. Abort it as well
 *   when the application removes an inline `target`, or the request stays pending.
 */

/**
 * A URL-mode address, checked and normalised.
 * @typedef {Object} ElicitationUrl
 * @property {string} href The normalised address: what is shown in full and what is opened.
 * @property {string} host The host, with its port when it has one, as the browser will reach it.
 * @property {boolean} international Whether the host holds an internationalised (Punycode) label,
 *   which can imitate another name.
 */

/**
 * Creates the function an MCP client installs to answer elicitation requests. Form mode draws an
 * `ask` surface through `elicit()`. URL mode draws a `confirm` surface naming the page's host,
 * emphasised, and its full address; nothing is loaded and nothing opens until the person agrees.
 * Open the page opens it in a new browsing context, without opener or referrer, and answers
 * `accept`; Decline answers `decline`; Cancel, Escape or closing the dialog answers `cancel`.
 * @param {ElicitationHandlerOptions} options
 * @returns {(params: ElicitationParams, context?: ElicitationContext) => Promise<ElicitResult>}
 *   Resolves the result to send back;
 *   rejects with a `TypeError` — so the client can answer the server with an error — for a request
 *   that is not an object, an unknown `mode`, a `message` that is not text, a schema outside the
 *   supported subset, or an address that is not a valid `https:` URL.
 * @throws {TypeError} When `serverName` is missing.
 */
export function elicitationHandler(options) {
  const serverName = typeof options?.serverName === 'string' ? options.serverName.trim() : '';
  if (!serverName) throw new TypeError('elicitationHandler() needs the "serverName" of the server that asks');
  const authors = options.authors && typeof options.authors === 'object' ? options.authors : {};
  const listed = Object.hasOwn(authors, serverName) ? authors[serverName]?.name : undefined;
  const shown = (typeof listed === 'string' && listed.trim() ? listed : serverName).slice(0, LIMITS.label);
  const target = options.target ?? null;
  const open = typeof options.open === 'function' ? options.open : openPage;
  const own = options.msg && typeof options.msg === 'object' ? options.msg : null;
  const text = messageResolver(own);

  return async (params, context = {}) => {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      throw new TypeError('An elicitation request is an object');
    }
    const mode = params.mode;
    if (mode !== undefined && mode !== 'form' && mode !== 'url') {
      throw new TypeError(`The elicitation mode ${JSON.stringify(mode)} is not supported; use "form" or "url"`);
    }
    if (typeof params.message !== 'string') throw new TypeError('An elicitation request needs a "message"');
    // Read on every request, so a language switched in between is honoured.
    const msg = withByline(own, text('mcp.askedBy'));
    const signal = context?.signal ?? null;
    const surface = { target, authors: { [AUTHOR]: { name: shown } }, msg, signal };
    if (mode === 'url') return askToOpen(params.message, elicitationUrl(params.url), surface, open, text);
    return elicit({ message: params.message, requestedSchema: /** @type {InputSchema} */ (params.requestedSchema) },
      { ...surface, author: AUTHOR });
  };
}

/**
 * Checks a URL-mode address the way surface links are checked, and normalises it: an absolute
 * `https://` address in lower case, without credentials, spaces, backslashes, control or invisible
 * formatting characters, at most 2000 characters. The address returned is the parsed one, so the
 * host shown and the page opened come from the same string.
 * @param {unknown} value The request's `url`.
 * @returns {ElicitationUrl}
 * @throws {TypeError} When the address is missing or refused.
 */
export function elicitationUrl(value) {
  if (value === undefined) throw new TypeError('The elicitation URL is refused: a URL-mode request needs a "url"');
  const link = normaliseLink(value);
  if (link.href === null) throw new TypeError(`The elicitation URL is refused: ${link.problem}`);
  const url = new URL(link.href);
  return { href: link.href, host: url.host, international: url.hostname.split('.').some((label) => label.startsWith('xn--')) };
}

/**
 * The `confirm` surface that asks before a URL-mode page opens: the server's message as plain
 * text, the host emphasised, the full address, a warning for an internationalised host, and what
 * opening does. No part of it is a link.
 * @param {string} message The server's message.
 * @param {ElicitationUrl} url From `elicitationUrl()`.
 * @param {(key: string, ...args: unknown[]) => string} [text] Resolves the `mcp.*` messages;
 *   English by default.
 * @returns {import('./validate.js').SurfaceDocument}
 */
export function urlConsentDocument(message, url, text = messageResolver(null)) {
  /** @type {Array<Record<string, unknown>>} */
  const nodes = [];
  if (message.trim()) nodes.push({ id: 'message', type: 'text', text: plainInline(message, LIMITS.string) });
  nodes.push({ id: 'host', type: 'text', text: text('mcp.urlHost', `**${plainInline(url.host)}**`) });
  nodes.push({ id: 'address', type: 'text', text: text('mcp.urlAddress', plainInline(url.href)) });
  if (url.international) nodes.push({ id: 'international', type: 'callout', tone: 'warning', text: text('mcp.urlInternational') });
  nodes.push({ id: 'note', type: 'text', text: text('mcp.urlNote') });
  return /** @type {any} */ ({
    zx: 'surface/1',
    surface: uid('elicit-url'),
    intent: 'confirm',
    title: text('mcp.urlTitle').slice(0, LIMITS.label),
    author: AUTHOR,
    root: nodes.map((node) => node.id),
    nodes,
    actions: [
      { id: 'confirm', label: text('mcp.urlOpen').slice(0, LIMITS.label), kind: 'primary' },
      { id: 'reject', label: text('mcp.decline').slice(0, LIMITS.label) }
    ]
  });
}

/* ------------------------------------------------------------------ module helpers -- */

/**
 * Asks before opening a URL-mode page, and opens it in the click that agreed.
 * @param {string} message @param {ElicitationUrl} url
 * @param {{target: Element|string|null, authors: Record<string, {name: string}>, msg: Record<string, any>, signal: AbortSignal|null}} surface
 * @param {(url: string) => boolean|void} open
 * @param {(key: string, ...args: unknown[]) => string} text
 * @returns {Promise<ElicitResult>}
 */
async function askToOpen(message, url, surface, open, text) {
  let opened = false;
  const reply = await openSurface(urlConsentDocument(message, url, text), {
    ...surface,
    placement: surface.target ? 'inline' : 'dialog',
    // The page opens inside the person's click, before the dialog closes, so a browser that
    // blocks pages opened without a gesture lets it through.
    onopen: (drawn) => drawn.on('reply', (event) => {
      if (/** @type {CustomEvent<{reply: SurfaceReply}>} */ (event).detail.reply.action !== 'confirm') return;
      try {
        opened = open(url.href) !== false;
      } catch {
        opened = false;
      }
    })
  });
  if (reply.action === 'confirm') return { action: opened ? 'accept' : 'cancel' };
  if (reply.action === 'reject') return { action: 'decline' };
  return { action: 'cancel' };
}

/**
 * The default opener: a new top-level browsing context that gets neither a handle on this page
 * nor its address.
 * @param {string} href
 * @returns {boolean}
 */
function openPage(href) {
  const view = globalThis.window;
  if (typeof view?.open !== 'function') return false;
  // With "noopener" the browser returns no handle, so a blocked window cannot be told apart.
  view.open(href, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * The `msg` a surface gets: the application's, with the byline saying who asks — in every
 * language table it holds, so none of them says "Composed by".
 * @param {Record<string, any>|null} own @param {string} byline
 * @returns {Record<string, any>}
 */
function withByline(own, byline) {
  /** @type {Record<string, any>} */
  const msg = {};
  for (const [key, value] of Object.entries(own ?? {})) {
    msg[key] = value && typeof value === 'object' ? { ...value, 'surface.byline': byline } : value;
  }
  msg['surface.byline'] = byline;
  return msg;
}
