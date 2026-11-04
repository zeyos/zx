// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, safeHref, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';
import { removePointer, setPointer } from '../../internal/json-patch.js';
import { isEmptyAnswer } from '../questionnaire/conditions.js';
import { badge } from '../badge/badge.js';
import { renderBlocks } from '../block-view/block-view.js';
import { button } from '../button/button.js';
import { Chart } from '../chart/chart.js';
import { registerChecklistFieldAdapter } from '../checklist/field-adapter.js';
import { registerDateboxFieldAdapters } from '../datebox/field-adapter.js';
import { Dialog } from '../dialog/dialog.js';
import { emptyState } from '../empty-state/empty-state.js';
import { EntityRef } from '../entity-ref/entity-ref.js';
import { Fieldset } from '../fieldset/fieldset.js';
import { Groupbox } from '../groupbox/groupbox.js';
import { grid, stack } from '../layout/layout.js';
import { registerNumberFieldAdapter } from '../number-field/field-adapter.js';
import { Questionnaire, ruleText } from '../questionnaire/questionnaire.js';
import { registerRatingFieldAdapter } from '../rating/field-adapter.js';
import { registerSelectFieldAdapter } from '../select/field-adapter.js';
import { Sheet } from '../sheet/sheet.js';
import { skeletonText } from '../skeleton/skeleton.js';
import { registerSliderFieldAdapter } from '../slider/field-adapter.js';
import { StatTile } from '../stat-tile/stat-tile.js';
import { Table } from '../table/table.js';
import { registerTagPickerFieldAdapter } from '../tag-picker/field-adapter.js';
import { registerToggleFieldAdapter } from '../toggle/field-adapter.js';
import { assertCatalog, CATALOG, ID_PATTERN, LIMITS, REPLY_VERSION, SURFACE_VERSION } from './catalog.js';
import { checkValue, schemaToFields, toJsonValue } from './schema.js';
import { lineSplitter } from './stream.js';
import {
  CLOSING_ACTIONS, createReply, inputNames, localDateTime, readProp, surfaceVisibility, verdictText
} from './text.js';
import { createValidationState, validateDocument, validateOp, validateValue } from './validate.js';

/** @typedef {import('./catalog.js').SurfaceCatalog} SurfaceCatalog */
/** @typedef {import('./catalog.js').SurfaceIntent} SurfaceIntent */
/** @typedef {import('./catalog.js').SurfacePlacement} SurfacePlacement */
/** @typedef {import('./validate.js').SurfaceDocument} SurfaceDocument */
/** @typedef {import('./validate.js').SurfaceNode} SurfaceNode */
/** @typedef {import('./validate.js').SurfaceOp} SurfaceOp */
/** @typedef {import('./validate.js').SurfaceAction} SurfaceAction */
/** @typedef {import('./validate.js').SurfaceError} SurfaceError */
/** @typedef {import('./validate.js').SurfaceSource} SurfaceSource */
/** @typedef {import('./text.js').SurfaceReply} SurfaceReply */
/** @typedef {import('./text.js').ReplyReason} ReplyReason */
/** @typedef {import('../chart/chart.js').ChartAdapter} ChartAdapter */
/** @typedef {import('../entity-ref/entity-ref.js').EntityRefOptions} EntityRefOptions */

/**
 * How an action must be confirmed before it replies: not at all, by a click in a confirmation
 * dialog, by typing a text, or not at all because it is removed.
 * @typedef {'allow'|'confirm'|'type-to-confirm'|'deny'} PolicyLevel
 */

/**
 * What a policy returns: a level, or a level with the text to type and the dialog's message.
 * @typedef {PolicyLevel|{level: PolicyLevel, confirmText?: string, message?: string}} PolicyDecision
 */

/**
 * The application's say over each action. It receives a copy of the action — its `id`, `label`,
 * `kind`, `tool` and `description` — and the surface as it stands, and decides what the action
 * needs. It is asked for every action except the built-in Cancel, which only closes. Anything it
 * returns that is not a decision counts as `confirm`; a policy that throws denies the action.
 * @typedef {(action: SurfaceAction, surface: SurfaceDocument) => PolicyDecision} SurfacePolicy
 */

/**
 * How the application resolves what a surface may only name.
 * @typedef {Object} SurfaceResolve
 * @property {(ref: {$ref: string, id: string}) => EntityRefOptions|null|undefined} [ref] A record
 *   to the options of the EntityRef that draws it; `null` draws its id as text.
 * @property {(href: string, context: {text: string}) => string|boolean|null|undefined} [link] A
 *   link's address to the address to open: `false` or `null` refuses it, and the text is shown
 *   without a link; `true` or nothing keeps it.
 * @property {(asset: {$asset: string}) => string|null} [asset] An asset name to an image address
 *   the application serves. No node of the current catalog shows one; reserved.
 * @property {Iterable<string>|null} [entities] The record entities `{"$ref": …}` may name; without
 *   them every record is refused.
 */

/**
 * @typedef {Object} SurfaceOptions
 * @property {SurfaceDocument|Record<string, unknown>|null} [document=null] A whole surface, as the
 *   `show_surface` and `ask_user` tools take it. Leave it out to stream with `apply()` or `write()`.
 * @property {SurfacePolicy|null} [policy=null] What each action needs before it replies; every
 *   action is allowed when null. Nothing in a surface can lower what it decides.
 * @property {SurfaceResolve} [resolve={}] How records, links and assets are resolved.
 * @property {Record<string, {name: string}>} [authors={}] Who may compose a surface, by the key
 *   its `author` names; the byline shows the name, or the key when it is not listed.
 * @property {boolean} [userInitiated=false] Whether the surface answers the person's latest
 *   message; only then may `openSurface()` honour a request for a sheet or a dialog.
 * @property {2|3|4|5} [headingLevel=3] The element level of the surface's title; its `heading`
 *   nodes go one and two deeper.
 * @property {string} [locale] Locale for numbers and times.
 * @property {SurfaceCatalog} [catalog=CATALOG] A catalog narrowed with `narrowCatalog()`; the full
 *   one by default. What lies outside it is refused as unknown.
 * @property {string|null} [token=null] The application's opaque string, at most 512 characters,
 *   copied unchanged into every reply. A surface cannot set it.
 * @property {SurfaceReply|null} [reply=null] A reply the surface already gave, for a surface
 *   restored from a stored conversation: it starts as its receipt and replies no more.
 * @property {string|null} [labelledBy=null] The id of an element that already shows the title,
 *   such as a Dialog's; the surface then draws no title of its own and is labelled by it.
 * @property {ChartAdapter|null} [chartAdapter=null] The engine that draws `chart` nodes; without
 *   one a chart shows its data table.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{reply: SurfaceReply}>) => void} [onreply] Reply listener.
 * @property {(event: CustomEvent<{errors: SurfaceError[]}>) => void} [onerror] Error listener.
 * @property {(event: CustomEvent<{name: string, value: unknown}>) => void} [onchange] Input listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onready] First-render listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onend] End-of-surface listener.
 */

/**
 * @typedef {Object} SurfaceModel
 * @property {boolean} began
 * @property {boolean} ended
 * @property {string} surface
 * @property {SurfaceIntent|null} intent
 * @property {string} [title]
 * @property {string} [author]
 * @property {SurfacePlacement} [placement]
 * @property {string} [description]
 * @property {string[]} root
 * @property {Map<string, SurfaceNode>} nodes
 * @property {Map<string, number>} order
 * @property {Record<string, unknown>} data
 * @property {SurfaceAction[]|null} actions
 * @property {SurfaceSource[]|null} sources
 */

/**
 * @typedef {Object} NodeView
 * @property {HTMLElement} el
 * @property {Component[]} owned
 * @property {'node'|'placeholder'|'fallback'|'receipt'} kind
 * @property {HTMLElement|null} [container] Where a layout node's children go.
 * @property {Fieldset} [fieldset]
 * @property {Record<string, any>} [schema]
 * @property {Table} [table]
 * @property {string} [rowId]
 * @property {Questionnaire} [questionnaire]
 * @property {HTMLFieldSetElement} [choice]
 * @property {HTMLElement} [choiceError]
 */

/** @typedef {SurfaceAction & {builtin?: boolean}} DrawnAction */

const ASKING_INTENTS = new Set(['ask', 'choose', 'review']);
const CANCEL_INTENTS = new Set(['ask', 'choose', 'confirm']);
const VALUELESS = new Set(['reject', 'cancel', 'dismiss']);
const LEVELS = new Set(['allow', 'confirm', 'type-to-confirm', 'deny']);
const BLOCK_TYPES = new Set(['text', 'heading', 'list', 'quote', 'code', 'callout', 'figures']);
const GAPS = Object.freeze({ sm: 2, md: 4, lg: 6 });
const MAX_TOKEN = 512;
const SURFACE_ID = new RegExp(ID_PATTERN);
/** The defaults that answer: they check the inputs and send their values. */
const ANSWERING = new Set(['submit', 'confirm', 'approve']);

/**
 * A surface an agent composed as JSON — a rich answer, or a dialog asking the person something —
 * drawn with the library's own components from validated values only. It arrives whole as a
 * `document`, or as operation lines through `apply()` and `write()`, drawing what it has as it
 * arrives: a child that has not arrived is a skeleton line, and every action but Cancel waits for
 * the surface's `end`.
 *
 * Every surface ends in exactly one `reply`: an action, Submit, Cancel, Escape, being superseded
 * and being destroyed unanswered all reply, and a second answer is ignored. Answered, it freezes
 * into a read-only receipt (`data-state="answered"`). Whether an action needs a confirmation is
 * the application's `policy`, never the surface's. An input surface is a `<form>` labelled by its
 * title; any other is a labelled region.
 *
 * @fires Surface#reply
 * @fires Surface#error
 * @fires Surface#change
 * @fires Surface#ready
 * @fires Surface#end
 * @extends {Component<SurfaceOptions>}
 */
export class Surface extends Component {
  static cssName = 'surface';

  /** @type {Readonly<SurfaceOptions>} */
  static defaults = {
    document: null,
    policy: null,
    resolve: {},
    authors: {},
    userInitiated: false,
    headingLevel: 3,
    catalog: CATALOG,
    token: null,
    reply: null,
    labelledBy: null,
    chartAdapter: null
  };

  /** @returns {HTMLElement} */
  render() {
    const token = this.options.token ?? null;
    if (token !== null && (typeof token !== 'string' || token.length > MAX_TOKEN)) {
      throw new TypeError(`A surface token is a string of at most ${MAX_TOKEN} characters`);
    }
    assertCatalog(this.options.catalog);
    registerFields();
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('section'));
    this.el = root;
    this._original = created ? null : snapshotTarget(root);
    if (!created) root.replaceChildren();
    this._token = token;
    this._catalog = /** @type {SurfaceCatalog} */ (this.options.catalog);
    this._uid = uid('zx-surface');
    const resolve = this.options.resolve ?? {};
    this._entities = resolve.entities == null ? null : [...resolve.entities].filter((entity) => typeof entity === 'string');
    this._state = createValidationState({ entities: this._entities });
    /** @type {SurfaceModel} */
    this._model = {
      began: false, ended: false, surface: '', intent: null, root: [], nodes: new Map(), order: new Map(),
      data: {}, actions: null, sources: null
    };
    /** @type {SurfaceError[]} */
    this._errors = [];
    this._reported = new Set();
    /** @type {Map<string, NodeView>} */
    this._views = new Map();
    /** @type {Set<string>} */
    this._dirty = new Set();
    /** @type {Record<string, unknown>} Raw input values by name, kept while an input is hidden. */
    this._raw = {};
    /** @type {Record<string, string>} JSON of the last reported value of each input. */
    this._reportedValues = {};
    /** @type {import('./text.js').SurfaceVisibility|null} */
    this._visibility = null;
    /** @type {SurfaceReply|null} */
    this._reply = null;
    /** @type {DrawnAction[]} */
    this._actions = [];
    /** @type {Map<string, {level: PolicyLevel, confirmText?: string, message?: string}>} */
    this._decisions = new Map();
    /** @type {string[]} */
    this._removed = [];
    this._actionsDirty = true;
    this._busy = false;
    /** @type {Dialog|null} */
    this._confirm = null;
    this._ready = false;
    this._destroyed = false;
    /** @type {ReturnType<typeof lineSplitter>|null} */
    this._splitter = null;
    this._documentMode = false;
    /** @type {HTMLElement|null} */
    this._frame = null;
    /** @type {HTMLElement|null} */
    this._body = null;
    /** @type {HTMLElement|null} */
    this._actionsEl = null;
    /** @type {HTMLElement|null} */
    this._verdict = null;
    this._frozen = false;
    this._endEmitted = false;
    /** @type {string|null} The surface id an operation or the document named, before any began. */
    this._named = null;

    root.setAttribute('aria-busy', 'true');
    this._waiting = skeletonText({ lines: 2 });
    root.append(this._waiting);

    this.listen(root, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(root, 'input', () => this._inputChanged());
    this.listen(root, 'change', () => this._inputChanged());
    // Inner components announce their own edits; the surface reports one `change` per input.
    this.listen(root, 'zx-change', (event) => {
      if (event.target === root) return;
      event.stopPropagation();
      this._inputChanged();
    });
    this.listen(root, 'zx-submit', (event) => {
      if (event.target !== root) event.stopPropagation();
    });

    const document = this.options.document;
    if (document != null) this._load(document);
    return root;
  }

  /* ------------------------------------------------------------------ public API -- */

  /**
   * Applies one operation, as parsed from its line. It is validated against the catalog first:
   * what is invalid is dropped and reported through `error`, and only the valid rest is drawn.
   * Operations for another surface, and any after the surface was answered, are ignored.
   * @param {unknown} op
   * @returns {this}
   * @fires Surface#error
   */
  apply(op) {
    if (this._reply || this._destroyed) return this;
    if (this._documentMode || this._model.ended) {
      this._report([{ code: 'ended', message: 'The surface has ended', surface: this._model.surface || undefined }]);
      return this;
    }
    const surface = op && typeof op === 'object' ? /** @type {Record<string, unknown>} */ (op).surface : undefined;
    if (this._model.began && surface !== this._model.surface) {
      this._report([{
        code: 'not-allowed',
        message: `This surface is "${this._model.surface}"; an operation for ${JSON.stringify(surface ?? null)} was refused`,
        path: '/surface'
      }]);
      return this;
    }
    if (!this._model.began && !this._named && typeof surface === 'string' && SURFACE_ID.test(surface)) this._named = surface;
    const result = validateOp(op, this._state, this._catalog);
    for (const valid of result.ops) this._applyValid(valid);
    this._draw();
    this._report(result.errors);
    return this;
  }

  /**
   * Takes a chunk of operation lines, as streamed: every complete line is parsed and applied.
   * @param {string} chunk
   * @returns {this}
   * @fires Surface#error
   */
  write(chunk) {
    this._lines().write(String(chunk ?? ''));
    return this;
  }

  /**
   * Ends the stream: applies a last line without a line break. A surface whose `end` never
   * arrived is reported and keeps its actions disabled; Cancel still replies.
   * @returns {this}
   * @fires Surface#error
   */
  end() {
    this._lines().end();
    if (this._model.began && !this._model.ended && !this._reply && !this._documentMode) {
      this._report([{
        code: 'missing', surface: this._model.surface, path: '/op',
        message: 'The stream ended before the surface\'s "end"; its actions stay disabled'
      }]);
    }
    return this;
  }

  /**
   * The values of the visible inputs by name, as a reply would carry them: JSON, hidden inputs
   * left out. A questionnaire's are `{answers, path}`.
   * @returns {Record<string, unknown>}
   */
  getValues() {
    if (this._reply) return structuredClone(this._reply.values);
    if (this._model.intent === 'questionnaire') {
      const view = this._questionnaireView();
      return view?.questionnaire ? { answers: view.questionnaire.getAnswers(), path: view.questionnaire.getPath() } : {};
    }
    const values = this._jsonValues();
    const visibility = this._visibilityFor(values);
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const name of visibility.names) if (Object.hasOwn(values, name)) out[name] = values[name];
    return out;
  }

  /**
   * Every problem collected so far, in a shape an application can return to the model.
   * @returns {SurfaceError[]}
   */
  getErrors() {
    return structuredClone(this._errors);
  }

  /**
   * Closes the surface unanswered: replies `cancel` (`dismiss` for a `show` surface).
   * @param {ReplyReason} [reason='cancelled'] Why, carried in the reply's `reason`.
   * @returns {this}
   * @fires Surface#reply
   */
  cancel(reason = 'cancelled') {
    this._close(this._model.intent === 'show' ? 'dismiss' : 'cancel', reason || 'cancelled');
    return this;
  }

  /**
   * Ends the surface because a newer one takes its place: replies `dismiss` with the reason
   * `superseded`.
   * @returns {this}
   * @fires Surface#reply
   */
  supersede() {
    this._close('dismiss', 'superseded');
    return this;
  }

  /**
   * Moves focus to the first control: the first input, else the first enabled action.
   * @returns {this}
   */
  focus() {
    const body = this._body;
    const selector = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="grid"][tabindex], button:not([disabled]), [tabindex="0"]';
    const visible = (/** @type {Element} */ element) => !element.closest('[hidden]') && /** @type {HTMLElement} */ (element).getClientRects().length > 0;
    const first = [...(body?.querySelectorAll(selector) ?? [])].find(visible)
      ?? [...(this._actionsEl?.querySelectorAll('button:not([disabled])') ?? [])].find(visible)
      ?? null;
    if (first) /** @type {HTMLElement} */ (first).focus();
    else /** @type {HTMLElement} */ (this._verdict ?? this.el).focus?.();
    return this;
  }

  /**
   * The surface as it stands, as a document: what was validated, repairs applied and invalid
   * parts dropped. `null` before it began.
   * @returns {SurfaceDocument|null}
   */
  toDocument() {
    const model = this._model;
    if (!model.began) return null;
    /** @type {Record<string, unknown>} */
    const out = { zx: SURFACE_VERSION, surface: model.surface, intent: model.intent };
    if (model.title !== undefined) out.title = model.title;
    if (model.author !== undefined) out.author = model.author;
    out.root = [...model.root];
    if (model.placement !== undefined) out.placement = model.placement;
    if (model.description !== undefined) out.description = model.description;
    out.nodes = [...model.nodes.values()]
      .sort((a, b) => (model.order.get(a.id) ?? 0) - (model.order.get(b.id) ?? 0))
      .map((node) => structuredClone(node));
    if (Object.keys(model.data).length) out.data = structuredClone(model.data);
    if (model.actions) out.actions = structuredClone(model.actions);
    if (model.sources) out.sources = structuredClone(model.sources);
    return /** @type {SurfaceDocument} */ (out);
  }

  /**
   * The reply the surface gave, or `null` while it waits.
   * @returns {SurfaceReply|null}
   */
  getReply() {
    return this._reply ? structuredClone(this._reply) : null;
  }

  /**
   * Destroys the surface. An unanswered surface replies `dismiss` first, with the reason
   * `destroyed`, so a waiting agent never hangs.
   * @returns {void}
   * @fires Surface#reply
   */
  destroy() {
    if (this._destroyed) return;
    this._close('dismiss', 'destroyed');
    this._destroyed = true;
    this._confirm?.close(false);
    this._confirm = null;
    for (const view of this._views.values()) for (const component of view.owned) component.destroy();
    this._views.clear();
    super.destroy();
    if (this._original) restoreTarget(this.el, this._original);
  }

  /* ------------------------------------------------------------------ model -- */

  /** @private @returns {ReturnType<typeof lineSplitter>} */
  _lines() {
    if (!this._splitter) {
      this._splitter = lineSplitter((line) => {
        if (!line.trim()) return;
        let op;
        try {
          op = JSON.parse(line);
        } catch {
          this._report([{ code: 'invalid-op', message: 'A line is not complete JSON; it was dropped' }]);
          return;
        }
        this.apply(op);
      }, {
        onerror: (error) => this._report([{ code: 'limit', message: error.message }])
      });
    }
    return this._splitter;
  }

  /**
   * Draws a whole document.
   * @private
   * @param {unknown} document
   * @returns {void}
   */
  _load(document) {
    const { document: valid, errors } = validateDocument(document, this._catalog, { entities: this._entities });
    this._documentMode = true;
    const named = document && typeof document === 'object' ? /** @type {Record<string, unknown>} */ (document).surface : undefined;
    if (typeof named === 'string' && SURFACE_ID.test(named)) this._named = named;
    if (valid) {
      const { nodes, data, actions, sources, ...begin } = valid;
      this._applyValid(/** @type {SurfaceOp} */ ({ ...begin, op: 'begin' }));
      if (data) this._model.data = structuredClone(data);
      for (const node of nodes) this._applyValid(/** @type {SurfaceOp} */ ({ op: 'node', surface: valid.surface, ...node }));
      if (actions) this._applyValid(/** @type {SurfaceOp} */ ({ op: 'actions', surface: valid.surface, items: actions }));
      this._applyValid(/** @type {SurfaceOp} */ ({ op: 'end', surface: valid.surface, ...(sources ? { sources } : {}) }));
    }
    const given = this.options.reply;
    if (valid && given && typeof given === 'object' && given.surface === valid.surface) {
      this._reply = structuredClone(given);
    }
    this._draw();
    this._report(errors);
  }

  /**
   * Records one validated operation in the model.
   * @private
   * @param {SurfaceOp} op
   * @returns {void}
   */
  _applyValid(op) {
    const model = this._model;
    switch (op.op) {
      case 'begin':
        model.began = true;
        model.surface = op.surface;
        model.intent = op.intent ?? null;
        model.root = [...op.root];
        for (const key of /** @type {const} */ (['title', 'author', 'placement', 'description'])) {
          if (op[key] !== undefined) /** @type {any} */ (model)[key] = op[key];
        }
        this._buildFrame();
        break;
      case 'node': {
        const { op: _op, surface: _surface, ...node } = /** @type {any} */ (op);
        if (!model.order.has(node.id)) model.order.set(node.id, model.order.size);
        model.nodes.set(node.id, /** @type {SurfaceNode} */ (node));
        this._dirty.add(node.id);
        break;
      }
      case 'patch': {
        const node = model.nodes.get(op.id);
        if (!node) break;
        for (const [key, value] of Object.entries(op.props)) {
          if (value === null) delete node[key];
          else node[key] = structuredClone(value);
        }
        this._dirty.add(op.id);
        break;
      }
      case 'append': {
        const node = model.nodes.get(op.id);
        if (!node) break;
        node.text = (typeof node.text === 'string' ? node.text : '') + op.text;
        this._dirty.add(op.id);
        break;
      }
      case 'remove':
        model.nodes.delete(op.id);
        model.root = model.root.filter((id) => id !== op.id);
        for (const node of model.nodes.values()) {
          if (Array.isArray(node.children) && node.children.includes(op.id)) {
            node.children = node.children.filter((id) => id !== op.id);
            this._dirty.add(node.id);
          }
        }
        break;
      case 'data':
        try {
          model.data = /** @type {Record<string, unknown>} */ (op.remove ? removePointer(model.data, op.path) : setPointer(model.data, op.path, structuredClone(op.value)));
        } catch {
          break;
        }
        for (const node of model.nodes.values()) if (hasBinding(node)) this._dirty.add(node.id);
        break;
      case 'actions':
        model.actions = structuredClone(op.items);
        this._actionsDirty = true;
        break;
      case 'end':
        model.ended = true;
        if (op.sources) model.sources = structuredClone(op.sources);
        for (const [id, view] of this._views) if (view.kind !== 'node') this._dirty.add(id);
        this._actionsDirty = true;
        break;
      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ drawing -- */

  /**
   * Builds the frame once the intent is known: a `<form>` for a surface that asks, a region for
   * any other, labelled by the title.
   * @private
   * @returns {void}
   */
  _buildFrame() {
    if (this._frame) return;
    const model = this._model;
    const asking = model.intent !== null && ASKING_INTENTS.has(model.intent);
    const labelledBy = typeof this.options.labelledBy === 'string' && this.options.labelledBy ? this.options.labelledBy : null;
    const titleId = `${this._uid}-title`;
    const level = headingLevel(this.options.headingLevel);
    const frame = /** @type {HTMLElement} */ (h(asking ? 'form' : 'div', {
      class: 'zx-surface__frame',
      role: asking ? null : 'region',
      'aria-labelledby': labelledBy ?? (model.title ? titleId : null),
      'aria-label': labelledBy || model.title ? null : this.msg('surface.byline', this._authorName()),
      novalidate: asking ? true : null
    }));
    this._frame = frame;
    const header = h('header', { class: 'zx-surface__header' });
    if (!labelledBy && model.title) header.append(h(`h${level}`, { class: 'zx-surface__title', id: titleId }, model.title));
    if (model.description) header.append(h('p', { class: 'zx-surface__description' }, model.description));
    header.append(h('p', { class: 'zx-surface__byline' }, this.msg('surface.byline', this._authorName())));
    this._body = h('div', { class: 'zx-surface__body' });
    this._actionsEl = h('div', { class: 'zx-surface__actions' });
    this._verdict = null;
    frame.append(header, this._body, this._actionsEl);
    const root = /** @type {HTMLElement} */ (this.el);
    root.dataset.intent = model.intent ?? 'none';
    root.dataset.state = 'open';
    this._waiting?.remove();
    this.el.append(frame);
    if (asking) {
      this.listen(frame, 'submit', (event) => {
        event.preventDefault();
        if (event.target !== frame) return;
        // The button pressed answers; Enter in a field presses the first primary action.
        const pressed = /** @type {SubmitEvent} */ (event).submitter?.getAttribute('data-surface-action');
        const id = pressed ?? this._actions.find((action) => action.kind === 'primary' && !action.builtin)?.id;
        if (id) void this._run(id);
      });
    }
    this.listen(this._actionsEl, 'click', (event) => {
      const target = /** @type {Element} */ (event.target).closest?.('button[data-surface-action]');
      if (!target || /** @type {HTMLButtonElement} */ (target).type === 'submit') return;
      void this._run(String(/** @type {HTMLElement} */ (target).dataset.surfaceAction));
    });
  }

  /**
   * Draws what changed: the node tree from `root`, the visibility of every node and field, and
   * the actions, or the receipt once the surface is answered.
   * @private
   * @returns {void}
   */
  _draw() {
    if (!this._model.began || this._destroyed || !this._body) return;
    try {
      this._paint();
    } catch (error) {
      this._drawFailed(error);
    }
    this.el.removeAttribute('aria-busy');
    if (!this._ready) {
      this._ready = true;
      this.emit('ready');
    }
    if (this._model.ended && !this._endEmitted) {
      this._endEmitted = true;
      this.emit('end');
    }
  }

  /**
   * @private
   * @returns {void}
   */
  _paint() {
    if (this._reply && !this._frozen) this._freeze();
    /** @type {Set<string>} */
    const used = new Set();
    syncChildren(this._body, this._model.root.map((id) => this._viewOf(id, used, 1)));
    for (const [id, view] of [...this._views]) {
      if (used.has(id)) continue;
      for (const component of view.owned) component.destroy();
      view.el.remove();
      this._views.delete(id);
    }
    this._dirty.clear();
    this._syncVisibility();
    if (!this._reply) this._drawActions();
    const busy = !this._model.ended && !this._reply;
    if (busy) this._frame?.setAttribute('aria-busy', 'true');
    else this._frame?.removeAttribute('aria-busy');
  }

  /**
   * What goes wrong while drawing costs the part that failed and is reported; never the rest of
   * the surface, and never its reply.
   * @private
   * @param {unknown} error @param {string} [id] The node that failed.
   * @returns {void}
   */
  _drawFailed(error, id) {
    this._report([{
      code: 'draw-failed', surface: this._model.surface || undefined, ...(id === undefined ? {} : { id }),
      message: `${id === undefined ? 'The surface' : `The node "${id}"`} could not be drawn: ${error instanceof Error ? error.message : String(error)}`
    }]);
  }

  /**
   * The element for a node id: its view, built or rebuilt when it changed, with a layout node's
   * children synced inside it.
   * @private
   * @param {string} id @param {Set<string>} used @param {number} depth
   * @returns {HTMLElement}
   */
  _viewOf(id, used, depth) {
    if (used.has(id) || depth > LIMITS.depth) return h('span', { hidden: true });
    used.add(id);
    let view = this._views.get(id);
    if (!view || this._dirty.has(id)) {
      const next = this._safeBuild(id);
      if (view) {
        const hadFocus = view.el.contains(document.activeElement);
        view.el.replaceWith(next.el);
        for (const component of view.owned) component.destroy();
        if (hadFocus) this._refocus(next);
      }
      view = next;
      this._views.set(id, view);
    }
    view.el.dataset.surfaceNode = id;
    const node = this._model.nodes.get(id);
    if (view.container && node && Array.isArray(node.children)) {
      syncChildren(view.container, node.children.map((child) => this._viewOf(child, used, depth + 1)));
    }
    return view.el;
  }

  /**
   * @private
   * @param {string} id
   * @returns {NodeView}
   */
  _safeBuild(id) {
    try {
      return this._build(id);
    } catch (error) {
      this._drawFailed(error, id);
      return this._fallback();
    }
  }

  /**
   * Builds one node's view: the component it maps to, a skeleton while what it needs has not
   * arrived, a quiet fallback for what cannot be shown, or, once answered, the receipt.
   * @private
   * @param {string} id
   * @returns {NodeView}
   */
  _build(id) {
    const node = this._model.nodes.get(id);
    const ended = this._model.ended;
    if (!node) return ended ? this._fallback() : this._placeholder();
    const entry = this._entry(node.type);
    if (!entry || (entry.input && !this._model.intent)) return this._fallback();
    /** @type {Record<string, any>} */
    const props = {};
    for (const [name, member] of Object.entries(entry.props)) {
      const value = this._prop(node, name);
      if (value !== undefined) props[name] = value;
      else if (member.required) return ended ? this._fallback() : this._placeholder();
    }
    if (this._reply && entry.input) return this._receipt(node, props);
    /** @type {NodeView} */
    const view = { el: h('div'), owned: [], kind: 'node' };
    const level = headingLevel(this.options.headingLevel);
    if (BLOCK_TYPES.has(node.type)) {
      view.el = h('div', { class: 'zx-surface__blocks zx-prose', dataset: { size: 'sm' } },
        renderBlocks([toBlock(node.type, props)], { headingLevel: /** @type {any} */ (Math.min(5, level + 1)), msg: (key, ...args) => this.msg(key, ...args) }));
      if (node.type === 'heading') settleHeading(view.el, Math.min(6, level + (props.level === 3 ? 2 : 1)));
      return view;
    }
    switch (node.type) {
      case 'table':
        return this._table(view, props);
      case 'stat': {
        const tile = new StatTile(null, {
          label: props.label, value: props.value, format: props.format ?? 'number', currency: props.currency ?? null,
          delta: props.delta ?? null, caption: props.caption ?? '', variant: 'plain', locale: this.options.locale
        });
        view.owned.push(tile);
        view.el = h('div', { class: 'zx-surface__stat' }, tile.toElement());
        return view;
      }
      case 'badge':
        view.el = h('div', { class: 'zx-surface__badge' }, badge({ label: props.label, kind: props.kind ?? 'neutral' }));
        return view;
      case 'ref':
        view.el = h('div', { class: 'zx-surface__ref' }, this._ref(props.ref, view));
        return view;
      case 'link':
        view.el = h('p', { class: 'zx-surface__link' }, ...this._link(props.text, props.href));
        return view;
      case 'chart':
        return this._chart(view, props);
      case 'empty':
        view.el = h('div', { class: 'zx-surface__empty' },
          emptyState({ icon: null, title: props.title, description: props.description ?? '', size: 'sm', align: 'start' }));
        return view;
      case 'stack':
        view.el = stack({ gap: GAPS[/** @type {keyof typeof GAPS} */ (props.gap)] ?? GAPS.md, class: 'zx-surface__stack' });
        view.container = view.el;
        return view;
      case 'columns':
        view.el = grid({ columns: props.count ?? 2, min: '12rem', class: 'zx-surface__columns' });
        view.container = view.el;
        return view;
      case 'group': {
        const box = new Groupbox(null, { title: props.title, open: true });
        const container = stack({ gap: GAPS.md });
        box.setContent(container);
        view.owned.push(box);
        view.el = h('div', { class: 'zx-surface__group' }, box.toElement());
        view.container = container;
        return view;
      }
      case 'fields':
        return this._fields(view, props);
      case 'choice':
        return this._choice(view, node, props);
      case 'diff':
        return this._diff(view, props);
      case 'questionnaire':
        return this._questionnaire(view, props);
      default:
        return this._fallback();
    }
  }

  /**
   * The catalog's own entry for a type: a node of any other type, whatever it is called, has none.
   * @private
   * @param {string} type
   * @returns {import('./catalog.js').CatalogNode|undefined}
   */
  _entry(type) {
    return Object.hasOwn(this._catalog.nodes, type) ? this._catalog.nodes[type] : undefined;
  }

  /**
   * A property's value, a `$data` binding resolved and checked as if it had been written in.
   * @private
   * @param {SurfaceNode} node @param {string} name
   * @returns {any}
   */
  _prop(node, name) {
    const raw = node[name];
    if (!isBinding(raw)) return raw === null ? undefined : raw;
    const value = readProp(node, name, this._model.data);
    if (value === undefined) return undefined;
    const { value: checked, errors } = validateValue(node.type, name, value, { entities: this._entities, node });
    this._report(errors.map((error) => ({
      ...error, surface: this._model.surface, id: node.id,
      path: `/nodes/${node.id}/${name}${error.path}`
    })));
    return checked;
  }

  /** @private @returns {NodeView} */
  _placeholder() {
    return { el: h('div', { class: 'zx-surface__placeholder' }, skeletonText({ lines: 1 })), owned: [], kind: 'placeholder' };
  }

  /** @private @returns {NodeView} */
  _fallback() {
    return {
      el: h('p', { class: 'zx-surface__fallback' },
        h('span', { class: 'zx-surface__fallback-icon', 'aria-hidden': 'true' }, icon('info', { size: 14 })),
        h('span', {}, this.msg('surface.fallback'))),
      owned: [],
      kind: 'fallback'
    };
  }

  /**
   * @private
   * @param {NodeView} view @param {Record<string, any>} props
   * @returns {NodeView}
   */
  _table(view, props) {
    const rows = /** @type {Record<string, unknown>[]} */ (props.rows);
    const selectable = props.selectable && props.name ? props.selectable : false;
    const table = new Table(null, {
      columns: /** @type {any} */ (this._columns(props.columns, rows, view)),
      data: drawnRows(rows, props.columns),
      rowId: drawnRowId(props.rowId),
      selectable,
      label: props.label ?? null,
      stickyHeader: false
    });
    view.owned.push(table);
    view.table = table;
    view.rowId = props.rowId;
    if (selectable) {
      const saved = this._raw[props.name];
      if (saved != null) table.setSelection(Array.isArray(saved) ? saved : [saved]);
      table.on('selectionchange', () => this._inputChanged());
    }
    view.el = h('div', { class: 'zx-surface__table' }, table.toElement());
    return view;
  }

  /**
   * Table columns: formats mapped, record cells drawn through `resolve.ref`.
   * @private
   * @param {Array<Record<string, any>>} columns @param {Record<string, unknown>[]} rows @param {NodeView} view
   * @returns {Array<Record<string, unknown>>}
   */
  _columns(columns, rows, view) {
    return columns.map((column) => {
      /** @type {Record<string, unknown>} */
      const out = { id: column.id, label: column.label, align: column.align ?? 'start' };
      if (column.format === 'number' || column.format === 'percent') out.type = column.format;
      if (column.format === 'currency') {
        if (column.currency) Object.assign(out, { type: 'currency', currency: column.currency });
        else out.type = 'number';
      }
      if (this.options.locale) out.locale = this.options.locale;
      if (rows.some((row) => isRef(row[column.id]))) {
        out.render = (/** @type {Record<string, unknown>} */ row) => {
          const cell = row[column.id];
          return isRef(cell) ? this._ref(cell, view) : cell == null ? '' : String(cell);
        };
      }
      return out;
    });
  }

  /**
   * A record drawn as an EntityRef through `resolve.ref`, or its id as text.
   * @private
   * @param {{$ref: string, id: string}} ref @param {NodeView} view
   * @returns {Node}
   */
  _ref(ref, view) {
    const resolver = this.options.resolve?.ref;
    let options = null;
    if (typeof resolver === 'function') {
      try {
        options = resolver({ $ref: ref.$ref, id: ref.id });
      } catch {
        options = null;
      }
    }
    if (!options || typeof options !== 'object') return h('span', { class: 'zx-surface__ref-id' }, ref.id);
    const entity = new EntityRef(null, { size: 'sm', ...options });
    view.owned.push(entity);
    return entity.toElement();
  }

  /**
   * A link: the text, opening in a new tab when `resolve.link` keeps it, and the host beside it.
   * @private
   * @param {string} text @param {string} href
   * @returns {Node[]}
   */
  _link(text, href) {
    let host = '';
    try {
      host = new URL(href).host;
    } catch {
      host = '';
    }
    /** @type {string|null} */
    let target = href;
    const resolver = this.options.resolve?.link;
    if (typeof resolver === 'function') {
      let answer;
      try {
        answer = resolver(href, { text });
      } catch {
        answer = false;
      }
      if (answer === false || answer === null) target = null;
      else if (typeof answer === 'string') target = safeHref(answer) ? answer : null;
    }
    const label = target
      ? h('a', { class: 'zx-surface__link-text', href: target, target: '_blank', rel: 'noopener noreferrer' }, text)
      : h('span', { class: 'zx-surface__link-text' }, text);
    return [label, host ? h('span', { class: 'zx-surface__host' }, ` (${host})`) : document.createTextNode('')];
  }

  /**
   * A chart; its data table is shown when there is no engine, and offered behind a toggle when
   * there is.
   * @private
   * @param {NodeView} view @param {Record<string, any>} props
   * @returns {NodeView}
   */
  _chart(view, props) {
    const adapter = this.options.chartAdapter ?? null;
    const chart = new Chart(null, {
      adapter, type: props.kind, data: props.data, label: props.label, description: props.description ?? '',
      summary: adapter ? 'hidden' : 'visible'
    });
    view.owned.push(chart);
    view.el = h('div', { class: 'zx-surface__chart' }, chart.toElement());
    const summary = /** @type {HTMLElement|null} */ (chart.toElement().querySelector('.zx-chart__summary'));
    if (adapter && summary) {
      summary.id = uid(`${this._uid}-data`);
      const toggle = /** @type {HTMLButtonElement} */ (button({ label: this.msg('surface.dataTable'), kind: 'ghost', size: 'sm', icon: 'table' }));
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', summary.id);
      toggle.classList.add('zx-surface__data-toggle');
      this.listen(toggle, 'click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        summary.dataset.summary = open ? 'visible' : 'hidden';
      });
      view.el.append(toggle);
    }
    return view;
  }

  /**
   * A schema drawn as a Fieldset; what was typed survives a redraw.
   * @private
   * @param {NodeView} view @param {Record<string, any>} props
   * @returns {NodeView}
   */
  _fields(view, props) {
    const schema = props.schema;
    let fields;
    try {
      fields = schemaToFields(schema);
    } catch {
      return this._fallback();
    }
    for (const [name, field] of Object.entries(fields)) {
      const property = schema.properties[name];
      if (typeof field.value === 'string' && property.type === 'string' && (property.format === 'date' || property.format === 'date-time')) {
        const date = parseLocal(field.value);
        if (date) field.value = date;
        else delete field.value;
      }
      // A native select's empty first option is a choice still to make: it says so.
      if (field.type === 'select' && field.options && Object.hasOwn(field.options, '') && !field.options['']) {
        field.options = { ...field.options, '': this.msg('surface.choose') };
      }
    }
    const fieldset = new Fieldset(null, { title: props.title ?? '', fields: /** @type {any} */ (fields), idPrefix: `${this._uid}-${uid('f')}` });
    // A radio group is named by its field's label, as its radios are by their own.
    for (const field of Object.values(fieldset.getFields())) {
      const group = field.el.querySelector('[role="radiogroup"]');
      const label = field.el.querySelector(`[id="${CSS.escape(`${field.controlId}-label`)}"]`);
      if (group && label && !group.hasAttribute('aria-labelledby') && !group.hasAttribute('aria-label')) {
        group.setAttribute('aria-labelledby', label.id);
      }
    }
    /** @type {Record<string, unknown>} */
    const saved = {};
    for (const name of Object.keys(fields)) if (Object.hasOwn(this._raw, name)) saved[name] = this._raw[name];
    if (Object.keys(saved).length) fieldset.setValues(saved, { silent: true });
    view.owned.push(fieldset);
    view.fieldset = fieldset;
    view.schema = schema;
    view.el = h('div', { class: 'zx-surface__fields' }, fieldset.toElement());
    return view;
  }

  /**
   * Options to pick from, as a native group of radios or checkboxes.
   * @private
   * @param {NodeView} view @param {SurfaceNode} node @param {Record<string, any>} props
   * @returns {NodeView}
   */
  _choice(view, node, props) {
    const name = String(node.name);
    const multiple = Boolean(props.multiple);
    const groupName = `${this._uid}-${name}`;
    const saved = this._raw[name];
    const picked = new Set(Array.isArray(saved) ? saved : saved == null ? [] : [saved]);
    const errorId = `${groupName}-error`;
    const error = h('p', { class: 'zx-surface__choice-error', id: errorId, role: 'alert', hidden: true });
    const set = /** @type {HTMLFieldSetElement} */ (h('fieldset', { class: 'zx-surface__choice', dataset: { name } },
      h('legend', { class: 'zx-surface__choice-legend' }, props.label),
      h('div', { class: 'zx-surface__choice-list' }, props.choices.map((/** @type {any} */ choice, /** @type {number} */ index) => {
        const id = `${groupName}-${index}`;
        const descriptionId = choice.description ? `${id}-description` : null;
        return h('div', { class: 'zx-surface__option' },
          h('input', {
            type: multiple ? 'checkbox' : 'radio', id, name: groupName, value: choice.value,
            checked: picked.has(choice.value), 'aria-describedby': descriptionId
          }),
          h('label', { for: id, class: 'zx-surface__option-label' },
            choice.icon ? h('span', { class: 'zx-surface__option-icon', 'aria-hidden': 'true' }, icon(choice.icon, { size: 16 })) : null,
            h('span', { class: 'zx-surface__option-text' }, choice.label,
              descriptionId ? h('span', { class: 'zx-surface__option-description', id: descriptionId }, choice.description) : null)));
      })),
      error));
    view.choice = set;
    view.choiceError = error;
    view.el = h('div', { class: 'zx-surface__choice-host' }, set);
    return view;
  }

  /**
   * Proposed changes as a table whose selected rows are the accepted ones.
   * @private
   * @param {NodeView} view @param {Record<string, any>} props
   * @returns {NodeView}
   */
  _diff(view, props) {
    const rows = /** @type {Array<Record<string, any>>} */ (props.rows);
    const table = new Table(null, {
      columns: /** @type {any} */ (this._diffColumns(rows, view)),
      data: rows.map((row) => ({ ...row })),
      rowId: 'id',
      selectable: 'multi',
      label: props.label ?? null,
      stickyHeader: false
    });
    const saved = this._raw[/** @type {string} */ (props.name)];
    if (Array.isArray(saved)) table.setSelection(saved);
    table.on('selectionchange', () => this._inputChanged());
    view.owned.push(table);
    view.table = table;
    view.rowId = 'id';
    view.el = h('div', { class: 'zx-surface__diff' }, table.toElement());
    return view;
  }

  /**
   * @private
   * @param {Array<Record<string, any>>} rows @param {NodeView} view
   * @returns {Array<Record<string, unknown>>}
   */
  _diffColumns(rows, view) {
    const cell = (/** @type {unknown} */ value) => (value === true ? this.msg('surface.yes') : value === false ? this.msg('surface.no')
      : value == null || value === '' ? h('span', { class: 'zx-surface__none' }, this.msg('surface.noAnswer')) : String(value));
    return [
      {
        id: 'label', label: this.msg('surface.field'),
        render: (/** @type {Record<string, any>} */ row) => (row.ref
          ? h('span', { class: 'zx-surface__diff-label' }, String(row.label), this._ref(row.ref, view))
          : String(row.label))
      },
      { id: 'before', label: this.msg('surface.before'), render: (/** @type {Record<string, any>} */ row) => cell(row.before) },
      { id: 'after', label: this.msg('surface.after'), render: (/** @type {Record<string, any>} */ row) => cell(row.after) }
    ];
  }

  /**
   * Steps asked one at a time; the Questionnaire's own submit answers the surface.
   * @private
   * @param {NodeView} view @param {Record<string, any>} props
   * @returns {NodeView}
   */
  _questionnaire(view, props) {
    let questionnaire;
    try {
      questionnaire = new Questionnaire(null, {
        items: structuredClone(props.steps), review: Boolean(props.review), progress: props.steps.length > 1,
        msg: this.options.msg
      });
    } catch {
      return this._fallback();
    }
    const labelledBy = this._frame?.getAttribute('aria-labelledby');
    if (labelledBy) questionnaire.toElement().setAttribute('aria-labelledby', labelledBy);
    questionnaire.on('submit', (event) => {
      event.preventDefault();
      void this._run('submit');
    });
    view.owned.push(questionnaire);
    view.questionnaire = questionnaire;
    view.el = h('div', { class: 'zx-surface__questionnaire' }, questionnaire.toElement());
    return view;
  }

  /**
   * An input as the read-only record of what was answered.
   * @private
   * @param {SurfaceNode} node @param {Record<string, any>} props
   * @returns {NodeView}
   */
  _receipt(node, props) {
    /** @type {NodeView} */
    const view = { el: h('div', { class: 'zx-surface__receipt' }), owned: [], kind: 'receipt' };
    const reply = /** @type {SurfaceReply} */ (this._reply);
    const values = reply.values ?? {};
    const answered = !VALUELESS.has(reply.action) && Object.keys(values).length > 0;
    // A table stays drawn whatever the answer; only what was picked in it is marked.
    if (!answered && node.type !== 'table' && node.type !== 'diff') {
      view.el.hidden = true;
      return view;
    }
    const none = () => h('span', { class: 'zx-surface__none' }, this.msg('surface.noAnswer'));
    /** @type {Array<[string, Node|string]>} */
    const pairs = [];
    switch (node.type) {
      case 'fields':
        for (const [name, property] of Object.entries(/** @type {Record<string, any>} */ (props.schema.properties))) {
          if (!Object.hasOwn(values, name) && this._hiddenAt(reply, node.id, name)) continue;
          const choices = choiceLabels(property);
          pairs.push([property.title || name, Object.hasOwn(values, name) ? this._display(values[name], choices) : none()]);
        }
        break;
      case 'choice': {
        if (!Object.hasOwn(values, String(node.name))) break;
        const choices = new Map(props.choices.map((/** @type {any} */ choice) => [choice.value, choice.label]));
        pairs.push([props.label, this._display(values[String(node.name)], choices)]);
        break;
      }
      case 'questionnaire': {
        const answers = /** @type {Record<string, unknown>} */ (values.answers ?? {});
        for (const name of Array.isArray(values.path) ? values.path : Object.keys(answers)) {
          const step = props.steps.find((/** @type {any} */ entry) => entry.name === name);
          if (!step || !Object.hasOwn(answers, name)) continue;
          const choices = new Map((step.choices ?? []).map((/** @type {any} */ choice) => [choice.value, choice.label]));
          pairs.push([step.prompt, this._display(answers[name], choices)]);
        }
        break;
      }
      case 'table':
      case 'diff': {
        const name = String(node.name ?? props.name ?? '');
        if (node.type === 'table' && !props.selectable) {
          view.kind = 'node';
          return this._table(view, props);
        }
        const selected = new Set(Array.isArray(values[name]) ? values[name] : values[name] == null ? [] : [values[name]]);
        const rowId = node.type === 'diff' ? 'id' : props.rowId;
        const rows = /** @type {Array<Record<string, any>>} */ (props.rows);
        const columns = node.type === 'diff' ? this._diffColumns(rows, view) : this._columns(props.columns, rows, view);
        const table = new Table(null, {
          columns: [{
            id: '__selected', label: '', ariaLabel: this.msg('surface.selected'), width: '2.5rem',
            render: (/** @type {Record<string, any>} */ row) => (selected.has(ownValue(row, rowId))
              ? h('span', { class: 'zx-surface__mark' }, icon('check', { size: 14 }), h('span', { class: 'zx-surface__sr' }, this.msg('surface.selected')))
              : '')
          }, ...columns].map((column) => /** @type {any} */ (column)),
          data: node.type === 'diff' ? rows.map((row) => ({ ...row })) : drawnRows(rows, props.columns),
          rowId: node.type === 'diff' ? rowId : drawnRowId(rowId),
          label: props.label ?? null,
          stickyHeader: false
        });
        view.owned.push(table);
        view.el.append(table.toElement());
        for (const row of view.el.querySelectorAll('tbody tr')) {
          if (row.querySelector('.zx-surface__mark')) /** @type {HTMLElement} */ (row).dataset.selected = 'true';
        }
        return view;
      }
      default:
        break;
    }
    if (!pairs.length) {
      view.el.hidden = true;
      return view;
    }
    view.el.append(h('dl', { class: 'zx-surface__answers' }, pairs.map(([label, value]) => h('div', { class: 'zx-surface__answer' },
      h('dt', {}, label), h('dd', {}, value)))));
    return view;
  }

  /** @private @param {SurfaceReply} reply @param {string} id @param {string} name @returns {boolean} */
  _hiddenAt(reply, id, name) {
    const visibility = surfaceVisibility(this._docLike(), reply.values ?? {});
    return visibility.hiddenNodes.has(id) || Boolean(visibility.hiddenFields.get(id)?.has(name));
  }

  /** @private @param {unknown} value @param {Map<unknown, string>} choices @returns {string} */
  _display(value, choices) {
    const one = (/** @type {unknown} */ entry) => (choices.has(entry) ? String(choices.get(entry))
      : entry === true ? this.msg('surface.yes') : entry === false ? this.msg('surface.no') : String(entry));
    if (Array.isArray(value)) return value.length ? value.map(one).join(', ') : this.msg('surface.noAnswer');
    return one(value);
  }

  /* ------------------------------------------------------------------ inputs -- */

  /**
   * Reads every input's raw value — what its control holds, hidden inputs included.
   * @private
   * @returns {Record<string, unknown>}
   */
  _collectRaw() {
    /** @type {Record<string, unknown>} */
    const raw = {};
    for (const [id, view] of this._views) {
      const node = this._model.nodes.get(id);
      if (!node || view.kind !== 'node') continue;
      if (view.fieldset) Object.assign(raw, view.fieldset.getValues());
      else if (view.choice) {
        const checked = [...view.choice.querySelectorAll('input:checked')].map((input) => /** @type {HTMLInputElement} */ (input).value);
        const multiple = view.choice.querySelector('input[type="checkbox"]') !== null;
        raw[String(node.name)] = multiple ? checked : checked[0] ?? null;
      } else if (view.table && typeof node.name === 'string' && (node.type === 'diff' || this._prop(node, 'selectable'))) {
        const key = /** @type {string} */ (view.rowId);
        const ids = view.table.getSelection().map((row) => ownValue(row, key)).filter((id) => id !== null);
        raw[node.name] = node.type === 'table' && this._prop(node, 'selectable') === 'single' ? ids[0] ?? null : ids;
      }
    }
    return raw;
  }

  /**
   * The inputs' values as JSON, empty ones left out; hidden ones included.
   * @private
   * @returns {Record<string, unknown>}
   */
  _jsonValues() {
    const raw = { ...this._raw, ...this._collectRaw() };
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [id, node] of this._model.nodes) {
      const view = this._views.get(id);
      if (node.type === 'fields') {
        const schema = view?.schema ?? this._prop(node, 'schema');
        if (!schema?.properties) continue;
        for (const [name, property] of Object.entries(/** @type {Record<string, any>} */ (schema.properties))) {
          if (!Object.hasOwn(raw, name)) continue;
          const value = toJsonValue(property, raw[name]);
          const empty = isEmptyAnswer(value) || (property.type === 'boolean' && typeof value !== 'boolean');
          if (!empty) out[name] = value;
        }
      } else {
        for (const name of inputNames(node, this._model.data)) {
          if (Object.hasOwn(raw, name) && raw[name] !== null && raw[name] !== undefined) out[name] = structuredClone(raw[name]);
        }
      }
    }
    return out;
  }

  /** @private @returns {any} The model as `surfaceVisibility()` and `createReply()` read it. */
  _docLike() {
    const model = this._model;
    /** @type {Map<string, SurfaceNode>} */
    const nodes = new Map();
    for (const [id, node] of model.nodes) {
      if (!hasBinding(node)) {
        nodes.set(id, node);
        continue;
      }
      const resolved = { ...node };
      for (const key of Object.keys(node)) if (isBinding(node[key])) resolved[key] = this._prop(node, key);
      nodes.set(id, resolved);
    }
    return { zx: SURFACE_VERSION, surface: model.surface, intent: model.intent, root: model.root, nodes, data: model.data, actions: model.actions ?? [] };
  }

  /** @private @param {Record<string, unknown>} values @returns {import('./text.js').SurfaceVisibility} */
  _visibilityFor(values) {
    return surfaceVisibility(this._docLike(), values);
  }

  /**
   * Something was typed, picked or selected: reports each input whose value changed, and shows
   * and hides what depends on it.
   * @private
   * @returns {void}
   */
  _inputChanged() {
    if (this._reply || !this._model.began) return;
    Object.assign(this._raw, this._collectRaw());
    const values = this._jsonValues();
    /** @type {string[]} */
    const changed = [];
    const names = new Set([...Object.keys(values), ...Object.keys(this._reportedValues)]);
    for (const name of names) {
      const json = values[name] === undefined ? '' : JSON.stringify(values[name]);
      if ((this._reportedValues[name] ?? '') === json) continue;
      if (json) this._reportedValues[name] = json;
      else delete this._reportedValues[name];
      changed.push(name);
    }
    if (!changed.length) return;
    this._syncVisibility(changed);
    for (const name of changed) {
      this._clearError(name);
      this.emit('change', { name, value: values[name] === undefined ? null : structuredClone(values[name]) });
    }
  }

  /**
   * Shows and hides nodes and fields for the current values. A node that hides while it holds
   * the focus hands it to the input whose value hid it.
   * @private
   * @param {string[]} [changed=[]] The inputs that just changed.
   * @returns {void}
   */
  _syncVisibility(changed = []) {
    const visibility = this._visibilityFor(this._jsonValues());
    this._visibility = visibility;
    const active = document.activeElement;
    let lost = false;
    for (const [id, view] of this._views) {
      const hidden = visibility.hiddenNodes.has(id);
      if (hidden && !view.el.hidden && active && view.el.contains(active)) lost = true;
      view.el.hidden = hidden;
      if (view.fieldset) {
        const fieldsHidden = visibility.hiddenFields.get(id) ?? new Set();
        for (const [name, field] of Object.entries(view.fieldset.getFields())) {
          const hide = fieldsHidden.has(name);
          const element = /** @type {HTMLElement} */ (field.el);
          if (hide && !element.hidden && active && element.contains(active)) lost = true;
          element.hidden = hide;
          if (hide) field.clearHighlight();
        }
      }
    }
    if (lost) {
      const target = changed.find((name) => visibility.names.includes(name));
      if (target) this._focusInput(target);
    }
  }

  /**
   * @private
   * @param {string} name
   * @returns {boolean} Whether an input took the focus.
   */
  _focusInput(name) {
    const owner = this._visibility?.owners.get(name) ?? surfaceVisibility(this._docLike(), {}).owners.get(name);
    const view = owner ? this._views.get(owner) : null;
    if (!view) return false;
    if (view.fieldset) {
      view.fieldset.focus(name);
      return true;
    }
    if (view.choice) {
      const input = /** @type {HTMLInputElement|null} */ (view.choice.querySelector('input:checked') ?? view.choice.querySelector('input'));
      input?.focus();
      return Boolean(input);
    }
    if (view.table) {
      const target = /** @type {HTMLElement|null} */ (view.table.toElement().querySelector('[tabindex="0"]') ?? view.table.toElement().querySelector('input'));
      target?.focus();
      return Boolean(target);
    }
    return false;
  }

  /** @private @param {NodeView} view @returns {void} */
  _refocus(view) {
    const target = /** @type {HTMLElement|null} */ (view.el.querySelector('input, select, textarea, button, [tabindex]'));
    target?.focus();
  }

  /**
   * Checks the visible inputs before an action replies: each schema, and a pick for each choice.
   * Marks what failed and returns the values to send.
   * @private
   * @returns {{values: Record<string, unknown>, invalid: string|null}}
   */
  _check() {
    Object.assign(this._raw, this._collectRaw());
    const values = this._jsonValues();
    const visibility = this._visibilityFor(values);
    /** @type {Record<string, unknown>} */
    const out = {};
    /** @type {string|null} */
    let invalid = null;
    // The same keys as a questionnaire's rules, so one translation serves both.
    const msg = (/** @type {string} */ key, /** @type {unknown[]} */ ...args) => this.msg(key, ...args);
    const message = (/** @type {string} */ key, /** @type {unknown[]} */ ...args) => (key === 'required'
      ? this.msg('questionnaire.requiredInput')
      : ruleText(msg, key, ...args));
    for (const name of visibility.names) {
      const owner = /** @type {string} */ (visibility.owners.get(name));
      const view = this._views.get(owner);
      if (view?.fieldset || view?.choice) continue;
      if (Object.hasOwn(values, name)) out[name] = values[name];
    }
    for (const [id, view] of this._views) {
      if (view.kind !== 'node' || visibility.hiddenNodes.has(id)) continue;
      if (view.fieldset && view.schema) {
        const raw = view.fieldset.getValues();
        const hidden = visibility.hiddenFields.get(id) ?? new Set();
        const result = checkValue(/** @type {any} */ (view.schema), raw, hidden, message);
        /** @type {Record<string, string>} */
        const highlights = {};
        for (const problem of result.errors) highlights[problem.name] = problem.message;
        view.fieldset.setHighlights(highlights);
        if (result.errors.length && !invalid) invalid = result.errors[0].name;
        Object.assign(out, result.values);
      } else if (view.choice) {
        const node = /** @type {SurfaceNode} */ (this._model.nodes.get(id));
        const name = String(node.name);
        const value = values[name];
        const multiple = view.choice.querySelector('input[type="checkbox"]') !== null;
        const missing = !multiple && isEmptyAnswer(value);
        this._choiceError(view, missing ? this.msg('surface.choiceRequired') : '');
        if (missing) {
          if (!invalid) invalid = name;
        } else {
          out[name] = multiple && value == null ? [] : value;
        }
      }
    }
    return { values: out, invalid };
  }

  /** @private @param {NodeView} view @param {string} text @returns {void} */
  _choiceError(view, text) {
    if (!view.choice || !view.choiceError) return;
    view.choiceError.textContent = text;
    view.choiceError.hidden = !text;
    if (text) {
      view.choice.setAttribute('aria-invalid', 'true');
      view.choice.setAttribute('aria-describedby', view.choiceError.id);
    } else {
      view.choice.removeAttribute('aria-invalid');
      view.choice.removeAttribute('aria-describedby');
    }
  }

  /** @private @param {string} name @returns {void} */
  _clearError(name) {
    const owner = this._visibility?.owners.get(name);
    const view = owner ? this._views.get(owner) : null;
    if (view?.fieldset) view.fieldset.getField(name)?.clearHighlight();
    if (view?.choice) this._choiceError(view, '');
  }

  /** @private @returns {NodeView|null} */
  _questionnaireView() {
    for (const view of this._views.values()) if (view.questionnaire) return view;
    return null;
  }

  /* ------------------------------------------------------------------ actions -- */

  /**
   * The actions this surface draws: its own, or the intent's defaults, then Cancel where the
   * intent has one. Each is put to the policy; a denied one is not drawn.
   * @private
   * @returns {void}
   */
  _drawActions() {
    const host = this._actionsEl;
    if (!host) return;
    if (this._actionsDirty) {
      this._actionsDirty = false;
      this._actions = this._actionList();
      this._removed = [];
      this._decisions.clear();
      /** @type {SurfaceDocument|null} */
      let snapshot = null;
      for (const action of this._actions) {
        if (action.builtin) continue;
        snapshot ??= deepFreeze(/** @type {SurfaceDocument} */ (this.toDocument()));
        const decision = decide(this.options.policy, action, snapshot);
        if (decision.level === 'deny') this._removed.push(action.id);
        this._decisions.set(action.id, decision);
      }
      if (this._model.intent === 'questionnaire') {
        // The questionnaire answers through its own Submit, which the policy decides up front too.
        snapshot ??= deepFreeze(/** @type {SurfaceDocument} */ (this.toDocument()));
        const decision = decide(this.options.policy, { id: 'submit', label: this.msg('surface.submit') }, snapshot);
        this._decisions.set('submit', decision);
        if (decision.level === 'deny') this._removed.push('submit');
        if (decision.level === 'deny') /** @type {HTMLElement} */ (this.el).dataset.submit = 'denied';
        else delete /** @type {HTMLElement} */ (this.el).dataset.submit;
      }
      this._actions = this._actions.filter((action) => !this._removed.includes(action.id));
      host.replaceChildren(...this._actions.map((action) => {
        const element = /** @type {HTMLButtonElement} */ (button({
          label: action.label,
          kind: action.kind === 'danger' ? 'danger' : action.kind === 'primary' ? 'primary' : 'default'
        }));
        element.dataset.surfaceAction = action.id;
        if (action.builtin) element.dataset.surfaceBuiltin = 'cancel';
        if (action.kind === 'primary' && !action.builtin && this._frame?.localName === 'form') element.type = 'submit';
        if (action.description) element.title = action.description;
        return element;
      }));
      host.hidden = this._actions.length === 0;
    }
    for (const element of host.querySelectorAll('button[data-surface-action]')) {
      const builtin = /** @type {HTMLElement} */ (element).dataset.surfaceBuiltin === 'cancel';
      /** @type {HTMLButtonElement} */ (element).disabled = this._busy || (!builtin && !this._model.ended);
    }
  }

  /** @private @returns {DrawnAction[]} */
  _actionList() {
    const intent = this._model.intent;
    if (!intent) return [];
    /** @type {DrawnAction[]} */
    const list = [];
    const own = (this._model.actions ?? []).filter((action) => {
      if (!CLOSING_ACTIONS.includes(action.id) && intent !== 'questionnaire') return true;
      this._report([{
        code: 'not-allowed', surface: this._model.surface, id: action.id, path: '/actions',
        message: CLOSING_ACTIONS.includes(action.id)
          ? `The action id "${action.id}" is reserved for closing the surface; the action was dropped`
          : 'A questionnaire answers with its own steps; its actions were dropped'
      }]);
      return false;
    });
    if (own.length) list.push(...own);
    else if (intent === 'ask' || intent === 'choose') list.push({ id: 'submit', label: this.msg('surface.submit'), kind: 'primary' });
    else if (intent === 'confirm') list.push({ id: 'confirm', label: this.msg('surface.confirm'), kind: 'primary' });
    else if (intent === 'review') {
      list.push({ id: 'approve', label: this.msg('surface.approve'), kind: 'primary' }, { id: 'reject', label: this.msg('surface.reject') });
    }
    if (CANCEL_INTENTS.has(intent)) list.push({ id: 'cancel', label: this.msg('surface.cancel'), builtin: true });
    return list;
  }

  /**
   * Runs an action: checks the inputs, asks the confirmation the policy wants, and replies.
   * @private
   * @param {string} id
   * @returns {Promise<void>}
   */
  async _run(id) {
    if (this._reply || this._busy || this._destroyed) return;
    const action = this._actions.find((entry) => entry.id === id);
    const intent = this._model.intent;
    if (id === 'submit' && intent === 'questionnaire' && !action) {
      // The questionnaire's own submit: the default action of its intent.
      return this._answer({ id: 'submit', label: this.msg('surface.submit') });
    }
    if (!action) return;
    if (action.builtin) {
      this.cancel('cancelled');
      return;
    }
    return this._answer(action);
  }

  /**
   * @private
   * @param {SurfaceAction} action
   * @returns {Promise<void>}
   */
  async _answer(action) {
    if (!this._model.ended) return;
    const intent = this._model.intent;
    let decision = this._decisions.get(action.id);
    if (!decision) {
      decision = decide(this.options.policy, action, deepFreeze(/** @type {SurfaceDocument} */ (this.toDocument())));
      this._decisions.set(action.id, decision);
    }
    if (decision.level === 'deny') return;
    /** @type {Record<string, unknown>} */
    let values = {};
    if (intent === 'questionnaire') {
      const view = this._questionnaireView();
      values = view?.questionnaire ? { answers: view.questionnaire.getAnswers(), path: view.questionnaire.getPath() } : {};
    } else if (this._answers(action) && intent !== 'show' && intent !== 'confirm') {
      const checked = this._check();
      if (checked.invalid) {
        this._focusInput(checked.invalid);
        return;
      }
      values = checked.values;
    }
    /** @type {import('./text.js').ReplyConfirmation} */
    let confirmation = null;
    if (decision.level === 'confirm' || decision.level === 'type-to-confirm') {
      const typed = decision.level === 'type-to-confirm';
      this._busy = true;
      this._drawActions();
      const doc = this.el.ownerDocument;
      const before = new Set(doc.querySelectorAll('dialog'));
      let confirmed = false;
      try {
        const answer = Dialog.confirm({
          title: this._model.title ?? action.label,
          message: decision.message ?? action.description ?? '',
          okLabel: action.label,
          cancelLabel: this.msg('surface.cancel'),
          danger: typed || action.kind === 'danger',
          // The phrase to type is the application's, never the model's.
          confirmText: typed ? decision.confirmText || this.msg('surface.typeToConfirm') : null
        });
        const opened = [...doc.querySelectorAll('dialog')].find((element) => !before.has(element));
        this._confirm = opened ? /** @type {Dialog|null} */ (Dialog.from(opened)) : null;
        confirmed = await answer;
      } finally {
        this._busy = false;
        this._confirm = null;
      }
      if (this._reply || this._destroyed) return;
      this._drawActions();
      if (!confirmed) return;
      confirmation = typed ? 'typed' : 'clicked';
    }
    this._finish(createReply(this._docLike(), {
      action: action.id, values, confirmation, token: this._token, removed: this._removed
    }));
  }

  /**
   * Replies with a closing action, unless the surface already replied.
   * @private
   * @param {'cancel'|'dismiss'} action @param {ReplyReason} reason
   * @returns {void}
   */
  _close(action, reason) {
    if (this._reply || this._destroyed) return;
    /** @type {SurfaceReply|null} */
    let reply = null;
    if (this._model.began) {
      try {
        reply = createReply(this._docLike(), { action, reason, token: this._token, removed: this._removed });
      } catch (error) {
        this._drawFailed(error);
      }
    }
    this._finish(reply ?? this._bareReply(action, reason));
  }

  /**
   * The closing reply when no fuller one can be built: nothing valid began, say. It is owed all
   * the same.
   * @private
   * @param {'cancel'|'dismiss'} action @param {ReplyReason} reason
   * @returns {SurfaceReply}
   */
  _bareReply(action, reason) {
    const surface = this._model.surface || this._named;
    /** @type {SurfaceReply} */
    const reply = {
      zx: /** @type {'reply/1'} */ (REPLY_VERSION), surface, action, key: `${surface ?? ''}#${action}`,
      values: {}, confirmation: null, at: localDateTime(new Date())
    };
    if (this._token !== null) reply.token = this._token;
    if (reason) reply.reason = reason;
    return reply;
  }

  /**
   * Whether an action answers: checks the inputs and sends their values. The intent's answering
   * defaults do, and so does an action of the surface's own with `kind: 'primary'`; any other
   * replies with no values.
   * @private
   * @param {SurfaceAction} action
   * @returns {boolean}
   */
  _answers(action) {
    const own = (this._model.actions ?? []).some((entry) => entry.id === action.id);
    return own ? action.kind === 'primary' : ANSWERING.has(action.id);
  }

  /**
   * Records the one reply, freezes the surface into its receipt, and reports it.
   * @private
   * @param {SurfaceReply} reply
   * @returns {void}
   */
  _finish(reply) {
    if (this._reply) return;
    this._reply = reply;
    // The reply is owed whatever happens to the receipt.
    try {
      this._confirm?.close(false);
      if (!this._model.began) {
        this._waiting?.remove();
        this.el.removeAttribute('aria-busy');
        /** @type {HTMLElement} */ (this.el).dataset.state = 'answered';
      }
      const hadFocus = this.el.contains(document.activeElement);
      if (!this._destroyed) {
        this._draw();
        if (hadFocus && this._verdict) this._verdict.focus({ preventScroll: true });
      }
    } catch (error) {
      this._drawFailed(error);
    }
    this.emit('reply', { reply: structuredClone(reply) });
  }

  /**
   * Turns the surface into the record of its answer: inputs redrawn as what was answered, and the
   * actions replaced by the verdict.
   * @private
   * @returns {void}
   */
  _freeze() {
    const reply = /** @type {SurfaceReply} */ (this._reply);
    this._frozen = true;
    /** @type {HTMLElement} */ (this.el).dataset.state = 'answered';
    for (const [id, node] of this._model.nodes) if (this._entry(node.type)?.input) this._dirty.add(id);
    const time = formatTime(reply.at, this.options.locale);
    const verdict = verdictText(reply.action, this._model.actions ?? [], (key, ...args) => this.msg(key, ...args));
    this._verdict = h('p', { class: 'zx-surface__verdict', tabIndex: -1, dataset: { action: reply.action } },
      h('span', { class: 'zx-surface__verdict-icon', 'aria-hidden': 'true' },
        icon(CLOSING_ACTIONS.includes(reply.action) || reply.action === 'reject' ? 'x' : 'check', { size: 14 })),
      h('span', {}, time ? this.msg('surface.verdictAt', verdict, time) : verdict));
    this._actionsEl?.replaceWith(this._verdict);
    this._actionsEl = null;
  }

  /** @private @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || this._reply || this._busy) return;
    if (!this._actions.some((action) => action.builtin)) return;
    // An Escape that closes something nested — an open popover, an expanded list — is not ours.
    if (this._escapeIsNested(event)) return;
    // Decide once every other handler had its turn: one that handled the key prevents it.
    setTimeout(() => {
      if (event.defaultPrevented || this._reply || this._busy || this._destroyed) return;
      this.cancel('escape');
    }, 0);
  }

  /**
   * @private
   * @param {KeyboardEvent} event
   * @returns {boolean} Whether a nested control owns the Escape.
   */
  _escapeIsNested(event) {
    const target = /** @type {Element|null} */ (event.target instanceof Element ? event.target : null);
    if (target?.closest('[aria-expanded="true"]')) return true;
    if (this.el.querySelector('[aria-expanded="true"]:not(.zx-surface__data-toggle)')) return true;
    const doc = this.el.ownerDocument;
    for (const open of doc.querySelectorAll(':popover-open')) {
      if (!open.contains(this.el)) return true;
    }
    // A dialog opened above the surface, not the one that holds it.
    for (const dialog of doc.querySelectorAll('dialog[open]')) {
      if (!dialog.contains(this.el) && target && dialog.contains(target)) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ helpers -- */

  /**
   * Adds problems to the list and reports the new ones.
   * @private
   * @param {SurfaceError[]} errors
   * @returns {void}
   */
  _report(errors) {
    const fresh = [];
    for (const error of errors) {
      const key = JSON.stringify([error.code, error.path ?? '', error.id ?? '', error.message]);
      if (this._reported.has(key)) continue;
      this._reported.add(key);
      fresh.push(error);
    }
    if (!fresh.length) return;
    this._errors.push(...fresh);
    if (!this._destroyed) this.emit('error', { errors: structuredClone(fresh) });
  }

  /** @private @returns {string} */
  _authorName() {
    const key = this._model.author ?? '';
    const authors = this.options.authors ?? {};
    const author = Object.hasOwn(authors, key) ? authors[key] : null;
    return author && typeof author.name === 'string' && author.name ? author.name : key || '—';
  }
}

/**
 * The one reply, exactly once.
 * @event Surface#reply
 * @type {CustomEvent<{reply: SurfaceReply}>}
 */
/**
 * New problems, each time some are found.
 * @event Surface#error
 * @type {CustomEvent<{errors: SurfaceError[]}>}
 */
/**
 * An input's value changed; `value` is JSON, `null` when it was emptied.
 * @event Surface#change
 * @type {CustomEvent<{name: string, value: unknown}>}
 */
/**
 * The surface has begun and shows its first state.
 * @event Surface#ready
 * @type {CustomEvent<Record<string, never>>}
 */
/**
 * The surface's `end` arrived: it is complete, and its actions are enabled.
 * @event Surface#end
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Options of `openSurface()`: the Surface's own, and where it goes.
 * @typedef {SurfaceOptions & {
 *   placement?: SurfacePlacement,
 *   target?: Element|string|null,
 *   side?: 'start'|'end'|'top'|'bottom',
 *   onopen?: (surface: Surface) => void,
 *   signal?: AbortSignal|null
 * }} OpenSurfaceOptions
 */

/**
 * Shows a surface and waits for its reply. The placement the document asks for is a request:
 * a sheet or a dialog only when `userInitiated` (the surface answers the person's latest
 * message), inline into `target` otherwise. An application that passes `placement` itself
 * decides. Closing the sheet or dialog replies `cancel` (`dismiss` for a `show` surface). The
 * first control takes the focus. A document that cannot begin at all — not an object, the wrong
 * version, no usable surface id — rejects with a `TypeError` carrying `errors` before anything
 * opens; a surface given its `reply` resolves with it at once.
 *
 * `signal` withdraws the question: when it aborts, the surface is cancelled with the reason
 * `stopped` (`cancel`, or `dismiss` for a `show` surface) and the promise resolves with that reply;
 * a sheet or dialog closes and is destroyed, an inline surface stays as its receipt. A signal
 * already aborted resolves the same reply without drawing anything. An inline surface whose
 * `target` the application removes is not noticed: abort the signal, or destroy the surface (it
 * replies `dismiss`), so the promise settles.
 * @throws {TypeError} Rejects for a document that cannot begin, or an inline surface without a
 *   `target`.
 * @param {SurfaceDocument|Record<string, unknown>} document The whole surface.
 * @param {OpenSurfaceOptions} [options]
 * @returns {Promise<SurfaceReply>}
 */
export function openSurface(document, options = {}) {
  const { placement: chosen, target = null, side = 'end', onopen, signal = null, ...surfaceOptions } = options;
  const catalog = surfaceOptions.catalog ?? CATALOG;
  const entities = surfaceOptions.resolve?.entities ?? null;
  const { document: preview, errors } = validateDocument(document, catalog, { entities });
  const requested = chosen ?? preview?.placement ?? 'inline';
  const placement = chosen ? chosen : requested !== 'inline' && !surfaceOptions.userInitiated ? 'inline' : requested;
  return new Promise((resolve, reject) => {
    if (!preview) {
      // Nothing could begin: refuse before anything opens, with the problems to hand back.
      const error = new TypeError(`The surface cannot be drawn: ${errors.map((entry) => entry.message).join('; ')}`);
      /** @type {any} */ (error).errors = errors;
      reject(error);
      return;
    }
    if (signal?.aborted) {
      // Withdrawn before it was asked: the reply a stopped surface gives, and nothing drawn.
      const stopped = new Surface(null, { ...surfaceOptions, document });
      const reply = stopped.getReply() ?? stopped.cancel('stopped').getReply();
      stopped.destroy();
      resolve(/** @type {SurfaceReply} */ (reply));
      return;
    }
    /** Cancels the drawn surface when the signal aborts, until it has replied. @param {Surface} surface */
    const withdrawOn = (surface) => {
      if (!signal) return;
      const withdraw = () => surface.cancel('stopped');
      signal.addEventListener('abort', withdraw, { once: true });
      surface.on('reply', () => signal.removeEventListener('abort', withdraw));
    };
    const given = surfaceOptions.reply;
    if (given && typeof given === 'object' && /** @type {SurfaceReply} */ (given).surface === preview.surface) {
      // Already answered: the receipt goes inline when there is a target, and the reply stands.
      const host = typeof target === 'string' ? globalThis.document.querySelector(target) : target;
      if (host) {
        const receipt = new Surface(null, { ...surfaceOptions, document });
        host.append(receipt.toElement());
        onopen?.(receipt);
      }
      resolve(structuredClone(/** @type {SurfaceReply} */ (given)));
      return;
    }
    if (placement === 'inline') {
      const host = typeof target === 'string' ? globalThis.document.querySelector(target) : target;
      if (!host) {
        reject(new TypeError('An inline surface needs a "target" to be drawn into'));
        return;
      }
      const surface = new Surface(null, { ...surfaceOptions, document });
      surface.on('reply', (event) => resolve(/** @type {CustomEvent<{reply: SurfaceReply}>} */ (event).detail.reply));
      withdrawOn(surface);
      host.append(surface.toElement());
      onopen?.(surface);
      if (!surface.getReply()) surface.focus();
      return;
    }
    const Overlay = placement === 'sheet' ? Sheet : Dialog;
    const overlay = new Overlay(null, /** @type {any} */ ({
      title: preview?.title ?? '', size: placement === 'sheet' ? null : 'md', closable: true,
      ...(placement === 'sheet' ? { side } : {})
    }));
    const titleId = overlay.refs.title?.id ?? null;
    let surface;
    try {
      surface = new Surface(null, { ...surfaceOptions, document, labelledBy: titleId });
    } catch (error) {
      overlay.destroy();
      reject(error);
      return;
    }
    overlay.setContent(surface.toElement());
    overlay.el.classList.add('zx-surface-host');
    let settled = false;
    surface.on('reply', (event) => {
      settled = true;
      const { reply } = /** @type {CustomEvent<{reply: SurfaceReply}>} */ (event).detail;
      if (overlay.isOpen()) overlay.close();
      resolve(reply);
    });
    withdrawOn(surface);
    overlay.on('close', () => {
      if (!settled) surface.cancel('closed');
      queueMicrotask(() => {
        surface.destroy();
        overlay.destroy();
      });
    });
    overlay.open();
    onopen?.(surface);
    queueMicrotask(() => {
      if (overlay.isOpen()) surface.focus();
    });
  });
}

/* ------------------------------------------------------------------ module helpers -- */

/** Registers the Field types a schema property may name. Each registration is idempotent. */
function registerFields() {
  registerSelectFieldAdapter();
  registerChecklistFieldAdapter();
  registerDateboxFieldAdapters();
  registerToggleFieldAdapter();
  registerNumberFieldAdapter();
  registerRatingFieldAdapter();
  registerTagPickerFieldAdapter();
  registerSliderFieldAdapter();
}

/**
 * What the policy decided, read strictly: anything but a decision asks for a confirmation, and a
 * policy that throws denies.
 * @param {SurfacePolicy|null|undefined} policy @param {SurfaceAction} action @param {SurfaceDocument} doc
 * @returns {{level: PolicyLevel, confirmText?: string, message?: string}}
 */
function decide(policy, action, doc) {
  if (typeof policy !== 'function') return { level: 'allow' };
  /** @type {SurfaceAction} */
  const copy = { id: action.id, label: action.label };
  for (const key of /** @type {const} */ (['kind', 'tool', 'description'])) if (action[key] !== undefined) /** @type {any} */ (copy)[key] = action[key];
  let result;
  try {
    result = policy(Object.freeze(copy), doc);
  } catch {
    return { level: 'deny' };
  }
  if (typeof result === 'string') return LEVELS.has(result) ? { level: /** @type {PolicyLevel} */ (result) } : { level: 'confirm' };
  if (result && typeof result === 'object' && LEVELS.has(/** @type {string} */ (result.level))) {
    /** @type {{level: PolicyLevel, confirmText?: string, message?: string}} */
    const out = { level: result.level };
    if (typeof result.confirmText === 'string' && result.confirmText.trim()) out.confirmText = result.confirmText;
    if (typeof result.message === 'string') out.message = result.message;
    return out;
  }
  return { level: 'confirm' };
}

/**
 * The block a display node is drawn as.
 * @param {string} type @param {Record<string, any>} props
 * @returns {import('../../internal/agent-model.js').Block}
 */
function toBlock(type, props) {
  switch (type) {
    case 'text': return /** @type {any} */ ({ type: 'p', text: props.text });
    case 'heading': return /** @type {any} */ ({ type: 'heading', text: props.text, level: props.level ?? 2 });
    case 'list': return /** @type {any} */ ({ type: 'list', items: props.items, ordered: Boolean(props.ordered) });
    case 'quote': return /** @type {any} */ ({ type: 'quote', text: props.text });
    case 'code': return /** @type {any} */ ({ type: 'code', code: props.code, language: props.language ?? '' });
    case 'callout': return /** @type {any} */ ({ type: 'callout', text: props.text, title: props.title, tone: props.tone ?? 'info' });
    default: return /** @type {any} */ ({ type: 'figures', rows: props.rows });
  }
}

/**
 * Puts a container's children in order, moving only what is out of place, so focus and state
 * inside the children survive.
 * @param {Element} container @param {Element[]} children
 * @returns {void}
 */
function syncChildren(container, children) {
  const current = [...container.children];
  if (current.length === children.length && current.every((child, index) => child === children[index])) return;
  const keep = new Set(children);
  for (const child of current) if (!keep.has(child)) child.remove();
  children.forEach((child, index) => {
    const at = container.children[index];
    if (at !== child) container.insertBefore(child, at ?? null);
  });
}

/**
 * Gives a drawn heading node its level below the surface's title, up to h6, which the block
 * renderer alone cannot reach.
 * @param {HTMLElement} host @param {number} level
 * @returns {void}
 */
function settleHeading(host, level) {
  const drawn = host.querySelector('h1, h2, h3, h4, h5, h6');
  if (!drawn || drawn.localName === `h${level}`) return;
  const heading = document.createElement(`h${level}`);
  for (const attribute of drawn.attributes) heading.setAttribute(attribute.name, attribute.value);
  heading.append(...drawn.childNodes);
  drawn.replaceWith(heading);
}

/** @param {unknown} value @returns {2|3|4|5} */
function headingLevel(value) {
  const level = Math.trunc(Number(value) || 3);
  return /** @type {2|3|4|5} */ (Math.min(5, Math.max(2, level)));
}

/** @param {Record<string, any>} property @returns {Map<unknown, string>} */
function choiceLabels(property) {
  const source = property.type === 'array' ? property.items ?? {} : property;
  if (Array.isArray(source.enum)) return new Map(source.enum.map((/** @type {string} */ value) => [value, value]));
  const list = property.type === 'array' ? source.anyOf : property.oneOf;
  return new Map(Array.isArray(list) ? list.map((/** @type {any} */ choice) => [choice.const, choice.title]) : []);
}

/** @param {string} at @param {string} [locale] @returns {string} */
function formatTime(at, locale) {
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(String(at ?? ''));
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return `${match[4]}:${match[5]}`;
  }
}

/** @param {string} value @returns {Date|null} */
function parseLocal(value) {
  const match = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d)(?::(\d\d))?)?$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** @param {unknown} value @returns {value is {$data: string}} */
function isBinding(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && typeof (/** @type {any} */ (value).$data) === 'string' && Object.keys(value).length === 1;
}

/** @param {SurfaceNode} node @returns {boolean} */
function hasBinding(node) {
  return Object.values(node).some(isBinding);
}

/**
 * Where a drawn row keeps its position, so every row has an id of its own whatever the surface
 * names as its `rowId`: `#` cannot be part of a column id.
 */
const ROW_POSITION = '#position';

/**
 * The rows as a Table draws them. A column reads what the row itself holds: a column id every
 * object happens to inherit (`toString`) is an empty cell, not a function.
 * @param {Array<Record<string, unknown>>} rows @param {Array<{id: string}>} columns
 * @returns {Array<Record<string, unknown>>}
 */
function drawnRows(rows, columns) {
  return rows.map((row, index) => {
    const copy = { ...row, [ROW_POSITION]: `#${index}` };
    for (const column of columns) if (!Object.hasOwn(copy, column.id)) copy[column.id] = null;
    return copy;
  });
}

/**
 * A row's id for a Table: what the row holds under the surface's `rowId`, or, when it holds
 * nothing there, its position. Such a row can be selected but has no id to report.
 * @param {string} [key] @returns {(row: Record<string, unknown>) => unknown}
 */
function drawnRowId(key) {
  return (row) => ownValue(row, key) ?? row[ROW_POSITION];
}

/**
 * @param {Record<string, unknown>} row @param {string} [key]
 * @returns {unknown} What the row itself holds under the key, or `null`.
 */
function ownValue(row, key) {
  return key !== undefined && Object.hasOwn(row, key) ? row[key] ?? null : null;
}

/** @param {unknown} value @returns {value is {$ref: string, id: string}} */
function isRef(value) {
  return value !== null && typeof value === 'object' && typeof (/** @type {any} */ (value).$ref) === 'string'
    && typeof (/** @type {any} */ (value).id) === 'string';
}

/** @template T @param {T} value @returns {T} */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

