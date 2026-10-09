import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

/**
 * The shapes a workflow-status glyph can take. Each status reads by shape first and colour
 * second, so the set stays legible to readers who do not see the colour.
 * @typedef {'dotted'|'ring'|'progress'|'review'|'ready'|'waiting'|'done'|'canceled'|'duplicate'} StatusIndicator
 */
/** @typedef {'muted'|'neutral'|'warning'|'info'|'accent'|'success'|'danger'} StatusTone */
/**
 * The built-in workflow statuses. `review` and `cancelled` are accepted as spellings of
 * `in-review` and `canceled`.
 * @typedef {'backlog'|'todo'|'in-progress'|'in-review'|'review'|'ready'|'waiting'|'done'|'canceled'|'cancelled'|'duplicate'} StatusId
 */
/**
 * @typedef {Object} StatusIconOptions
 * @property {StatusIndicator} [indicator] Shape, overriding the status's own.
 * @property {StatusTone} [tone] Colour, overriding the status's own.
 * @property {string|null} [label=null] Accessible name. Without one the glyph is decorative
 *   (`aria-hidden`) and must sit beside text, or inside a control with a tooltip, that says the
 *   status.
 */
/**
 * @typedef {Object} PriorityIconOptions
 * @property {string|null} [label=null] Accessible name. Without one the glyph is decorative
 *   (`aria-hidden`) and must sit beside text, or inside a control with a tooltip, that says the
 *   priority.
 */

/** Every shape `statusIcon()` draws. */
export const STATUS_INDICATORS = Object.freeze([
  'dotted', 'ring', 'progress', 'review', 'ready', 'waiting', 'done', 'canceled', 'duplicate'
]);

/** Every colour a status glyph takes, from the semantic set. */
export const STATUS_TONES = Object.freeze([
  'muted', 'neutral', 'warning', 'info', 'accent', 'success', 'danger'
]);

/**
 * The built-in statuses in workflow order, as `[id, message key, English name, indicator, tone]`.
 * `Select.status()` lists them; `statusIcon()` draws them.
 */
export const DEFAULT_STATUSES = Object.freeze([
  ['backlog', 'status.backlog', 'Backlog', 'dotted', 'muted'],
  ['todo', 'status.todo', 'Todo', 'ring', 'neutral'],
  ['in-progress', 'status.inProgress', 'In Progress', 'progress', 'warning'],
  ['in-review', 'status.inReview', 'In Review', 'review', 'info'],
  ['ready', 'status.ready', 'Ready to Merge', 'ready', 'accent'],
  ['waiting', 'status.waiting', 'Waiting for feedback', 'waiting', 'warning'],
  ['done', 'status.done', 'Done', 'done', 'info'],
  ['canceled', 'status.canceled', 'Canceled', 'canceled', 'muted'],
  ['duplicate', 'status.duplicate', 'Duplicate', 'duplicate', 'muted']
]);

/** Other spellings of the built-in status ids. */
const STATUS_ALIASES = Object.freeze({ review: 'in-review', cancelled: 'canceled' });

/** The top priority level, the one coloured level: a danger square with an exclamation mark. */
export const PRIORITY_URGENT = 4;

/**
 * Resolves the shape and colour of a status glyph.
 *
 * A status is a built-in id (or one of its other spellings), or a status item of the kind
 * `Select.status({items})` takes, whose own `indicator` and `tone` win over the built-in status
 * its `ID` names. Options win over both. An unknown shape falls back to the empty ring and an
 * unknown colour to muted, as `Select.status()` does with a custom item.
 * @param {StatusId|string|{ID?: unknown, id?: unknown, indicator?: unknown, tone?: unknown}|null|undefined} status
 * @param {StatusIconOptions} [options={}] Overrides.
 * @returns {{indicator: StatusIndicator, tone: StatusTone}}
 */
export function resolveStatusGlyph(status, options = {}) {
  const item = status && typeof status === 'object' ? status : null;
  const id = normalizeStatusId(item ? (item.ID ?? item.id) : status);
  const preset = DEFAULT_STATUSES.find(([key]) => key === id);
  const indicator = String(options.indicator ?? item?.indicator ?? preset?.[3] ?? 'ring');
  const tone = String(options.tone ?? item?.tone ?? preset?.[4] ?? 'muted');
  return {
    indicator: /** @type {StatusIndicator} */ (STATUS_INDICATORS.includes(indicator) ? indicator : 'ring'),
    tone: /** @type {StatusTone} */ (STATUS_TONES.includes(tone) ? tone : 'muted')
  };
}

/**
 * Maps a status id to its built-in spelling: trimmed, lower-cased, and `review` / `cancelled`
 * read as `in-review` / `canceled`.
 * @param {unknown} id Status id.
 * @returns {string}
 */
export function normalizeStatusId(id) {
  const key = String(id ?? '').trim().toLowerCase();
  return STATUS_ALIASES[key] ?? key;
}

/**
 * Settles a priority level: an integer from 0 (lowest) to 4 (highest), or `null` for no priority.
 * Out-of-range numbers clamp; anything that is not a number reads as 0.
 * @param {unknown} level Priority level.
 * @returns {number|null}
 */
export function normalizePriorityLevel(level) {
  if (level === null || level === undefined || level === '') return null;
  return Math.max(0, Math.min(PRIORITY_URGENT, Math.trunc(Number(level) || 0)));
}

/**
 * Draws the workflow-status glyph `Select.status()` shows, for a list row, a board column, a
 * filter chip, or a heading — so every place a status appears reads as the picker that changes it.
 *
 * Built-in statuses: `backlog` (dotted ring), `todo` (empty ring), `in-progress` (ring with a
 * centre dot), `in-review` (half filled; also `review`), `ready` (a third filled), `waiting` (two
 * thirds filled), `done` (filled, with a check), `canceled` (filled, with a cross; also
 * `cancelled`), and `duplicate` (ring with a slash). Colour only repeats what the shape says.
 * @param {StatusId|string|{ID?: unknown, indicator?: unknown, tone?: unknown}} status Built-in id,
 *   or a status item with its own `indicator` and `tone`.
 * @param {StatusIconOptions} [options={}] Shape, colour, and accessible-name overrides.
 * @returns {HTMLSpanElement} A `.zx-status-icon` element, decorative unless `label` is given.
 */
export function statusIcon(status, options = {}) {
  const { indicator, tone } = resolveStatusGlyph(status, options ?? {});
  const marker = /** @type {HTMLSpanElement} */ (h('span', {
    class: 'zx-status-icon',
    dataset: { indicator, tone }
  }));
  if (indicator === 'done') marker.append(icon('check', { size: 8 }));
  if (indicator === 'canceled') marker.append(icon('x', { size: 7 }));
  return name(marker, options?.label);
}

/**
 * Draws the priority glyph `Select.priority()` shows. Levels 0–3 are four signal bars in muted
 * ink, filled up to the level; level 4, the highest, is a filled danger square whose "!" the
 * stylesheet draws, so it never joins the text beside it; no priority (`null`) is a row of dashes.
 * @param {number|null} level Priority level, 0 (lowest) to 4 (highest), or `null` for none.
 * @param {PriorityIconOptions} [options={}] Accessible-name option.
 * @returns {HTMLSpanElement} A `.zx-priority-icon` element, decorative unless `label` is given.
 */
export function priorityIcon(level, options = {}) {
  const normalized = normalizePriorityLevel(level);
  const glyph = /** @type {HTMLSpanElement} */ (h('span', {
    class: 'zx-priority-icon',
    dataset: { level: normalized === null ? 'none' : normalized }
  }, normalized === PRIORITY_URGENT ? null : Array.from({ length: PRIORITY_URGENT }, (_, index) => h('span', {
    dataset: { filled: String(normalized !== null && index <= normalized) }
  }))));
  return name(glyph, options?.label);
}

/**
 * Makes a glyph an image with an accessible name, or hides it from assistive technology.
 * @param {HTMLSpanElement} glyph Glyph element.
 * @param {unknown} label Accessible name, if any.
 * @returns {HTMLSpanElement}
 */
function name(glyph, label) {
  const text = label == null ? '' : String(label).trim();
  if (text) {
    glyph.setAttribute('role', 'img');
    glyph.setAttribute('aria-label', text);
  } else {
    glyph.setAttribute('aria-hidden', 'true');
  }
  return glyph;
}
