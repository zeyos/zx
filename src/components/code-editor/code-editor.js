import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { uid } from '../../core/util.js';

/**
 * @typedef {Object} CodeEditorOptions
 * @property {unknown} [value=''] Initial text.
 * @property {string} [name=''] Form field name.
 * @property {string} [language='text'] Language identifier shown to the user and exposed as data.
 * @property {string|null} [label=null] Accessible editor label; null reads the `codeEditor.label`
 *   message ("Code editor").
 * @property {string} [placeholder=''] Placeholder text.
 * @property {number} [rows=12] Visible textarea rows.
 * @property {string} [indent='\t'] Text inserted by Tab and removed by Shift+Tab — a tab by
 *   default, `'  '` for two spaces. While it is non-empty the editor captures Tab: Tab inserts it at
 *   the caret or indents every selected line, Shift+Tab outdents them, and focus stays in the
 *   editor. Escape releases the capture for the next keystroke, so Escape then Tab (or Shift+Tab)
 *   moves focus on. `indent: ''` switches the capture off: Tab and Shift+Tab move focus as in any
 *   other field and nothing is indented. Tab with Ctrl, Alt or Meta, and Tab in a read-only or
 *   disabled editor, are never captured.
 * @property {'off'|'soft'|'hard'} [wrap='off'] Textarea wrapping behavior.
 * @property {boolean} [spellcheck=false] Whether browser spellcheck is enabled.
 * @property {boolean} [readOnly=false] Whether content can be selected but not changed.
 * @property {boolean} [readonly=false] The same setting under the spelling every other Zx control
 *   uses. The editor starts read-only when either `readOnly` or `readonly` is true, so neither
 *   spelling can switch off what the other one turned on.
 * @property {boolean} [disabled=false] Whether the editor is disabled.
 * @property {boolean} [status=true] Whether the line/column status is visible.
 * @property {(event: CustomEvent<{value:string}>) => void} [oninput] Input listener.
 * @property {(event: CustomEvent<{value:string}>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<{message:string}>) => void} [oninvalid] Listener called when
 *   `setHighlight()` puts the editor in its error state.
 */

/** Keys that only modify the next one: pressing them is not the keystroke that ends a Tab release. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn', 'OS']);

/**
 * Dependency-free source editor for structured text, Markdown, JSON and code. It deliberately uses
 * a native textarea: values remain text-safe, browser undo and IME behavior stay intact, and Tab /
 * Shift+Tab provide predictable indentation without a third-party editor runtime.
 *
 * Capturing Tab is what a code surface has to do, and it would be a keyboard trap if nothing undid
 * it: Escape releases the capture until the next keystroke in the editor, so Escape then Tab (or
 * Shift+Tab) moves focus out of the editor as it would leave any other field.
 *
 * A standalone editor reports a validation or status message the way a Field does, with
 * `setHighlight()` and `clearHighlight()`. Inside a Field (the `code` field type) the Field's own
 * message is the one to set; it marks the editor's textarea invalid and the frame follows.
 * @fires CodeEditor#input
 * @fires CodeEditor#change
 * @fires CodeEditor#invalid
 * @extends {Component<CodeEditorOptions>}
 */
export class CodeEditor extends Component {
  static cssName = 'code-editor';

  /** @type {CodeEditorOptions} */
  static defaults = {
    value: '',
    name: '',
    language: 'text',
    label: null,
    placeholder: '',
    rows: 12,
    indent: '\t',
    wrap: 'off',
    spellcheck: false,
    readOnly: false,
    readonly: false,
    disabled: false,
    status: true
  };

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._initialChildren = this._createdRoot ? [] : [...root.childNodes];
    this._initialAttributes = new Map(['data-language', 'data-readonly', 'data-disabled', 'data-state']
      .map((name) => [name, root.getAttribute(name)]));
    this._language = normalizeLanguage(this.options.language);
    // Either spelling turns read-only on; see the `readonly` option.
    const readOnly = Boolean(this.options.readOnly || this.options.readonly);
    this._languageLabel = h('span', { class: 'zx-code-editor__language' }, this._language);
    // A visible readout, not a live region: announced on every caret move it would talk over
    // each keystroke.
    this._position = h('span', { class: 'zx-code-editor__position' });
    this._header = h('div', { class: 'zx-code-editor__header' }, this._languageLabel,
      this.options.status ? this._position : null);
    this._input = /** @type {HTMLTextAreaElement} */ (h('textarea', {
      class: 'zx-code-editor__input',
      name: this.options.name ? String(this.options.name) : undefined,
      ariaLabel: String(this.options.label ?? this.msg('codeEditor.label')),
      placeholder: String(this.options.placeholder ?? ''),
      rows: normalizeRows(this.options.rows),
      wrap: normalizeWrap(this.options.wrap),
      spellcheck: Boolean(this.options.spellcheck),
      readOnly,
      disabled: Boolean(this.options.disabled),
      autocomplete: 'off',
      autocapitalize: 'off'
    }));
    this._highlight = h('div', {
      class: 'zx-code-editor__highlight',
      id: uid('zx-code-editor-highlight'),
      ariaLive: 'polite',
      hidden: true
    });
    this._input.value = String(this.options.value ?? '');
    this._committedValue = this._input.value;
    this._indentEditing = false;
    root.dataset.language = this._language;
    root.dataset.readonly = String(readOnly);
    root.dataset.disabled = String(Boolean(this.options.disabled));
    root.replaceChildren(this._header, this._input, this._highlight);
    /** Set by Escape: the next Tab moves focus instead of indenting. */
    this._tabReleased = false;

    this.listen(this._input, 'keydown', (event) => this._handleKeydown(event));
    this.listen(this._input, 'blur', () => {
      this._tabReleased = false;
      this._commitValue();
    });
    this.listen(this._input, 'input', () => {
      if (this._indentEditing) return;
      this._updatePosition();
      this.emit('input', { value: this.getValue() });
    });
    this.listen(this._input, 'change', () => this._commitValue());
    for (const type of ['click', 'keyup', 'select', 'focus']) {
      this.listen(this._input, type, () => this._updatePosition());
    }
    this._updatePosition();
    return root;
  }

  /** @returns {string} */
  getValue() { return this._input.value; }

  /**
   * Replaces the editor text.
   * @param {unknown} value New value.
   * @param {{silent?:boolean}} [options={}] Suppress the `change` event.
   * @returns {this}
   */
  setValue(value, { silent = false } = {}) {
    const next = String(value ?? '');
    if (this._input.value === next) return this;
    this._input.value = next;
    this._committedValue = next;
    this._updatePosition();
    if (!silent) this.emit('change', { value: next });
    return this;
  }

  /** @param {unknown} language New language identifier. @returns {this} */
  setLanguage(language) {
    this._language = normalizeLanguage(language);
    this.el.dataset.language = this._language;
    this._languageLabel.textContent = this._language;
    return this;
  }

  /**
   * Returns the native textarea — the element that carries the editor's name, validity and
   * description, and the one a `<label for>` or a Field labels.
   * @returns {HTMLTextAreaElement}
   */
  getInput() { return this._input; }

  /**
   * Displays a validation or status message under the text, as `Field#setHighlight()` does for a
   * field: the kind is reflected as `data-state` on the root, and `'danger'` is the error state —
   * the textarea gets `aria-invalid="true"`, the message is announced as an alert, the frame takes
   * the danger colour, and `invalid` is emitted. The message is the textarea's description
   * (`aria-describedby`) for as long as it is shown. An empty message clears it.
   * @param {string} message Message text.
   * @param {'danger'|'warning'|'success'} [kind='danger'] Message kind.
   * @returns {this}
   * @fires CodeEditor#invalid
   */
  setHighlight(message, kind = 'danger') {
    if (!message) return this.clearHighlight();
    const normalizedKind = ['danger', 'warning', 'success'].includes(kind) ? kind : 'danger';
    this.el.dataset.state = normalizedKind;
    this._highlight.textContent = String(message);
    this._highlight.hidden = false;
    this._describe(true);
    if (normalizedKind === 'danger') {
      this._highlight.setAttribute('role', 'alert');
      this._input.setAttribute('aria-invalid', 'true');
      this.emit('invalid', { message: String(message) });
    } else {
      this._highlight.removeAttribute('role');
      this._input.removeAttribute('aria-invalid');
    }
    return this;
  }

  /**
   * Clears the current validation or status message.
   * @returns {this}
   */
  clearHighlight() {
    delete this.el.dataset.state;
    this._highlight.textContent = '';
    this._highlight.hidden = true;
    this._highlight.removeAttribute('role');
    this._input.removeAttribute('aria-invalid');
    this._describe(false);
    return this;
  }

  /** @returns {this} */
  focus() { this._input.focus(); return this; }

  /** @returns {this} */
  enable() { this._input.disabled = false; this.el.dataset.disabled = 'false'; return this; }

  /** @returns {this} */
  disable() { this._input.disabled = true; this.el.dataset.disabled = 'true'; return this; }

  /**
   * Makes the text selectable but not editable, or editable again; reflected as `data-readonly` on
   * the root.
   * @param {boolean} value Read-only state.
   * @returns {this}
   */
  setReadOnly(value) {
    this._input.readOnly = Boolean(value);
    this.el.dataset.readonly = String(Boolean(value));
    return this;
  }

  /**
   * `setReadOnly()` under the spelling every other Zx control uses (`Field#setReadonly()`,
   * `NumberField#setReadonly()`, `TagPicker#setReadonly()`); the two are interchangeable.
   * @param {boolean} value Read-only state.
   * @returns {this}
   */
  setReadonly(value) {
    return this.setReadOnly(value);
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _handleKeydown(event) {
    if (event.isComposing || MODIFIER_KEYS.has(event.key)) return;
    if (event.key === 'Escape') {
      this._tabReleased = true;
      return;
    }
    // Any other keystroke ends the release, the Tab it was for included.
    const released = this._tabReleased;
    this._tabReleased = false;
    if (released || event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey ||
        this._input.readOnly || this._input.disabled) return;
    const indent = String(this.options.indent ?? '\t');
    if (!indent) return;
    event.preventDefault();
    const result = indentSelection(
      this._input.value,
      this._input.selectionStart ?? 0,
      this._input.selectionEnd ?? 0,
      indent,
      event.shiftKey
    );
    if (result.value === this._input.value) return;
    // Native editing commands retain the textarea's undo history; assigning value or using
    // setRangeText does not. Replace only the changed range so surrounding edits stay intact.
    const previous = this._input.value;
    let from = 0;
    while (from < previous.length && previous[from] === result.value[from]) from += 1;
    let tail = 0;
    while (tail < previous.length - from && tail < result.value.length - from
      && previous[previous.length - tail - 1] === result.value[result.value.length - tail - 1]) tail += 1;
    this._input.setSelectionRange(from, previous.length - tail);
    this._indentEditing = true;
    try {
      const document = this._input.ownerDocument;
      const replacement = result.value.slice(from, result.value.length - tail);
      document?.execCommand?.(replacement ? 'insertText' : 'delete', false, replacement);
    } catch {
      // An unavailable editing command falls through to the same plain-text fallback.
    } finally {
      this._indentEditing = false;
    }
    // Browsers without the editing command still indent and commit, but cannot add that change
    // to native history. Keep this fallback separate from the supported native editing path.
    if (this._input.value !== result.value) this._input.value = result.value;
    this._input.setSelectionRange(result.start, result.end);
    this._updatePosition();
    this.emit('input', { value: this.getValue() });
  }

  /**
   * Adds the message to, or takes it out of, the textarea's `aria-describedby`, leaving any id
   * something else put there (a Field's description) in place.
   * @param {boolean} described Whether the message describes the textarea.
   * @returns {void}
   */
  _describe(described) {
    const id = this._highlight.id;
    const ids = (this._input.getAttribute('aria-describedby') ?? '').split(/\s+/)
      .filter((value) => value && value !== id);
    if (described) ids.push(id);
    if (ids.length) this._input.setAttribute('aria-describedby', ids.join(' '));
    else this._input.removeAttribute('aria-describedby');
  }

  /** Commits once, whether the browser emits change before blur or the fallback edited text. @returns {void} */
  _commitValue() {
    const value = this.getValue();
    if (value === this._committedValue) return;
    this._committedValue = value;
    this.emit('change', { value });
  }

  /** @returns {void} */
  _updatePosition() {
    if (!this.options.status) return;
    const position = editorPosition(this._input.value, this._input.selectionStart ?? 0,
      this._input.selectionEnd ?? 0);
    this._position.textContent = position.lines > 1
      ? this.msgPlural('codeEditor.selection', position.lines, position.line, position.column, position.lines)
      : this.msg('codeEditor.position', position.line, position.column);
  }

  /** @returns {void} */
  destroy() {
    if (!this._createdRoot) {
      this.el.replaceChildren(...this._initialChildren);
      for (const [name, value] of this._initialAttributes) {
        if (value === null) this.el.removeAttribute(name);
        else this.el.setAttribute(name, value);
      }
    }
    super.destroy();
  }
}

/**
 * Applies Tab or Shift+Tab to a textarea selection.
 * @param {string} value Complete source value.
 * @param {number} start Selection start.
 * @param {number} end Selection end.
 * @param {string} indent Indentation text.
 * @param {boolean} outdent Whether to remove indentation.
 * @returns {{value:string,start:number,end:number}}
 */
export function indentSelection(value, start, end, indent = '\t', outdent = false) {
  const source = String(value ?? '');
  const unit = String(indent ?? '');
  const from = clampIndex(start, source.length);
  const to = clampIndex(end, source.length);
  if (!unit) return { value: source, start: from, end: to };

  if (from === to && !outdent) {
    return {
      value: source.slice(0, from) + unit + source.slice(to),
      start: from + unit.length,
      end: from + unit.length
    };
  }

  const lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
  let lineEnd = source.indexOf('\n', to);
  if (lineEnd < 0) lineEnd = source.length;
  const block = source.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  let removedFirst = 0;
  let delta = 0;
  const transformed = lines.map((line, index) => {
    if (!outdent) {
      delta += unit.length;
      return unit + line;
    }
    const removed = removableIndent(line, unit);
    if (index === 0) removedFirst = removed;
    delta -= removed;
    return line.slice(removed);
  }).join('\n');
  const nextStart = outdent
    ? Math.max(lineStart, from - Math.min(removedFirst, from - lineStart))
    : from + unit.length;
  return {
    value: source.slice(0, lineStart) + transformed + source.slice(lineEnd),
    start: nextStart,
    end: Math.max(nextStart, to + delta)
  };
}

/** @param {string} value @param {number} start @param {number} end @returns {{line:number,column:number,lines:number}} */
export function editorPosition(value, start, end = start) {
  const source = String(value ?? '');
  const from = clampIndex(start, source.length);
  const to = clampIndex(end, source.length);
  const before = source.slice(0, from);
  return {
    line: before.split('\n').length,
    column: from - before.lastIndexOf('\n'),
    lines: source.slice(from, to).split('\n').length
  };
}

/** @param {string} line @param {string} indent @returns {number} */
function removableIndent(line, indent) {
  if (line.startsWith(indent)) return indent.length;
  if (indent === '\t') return line.startsWith('\t') ? 1 : Math.min(/^ +/.exec(line)?.[0].length ?? 0, 2);
  return Math.min(/^\s+/.exec(line)?.[0].length ?? 0, indent.length);
}

/** @param {unknown} value @returns {string} */
function normalizeLanguage(value) {
  const language = String(value ?? 'text').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9+_.-]*$/.test(language) ? language : 'text';
}

/** @param {unknown} value @returns {number} */
function normalizeRows(value) {
  const rows = Number(value);
  return Number.isFinite(rows) ? Math.max(2, Math.min(100, Math.round(rows))) : 12;
}

/** @param {unknown} value @returns {'off'|'soft'|'hard'} */
function normalizeWrap(value) {
  return ['off', 'soft', 'hard'].includes(String(value)) ? /** @type {'off'|'soft'|'hard'} */ (value) : 'off';
}

/** @param {unknown} value @param {number} length @returns {number} */
function clampIndex(value, length) {
  const number = Number(value);
  return Math.max(0, Math.min(length, Number.isFinite(number) ? Math.round(number) : 0));
}

/**
 * Code editor input event.
 * @event CodeEditor#input
 * @type {CustomEvent<{value:string}>}
 */

/**
 * Code editor committed change event.
 * @event CodeEditor#change
 * @type {CustomEvent<{value:string}>}
 */

/**
 * Emitted when `setHighlight()` puts the editor in its error state (`kind: 'danger'`).
 * @event CodeEditor#invalid
 * @type {CustomEvent<{message:string}>}
 */
