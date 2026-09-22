// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, safeHref, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { printf } from '../../core/i18n.js';
import { isElement, uid } from '../../core/util.js';
import { Avatar } from '../avatar/avatar.js';
import { badge } from '../badge/badge.js';
import { button } from '../button/button.js';

/** @typedef {string|number|Node|Component|null} ActivityContent */
/** @typedef {import('../avatar/avatar.js').AvatarOptions} AvatarOptions */
/** @typedef {AvatarOptions|Element|null} ActivityAvatar */

/**
 * @typedef {Object} ActivityAction
 * @property {string|number} id Stable action identifier.
 * @property {string} [label=''] Visible label.
 * @property {string|null} [icon=null] Icon name.
 * @property {string|null} [href=null] Optional safe native-link destination.
 * @property {string} [target] Native browsing context.
 * @property {string} [rel] Native link relationship.
 * @property {string} [title] Native title and icon-only accessible label.
 * @property {boolean} [disabled=false] Whether the action is unavailable.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='ghost'] Visual intent.
 * @property {(event:MouseEvent)=>void} [onselect] Host-owned activation callback.
 */

/** @typedef {Element|ActivityAction} ActivityActionSlot */

/**
 * @typedef {Object} NormalizedActivityAction
 * @property {string} id Stable action identifier.
 * @property {string} label Visible label.
 * @property {string|null} icon Icon name.
 * @property {string|null} href Safe native-link destination.
 * @property {string|undefined} target Native browsing context.
 * @property {string|undefined} rel Native link relationship.
 * @property {string|undefined} title Native title.
 * @property {boolean} disabled Whether the action is unavailable.
 * @property {'default'|'primary'|'danger'|'ghost'} kind Visual intent.
 * @property {((event:MouseEvent)=>void)|undefined} onselect Host callback.
 */

/**
 * @typedef {Object} ActivityTime
 * @property {string|null} dateTime Machine-readable ISO timestamp when valid.
 * @property {string} label Human-readable timestamp.
 */

/** @typedef {'default'|'pending'|'failed'} ActivityState Delivery state of one entry. */

/**
 * @typedef {Object} ActivityStateDescriptor
 * @property {ActivityState} state Resolved state.
 * @property {boolean} busy Whether the entry is still waiting on its request.
 * @property {string|null} key Message key for the built-in word, or null when no badge is shown.
 * @property {string|null} fallback Built-in English word, or null when no badge is shown.
 * @property {'neutral'|'danger'} kind Badge intent.
 * @property {string|null} label Host-supplied word replacing the built-in one.
 */

/**
 * @typedef {Object} ActivityItemOptions
 * @property {unknown} [id=null] Host-owned activity identifier.
 * @property {ActivityContent} [actor=''] Actor identity text or presentation slot.
 * @property {ActivityAvatar} [avatar=null] Avatar descriptor or host-owned avatar element.
 * @property {ActivityContent} [title=''] Activity summary.
 * @property {ActivityContent} [content=null] Optional body slot.
 * @property {Date|string|number|null} [timestamp=null] Date, parseable date string, or epoch milliseconds.
 * @property {string|null} [timeLabel=null] Explicit human-readable timestamp.
 * @property {ActivityContent[]} [metadata=[]] Compact metadata slots.
 * @property {ActivityContent[]} [attachments=[]] Attachment presentation slots, commonly FileItem elements.
 * @property {ActivityActionSlot[]} [actions=[]] Native action descriptors or host-owned controls.
 * @property {string} [kind='default'] Product-neutral activity kind exposed as `data-kind`.
 * @property {ActivityState} [state='default'] Delivery state exposed as `data-state`.
 * @property {string|null} [stateLabel=null] Word shown in the state badge instead of the built-in one.
 * @property {1|2|3|4|5|6} [headingLevel=3] Semantic heading level for the activity summary.
 * @property {(event:CustomEvent<{id:string,action:NormalizedActivityAction,event:MouseEvent}>)=>void} [onaction]
 */

/**
 * One chronological activity entry with safe content slots, timestamp semantics, and native
 * actions. Posting, reactions, routing, permissions, persistence, and content sanitization remain
 * host responsibilities; server HTML is never interpreted by this component.
 *
 * @fires ActivityItem#action
 * @extends {Component<ActivityItemOptions>}
 */
export class ActivityItem extends Component {
  static cssName = 'activity-item';

  /** @type {Readonly<ActivityItemOptions>} */
  static defaults = {
    id: null,
    actor: '',
    avatar: null,
    title: '',
    content: null,
    timestamp: null,
    timeLabel: null,
    metadata: [],
    attachments: [],
    actions: [],
    kind: 'default',
    state: 'default',
    stateLabel: null,
    headingLevel: 3
  };

  /**
   * Creates or enhances an activity item.
   * @param {Element|string|null} [target=null] Existing list item/container, selector, or null.
   * @param {ActivityItemOptions} [options={}] Activity presentation options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('li'));
    this.el = root;
    this._createdRoot = created;
    this._original = created ? null : snapshotTarget(root);
    this._cleaned = false;
    this._headingId = uid('zx-activity-item-heading');
    this._avatarComponent = null;
    this._actionsByKey = new Map();
    this._activity = normalizeActivityItem(this.options);

    try {
      this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));
      this._renderActivity();
      return root;
    } catch (error) {
      this._avatarComponent?.destroy();
      this._avatarComponent = null;
      if (!created) restoreTarget(root, this._original);
      throw error;
    }
  }

  /**
   * Replaces any subset of the activity presentation.
   * @param {Partial<ActivityItemOptions>} values New values.
   * @returns {this}
   */
  setActivity(values = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new TypeError('ActivityItem values must be an object');
    }
    this._activity = normalizeActivityItem({ ...this._activity, ...values });
    this._renderActivity();
    return this;
  }

  /** Returns a shallow, host-safe copy of the current descriptor. @returns {ActivityItemOptions} */
  getActivity() {
    return cloneActivityItem(this._activity);
  }

  /** Restores an enhanced target exactly, or removes an owned item. @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    this._avatarComponent?.destroy();
    this._avatarComponent = null;
    super.destroy();
    if (!this._createdRoot) restoreTarget(this.el, this._original);
  }

  /** @private @returns {void} */
  _renderActivity() {
    this._avatarComponent?.destroy();
    this._avatarComponent = null;
    this._actionsByKey.clear();
    const activity = this._activity;
    const root = /** @type {HTMLElement} */ (this.el);
    const serializedId = serializeActivityId(activity.id);
    if (serializedId === null) delete root.dataset.activityId;
    else root.dataset.activityId = serializedId;
    root.dataset.kind = normalizeActivityKind(activity.kind);

    const state = resolveActivityState(activity.state, activity.stateLabel);
    root.dataset.state = state.state;
    /*
     * Only a pending entry is busy. A failed one has finished — badly, but finished — and leaving
     * `aria-busy` on it would tell a screen reader the region is still updating and suppress the
     * very announcement that says the send did not happen.
     */
    if (state.busy) root.setAttribute('aria-busy', 'true');
    else root.removeAttribute('aria-busy');

    const actor = activityContent(activity.actor, 'Activity actor');
    const title = activityContent(activity.title, 'Activity title');
    const headingChildren = [];
    if (actor !== null) {
      headingChildren.push(h('span', { class: 'zx-activity-item__actor' }, actor));
    }
    if (title !== null) {
      headingChildren.push(h('span', { class: 'zx-activity-item__title' }, title));
    }
    const heading = headingChildren.length ? h(`h${normalizeHeadingLevel(activity.headingLevel)}`, {
      class: 'zx-activity-item__heading',
      id: this._headingId
    }, headingChildren) : null;
    const time = createActivityTime(activity.timestamp, activity.timeLabel);
    const stateBadge = this._createStateBadge(state);
    const header = heading || time || stateBadge
      ? h('header', { class: 'zx-activity-item__header' }, heading, stateBadge, time) : null;

    const bodyContent = activityContent(activity.content, 'Activity content');
    const body = bodyContent === null ? null : h('div', {
      class: 'zx-activity-item__body'
    }, bodyContent);
    const metadata = createContentList(activity.metadata, 'zx-activity-item__metadata',
      'Activity metadata', this._message('activityItem.metadata', 'Activity metadata'));
    const attachments = createContentRegion(activity.attachments, 'zx-activity-item__attachments',
      'Attachments', this._message('activityItem.attachments', 'Attachments'));
    const actions = this._createActions(activity.actions);
    const main = h('div', { class: 'zx-activity-item__main' }, header, body, metadata, attachments, actions);
    const avatar = this._createAvatar(activity.avatar, activity.actor);
    const article = h('article', {
      class: 'zx-activity-item__article',
      ariaLabelledby: heading ? this._headingId : undefined,
      ariaLabel: heading ? undefined : this._message('activityItem.label', 'Activity')
    }, avatar ? h('div', { class: 'zx-activity-item__avatar' }, avatar) : null, main);
    root.replaceChildren(article);
  }

  /**
   * Builds the delivery badge, or nothing for an ordinary entry.
   * @private
   * @param {ActivityStateDescriptor} state Resolved state.
   * @returns {HTMLElement|null}
   */
  _createStateBadge(state) {
    if (state.key === null || state.fallback === null) return null;
    const element = badge({
      label: state.label ?? this._message(state.key, state.fallback),
      kind: state.kind,
      size: 'sm'
    });
    element.classList.add('zx-activity-item__state');
    return element;
  }

  /** @private @param {ActivityAvatar} value @param {ActivityContent} actor @returns {Element|null} */
  _createAvatar(value, actor) {
    if (value === null) return null;
    if (isElement(value)) return value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('ActivityItem avatar must be an Element, descriptor, or null');
    }
    const settings = {
      ...value,
      name: value.name || textAlternative(actor),
      label: value.label ?? null,
      size: value.size ?? 'md'
    };
    this._avatarComponent = new Avatar(null, settings);
    return this._avatarComponent.toElement();
  }

  /** @private @param {ActivityActionSlot[]} value @returns {HTMLElement|null} */
  _createActions(value) {
    const actions = resolveActivityActions(value);
    if (actions.length === 0) return null;
    const controls = actions.map((action, index) => {
      if (isElement(action)) return action;
      const key = String(index);
      this._actionsByKey.set(key, action);
      return createActionControl(action, key);
    });
    const name = activityLabel(this._activity, this._message('activityItem.untitled', 'activity'));
    return h('div', {
      class: 'zx-activity-item__actions',
      role: 'group',
      ariaLabel: this._message('activityItem.actions', 'Actions for %1', name)
    }, controls);
  }

  /**
   * Resolves a message through the host translator, falling back to the built-in English text.
   * @param {string} key Message key.
   * @param {string} fallback Built-in text, with `%1`-style placeholders.
   * @param {...unknown} args Interpolation values.
   * @returns {string}
   */
  _message(key, fallback, ...args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
  }

  /** @private @param {MouseEvent} event @returns {void} */
  _onClick(event) {
    const origin = event.target && typeof event.target === 'object'
      ? /** @type {Element} */ (event.target) : null;
    const control = /** @type {HTMLElement|null} */ (origin?.closest?.('[data-activity-action]') ?? null);
    if (!control || !this.el.contains(control)) return;
    const action = this._actionsByKey.get(control.dataset.activityAction ?? '');
    if (!action || action.disabled) {
      event.preventDefault();
      return;
    }
    const emitted = this.emit('action', { id: action.id, action, event }, {
      honorDomCancellation: true
    });
    if (emitted.defaultPrevented) {
      event.preventDefault();
      return;
    }
    action.onselect?.(event);
  }
}

/**
 * Normalizes action descriptors without mutating the caller's array or objects. Invalid entries
 * and duplicate descriptor IDs are discarded; host-owned Elements pass through unchanged.
 * @param {unknown} value Candidate action array.
 * @returns {Array<Element|NormalizedActivityAction>}
 */
export function resolveActivityActions(value) {
  if (!Array.isArray(value)) return [];
  const resolved = [];
  const seen = new Set();
  for (const entry of value) {
    if (isElement(entry)) {
      resolved.push(entry);
      continue;
    }
    const action = normalizeActivityAction(entry);
    if (!action || seen.has(action.id)) continue;
    seen.add(action.id);
    resolved.push(action);
  }
  return resolved;
}

/**
 * Normalizes one action descriptor and rejects unsafe native destinations.
 * @param {unknown} value Candidate action.
 * @returns {NormalizedActivityAction|null}
 */
export function normalizeActivityAction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = /** @type {Record<string, unknown>} */ (value);
  if (source.id === null || source.id === undefined) return null;
  const id = String(source.id).trim();
  if (!id) return null;
  const label = source.label == null ? '' : String(source.label);
  const iconName = source.icon == null ? null : String(source.icon).trim() || null;
  const title = source.title == null ? undefined : String(source.title);
  // An icon alone has no accessible name. `title` is the supported icon-only label fallback.
  if (!label && !title) return null;
  const hasHref = source.href !== null && source.href !== undefined;
  const href = hasHref ? safeHref(source.href) : null;
  if (hasHref && href === null) return null;
  if (source.onselect !== undefined && typeof source.onselect !== 'function') return null;
  const target = source.target == null ? undefined : String(source.target);
  return {
    id,
    label,
    icon: iconName,
    href,
    target,
    rel: safeRel(source.rel, target),
    title,
    disabled: Boolean(source.disabled),
    kind: normalizeActionKind(source.kind),
    onselect: /** @type {((event:MouseEvent)=>void)|undefined} */ (source.onselect)
  };
}

/** Built-in delivery states. An entry in neither is an ordinary, settled entry. */
const ACTIVITY_STATES = Object.freeze({
  pending: Object.freeze({
    busy: true, key: 'activityItem.pending', fallback: 'Sending…', kind: 'neutral'
  }),
  failed: Object.freeze({
    busy: false, key: 'activityItem.failed', fallback: 'Failed', kind: 'danger'
  })
});

/**
 * Resolves the delivery state of one entry.
 *
 * `failed` is a first-class state and not the absence of `pending`: an optimistic entry that
 * simply disappears when its request fails tells the customer their message was sent when nobody
 * was told, so the component keeps the entry and says what happened to it.
 * @param {unknown} state Requested state.
 * @param {unknown} stateLabel Host-supplied word replacing the built-in one.
 * @returns {ActivityStateDescriptor}
 */
export function resolveActivityState(state, stateLabel) {
  const name = String(state ?? 'default');
  const preset = Object.prototype.hasOwnProperty.call(ACTIVITY_STATES, name)
    ? ACTIVITY_STATES[/** @type {'pending'|'failed'} */ (name)] : null;
  if (!preset) {
    return { state: 'default', busy: false, key: null, fallback: null, kind: 'neutral', label: null };
  }
  return {
    state: /** @type {ActivityState} */ (name),
    busy: preset.busy,
    key: preset.key,
    fallback: preset.fallback,
    kind: /** @type {'neutral'|'danger'} */ (preset.kind),
    label: stateLabel == null || stateLabel === '' ? null : String(stateLabel)
  };
}

/**
 * Resolves a timestamp for native `<time>` markup without treating invalid input as a real date.
 * @param {Date|string|number|null|undefined} timestamp Date-like value.
 * @param {string|null|undefined} timeLabel Explicit display label.
 * @returns {ActivityTime|null}
 */
export function normalizeActivityTimestamp(timestamp, timeLabel) {
  const explicit = timeLabel == null ? '' : String(timeLabel).trim();
  if (timestamp === null || timestamp === undefined || timestamp === '') {
    return explicit ? { dateTime: null, label: explicit } : null;
  }
  const date = timestamp instanceof Date ? new Date(timestamp.getTime()) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    const fallback = explicit || (typeof timestamp === 'string' ? timestamp.trim() : '');
    return fallback ? { dateTime: null, label: fallback } : null;
  }
  return {
    dateTime: date.toISOString(),
    label: explicit || formatActivityDate(date)
  };
}

/** @param {ActivityItemOptions} source @returns {ActivityItemOptions} */
function normalizeActivityItem(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('ActivityItem options must be an object');
  }
  for (const key of ['metadata', 'attachments', 'actions']) {
    if (!Array.isArray(source[key])) throw new TypeError(`ActivityItem ${key} must be an array`);
  }
  return cloneActivityItem(source);
}

/** @param {ActivityItemOptions} source @returns {ActivityItemOptions} */
function cloneActivityItem(source) {
  const avatar = source.avatar && !isElement(source.avatar)
    ? { ...source.avatar } : source.avatar ?? null;
  return {
    ...source,
    avatar,
    metadata: [...(source.metadata ?? [])],
    attachments: [...(source.attachments ?? [])],
    actions: [...(source.actions ?? [])]
  };
}

/** @param {NormalizedActivityAction} action @param {string} key @returns {HTMLElement} */
function createActionControl(action, key) {
  if (action.href && !action.disabled) {
    const control = h('a', {
      class: 'zx-btn zx-activity-item__action',
      href: action.href,
      target: action.target,
      rel: action.rel,
      title: action.title,
      dataset: { activityAction: key, kind: action.kind, size: 'sm' }
    });
    if (action.icon) control.append(icon(action.icon, { size: 16 }));
    if (action.label) control.append(h('span', { class: 'zx-btn__label' }, action.label));
    if (!action.label && action.title) control.setAttribute('aria-label', action.title);
    return control;
  }
  const control = button({
    label: action.label,
    icon: action.icon,
    kind: action.kind,
    size: 'sm',
    disabled: action.disabled,
    title: action.title
  });
  control.classList.add('zx-activity-item__action');
  control.dataset.activityAction = key;
  return control;
}

/** @param {Date|string|number|null} timestamp @param {string|null} label @returns {HTMLElement|null} */
function createActivityTime(timestamp, label) {
  const resolved = normalizeActivityTimestamp(timestamp, label);
  if (!resolved) return null;
  if (resolved.dateTime === null) {
    return h('span', { class: 'zx-activity-item__time' }, resolved.label);
  }
  return h('time', {
    class: 'zx-activity-item__time',
    dateTime: resolved.dateTime,
    title: resolved.label
  }, resolved.label);
}

/**
 * `label` names the slot in a developer-facing TypeError and stays English; `name` is the
 * accessible name a screen reader reads and is translated.
 * @param {ActivityContent[]} values @param {string} className @param {string} label
 * @param {string} name @returns {HTMLElement|null}
 */
function createContentList(values, className, label, name) {
  if (values.length === 0) return null;
  return h('ul', { class: className, ariaLabel: name }, values.map((value) =>
    h('li', { class: `${className}-item` }, activityContent(value, label))));
}

/**
 * @param {ActivityContent[]} values @param {string} className @param {string} label
 * @param {string} name @returns {HTMLElement|null}
 */
function createContentRegion(values, className, label, name) {
  if (values.length === 0) return null;
  return h('div', { class: className, role: 'group', ariaLabel: name }, values.map((value) =>
    h('div', { class: `${className}-item` }, activityContent(value, label))));
}

/** @param {ActivityContent} value @param {string} label @returns {Node|string|null} */
function activityContent(value, label) {
  if (value === null || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object'
    && typeof (/** @type {{nodeType?:unknown}} */ (value)).nodeType === 'number') {
    return /** @type {Node} */ (value);
  }
  if (value instanceof Component) return value.toElement();
  throw new TypeError(`${label} must be text, a Node, a Component, or null`);
}

/** @param {ActivityContent} value @returns {string} */
function textAlternative(value) {
  if (value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (value && typeof value === 'object'
    && typeof (/** @type {{nodeType?:unknown}} */ (value)).nodeType === 'number') {
    return /** @type {Node} */ (value).textContent?.trim() ?? '';
  }
  if (value instanceof Component) return value.toElement().textContent?.trim() ?? '';
  return '';
}

/** @param {ActivityItemOptions} activity @param {string} fallback @returns {string} */
function activityLabel(activity, fallback) {
  return textAlternative(activity.title) || textAlternative(activity.actor) || fallback;
}

/** @param {unknown} value @returns {string|null} */
function serializeActivityId(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/** @param {unknown} value @returns {string} */
function normalizeActivityKind(value) {
  return String(value ?? 'default').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'default';
}

/** @param {unknown} value @returns {'default'|'primary'|'danger'|'ghost'} */
function normalizeActionKind(value) {
  return ['default', 'primary', 'danger'].includes(String(value))
    ? /** @type {'default'|'primary'|'danger'} */ (value) : 'ghost';
}

/** @param {unknown} rel @param {string|undefined} target @returns {string|undefined} */
function safeRel(rel, target) {
  const tokens = String(rel ?? '').split(/\s+/).filter((token) => /^[a-z-]+$/i.test(token));
  if (target === '_blank' && !tokens.includes('noopener')) tokens.push('noopener');
  return tokens.length ? [...new Set(tokens)].join(' ') : undefined;
}

/** @param {unknown} value @returns {1|2|3|4|5|6} */
function normalizeHeadingLevel(value) {
  const level = Math.trunc(Number(value));
  return /** @type {1|2|3|4|5|6} */ (level >= 1 && level <= 6 ? level : 3);
}

/** @param {Date} date @returns {string} */
function formatActivityDate(date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Activity action selected before the host callback or native navigation runs. Cancellation from
 * either the component event or bubbling `zx-action` event prevents both callback and navigation.
 * @event ActivityItem#action
 * @type {CustomEvent<{id:string,action:NormalizedActivityAction,event:MouseEvent}>}
 */
