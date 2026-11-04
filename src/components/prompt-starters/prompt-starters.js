// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { ICON_SIZE, icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';

/**
 * One conversation starter.
 * @typedef {Object} PromptStarter
 * @property {string|number} id Stable identifier.
 * @property {string} title What the starter is called: its visible title and accessible name.
 * @property {string} text The prompt it stands for, handed back in `pick`. Shown beneath the title
 * when there is no `description`.
 * @property {string} [description] What is shown beneath the title in place of `text`.
 * @property {string} [icon] Icon name drawn before the title.
 */

/**
 * @typedef {Object} PromptStartersOptions
 * @property {PromptStarter[]} [items=[]] The starters. An entry without `id`, `title` or `text` is
 * left out, as is a repeated id; any other field on an item is handed back in `pick`.
 * @property {string|null} [label=null] Accessible name of the group. Omitted resolves
 * `promptStarters.label`, English `Suggestions`.
 * @property {'auto'|1|2} [columns='auto'] Columns of starters. `'auto'` is two, and one in a
 * container narrower than 32rem.
 * @property {1|2|3|4|5|6|null} [headingLevel=null] Shows `label` above the starters as a heading of
 * this level, which then names the group. Null keeps the label for assistive technology only.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{item: PromptStarter}>) => void} [onpick] Listener for a starter
 * being picked.
 */

const MESSAGES = Object.freeze({
  'promptStarters.label': 'Suggestions'
});

/**
 * Starting points for an empty conversation: a labelled group of buttons, each with a title and a
 * muted line beneath it. A pick is only reported. Whether it fills the composer or sends at once
 * is the application's decision, and PromptStarters never sends anything itself.
 *
 * @fires PromptStarters#pick
 * @extends {Component<PromptStartersOptions>}
 */
export class PromptStarters extends Component {
  static cssName = 'prompt-starters';

  /** @type {Readonly<PromptStartersOptions>} */
  static defaults = {
    items: [],
    label: null,
    columns: 'auto',
    headingLevel: null,
    msg: MESSAGES
  };

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._original = created ? null : snapshotTarget(root);
    if (!created) root.replaceChildren();
    this._destroyed = false;
    /** @type {PromptStarter[]} */
    this._items = [];

    const options = this.options;
    const label = String(options.label ?? this.msg('promptStarters.label'));
    const level = headingLevel(options.headingLevel);
    root.setAttribute('role', 'group');
    root.dataset.columns = columnsOf(options.columns);
    this._list = h('div', { class: 'zx-prompt-starters__list' });
    if (level) {
      const id = uid('zx-prompt-starters-heading');
      root.setAttribute('aria-labelledby', id);
      root.append(h(`h${level}`, { class: 'zx-prompt-starters__heading', id }, label));
    } else {
      root.setAttribute('aria-label', label);
    }
    root.append(this._list);

    this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));
    this._build(options.items);
    return root;
  }

  /**
   * Replaces the starters. The focus on a starter stays on the starter with the same `id`. Emits
   * nothing.
   * @param {PromptStarter[]} items
   * @returns {this}
   */
  setItems(items) {
    if (!this._destroyed) this._build(items);
    return this;
  }

  /** Removes what was drawn and stops listening. @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    super.destroy();
    if (this._original) restoreTarget(this.el, this._original);
  }

  /**
   * @private
   * @param {unknown} items
   * @returns {void}
   */
  _build(items) {
    const list = /** @type {HTMLElement} */ (this._list);
    const active = list.ownerDocument.activeElement;
    const focused = active && list.contains(active)
      ? /** @type {HTMLElement|null} */ (active.closest('[data-starter]'))?.dataset.starter ?? null
      : null;
    this._items = normalizeStarters(items);
    list.replaceChildren(...this._items.map((item) => this._button(item)));
    /** @type {HTMLElement} */ (this.el).hidden = this._items.length === 0;
    if (focused === null) return;
    const buttons = /** @type {HTMLElement[]} */ (Array.from(list.children));
    buttons.find((button) => button.dataset.starter === focused)?.focus();
  }

  /**
   * A starter's button: named by its title, described by the line beneath it.
   * @private
   * @param {PromptStarter} item
   * @returns {HTMLElement}
   */
  _button(item) {
    const id = uid('zx-prompt-starter');
    return h('button', {
      type: 'button',
      class: 'zx-prompt-starters__item',
      dataset: { starter: String(item.id) },
      'aria-labelledby': `${id}-title`,
      'aria-describedby': `${id}-text`
    },
    item.icon ? icon(item.icon, { size: ICON_SIZE.control }) : null,
    h('span', { class: 'zx-prompt-starters__copy' },
      h('span', { class: 'zx-prompt-starters__title', id: `${id}-title` }, item.title),
      h('span', { class: 'zx-prompt-starters__text', id: `${id}-text` }, item.description || item.text)));
  }

  /**
   * @private
   * @param {MouseEvent} event
   * @returns {void}
   * @fires PromptStarters#pick
   */
  _onClick(event) {
    const button = /** @type {HTMLElement|null} */ (/** @type {Element|null} */ (event.target)?.closest?.('[data-starter]'));
    if (!button) return;
    const item = this._items.find((entry) => String(entry.id) === button.dataset.starter);
    if (item) this.emit('pick', { item: { ...item } });
  }
}

/**
 * The starters as they are drawn: an entry without an `id`, a `title` or a `text` that says
 * something is left out, a repeated id keeps its first entry, and `title`, `text` and `description`
 * become strings. `text` keeps its spaces and line breaks, for a prompt that ends where the person
 * goes on writing. Any other field the application put on an item is kept.
 * @param {unknown} items
 * @returns {PromptStarter[]}
 */
function normalizeStarters(items) {
  /** @type {PromptStarter[]} */
  const list = [];
  const seen = new Set();
  for (const entry of Array.isArray(items) ? items : []) {
    if (!entry || typeof entry !== 'object') continue;
    const { description, ...item } = /** @type {Partial<PromptStarter>} */ (entry);
    const key = item.id == null ? '' : String(item.id);
    const title = String(item.title ?? '').trim();
    const text = String(item.text ?? '');
    if (!key || !title || !text.trim() || seen.has(key)) continue;
    seen.add(key);
    const note = String(description ?? '').trim();
    list.push({ ...item, id: /** @type {string|number} */ (item.id), title, text, ...(note ? { description: note } : {}) });
  }
  return list;
}

/**
 * The columns an option names; anything but `1` or `2` is `'auto'`.
 * @param {unknown} value
 * @returns {string}
 */
function columnsOf(value) {
  return value === 1 || value === 2 ? String(value) : 'auto';
}

/**
 * The heading level an option names, or null for none.
 * @param {unknown} value
 * @returns {number|null}
 */
function headingLevel(value) {
  const level = Number(value);
  return value != null && Number.isInteger(level) && level >= 1 && level <= 6 ? level : null;
}

/** Fired when a starter is picked. Nothing is sent: the application decides what a pick does. @event PromptStarters#pick @type {CustomEvent<{item: PromptStarter}>} */
