// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { formatFileSize } from '../../core/format.js';
import { ICON_SIZE, icon } from '../../core/icons.js';
import { rovingTabindex } from '../../core/keyboard.js';
import { position } from '../../core/position.js';
import { storage } from '../../core/storage.js';
import { uid } from '../../core/util.js';
import { Dialog } from '../dialog/dialog.js';
import { keyLabels } from '../kbd/kbd.js';
import { Launcher } from '../launcher/launcher.js';
import {
  addToQueue, emptyQueue, isQueueFull, queueLimit, removeFromQueue, takeNext
} from './queue.js';

/** @typedef {import('../launcher/launcher.js').LauncherItem} LauncherItem */

/**
 * Something the `@` trigger can mention: an agent, a person, a record.
 * @typedef {Object} MentionItem
 * @property {string|number} id Stable identifier.
 * @property {string} label Visible name; picking the item writes `@<label> ` into the text.
 * @property {string} [description] Secondary line in the suggestion list.
 * @property {string} [icon] Icon name drawn before the label.
 */

/**
 * Where mentions come from.
 * @typedef {Object} MentionSource
 * @property {string} [trigger='@'] Character that starts a mention.
 * @property {MentionItem[]|((query: string) => MentionItem[]|Promise<MentionItem[]>)} items The
 * items, filtered by the composer as the query changes, or a function that answers a query itself.
 */

/**
 * Something the message is about, shown as a removable chip above the text and sent with it.
 * @typedef {Object} ContextChip
 * @property {string} id Stable identifier.
 * @property {string} label Visible label.
 * @property {string} [icon] Icon name drawn before the label.
 * @property {unknown} [ref] Application data handed back in `send`; the composer never reads it.
 */

/**
 * A further button in the composer's bar, after Attach and Commands: a search toggle, a model's
 * parameters. The composer draws it and reports it; what it does is the application's.
 * @typedef {Object} ComposerTool
 * @property {string} id Stable identifier, handed back in `tool`.
 * @property {string} label Accessible name and tooltip; the button shows only the icon.
 * @property {string} icon Icon name: a built-in glyph or one the application registered.
 * @property {boolean} [pressed] Makes the tool a toggle, drawn with `aria-pressed`. Leave it out for
 * a plain button. The composer never changes it on its own: call `setToolPressed()`.
 * @property {boolean} [disabled=false] Whether the tool takes no clicks.
 * @property {boolean} [expanded] Makes the tool a disclosure, drawn with `aria-expanded`: a panel
 * of settings it opens. Like `pressed`, the application sets it.
 * @property {string} [controls] Id of what the tool opens, drawn as `aria-controls`.
 */

/**
 * @typedef {Object} ComposerToolDetail
 * @property {string} id The tool's id.
 * @property {ComposerTool} tool A copy of the tool as it stands, `pressed` included.
 */

/**
 * What `update()` changes in place. A key left out, or `undefined`, stays as it is.
 * @typedef {Object} ComposerUpdate
 * @property {string|null} [label] Accessible name; null resolves `composer.label` again.
 * @property {string} [placeholder] Placeholder of the text; empty removes it.
 * @property {string} [hint] Quiet text beside Send, as `setHint()`.
 * @property {string} [note] Line under the composer, as `setNote()`.
 * @property {'enter'|'mod+enter'} [submitKey] The key that sends.
 * @property {string|null} [sendLabel] Visible text on Send; null or empty makes it icon-only.
 * @property {boolean} [disabled] As `setDisabled()`.
 * @property {boolean} [busy] As `setBusy()`.
 */

/**
 * @typedef {Object} ComposerSendDetail
 * @property {string} text The message, trimmed.
 * @property {File[]} files Attached files, in the order they were added.
 * @property {MentionItem[]} mentions The picked mentions whose `@<label>` is still in the text.
 * @property {ContextChip[]} context The context chips.
 * @property {boolean} [queued] `true` on a message that waited in the queue. Absent otherwise.
 */

/**
 * A message waiting for the agent to finish. Everything it carries was taken when it was queued,
 * so it is sent as it was written.
 * @typedef {Object} QueuedMessage
 * @property {string} id Stable identifier, for `removeQueued()`.
 * @property {string} text The message, trimmed.
 * @property {File[]} files Attached files, in the order they were added.
 * @property {MentionItem[]} mentions The picked mentions whose `@<label>` is in the text.
 * @property {ContextChip[]} context The context chips when it was queued.
 */

/**
 * @typedef {Object} ComposerQueueDetail
 * @property {QueuedMessage} item The message added.
 * @property {QueuedMessage[]} items The whole queue, in order, the message added included.
 */

/**
 * @typedef {Object} ComposerDequeueDetail
 * @property {QueuedMessage} item The message that left the queue.
 * @property {QueuedMessage[]} items What is left of the queue, in order.
 * @property {'sent'|'removed'|'edited'|'cleared'} reason Why it left.
 */

/**
 * @typedef {Object} ComposerRemoveDetail
 * @property {'file'|'context'} kind What was removed.
 * @property {string} id The attachment's or chip's id.
 * @property {File} [file] The removed file, for `kind: 'file'`.
 * @property {ContextChip} [chip] The removed chip, for `kind: 'context'`.
 */

/**
 * @typedef {Object} ComposerOptions
 * @property {string|null} [label=null] Accessible name of the text and of the group around it.
 * Omitted resolves `composer.label`, English `Message`.
 * @property {string} [placeholder=''] Placeholder of the text.
 * @property {string} [value=''] Initial text. Without it, a saved draft is restored.
 * @property {'enter'|'mod+enter'} [submitKey='enter'] `'enter'`: Enter sends and Shift+Enter breaks
 * the line. `'mod+enter'`: Cmd+Enter (Ctrl+Enter elsewhere) sends and Enter breaks the line.
 * @property {boolean} [busy=false] Whether an agent is working: Send becomes Stop.
 * @property {boolean} [queue=false] Whether the send key holds a message back while the agent works.
 * It is sent when the agent is no longer busy, one message each time busy ends, in order. The queue
 * lives as long as the composer: it is not kept with the draft.
 * @property {number} [queueLimit=10] Most messages that wait at once. At the limit the send key is
 * refused, and the hint says why.
 * @property {boolean} [disabled=false] Whether the composer takes no input.
 * @property {boolean} [attachments=false] Whether files can be attached: an Attach button, paste,
 * and drop.
 * @property {string} [accept=''] File types accepted, in the `<input type="file">` syntax
 * (`'image/*,.pdf'`). Empty accepts every file.
 * @property {number} [maxFiles=10] Most files one message carries.
 * @property {MentionSource|null} [mentions=null] Enables `@` mentions.
 * @property {LauncherItem[]|null} [commands=null] Commands opened by `/` on an empty text, in a
 * Launcher; an item with `items` opens a page of further commands.
 * @property {ContextChip[]} [context=[]] Initial context chips.
 * @property {string} [hint=''] Quiet text in the bar beside Send.
 * @property {string} [note=''] Quiet line under the composer.
 * @property {string|null} [draftKey=null] Key the unsent text is kept under (through `storage()`),
 * restored on create and cleared on send.
 * @property {number} [minRows=1] Rows the text never shrinks below, even when empty. Capped at
 * `maxRows`.
 * @property {number} [maxRows=10] Rows the text grows to before it scrolls.
 * @property {{attach?: string, commands?: string}} [icons={}] Glyph names for the Attach and Commands
 * buttons (a paperclip, a book) where the application registered its own.
 * @property {ComposerTool[]} [tools=[]] Further icon buttons in the bar, after Attach and Commands.
 * An entry without `id`, `label` or `icon` is left out, as is a repeated id.
 * @property {string|null} [sendLabel=null] Visible text beside the Send glyph (`'Start task'`), which
 * is then also its accessible name; while busy the button reads `composer.stop`. Null keeps Send
 * icon-only. In a composer narrower than 24rem the text is visually hidden and stays the name.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<ComposerSendDetail>) => void} [onsend] Preventable send listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onstop] Stop listener.
 * @property {(event: CustomEvent<{text: string}>) => void} [oninput] Text listener.
 * @property {(event: CustomEvent<{files: File[]}>) => void} [onattach] Preventable attach listener.
 * @property {(event: CustomEvent<ComposerRemoveDetail>) => void} [onremove] Chip removal listener.
 * @property {(event: CustomEvent<{item: MentionItem}>) => void} [onmention] Mention listener.
 * @property {(event: CustomEvent<{item: LauncherItem}>) => void} [oncommand] Command listener.
 * @property {(event: CustomEvent<ComposerToolDetail>) => void} [ontool] Tool listener.
 * @property {(event: CustomEvent<ComposerQueueDetail>) => void} [onqueue] Listener for a message being
 * queued.
 * @property {(event: CustomEvent<ComposerDequeueDetail>) => void} [ondequeue] Listener for a message
 * leaving the queue.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onhistoryprevious] Listener for
 * ArrowUp on an empty text.
 */

const MESSAGES = Object.freeze({
  'composer.label': 'Message',
  'composer.send': 'Send',
  'composer.stop': 'Stop',
  'composer.attach': 'Attach files',
  'composer.remove': 'Remove %1',
  'composer.attachments': 'Attachments',
  'composer.context': 'Context',
  'composer.suggestions': 'Suggestions',
  'composer.match': '1 suggestion',
  'composer.matches': '%1 suggestions',
  'composer.commands': 'Commands',
  'composer.commandsPlaceholder': 'Search commands',
  'composer.drop': 'Drop files to attach',
  'composer.queue': 'Queued (%1)',
  'composer.queued': 'Queued; sends when the agent finishes',
  'composer.queueEdit': 'Edit',
  'composer.queueFile': '1 file',
  'composer.queueFiles': '%1 files',
  'composer.queueFull': 'Queue full (limit %1)',
  'composer.queueRemove': 'Remove',
  'composer.queueReplaceConfirm': 'Replace',
  'composer.queueReplaceMessage': 'The queued message takes its place in the message box.',
  'composer.queueReplaceTitle': 'Replace what you have written?'
});

/** Namespace the drafts are stored under. */
const DRAFT_NAMESPACE = 'composer';

/** Where a command copy given to the launcher keeps the application's own item. */
const COMMAND_SOURCE = Symbol('composer.command');

/**
 * Where a mention starts and what has been typed of it: the text after the trigger up to the caret,
 * when the trigger opens a word and the query holds no whitespace.
 * @param {string} text The whole text.
 * @param {number} caret Caret offset.
 * @param {string} [trigger='@'] Character that starts a mention.
 * @returns {{start: number, query: string}|null}
 */
export function mentionQuery(text, caret, trigger = '@') {
  const mark = String(trigger || '@');
  const before = String(text ?? '').slice(0, Math.max(0, Number(caret) || 0));
  const start = before.lastIndexOf(mark);
  if (start < 0) return null;
  if (start > 0 && !/\s/.test(before[start - 1])) return null;
  const query = before.slice(start + mark.length);
  if (/\s/.test(query)) return null;
  return { start, query };
}

/**
 * The items that match a mention query, best first: a label that starts with it, then a word in
 * the label that does, then a label or description that contains it. Case and accents are ignored;
 * items that rank the same keep their order. An empty query keeps every item.
 * @param {MentionItem[]} items
 * @param {string} query
 * @returns {MentionItem[]}
 */
export function filterMentions(items, query) {
  const list = Array.isArray(items) ? items.filter(isMentionItem) : [];
  const needle = fold(query);
  if (!needle) return list;
  return list
    .map((item, order) => ({ item, order, rank: mentionRank(item, needle) }))
    .filter((entry) => entry.rank < 4)
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((entry) => entry.item);
}

/**
 * The picked mentions whose `@<label>` is still in the text, each once.
 * @param {string} text
 * @param {MentionItem[]} mentions Mentions in the order they were picked.
 * @param {string} [trigger='@']
 * @returns {MentionItem[]}
 */
export function mentionsInText(text, mentions, trigger = '@') {
  const source = String(text ?? '');
  const seen = new Set();
  return (Array.isArray(mentions) ? mentions : []).filter((item) => {
    if (!isMentionItem(item)) return false;
    const key = String(item.id);
    if (seen.has(key) || !source.includes(`${trigger}${item.label}`)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Whether a key press sends. A press during an IME composition never does.
 * @param {{key: string, shiftKey?: boolean, metaKey?: boolean, ctrlKey?: boolean, altKey?: boolean,
 *   isComposing?: boolean, keyCode?: number}} event Key event, or its fields.
 * @param {'enter'|'mod+enter'} [submitKey='enter']
 * @param {{apple?: boolean}} [platform] `apple`: whether Mod is Cmd (otherwise Ctrl). Read from the
 * browser when omitted.
 * @returns {boolean}
 */
export function isSubmitKey(event, submitKey = 'enter', { apple = isApplePlatform() } = {}) {
  if (!event || event.key !== 'Enter') return false;
  // 229 is the key code a browser reports for a key the input method is still processing.
  if (event.isComposing || event.keyCode === 229) return false;
  if (event.shiftKey || event.altKey) return false;
  if (submitKey === 'mod+enter') {
    return apple
      ? Boolean(event.metaKey) && !event.ctrlKey
      : Boolean(event.ctrlKey) && !event.metaKey;
  }
  return true;
}

/**
 * Whether a file matches an `accept` list in the `<input type="file">` syntax: extensions
 * (`.pdf`), whole MIME types (`application/json`), and MIME groups (`image/*`).
 * @param {{name?: string, type?: string}} file
 * @param {string} [accept='']
 * @returns {boolean}
 */
export function acceptsFile(file, accept = '') {
  const tokens = String(accept ?? '').split(',').map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const name = String(file?.name ?? '').toLowerCase();
  const type = String(file?.type ?? '').toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

/**
 * The rows the text spans at least and at most: whole numbers of one or more, the least never above
 * the most.
 * @param {number} [minRows=1]
 * @param {number} [maxRows=10]
 * @returns {{min: number, max: number}}
 */
export function rowRange(minRows = 1, maxRows = 10) {
  const max = Math.max(1, Math.floor(Number(maxRows) || 1));
  const min = Math.min(max, Math.max(1, Math.floor(Number(minRows) || 1)));
  return { min, max };
}

/**
 * The height an auto-growing text area takes for its content: at least `minRows` lines, at most
 * `maxRows`, scrolling beyond that.
 * @param {number} scrollHeight The content height, padding included (`textarea.scrollHeight`).
 * @param {{lineHeight: number, padding?: number, border?: number, minRows?: number, maxRows?: number}} metrics
 * Line height and the block padding and border, in pixels.
 * @returns {{height: number, scrolls: boolean}} The border-box height, and whether the content
 * overflows it.
 */
export function autosizeHeight(scrollHeight, { lineHeight, padding = 0, border = 0, minRows = 1, maxRows = 10 }) {
  const line = Number(lineHeight) > 0 ? Number(lineHeight) : 20;
  const { min, max } = rowRange(minRows, maxRows);
  const most = max * line + padding;
  const content = Math.min(most, Math.max(min * line + padding, Number(scrollHeight) || 0));
  return { height: Math.ceil(content + border), scrolls: Number(scrollHeight) > most + 1 };
}

/**
 * The bar's extra tools as the composer draws them: entries without an `id`, a non-empty `label`
 * or an `icon` are left out, a repeated id keeps its first entry, `id`, `label` and `icon` become
 * strings, `disabled` a boolean, and `pressed` stays only when it is a boolean. Any other field the
 * application put on a tool is kept, and handed back in `tool`.
 * @param {unknown} tools
 * @returns {ComposerTool[]}
 */
export function normalizeTools(tools) {
  /** @type {ComposerTool[]} */
  const list = [];
  const seen = new Set();
  for (const entry of Array.isArray(tools) ? tools : []) {
    if (!entry || typeof entry !== 'object') continue;
    const tool = /** @type {Partial<ComposerTool> & Record<string, unknown>} */ (entry);
    const id = tool.id == null ? '' : String(tool.id);
    const label = tool.label == null ? '' : String(tool.label).trim();
    const glyph = tool.icon == null ? '' : String(tool.icon);
    if (!id || !label || !glyph || seen.has(id)) continue;
    seen.add(id);
    const { pressed, ...rest } = tool;
    /** @type {ComposerTool} */
    const normalized = { ...rest, id, label, icon: glyph, disabled: Boolean(tool.disabled) };
    if (typeof pressed === 'boolean') normalized.pressed = pressed;
    list.push(normalized);
  }
  return list;
}

/**
 * A message box for talking to an agent: a text that grows with what is written, Send (Stop while
 * the agent works), attachments, `@` mentions, `/` commands, and context chips. It keeps nothing
 * but the unsent message: sending hands the text, files, mentions and context to the application,
 * which owns the conversation. With `queue`, a message written while the agent works waits here
 * until it is no longer busy.
 *
 * @fires Composer#send
 * @fires Composer#stop
 * @fires Composer#input
 * @fires Composer#attach
 * @fires Composer#remove
 * @fires Composer#mention
 * @fires Composer#command
 * @fires Composer#tool
 * @fires Composer#queue
 * @fires Composer#dequeue
 * @fires Composer#historyprevious
 * @extends {Component<ComposerOptions>}
 */
export class Composer extends Component {
  static cssName = 'composer';

  /** @type {Readonly<ComposerOptions>} */
  static defaults = {
    label: null,
    placeholder: '',
    value: '',
    submitKey: 'enter',
    busy: false,
    queue: false,
    queueLimit: 10,
    disabled: false,
    attachments: false,
    accept: '',
    maxFiles: 10,
    mentions: null,
    commands: null,
    context: [],
    hint: '',
    note: '',
    draftKey: null,
    minRows: 1,
    maxRows: 10,
    icons: {},
    tools: [],
    sendLabel: null,
    msg: MESSAGES
  };

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._original = created ? null : snapshotTarget(root);
    if (!created) root.replaceChildren();

    const options = this.options;
    /** @type {{id: string, file: File}[]} */
    this._files = [];
    /** @type {ContextChip[]} */
    this._context = [];
    /** @type {MentionItem[]} */
    this._mentions = [];
    /** @type {{start: number, end: number, items: MentionItem[], index: number}|null} */
    this._mention = null;
    this._mentionSequence = 0;
    /** @type {import('../../core/position.js').PositionController|null} */
    this._position = null;
    /** @type {Launcher|null} */
    this._launcher = null;
    this._announced = '';
    this._busy = Boolean(options.busy);
    this._disabled = Boolean(options.disabled);
    this._destroyed = false;
    this._width = 0;
    /** What the Send button last drew: mode, send key and label, so it redraws only on a change. */
    this._sendDrawn = '';
    /** @type {QueuedMessage[]} Session state: never saved with the draft. */
    this._queue = [];
    this._queueLimit = queueLimit(options.queueLimit);
    /** Whether the send key was refused at the limit, which the hint then says. */
    this._queueRefused = false;
    /** @type {{destroy: () => void}[]} The keyboard of each queued row. */
    this._queueRoving = [];
    /** Whether a queued message is being sent, and whether busy ended again meanwhile. */
    this._sendingQueued = false;
    this._busyEndedAgain = false;
    /** The application's hint, which `_syncHint()` shows unless the queue has something to say. */
    this._hint = String(options.hint ?? '');
    this._mentionSource = normalizeMentionSource(options.mentions);
    this._commands = Array.isArray(options.commands) && options.commands.length ? options.commands : null;
    this._draft = options.draftKey ? storage(DRAFT_NAMESPACE) : null;
    this._tools = normalizeTools(options.tools);
    this._sendLabel = sendLabelText(options.sendLabel);
    this._rows = rowRange(options.minRows, Number(options.maxRows) || 10);

    const label = this._labelText(options.label);
    const listId = uid('zx-composer-suggestions');
    const noteId = uid('zx-composer-note');
    /** @type {'enter'|'mod+enter'} */
    this._submitKey = submitKeyOf(options.submitKey);

    const input = /** @type {HTMLTextAreaElement} */ (h('textarea', {
      ref: 'input',
      class: 'zx-composer__input',
      rows: this._rows.min,
      ariaLabel: label,
      ariaDescribedby: options.note ? noteId : null,
      placeholder: options.placeholder || null,
      spellcheck: true
    }));
    this._input = input;
    const context = h('ul', {
      ref: 'context', class: 'zx-composer__chips', dataset: { kind: 'context' },
      ariaLabel: this.msg('composer.context'), hidden: true
    });
    const files = h('ul', {
      ref: 'files', class: 'zx-composer__chips', dataset: { kind: 'file' },
      ariaLabel: this.msg('composer.attachments'), hidden: true
    });
    const fileInput = options.attachments ? /** @type {HTMLInputElement} */ (h('input', {
      ref: 'fileInput', class: 'zx-composer__file-input', type: 'file', multiple: true,
      accept: options.accept || null, hidden: true, tabindex: '-1'
    })) : null;
    const glyphs = { attach: 'plus', commands: 'list', ...(options.icons ?? {}) };
    const attach = options.attachments ? iconButton(glyphs.attach, this.msg('composer.attach'), 'attach') : null;
    const commands = this._commands ? iconButton(glyphs.commands, this.msg('composer.commands'), 'commands') : null;
    commands?.setAttribute('aria-keyshortcuts', '/');
    commands?.setAttribute('aria-haspopup', 'dialog');
    const tools = h('span', { ref: 'tools', class: 'zx-composer__tools', hidden: true });
    const send = /** @type {HTMLButtonElement} */ (h('button', {
      ref: 'send', type: 'button', class: 'zx-icon-btn zx-composer__send'
    }));
    const hint = h('span', { ref: 'hint', class: 'zx-composer__hint', hidden: !options.hint }, String(options.hint ?? ''));
    const queueLabelId = uid('zx-composer-queue');
    const queue = options.queue ? h('div', { ref: 'queue', class: 'zx-composer__queue', hidden: true },
      h('span', { ref: 'queueLabel', class: 'zx-composer__queue-label', id: queueLabelId }),
      h('ol', { ref: 'queueList', class: 'zx-composer__queue-list', 'aria-labelledby': queueLabelId })) : null;
    const frame = h('div', { ref: 'frame', class: 'zx-composer__frame' },
      queue,
      context,
      files,
      input,
      h('div', { class: 'zx-composer__bar' },
        attach, fileInput, commands, tools, hint,
        h('span', { class: 'zx-composer__spacer' }),
        send),
      options.attachments
        ? h('div', { class: 'zx-composer__drop', ariaHidden: 'true' }, icon('upload'), this.msg('composer.drop'))
        : null);
    const list = h('div', {
      ref: 'list', class: 'zx-composer__suggestions', id: listId, role: 'listbox',
      ariaLabel: this.msg('composer.suggestions'), hidden: true
    });
    const status = h('div', { ref: 'status', class: 'zx-composer__status', role: 'status', ariaLive: 'polite' });
    const note = h('p', { ref: 'note', class: 'zx-composer__note', id: noteId, hidden: !options.note }, String(options.note ?? ''));

    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', label);
    root.append(...[frame, note, list, status].filter((node) => node !== null));

    for (const chip of Array.isArray(options.context) ? options.context : []) this._putContext(chip);
    const initial = typeof options.value === 'string' && options.value
      ? options.value
      : (this._draft ? String(this._draft.get(String(options.draftKey), '') ?? '') : '');
    input.value = initial;
    this._syncState();
    this._syncSend();

    this.listen(input, 'input', () => this._onInput());
    this.listen(input, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(input, 'keyup', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(/** @type {KeyboardEvent} */ (event).key)) this._updateMentions();
    });
    this.listen(input, 'click', () => this._updateMentions());
    this.listen(input, 'blur', () => this._closeMentions());
    this.listen(input, 'paste', (event) => this._onPaste(/** @type {ClipboardEvent} */ (event)));
    this.listen(send, 'click', () => {
      if (this._busy) this._stop();
      else this._send();
    });
    if (attach && fileInput) {
      this.listen(attach, 'click', () => fileInput.click());
      this.listen(fileInput, 'change', () => {
        const picked = Array.from(fileInput.files ?? []);
        fileInput.value = '';
        this._addFiles(picked, true);
        input.focus();
      });
    }
    if (commands) this.listen(commands, 'click', () => this._openCommands());
    this.listen(tools, 'click', (event) => this._onToolClick(/** @type {MouseEvent} */ (event)));
    this.listen(frame, 'click', (event) => this._onChipClick(/** @type {MouseEvent} */ (event)));
    if (queue) {
      this.listen(this.refs.queueList, 'click', (event) => this._onQueueClick(/** @type {MouseEvent} */ (event)));
      this.listen(this.refs.queueList, 'keydown', (event) => this._onQueueKeydown(/** @type {KeyboardEvent} */ (event)));
    }
    // The suggestions keep the focus in the text: a press picks without blurring it.
    this.listen(list, 'mousedown', (event) => event.preventDefault());
    this.listen(list, 'click', (event) => {
      const option = /** @type {Element|null} */ (event.target)?.closest?.('[role="option"]');
      if (option && this._mention) this._pickMention(Number(/** @type {HTMLElement} */ (option).dataset.index));
    });
    this.listen(list, 'pointermove', (event) => {
      const option = /** @type {Element|null} */ (event.target)?.closest?.('[role="option"]');
      const index = Number(/** @type {HTMLElement|null} */ (option)?.dataset.index);
      if (option && this._mention && index !== this._mention.index) this._highlight(index);
    });
    if (options.attachments) {
      this.listen(root, 'dragenter', (event) => this._onDrag(/** @type {DragEvent} */ (event)));
      this.listen(root, 'dragover', (event) => this._onDrag(/** @type {DragEvent} */ (event)));
      this.listen(root, 'dragleave', (event) => {
        const related = /** @type {Node|null} */ (/** @type {DragEvent} */ (event).relatedTarget);
        if (!related || !root.contains(related)) this._setDropping(false);
      });
      this.listen(root, 'drop', (event) => this._onDrop(/** @type {DragEvent} */ (event)));
    }

    // The text re-wraps when its width changes, so its height is measured again.
    this._observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
        const width = input.clientWidth;
        if (width === this._width) return;
        this._width = width;
        this._autosize();
      })
      : null;
    this._observer?.observe(input);
    this._autosize();
    return root;
  }

  /** Focuses the text. @returns {this} */
  focus() {
    this._input.focus();
    return this;
  }

  /** @returns {string} The text as written. */
  getValue() {
    return this._input.value;
  }

  /**
   * Replaces the text, keeps the draft in step, and puts the caret at the end. Emits nothing.
   * @param {string} text
   * @returns {this}
   */
  setValue(text) {
    const input = this._input;
    input.value = String(text ?? '');
    input.setSelectionRange(input.value.length, input.value.length);
    this._closeMentions();
    this._afterTextChange();
    return this;
  }

  /**
   * Types text at the caret, replacing any selection, as if the person had typed it: the draft
   * follows, and text ending in the mention trigger (`'@'`) opens the suggestions. Emits `input`.
   * Use it for a button that starts a mention or inserts a snippet.
   * @param {string} text
   * @returns {this}
   */
  insertText(text) {
    const input = this._input;
    const value = String(text ?? '');
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.setRangeText(value, start, end, 'end');
    input.focus();
    this._onInput();
    return this;
  }

  /**
   * Empties the text, the attachments and the draft. Context chips stay. Emits nothing.
   * @returns {this}
   */
  clear() {
    this._input.value = '';
    this._mentions = [];
    this._files = [];
    this._renderFiles();
    this._closeMentions();
    this._afterTextChange();
    return this;
  }

  /**
   * Shows Stop in place of Send while an agent works; Escape in the text then emits `stop`. When
   * busy ends, the first queued message is sent; the next waits for the next time it ends.
   * @param {boolean} busy
   * @returns {this}
   * @fires Composer#send
   * @fires Composer#dequeue
   */
  setBusy(busy) {
    const ended = this._busy && !busy;
    this._busy = Boolean(busy);
    this._syncSend();
    if (ended) this._sendNextQueued();
    return this;
  }

  /** @returns {boolean} Whether Stop is showing. */
  isBusy() {
    return this._busy;
  }

  /**
   * Changes the quiet text in the bar beside Send — what Enter does now, or why sending waits.
   * An empty text hides it.
   * @param {string} text
   * @returns {this}
   */
  setHint(text) {
    this._hint = String(text ?? '');
    this._syncHint();
    return this;
  }

  /**
   * Changes the line under the composer, which also describes the text box. An empty text hides
   * it.
   * @param {string} text
   * @returns {this}
   */
  setNote(text) {
    const note = /** @type {HTMLElement} */ (this.refs.note);
    note.textContent = String(text ?? '');
    note.hidden = !note.textContent;
    if (note.hidden) this._input.removeAttribute('aria-describedby');
    else this._input.setAttribute('aria-describedby', note.id);
    return this;
  }

  /**
   * Turns input on or off.
   * @param {boolean} disabled
   * @returns {this}
   */
  setDisabled(disabled) {
    this._disabled = Boolean(disabled);
    if (this._disabled) {
      this._closeMentions();
      this._setDropping(false);
    }
    this._syncState();
    this._syncSend();
    return this;
  }

  /**
   * Changes the composer in place: the text, its caret and selection, the focus, the attachments,
   * the context chips and the draft all stay. This is how a placeholder follows the model picked
   * beside the composer. Keys left out (or `undefined`) are kept; other keys are ignored. Emits
   * nothing.
   * @param {ComposerUpdate} [partial={}]
   * @returns {this}
   */
  update(partial = {}) {
    if (this._destroyed || !partial || typeof partial !== 'object') return this;
    /** @param {keyof ComposerUpdate} key @returns {boolean} */
    const has = (key) => Object.hasOwn(partial, key) && partial[key] !== undefined;
    const input = this._input;
    if (has('label')) {
      const label = this._labelText(partial.label);
      input.setAttribute('aria-label', label);
      this.el.setAttribute('aria-label', label);
    }
    if (has('placeholder')) {
      const placeholder = String(partial.placeholder ?? '');
      if (placeholder) input.placeholder = placeholder;
      else input.removeAttribute('placeholder');
    }
    if (has('hint')) this.setHint(String(partial.hint ?? ''));
    if (has('note')) this.setNote(String(partial.note ?? ''));
    if (has('submitKey')) this._submitKey = submitKeyOf(partial.submitKey);
    if (has('sendLabel')) this._sendLabel = sendLabelText(partial.sendLabel);
    if (has('disabled')) this.setDisabled(Boolean(partial.disabled));
    if (has('busy')) this.setBusy(Boolean(partial.busy));
    this._syncSend();
    return this;
  }

  /**
   * Replaces the bar's extra tools. A tool that held the focus keeps it when a tool with the same
   * id is still there (and enabled); otherwise the focus moves to the text. Emits nothing.
   * @param {ComposerTool[]} tools
   * @returns {this}
   */
  setTools(tools) {
    if (this._destroyed) return this;
    this._tools = normalizeTools(tools);
    this._renderTools();
    return this;
  }

  /**
   * Presses or releases a tool, which makes it a toggle if it was a plain button. Emits nothing.
   * @param {string} id
   * @param {boolean} pressed
   * @returns {this}
   */
  setToolPressed(id, pressed) {
    const tool = this._tools.find((entry) => entry.id === String(id));
    if (!tool) return this;
    tool.pressed = Boolean(pressed);
    this._toolButton(tool.id)?.setAttribute('aria-pressed', String(tool.pressed));
    return this;
  }

  /**
   * Attaches files, as far as `accept` and `maxFiles` allow. Emits `attach` with the files taken.
   * @param {FileList|File[]} files
   * @returns {this}
   */
  addFiles(files) {
    this._addFiles(Array.from(files ?? []), false);
    return this;
  }

  /** @returns {File[]} The attached files. */
  getFiles() {
    return this._files.map((entry) => entry.file);
  }

  /**
   * Adds a context chip, or replaces the chip with the same id. Emits nothing.
   * @param {ContextChip} chip
   * @returns {this}
   */
  addContext(chip) {
    this._putContext(chip);
    this._renderContext();
    return this;
  }

  /**
   * Removes a context chip. Emits nothing.
   * @param {string} id
   * @returns {this}
   */
  removeContext(id) {
    this._context = this._context.filter((chip) => chip.id !== String(id));
    this._renderContext();
    return this;
  }

  /** @returns {ContextChip[]} The context chips. */
  getContext() {
    return this._context.map((chip) => ({ ...chip }));
  }

  /** @returns {QueuedMessage[]} Copies of the queued messages, the next to be sent first. */
  getQueue() {
    return this._queue.map(copyQueued);
  }

  /**
   * Removes every queued message. Emits `dequeue` for each, with `reason: 'cleared'`. Stop does not
   * do this: call it from a `stop` listener to drop what was waiting along with the run.
   * @returns {this}
   * @fires Composer#dequeue
   */
  clearQueue() {
    const { queue, items } = emptyQueue(this._queue);
    if (!items.length) return this;
    this._queue = queue;
    this._renderQueue();
    for (const item of items) this._emitDequeue(item, 'cleared');
    return this;
  }

  /**
   * Removes one queued message. Emits `dequeue` with `reason: 'removed'`. An id that is not queued,
   * because the message has been sent, say, changes nothing.
   * @param {string} id
   * @returns {this}
   * @fires Composer#dequeue
   */
  removeQueued(id) {
    const { queue, item } = removeFromQueue(this._queue, String(id));
    if (!item) return this;
    this._queue = queue;
    this._renderQueue();
    this._emitDequeue(item, 'removed');
    return this;
  }

  /**
   * Removes what the composer drew and the launcher it opened, drops the queue, and stops listening.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._queue = [];
    this._releaseQueueRoving();
    this._mentionSequence += 1;
    this._observer?.disconnect();
    this._observer = null;
    this._position?.destroy();
    this._position = null;
    this._launcher?.destroy();
    this._launcher = null;
    super.destroy();
    if (this._original) restoreTarget(this.el, this._original);
  }

  /* ------------------------------------------------------------------ text -- */

  /** @private @returns {void} */
  _onInput() {
    this._afterTextChange();
    this._updateMentions();
    this.emit('input', { text: this._input.value });
  }

  /** @private @returns {void} */
  _afterTextChange() {
    this._autosize();
    this._syncSend();
    this._saveDraft();
  }

  /** @private @returns {void} */
  _saveDraft() {
    if (!this._draft) return;
    const key = String(this.options.draftKey);
    if (this._input.value) this._draft.set(key, this._input.value);
    else this._draft.remove(key);
  }

  /** Grows the text with its content, between `minRows` and `maxRows`. @private @returns {void} */
  _autosize() {
    const input = this._input;
    if (!input.isConnected || typeof getComputedStyle !== 'function') return;
    input.style.blockSize = 'auto';
    const style = getComputedStyle(input);
    const fontSize = parseFloat(style.fontSize) || 16;
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.5;
    const padding = (parseFloat(style.paddingBlockStart) || 0) + (parseFloat(style.paddingBlockEnd) || 0);
    const border = (parseFloat(style.borderBlockStartWidth) || 0) + (parseFloat(style.borderBlockEndWidth) || 0);
    const { height, scrolls } = autosizeHeight(input.scrollHeight, {
      lineHeight, padding, border, minRows: this._rows.min, maxRows: this._rows.max
    });
    input.style.blockSize = `${height}px`;
    input.dataset.scrolls = String(scrolls);
  }

  /* ------------------------------------------------------------------ keys -- */

  /**
   * @private
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  _onKeydown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    const mention = this._mention;
    if (mention) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this._highlight((mention.index + step + mention.items.length) % mention.items.length);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey && !event.altKey
        && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        this._pickMention(mention.index);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this._closeMentions();
        return;
      }
    }
    const plain = !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey;
    if (isSubmitKey(event, this._submitKey)) {
      event.preventDefault();
      this._send();
    } else if (event.key === 'Escape' && this._busy) {
      event.preventDefault();
      this._stop();
    } else if (event.key === 'ArrowUp' && plain && this._input.value === '') {
      event.preventDefault();
      this.emit('historyprevious', {});
    } else if (event.key === '/' && plain && this._input.value === '' && this._commands) {
      event.preventDefault();
      this._openCommands();
    }
  }

  /* ------------------------------------------------------------- send/stop -- */

  /**
   * The message as it stands in the composer, or null when there is nothing to send.
   * @private
   * @returns {ComposerSendDetail|null}
   */
  _message() {
    const text = this._input.value.trim();
    const files = this.getFiles();
    if (!text && !files.length) return null;
    const trigger = this._mentionSource?.trigger ?? '@';
    return {
      text,
      files,
      mentions: mentionsInText(text, this._mentions, trigger).map((item) => ({ ...item })),
      context: this.getContext()
    };
  }

  /** @private @returns {void} @fires Composer#send @fires Composer#queue */
  _send() {
    if (this._disabled) return;
    if (this._busy) {
      if (this.options.queue) this._enqueue();
      return;
    }
    const detail = this._message();
    if (!detail) return;
    const event = this.emit('send', detail, { honorDomCancellation: true });
    if (event.defaultPrevented || this._destroyed) return;
    this.clear();
  }

  /** @private @returns {void} @fires Composer#stop */
  _stop() {
    if (!this._busy) return;
    this.emit('stop', {});
  }

  /**
   * The Send button's glyph, text, name and readiness. With `sendLabel` the text is visible and is
   * the name; without it the button is a glyph named by `aria-label` alone.
   * @private
   * @returns {void}
   */
  _syncSend() {
    const button = /** @type {HTMLButtonElement} */ (this.refs.send);
    const busy = this._busy;
    const mode = busy ? 'stop' : 'send';
    const drawn = `${mode}\n${this._submitKey}\n${this._sendLabel}`;
    if (drawn !== this._sendDrawn) {
      this._sendDrawn = drawn;
      const chord = this._submitKey === 'mod+enter' ? 'Mod+Enter' : 'Enter';
      const apple = isApplePlatform();
      const name = busy ? this.msg('composer.stop') : (this._sendLabel || this.msg('composer.send'));
      const keys = busy ? 'Escape' : (chord === 'Enter' ? 'Enter' : `${apple ? 'Meta' : 'Control'}+Enter`);
      const shown = keyLabels(busy ? 'Escape' : chord, { apple }).join(apple ? '' : '+');
      button.dataset.mode = mode;
      const glyph = icon(busy ? 'square' : 'arrow-up', { size: ICON_SIZE.control });
      if (this._sendLabel) button.replaceChildren(glyph, h('span', { class: 'zx-composer__send-label' }, name));
      else button.replaceChildren(glyph);
      button.setAttribute('aria-label', name);
      button.setAttribute('aria-keyshortcuts', keys);
      button.title = `${name} (${shown})`;
    }
    // Never disabled while the composer is live: a disabled button drops the focus it holds.
    const empty = !this._input.value.trim() && !this._files.length;
    button.setAttribute('aria-disabled', String(!busy && empty));
  }

  /** The quiet text beside Send: why the queue refused, else the application's. @private @returns {void} */
  _syncHint() {
    const hint = /** @type {HTMLElement} */ (this.refs.hint);
    hint.textContent = this._queueRefused ? this.msg('composer.queueFull', this._queueLimit) : this._hint;
    hint.hidden = !hint.textContent;
  }

  /** Disabled state on the text and the buttons. @private @returns {void} */
  _syncState() {
    const disabled = this._disabled;
    this._input.disabled = disabled;
    if (disabled) this.el.setAttribute('aria-disabled', 'true');
    else this.el.removeAttribute('aria-disabled');
    for (const button of this.el.querySelectorAll('.zx-composer__frame button')) {
      /** @type {HTMLButtonElement} */ (button).disabled = disabled;
    }
    this._renderTools();
    this._renderFiles();
    this._renderContext();
  }

  /**
   * The accessible name for a `label` option: the text given, or the `composer.label` message.
   * @private
   * @param {string|null|undefined} label
   * @returns {string}
   */
  _labelText(label) {
    return String(label ?? this.msg('composer.label'));
  }

  /* ----------------------------------------------------------------- tools -- */

  /**
   * Draws the extra tools, and puts the focus back on the tool that held it.
   * @private
   * @returns {void}
   */
  _renderTools() {
    const box = /** @type {HTMLElement} */ (this.refs.tools);
    const active = /** @type {HTMLElement|null} */ (box.ownerDocument.activeElement);
    const focused = active && box.contains(active) ? active.dataset.tool ?? null : null;
    box.hidden = this._tools.length === 0;
    box.replaceChildren(...this._tools.map((tool) => {
      const button = iconButton(tool.icon, tool.label, 'tool');
      button.dataset.tool = tool.id;
      if (typeof tool.pressed === 'boolean') button.setAttribute('aria-pressed', String(tool.pressed));
      if (typeof tool.expanded === 'boolean') button.setAttribute('aria-expanded', String(tool.expanded));
      if (tool.controls) button.setAttribute('aria-controls', String(tool.controls));
      button.disabled = this._disabled || Boolean(tool.disabled);
      return button;
    }));
    if (focused === null) return;
    const next = this._toolButton(focused);
    if (next && !next.disabled) next.focus();
    else if (!this._input.disabled) this._input.focus();
  }

  /**
   * @private
   * @param {string} id
   * @returns {HTMLButtonElement|null}
   */
  _toolButton(id) {
    const buttons = /** @type {HTMLButtonElement[]} */ (Array.from(this.refs.tools.children));
    return buttons.find((button) => button.dataset.tool === id) ?? null;
  }

  /**
   * @private
   * @param {MouseEvent} event
   * @returns {void}
   * @fires Composer#tool
   */
  _onToolClick(event) {
    const button = /** @type {HTMLButtonElement|null} */ (/** @type {Element|null} */ (event.target)?.closest?.('[data-tool]'));
    if (!button || button.disabled || this._disabled) return;
    const tool = this._tools.find((entry) => entry.id === button.dataset.tool);
    if (!tool) return;
    this.emit('tool', { id: tool.id, tool: { ...tool } });
  }

  /* -------------------------------------------------------------- mentions -- */

  /**
   * Opens, filters or closes the suggestions from the word the caret is in.
   * @private
   * @returns {void}
   */
  _updateMentions() {
    const source = this._mentionSource;
    const input = this._input;
    if (!source || this._disabled || input.selectionStart !== input.selectionEnd) {
      this._closeMentions();
      return;
    }
    const caret = input.selectionStart ?? input.value.length;
    const found = mentionQuery(input.value, caret, source.trigger);
    if (!found) {
      this._closeMentions();
      return;
    }
    this._mentionSequence += 1;
    const sequence = this._mentionSequence;
    /** @param {unknown} items */
    const apply = (items) => {
      if (sequence !== this._mentionSequence || this._destroyed) return;
      this._showMentions(found.start, caret, Array.isArray(items) ? items.filter(isMentionItem) : []);
    };
    if (typeof source.items !== 'function') {
      apply(filterMentions(source.items, found.query));
      return;
    }
    let result;
    try {
      result = source.items(found.query);
    } catch {
      this._closeMentions();
      return;
    }
    if (result && typeof (/** @type {Promise<unknown>} */ (result)).then === 'function') {
      /** @type {Promise<MentionItem[]>} */ (result).then(apply, () => {
        if (sequence === this._mentionSequence) this._closeMentions();
      });
    } else {
      apply(result);
    }
  }

  /**
   * @private
   * @param {number} start Offset of the trigger.
   * @param {number} end Caret offset.
   * @param {MentionItem[]} items
   * @returns {void}
   */
  _showMentions(start, end, items) {
    if (!items.length) {
      this._closeMentions();
      return;
    }
    const list = /** @type {HTMLElement} */ (this.refs.list);
    const highlighted = this._mention?.items[this._mention.index];
    const kept = highlighted ? items.findIndex((item) => String(item.id) === String(highlighted.id)) : -1;
    this._mention = { start, end, items, index: Math.max(0, kept) };
    list.replaceChildren(...items.map((item, index) => h('div', {
      class: 'zx-composer__option', role: 'option', id: `${list.id}-${index}`,
      ariaSelected: 'false', dataset: { index: String(index) }
    },
    item.icon ? icon(item.icon, { size: ICON_SIZE.control }) : null,
    h('span', { class: 'zx-composer__option-text' },
      h('span', { class: 'zx-composer__option-label' }, String(item.label)),
      item.description ? h('span', { class: 'zx-composer__option-description' }, String(item.description)) : null))));
    if (list.hidden) {
      list.hidden = false;
      this._position = position(/** @type {HTMLElement} */ (this.refs.frame), list, {
        placement: 'top-start', offset: 6, flip: true
      });
    } else {
      this._position?.update();
    }
    this._input.setAttribute('aria-autocomplete', 'list');
    this._input.setAttribute('aria-controls', list.id);
    this._highlight(this._mention.index);
    this._announce(items.length === 1 ? this.msg('composer.match') : this.msg('composer.matches', items.length));
  }

  /**
   * @private
   * @param {number} index
   * @returns {void}
   */
  _highlight(index) {
    const mention = this._mention;
    if (!mention || !Number.isInteger(index) || !mention.items[index]) return;
    mention.index = index;
    const options = /** @type {HTMLElement[]} */ (Array.from(this.refs.list.children));
    options.forEach((option, at) => option.setAttribute('aria-selected', String(at === index)));
    this._input.setAttribute('aria-activedescendant', options[index].id);
    options[index].scrollIntoView?.({ block: 'nearest' });
  }

  /** @private @returns {void} */
  _closeMentions() {
    this._mentionSequence += 1;
    if (!this._mention && /** @type {HTMLElement} */ (this.refs.list).hidden) return;
    this._mention = null;
    this._position?.destroy();
    this._position = null;
    const list = /** @type {HTMLElement} */ (this.refs.list);
    list.hidden = true;
    list.replaceChildren();
    this._input.removeAttribute('aria-autocomplete');
    this._input.removeAttribute('aria-controls');
    this._input.removeAttribute('aria-activedescendant');
    this._announce('');
  }

  /**
   * Writes `@<label> ` where the mention was typed and records the item.
   * @private
   * @param {number} index
   * @returns {void}
   * @fires Composer#mention
   */
  _pickMention(index) {
    const mention = this._mention;
    const item = mention?.items[index];
    if (!mention || !item) return;
    const input = this._input;
    const trigger = this._mentionSource?.trigger ?? '@';
    const text = `${trigger}${item.label} `;
    const rest = input.value.slice(mention.end).replace(/^ /, '');
    input.value = `${input.value.slice(0, mention.start)}${text}${rest}`;
    const caret = mention.start + text.length;
    input.setSelectionRange(caret, caret);
    this._closeMentions();
    this._mentions = [...this._mentions.filter((entry) => String(entry.id) !== String(item.id)), item];
    this._afterTextChange();
    this.emit('mention', { item: { ...item } });
    this.emit('input', { text: input.value });
  }

  /**
   * Sets the polite status, once per change.
   * @private
   * @param {string} text
   * @param {boolean} [again=false] Whether the same text is news again: a no-break space then tells
   * it apart from the last time, because a live region says nothing about a text that did not change.
   * @returns {void}
   */
  _announce(text, again = false) {
    const spoken = again && text === this._announced ? `${text}\u00A0` : text;
    if (spoken === this._announced) return;
    this._announced = spoken;
    this.refs.status.textContent = spoken;
  }

  /* ----------------------------------------------------------------- queue -- */

  /**
   * Holds the message back until the agent is no longer busy, or refuses it at the limit: the
   * message then stays where it was written.
   * @private
   * @returns {void}
   * @fires Composer#queue
   */
  _enqueue() {
    const message = this._message();
    if (!message) return;
    const { queue, item } = addToQueue(this._queue, { id: uid('zx-composer-queued'), ...message }, this._queueLimit);
    if (!item) {
      this._queueRefused = true;
      this._syncHint();
      this._announce(this.msg('composer.queueFull', this._queueLimit), true);
      return;
    }
    this._queue = queue;
    this.clear();
    this._renderQueue();
    this._announce(this.msg('composer.queued'), true);
    this.emit('queue', { item: copyQueued(item), items: this.getQueue() });
  }

  /**
   * Sends the first queued message for an end of busy. A `send` listener that ends busy again,
   * before it returns, does not send from inside this one: the next message goes when it is done.
   * @private
   * @returns {void}
   */
  _sendNextQueued() {
    if (this._sendingQueued) {
      this._busyEndedAgain = true;
      return;
    }
    this._sendingQueued = true;
    do {
      this._busyEndedAgain = false;
      this._sendQueued();
    } while (this._busyEndedAgain);
    this._sendingQueued = false;
  }

  /**
   * Sends the first queued message, unless it must wait. What is being written stays: it is not the
   * message that goes. A prevented `send` was not sent, so the message stays first in line.
   * @private
   * @returns {void}
   * @fires Composer#send
   * @fires Composer#dequeue
   */
  _sendQueued() {
    if (this._busy || this._disabled || this._destroyed) return;
    const { queue, item } = takeNext(this._queue);
    if (!item) return;
    this._queue = queue;
    const { id, ...message } = copyQueued(item);
    const event = this.emit('send', { ...message, queued: true }, { honorDomCancellation: true });
    if (this._destroyed) return;
    if (event.defaultPrevented) this._queue = [item, ...this._queue];
    this._renderQueue();
    if (!event.defaultPrevented) this._emitDequeue(item, 'sent');
  }

  /**
   * @private
   * @param {QueuedMessage} item
   * @param {ComposerDequeueDetail['reason']} reason
   * @returns {void}
   * @fires Composer#dequeue
   */
  _emitDequeue(item, reason) {
    this.emit('dequeue', { item: copyQueued(item), items: this.getQueue(), reason });
  }

  /**
   * Takes a queued message back into the composer, asking first when that would replace what is
   * being written. The message may have been sent while the question was open; nothing happens then.
   * @private
   * @param {string} id
   * @returns {Promise<void>}
   * @fires Composer#dequeue
   */
  async _editQueued(id) {
    if (this._input.value.trim() || this._files.length) {
      const replace = await Dialog.confirm({
        title: this.msg('composer.queueReplaceTitle'),
        message: this.msg('composer.queueReplaceMessage'),
        okLabel: this.msg('composer.queueReplaceConfirm'),
        danger: true
      });
      if (!replace || this._destroyed) return;
    }
    const { queue, item } = removeFromQueue(this._queue, id);
    if (!item) return;
    this._queue = queue;
    this._files = item.files.map((file) => ({ id: uid('zx-composer-file'), file }));
    this._renderFiles();
    this.setValue(item.text);
    this._mentions = item.mentions.map((mention) => ({ ...mention }));
    this._renderQueue();
    this._input.focus();
    this._emitDequeue(item, 'edited');
  }

  /**
   * @private
   * @param {MouseEvent} event
   * @returns {void}
   */
  _onQueueClick(event) {
    const button = /** @type {HTMLElement|null} */ (/** @type {Element|null} */ (event.target)?.closest?.('[data-queue-action]'));
    const row = /** @type {HTMLElement|null} */ (button?.closest('[data-queued]') ?? null);
    if (!button || !row || this._disabled) return;
    if (button.dataset.queueAction === 'edit') this._editQueued(String(row.dataset.queued));
    else this.removeQueued(String(row.dataset.queued));
  }

  /**
   * Delete on a focused row removes it. The arrow keys inside a row belong to its toolbar.
   * @private
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  _onQueueKeydown(event) {
    if (event.key !== 'Delete' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || this._disabled) return;
    const row = /** @type {HTMLElement|null} */ (/** @type {Element|null} */ (event.target)?.closest?.('[data-queued]'));
    if (!row) return;
    event.preventDefault();
    this.removeQueued(String(row.dataset.queued));
  }

  /**
   * Draws the queue, and keeps the focus in it: on the same button of the same row, on the row now
   * in that place when the row has gone, and in the text when no row is left.
   * @private
   * @returns {void}
   */
  _renderQueue() {
    if (!this.options.queue) return;
    const list = /** @type {HTMLElement} */ (this.refs.queueList);
    const active = /** @type {HTMLElement|null} */ (list.ownerDocument.activeElement);
    const focused = active && list.contains(active) ? active : null;
    const focusedRow = /** @type {HTMLElement|null} */ (focused?.closest('[data-queued]') ?? null);
    const place = focusedRow ? Array.from(list.children).indexOf(focusedRow) : -1;

    this._releaseQueueRoving();
    /** @type {HTMLElement} */ (this.refs.queue).hidden = this._queue.length === 0;
    this.refs.queueLabel.textContent = this.msg('composer.queue', this._queue.length);
    list.replaceChildren(...this._queue.map((item) => this._queueRow(item)));
    this._queueRoving = /** @type {HTMLElement[]} */ (Array.from(list.querySelectorAll('[role="toolbar"]')))
      .map((toolbar) => rovingTabindex(toolbar, '[data-queue-action]', { orientation: 'horizontal' }));

    if (this._queueRefused && !isQueueFull(this._queue, this._queueLimit)) {
      this._queueRefused = false;
      this._syncHint();
    }
    if (!focused || !focusedRow) return;
    const rows = /** @type {HTMLElement[]} */ (Array.from(list.children));
    const row = rows.find((entry) => entry.dataset.queued === focusedRow.dataset.queued)
      ?? rows[Math.min(place, rows.length - 1)];
    const next = /** @type {HTMLElement|null} */ (row?.querySelector(`[data-queue-action="${focused.dataset.queueAction}"]`) ?? null);
    if (next) next.focus();
    else this._input.focus();
  }

  /**
   * One queued message on one line: its text, or the names of its files when it has none, and a
   * toolbar named by that line.
   * @private
   * @param {QueuedMessage} item
   * @returns {HTMLElement}
   */
  _queueRow(item) {
    const textId = uid('zx-composer-queued-text');
    const count = item.files.length;
    return h('li', { class: 'zx-composer__queued', dataset: { queued: item.id } },
      h('span', { class: 'zx-composer__queued-text', id: textId },
        item.text || item.files.map((file) => file.name).join(', ')),
      item.text && count
        ? h('span', { class: 'zx-composer__queued-meta' },
          count === 1 ? this.msg('composer.queueFile') : this.msg('composer.queueFiles', count))
        : null,
      h('div', { class: 'zx-composer__queued-actions', role: 'toolbar', 'aria-labelledby': textId },
        this._queueButton('edit', this.msg('composer.queueEdit')),
        this._queueButton('remove', this.msg('composer.queueRemove'))));
  }

  /**
   * @private
   * @param {'edit'|'remove'} action
   * @param {string} label
   * @returns {HTMLElement}
   */
  _queueButton(action, label) {
    return h('button', {
      type: 'button',
      class: 'zx-icon-btn zx-composer__queued-action',
      disabled: this._disabled,
      dataset: { queueAction: action }
    }, label);
  }

  /** @private @returns {void} */
  _releaseQueueRoving() {
    for (const roving of this._queueRoving) roving.destroy();
    this._queueRoving = [];
  }

  /* -------------------------------------------------------------- commands -- */

  /**
   * Opens the commands in a launcher, created on first use.
   * @private
   * @returns {void}
   * @fires Composer#command
   */
  _openCommands() {
    if (!this._commands || this._disabled || this._destroyed) return;
    this._closeMentions();
    this._launcher ??= new Launcher(null, {
      items: orderedCommands(this._commands),
      shortcut: false,
      scope: this.el,
      label: this.msg('composer.commands'),
      placeholder: this.msg('composer.commandsPlaceholder'),
      onselect: (event) => {
        const item = event.detail.item;
        this.emit('command', { item: item[COMMAND_SOURCE] ?? item });
      }
    });
    this._launcher.open();
  }

  /* ----------------------------------------------------------------- files -- */

  /**
   * @private
   * @param {File[]} files
   * @param {boolean} fromPicker Whether the files came through the file input, which applied
   * `accept` already.
   * @returns {void}
   * @fires Composer#attach
   */
  _addFiles(files, fromPicker) {
    if (!this.options.attachments || this._disabled) return;
    const room = Math.max(0, (Number(this.options.maxFiles) || 0) - this._files.length);
    const taken = files
      .filter((file) => file && typeof file === 'object')
      .filter((file) => fromPicker || acceptsFile(file, this.options.accept))
      .slice(0, room);
    if (!taken.length) return;
    const event = this.emit('attach', { files: [...taken] });
    if (event.defaultPrevented || this._destroyed) return;
    for (const file of taken) this._files.push({ id: uid('zx-composer-file'), file });
    this._renderFiles();
    this._syncSend();
  }

  /**
   * @private
   * @param {ClipboardEvent} event
   * @returns {void}
   */
  _onPaste(event) {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!files.length || !this.options.attachments || this._disabled) return;
    // A copied file also carries its name as text; a copied selection that includes an image
    // keeps its text.
    if (!Array.from(event.clipboardData?.types ?? []).includes('text/plain')) event.preventDefault();
    this._addFiles(files, false);
  }

  /**
   * @private
   * @param {DragEvent} event
   * @returns {void}
   */
  _onDrag(event) {
    if (this._disabled || !Array.from(event.dataTransfer?.types ?? []).includes('Files')) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this._setDropping(true);
  }

  /**
   * @private
   * @param {DragEvent} event
   * @returns {void}
   */
  _onDrop(event) {
    this._setDropping(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (this._disabled || !files.length) return;
    event.preventDefault();
    this._addFiles(files, false);
    this._input.focus();
  }

  /**
   * @private
   * @param {boolean} dropping
   * @returns {void}
   */
  _setDropping(dropping) {
    if (dropping) this.el.setAttribute('data-state', 'dropping');
    else if (this.el.getAttribute('data-state') === 'dropping') this.el.removeAttribute('data-state');
  }

  /* ----------------------------------------------------------------- chips -- */

  /**
   * @private
   * @param {ContextChip} chip
   * @returns {void}
   */
  _putContext(chip) {
    if (!chip || typeof chip !== 'object' || chip.id == null || chip.label == null) return;
    const entry = { ...chip, id: String(chip.id), label: String(chip.label) };
    const index = this._context.findIndex((item) => item.id === entry.id);
    if (index >= 0) this._context[index] = entry;
    else this._context.push(entry);
  }

  /** @private @returns {void} */
  _renderFiles() {
    const list = /** @type {HTMLElement} */ (this.refs.files);
    list.hidden = this._files.length === 0;
    list.replaceChildren(...this._files.map(({ id, file }) => this._chip({
      kind: 'file',
      id,
      label: String(file.name || ''),
      glyph: 'file',
      meta: Number.isFinite(file.size) ? formatFileSize(file.size, { decimals: 0, standard: 'si' }) : ''
    })));
  }

  /** @private @returns {void} */
  _renderContext() {
    const list = /** @type {HTMLElement} */ (this.refs.context);
    list.hidden = this._context.length === 0;
    list.replaceChildren(...this._context.map((chip) => this._chip({
      kind: 'context', id: chip.id, label: chip.label, glyph: chip.icon ?? null, meta: ''
    })));
  }

  /**
   * @private
   * @param {{kind: 'file'|'context', id: string, label: string, glyph: string|null, meta: string}} chip
   * @returns {HTMLElement}
   */
  _chip({ kind, id, label, glyph, meta }) {
    return h('li', { class: 'zx-composer__chip', dataset: { kind, id } },
      glyph ? icon(glyph, { size: ICON_SIZE.chip }) : null,
      h('span', { class: 'zx-composer__chip-label' }, label),
      meta ? h('span', { class: 'zx-composer__chip-meta' }, meta) : null,
      h('button', {
        type: 'button',
        class: 'zx-icon-btn zx-composer__remove',
        ariaLabel: this.msg('composer.remove', label),
        disabled: this._disabled,
        dataset: { remove: id, kind }
      }, icon('x', { size: ICON_SIZE.chip })));
  }

  /**
   * Removes the chip whose button was pressed, and keeps the focus in the list.
   * @private
   * @param {MouseEvent} event
   * @returns {void}
   * @fires Composer#remove
   */
  _onChipClick(event) {
    const button = /** @type {HTMLElement|null} */ (/** @type {Element|null} */ (event.target)?.closest?.('[data-remove]'));
    if (!button || this._disabled) return;
    const id = String(button.dataset.remove);
    const kind = button.dataset.kind === 'context' ? 'context' : 'file';
    const list = /** @type {HTMLElement} */ (kind === 'file' ? this.refs.files : this.refs.context);
    const buttons = Array.from(list.querySelectorAll('[data-remove]'));
    const place = buttons.indexOf(button);
    /** @type {ComposerRemoveDetail} */
    let detail;
    if (kind === 'file') {
      const entry = this._files.find((item) => item.id === id);
      if (!entry) return;
      this._files = this._files.filter((item) => item !== entry);
      this._renderFiles();
      this._syncSend();
      detail = { kind, id, file: entry.file };
    } else {
      const chip = this._context.find((item) => item.id === id);
      if (!chip) return;
      this.removeContext(id);
      detail = { kind, id, chip: { ...chip } };
    }
    const rest = /** @type {HTMLElement[]} */ (Array.from(list.querySelectorAll('[data-remove]')));
    (rest[Math.min(place, rest.length - 1)] ?? this._input).focus();
    this.emit('remove', /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (detail)));
  }
}

/**
 * A quiet icon button in the composer's bar.
 * @param {string} name Icon name.
 * @param {string} label Accessible name.
 * @param {string} action What it does, for styling.
 * @returns {HTMLButtonElement}
 */
function iconButton(name, label, action) {
  return /** @type {HTMLButtonElement} */ (h('button', {
    type: 'button',
    class: 'zx-icon-btn zx-composer__tool',
    ariaLabel: label,
    title: label,
    dataset: { action }
  }, icon(name, { size: ICON_SIZE.control })));
}

/**
 * A copy of a queued message that shares nothing with the queue but its files.
 * @param {QueuedMessage} item
 * @returns {QueuedMessage}
 */
function copyQueued(item) {
  return {
    ...item,
    files: [...item.files],
    mentions: item.mentions.map((mention) => ({ ...mention })),
    context: item.context.map((chip) => ({ ...chip }))
  };
}

/**
 * The send key an option names; anything but `'mod+enter'` is `'enter'`.
 * @param {unknown} value
 * @returns {'enter'|'mod+enter'}
 */
function submitKeyOf(value) {
  return value === 'mod+enter' ? 'mod+enter' : 'enter';
}

/**
 * The visible Send text a `sendLabel` option asks for; empty keeps Send icon-only.
 * @param {unknown} value
 * @returns {string}
 */
function sendLabelText(value) {
  return value == null ? '' : String(value).trim();
}

/**
 * @param {ComposerOptions['mentions']} mentions
 * @returns {{trigger: string, items: MentionSource['items']}|null}
 */
function normalizeMentionSource(mentions) {
  if (!mentions || typeof mentions !== 'object') return null;
  const items = mentions.items;
  if (!Array.isArray(items) && typeof items !== 'function') return null;
  const trigger = typeof mentions.trigger === 'string' && mentions.trigger ? mentions.trigger : '@';
  return { trigger, items };
}

/**
 * @param {unknown} item
 * @returns {item is MentionItem}
 */
function isMentionItem(item) {
  return Boolean(item) && typeof item === 'object'
    && /** @type {MentionItem} */ (item).id != null && /** @type {MentionItem} */ (item).label != null;
}

/**
 * Lower case without accents, for matching.
 * @param {unknown} value
 * @returns {string}
 */
function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * @param {MentionItem} item
 * @param {string} needle Folded query.
 * @returns {number} 0 label prefix, 1 word prefix, 2 label substring, 3 id prefix or a word of the
 * description, 4 no match.
 */
function mentionRank(item, needle) {
  const label = fold(item.label);
  if (label.startsWith(needle)) return 0;
  if (words(item.label).some((word) => word.startsWith(needle))) return 1;
  if (label.includes(needle)) return 2;
  if (fold(item.id).startsWith(needle) || words(item.description).some((word) => word.startsWith(needle))) return 3;
  return 4;
}

/**
 * The folded words of a text.
 * @param {unknown} value
 * @returns {string[]}
 */
function words(value) {
  return fold(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Copies of the commands that keep the application's order among equally ranked results (the
 * launcher otherwise sorts them by label), each remembering the item it was made from.
 * @param {LauncherItem[]} items
 * @returns {LauncherItem[]}
 */
function orderedCommands(items) {
  return items.filter((item) => item && typeof item === 'object').map((item, index) => ({
    ...item,
    itemOrder: item.itemOrder ?? index,
    items: Array.isArray(item.items) ? orderedCommands(item.items) : item.items,
    [COMMAND_SOURCE]: item
  }));
}

/** @returns {boolean} Whether the platform's command modifier is Cmd. */
function isApplePlatform() {
  const nav = globalThis.navigator;
  if (!nav) return false;
  const platform = /** @type {{userAgentData?: {platform?: string}}} */ (nav).userAgentData?.platform || nav.platform || '';
  return /mac|iphone|ipad|ios/i.test(platform);
}

/** Fired when the message is sent; preventable, which keeps the text and files. @event Composer#send @type {CustomEvent<ComposerSendDetail>} */
/** Fired when Stop is pressed, or Escape in the text while busy. @event Composer#stop @type {CustomEvent<Record<string, never>>} */
/** Fired when the reader changes the text. @event Composer#input @type {CustomEvent<{text: string}>} */
/** Fired before files are attached; preventable. @event Composer#attach @type {CustomEvent<{files: File[]}>} */
/** Fired after the reader removes an attachment or a context chip. @event Composer#remove @type {CustomEvent<ComposerRemoveDetail>} */
/** Fired when a suggestion is picked. @event Composer#mention @type {CustomEvent<{item: MentionItem}>} */
/** Fired when a command is chosen. @event Composer#command @type {CustomEvent<{item: LauncherItem}>} */
/** Fired when one of the extra tools is pressed; the composer changes nothing itself. @event Composer#tool @type {CustomEvent<ComposerToolDetail>} */
/** Fired when a message is added to the queue. @event Composer#queue @type {CustomEvent<ComposerQueueDetail>} */
/** Fired when a message leaves the queue: sent, removed, taken back to edit, or cleared. @event Composer#dequeue @type {CustomEvent<ComposerDequeueDetail>} */
/** Fired for ArrowUp on an empty text. @event Composer#historyprevious @type {CustomEvent<Record<string, never>>} */
