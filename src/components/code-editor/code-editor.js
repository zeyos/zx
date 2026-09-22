import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';

/**
 * @typedef {Object} CodeEditorOptions
 * @property {unknown} [value=''] Initial text.
 * @property {string} [name=''] Form field name.
 * @property {string} [language='text'] Language identifier shown to the user and exposed as data.
 * @property {string} [label='Code editor'] Accessible editor label.
 * @property {string} [placeholder=''] Placeholder text.
 * @property {number} [rows=12] Visible textarea rows.
 * @property {string} [indent='\t'] Text inserted by Tab and removed by Shift+Tab.
 * @property {'off'|'soft'|'hard'} [wrap='off'] Textarea wrapping behavior.
 * @property {boolean} [spellcheck=false] Whether browser spellcheck is enabled.
 * @property {boolean} [readOnly=false] Whether content can be selected but not changed.
 * @property {boolean} [disabled=false] Whether the editor is disabled.
 * @property {boolean} [status=true] Whether the line/column status is visible.
 * @property {(event: CustomEvent<{value:string}>) => void} [oninput] Input listener.
 * @property {(event: CustomEvent<{value:string}>) => void} [onchange] Change listener.
 */

/**
 * Dependency-free source editor for structured text, Markdown, JSON and code. It deliberately uses
 * a native textarea: values remain text-safe, browser undo and IME behavior stay intact, and Tab /
 * Shift+Tab provide predictable indentation without a third-party editor runtime.
 * @fires CodeEditor#input
 * @fires CodeEditor#change
 * @extends {Component<CodeEditorOptions>}
 */
export class CodeEditor extends Component {
  static cssName = 'code-editor';

  /** @type {CodeEditorOptions} */
  static defaults = {
    value: '',
    name: '',
    language: 'text',
    label: 'Code editor',
    placeholder: '',
    rows: 12,
    indent: '\t',
    wrap: 'off',
    spellcheck: false,
    readOnly: false,
    disabled: false,
    status: true
  };

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._initialChildren = this._createdRoot ? [] : [...root.childNodes];
    this._initialAttributes = new Map(['data-language', 'data-readonly', 'data-disabled']
      .map((name) => [name, root.getAttribute(name)]));
    this._language = normalizeLanguage(this.options.language);
    this._languageLabel = h('span', { class: 'zx-code-editor__language' }, this._language);
    this._position = h('span', {
      class: 'zx-code-editor__position',
      role: 'status',
      ariaLive: 'polite'
    });
    this._header = h('div', { class: 'zx-code-editor__header' }, this._languageLabel,
      this.options.status ? this._position : null);
    this._input = /** @type {HTMLTextAreaElement} */ (h('textarea', {
      class: 'zx-code-editor__input',
      name: this.options.name ? String(this.options.name) : undefined,
      ariaLabel: String(this.options.label ?? 'Code editor'),
      placeholder: String(this.options.placeholder ?? ''),
      rows: normalizeRows(this.options.rows),
      wrap: normalizeWrap(this.options.wrap),
      spellcheck: Boolean(this.options.spellcheck),
      readOnly: Boolean(this.options.readOnly),
      disabled: Boolean(this.options.disabled),
      autocomplete: 'off',
      autocapitalize: 'off'
    }));
    this._input.value = String(this.options.value ?? '');
    root.dataset.language = this._language;
    root.dataset.readonly = String(Boolean(this.options.readOnly));
    root.dataset.disabled = String(Boolean(this.options.disabled));
    root.replaceChildren(this._header, this._input);

    this.listen(this._input, 'keydown', (event) => this._handleKeydown(event));
    this.listen(this._input, 'input', () => {
      this._updatePosition();
      this.emit('input', { value: this.getValue() });
    });
    this.listen(this._input, 'change', () => this.emit('change', { value: this.getValue() }));
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

  /** @returns {this} */
  focus() { this._input.focus(); return this; }

  /** @returns {this} */
  enable() { this._input.disabled = false; this.el.dataset.disabled = 'false'; return this; }

  /** @returns {this} */
  disable() { this._input.disabled = true; this.el.dataset.disabled = 'true'; return this; }

  /** @param {boolean} value Read-only state. @returns {this} */
  setReadOnly(value) {
    this._input.readOnly = Boolean(value);
    this.el.dataset.readonly = String(Boolean(value));
    return this;
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _handleKeydown(event) {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey ||
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
    this._input.value = result.value;
    this._input.setSelectionRange(result.start, result.end);
    this._updatePosition();
    this.emit('input', { value: this.getValue() });
  }

  /** @returns {void} */
  _updatePosition() {
    if (!this.options.status) return;
    const position = editorPosition(this._input.value, this._input.selectionStart ?? 0,
      this._input.selectionEnd ?? 0);
    this._position.textContent = position.lines > 1
      ? `Ln ${position.line}, Col ${position.column} · ${position.lines} lines selected`
      : `Ln ${position.line}, Col ${position.column}`;
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
