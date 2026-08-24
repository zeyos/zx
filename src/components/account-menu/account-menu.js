import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { Avatar } from '../avatar/avatar.js';
import { MenuButton } from '../menu-button/menu-button.js';

/** @typedef {import('../menu-button/menu-button.js').MenuButtonItem} MenuButtonItem */
/**
 * @typedef {Object} AccountIdentity
 * @property {string} [name=''] Primary identity.
 * @property {string} [secondary=''] Email, company, or other secondary identity.
 * @property {string|null} [src=null] Avatar image URL.
 * @property {string|null} [initials=null] Explicit avatar initials.
 * @property {'online'|'away'|'busy'|'offline'|null} [status=null] Presence state.
 * @property {string|null} [statusLabel=null] Presence text alternative.
 */
/**
 * @typedef {Object} AccountMenuOptions
 * @property {AccountIdentity} [account={}] Account presentation supplied by the application.
 * @property {MenuButtonItem[]} [items=[]] Account actions and `'-'` separators.
 * @property {boolean} [compact=false] Whether only the avatar is visually shown in the trigger.
 * @property {string|null} [label=null] Trigger label; defaults to `Account menu for <name>`.
 * @property {'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'|'right-start'|'right-end'|'left-start'|'left-end'|'right'|'left'} [placement='top-start'] Popup placement.
 * @property {(event: CustomEvent<{value: unknown, item: object}>) => void} [onselect] Preventable action listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close listener.
 */

/**
 * Avatar-backed APG account action menu; session/authentication behavior remains application-owned.
 * @fires AccountMenu#select
 * @fires AccountMenu#open
 * @fires AccountMenu#close
 * @extends {Component<AccountMenuOptions>}
 */
export class AccountMenu extends Component {
  static cssName = 'account-menu';

  /** @type {Readonly<AccountMenuOptions>} */
  static defaults = {
    account: {},
    items: [],
    compact: false,
    label: null,
    placement: 'top-start'
  };

  /**
   * Creates or enhances an account-menu host.
   * @param {Element|string|null} target Host target.
   * @param {AccountMenuOptions} [options={}] Account-menu options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
    for (const type of ['select', 'open', 'close']) {
      this.listen(this.refs.trigger, `zx-${type}`, (event) => event.stopPropagation());
    }
    this._avatar = new Avatar(this.refs.avatar, avatarOptions(this._account));
    this._menu = new MenuButton(this.refs.trigger, {
      items: this.options.items,
      placement: this.options.placement
    });
    this._menu.on('select', (event) => {
      const selected = this.emit('select', event.detail);
      if (selected.defaultPrevented) event.preventDefault();
    });
    this._menu.on('open', () => this.emit('open'));
    this._menu.on('close', () => this.emit('close'));
    this._renderIdentity();
  }

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._original = this._createdRoot ? null : {
      attributes: Array.from(root.attributes, (attribute) => [attribute.name, attribute.value]),
      children: Array.from(root.childNodes)
    };
    this._account = normalizeAccount(this.options.account);
    root.dataset.compact = String(Boolean(this.options.compact));
    root.replaceChildren(h('button', {
      ref: 'trigger',
      class: 'zx-account-menu__trigger',
      type: 'button'
    },
    h('span', { ref: 'avatar', class: 'zx-account-menu__avatar' }),
    h('span', { class: 'zx-account-menu__identity' },
      h('span', { ref: 'name', class: 'zx-account-menu__name' }),
      h('span', { ref: 'secondary', class: 'zx-account-menu__secondary' })),
    h('span', { class: 'zx-account-menu__chevron', ariaHidden: 'true' }, icon('chevron-down'))));
    return root;
  }

  /** Opens the account menu. @returns {this} */
  open() {
    this._menu.open();
    return this;
  }

  /** Closes the account menu. @returns {this} */
  close() {
    this._menu.close();
    return this;
  }

  /** Toggles the account menu. @returns {this} */
  toggle() {
    this._menu.toggle();
    return this;
  }

  /** Reports whether the menu is open. @returns {boolean} */
  isOpen() {
    return this._menu.isOpen();
  }

  /** Replaces account presentation without touching session state. @param {AccountIdentity} account @returns {this} */
  setAccount(account) {
    this._account = normalizeAccount(account);
    this._avatar.set(avatarOptions(this._account));
    this._renderIdentity();
    return this;
  }

  /** Replaces account actions. @param {MenuButtonItem[]} items @returns {this} */
  setItems(items) {
    this._menu.setItems(items);
    this._renderPanelHeader();
    return this;
  }

  /** Focuses the account trigger. @returns {this} */
  focus() {
    this._menu.getTrigger().focus();
    return this;
  }

  /** Returns the underlying menu panel for shell hover/focus coordination. @returns {HTMLElement} */
  getPanel() {
    return this._menu.getPanel();
  }

  /** Destroys child components and restores/removes the host. @returns {void} */
  destroy() {
    const original = this._original;
    this._menu.destroy();
    this._avatar.destroy();
    super.destroy();
    if (!this._createdRoot && original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...original.children);
    }
  }

  /** @returns {void} */
  _renderIdentity() {
    this.refs.name.textContent = this._account.name;
    this.refs.secondary.textContent = this._account.secondary;
    this.refs.secondary.hidden = !this._account.secondary;
    const hasStatus = ['online', 'away', 'busy', 'offline'].includes(this._account.status);
    const status = hasStatus && this._account.statusLabel ? `, ${this._account.statusLabel}` : '';
    const label = this.options.label || `Account menu${this._account.name ? ` for ${this._account.name}` : ''}${status}`;
    this.refs.trigger.setAttribute('aria-label', label);
    this._renderPanelHeader();
  }

  /** @returns {void} */
  _renderPanelHeader() {
    const panel = this._menu.getPanel();
    panel.querySelector('.zx-account-menu__panel-identity')?.remove();
    panel.prepend(h('div', {
      class: 'zx-account-menu__panel-identity',
      role: 'presentation'
    },
    h('strong', {}, this._account.name || 'Account'),
    this._account.secondary ? h('span', {}, this._account.secondary) : null));
  }
}

/** @param {unknown} value @returns {AccountIdentity & {name: string, secondary: string}} */
function normalizeAccount(value) {
  const account = value && typeof value === 'object' ? value : {};
  return {
    ...account,
    name: String(account.name ?? ''),
    secondary: String(account.secondary ?? '')
  };
}

/** @param {AccountIdentity} account @returns {import('../avatar/avatar.js').AvatarOptions} */
function avatarOptions(account) {
  return {
    name: account.name,
    src: account.src ?? null,
    initials: account.initials ?? null,
    status: account.status ?? null,
    statusLabel: account.statusLabel ?? null,
    label: null,
    size: 'md'
  };
}

/** Fired when an action is activated. @event AccountMenu#select @type {CustomEvent<{value: unknown, item: object}>} */
/** Fired after the popup opens. @event AccountMenu#open @type {CustomEvent<Record<string, never>>} */
/** Fired after the popup closes. @event AccountMenu#close @type {CustomEvent<Record<string, never>>} */
