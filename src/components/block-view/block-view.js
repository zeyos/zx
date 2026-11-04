// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { translate } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';
import { blocksToMarkdown, blocksToText, figureRow, parseInline } from '../../internal/agent-model.js';
import { highlight } from '../../internal/highlight.js';
import { copyButton } from '../copy/copy-button.js';

/** @typedef {import('../../internal/agent-model.js').Block} Block */
/** @typedef {import('../../internal/agent-model.js').Source} Source */

/**
 * @typedef {Object} BlockViewOptions
 * @property {Block[]} [blocks=[]] The answer's blocks. Model text is data: every string reaches
 * the page as text, through the inline grammar of `**bold**`, `` `code` `` and `[n]` citations.
 * @property {2|3|4|5} [headingLevel=3] Element level of a `heading` block of level 2; a level-3
 * heading goes one deeper. Set it one below the heading that names the answer.
 * @property {'sm'|'md'} [size='sm'] Prose size: `'sm'` sets the answer at the interface size, for
 * a conversation; `'md'` at the reading size, for a document.
 * @property {boolean} [streaming=false] Whether more is still being written. The last block stays
 * open to `appendText()`, and the root is busy until `end()` or `stop()`.
 * @property {Source[]|null} [sources=null] The sources citations point at; their titles name the
 * citation buttons.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{n: number, source: Source|null}>) => void} [oncite] Citation listener.
 * @property {(event: CustomEvent<{id: string}>) => void} [onartifact] Artifact listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onend] End-of-stream listener.
 */

/**
 * Options for drawing blocks without a component.
 * @typedef {Object} RenderBlocksOptions
 * @property {2|3|4|5} [headingLevel=3] Element level of a level-2 `heading` block.
 * @property {(key: string, ...args: unknown[]) => string} [msg] Message lookup for the few words
 * the blocks add (code copy, artifact kinds).
 */

const MESSAGES = Object.freeze({
  'blockView.cite': 'Source %1',
  'blockView.citeTitled': 'Source %1: %2',
  'blockView.copyCode': 'Copy code',
  'blockView.code': 'Code',
  'blockView.document': 'Document',
  'blockView.versions': '%1 versions',
  'blockView.version': '1 version',
  'blockView.table': 'Table',
  'blockView.stopped': 'Stopped here.'
});

/** Glyph for each callout tone. */
const CALLOUT_ICONS = Object.freeze({ info: 'info', success: 'success', warning: 'warning', danger: 'error' });

/**
 * An answer an agent wrote, drawn block by block as semantic elements inside `.zx-prose`, and
 * written to as it streams. Finished blocks are never redrawn: `appendText()` and `append()` touch
 * only the last block, so a reader's selection or focus in an earlier paragraph survives the rest
 * of the answer arriving.
 *
 * @fires BlockView#cite
 * @fires BlockView#artifact
 * @fires BlockView#end
 * @extends {Component<BlockViewOptions>}
 */
export class BlockView extends Component {
  static cssName = 'block-view';

  /** @type {Readonly<BlockViewOptions>} */
  static defaults = {
    blocks: [],
    headingLevel: 3,
    size: 'sm',
    streaming: false,
    sources: null,
    msg: MESSAGES
  };

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._original = created ? null : snapshotTarget(root);
    if (!created) root.replaceChildren();
    root.classList.add('zx-prose');
    /** @type {Block[]} */
    this._blocks = [];
    /** @type {HTMLElement[]} */
    this._nodes = [];
    /** @type {Source[]} */
    this._sources = Array.isArray(this.options.sources) ? [...this.options.sources] : [];
    this._streaming = Boolean(this.options.streaming);
    this._stopped = false;
    /** @type {HTMLElement|null} */
    this._stoppedNote = null;
    if (this.options.size !== 'md') root.dataset.size = 'sm';
    root.dataset.zxMeasure = 'full';
    this._syncState();
    this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));
    this._observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this._syncScrollers())
      : null;
    this._observer?.observe(root);
    for (const block of Array.isArray(this.options.blocks) ? this.options.blocks : []) this._push(block);
    return root;
  }

  /**
   * Replaces every block, clearing a stopped state.
   * @param {Block[]} blocks
   * @param {{streaming?: boolean}} [options={}] `streaming: true` starts a new streamed answer
   * from these blocks; otherwise the streaming state is kept.
   * @returns {this}
   */
  setBlocks(blocks, options = {}) {
    for (const node of this._nodes) node.remove();
    this._blocks = [];
    this._nodes = [];
    this._stoppedNote?.remove();
    this._stoppedNote = null;
    this._stopped = false;
    if (typeof options.streaming === 'boolean') this._streaming = options.streaming;
    for (const block of Array.isArray(blocks) ? blocks : []) this._push(block);
    this._syncState();
    return this;
  }

  /**
   * Adds a block after the last one. The blocks before it are left as they are.
   * @param {Block} block
   * @returns {this}
   */
  append(block) {
    this._push(block);
    return this;
  }

  /**
   * Streams text into the answer. It continues the last paragraph, or opens one when the answer
   * ends in anything else; a blank line in the text starts a new paragraph. Only the last
   * paragraph is redrawn, so a marker split across two calls (`**bo` … `ld**`) resolves as soon as
   * its close arrives.
   * @param {string} text
   * @returns {this}
   */
  appendText(text) {
    const chunk = String(text ?? '');
    if (!chunk) return this;
    const last = this._blocks.at(-1);
    if (last?.type !== 'p') {
      this._push({ type: 'p', text: '' });
    }
    const tail = /** @type {{type: 'p', text: string}} */ (this._blocks.at(-1));
    // Split on a blank line only once text follows it: a chunk may end between the two newlines,
    // or right after them, and the paragraph must not open until there is something to put in it.
    const parts = (tail.text + chunk).split(/\n{2,}(?=\S)/);
    tail.text = /** @type {string} */ (parts.shift());
    this._redrawLast();
    for (const part of parts) this._push({ type: 'p', text: part });
    return this;
  }

  /**
   * Marks the answer finished.
   * @returns {this}
   */
  end() {
    const wasStreaming = this._streaming;
    this._streaming = false;
    this._syncState();
    if (wasStreaming) this.emit('end', {});
    return this;
  }

  /**
   * Marks the answer stopped where it is, with a line saying so.
   * @returns {this}
   */
  stop() {
    this._streaming = false;
    if (!this._stopped) {
      this._stopped = true;
      this._stoppedNote = h('p', { class: 'zx-block-view__stopped' }, this.msg('blockView.stopped'));
      this.el.append(this._stoppedNote);
    }
    this._syncState();
    return this;
  }

  /**
   * Sets the sources citations point at.
   * @param {Source[]} sources
   * @returns {this}
   */
  setSources(sources) {
    this._sources = Array.isArray(sources) ? [...sources] : [];
    for (const button of this.el.querySelectorAll('[data-cite]')) {
      button.setAttribute('aria-label', this._citeLabel(Number(/** @type {HTMLElement} */ (button).dataset.cite)));
    }
    return this;
  }

  /**
   * Says whether an artifact's card has its artifact open somewhere — an inspector, a drawer — so
   * the card reads as pressed and names what it controls. The application owns the open state;
   * the card only reflects it.
   * @param {string} id Artifact id.
   * @param {{expanded?: boolean|null, controls?: string|null}} state `expanded` sets or (null)
   * removes `aria-expanded`; `controls` sets or (null) removes `aria-controls`.
   * @returns {this}
   */
  setArtifactState(id, state = {}) {
    for (const card of /** @type {NodeListOf<HTMLElement>} */ (this.el.querySelectorAll('button[data-artifact]'))) {
      if (card.dataset.artifact !== String(id)) continue;
      if ('expanded' in state) {
        if (state.expanded == null) card.removeAttribute('aria-expanded');
        else card.setAttribute('aria-expanded', String(Boolean(state.expanded)));
      }
      if ('controls' in state) {
        if (state.controls) card.setAttribute('aria-controls', String(state.controls));
        else card.removeAttribute('aria-controls');
      }
    }
    return this;
  }

  /** @returns {Block[]} A copy of the blocks. */
  getBlocks() {
    return structuredClone(this._blocks);
  }

  /** @returns {boolean} Whether more is still being written. */
  isStreaming() {
    return this._streaming;
  }

  /** @returns {string} The answer as plain text. */
  toText() {
    return blocksToText(this._blocks);
  }

  /** @returns {string} The answer as Markdown. */
  toMarkdown() {
    return blocksToMarkdown(this._blocks);
  }

  /** @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._observer?.disconnect();
    this._observer = null;
    super.destroy();
    if (this._original) restoreTarget(this.el, this._original);
  }

  /**
   * @private
   * @param {Block} block
   * @returns {void}
   */
  _push(block) {
    if (!block || typeof block !== 'object') return;
    const copy = /** @type {Block} */ (structuredClone(block));
    const node = renderBlock(copy, this._renderOptions());
    this._blocks.push(copy);
    this._nodes.push(node);
    if (this._stoppedNote) this._stoppedNote.before(node);
    else this.el.append(node);
    if (copy.type === 'table') this._syncScrollers();
  }

  /** @private @returns {void} */
  _redrawLast() {
    const index = this._blocks.length - 1;
    if (index < 0) return;
    const node = renderBlock(this._blocks[index], this._renderOptions());
    this._nodes[index].replaceWith(node);
    this._nodes[index] = node;
  }

  /** @private @returns {RenderBlocksOptions & {cite: (n: number) => Node, artifact: boolean}} */
  _renderOptions() {
    return {
      headingLevel: this.options.headingLevel,
      msg: (key, ...args) => this.msg(key, ...args),
      cite: (n) => h('sup', { class: 'zx-block-view__cite' }, h('button', {
        type: 'button', class: 'zx-block-view__cite-button', dataset: { cite: String(n) }, 'aria-label': this._citeLabel(n)
      }, String(n))),
      artifact: true
    };
  }

  /** @private @param {number} n @returns {string} */
  _citeLabel(n) {
    const source = this._sourceAt(n);
    return source ? this.msg('blockView.citeTitled', n, source.title) : this.msg('blockView.cite', n);
  }

  /** @private @param {number} n @returns {Source|null} */
  _sourceAt(n) {
    return this._sources[n - 1] ?? null;
  }

  /** @private @returns {void} */
  _syncState() {
    const root = /** @type {HTMLElement} */ (this.el);
    root.dataset.state = this._stopped ? 'stopped' : this._streaming ? 'streaming' : 'done';
    if (this._streaming) root.setAttribute('aria-busy', 'true');
    else root.removeAttribute('aria-busy');
  }

  /**
   * A wide table scrolls inside the answer; while it does, its wrapper is a named, focusable
   * region so the keyboard can scroll it too. A table that fits is not a tab stop.
   * @private
   * @returns {void}
   */
  _syncScrollers() {
    for (const wrap of /** @type {NodeListOf<HTMLElement>} */ (this.el.querySelectorAll('.zx-block-view__table'))) {
      const overflowing = wrap.scrollWidth > wrap.clientWidth + 1;
      if (overflowing && !wrap.hasAttribute('tabindex')) {
        wrap.tabIndex = 0;
        wrap.setAttribute('role', 'region');
        wrap.setAttribute('aria-label', this.msg('blockView.table'));
      } else if (!overflowing && wrap.hasAttribute('tabindex')) {
        wrap.removeAttribute('tabindex');
        wrap.removeAttribute('role');
        wrap.removeAttribute('aria-label');
      }
    }
  }

  /** @private @param {MouseEvent} event @returns {void} */
  _onClick(event) {
    const target = /** @type {Element|null} */ (event.target instanceof Element ? event.target : null);
    const cite = /** @type {HTMLElement|null} */ (target?.closest('[data-cite]') ?? null);
    if (cite && this.el.contains(cite)) {
      const n = Number(cite.dataset.cite);
      this.emit('cite', { n, source: this._sourceAt(n) });
      return;
    }
    const artifact = /** @type {HTMLElement|null} */ (target?.closest('[data-artifact]') ?? null);
    if (artifact && this.el.contains(artifact)) this.emit('artifact', { id: String(artifact.dataset.artifact) });
  }
}

/**
 * Citation listener payload.
 * @event BlockView#cite
 * @type {CustomEvent<{n: number, source: Source|null}>}
 */
/**
 * Artifact card listener payload.
 * @event BlockView#artifact
 * @type {CustomEvent<{id: string}>}
 */
/**
 * Fired when a streaming answer is marked finished.
 * @event BlockView#end
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Draws blocks without a component, for a static answer: a transcript, a print view, a preview.
 * Citations are plain superscripts and artifacts plain cards; use `BlockView` for them to act.
 * @param {Block[]} blocks
 * @param {RenderBlocksOptions} [options={}]
 * @returns {DocumentFragment}
 */
export function renderBlocks(blocks, options = {}) {
  const fragment = document.createDocumentFragment();
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (block && typeof block === 'object') fragment.append(renderBlock(block, options));
  }
  return fragment;
}

/**
 * Resolves a message when no component does: the host translator, then the catalogue.
 * @param {string} key Message key.
 * @param {...unknown} args Placeholder values.
 * @returns {string}
 */
function catalogueMessage(key, ...args) {
  return translate(key, args);
}

/**
 * Draws a run of model text as text nodes, `<strong>`, `<code>`, and citations — never as HTML.
 * @param {string} text
 * @param {((n: number) => Node)|undefined} cite Draws a citation; a plain superscript without it.
 * @returns {Array<Node|string>}
 */
function inlineNodes(text, cite) {
  return parseInline(text).map((segment) => {
    if (segment.kind === 'strong') return h('strong', {}, segment.text);
    if (segment.kind === 'code') return h('code', {}, segment.text);
    if (segment.kind === 'cite') return cite ? cite(segment.n) : h('sup', { class: 'zx-block-view__cite' }, String(segment.n));
    return segment.text;
  });
}

/**
 * @param {Block} block
 * @param {RenderBlocksOptions & {cite?: (n: number) => Node, artifact?: boolean}} options
 * @returns {HTMLElement}
 */
function renderBlock(block, options) {
  const msg = options.msg ?? catalogueMessage;
  const cite = options.cite;
  const base = Math.min(5, Math.max(2, Number(options.headingLevel) || 3));
  switch (block.type) {
    case 'heading':
      return h(`h${block.level === 3 ? base + 1 : base}`, {}, inlineNodes(block.text, cite));
    case 'quote':
      return h('blockquote', { class: 'zx-block-view__quote' },
        String(block.text ?? '').split(/\n{2,}/).map((paragraph) => h('p', {}, inlineNodes(paragraph, cite))));
    case 'list':
      return h(block.ordered ? 'ol' : 'ul', {},
        (Array.isArray(block.items) ? block.items : []).map((item) => h('li', {}, inlineNodes(item, cite))));
    case 'code':
      return renderCode(block, msg);
    case 'table':
      return renderTable(block, cite);
    case 'figures':
      return h('dl', { class: 'zx-block-view__figures' }, (Array.isArray(block.rows) ? block.rows : []).map((entry) => {
        const row = figureRow(entry);
        return h('div', { class: 'zx-block-view__figure' },
          h('dt', { class: 'zx-block-view__figure-label' }, row.label),
          row.detail ? h('dd', { class: 'zx-block-view__figure-detail' }, row.detail) : null,
          h('dd', { class: 'zx-block-view__figure-value' }, row.value));
      }));
    case 'callout': {
      const tone = Object.hasOwn(CALLOUT_ICONS, String(block.tone)) ? String(block.tone) : null;
      return h('div', { class: 'zx-callout zx-block-view__callout', dataset: { kind: tone } },
        tone ? h('span', { class: 'zx-callout__icon', 'aria-hidden': 'true' },
          icon(CALLOUT_ICONS[/** @type {keyof typeof CALLOUT_ICONS} */ (tone)], { size: 16 })) : null,
        h('div', { class: 'zx-callout__body' },
          block.title ? h('p', { class: 'zx-callout__title' }, block.title) : null,
          h('p', {}, inlineNodes(block.text, cite))));
    }
    case 'artifact':
      return renderArtifact(block, msg, Boolean(options.artifact));
    default:
      return h('p', {}, inlineNodes(/** @type {{text?: string}} */ (block).text ?? '', cite));
  }
}

/**
 * @param {Extract<Block, {type: 'code'}>} block
 * @param {(key: string, ...args: unknown[]) => string} msg
 * @returns {HTMLElement}
 */
function renderCode(block, msg) {
  const language = typeof block.language === 'string' ? block.language : '';
  return h('figure', { class: 'zx-block-view__code' },
    h('figcaption', { class: 'zx-block-view__code-head' },
      h('span', { class: 'zx-block-view__code-language' }, language || msg('blockView.code')),
      copyButton({ text: String(block.code ?? ''), title: msg('blockView.copyCode'), size: 'sm' })),
    block.lines
      ? h('pre', { class: 'zx-block-view__pre', dataset: { lines: '' }, tabindex: '0' }, h('code', {},
        String(block.code ?? '').split('\n').map((line) => h('span', {
          class: 'zx-block-view__line', style: { '--zx-block-view-indent': `${/^\s*/.exec(line)?.[0].length ?? 0}ch` }
        }, codeSegments(language, line)))))
      : h('pre', { class: 'zx-block-view__pre', tabindex: '0' }, h('code', {}, codeSegments(language, block.code))));
}

/**
 * Coloured code as text nodes and spans, never HTML.
 * @param {string} language
 * @param {string} code
 * @returns {Array<Node|string>}
 */
function codeSegments(language, code) {
  return highlight(language, code).map((segment) => (segment.token
    ? h('span', { class: 'zx-block-view__token', dataset: { token: segment.token } }, segment.text)
    : segment.text));
}

/**
 * @param {Extract<Block, {type: 'table'}>} block
 * @param {((n: number) => Node)|undefined} cite
 * @returns {HTMLElement}
 */
function renderTable(block, cite) {
  const columns = Array.isArray(block.columns) ? block.columns : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const align = (/** @type {number} */ index) => {
    const value = block.align?.[index];
    return value === 'end' || value === 'center' ? value : null;
  };
  return h('div', { class: 'zx-block-view__table' }, h('table', {},
    h('thead', {}, h('tr', {}, columns.map((column, index) => h('th', { scope: 'col', dataset: { align: align(index) } },
      inlineNodes(column, cite))))),
    h('tbody', {}, rows.map((row) => h('tr', {}, (Array.isArray(row) ? row : []).map((cell, index) => h('td', {
      dataset: { align: align(index) }
    }, inlineNodes(cell, cite))))))));
}

/**
 * @param {Extract<Block, {type: 'artifact'}>} block
 * @param {(key: string, ...args: unknown[]) => string} msg
 * @param {boolean} interactive
 * @returns {HTMLElement}
 */
function renderArtifact(block, msg, interactive) {
  const kind = block.kind === 'code' ? 'code' : 'document';
  const versions = Number(block.versions) || 0;
  const meta = [msg(kind === 'code' ? 'blockView.code' : 'blockView.document'),
    versions > 1 ? msg('blockView.versions', versions) : versions === 1 ? msg('blockView.version') : null].filter(Boolean).join(' · ');
  const content = [
    h('span', { class: 'zx-block-view__artifact-tile', dataset: { kind }, 'aria-hidden': 'true' },
      icon(kind === 'code' ? 'code' : 'file', { size: 16 })),
    h('span', { class: 'zx-block-view__artifact-copy' },
      h('span', { class: 'zx-block-view__artifact-name' }, String(block.title ?? '')),
      h('span', { class: 'zx-block-view__artifact-meta' }, meta)),
    interactive ? h('span', { class: 'zx-block-view__artifact-chevron', 'aria-hidden': 'true' }, icon('chevron-right', { size: 14 })) : null
  ];
  return interactive
    ? h('p', { class: 'zx-block-view__artifact-row' },
      h('button', { type: 'button', class: 'zx-block-view__artifact', dataset: { artifact: String(block.id ?? '') } }, content))
    : h('p', { class: 'zx-block-view__artifact-row' }, h('span', { class: 'zx-block-view__artifact' }, content));
}
