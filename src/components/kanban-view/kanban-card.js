// @ts-check
import { h, safeHref } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { avatarInitials } from '../avatar/avatar.js';
import { badge } from '../badge/badge.js';

/** @typedef {Record<string, any>} KanbanRecord */

/**
 * @typedef {Object} KanbanIndicator
 * @property {string} label Visible text.
 * @property {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} [tone='neutral'] Semantic intent.
 * @property {string|null} [icon=null] Optional leading icon name, used instead of the status dot.
 * @property {boolean} [dot=true] Whether a leading status dot is drawn.
 * @property {string} [title] Native title, useful when the label alone is terse.
 */

/**
 * @typedef {Object} KanbanProgress
 * @property {number} value Completed amount, clamped into `[0, max]`.
 * @property {number} max Amount that counts as finished.
 * @property {number} percent Rounded completion percentage.
 * @property {string|null} label Visible meter label, or null for the caller's default.
 */

/**
 * @typedef {Object} KanbanAssignee
 * @property {string} name Person's name, used as the accessible label.
 * @property {string|null} src Safe image URL, or null for the initials fallback.
 * @property {string} initials Fallback initials.
 */

/** Semantic intents an indicator may carry, in the order they are documented. */
const TONES = Object.freeze(['neutral', 'accent', 'success', 'warning', 'danger', 'info']);

/**
 * Normalizes one indicator value into the descriptor the badge is built from. A plain value
 * becomes the label and looks its tone up in the supplied map, so an application expresses
 * "High means danger" as data rather than as a renderer.
 * @param {unknown} value Raw field value, descriptor, or null.
 * @param {Record<string, string>} [tones={}] Value-to-tone map.
 * @returns {KanbanIndicator|null} Descriptor, or null when there is nothing to show.
 */
export function resolveKanbanIndicator(value, tones = {}) {
  if (value == null || value === '') return null;
  const map = tones && typeof tones === 'object' ? tones : {};
  const source = typeof value === 'object' && !('nodeType' in value)
    ? /** @type {Record<string, any>} */ (value) : { label: value };
  const label = source.label == null ? '' : String(source.label);
  if (!label) return null;
  const mapped = map[label];
  const tone = TONES.includes(source.tone) ? source.tone
    : TONES.includes(mapped) ? mapped : 'neutral';
  return {
    label,
    tone: /** @type {KanbanIndicator['tone']} */ (tone),
    icon: source.icon == null ? null : String(source.icon),
    dot: source.dot !== false && source.icon == null,
    ...(source.title == null ? {} : { title: String(source.title) })
  };
}

/**
 * Builds one indicator badge.
 * @param {KanbanIndicator} indicator Normalized descriptor.
 * @returns {HTMLElement} Badge element.
 */
export function createKanbanIndicator(indicator) {
  return badge({
    label: indicator.label,
    kind: indicator.tone,
    icon: indicator.icon ?? undefined,
    dot: indicator.dot,
    size: 'sm',
    variant: 'soft',
    ...(indicator.title == null ? {} : { title: indicator.title })
  });
}

/**
 * Normalizes a completion value against an explicit scale. The scale is never guessed: a `0.72`
 * on a 0–100 board is seven-tenths of a percent, and only the application knows which it meant.
 * @param {unknown} value Raw field value, or `{value, max, label}`.
 * @param {number} [max=100] Amount that counts as finished.
 * @returns {KanbanProgress|null} Descriptor, or null when there is nothing to show.
 */
export function resolveKanbanProgress(value, max = 100) {
  if (value == null || value === '') return null;
  const source = typeof value === 'object' && !('nodeType' in value)
    ? /** @type {Record<string, any>} */ (value) : { value };
  const limit = Number(source.max ?? max);
  const amount = Number(source.value);
  if (!Number.isFinite(amount) || !Number.isFinite(limit) || limit <= 0) return null;
  const clamped = Math.max(0, Math.min(limit, amount));
  // A blank label must not win over the localized default: it would become aria-label="".
  const label = source.label == null ? '' : String(source.label).trim();
  return {
    value: clamped,
    max: limit,
    percent: Math.round(clamped / limit * 100),
    label: label || null
  };
}

/**
 * Builds the card's completion meter. The track is the accessible progress element itself, so the
 * value is available without depending on the visible percentage text.
 * @param {KanbanProgress} progress Normalized descriptor.
 * @param {string} label Meter label.
 * @param {string} valueText Formatted readout drawn opposite the label.
 * @returns {HTMLElement} Meter element.
 */
export function createKanbanProgress(progress, label, valueText) {
  const track = h('div', {
    class: 'zx-kanban-view__progress-track',
    role: 'progressbar',
    ariaValuemin: '0',
    ariaValuemax: String(progress.max),
    ariaValuenow: String(progress.value),
    ariaValuetext: valueText,
    ariaLabel: label
  }, h('div', { class: 'zx-kanban-view__progress-fill' }));
  // The fill is the only inline style on a card: a percentage cannot be expressed as a token.
  /** @type {HTMLElement} */ (track.firstElementChild).style.inlineSize = `${progress.percent}%`;
  return h('div', { class: 'zx-kanban-view__progress' },
    h('div', { class: 'zx-kanban-view__progress-head' },
      h('span', { class: 'zx-kanban-view__progress-label' }, label),
      h('span', { class: 'zx-kanban-view__progress-value' }, valueText)),
    track);
}

/**
 * Normalizes one or more responsible people. Names, name lists, and descriptor objects all
 * resolve to the same shape, and an unsafe image URL degrades to initials rather than failing.
 * @param {unknown} value Raw field value.
 * @returns {KanbanAssignee[]} Normalized people, in the order supplied.
 */
export function resolveKanbanAssignees(value) {
  if (value == null || value === '') return [];
  const entries = Array.isArray(value) ? value : [value];
  return /** @type {KanbanAssignee[]} */ (entries.map((entry) => {
    if (entry == null || entry === '') return null;
    const source = typeof entry === 'object' && !('nodeType' in entry)
      ? /** @type {Record<string, any>} */ (entry) : { name: entry };
    const name = String(source.name ?? source.label ?? '').trim();
    // An avatar with no name cannot be announced: it would render as an unidentified face inside a
    // group labelled "Assigned to ". A picture without a person is worse than no picture.
    if (!name) return null;
    const src = safeHref(source.src ?? source.image ?? null);
    const initials = source.initials == null ? avatarInitials(name) : String(source.initials);
    return { name, src, initials };
  }).filter(Boolean));
}

/**
 * Splits a list of people into the faces that are drawn and the number the overflow chip stands
 * for. Exists as one function so the slice and the chip can never be computed from different
 * normalizations of the same option — a fractional limit used to floor every face away while the
 * chip still counted from the raw value.
 * @param {number} max Requested face count.
 * @param {number} total People available.
 * @returns {{shown:number,hidden:number}} Normalized split.
 */
export function kanbanAvatarLimit(max, total) {
  // Exported, so a malformed total is normalized here rather than trusted from the caller.
  const people = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const limit = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : people;
  const shown = Math.min(people, limit);
  return { shown, hidden: Math.max(0, people - shown) };
}

/**
 * Builds the assignee avatar group. The group carries one accessible name listing everyone,
 * including the people behind the overflow chip, and the chips themselves are hidden so a screen
 * reader announces the list once rather than once per face.
 * @param {KanbanAssignee[]} people Normalized people.
 * @param {number} max Faces drawn before the overflow chip.
 * @param {string} groupLabel Accessible name for the whole group.
 * @param {(count: number) => string} overflowLabel Text for the overflow chip, given how many
 * people it stands for. The count is derived here so it can never disagree with the slice.
 * @returns {HTMLElement|null} Group element, or null when nobody is assigned.
 */
export function createKanbanAvatars(people, max, groupLabel, overflowLabel) {
  if (!people.length) return null;
  const split = kanbanAvatarLimit(max, people.length);
  const shown = people.slice(0, split.shown);
  const hidden = split.hidden;
  const faces = shown.map((person) => h('span', {
    class: 'zx-kanban-view__avatar', ariaHidden: 'true', title: person.name || undefined
  }, person.src
    ? h('img', { class: 'zx-kanban-view__avatar-image', src: person.src, alt: '', draggable: false })
    : h('span', { class: 'zx-kanban-view__avatar-initials' }, person.initials)));
  if (hidden > 0) {
    faces.push(h('span', {
      class: 'zx-kanban-view__avatar', ariaHidden: 'true', dataset: { overflow: 'true' }
    }, h('span', { class: 'zx-kanban-view__avatar-initials' }, overflowLabel(hidden))));
  }
  return h('span', { class: 'zx-kanban-view__avatars', role: 'img', ariaLabel: groupLabel }, faces);
}

/**
 * Builds the card's head row: what the record is, and how urgent it is.
 * @param {Object} parts Row content.
 * @param {string|null} parts.entityIcon Icon name, or null.
 * @param {string} parts.identifier Record key, or an empty string.
 * @param {{indicator:Node|KanbanIndicator|null,prefix:string}[]} parts.flags Trailing indicators,
 * each with the visually hidden text that names what it measures.
 * @param {string} parts.identifierPrefix Visually hidden text read before the record key.
 * @returns {HTMLElement|null} Head row, or null when it would be empty.
 */
export function createKanbanCardHead(parts) {
  const lead = [];
  if (parts.entityIcon) {
    lead.push(h('span', { class: 'zx-kanban-view__entity', ariaHidden: 'true' },
      icon(parts.entityIcon, { size: 12 })));
  }
  if (parts.identifier) {
    // `aria-label` is prohibited on the generic role, so the prefix is real, clipped text.
    lead.push(h('span', { class: 'zx-kanban-view__identifier' },
      parts.identifierPrefix
        ? h('span', { class: 'zx-kanban-view__hint' }, `${parts.identifierPrefix} `) : null,
      parts.identifier));
  }
  const trailing = (parts.flags ?? []).map((flag) => {
    if (flag.indicator == null) return null;
    const node = typeof flag.indicator === 'object' && 'nodeType' in flag.indicator
      ? /** @type {Node} */ (flag.indicator)
      : createKanbanIndicator(/** @type {KanbanIndicator} */ (flag.indicator));
    // "High" alone does not say high what; the prefix names the axis without adding visible noise.
    return flag.prefix
      ? h('span', { class: 'zx-kanban-view__flag' },
        h('span', { class: 'zx-kanban-view__hint' }, `${flag.prefix} `), node)
      : node;
  }).filter(Boolean);
  if (!lead.length && !trailing.length) return null;
  return h('div', { class: 'zx-kanban-view__card-head' },
    lead.length ? h('span', { class: 'zx-kanban-view__card-lead' }, lead) : null,
    trailing.length ? h('span', { class: 'zx-kanban-view__card-flags' }, trailing) : null);
}
