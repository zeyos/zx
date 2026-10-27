import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';
import { APP_ICON_TONES, appIcon } from '../app-icon/app-icon.js';
import { avatarInitials, avatarTone } from '../avatar/avatar.js';
import { MenuButton } from '../menu-button/menu-button.js';

/** @typedef {import('../menu-button/menu-button.js').MenuButtonItem} MenuButtonItem */
/** @typedef {import('../app-icon/app-icon.js').AppIconTone} AppIconTone */
/**
 * One workspace, account, or organisation the user can switch to.
 * @typedef {Object} WorkspaceItem
 * @property {string|number} id Stable identifier; the `active` option and `setActive()` name it.
 * @property {string} label Workspace name.
 * @property {string} [secondary] Secondary line: plan, role, domain.
 * @property {string|Node} [icon] Icon name or node drawn on the tile instead of the initial. A node
 *   is cloned for each place the tile appears.
 * @property {AppIconTone} [tone] Tile colour from the theme's categorical palette. Without `tone`
 *   or `color` the tone is derived from the label, so a workspace keeps its colour everywhere.
 * @property {string} [color] Tile colour, any CSS colour; takes precedence over `tone`.
 * @property {string|null} [src] Image drawn as the tile instead of the initial or icon.
 * @property {string} [initials] Explicit tile initials; derived from the label when omitted.
 * @property {string|number} [badge] Compact trailing metadata in the menu, such as an unread count.
 * @property {boolean} [disabled=false] Whether the workspace is listed but cannot be chosen.
 */
/**
 * @typedef {Object} WorkspaceSwitcherSelectDetail
 * @property {WorkspaceItem} workspace The workspace being switched to.
 * @property {string|number} id Its id.
 * @property {WorkspaceItem|null} previous The workspace active until now.
 */
/**
 * @typedef {Object} WorkspaceSwitcherOptions
 * @property {WorkspaceItem[]} [workspaces=[]] Workspaces in menu order. Entries without an id are
 *   skipped, and a repeated id keeps its first entry.
 * @property {string|number|null} [active=null] Active workspace id. Defaults to the first enabled
 *   workspace, which also stands in for an id that is not listed or is disabled.
 * @property {MenuButtonItem[]} [items=[]] Extra actions listed after the workspaces — "Create
 *   workspace", "Workspace settings", `'-'` separators, "Sign out". A separator is inserted
 *   between the workspaces and the actions automatically.
 * @property {boolean} [compact=false] Whether the trigger shows the tile alone.
 * @property {string|null} [heading=null] Group label above the workspaces; null resolves message
 *   `workspaceSwitcher.heading` ("Workspaces"), and an empty string leaves the label out.
 * @property {string|null} [label=null] Trigger accessible name, in which `%1` is the active
 *   workspace's name and is filled in again after every switch. Null resolves message
 *   `workspaceSwitcher.label` ("Switch workspace: %1"), or `workspaceSwitcher.labelEmpty`
 *   ("Switch workspace") while no workspace is active.
 * @property {'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'|'right-start'|'right-end'|'left-start'|'left-end'|'right'|'left'} [placement='bottom-start'] Popup placement.
 * @property {(event: CustomEvent<WorkspaceSwitcherSelectDetail>) => void} [onselect] Preventable
 *   workspace switch; `preventDefault()` keeps the previous workspace active and the menu open.
 * @property {(event: CustomEvent<{value: unknown, item: object}>) => void} [onaction] Preventable
 *   extra action; `preventDefault()` skips the item's own callback and keeps the menu open.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close listener.
 * @property {Record<string, unknown>} [msg] Component-local message overrides, by key:
 *   `workspaceSwitcher.heading` ("Workspaces"), `workspaceSwitcher.label` ("Switch workspace: %1",
 *   `%1` the active workspace's name), and `workspaceSwitcher.labelEmpty` ("Switch workspace",
 *   the trigger's name while no workspace is active).
 */

/**
 * Workspace switcher for the head of an application's navigation: a trigger with the current
 * workspace's tile, name, and secondary line, opening an APG menu of the workspaces — the current
 * one checked — followed by the application's own actions. Which workspaces a user may see, and
 * what switching means, stay application-owned.
 * @fires WorkspaceSwitcher#select
 * @fires WorkspaceSwitcher#action
 * @fires WorkspaceSwitcher#open
 * @fires WorkspaceSwitcher#close
 * @extends {Component<WorkspaceSwitcherOptions>}
 */
export class WorkspaceSwitcher extends Component {
  static cssName = 'workspace-switcher';

  /** @type {Readonly<WorkspaceSwitcherOptions>} */
  static defaults = {
    workspaces: [],
    active: null,
    items: [],
    compact: false,
    heading: null,
    label: null,
    placement: 'bottom-start'
  };

  /**
   * Creates or enhances a workspace-switcher host.
   * @param {Element|string|null} target Host target.
   * @param {WorkspaceSwitcherOptions} [options={}] Workspace-switcher options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
    // MenuButton's own events bubble from the trigger; this component re-emits them once.
    for (const type of ['select', 'open', 'close']) {
      this.listen(this.refs.trigger, `zx-${type}`, (event) => event.stopPropagation());
    }
    this._menu = new MenuButton(this.refs.trigger, { items: [], placement: this.options.placement });
    this._menu.getPanel().classList.add('zx-workspace-switcher__menu');
    this._menu.on('select', (event) => this._onMenuSelect(event));
    this._menu.on('open', () => this.emit('open'));
    this._menu.on('close', () => this.emit('close'));
    this._sync();
  }

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    this._workspaces = normalizeWorkspaces(this.options.workspaces);
    this._activeId = resolveActive(this._workspaces, this.options.active);
    this._items = Array.isArray(this.options.items) ? this.options.items.slice() : [];
    /** @type {Map<object, WorkspaceItem>} Menu entries that stand for a workspace. */
    this._entries = new Map();
    root.dataset.compact = String(Boolean(this.options.compact));
    root.replaceChildren(h('button', {
      ref: 'trigger',
      class: 'zx-workspace-switcher__trigger',
      type: 'button'
    },
    h('span', { ref: 'tile', class: 'zx-workspace-switcher__tile', ariaHidden: 'true' }),
    h('span', { class: 'zx-workspace-switcher__text' },
      h('span', { ref: 'name', class: 'zx-workspace-switcher__name' }),
      h('span', { ref: 'secondary', class: 'zx-workspace-switcher__secondary' })),
    h('span', { class: 'zx-workspace-switcher__chevron', ariaHidden: 'true' }, icon('chevron-down'))));
    return root;
  }

  /** Returns the active workspace, or null when no workspace is enabled. @returns {WorkspaceItem|null} */
  getActive() {
    return findWorkspace(this._workspaces, this._activeId);
  }

  /**
   * Makes another workspace active. An unknown or disabled id changes nothing.
   * @param {string|number} id Workspace id.
   * @param {{silent?: boolean}} [options={}] `silent: false` emits the preventable `select` first;
   *   by default the change is silent, as a change the application made itself.
   * @returns {this}
   * @fires WorkspaceSwitcher#select
   */
  setActive(id, { silent = true } = {}) {
    const workspace = findWorkspace(this._workspaces, id);
    if (!workspace || workspace.disabled || sameId(workspace.id, this._activeId)) return this;
    if (!silent && this._emitSelect(workspace).defaultPrevented) return this;
    this._activeId = workspace.id;
    this._sync();
    return this;
  }

  /**
   * Replaces the workspaces. The active workspace stays active while it is still listed and
   * enabled; otherwise the first enabled workspace becomes active, silently.
   * @param {WorkspaceItem[]} workspaces Workspaces in menu order.
   * @returns {this}
   */
  setWorkspaces(workspaces) {
    this._workspaces = normalizeWorkspaces(workspaces);
    this._activeId = resolveActive(this._workspaces, this._activeId);
    this._sync();
    return this;
  }

  /** Replaces the extra actions after the workspaces. @param {MenuButtonItem[]} items @returns {this} */
  setItems(items) {
    this._items = Array.isArray(items) ? items.slice() : [];
    this._renderMenu();
    return this;
  }

  /**
   * Shows the tile alone, or the tile with the name, secondary line, and chevron — for a navigation
   * column that narrows to icons and widens again. The trigger keeps its full accessible name and
   * gains the workspace name as a tooltip while compact.
   * @param {boolean} compact
   * @returns {this}
   */
  setCompact(compact) {
    this.el.dataset.compact = String(Boolean(compact));
    this._renderTrigger();
    return this;
  }

  /** Opens the menu. @returns {this} */
  open() {
    this._menu.open();
    return this;
  }

  /** Closes the menu. @returns {this} */
  close() {
    this._menu.close();
    return this;
  }

  /** Toggles the menu. @returns {this} */
  toggle() {
    if (this._menu.isOpen()) this._menu.close();
    else this._menu.open();
    return this;
  }

  /** Reports whether the menu is open. @returns {boolean} */
  isOpen() {
    return this._menu.isOpen();
  }

  /** Focuses the trigger. @returns {this} */
  focus() {
    this._menu.getTrigger().focus();
    return this;
  }

  /** Returns the menu panel for shell hover and focus coordination. @returns {HTMLElement} */
  getPanel() {
    return this._menu.getPanel();
  }

  /** Destroys the menu and restores or removes the host. @returns {void} */
  destroy() {
    const root = this.el;
    const snapshot = this._snapshot;
    this._menu?.destroy();
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, snapshot);
  }

  /** @returns {void} */
  _sync() {
    this._renderTrigger();
    this._renderMenu();
  }

  /** @returns {void} */
  _renderTrigger() {
    const workspace = this.getActive();
    const name = workspace?.label ?? '';
    this.refs.tile.replaceChildren(...(workspace ? [workspaceTile(workspace)] : []));
    this.refs.tile.hidden = !workspace;
    this.refs.name.textContent = name;
    this.refs.secondary.textContent = workspace?.secondary ?? '';
    this.refs.secondary.hidden = !workspace?.secondary;
    const label = this.options.label ? formatWorkspaceLabel(this.options.label, name) : (name
      ? this._message('workspaceSwitcher.label', 'Switch workspace: %1', name)
      : this._message('workspaceSwitcher.labelEmpty', 'Switch workspace'));
    this.refs.trigger.setAttribute('aria-label', label);
    if (this.el.dataset.compact === 'true' && name) this.refs.trigger.setAttribute('title', name);
    else this.refs.trigger.removeAttribute('title');
  }

  /** @returns {void} */
  _renderMenu() {
    this._entries = new Map();
    /** @type {MenuButtonItem[]} */
    const entries = [];
    const heading = this.options.heading == null
      ? this._message('workspaceSwitcher.heading', 'Workspaces')
      : String(this.options.heading);
    if (heading && this._workspaces.length) entries.push({ type: 'heading', label: heading });
    const rows = [];
    for (const workspace of this._workspaces) {
      const entry = {
        label: workspace.label,
        value: workspace.id,
        role: /** @type {const} */ ('menuitemradio'),
        checked: sameId(workspace.id, this._activeId),
        description: workspace.secondary || undefined,
        badge: workspace.badge ?? undefined,
        disabled: workspace.disabled,
        adornment: h('span', { class: 'zx-workspace-switcher__check', ariaHidden: 'true' }, icon('check'))
      };
      this._entries.set(entry, workspace);
      rows.push([entries.length, workspace]);
      entries.push(entry);
    }
    if (this._workspaces.length && this._items.length && !isSeparator(this._items[0])) entries.push('-');
    entries.push(...this._items);
    this._menu.setItems(entries);
    // The shared menu row draws a radio circle; a workspace row leads with its tile instead.
    const panel = this._menu.getPanel();
    for (const [index, workspace] of rows) {
      const row = panel.querySelector(`[data-menu-item="${index}"]`);
      if (!row) continue;
      row.classList.add('zx-workspace-switcher__option');
      row.querySelector('.zx-menu-button__leading')?.replaceChildren(workspaceTile(workspace));
    }
  }

  /** @param {CustomEvent<{value: unknown, item: object}>} event @returns {void} */
  _onMenuSelect(event) {
    const workspace = this._entries.get(event.detail.item);
    if (!workspace) {
      const action = this.emit('action', event.detail, { honorDomCancellation: true });
      if (action.defaultPrevented) event.preventDefault();
      return;
    }
    // Choosing the current workspace again only closes the menu.
    if (sameId(workspace.id, this._activeId)) return;
    if (this._emitSelect(workspace).defaultPrevented) {
      event.preventDefault();
      return;
    }
    // MenuButton has already returned focus to the trigger and closes the menu after this.
    this._activeId = workspace.id;
    this._sync();
  }

  /** @param {WorkspaceItem} workspace @returns {CustomEvent<WorkspaceSwitcherSelectDetail>} */
  _emitSelect(workspace) {
    return /** @type {CustomEvent<WorkspaceSwitcherSelectDetail>} */ (/** @type {unknown} */ (this.emit('select', {
      workspace,
      id: workspace.id,
      previous: this.getActive()
    }, { honorDomCancellation: true })));
  }

  /**
   * Resolves a message, falling back to English when no translation is registered.
   * @param {string} key Message key.
   * @param {string} fallback English fallback with `%1` placeholders.
   * @param {...unknown} args Interpolation values.
   * @returns {string}
   */
  _message(key, fallback, ...args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
  }
}

/**
 * Normalises one workspace definition: a string id or label, a tone the palette knows, a colour
 * only when no tone was asked for, and initials derived from the label when none were given.
 * @param {unknown} value Candidate workspace.
 * @returns {(WorkspaceItem & {label: string, secondary: string, initials: string, disabled: boolean, tone: AppIconTone|null, color: string|null, src: string|null}) | null}
 *   The workspace, or null when it has no usable id.
 */
export function normalizeWorkspace(value) {
  if (!value || typeof value !== 'object') return null;
  const source = /** @type {Record<string, any>} */ (value);
  const id = source.id;
  if ((typeof id !== 'string' || id === '') && (typeof id !== 'number' || !Number.isFinite(id))) return null;
  const label = String(source.label ?? id).trim() || String(id);
  const color = typeof source.color === 'string' && source.color.trim() ? source.color.trim() : null;
  const tone = APP_ICON_TONES.includes(source.tone) ? source.tone : (color ? null : avatarTone(label));
  const src = typeof source.src === 'string' && source.src.trim() ? source.src.trim() : null;
  const badge = source.badge == null || source.badge === '' ? undefined : source.badge;
  return {
    ...source,
    id,
    label,
    secondary: source.secondary == null ? '' : String(source.secondary),
    tone,
    color,
    src,
    badge,
    initials: workspaceInitials(label, source.initials),
    disabled: Boolean(source.disabled)
  };
}

/**
 * Normalises a workspace list, skipping entries without an id and repeats of an id already listed.
 * @param {unknown} list Candidate workspaces.
 * @returns {WorkspaceItem[]}
 */
export function normalizeWorkspaces(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const value of list) {
    const workspace = normalizeWorkspace(value);
    if (!workspace || seen.has(String(workspace.id))) continue;
    seen.add(String(workspace.id));
    result.push(workspace);
  }
  return result;
}

/**
 * Resolves the active workspace id: the requested one when it is listed and enabled, otherwise the
 * first enabled workspace, otherwise null. Ids compare as strings, so `3` finds `'3'`.
 * @param {WorkspaceItem[]} workspaces Normalised workspaces.
 * @param {string|number|null|undefined} active Requested id.
 * @returns {string|number|null}
 */
export function resolveActive(workspaces, active) {
  const requested = active == null ? null : findWorkspace(workspaces, active);
  if (requested && !requested.disabled) return requested.id;
  return (workspaces.find((workspace) => !workspace.disabled) ?? null)?.id ?? null;
}

/**
 * The tile initials for a workspace: explicit initials trimmed to two characters, otherwise the
 * first letter of the label, uppercased.
 * @param {unknown} label Workspace name.
 * @param {unknown} [initials] Explicit initials.
 * @returns {string}
 */
export function workspaceInitials(label, initials) {
  const explicit = typeof initials === 'string' ? initials.trim() : '';
  if (explicit) return Array.from(explicit).slice(0, 2).join('');
  return avatarInitials(label, 1);
}

/**
 * Fills a custom trigger label: `%1` becomes the active workspace's name (empty while none is
 * active), so the label follows every switch.
 * @param {unknown} template Label, with an optional `%1`.
 * @param {unknown} name Active workspace name.
 * @returns {string}
 */
export function formatWorkspaceLabel(template, name) {
  return printf(String(template), [name == null ? '' : String(name)]);
}

/** @param {WorkspaceItem[]} workspaces @param {unknown} id @returns {WorkspaceItem|null} */
function findWorkspace(workspaces, id) {
  if (id == null) return null;
  return workspaces.find((workspace) => sameId(workspace.id, id)) ?? null;
}

/** @param {unknown} a @param {unknown} b @returns {boolean} */
function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

/** @param {unknown} entry @returns {boolean} */
function isSeparator(entry) {
  return entry === '-' || Boolean(entry && typeof entry === 'object'
    && /** @type {{type?: unknown}} */ (entry).type === 'separator');
}

/**
 * The workspace's identity tile: its image, or its icon or initial on its tone.
 * @param {WorkspaceItem} workspace Normalised workspace.
 * @returns {HTMLElement}
 */
function workspaceTile(workspace) {
  if (workspace.src) {
    return h('span', { class: 'zx-workspace-switcher__image' },
      h('img', { src: workspace.src, alt: '', decoding: 'async' }));
  }
  const glyph = workspace.icon && typeof workspace.icon === 'object' && 'nodeType' in workspace.icon
    ? /** @type {Node} */ (workspace.icon).cloneNode(true)
    : typeof workspace.icon === 'string' && workspace.icon
      ? workspace.icon
      : h('span', { class: 'zx-workspace-switcher__initials' }, workspace.initials ?? '');
  return appIcon({
    icon: glyph,
    tone: workspace.tone ?? null,
    color: workspace.color ?? null,
    size: 'var(--zx-workspace-switcher-tile)',
    iconSize: typeof glyph === 'string' ? '58%' : '50%',
    glass: 'subtle'
  });
}

/** Fired before the active workspace changes; preventable. @event WorkspaceSwitcher#select @type {CustomEvent<WorkspaceSwitcherSelectDetail>} */
/** Fired when an extra action is chosen; preventable. @event WorkspaceSwitcher#action @type {CustomEvent<{value: unknown, item: object}>} */
/** Fired after the menu opens. @event WorkspaceSwitcher#open @type {CustomEvent<Record<string, never>>} */
/** Fired after the menu closes. @event WorkspaceSwitcher#close @type {CustomEvent<Record<string, never>>} */
