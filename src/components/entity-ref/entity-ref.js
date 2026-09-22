// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, safeHref, snapshotTarget } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';
import { isElement } from '../../core/util.js';

/** @typedef {string|number|Node|Component|null} EntityRefContent */
/** @typedef {string|Node|Component|(()=>string|Node|Component|null)|null} EntityRefIcon */

/**
 * @typedef {Object} EntityRefLink
 * @property {string} href Native primary-link destination.
 * @property {string} [target] Native browsing context.
 * @property {string} [rel] Native link relationship.
 * @property {boolean|string} [download] Native download hint; a string supplies the filename.
 * @property {(event: MouseEvent, entity: Readonly<EntityRefState>, component: EntityRef) => void} [onclick]
 *   Optional callback after an uncanceled activation; navigation remains native.
 */

/**
 * @typedef {Object} EntityRefMetadata
 * @property {string} label Metadata label.
 * @property {EntityRefContent} value Metadata value.
 * @property {string|null} [icon=null] Optional Zx icon before the value.
 * @property {boolean} [showLabel=true] Whether the label is visible instead of visually hidden.
 */

/**
 * @typedef {Object} EntityRefAction
 * @property {string} id Stable action identifier.
 * @property {string} [label=''] Visible label.
 * @property {string|null} [icon=null] Optional Zx icon.
 * @property {string} [title] Accessible/native title, required when the label is empty.
 * @property {string} [href] Optional safe native link destination; otherwise a button is rendered.
 * @property {string} [target] Native link browsing context.
 * @property {string} [rel] Native link relationship.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='ghost'] Visual intent.
 * @property {boolean} [disabled=false] Whether activation is unavailable.
 * @property {(id: string, action: Readonly<EntityRefAction>, entity: Readonly<EntityRefState>, component: EntityRef) => void} [onselect]
 *   Callback after an uncanceled activation.
 */

/** @typedef {Element|EntityRefAction} EntityRefActionEntry */
/** @typedef {string|EntityRefLink|null} EntityRefLinkValue */

/**
 * @typedef {Object} EntityRefOptions
 * @property {unknown} [id=null] Application-owned entity identifier included in events.
 * @property {string} [title=''] Primary identity text.
 * @property {EntityRefContent} [subtitle=null] Secondary identity text or safe caller-supplied content.
 * @property {EntityRefIcon} [icon=null] Icon name, node, component, or lazy renderer.
 * @property {EntityRefMetadata[]} [metadata=[]] Labelled dense metadata.
 * @property {EntityRefLinkValue} [link=null] Optional native primary link.
 * @property {EntityRefActionEntry[]} [actions=[]] Secondary controls; element actions keep their own behavior.
 * @property {'sm'|'md'|'lg'} [size='md'] Density-independent identity size.
 * @property {boolean} [wrap=false] Whether long identity text may wrap instead of truncating.
 * @property {string} [actionsLabel='Entity actions'] Accessible name for secondary actions.
 * @property {(event: CustomEvent<{id: unknown, entity: Readonly<EntityRefState>, href: string, event: MouseEvent}>) => void} [onactivate]
 *   Preventable primary-link listener.
 * @property {(event: CustomEvent<{id: string, action: Readonly<EntityRefAction>, entity: Readonly<EntityRefState>, event: MouseEvent}>) => void} [onaction]
 *   Preventable delegated-action listener.
 */

/**
 * @typedef {Object} EntityRefState
 * @property {unknown} id Entity identifier.
 * @property {string} title Primary identity.
 * @property {EntityRefContent} subtitle Secondary identity.
 * @property {EntityRefIcon} icon Identity icon.
 * @property {EntityRefMetadata[]} metadata Normalized metadata copies.
 * @property {EntityRefLink|null} link Safe native link.
 * @property {EntityRefActionEntry[]} actions Normalized action copies or elements.
 * @property {'sm'|'md'|'lg'} size Presentation size.
 * @property {boolean} wrap Wrapping state.
 * @property {string} actionsLabel Action-group label.
 */

/**
 * Dense entity identity for tables, feeds, selectors, and detail metadata. It owns presentation and
 * safe native-link/action semantics; routing, permissions, context menus, and persistence remain
 * application-owned.
 * @fires EntityRef#activate
 * @fires EntityRef#action
 * @extends {Component<EntityRefOptions>}
 */
export class EntityRef extends Component {
  static cssName = 'entity-ref';

  /** @type {Readonly<EntityRefOptions>} */
  static defaults = {
    id: null,
    title: '',
    subtitle: null,
    icon: null,
    metadata: [],
    link: null,
    actions: [],
    size: 'md',
    wrap: false,
    actionsLabel: 'Entity actions'
  };

  /**
   * Creates or enhances a dense entity reference.
   * @param {Element|string|null} [target=null] Existing host, selector, or null.
   * @param {EntityRefOptions} [options={}] Entity presentation.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    this._destroyed = false;
    this._state = normalizeEntityRef(this.options);
    this._renderedActions = [];

    root.replaceChildren(
      h('span', { ref: 'icon', class: 'zx-entity-ref__icon', ariaHidden: 'true' }),
      h('div', { class: 'zx-entity-ref__body' },
        h('span', { ref: 'title', class: 'zx-entity-ref__title' }),
        h('span', { ref: 'subtitle', class: 'zx-entity-ref__subtitle' }),
        h('dl', { ref: 'metadata', class: 'zx-entity-ref__metadata' })),
      h('div', {
        ref: 'actions',
        class: 'zx-entity-ref__actions',
        role: 'group'
      })
    );

    this.listen(root, 'click', (event) => this._handleClick(/** @type {MouseEvent} */ (event)));
    this._sync();
    return root;
  }

  /**
   * Updates any subset of the identity without replacing the root.
   * @param {Partial<EntityRefOptions>} values Next values.
   * @returns {this}
   */
  set(values = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) return this;
    this._state = normalizeEntityRef({ ...this._state, ...values });
    this._sync();
    return this;
  }

  /** Replaces the metadata collection. @param {EntityRefMetadata[]} metadata Metadata. @returns {this} */
  setMetadata(metadata) {
    return this.set({ metadata });
  }

  /** Replaces the secondary action controls. @param {EntityRefActionEntry[]} actions Actions. @returns {this} */
  setActions(actions) {
    return this.set({ actions });
  }

  /** Sets or clears the primary link. @param {EntityRefLinkValue} link Link. @returns {this} */
  setLink(link) {
    return this.set({ link });
  }

  /**
   * Returns a defensive presentation snapshot. Caller-supplied Nodes and Components retain their
   * identity; arrays and descriptors are copied.
   * @returns {Readonly<EntityRefState>}
   */
  getEntity() {
    return entitySnapshot(this._state);
  }

  /** Focuses the primary link or the first enabled action. @returns {this} */
  focus() {
    const control = this.refs.title.querySelector('a[href]')
      ?? this.refs.actions.querySelector('a[href], button:not(:disabled)');
    if (control && typeof /** @type {HTMLElement} */ (control).focus === 'function') {
      /** @type {HTMLElement} */ (control).focus();
    }
    return this;
  }

  /** Restores an enhanced target exactly, or removes an owned reference. @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }

  /** @returns {void} */
  _sync() {
    const state = this._state;
    const root = /** @type {HTMLElement} */ (this.el);
    const iconHost = /** @type {HTMLElement} */ (this.refs.icon);
    const titleHost = /** @type {HTMLElement} */ (this.refs.title);
    const subtitleHost = /** @type {HTMLElement} */ (this.refs.subtitle);
    const metadataHost = /** @type {HTMLElement} */ (this.refs.metadata);
    const actionsHost = /** @type {HTMLElement} */ (this.refs.actions);
    root.dataset.size = state.size;
    root.dataset.wrap = String(state.wrap);
    const visual = resolveEntityIcon(state.icon);
    iconHost.replaceChildren(...(visual === null ? [] : [visual]));
    iconHost.hidden = visual === null;

    const title = state.link ? h('a', {
      class: 'zx-entity-ref__primary',
      href: state.link.href,
      target: state.link.target,
      rel: state.link.rel,
      download: state.link.download === true ? '' : state.link.download,
      dataset: { entityPrimary: '' }
    }, state.title) : h('span', { class: 'zx-entity-ref__name' }, state.title);
    titleHost.replaceChildren(title);
    titleHost.hidden = state.title === '';

    replaceContent(subtitleHost, state.subtitle);
    subtitleHost.hidden = emptyContent(state.subtitle);

    metadataHost.replaceChildren(...state.metadata.map((entry) => h('div', {
      class: 'zx-entity-ref__field',
      dataset: { labelVisible: String(entry.showLabel !== false) }
    }, h('dt', { class: 'zx-entity-ref__label' }, entry.label),
    h('dd', { class: 'zx-entity-ref__value' },
      entry.icon ? createIcon(entry.icon, { size: 12 }) : null,
      contentNode(entry.value)))));
    metadataHost.hidden = state.metadata.length === 0;

    this._renderedActions = state.actions;
    actionsHost.setAttribute('aria-label', state.actionsLabel);
    actionsHost.replaceChildren(...state.actions.map((action, index) => isElement(action)
      ? action : renderAction(action, index)));
    actionsHost.hidden = state.actions.length === 0;
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const primary = target.closest('[data-entity-primary]');
    if (primary && this.el.contains(primary) && this._state.link) {
      const detail = {
        id: this._state.id,
        entity: this.getEntity(),
        href: this._state.link.href,
        event
      };
      const selected = this.emit('activate', detail, { honorDomCancellation: true });
      if (selected.defaultPrevented) {
        event.preventDefault();
        return;
      }
      this._state.link.onclick?.(event, this.getEntity(), this);
      return;
    }

    const control = target.closest('[data-entity-action]');
    if (!control || !this.refs.actions.contains(control)) return;
    const action = this._renderedActions[Number(/** @type {HTMLElement} */ (control).dataset.entityAction)];
    if (!action || isElement(action) || action.disabled) return;
    const selected = this.emit('action', {
      id: action.id,
      action: { ...action },
      entity: this.getEntity(),
      event
    }, { honorDomCancellation: true });
    if (selected.defaultPrevented) {
      event.preventDefault();
      return;
    }
    action.onselect?.(action.id, { ...action }, this.getEntity(), this);
  }
}

/**
 * Normalizes an entity-reference contract without touching the DOM.
 * @param {Partial<EntityRefOptions>|null|undefined} values Candidate values.
 * @returns {EntityRefState}
 */
export function normalizeEntityRef(values = {}) {
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const title = String(source.title ?? '');
  const link = normalizeEntityRefLink(source.link);
  if (link && !title.trim()) throw new TypeError('A linked EntityRef requires a non-empty title');
  return {
    id: source.id ?? null,
    title,
    subtitle: normalizeContent(source.subtitle),
    icon: normalizeIcon(source.icon),
    metadata: normalizeEntityRefMetadata(source.metadata),
    link,
    actions: normalizeEntityRefActions(source.actions),
    size: normalizeSize(source.size),
    wrap: Boolean(source.wrap),
    actionsLabel: String(source.actionsLabel || 'Entity actions')
  };
}

/**
 * Normalizes and secures a primary native link.
 * @param {EntityRefLinkValue|unknown} value Candidate link.
 * @returns {EntityRefLink|null}
 */
export function normalizeEntityRefLink(value) {
  if (value == null) return null;
  const descriptor = typeof value === 'string' ? { href: value } : value;
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) return null;
  const href = safeHref(/** @type {EntityRefLink} */ (descriptor).href);
  if (href === null) return null;
  const target = /** @type {EntityRefLink} */ (descriptor).target == null
    ? undefined : String(/** @type {EntityRefLink} */ (descriptor).target);
  const rel = safeRel(/** @type {EntityRefLink} */ (descriptor).rel, target);
  const onclick = /** @type {EntityRefLink} */ (descriptor).onclick;
  if (onclick !== undefined && typeof onclick !== 'function') {
    throw new TypeError('EntityRef link onclick must be a function');
  }
  const rawDownload = /** @type {EntityRefLink} */ (descriptor).download;
  const download = rawDownload === true ? true
    : typeof rawDownload === 'string' ? rawDownload : undefined;
  return {
    href,
    ...(target ? { target } : {}),
    ...(rel ? { rel } : {}),
    ...(download !== undefined ? { download } : {}),
    ...(onclick ? { onclick } : {})
  };
}

/**
 * Normalizes labelled metadata, omitting entries without a label or displayable value.
 * @param {unknown} values Candidate metadata.
 * @returns {EntityRefMetadata[]}
 */
export function normalizeEntityRefMetadata(values) {
  if (!Array.isArray(values)) return [];
  return values.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const descriptor = /** @type {EntityRefMetadata} */ (entry);
    const label = String(descriptor.label ?? '').trim();
    const value = normalizeContent(descriptor.value);
    if (!label || emptyContent(value)) return [];
    return [{
      label,
      value,
      icon: descriptor.icon == null ? null : String(descriptor.icon),
      showLabel: descriptor.showLabel !== false
    }];
  });
}

/**
 * Normalizes delegated actions while preserving caller-supplied Elements.
 * @param {unknown} values Candidate actions.
 * @returns {EntityRefActionEntry[]}
 */
export function normalizeEntityRefActions(values) {
  if (!Array.isArray(values)) return [];
  const ids = new Set();
  /** @type {EntityRefActionEntry[]} */
  const normalized = [];
  for (const entry of values) {
    if (isElement(entry)) {
      normalized.push(entry);
      continue;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const action = /** @type {EntityRefAction} */ (entry);
    const id = String(action.id ?? '').trim();
    const label = String(action.label ?? '');
    const title = String(action.title ?? label).trim();
    if (!id || !title || ids.has(id)) continue;
    if (action.href != null && safeHref(action.href) === null) continue;
    if (action.onselect !== undefined && typeof action.onselect !== 'function') {
      throw new TypeError(`EntityRef action ${id} onselect must be a function`);
    }
    ids.add(id);
    const href = action.href == null ? undefined : /** @type {string} */ (safeHref(action.href));
    const target = action.target == null ? undefined : String(action.target);
    const rel = safeRel(action.rel, target);
    normalized.push({
      ...action,
      id,
      label,
      title,
      icon: action.icon == null ? null : String(action.icon),
      kind: normalizeKind(action.kind),
      disabled: Boolean(action.disabled),
      ...(href ? { href } : {}),
      ...(target ? { target } : {}),
      ...(rel ? { rel } : {})
    });
  }
  return normalized;
}

/** @param {EntityRefAction} action @param {number} index @returns {HTMLElement} */
function renderAction(action, index) {
  const children = [
    action.icon ? createIcon(action.icon, { size: 14 }) : null,
    action.label ? h('span', { class: 'zx-entity-ref__action-label' }, action.label) : null
  ];
  const common = {
    class: 'zx-entity-ref__action',
    title: action.title,
    ariaLabel: action.label || action.title,
    dataset: { entityAction: String(index), kind: action.kind }
  };
  if (action.href && !action.disabled) {
    return h('a', {
      ...common,
      href: action.href,
      target: action.target,
      rel: action.rel
    }, children);
  }
  return h('button', { ...common, type: 'button', disabled: Boolean(action.disabled) }, children);
}

/** @param {EntityRefIcon} value @returns {EntityRefIcon} */
function normalizeIcon(value) {
  if (value == null || typeof value === 'string' || typeof value === 'function') return value ?? null;
  if (isNode(value) || value instanceof Component) return value;
  return null;
}

/** @param {EntityRefIcon} value @returns {Node|string|null} */
function resolveEntityIcon(value) {
  const candidate = typeof value === 'function' ? value() : value;
  if (typeof candidate === 'string') return createIcon(candidate, { size: 18 });
  if (candidate instanceof Component) return candidate.toElement();
  return isNode(candidate) ? candidate : null;
}

/** @param {unknown} value @returns {EntityRefContent} */
function normalizeContent(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (isNode(value) || value instanceof Component) return value;
  return String(value);
}

/** @param {Element} host @param {EntityRefContent} content @returns {void} */
function replaceContent(host, content) {
  host.replaceChildren(contentNode(content));
}

/** @param {EntityRefContent} content @returns {Node|string} */
function contentNode(content) {
  if (content instanceof Component) return content.toElement();
  return isNode(content) ? content : content == null ? '' : String(content);
}

/** @param {unknown} content @returns {boolean} */
function emptyContent(content) {
  return content == null || (!isNode(content) && !(content instanceof Component) && String(content) === '');
}

/** @param {unknown} value @returns {value is Node} */
function isNode(value) {
  return Boolean(value && typeof value === 'object'
    && typeof /** @type {{nodeType?:unknown}} */ (value).nodeType === 'number');
}

/** @param {unknown} value @returns {'sm'|'md'|'lg'} */
function normalizeSize(value) {
  return value === 'sm' || value === 'lg' ? value : 'md';
}

/** @param {unknown} value @returns {'default'|'primary'|'danger'|'ghost'} */
function normalizeKind(value) {
  return value === 'default' || value === 'primary' || value === 'danger' ? value : 'ghost';
}

/** @param {unknown} value @param {string|undefined} target @returns {string|undefined} */
function safeRel(value, target) {
  const tokens = String(value ?? '').split(/\s+/).filter((token) => /^[a-z-]+$/i.test(token));
  if (target === '_blank' && !tokens.includes('noopener')) tokens.push('noopener');
  return tokens.length ? [...new Set(tokens)].join(' ') : undefined;
}

/** @param {EntityRefState} state @returns {Readonly<EntityRefState>} */
function entitySnapshot(state) {
  return Object.freeze({
    ...state,
    metadata: state.metadata.map((entry) => ({ ...entry })),
    link: state.link ? { ...state.link } : null,
    actions: state.actions.map((entry) => isElement(entry) ? entry : { ...entry })
  });
}

/** Fired when the native primary link is activated. @event EntityRef#activate @type {CustomEvent<{id: unknown, entity: Readonly<EntityRefState>, href: string, event: MouseEvent}>} */
/** Fired when a delegated secondary action is activated. @event EntityRef#action @type {CustomEvent<{id: string, action: Readonly<EntityRefAction>, entity: Readonly<EntityRefState>, event: MouseEvent}>} */
