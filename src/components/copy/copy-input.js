import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { uid } from '../../core/util.js';
import { copyButton } from './copy-button.js';

/**
 * @typedef {Object} CopyInputOptions
 * @property {string} [value=''] Text shown and copied.
 * @property {string} [label=''] Visible label above the box.
 * @property {boolean} [hideLabel=false] Whether the label is kept for assistive technology only.
 * @property {string} [feedback='Copied'] Confirmation shown after a copy.
 * @property {string} [buttonTitle='Copy'] Accessible name of the copy button.
 * @property {'md'|'sm'} [size='md'] Control size.
 * @property {(event: CustomEvent<{value: string, copied: boolean}>) => void} [oncopy] Copy listener.
 */

/**
 * A read-only box holding a value to be copied — an API endpoint, a document number, a share link
 * — with the copy button attached.
 *
 * The field is `readonly` rather than `disabled` so the text stays selectable and reachable by
 * keyboard; focusing it selects the whole value, which is what someone reaching for Ctrl+C
 * expects.
 *
 * @fires CopyInput#copy
 * @extends {Component<CopyInputOptions>}
 */
export class CopyInput extends Component {
  static cssName = 'copy-input';

  /** @type {CopyInputOptions} */
  static defaults = {
    value: '',
    label: '',
    hideLabel: false,
    feedback: 'Copied',
    buttonTitle: 'Copy',
    size: 'md'
  };

  /** @returns {HTMLElement} */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    const id = uid('zx-copy-input');

    const input = /** @type {HTMLInputElement} */ (h('input', {
      ref: 'input',
      class: 'zx-copy-input__field',
      type: 'text',
      id,
      readOnly: true,
      value: String(this.options.value ?? '')
    }));
    const button = copyButton({
      text: () => this.get(),
      title: String(this.options.buttonTitle),
      feedback: String(this.options.feedback),
      size: this.options.size === 'sm' ? 'sm' : 'md',
      oncopy: (value, copied) => this.emit('copy', { value, copied })
    });

    root.replaceChildren(
      h('label', { ref: 'label', class: 'zx-copy-input__label', for: id },
        String(this.options.label ?? '')),
      h('div', { class: 'zx-copy-input__box' }, input, button)
    );
    root.dataset.size = this.options.size === 'sm' ? 'sm' : 'md';
    root.toggleAttribute('data-hide-label', Boolean(this.options.hideLabel));

    this.listen(input, 'focus', () => input.select());
    return root;
  }

  /**
   * Returns the current value.
   * @returns {string}
   */
  get() {
    return this.refs.input.value;
  }

  /**
   * Replaces the value.
   * @param {string} value Text to show and copy.
   * @returns {this}
   */
  set(value) {
    this.refs.input.value = String(value ?? '');
    return this;
  }

  /**
   * Focuses the box and selects its contents.
   *
   * The selection is made here as well as in the `focus` listener: the listener covers a click or
   * a Tab, but a programmatic `focus()` fires no focus event when the document itself is not
   * focused, and the value would then be left uncopied under the caret.
   * @returns {this}
   */
  focus() {
    this.refs.input.focus();
    this.refs.input.select();
    return this;
  }

  /** Restores an enhanced target to the markup it had before the takeover. @returns {void} */
  destroy() {
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }
}

/**
 * Fired after a copy attempt; `copied` is false when the clipboard refused the write.
 * @event CopyInput#copy
 * @type {CustomEvent<{value: string, copied: boolean}>}
 */
