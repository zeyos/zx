// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { formatFileSize } from '../../core/format.js';
import { icon } from '../../core/icons.js';
import { escapeRegExp, uid } from '../../core/util.js';
import { AGENT_MESSAGES, initialsOf } from '../../internal/agent-model.js';
import { ApprovalCard } from '../approval-card/approval-card.js';
import { Avatar } from '../avatar/avatar.js';
import { BlockView } from '../block-view/block-view.js';
import { copyButton } from '../copy/copy-button.js';
import { emptyState } from '../empty-state/empty-state.js';
import { skeletonText } from '../skeleton/skeleton.js';
import { RunTrace } from '../run-trace/run-trace.js';
import { SourceList } from '../source-list/source-list.js';
import { Surface } from '../surface/surface.js';

/** @typedef {import('../../internal/agent-model.js').ThreadItem} ThreadItem */
/** @typedef {import('../../internal/agent-model.js').Author} Author */
/** @typedef {import('../../internal/agent-model.js').Source} Source */
/** @typedef {import('../../internal/agent-model.js').Block} Block */
/** @typedef {import('../empty-state/empty-state.js').EmptyStateOptions} EmptyStateOptions */
/** @typedef {'copy'|'regenerate'|'branch'|'rate'} AnswerAction */
/** @typedef {import('../surface/surface.js').SurfaceOptions} SurfaceOptions */
/** @typedef {import('../surface/text.js').SurfaceReply} SurfaceReply */

/**
 * Something still on its way — a tool call's arguments, a document being composed — drawn as a
 * Skeleton under its author's byline. It is replaced by the item it stands for, and goes without
 * replying or announcing anything.
 * The type's name is reserved; `placeholder` is free for an application's own items.
 * @typedef {Object} PlaceholderItem
 * @property {string} id
 * @property {'zx-placeholder'} type
 * @property {string} [at]
 * @property {string} [author]
 * @property {number} [lines=2] Skeleton lines.
 */

/**
 * Where `upsert()` puts an item it adds.
 * @typedef {Object} UpsertOptions
 * @property {string|null} [after=null] The id of the item to insert the new item right after;
 *   the end of the thread when null or unknown. An item already in the thread stays where it is.
 */

/**
 * A surface in the conversation: an answer or a question an agent composed. The item comes from
 * the application, never from a model line, so its `token` and `catalog` are the application's.
 * Without a `document` it waits for operations streamed into `thread.surface(id)`.
 * @typedef {Object} SurfaceItem
 * @property {string} id
 * @property {'surface'} type
 * @property {string} [at]
 * @property {string} [author]
 * @property {import('../surface/validate.js').SurfaceDocument|null} [document] The whole surface.
 * @property {string|null} [token] The application's token, copied into the reply.
 * @property {import('../surface/catalog.js').SurfaceCatalog} [catalog] A narrowed catalog.
 * @property {SurfaceReply|null} [reply] The reply it gave; the surface is drawn as its receipt.
 */

/**
 * What a registered item renderer receives besides the item.
 * @typedef {Object} ThreadRenderContext
 * @property {AgentThread} thread The thread drawing the item.
 * @property {Author|null} author The item's author, resolved from `authors`.
 * @property {<T extends Component>(component: T) => T} own Hands a component to the thread, which
 * destroys it with the item.
 */

/**
 * Draws one item of a registered type. It returns the item's content; the thread wraps it in the
 * article, byline included.
 * @typedef {(item: ThreadItem, context: ThreadRenderContext) => Node|null} ThreadItemRenderer
 */

/**
 * @typedef {Object} AgentThreadOptions
 * @property {ThreadItem[]} [items=[]] The conversation, oldest first.
 * @property {Record<string, Author>} [authors={}] Who wrote the items and took the steps, by key.
 * An item without an `author` is the person's own (`user`) or the first agent's (anything else).
 * @property {string} [me='me'] Author key of the person reading; their items read as "You".
 * @property {string|null} [label=null] Accessible name of the feed; "Conversation" when null.
 * @property {2|3|4|5} [headingLevel=3] Heading level inside answers and cards.
 * @property {EmptyStateOptions|null} [emptyState=null] Shown while there are no items.
 * @property {boolean} [followOutput=true] Keep the end in view while new output arrives, as long
 * as the reader is at the end; otherwise offer "Jump to latest" and leave them where they are.
 * @property {Element|null} [scroller=null] The element that scrolls; the nearest scrolling
 * ancestor (or the thread itself) when null.
 * @property {AnswerAction[]} [answerActions=['copy','regenerate','branch']] Actions under each
 * finished answer; `regenerate` only under the latest one.
 * @property {Partial<Record<'regenerate'|'branch'|'rateUp'|'rateDown'|'edit', string>>} [icons] Glyph
 * names for the answer and message actions.
 * @property {Array<'edit'|'copy'>} [userActions=[]] Actions on the person's own messages, shown
 * while the message is pointed at or holds focus (always on a touch screen): `edit` asks the
 * application to put the message back in the composer, `copy` copies its text.
 * @property {Record<string, string>} [traceIcons={}] Glyph names for trace step kinds, handed to
 * every `RunTrace` the thread draws.
 * @property {Record<string, string>} [sourceIcons={}] Glyph names for source kinds, handed to every
 * `SourceList` the thread draws.
 * @property {(() => Date)|null} [now=null] The clock "today" is measured against in cards and
 * traces, for an application whose world runs on fixed dates; the real clock when null.
 * @property {((at: string) => string)|null} [formatTime=null] Formats an item's `at`; the local
 * clock time when null.
 * @property {string} [locale] Locale for times.
 * @property {Omit<SurfaceOptions, 'document'|'token'|'catalog'|'reply'>} [surfaceOptions={}] Options
 * handed to every Surface the thread draws: the application's `policy`, `resolve`, `chartAdapter`
 * and `msg`. Its authors, heading level and locale are the thread's unless given here.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{item: ThreadItem, action: string, value?: unknown}>) => void} [onaction] Answer action listener.
 * @property {(event: CustomEvent<{item: ThreadItem, reply: SurfaceReply}>) => void} [onreply] Surface reply listener.
 * @property {(event: CustomEvent<{item: ThreadItem, values: Record<string, unknown>}>) => void} [onapprove] Approval listener.
 * @property {(event: CustomEvent<{item: ThreadItem, values: Record<string, unknown>}>) => void} [onedit] Edit listener.
 * @property {(event: CustomEvent<{item: ThreadItem, reason: string}>) => void} [onreject] Rejection listener.
 * @property {(event: CustomEvent<{item: ThreadItem, n: number, source: Source|null}>) => void} [oncite] Citation listener.
 * @property {(event: CustomEvent<{item: ThreadItem, id: string}>) => void} [onartifact] Artifact listener.
 * @property {(event: CustomEvent<{target: string}>) => void} [onreveal] Reveal listener.
 * @property {(event: CustomEvent<{item: ThreadItem, ref: import('../../internal/agent-model.js').ItemRef}>) => void} [onopen] Link listener.
 */

/**
 * @typedef {Object} ThreadEntry
 * @property {ThreadItem} item The item as last given.
 * @property {HTMLElement} article Its article.
 * @property {Component[]} owned Components drawn for it.
 * @property {BlockView|null} view An answer's text.
 * @property {RunTrace|null} trace A trace's steps.
 * @property {SourceList|null} sources An answer's sources.
 * @property {ApprovalCard|null} card An approval.
 * @property {Surface|null} [surface] A surface.
 */

const MESSAGES = Object.freeze({
  ...AGENT_MESSAGES,
  'agentThread.label': 'Conversation',
  'agentThread.you': 'You',
  'agentThread.agent': 'Agent',
  'agentThread.via': 'via %1',
  'agentThread.latest': 'Jump to latest',
  'agentThread.copy': 'Copy answer',
  'agentThread.regenerate': 'Regenerate answer',
  'agentThread.branch': 'Branch into a new conversation',
  'agentThread.rateUp': 'Helpful',
  'agentThread.rateDown': 'Not helpful',
  'agentThread.previousVersion': 'Previous version',
  'agentThread.nextVersion': 'Next version',
  'agentThread.version': 'Version %1 of %2',
  'agentThread.attachments': 'Attachments',
  'agentThread.sources': 'Sources',
  'agentThread.stopped': 'Stopped',
  'agentThread.writing': '%1 is writing an answer',
  'agentThread.answered': '%1 answered',
  'agentThread.working': '%1 is working',
  'agentThread.needsApproval': '%1 needs your approval',
  'agentThread.needsAnswer': '%1 needs your answer',
  'agentThread.stoppedAnnounce': 'Stopped',
  'agentThread.writingNow': '%1 is writing…',
  'agentThread.edit': 'Edit message',
  'agentThread.copyMessage': 'Copy message'
});

const DEFAULT_ICONS = Object.freeze({ regenerate: 'reload', branch: 'columns', rateUp: 'check', rateDown: 'x', edit: 'type' });

/** How close to the end, in pixels, still counts as reading the end. */
const END_SLACK = 48;

/**
 * A conversation with one or more agents: the person's messages, the agents' answers as they
 * stream, the steps a run took, the approvals that hold it, and one-line notices — drawn from the
 * plain-JSON items of the agent model. The thread owns no transport and no state beyond what it
 * is given: the application feeds it (`upsert`, `patch`, `appendText`) and acts on what it emits.
 *
 * It follows the APG feed pattern: each item is an article in a `role="feed"`, PageDown and
 * PageUp move between articles, and Ctrl+End / Ctrl+Home leave the feed. Streamed text is never
 * read aloud as it arrives; one polite status says when an agent starts, answers, needs
 * approval, or is stopped.
 *
 * @fires AgentThread#action
 * @fires AgentThread#approve
 * @fires AgentThread#edit
 * @fires AgentThread#reject
 * @fires AgentThread#cite
 * @fires AgentThread#artifact
 * @fires AgentThread#reveal
 * @fires AgentThread#open
 * @fires AgentThread#reply
 * @extends {Component<AgentThreadOptions>}
 */
export class AgentThread extends Component {
  static cssName = 'agent-thread';

  /** @type {Readonly<AgentThreadOptions>} */
  static defaults = {
    items: [],
    authors: {},
    me: 'me',
    label: null,
    headingLevel: 3,
    emptyState: null,
    followOutput: true,
    scroller: null,
    answerActions: ['copy', 'regenerate', 'branch'],
    userActions: [],
    icons: {},
    traceIcons: {},
    sourceIcons: {},
    now: null,
    formatTime: null,
    surfaceOptions: {},
    msg: MESSAGES
  };

  /** @type {Map<string, ThreadItemRenderer>} */
  static #renderers = new Map();

  /**
   * Registers how items of another type are drawn. An application's own renderer for `surface`
   * replaces the library's drawing of that type; the types the library always draws cannot be
   * replaced.
   * @param {string} type Item type.
   * @param {ThreadItemRenderer} render Draws the item's content.
   * @returns {typeof AgentThread}
   */
  static register(type, render) {
    const name = String(type ?? '').trim();
    if (!name) throw new TypeError('Thread item type must not be empty');
    if (BUILT_IN.has(name)) throw new TypeError(`Thread item type "${name}" is built in`);
    if (typeof render !== 'function') throw new TypeError('Thread item renderer must be a function');
    AgentThread.#renderers.set(name, render);
    return this;
  }

  /**
   * Reports whether a type has a registered renderer. `surface` answers false until an
   * application registers its own, so a guarded `register()` still takes effect.
   * @param {string} type
   * @returns {boolean}
   */
  static has(type) {
    return BUILT_IN.has(type) || AgentThread.#renderers.has(type);
  }

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('section'));
    this.el = root;
    this._original = created ? null : snapshotTarget(root);
    if (!created) root.replaceChildren();
    this._id = uid('zx-agent-thread');
    /** @type {Map<string, ThreadEntry>} */
    this._entries = new Map();
    /** @type {string[]} */
    this._order = [];
    this._announceTimer = 0;
    /** @type {Element|null} */
    this._scrollHost = null;
    /** @type {string|null} */
    this._latestAnswer = null;
    /** @type {Map<string, {expanded?: boolean|null, controls?: string|null}>} Artifact open states, for answers drawn later. */
    this._artifacts = new Map();

    this._feed = h('div', {
      class: 'zx-agent-thread__feed', role: 'feed', 'aria-busy': 'false',
      'aria-label': this.options.label || this.msg('agentThread.label')
    });
    this._empty = h('div', { class: 'zx-agent-thread__empty', hidden: true });
    this._latestButton = /** @type {HTMLButtonElement} */ (h('button', {
      type: 'button', class: 'zx-agent-thread__latest', hidden: true
    }, icon('arrow-down', { size: 14 }), h('span', {}, this.msg('agentThread.latest'))));
    this._status = h('p', { class: 'zx-agent-thread__status', role: 'status' });
    root.append(this._feed, this._empty, this._latestButton, this._status);

    this.listen(this._feed, 'keydown', (event) => this._onFeedKey(/** @type {KeyboardEvent} */ (event)));
    this.listen(this._latestButton, 'click', () => {
      this.scrollToEnd();
      this._lastArticle()?.focus({ preventScroll: true });
    });
    this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));

    for (const item of Array.isArray(this.options.items) ? this.options.items : []) this._add(item);
    this._syncPositions();
    this._syncEmpty();
    return root;
  }

  /* ------------------------------------------------------------------ public API -- */

  /**
   * Replaces the conversation. Everything is dropped and then drawn anew, except a surface already
   * drawn, which stays so that one still matching keeps answering.
   * @param {ThreadItem[]} items
   * @returns {this}
   */
  setItems(items) {
    const list = (Array.isArray(items) ? items : []).filter((item) => item && typeof item === 'object' && item.id != null);
    const staying = new Set(list.filter((item) => item.type === 'surface' && this._entries.get(String(item.id))?.surface)
      .map((item) => String(item.id)));
    for (const id of [...this._order]) if (!staying.has(id)) this._drop(id);
    for (const item of list) {
      if (item.type === 'surface' && staying.has(String(item.id))) this._replace(String(item.id), item);
      else this._add(item);
    }
    if (staying.size) this._arrange(list.map((item) => String(item.id)));
    this._syncPositions();
    this._syncEmpty();
    return this;
  }

  /**
   * Adds an item, or replaces the item with the same id where it stands. A new item goes at the
   * end, or right after the item `options.after` names.
   * @param {ThreadItem} item
   * @param {UpsertOptions} [options]
   * @returns {this}
   */
  upsert(item, options = {}) {
    if (!item || typeof item !== 'object' || item.id == null) return this;
    const id = String(item.id);
    const after = options?.after == null ? null : String(options.after);
    this._follow(() => {
      if (this._entries.has(id)) this._replace(id, item);
      else this._add(item, { announce: true, after });
      this._syncPositions();
      this._syncEmpty();
    });
    return this;
  }

  /**
   * Changes part of an item. The common changes are made in place — an answer finishing or
   * stopping, a trace's steps, an approval's status — so focus and selection inside the item
   * survive; anything else redraws the item.
   * @param {string} id
   * @param {Record<string, unknown>} partial
   * @returns {this}
   */
  patch(id, partial) {
    const entry = this._entries.get(String(id));
    if (!entry || !partial || typeof partial !== 'object') return this;
    const before = entry.item;
    const item = /** @type {ThreadItem} */ ({ ...before, ...cloneItem({ ...partial, type: before.type }), id: before.id, type: before.type });
    const keys = Object.keys(partial);
    const only = (/** @type {string[]} */ allowed) => keys.every((key) => allowed.includes(key));
    this._follow(() => {
      if (item.type === 'answer' && entry.view && only(['streaming', 'stopped', 'sources', 'blocks', 'steps'])
        && (!('steps' in partial) || entry.trace)) {
        entry.item = item;
        const answer = /** @type {Extract<ThreadItem, {type: 'answer'}>} */ (item);
        if ('blocks' in partial) entry.view.setBlocks(answer.blocks ?? []);
        if ('steps' in partial) entry.trace?.setSteps(answer.steps ?? []);
        if (answer.stopped && !(/** @type {any} */ (before)).stopped) {
          entry.view.stop();
          this._announce(this.msg('agentThread.stoppedAnnounce'));
        } else if ('streaming' in partial && !answer.streaming && (/** @type {any} */ (before)).streaming) {
          entry.view.end();
          this._announce(this.msg('agentThread.answered', this._authorName(item)));
        }
        if ('sources' in partial) entry.view.setSources(answer.sources ?? []);
        this._redrawAnswerFooter(entry);
        this._syncWriting(entry);
      } else if (item.type === 'trace' && entry.trace && only(['steps', 'open', 'title'])) {
        entry.item = item;
        const trace = /** @type {Extract<ThreadItem, {type: 'trace'}>} */ (item);
        if ('steps' in partial) entry.trace.setSteps(trace.steps ?? []);
        if ('title' in partial) entry.trace.setLabel(trace.title ?? null);
        if ('open' in partial) {
          if (trace.open) entry.trace.expand(null);
          else entry.trace.collapse();
        }
      } else if (item.type === 'approval' && entry.card && only(['status', 'answeredBy', 'answeredAt', 'rejectReason'])) {
        entry.item = item;
        const approval = /** @type {Extract<ThreadItem, {type: 'approval'}>} */ (item);
        entry.card.setStatus(approval.status ?? 'pending', {
          by: approval.answeredBy, at: approval.answeredAt, reason: approval.rejectReason ?? undefined
        });
      } else {
        this._replace(String(id), item);
      }
      this._syncPositions();
    });
    return this;
  }

  /**
   * Streams text into an answer, creating it when the id is new. Only the answer's last
   * paragraph is redrawn.
   * @param {string} id
   * @param {string} text
   * @returns {this}
   */
  appendText(id, text) {
    const key = String(id);
    let entry = this._entries.get(key);
    if (!entry) {
      this.upsert({ id: key, type: 'answer', blocks: [], streaming: true });
      entry = this._entries.get(key);
    }
    if (!entry?.view) return this;
    const view = entry.view;
    const written = entry;
    this._follow(() => {
      view.appendText(text);
      this._syncWriting(written);
    });
    return this;
  }

  /**
   * Adds a whole block to an answer — a figures block, a table, code — after what it already
   * shows, without redrawing the rest of the answer. Creates the answer when the id is new.
   * @param {string} id
   * @param {Block} block
   * @returns {this}
   */
  appendBlock(id, block) {
    const key = String(id);
    if (!this._entries.has(key)) this.upsert({ id: key, type: 'answer', blocks: [], streaming: true });
    const entry = this._entries.get(key);
    const view = entry?.view;
    if (entry && view) {
      this._follow(() => {
        view.append(block);
        this._syncWriting(entry);
      });
    }
    return this;
  }

  /**
   * Says something through the thread's polite status — an outcome the thread cannot see itself,
   * such as "Reminders sent". Said once; the same words said twice are heard twice.
   * @param {string} text
   * @returns {this}
   */
  announce(text) {
    if (text) this._announce(String(text));
    return this;
  }

  /**
   * Removes an item.
   * @param {string} id
   * @returns {this}
   */
  remove(id) {
    this._drop(String(id));
    this._syncPositions();
    this._syncEmpty();
    return this;
  }

  /**
   * An item as it stands, an answer's streamed text included.
   * @param {string} id
   * @returns {ThreadItem|null}
   */
  get(id) {
    const entry = this._entries.get(String(id));
    if (!entry) return null;
    const item = cloneItem(entry.item);
    if (item.type === 'surface' && entry.surface) {
      const surface = /** @type {any} */ (item);
      const document = entry.surface.toDocument();
      if (document) surface.document = document;
      surface.reply = entry.surface.getReply();
    }
    if (item.type === 'answer' && entry.view) /** @type {any} */ (item).blocks = entry.view.getBlocks();
    if (item.type === 'trace' && entry.trace) /** @type {any} */ (item).steps = entry.trace.getSteps();
    return item;
  }

  /** @returns {ThreadItem[]} Every item, in order, as it stands. */
  getItems() {
    return this._order.map((id) => /** @type {ThreadItem} */ (this.get(id)));
  }

  /**
   * The main component drawn for an item: an answer's BlockView, a trace's RunTrace, an
   * approval's ApprovalCard.
   * @param {string} id
   * @returns {Component|null}
   */
  getComponent(id) {
    const entry = this._entries.get(String(id));
    return entry ? entry.view ?? entry.trace ?? entry.card ?? entry.surface ?? null : null;
  }

  /**
   * The Surface drawn for a `surface` item, to stream its operations into with `apply()` or
   * `write()`.
   * @param {string} id
   * @returns {Surface|null}
   */
  surface(id) {
    return this._entries.get(String(id))?.surface ?? null;
  }

  /**
   * Brings something into view and moves focus to it: `item:<id>` an item, `step:<id>` a trace
   * step (in whichever trace holds it), `source:<n>` a source of the latest answer that has one.
   * @param {string} target
   * @returns {boolean} Whether the target was found.
   */
  reveal(target) {
    const [kind, ...rest] = String(target ?? '').split(':');
    const id = rest.join(':');
    let found = false;
    if (kind === 'item') {
      const entry = this._entries.get(id);
      if (entry) {
        entry.article.scrollIntoView({ block: 'nearest' });
        entry.article.focus({ preventScroll: true });
        found = true;
      }
    } else if (kind === 'step') {
      for (const entryId of [...this._order].reverse()) {
        const trace = this._entries.get(entryId)?.trace;
        if (trace && trace.getSteps().some((step) => step.id === id)) {
          trace.reveal(id);
          found = true;
          break;
        }
      }
    } else if (kind === 'source') {
      for (const entryId of [...this._order].reverse()) {
        const sources = this._entries.get(entryId)?.sources;
        if (sources) {
          sources.highlight(Number(id));
          found = true;
          break;
        }
      }
    }
    if (found) this.emit('reveal', { target: String(target) });
    return found;
  }

  /**
   * Reflects whether an artifact is open somewhere — an inspector, a drawer — on every card that
   * names it, in every answer. See `BlockView#setArtifactState()`.
   * @param {string} id Artifact id.
   * @param {{expanded?: boolean|null, controls?: string|null}} state
   * @returns {this}
   */
  setArtifactState(id, state) {
    const key = String(id);
    const merged = { ...(this._artifacts.get(key) ?? {}), ...(state ?? {}) };
    this._artifacts.set(key, merged);
    for (const entry of this._entries.values()) entry.view?.setArtifactState(key, merged);
    return this;
  }

  /**
   * Scrolls to the end of the conversation.
   * @returns {this}
   */
  scrollToEnd() {
    const scroller = this._scroller();
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    this._latestButton.hidden = true;
    return this;
  }

  /** @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    clearTimeout(this._announceTimer);
    for (const id of [...this._order]) this._drop(id);
    super.destroy();
    if (this._original) restoreTarget(this.el, this._original);
  }

  /* ------------------------------------------------------------------ items -- */

  /**
   * @private
   * @param {ThreadItem} item
   * @param {{announce?: boolean, after?: string|null}} [options]
   * @returns {void}
   */
  _add(item, options = {}) {
    if (!item || typeof item !== 'object' || item.id == null) return;
    const id = String(item.id);
    if (this._entries.has(id)) {
      this._replace(id, item);
      return;
    }
    const entry = this._build(cloneItem(item));
    this._entries.set(id, entry);
    const anchor = options.after != null && options.after !== id ? this._entries.get(options.after) : null;
    if (anchor) {
      this._order.splice(this._order.indexOf(String(options.after)) + 1, 0, id);
      anchor.article.after(entry.article);
    } else {
      this._order.push(id);
      this._feed.append(entry.article);
    }
    this._syncContinuation(id);
    this._syncLatest();
    if (options.announce) this._announceItem(entry.item);
  }

  /**
   * @private
   * @param {string} id
   * @param {ThreadItem} item
   * @returns {void}
   */
  _replace(id, item) {
    const old = this._entries.get(id);
    if (!old) return;
    const hadFocus = old.article.contains(document.activeElement);
    // A surface keeps answering where it stands unless the item brings a different surface, which
    // supersedes it: it replies once either way.
    const keep = item.type === 'surface' && old.surface && keepsSurface(old, /** @type {any} */ (item)) ? old.surface : null;
    if (keep) {
      old.owned = old.owned.filter((component) => component !== keep);
      old.surface = null;
    } else {
      old.surface?.supersede();
    }
    const entry = this._build(cloneItem({ ...item, id }), keep);
    old.article.replaceWith(entry.article);
    for (const component of old.owned) component.destroy();
    this._entries.set(id, entry);
    this._syncContinuation(id);
    this._syncPositions();
    this._syncLatest();
    if (hadFocus) entry.article.focus({ preventScroll: true });
  }

  /**
   * Puts the feed in the order given, moving only what stands elsewhere.
   * @private
   * @param {string[]} ids
   * @returns {void}
   */
  _arrange(ids) {
    this._order = [...new Set(ids)].filter((id) => this._entries.has(id));
    let next = this._feed.firstElementChild;
    for (const id of this._order) {
      const { article } = /** @type {ThreadEntry} */ (this._entries.get(id));
      if (article === next) next = next.nextElementSibling;
      else this._feed.insertBefore(article, next);
    }
    for (const id of this._order) this._syncContinuation(id);
    this._syncLatest();
  }

  /** @private @param {string} id @returns {void} */
  _drop(id) {
    const entry = this._entries.get(id);
    if (!entry) return;
    for (const component of entry.owned) component.destroy();
    entry.article.remove();
    this._entries.delete(id);
    this._order = this._order.filter((other) => other !== id);
    this._syncLatest();
  }

  /**
   * Regenerate belongs to the latest answer only: when another answer becomes the latest, both
   * answers' actions are redrawn.
   * @private
   * @returns {void}
   */
  _syncLatest() {
    const latest = this._latestAnswerId();
    if (latest === this._latestAnswer) return;
    const previous = this._latestAnswer;
    this._latestAnswer = latest;
    for (const id of [previous, latest]) {
      const entry = id ? this._entries.get(id) : null;
      if (entry) this._redrawActions(entry);
    }
  }

  /** @private @returns {string|null} The id of the last answer in the thread. */
  _latestAnswerId() {
    for (let index = this._order.length - 1; index >= 0; index -= 1) {
      if (this._entries.get(this._order[index])?.item.type === 'answer') return this._order[index];
    }
    return null;
  }

  /**
   * Redraws an answer's action row alone, leaving its sources as they are.
   * @private
   * @param {ThreadEntry} entry
   * @returns {void}
   */
  _redrawActions(entry) {
    const footer = entry.article.querySelector('.zx-agent-thread__footer');
    if (!footer || /** @type {any} */ (entry.item).streaming) return;
    footer.querySelector('.zx-agent-thread__actions')?.remove();
    const actions = this._answerActions(entry);
    if (actions) footer.append(actions);
  }

  /**
   * Draws one item into its article.
   * @private
   * @param {ThreadItem} item
   * @param {Surface|null} [surface=null] A surface to keep rather than draw anew.
   * @returns {ThreadEntry}
   */
  _build(item, surface = null) {
    /** @type {ThreadEntry} */
    const entry = { item, article: h('article'), owned: [], view: null, trace: null, sources: null, card: null, surface: null };
    const own = /** @type {<T extends Component>(component: T) => T} */ ((component) => {
      entry.owned.push(component);
      return component;
    });
    const mine = this._isMine(item);
    const bylineId = uid(`${this._id}-byline`);
    const article = entry.article;
    article.className = 'zx-agent-thread__item';
    article.tabIndex = -1;
    article.dataset.type = item.type;
    article.dataset.id = String(item.id);
    if (mine) article.dataset.mine = 'true';
    article.setAttribute('aria-labelledby', bylineId);
    // A notice is named by what it says, not by an author it may not have.
    if (item.type !== 'notice') {
      const avatar = mine ? null : this._avatar(item, own);
      if (avatar) article.append(avatar);
      article.append(this._byline(item, bylineId));
    }

    const body = h('div', { class: 'zx-agent-thread__body' });
    article.append(body);
    // An application's own renderer for `surface` goes the way of every registered type.
    switch (item.type === 'surface' && AgentThread.#renderers.has('surface') ? '' : item.type) {
      case 'user': {
        const user = /** @type {Extract<ThreadItem, {type: 'user'}>} */ (item);
        body.append(h('div', { class: 'zx-agent-thread__bubble' },
          h('p', { class: 'zx-agent-thread__text' }, withMentions(String(user.text ?? ''), user.mentions))));
        if (Array.isArray(user.files) && user.files.length) body.append(this._files(user.files));
        const actions = this._userActions(user);
        if (actions) {
          article.setAttribute('data-zx-reveal-host', '');
          body.append(actions);
        }
        break;
      }
      case 'text':
        body.append(h('p', { class: 'zx-agent-thread__text' }, String(/** @type {any} */ (item).text ?? '')));
        break;
      case 'notice': {
        const notice = /** @type {Extract<ThreadItem, {type: 'notice'}>} */ (item);
        const tone = ['info', 'success', 'warning', 'danger'].includes(String(notice.tone)) ? String(notice.tone) : 'neutral';
        article.dataset.tone = tone;
        body.append(h('p', { class: 'zx-agent-thread__notice' },
          tone === 'neutral' ? null : h('span', { class: 'zx-agent-thread__notice-icon', 'aria-hidden': 'true' },
            icon(tone === 'danger' ? 'error' : tone, { size: 14 })),
          h('span', { id: bylineId }, String(notice.text ?? '')),
          notice.action?.id && notice.action.label ? h('button', {
            type: 'button', class: 'zx-agent-thread__notice-action',
            dataset: { threadAction: 'notice', threadValue: String(notice.action.id) }
          }, String(notice.action.label)) : null));
        break;
      }
      case 'answer':
        this._buildAnswer(entry, body, own);
        break;
      case 'trace': {
        const trace = /** @type {Extract<ThreadItem, {type: 'trace'}>} */ (item);
        entry.trace = own(this._trace(trace.steps ?? [], { open: Boolean(trace.open), label: trace.title ?? null }));
        body.append(entry.trace.toElement());
        break;
      }
      case 'approval':
        this._buildApproval(entry, body, own);
        break;
      case 'zx-placeholder': {
        const lines = Number(/** @type {any} */ (item).lines);
        body.setAttribute('aria-busy', 'true');
        body.append(skeletonText({ lines: Number.isInteger(lines) && lines > 0 && lines <= 12 ? lines : 2 }));
        break;
      }
      case 'surface':
        this._buildSurface(entry, body, own, surface);
        break;
      default: {
        const render = AgentThread.#renderers.get(item.type);
        const content = render ? render(item, { thread: this, author: this._author(item), own }) : null;
        if (content) body.append(content);
        break;
      }
    }
    const refs = this._refs(/** @type {{refs?: unknown}} */ (item).refs);
    if (refs) body.append(refs);
    return entry;
  }

  /**
   * A RunTrace the thread owns: its authors, glyphs, and clock.
   * @private
   * @param {import('../../internal/agent-model.js').TraceStep[]} steps
   * @param {{open?: boolean, label?: string|null}} [options]
   * @returns {RunTrace}
   */
  _trace(steps, options = {}) {
    const trace = new RunTrace(null, {
      steps,
      open: Boolean(options.open),
      label: options.label ?? null,
      authors: this.options.authors,
      icons: this.options.traceIcons ?? {},
      ticking: true,
      now: this.options.now ?? null,
      formatTime: this.options.formatTime ?? null
    });
    // A link on a step is the item's link too: the application hears it once, from the thread.
    this._contain(trace, ['open']);
    trace.on('open', (event) => {
      const detail = /** @type {CustomEvent<{step: any, ref: any}>} */ (event).detail;
      const article = trace.toElement().closest('.zx-agent-thread__item');
      const id = article instanceof HTMLElement ? article.dataset.id : null;
      if (id) this.emit('open', { item: this.get(id), ref: detail.ref, step: detail.step });
    });
    return trace;
  }

  /**
   * Keeps a child's bubbling `zx-<type>` events inside the thread for the types the thread
   * re-emits itself, so a listener on the thread's root hears each of them once.
   * @private
   * @param {Component} child
   * @param {string[]} types
   * @returns {void}
   */
  _contain(child, types) {
    for (const type of types) this.listen(child.toElement(), `zx-${type}`, (event) => event.stopPropagation());
  }

  /**
   * Links from an item to the application's own things, after its content.
   * @private
   * @param {unknown} refs
   * @returns {HTMLElement|null}
   */
  _refs(refs) {
    const list = Array.isArray(refs) ? refs.filter((ref) => ref && ref.id != null && ref.label) : [];
    if (!list.length) return null;
    return h('ul', { class: 'zx-agent-thread__refs' }, list.map((ref) => h('li', {},
      h('button', { type: 'button', class: 'zx-agent-thread__ref', dataset: { threadAction: 'open', threadValue: String(ref.id) } },
        ref.icon ? h('span', { class: 'zx-agent-thread__ref-icon', 'aria-hidden': 'true' }, icon(String(ref.icon), { size: 14 })) : null,
        h('span', {}, String(ref.label))))));
  }

  /**
   * Edit and copy on the person's own message, shown while it is pointed at or holds focus.
   * @private
   * @param {Extract<ThreadItem, {type: 'user'}>} user
   * @returns {HTMLElement|null}
   */
  _userActions(user) {
    const wanted = new Set(Array.isArray(this.options.userActions) ? this.options.userActions : []);
    if (!wanted.size) return null;
    const icons = { ...DEFAULT_ICONS, ...(this.options.icons ?? {}) };
    /** @type {Node[]} */
    const controls = [];
    if (wanted.has('copy')) controls.push(copyButton({ text: String(user.text ?? ''), title: this.msg('agentThread.copyMessage'), size: 'sm' }));
    if (wanted.has('edit')) controls.push(actionButton(icons.edit, this.msg('agentThread.edit'), { action: 'edit' }));
    return controls.length ? h('div', { class: 'zx-agent-thread__actions', 'data-zx-reveal': '' }, controls) : null;
  }

  /**
   * @private
   * @param {ThreadEntry} entry
   * @param {HTMLElement} body
   * @param {<T extends Component>(component: T) => T} own
   * @returns {void}
   */
  _buildAnswer(entry, body, own) {
    const answer = /** @type {Extract<ThreadItem, {type: 'answer'}>} */ (entry.item);
    const version = this._version(answer);
    if (version.steps.length) {
      entry.trace = own(this._trace(version.steps, { open: Boolean(answer.stepsOpen) }));
      body.append(entry.trace.toElement());
    }
    body.append(h('p', { class: 'zx-agent-thread__writing', hidden: true }, this.msg('agentThread.writingNow', this._authorName(answer))));
    const view = own(new BlockView(null, {
      blocks: version.blocks,
      sources: version.sources,
      streaming: Boolean(answer.streaming),
      headingLevel: this.options.headingLevel
    }));
    if (version.stopped) view.stop();
    for (const [artifact, state] of this._artifacts) view.setArtifactState(artifact, state);
    this._contain(view, ['cite', 'artifact']);
    view.on('cite', (event) => {
      const detail = /** @type {CustomEvent<{n: number, source: Source|null}>} */ (event).detail;
      const emitted = this.emit('cite', { item: this.get(String(answer.id)), n: detail.n, source: detail.source });
      if (!emitted.defaultPrevented) entry.sources?.highlight(detail.n);
    });
    view.on('artifact', (event) => {
      const detail = /** @type {CustomEvent<{id: string}>} */ (event).detail;
      this.emit('artifact', { item: this.get(String(answer.id)), id: detail.id });
    });
    entry.view = view;
    body.append(view.toElement());
    body.append(h('div', { class: 'zx-agent-thread__footer' }));
    this._redrawAnswerFooter(entry, own);
    this._syncWriting(entry);
  }

  /**
   * While an answer is on its way and nothing of it has arrived, a quiet line says who is
   * writing; it goes as soon as the first words do.
   * @private
   * @param {ThreadEntry} entry
   * @returns {void}
   */
  _syncWriting(entry) {
    const line = /** @type {HTMLElement|null} */ (entry.article.querySelector('.zx-agent-thread__writing'));
    if (!line || !entry.view) return;
    line.hidden = !(/** @type {any} */ (entry.item).streaming && entry.view.toElement().childElementCount === 0);
  }

  /**
   * Draws an answer's sources and actions, which show only once it is finished.
   * @private
   * @param {ThreadEntry} entry
   * @param {<T extends Component>(component: T) => T} [own]
   * @returns {void}
   */
  _redrawAnswerFooter(entry, own) {
    const footer = /** @type {HTMLElement|null} */ (entry.article.querySelector('.zx-agent-thread__footer'));
    if (!footer) return;
    const answer = /** @type {Extract<ThreadItem, {type: 'answer'}>} */ (entry.item);
    const adopt = own ?? (/** @type {<T extends Component>(component: T) => T} */ ((component) => {
      entry.owned.push(component);
      return component;
    }));
    if (entry.sources) {
      entry.owned = entry.owned.filter((component) => component !== entry.sources);
      entry.sources.destroy();
      entry.sources = null;
    }
    footer.replaceChildren();
    if (answer.streaming) return;
    const sources = this._version(answer).sources;
    if (sources.length) {
      const list = adopt(new SourceList(null, { sources, label: this.msg('agentThread.sources'), icons: this.options.sourceIcons ?? {} }));
      list.on('select', (event) => {
        const source = /** @type {CustomEvent<{source: Source}>} */ (event).detail.source;
        if (source?.call) {
          event.preventDefault();
          this.reveal(`step:${source.call}`);
        }
      });
      entry.sources = list;
      footer.append(list.toElement());
    }
    const actions = this._answerActions(entry);
    if (actions) footer.append(actions);
  }

  /**
   * @private
   * @param {ThreadEntry} entry
   * @returns {HTMLElement|null}
   */
  _answerActions(entry) {
    const answer = /** @type {Extract<ThreadItem, {type: 'answer'}>} */ (entry.item);
    const wanted = new Set(Array.isArray(this.options.answerActions) ? this.options.answerActions : []);
    const icons = { ...DEFAULT_ICONS, ...(this.options.icons ?? {}) };
    const id = String(answer.id);
    /** @type {Array<Node>} */
    const controls = [];
    const versions = Array.isArray(answer.versions) ? answer.versions : [];
    if (versions.length > 1) {
      const index = this._versionIndex(answer);
      controls.push(h('span', { class: 'zx-agent-thread__pager' },
        actionButton('chevron-left', this.msg('agentThread.previousVersion'), { action: 'version', value: String(index - 1), dir: 'previous' }, index === 0),
        h('span', { class: 'zx-agent-thread__pager-text' }, `${index + 1} / ${versions.length}`,
          h('span', { class: 'zx-agent-thread__sr' }, ` ${this.msg('agentThread.version', index + 1, versions.length)}`)),
        actionButton('chevron-right', this.msg('agentThread.nextVersion'), { action: 'version', value: String(index + 1), dir: 'next' }, index === versions.length - 1)));
    }
    if (wanted.has('copy')) {
      controls.push(copyButton({ text: () => entry.view?.toMarkdown() ?? '', title: this.msg('agentThread.copy'), size: 'sm' }));
    }
    if (wanted.has('regenerate') && this._latestAnswerId() === id) {
      controls.push(actionButton(icons.regenerate, this.msg('agentThread.regenerate'), { action: 'regenerate' }));
    }
    if (wanted.has('branch')) controls.push(actionButton(icons.branch, this.msg('agentThread.branch'), { action: 'branch' }));
    if (wanted.has('rate')) {
      for (const [value, glyph, key] of [['up', icons.rateUp, 'agentThread.rateUp'], ['down', icons.rateDown, 'agentThread.rateDown']]) {
        const control = actionButton(glyph, this.msg(key), { action: 'rate', value });
        control.setAttribute('aria-pressed', String(this._version(answer).rating === value));
        controls.push(control);
      }
    }
    return controls.length ? h('div', { class: 'zx-agent-thread__actions' }, controls) : null;
  }

  /**
   * @private
   * @param {ThreadEntry} entry
   * @param {HTMLElement} body
   * @param {<T extends Component>(component: T) => T} own
   * @returns {void}
   */
  _buildApproval(entry, body, own) {
    const approval = /** @type {Extract<ThreadItem, {type: 'approval'}>} */ (entry.item);
    const card = own(new ApprovalCard(null, {
      title: approval.title,
      description: approval.description,
      icon: approval.icon ?? null,
      tone: /** @type {any} */ (approval.tone ?? 'blue'),
      status: approval.status ?? 'pending',
      details: approval.details ?? null,
      preview: approval.preview ? { label: approval.preview.label, content: approval.preview.blocks } : null,
      fields: approval.fields ?? null,
      values: approval.values ?? {},
      confirmText: approval.confirmText ?? null,
      reason: approval.reason ?? 'optional',
      edited: Boolean(approval.edited),
      editedKeys: Array.isArray(approval.editedKeys) ? approval.editedKeys : null,
      rejectReason: approval.rejectReason ?? null,
      now: this.options.now ?? null,
      answeredBy: approval.answeredBy ?? null,
      answeredAt: approval.answeredAt ?? null,
      headingLevel: this.options.headingLevel
    }));
    this._contain(card, ['approve', 'edit', 'reject']);
    for (const type of ['approve', 'edit', 'reject']) {
      card.on(type, (event) => {
        const detail = /** @type {CustomEvent<Record<string, any>>} */ (event).detail;
        const emitted = this.emit(type, { item: this.get(String(approval.id)), ...detail });
        if (emitted.defaultPrevented) {
          event.preventDefault();
          return;
        }
        // The item follows the card, so get() and a later redraw keep what was decided.
        const at = (this.options.now?.() ?? new Date()).toISOString();
        // The card keeps which values were edited across saves; the item stores its answer.
        if (type === 'edit') {
          entry.item = /** @type {ThreadItem} */ ({ ...entry.item, values: detail.values, edited: true, editedKeys: detail.editedKeys ?? null });
        }
        else if (type === 'approve') entry.item = /** @type {ThreadItem} */ ({ ...entry.item, status: 'approved', values: detail.values, answeredAt: at });
        else entry.item = /** @type {ThreadItem} */ ({ ...entry.item, status: 'rejected', rejectReason: detail.reason || null, answeredAt: at });
      });
    }
    entry.card = card;
    body.append(card.toElement());
  }

  /**
   * A surface item: the Surface, its reply re-emitted as the thread's `reply` and kept on the item.
   * @private
   * @param {ThreadEntry} entry
   * @param {HTMLElement} body
   * @param {<T extends Component>(component: T) => T} own
   * @param {Surface|null} kept A surface carried over from the item's earlier drawing.
   * @returns {void}
   */
  _buildSurface(entry, body, own, kept) {
    const item = /** @type {SurfaceItem} */ (/** @type {unknown} */ (entry.item));
    const surface = kept ?? new Surface(null, {
      authors: /** @type {any} */ (this.options.authors),
      headingLevel: this.options.headingLevel,
      locale: this.options.locale,
      ...(this.options.surfaceOptions ?? {}),
      document: item.document ?? null,
      token: item.token ?? null,
      reply: item.reply ?? null,
      ...(item.catalog ? { catalog: item.catalog } : {})
    });
    own(surface);
    if (!kept) {
      this._contain(surface, ['reply', 'error', 'change', 'ready', 'end']);
      // A streamed surface says what it is only once it begins.
      if (!item.document) {
        surface.on('ready', () => {
          if (!surface.getReply() && asksForAnswer(surface.toDocument()?.intent)) {
            this._announce(this.msg('agentThread.needsAnswer', this._authorName(item)));
          }
        });
      }
      surface.on('reply', (event) => {
        const { reply } = /** @type {CustomEvent<{reply: SurfaceReply}>} */ (event).detail;
        const current = this._entries.get(String(item.id));
        if (current?.surface === surface) current.item = /** @type {ThreadItem} */ ({ ...current.item, reply });
        this.emit('reply', { item: this.get(String(item.id)) ?? { ...item, reply }, reply });
      });
    }
    entry.surface = surface;
    body.append(surface.toElement());
  }

  /**
   * The author's avatar, beside the byline and the content. Decorative: the byline names them.
   * @private
   * @param {ThreadItem} item
   * @param {<T extends Component>(component: T) => T} own
   * @returns {HTMLElement|null}
   */
  _avatar(item, own) {
    const author = this._author(item);
    if (!author) return null;
    if (author.icon) {
      return h('span', { class: 'zx-agent-thread__avatar' },
        h('span', { class: 'zx-agent-thread__mark', dataset: { tone: author.tone ?? null, kind: author.kind ?? 'agent' }, 'aria-hidden': 'true' },
          icon(String(author.icon), { size: 14 })));
    }
    const avatar = own(new Avatar(null, {
      name: author.name, initials: author.initials ?? initialsOf(author.name), tone: /** @type {any} */ (author.tone ?? null),
      size: 'sm', shape: author.kind === 'person' ? 'circle' : 'rounded', activity: author.activity ?? null
    }));
    return h('span', { class: 'zx-agent-thread__avatar' }, avatar.toElement());
  }

  /**
   * @private
   * @param {ThreadItem} item
   * @param {string} id
   * @returns {HTMLElement}
   */
  _byline(item, id) {
    const author = this._author(item);
    const name = this._authorName(item);
    const shown = item.type === 'answer' ? this._version(/** @type {any} */ (item)) : null;
    const at = shown ? shown.at : item.at;
    const time = this._time(at);
    const byline = h('div', { class: 'zx-agent-thread__byline' });
    byline.append(h('span', { class: 'zx-agent-thread__author', id }, name,
      time ? h('span', { class: 'zx-agent-thread__sr' }, `, ${time}`) : null));
    if (author?.via) byline.append(h('span', { class: 'zx-agent-thread__via' }, this.msg('agentThread.via', author.via)));
    if (time) byline.append(h('time', { class: 'zx-agent-thread__time', dateTime: String(at), 'aria-hidden': 'true' }, time));
    if (shown?.stopped) {
      byline.append(h('span', { class: 'zx-agent-thread__flag' }, this.msg('agentThread.stopped')));
    }
    return byline;
  }

  /**
   * @private
   * @param {Array<{name: string, size?: number}>} files
   * @returns {HTMLElement}
   */
  _files(files) {
    return h('ul', { class: 'zx-agent-thread__files', 'aria-label': this.msg('agentThread.attachments') },
      files.map((file) => h('li', { class: 'zx-agent-thread__file' },
        h('span', { class: 'zx-agent-thread__file-icon', 'aria-hidden': 'true' }, icon('file', { size: 14 })),
        h('span', { class: 'zx-agent-thread__file-name' }, String(file.name ?? '')),
        typeof file.size === 'number' ? h('span', { class: 'zx-agent-thread__file-size' }, formatFileSize(file.size, { decimals: 0, standard: 'si' })) : null)));
  }

  /* ------------------------------------------------------------------ helpers -- */

  /** @private @param {ThreadItem} item @returns {boolean} */
  _isMine(item) {
    return item.author ? item.author === this.options.me : item.type === 'user';
  }

  /** @private @param {ThreadItem} item @returns {Author|null} */
  _author(item) {
    const authors = this.options.authors ?? {};
    if (item.author && Object.hasOwn(authors, item.author)) return authors[item.author];
    if (this._isMine(item)) return Object.hasOwn(authors, this.options.me) ? authors[this.options.me] : null;
    const first = Object.entries(authors).find(([key, author]) => key !== this.options.me && author.kind !== 'person');
    return first ? first[1] : null;
  }

  /** @private @param {ThreadItem} item @returns {string} */
  _authorName(item) {
    if (this._isMine(item)) return this.msg('agentThread.you');
    return this._author(item)?.name ?? this.msg('agentThread.agent');
  }

  /** @private @param {unknown} at @returns {string} */
  _time(at) {
    if (typeof at !== 'string' || !at) return '';
    if (typeof this.options.formatTime === 'function') return String(this.options.formatTime(at) ?? '');
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(this.options.locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  }

  /** @private @param {Extract<ThreadItem, {type: 'answer'}>} answer @returns {number} */
  _versionIndex(answer) {
    const versions = Array.isArray(answer.versions) ? answer.versions : [];
    const index = Number.isInteger(answer.version) ? Number(answer.version) : versions.length - 1;
    return Math.max(0, Math.min(versions.length - 1, index));
  }

  /**
   * The blocks, sources, and steps an answer shows: its chosen version's when it has several.
   * @private
   * @param {Extract<ThreadItem, {type: 'answer'}>} answer
   * @returns {{blocks: Block[], sources: Source[], steps: import('../../internal/agent-model.js').TraceStep[],
   *   stopped: boolean, rating: 'up'|'down'|null, at: string|undefined}}
   */
  _version(answer) {
    const versions = Array.isArray(answer.versions) ? answer.versions : [];
    const version = versions.length > 1 ? versions[this._versionIndex(answer)] : null;
    if (version) {
      return {
        blocks: version.blocks ?? [], sources: version.sources ?? [], steps: version.steps ?? answer.steps ?? [],
        stopped: version.stopped ?? Boolean(answer.stopped), rating: version.rating !== undefined ? version.rating : answer.rating ?? null,
        at: version.at ?? answer.at
      };
    }
    return {
      blocks: answer.blocks ?? [], sources: answer.sources ?? [], steps: answer.steps ?? [],
      stopped: Boolean(answer.stopped), rating: answer.rating ?? null, at: answer.at
    };
  }

  /**
   * A consecutive item by the same author reads as one turn: its byline is still there for a
   * screen reader, but not drawn again.
   * @private
   * @param {string} id
   * @returns {void}
   */
  _syncContinuation(id) {
    const index = this._order.indexOf(id);
    for (const at of [index, index + 1]) {
      const entry = this._entries.get(this._order[at]);
      const previous = this._entries.get(this._order[at - 1]);
      if (!entry) continue;
      // A notice belongs to no one, so it ends a turn on either side of it.
      const same = Boolean(previous) && !this._isMine(entry.item) && !this._isMine(/** @type {ThreadEntry} */ (previous).item)
        && entry.item.type !== 'notice' && /** @type {ThreadEntry} */ (previous).item.type !== 'notice'
        && this._authorName(entry.item) === this._authorName(/** @type {ThreadEntry} */ (previous).item);
      if (same) entry.article.dataset.continued = 'true';
      else delete entry.article.dataset.continued;
    }
  }

  /** @private @returns {void} */
  _syncPositions() {
    const size = String(this._order.length);
    this._order.forEach((id, index) => {
      const article = this._entries.get(id)?.article;
      if (!article) return;
      article.setAttribute('aria-posinset', String(index + 1));
      article.setAttribute('aria-setsize', size);
    });
    const streaming = this._order.some((id) => {
      const item = this._entries.get(id)?.item;
      return item?.type === 'answer' && Boolean(/** @type {any} */ (item).streaming);
    });
    this._feed.setAttribute('aria-busy', String(streaming));
  }

  /** @private @returns {void} */
  _syncEmpty() {
    const empty = this._order.length === 0 && this.options.emptyState;
    this._empty.hidden = !empty;
    if (empty && !this._empty.firstChild) this._empty.append(emptyState(/** @type {EmptyStateOptions} */ (this.options.emptyState)));
    if (!empty) this._empty.replaceChildren();
  }

  /** @private @param {ThreadItem} item @returns {void} */
  _announceItem(item) {
    const name = this._authorName(item);
    if (item.type === 'answer') {
      this._announce(this.msg(/** @type {any} */ (item).streaming ? 'agentThread.writing' : 'agentThread.answered', name));
    } else if (item.type === 'approval' && (/** @type {any} */ (item).status ?? 'pending') === 'pending') {
      this._announce(this.msg('agentThread.needsApproval', name));
    } else if (item.type === 'surface' && !AgentThread.#renderers.has('surface') && asksForAnswer(/** @type {any} */ (item).document?.intent) && !(/** @type {any} */ (item).reply)) {
      this._announce(this.msg('agentThread.needsAnswer', name));
    } else if (item.type === 'trace') {
      this._announce(this.msg('agentThread.working', name));
    } else if (item.type === 'notice' && ['warning', 'danger'].includes(String(/** @type {any} */ (item).tone))) {
      this._announce(String(/** @type {any} */ (item).text ?? ''));
    }
  }

  /**
   * Says a milestone once. The region is cleared first so the same words said twice are heard
   * twice.
   * @private
   * @param {string} text
   * @returns {void}
   */
  _announce(text) {
    clearTimeout(this._announceTimer);
    this._status.textContent = '';
    this._announceTimer = window.setTimeout(() => {
      this._status.textContent = text;
    }, 60);
  }

  /** @private @returns {Element|null} */
  _scroller() {
    if (this.options.scroller) return this.options.scroller;
    if (this._scrollHost?.isConnected) return this._scrollHost;
    /** @type {Element|null} */
    let node = this.el;
    while (node && node !== document.documentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      node = node.parentElement;
    }
    this._scrollHost = node ?? document.scrollingElement;
    if (this._scrollHost) {
      const host = this._scrollHost === document.documentElement ? window : this._scrollHost;
      this.listen(host, 'scroll', () => {
        if (this._atEnd()) this._latestButton.hidden = true;
      }, { passive: true });
    }
    return this._scrollHost;
  }

  /** @private @returns {boolean} */
  _atEnd() {
    const scroller = this._scroller();
    if (!scroller) return true;
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= END_SLACK;
  }

  /**
   * Runs a change and keeps the end in view if the reader was reading it.
   * @private
   * @param {() => void} change
   * @returns {void}
   */
  _follow(change) {
    const follow = this.options.followOutput && this.el.isConnected && this._atEnd();
    change();
    if (!this.options.followOutput || !this.el.isConnected) return;
    if (follow) this.scrollToEnd();
    else if (!this._atEnd()) this._latestButton.hidden = false;
  }

  /** @private @returns {HTMLElement|null} */
  _lastArticle() {
    const id = this._order.at(-1);
    return id ? this._entries.get(id)?.article ?? null : null;
  }

  /* ------------------------------------------------------------------ events -- */

  /** @private @param {MouseEvent} event @returns {void} */
  _onClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-thread-action]') : null;
    if (!target || !this.el.contains(target)) return;
    const article = target.closest('.zx-agent-thread__item');
    const id = article instanceof HTMLElement ? article.dataset.id : null;
    const entry = id ? this._entries.get(id) : null;
    if (!entry) return;
    const action = String(/** @type {HTMLElement} */ (target).dataset.threadAction);
    const raw = /** @type {HTMLElement} */ (target).dataset.threadValue;
    if (action === 'version') {
      const value = Number(raw);
      const dir = /** @type {HTMLElement} */ (target).dataset.threadDir;
      const emitted = this.emit('action', { item: this.get(String(id)), action, value });
      if (!emitted.defaultPrevented) {
        this._replace(String(id), /** @type {ThreadItem} */ ({ ...entry.item, version: value }));
        // Paging keeps focus on the pager: the same arrow, or the other one at either end.
        const pager = this._entries.get(String(id))?.article.querySelectorAll('[data-thread-action="version"]');
        const buttons = /** @type {HTMLButtonElement[]} */ ([...(pager ?? [])]);
        const same = buttons.find((button) => button.dataset.threadDir === dir && !button.disabled);
        (same ?? buttons.find((button) => !button.disabled))?.focus();
      }
      return;
    }
    if (action === 'open') {
      const ref = (/** @type {any} */ (entry.item).refs ?? []).find((/** @type {any} */ candidate) => String(candidate?.id) === raw);
      if (ref) this.emit('open', { item: this.get(String(id)), ref: { ...ref } });
      return;
    }
    if (action === 'notice') {
      this.emit('action', { item: this.get(String(id)), action: String(raw) });
      return;
    }
    if (action === 'rate') {
      const answer = /** @type {Extract<ThreadItem, {type: 'answer'}>} */ (entry.item);
      const current = this._version(answer).rating;
      const value = current === raw ? null : raw;
      const emitted = this.emit('action', { item: this.get(String(id)), action, value });
      if (!emitted.defaultPrevented) {
        // With versions, a rating belongs to the version shown.
        const versions = Array.isArray(answer.versions) && answer.versions.length > 1
          ? answer.versions.map((version, index) => (index === this._versionIndex(answer) ? { ...version, rating: /** @type {any} */ (value) } : version))
          : answer.versions;
        entry.item = /** @type {ThreadItem} */ ({ ...entry.item, rating: value, versions });
        for (const control of entry.article.querySelectorAll('[data-thread-action="rate"]')) {
          control.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (control).dataset.threadValue === value));
        }
      }
      return;
    }
    this.emit('action', { item: this.get(String(id)), action });
  }

  /**
   * APG feed keys: PageDown and PageUp move between articles; Ctrl+End and Ctrl+Home move focus
   * past the end or before the start of the feed.
   * @private
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  _onFeedKey(event) {
    const article = event.target instanceof Element ? event.target.closest('.zx-agent-thread__item') : null;
    if (!(article instanceof HTMLElement)) return;
    const articles = this._order.map((id) => this._entries.get(id)?.article).filter(Boolean);
    const index = articles.indexOf(article);
    if (event.key === 'PageDown' || event.key === 'PageUp') {
      const next = articles[index + (event.key === 'PageDown' ? 1 : -1)];
      if (next) {
        event.preventDefault();
        next.focus();
      }
    } else if ((event.ctrlKey || event.metaKey) && (event.key === 'End' || event.key === 'Home')) {
      const outside = focusableOutside(this._feed, event.key === 'End' ? 1 : -1);
      if (outside) {
        event.preventDefault();
        outside.focus();
      }
    }
  }
}

/** Item types the thread draws itself. */
const BUILT_IN = new Set(['user', 'text', 'answer', 'trace', 'approval', 'notice', 'zx-placeholder']);

/**
 * Whether a surface of this intent waits for the person's answer.
 * @param {unknown} intent
 * @returns {boolean}
 */
function asksForAnswer(intent) {
  return typeof intent === 'string' && intent !== 'show';
}

/**
 * Copies an item. Only a surface keeps its `catalog` by reference: a catalog is the library's own
 * frozen object, and a copy of it is refused.
 * @template {Record<string, any>} T
 * @param {T} item
 * @returns {T}
 */
function cloneItem(item) {
  if (item?.type !== 'surface' || !('catalog' in item)) return structuredClone(item);
  const { catalog, ...rest } = item;
  return /** @type {T} */ (/** @type {unknown} */ ({ ...structuredClone(rest), catalog }));
}

/**
 * Whether a redrawn surface item still describes the surface already drawn: same token and
 * catalog, and no other document.
 * @param {ThreadEntry} old
 * @param {SurfaceItem} item
 * @returns {boolean}
 */
function keepsSurface(old, item) {
  const before = /** @type {SurfaceItem} */ (/** @type {unknown} */ (old.item));
  if ((item.token ?? null) !== (before.token ?? null) || (item.catalog ?? null) !== (before.catalog ?? null)) return false;
  if (item.document == null) return true;
  // The document the item was drawn from, or the one the surface now stands as — what `get()`
  // hands back — both describe the surface already drawn.
  const given = JSON.stringify(item.document);
  if (given === JSON.stringify(before.document ?? null)) return true;
  const drawn = old.surface?.toDocument();
  return Boolean(drawn) && given === JSON.stringify(drawn);
}

/**
 * An icon button the thread's delegated click listener acts on.
 * @param {string} glyph
 * @param {string} label
 * @param {{action: string, value?: string, dir?: string}} data
 * @param {boolean} [disabled]
 * @returns {HTMLButtonElement}
 */
function actionButton(glyph, label, data, disabled = false) {
  return /** @type {HTMLButtonElement} */ (h('button', {
    type: 'button', class: 'zx-icon-btn zx-agent-thread__action', title: label, 'aria-label': label, disabled,
    dataset: { size: 'sm', threadAction: data.action, threadValue: data.value ?? null, threadDir: data.dir ?? null }
  }, icon(glyph, { size: 14 })));
}

/**
 * The person's text with each `@name` it mentions marked, as text nodes and spans.
 * @param {string} text
 * @param {unknown} mentions Names without the `@`, or `{name, tone}` to colour a name in its tone.
 * @returns {Array<Node|string>}
 */
function withMentions(text, mentions) {
  /** @type {Map<string, string|null>} Each mentioned name and its tone. */
  const tones = new Map();
  for (const mention of Array.isArray(mentions) ? mentions : []) {
    const name = String(typeof mention === 'object' && mention ? mention.name ?? '' : mention ?? '').trim();
    if (name) tones.set(name, typeof mention === 'object' && mention?.tone ? String(mention.tone) : null);
  }
  const names = [...tones.keys()];
  if (!names.length) return [text];
  const escaped = names.sort((a, b) => b.length - a.length).map((name) => escapeRegExp(name));
  const pattern = new RegExp(`@(?:${escaped.join('|')})(?![\\w])`, 'g');
  /** @type {Array<Node|string>} */
  const out = [];
  let from = 0;
  for (const match of text.matchAll(pattern)) {
    const at = Number(match.index);
    if (at > from) out.push(text.slice(from, at));
    out.push(h('span', { class: 'zx-agent-thread__mention', dataset: { tone: tones.get(match[0].slice(1)) ?? null } }, match[0]));
    from = at + match[0].length;
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}

/** Elements that take focus from the keyboard. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * The first focusable element after (`1`) or before (`-1`) an element in document order.
 * @param {Element} element
 * @param {1|-1} direction
 * @returns {HTMLElement|null}
 */
function focusableOutside(element, direction) {
  const all = /** @type {HTMLElement[]} */ ([...document.querySelectorAll(FOCUSABLE)])
    .filter((candidate) => !element.contains(candidate) && candidate.getClientRects().length > 0);
  const position = (/** @type {HTMLElement} */ candidate) => element.compareDocumentPosition(candidate);
  if (direction === 1) return all.find((candidate) => position(candidate) & Node.DOCUMENT_POSITION_FOLLOWING) ?? null;
  return all.reverse().find((candidate) => position(candidate) & Node.DOCUMENT_POSITION_PRECEDING) ?? null;
}

/**
 * Action payload: under an answer `copy`, `regenerate`, `branch`, `rate` (`value` up, down, or
 * null), or `version` (`value` the version index; preventable, like `rate`); on the person's own
 * message `edit` (copying needs no event); on a notice, the id of its `action`.
 * @event AgentThread#action
 * @type {CustomEvent<{item: ThreadItem, action: string, value?: unknown}>}
 */
/**
 * An approval was approved; preventable, which keeps the card pending.
 * @event AgentThread#approve
 * @type {CustomEvent<{item: ThreadItem, values: Record<string, unknown>}>}
 */
/**
 * An approval's values were edited; preventable.
 * @event AgentThread#edit
 * @type {CustomEvent<{item: ThreadItem, values: Record<string, unknown>}>}
 */
/**
 * An approval was rejected; preventable, which keeps the card pending.
 * @event AgentThread#reject
 * @type {CustomEvent<{item: ThreadItem, reason: string}>}
 */
/**
 * A citation was activated; preventable, which skips highlighting the source.
 * @event AgentThread#cite
 * @type {CustomEvent<{item: ThreadItem, n: number, source: Source|null}>}
 */
/**
 * An artifact card was activated.
 * @event AgentThread#artifact
 * @type {CustomEvent<{item: ThreadItem, id: string}>}
 */
/**
 * Something was brought into view by `reveal()`.
 * @event AgentThread#reveal
 * @type {CustomEvent<{target: string}>}
 */
/**
 * A link was activated: one of an item's `refs`, or of a trace step's (then `step` names it).
 * @event AgentThread#open
 * @type {CustomEvent<{item: ThreadItem, ref: import('../../internal/agent-model.js').ItemRef, step?: import('../../internal/agent-model.js').TraceStep}>}
 */
/**
 * A surface in the thread replied: its one reply, with the item as it now stands. Also sent when
 * an unanswered surface is superseded by a new one under the same id, removed, or destroyed with
 * the thread.
 * @event AgentThread#reply
 * @type {CustomEvent<{item: ThreadItem, reply: SurfaceReply}>}
 */
