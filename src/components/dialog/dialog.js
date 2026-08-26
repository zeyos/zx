import { h } from '../../core/dom.js';
import { uid } from '../../core/util.js';
import { Modal } from '../modal/modal.js';

const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])'
].join(',');

/** @typedef {'default'|'primary'|'danger'|'ghost'} DialogButtonKind */
/**
 * @typedef {Object} DialogButton
 * @property {string} label Button label.
 * @property {DialogButtonKind} [kind='default'] Visual button kind.
 * @property {'close'|'cancel'|((dialog: Dialog) => void)} [action='close'] Button action.
 * @property {boolean} [autofocus=false] Whether this button receives initial focus.
 */
/**
 * @typedef {Object} DialogOptions
 * @property {string} [title=''] Dialog title.
 * @property {'sm'|'md'|'lg'|number} [size='md'] Preset or pixel width.
 * @property {DialogButton[]} [buttons=[]] Footer buttons.
 * @property {boolean} [closable=true] Whether Escape and the header button may close the dialog.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [content=null] Body content.
 * @property {Element|string|null} [scope=null] Element whose nearest Zx theme scope owns the overlay; defaults to the opener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open event listener.
 * @property {(event: CustomEvent<{result: unknown}>) => void} [onclose] Close event listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [oncancel] Cancel event listener.
 */
/**
 * @typedef {Object} DialogViewOptions
 * @property {Node|string|number|{toElement: () => Node|null}|null} content View content.
 * @property {DialogButton[]} [buttons] View-specific footer buttons.
 * @property {string} [title] View-specific title.
 */
/**
 * @typedef {Object} DialogView
 * @property {string} key View key.
 * @property {HTMLElement} content View content container.
 * @property {DialogButton[]|null} buttons View-specific buttons, or null to use dialog buttons.
 * @property {string|null} title View-specific title, or null to use the dialog title.
 */
/**
 * @typedef {Object} AlertOptions
 * @property {string} [title=''] Alert title.
 * @property {Node|string|number|null} [message=''] Alert message.
 * @property {string} [okLabel='OK'] Confirmation label.
 */
/**
 * @typedef {Object} ConfirmOptions
 * @property {string} [title=''] Confirmation title.
 * @property {Node|string|number|null} [message=''] Confirmation message.
 * @property {string} [okLabel='OK'] Confirmation label.
 * @property {string} [cancelLabel='Cancel'] Cancellation label.
 * @property {boolean} [danger=false] Whether the confirmation action is dangerous.
 */
/**
 * @typedef {Object} PromptOptions
 * @property {string} [title=''] Prompt title.
 * @property {Node|string|number|null} [message=''] Prompt message.
 * @property {string} [value=''] Initial input value.
 * @property {string} [placeholder=''] Input placeholder.
 */

/**
 * Structured modal with a title, body, footer actions, and switchable views.
 * @fires Modal#open
 * @fires Modal#close
 * @fires Modal#cancel
 */
export class Dialog extends Modal {
  static cssName = 'dialog';

  /** @type {Readonly<DialogOptions>} */
  static defaults = {
    title: '',
    size: 'md',
    buttons: [],
    closable: true
  };

  /** @type {Map<string, DialogView>} */
  #views = new Map();
  /** @type {DialogView|null} */
  #currentView = null;
  /** @type {DialogButton[]} */
  #baseButtons = [];
  #baseTitle = '';
  /** @type {Element|null} */
  #opener = null;

  /**
   * Creates a structured dialog in the configured theme scope, or at document level when unscoped.
   * @param {Element|string|null} [_target=null] Ignored; Dialog always owns its root.
   * @param {DialogOptions} [options={}] Dialog options.
   */
  constructor(_target = null, options = {}) {
    super(null, options);
    this._applySize(this.options.size);
    this.#baseTitle = String(this.options.title ?? '');
    this.#applyTitle(this.#baseTitle);
    this.#baseButtons = copyButtons(this.options.buttons);
    this.#renderButtons(this.#baseButtons);
    this.refs.close.hidden = !this.options.closable;

    this.listen(this.refs.close, 'click', () => this.close());
    this.listen(this.refs.footer, 'click', (event) => {
      const button = event.target.closest?.('[data-dialog-button]');
      if (!button || !this.refs.footer.contains(button)) return;
      const definition = this.#renderedButtons[Number(button.dataset.dialogButton)];
      if (!definition) return;
      this.#runButton(definition);
    });
    this.on('close', () => this.#restoreFocus());
  }

  /** @type {DialogButton[]} */
  #renderedButtons = [];

  /**
   * Creates the structured native dialog.
   * @returns {HTMLDialogElement}
   */
  render() {
    const titleId = uid('zx-dialog-title');
    const dialog = /** @type {HTMLDialogElement} */ (h('dialog', {
      class: 'zx-modal zx-dialog',
      ariaLabelledby: titleId
    },
      h('header', { class: 'zx-dialog__header' },
        h('h2', { class: 'zx-dialog__title', id: titleId, ref: 'title' }),
        h('button', {
          class: 'zx-btn zx-dialog__close',
          ref: 'close',
          type: 'button',
          'data-kind': 'ghost',
          ariaLabel: 'Close',
          title: 'Close'
        }, '×')
      ),
      h('div', { class: 'zx-modal__content zx-dialog__body', ref: 'content' }),
      h('footer', { class: 'zx-dialog__footer', ref: 'footer' })
    ));
    dialog.dataset.state = 'closed';
    this.mountTarget().append(dialog);
    return dialog;
  }

  /**
   * Opens the dialog and focuses its autofocus control or first focusable descendant.
   * @returns {this}
   */
  open() {
    if (this.isOpen()) return this;
    this.#opener = document.activeElement instanceof Element ? document.activeElement : null;
    super.open();
    queueMicrotask(() => {
      if (!this.isOpen()) return;
      const autofocus = this.el.querySelector('[autofocus]:not([disabled])');
      const first = autofocus ?? this.el.querySelector(FOCUSABLE_SELECTOR);
      if (first instanceof HTMLElement) first.focus();
    });
    return this;
  }

  /**
   * Sets the title shown in the dialog header.
   * @param {string} title Title text.
   * @returns {this}
   */
  setTitle(title) {
    this.#baseTitle = String(title ?? '');
    this.#applyTitle(this.#baseTitle);
    return this;
  }

  /**
   * Replaces the body content and clears any registered views.
   * @param {Node|string|number|{toElement: () => Node|null}|null} content Body content.
   * @returns {this}
   */
  setContent(content) {
    this.#views.clear();
    this.#currentView = null;
    replaceContent(this.refs.content, content);
    return this;
  }

  /**
   * Replaces the default footer buttons.
   * @param {DialogButton[]} list Button definitions.
   * @returns {this}
   */
  setButtons(list) {
    this.#baseButtons = copyButtons(list);
    this.#renderButtons(this.#baseButtons);
    return this;
  }

  /**
   * Adds or replaces a named dialog view. The first view is shown immediately.
   * @param {string} key View key.
   * @param {DialogViewOptions} options View options.
   * @returns {DialogView}
   */
  addView(key, options) {
    const normalizedKey = String(key);
    const existing = this.#views.get(normalizedKey);
    existing?.content.remove();
    const content = h('section', {
      class: 'zx-dialog__view',
      hidden: true,
      ariaHidden: 'true'
    });
    appendContent(content, options?.content ?? null);
    const view = {
      key: normalizedKey,
      content,
      buttons: options && Object.hasOwn(options, 'buttons') ? copyButtons(options.buttons ?? []) : null,
      title: options && Object.hasOwn(options, 'title') ? String(options.title ?? '') : null
    };
    this.#views.set(normalizedKey, view);
    if (this.#views.size === 1 || this.#currentView?.key === normalizedKey) this.showView(normalizedKey);
    else this.refs.content.append(content);
    return view;
  }

  /**
   * Shows one registered view and applies its title and buttons.
   * @param {string} key View key.
   * @returns {DialogView}
   */
  showView(key) {
    const view = this.#views.get(String(key));
    if (!view) throw new RangeError(`Unknown dialog view: ${key}`);
    if (!this.#currentView) this.refs.content.replaceChildren();
    for (const candidate of this.#views.values()) {
      if (!candidate.content.isConnected) this.refs.content.append(candidate.content);
      const visible = candidate === view;
      candidate.content.hidden = !visible;
      candidate.content.setAttribute('aria-hidden', String(!visible));
    }
    this.#currentView = view;
    this.#applyTitle(view.title ?? this.#baseTitle);
    this.#renderButtons(view.buttons ?? this.#baseButtons);
    return view;
  }

  /**
   * Returns a registered view.
   * @param {string} key View key.
   * @returns {DialogView|null}
   */
  getView(key) {
    return this.#views.get(String(key)) ?? null;
  }

  /**
   * Opens an alert and resolves after it is dismissed.
   * @param {AlertOptions} [options={}] Alert options.
   * @returns {Promise<void>}
   */
  static alert({ title = '', message = '', okLabel = 'OK' } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        dialog.close();
        resolve();
      };
      const dialog = new Dialog(null, {
        title,
        content: message,
        buttons: [{ label: okLabel, kind: 'primary', action: finish, autofocus: true }]
      });
      dialog.once('close', () => {
        if (!settled) {
          settled = true;
          resolve();
        }
        dialog.destroy();
      });
      dialog.open();
    });
  }

  /**
   * Opens a confirmation dialog.
   * @param {ConfirmOptions} [options={}] Confirmation options.
   * @returns {Promise<boolean>}
   */
  static confirm({
    title = '', message = '', okLabel = 'OK', cancelLabel = 'Cancel', danger = false
  } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        dialog.close(value);
        resolve(value);
      };
      const dialog = new Dialog(null, {
        title,
        content: message,
        buttons: [
          { label: cancelLabel, action: () => finish(false) },
          { label: okLabel, kind: danger ? 'danger' : 'primary', action: () => finish(true), autofocus: true }
        ]
      });
      dialog.once('close', () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
        dialog.destroy();
      });
      dialog.open();
    });
  }

  /**
   * Opens a single-line text prompt.
   * @param {PromptOptions} [options={}] Prompt options.
   * @returns {Promise<string|null>}
   */
  static prompt({ title = '', message = '', value = '', placeholder = '' } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const input = h('input', {
        class: 'zx-dialog__prompt-input',
        value: String(value),
        placeholder: String(placeholder),
        autofocus: true,
        ariaLabel: String(title || 'Prompt value')
      });
      const content = h('div', { class: 'zx-dialog__prompt' },
        h('div', { class: 'zx-dialog__prompt-message' }, message),
        input
      );
      const finish = (result) => {
        if (settled) return;
        settled = true;
        dialog.close(result);
        resolve(result);
      };
      const dialog = new Dialog(null, {
        title,
        content,
        buttons: [
          { label: 'Cancel', action: () => finish(null) },
          { label: 'OK', kind: 'primary', action: () => finish(input.value) }
        ]
      });
      dialog.listen(input, 'keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        finish(input.value);
      });
      dialog.once('close', () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
        dialog.destroy();
      });
      dialog.open();
    });
  }

  /**
   * Applies the dialog width. Subclasses that size themselves on a different axis override this.
   *
   * Called from the constructor before any subclass field initializers have run, so an override
   * may only touch the DOM — reading an uninitialized private field here throws.
   * @param {'sm'|'md'|'lg'|number} size Preset or pixel width.
   * @returns {void}
   */
  _applySize(size) {
    const presets = { sm: 400, md: 600, lg: 840 };
    const width = typeof size === 'number' && Number.isFinite(size) ? size : (presets[size] ?? presets.md);
    this.el.style.inlineSize = `${Math.max(0, width)}px`;
  }

  /** @param {string} title @returns {void} */
  #applyTitle(title) {
    this.refs.title.textContent = title;
  }

  /** @param {DialogButton[]} list @returns {void} */
  #renderButtons(list) {
    this.#renderedButtons = copyButtons(list);
    this.refs.footer.replaceChildren();
    this.refs.footer.hidden = this.#renderedButtons.length === 0;
    this.#renderedButtons.forEach((definition, index) => {
      this.refs.footer.append(h('button', {
        class: 'zx-btn',
        type: 'button',
        'data-kind': definition.kind ?? 'default',
        'data-size': 'md',
        'data-dialog-button': String(index),
        autofocus: Boolean(definition.autofocus)
      }, h('span', { class: 'zx-btn__label' }, definition.label)));
    });
  }

  /** @param {DialogButton} definition @returns {void} */
  #runButton(definition) {
    const action = definition.action ?? 'close';
    if (action === 'close') {
      this.close();
    } else if (action === 'cancel') {
      const event = this.emit('cancel');
      if (!event.defaultPrevented) this.close();
    } else if (typeof action === 'function') {
      action(this);
    }
  }

  /** @returns {void} */
  #restoreFocus() {
    if (this.#opener?.isConnected && typeof this.#opener.focus === 'function') this.#opener.focus();
    this.#opener = null;
  }
}

/** @param {DialogButton[]|null|undefined} list @returns {DialogButton[]} */
function copyButtons(list) {
  return Array.isArray(list) ? list.map((button) => ({ ...button, label: String(button.label ?? '') })) : [];
}

/**
 * @param {Element} target
 * @param {Node|string|number|{toElement: () => Node|null}|null|undefined} content
 * @returns {void}
 */
function replaceContent(target, content) {
  target.replaceChildren();
  appendContent(target, content);
}

/**
 * @param {Element} target
 * @param {Node|string|number|{toElement: () => Node|null}|null|undefined} content
 * @returns {void}
 */
function appendContent(target, content) {
  if (content == null) return;
  if (typeof content === 'string' || typeof content === 'number') {
    target.append(document.createTextNode(String(content)));
  } else if (typeof content.toElement === 'function') {
    const element = content.toElement();
    if (element) target.append(element);
  } else if (typeof content.nodeType === 'number') {
    target.append(content);
  }
}
