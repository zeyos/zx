// @ts-check
import { Component } from '../../core/component.js';
import { formatDate } from '../../core/date.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { translate } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';
import { isEditableTarget } from '../../core/keyboard.js';
import { uid } from '../../core/util.js';
import { STATUS } from '../../internal/agent-model.js';
import { renderBlocks } from '../block-view/block-view.js';
import { button } from '../button/button.js';
import { Dialog } from '../dialog/dialog.js';
import { Field } from '../field/field.js';
import { Fieldset } from '../fieldset/fieldset.js';
import { statusIcon } from '../select/glyphs.js';

/** @typedef {import('../../internal/agent-model.js').Block} Block */
/** @typedef {import('../field/field.js').FieldOptions} FieldOptions */

/**
 * Where a request stands: waiting for an answer, or answered — approved, rejected, or expired
 * before anyone answered it.
 * @typedef {'pending'|'approved'|'rejected'|'expired'} ApprovalStatus
 */

/**
 * Whether Reject asks why: `'optional'` asks and accepts no answer, `'required'` will not reject
 * without one, and `'none'` rejects at once.
 * @typedef {'optional'|'required'|'none'} ApprovalReasonMode
 */

/** @typedef {'approve'|'edit'|'reject'} ApprovalAction */

/** @typedef {'slate'|'blue'|'teal'|'green'|'amber'|'orange'|'red'|'pink'|'violet'} ApprovalTone */

/**
 * What the request will produce, shown behind a disclosure: the email as it will be sent, the
 * records as they will be written.
 * @typedef {Object} ApprovalPreview
 * @property {string} [label] Text of the disclosure button; "Preview" when absent.
 * @property {Node|Block[]} [content] What the disclosure shows: a node, or blocks.
 * @property {Block[]} [blocks] The same as `content` given as blocks, as the thread model spells it.
 */

/**
 * @typedef {Object} ApprovalCardOptions
 * @property {string} [title=''] What the agent wants to do, as a question: "Send 3 payment reminders?".
 * @property {string} [description=''] One line under the title: what follows from approving.
 * @property {string|null} [icon=null] Icon name for the tile beside the title; none when null.
 * @property {ApprovalTone} [tone='blue'] Categorical tone of the icon tile.
 * @property {2|3|4|5|6} [headingLevel=3] Element level of the title heading.
 * @property {ApprovalStatus} [status='pending'] Where the request stands.
 * @property {Node|Block[]|null} [details=null] What will happen — recipients, amounts, records —
 *   as a node the application built, or as blocks. Model text in blocks is drawn as text only.
 * @property {ApprovalPreview|null} [preview=null] What the request produces, behind a disclosure.
 * @property {Record<string, FieldOptions>|null} [fields=null] The Edit form, keyed by value name.
 *   No fields, no Edit.
 * @property {Record<string, unknown>} [values={}] The values the request carries; the Edit form
 *   starts from them and `approve` reports them.
 * @property {string|null} [confirmText=null] Text the person must type before Approve goes
 *   through, for an action that cannot be undone. Decided by the application from the tool the
 *   action triggers, never taken from model output.
 * @property {ApprovalReasonMode} [reason='optional'] Whether Reject asks why.
 * @property {boolean} [edited=false] Whether the values were already edited, for a request
 *   restored from a record. Without `editedKeys` every field is listed under "Edited by you".
 * @property {string[]|null} [editedKeys=null] Which values were edited: only these fields are
 *   listed under "Edited by you", in field order. A non-empty list implies `edited`; null lists
 *   every field of an edited request.
 * @property {string|null} [rejectReason=null] The reason a rejected request was given, for a
 *   request restored from a record.
 * @property {string|null} [answeredBy=null] Who answers, as the verdict names them; the message
 *   `approvalCard.you` ("you") when null.
 * @property {string|Date|null} [answeredAt=null] When an answered request was answered: a local
 *   ISO date-time or a Date. An answer given on the card takes the time it was given.
 * @property {(() => Date)|null} [now=null] The clock: decides whether `answeredAt` is today (the
 *   time alone) or another day (date and time), and gives the time of an answer recorded without
 *   an explicit `at`. Real time when null.
 * @property {boolean} [keys=true] Whether A, E, and R act while focus is inside the pending card.
 *   `handleKey()` works either way.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{values: Record<string, unknown>}>) => void} [onapprove] Approve listener.
 * @property {(event: CustomEvent<ApprovalEditDetail>) => void} [onedit] Edit listener.
 * @property {(event: CustomEvent<{reason: string}>) => void} [onreject] Reject listener.
 */

/**
 * What `update()` changes: any of these options, the rest staying as they are. The status goes
 * through `setStatus()`.
 * @typedef {Pick<ApprovalCardOptions, 'title'|'description'|'icon'|'tone'|'details'|'preview'
 *   |'fields'|'values'|'confirmText'|'reason'|'edited'|'editedKeys'>} ApprovalCardUpdate
 */

/**
 * What a saved edit reports.
 * @typedef {Object} ApprovalEditDetail
 * @property {Record<string, unknown>} values The values as saved, edits included.
 * @property {string[]} changed The fields this save changed against the values before it, in
 *   field order; empty when the form was saved unchanged.
 * @property {string[]|null} editedKeys Every field edited so far, this save included: what the
 *   card lists under "Edited by you" unless the edit is prevented. Null when the card lists every
 *   field (`edited: true` with no `editedKeys`).
 */

const MESSAGES = Object.freeze({
  'approvalCard.approve': 'Approve',
  'approvalCard.edit': 'Edit',
  'approvalCard.reject': 'Reject',
  'approvalCard.you': 'you',
  'approvalCard.status.pending': 'Waiting for you',
  'approvalCard.status.approved': 'Approved',
  'approvalCard.status.rejected': 'Rejected',
  'approvalCard.status.expired': 'Expired',
  'approvalCard.paused': 'The run is paused until you answer.',
  'approvalCard.approvedBy': 'Approved by %1 at %2',
  'approvalCard.approvedByUndated': 'Approved by %1',
  'approvalCard.rejectedBy': 'Rejected by %1 at %2',
  'approvalCard.rejectedByUndated': 'Rejected by %1',
  'approvalCard.expiredAt': 'Expired at %1',
  'approvalCard.expiredUndated': 'Expired without an answer',
  'approvalCard.editedBy': 'Edited by %1',
  'approvalCard.reason': 'Reason',
  'approvalCard.preview': 'Preview',
  'approvalCard.editTitle': 'Edit the request',
  'approvalCard.save': 'Save changes',
  'approvalCard.cancel': 'Cancel',
  'approvalCard.required': 'Fill this in to save.',
  'approvalCard.rejectTitle': 'Reject the request?',
  'approvalCard.reasonLabel': 'Why not?',
  'approvalCard.reasonOptional': 'Optional. Your reason stays with the request.',
  'approvalCard.reasonRequired': 'Your reason stays with the request.',
  'approvalCard.reasonMissing': 'Say why, so the agent can do better next time.'
});

/**
 * Which run state draws each request status: its glyph and tone come from `STATUS`, so a waiting
 * request looks like a waiting step.
 * @type {Readonly<Record<ApprovalStatus, import('../../internal/agent-model.js').RunState>>}
 */
export const APPROVAL_STATES = Object.freeze({
  pending: 'waiting',
  approved: 'done',
  rejected: 'skipped',
  expired: 'stopped'
});

/**
 * The message key of each status's word.
 * @type {Readonly<Record<ApprovalStatus, string>>}
 */
const STATUS_WORDS = Object.freeze({
  pending: 'approvalCard.status.pending',
  approved: 'approvalCard.status.approved',
  rejected: 'approvalCard.status.rejected',
  expired: 'approvalCard.status.expired'
});

/** The letter of each action key. */
const ACTION_KEYS = Object.freeze({ a: 'approve', e: 'edit', r: 'reject' });

/** The tones an icon tile may take. */
const TONES = Object.freeze(['slate', 'blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet']);

/** What an empty value reads as in the list of edited values. */
const EMPTY_VALUE = '—';

/**
 * A request that holds an agent's run until a person answers it: what the agent wants to do, what
 * will happen, what it will produce, and Approve, Edit, and Reject. Answered, it freezes into the
 * record of what was decided, by whom, and when.
 *
 * The card never acts on its own: it emits the answer, and the application carries it out. Every
 * answer is preventable, so the application can refuse or defer one and settle the card later
 * through `setStatus()`. A request the agent revises while it waits changes in place through
 * `update()`, which keeps focus where it was.
 *
 * A, E, and R act while focus is inside a pending card and not in a text control; the card never
 * listens to the document. An application that wants the keys from elsewhere forwards them to
 * `handleKey()`.
 *
 * @fires ApprovalCard#approve
 * @fires ApprovalCard#edit
 * @fires ApprovalCard#reject
 * @extends {Component<ApprovalCardOptions>}
 */
export class ApprovalCard extends Component {
  static cssName = 'approval-card';

  /** @type {Readonly<ApprovalCardOptions>} */
  static defaults = {
    title: '',
    description: '',
    icon: null,
    tone: 'blue',
    headingLevel: 3,
    status: 'pending',
    details: null,
    preview: null,
    fields: null,
    values: {},
    confirmText: null,
    reason: 'optional',
    edited: false,
    editedKeys: null,
    rejectReason: null,
    answeredBy: null,
    answeredAt: null,
    now: null,
    keys: true,
    msg: MESSAGES
  };

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    /** @type {import('../../core/dom.js').TargetSnapshot|null} */
    this._original = created ? null : snapshotTarget(root);
    if (!created) root.replaceChildren();
    this._destroyed = false;

    const options = this.options;
    /** @type {ApprovalStatus} */
    this._status = normalizeApprovalStatus(options.status);
    /** @type {Record<string, unknown>} */
    this._values = cloneValues(options.values);
    /** @type {Record<string, FieldOptions>|null} */
    this._fields = editFields(options.fields);
    const edited = editedState(options.edited, options.editedKeys);
    this._edited = edited.edited;
    /** @type {string[]|null} The values listed as edited; null lists every field. */
    this._editedKeys = edited.keys;
    /** @type {(() => Date)|null} */
    this._clock = typeof options.now === 'function' ? options.now : null;
    /** @type {string|null} */
    this._by = textOrNull(options.answeredBy);
    /** @type {Date|null} */
    this._at = this._status === 'pending' ? null : toDate(options.answeredAt);
    /** @type {string|null} */
    this._reason = textOrNull(options.rejectReason);
    /** @type {ApprovalReasonMode} */
    this._reasonMode = normalizeReasonMode(options.reason);
    this._title = String(options.title ?? '');
    this._description = String(options.description ?? '');
    /** @type {string|null} */
    this._icon = textOrNull(options.icon);
    this._tone = normalizeTone(options.tone);
    this._confirmText = confirmTextOf(options.confirmText);
    /** @type {unknown} What `details` was drawn from, to compare an update against. */
    this._details = null;
    /** @type {{label: string, content: unknown}|null} What the preview was drawn from. */
    this._preview = null;
    /** @type {{dialog: Dialog, fieldset: Fieldset, fields: Record<string, FieldOptions>}|null} */
    this._editor = null;
    /** @type {{dialog: Dialog, field: Field, blocked: boolean, mode: ApprovalReasonMode}|null} */
    this._rejecter = null;
    /** @type {Dialog|null} The type-to-confirm dialog while it is open. */
    this._confirm = null;
    this._confirming = false;
    this._keys = options.keys !== false;

    const titleId = uid('zx-approval-card-title');
    this._descriptionId = uid('zx-approval-card-description');
    const level = Math.min(6, Math.max(2, Math.trunc(Number(options.headingLevel)) || 3));
    this._blockLevel = /** @type {2|3|4|5} */ (Math.min(5, level + 1));

    root.setAttribute('role', 'group');
    root.setAttribute('aria-labelledby', titleId);
    root.tabIndex = -1;

    this._titleEl = h(`h${level}`, { class: 'zx-approval-card__title', id: titleId }, this._title);
    this._noteEl = h('p', { class: 'zx-approval-card__note', id: uid('zx-approval-card-note') });
    this._statusEl = h('span', { class: 'zx-approval-card__status' });
    /** @type {HTMLElement|null} */
    this._tileEl = null;
    /** @type {HTMLElement|null} */
    this._descriptionEl = null;
    this._headEl = h('div', { class: 'zx-approval-card__head' },
      h('div', { class: 'zx-approval-card__titles' }, this._titleEl, this._noteEl),
      this._statusEl);
    this._changesEl = h('div', { class: 'zx-approval-card__changes', hidden: true });
    this._reasonEl = h('div', { class: 'zx-approval-card__reason', hidden: true });
    /** @type {HTMLElement|null} */
    this._detailsEl = null;
    /** @type {HTMLElement|null} */
    this._previewEl = null;
    /** @type {HTMLElement|null} */
    this._previewToggle = null;
    /** @type {HTMLElement|null} */
    this._previewLabel = null;
    /** @type {HTMLElement|null} */
    this._previewBody = null;

    this._approveEl = actionButton('approve', this.msg('approvalCard.approve'), 'A', this._keys, 'primary');
    /** @type {HTMLButtonElement|null} */
    this._editEl = null;
    this._rejectEl = actionButton('reject', this.msg('approvalCard.reject'), 'R', this._keys);
    this._actionsEl = h('div', { class: 'zx-approval-card__actions' }, this._approveEl, this._rejectEl);
    root.append(this._headEl, this._changesEl, this._reasonEl, this._actionsEl);

    this._drawTile();
    this._drawDescription();
    this._drawDetails(options.details);
    this._drawPreview(previewState(options.preview));
    this._drawEditButton();

    this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));
    if (this._keys) this.listen(root, 'keydown', (event) => { this.handleKey(/** @type {KeyboardEvent} */ (event)); });
    this._sync();
    return root;
  }

  /**
   * Changes the request in place — the agent revised it, or the record it is drawn from changed —
   * and redraws only what changed. Focus stays where it was; when the element that held it is
   * gone (the Edit button, the preview toggle), the card takes it. Of the card's dialogs only one
   * the change makes meaningless closes: the Edit form when `fields` change, the Reject dialog
   * when `reason` changes, the typed confirmation when `confirmText` changes. An open Edit form
   * stays open over new `values` and saves what the person typed. Emits nothing.
   *
   * `edited` and `editedKeys` follow the options' rules: `edited: true` alone keeps the fields
   * already listed (every field, on a card that was not edited); `edited: false` alone clears the
   * list; a non-empty `editedKeys` marks the card edited.
   * @param {ApprovalCardUpdate} [partial={}] The options to change; the rest stay as they are.
   * @returns {this}
   */
  update(partial = {}) {
    if (this._destroyed || !partial || typeof partial !== 'object') return this;
    /** @param {keyof ApprovalCardUpdate} key @returns {boolean} */
    const has = (key) => Object.hasOwn(partial, key);
    const root = /** @type {HTMLElement} */ (this.el);
    const doc = root.ownerDocument;
    const held = root.contains(doc.activeElement) || this._dialogOpen();
    let listed = false;

    if (has('title')) {
      const title = String(partial.title ?? '');
      if (title !== this._title) {
        this._title = title;
        this._titleEl.textContent = title;
        this._confirm?.setTitle(title);
      }
    }
    if (has('description')) {
      const description = String(partial.description ?? '');
      if (description !== this._description) {
        this._description = description;
        this._drawDescription();
      }
    }
    if (has('icon') || has('tone')) {
      const name = has('icon') ? textOrNull(partial.icon) : this._icon;
      const tone = has('tone') ? normalizeTone(partial.tone) : this._tone;
      if (name !== this._icon || tone !== this._tone) {
        this._icon = name;
        this._tone = tone;
        this._drawTile();
      }
    }
    if (has('details') && !sameValue(snapshotContent(partial.details), this._details)) this._drawDetails(partial.details);
    if (has('preview')) {
      const preview = previewState(partial.preview);
      if (!sameValue(preview, this._preview)) this._drawPreview(preview);
    }
    if (has('fields')) {
      const fields = editFields(partial.fields);
      if (!sameValue(fields, this._fields)) {
        this._fields = fields;
        // The open form asks for other values now; the next Edit builds it afresh.
        this._editor?.dialog.close();
        this._drawEditButton();
        listed = true;
      }
    }
    if (has('values')) {
      const values = cloneValues(partial.values);
      if (!sameValue(values, this._values)) {
        this._values = values;
        listed = true;
      }
    }
    if (has('confirmText')) {
      const text = confirmTextOf(partial.confirmText);
      if (text !== this._confirmText) {
        this._confirmText = text;
        // What was being typed confirms something else now.
        this._confirm?.close(false);
      }
    }
    if (has('reason')) {
      const mode = normalizeReasonMode(partial.reason);
      if (mode !== this._reasonMode) {
        this._reasonMode = mode;
        this._rejecter?.dialog.close();
      }
    }
    if (has('edited') || has('editedKeys')) {
      const edited = has('edited') ? Boolean(partial.edited) : this._edited;
      // `edited: true` alone keeps what is listed, and lists every field on a card not yet edited.
      const keys = has('editedKeys') ? partial.editedKeys
        : edited && this._edited ? this._editedKeys : null;
      const next = editedState(edited, keys);
      if (next.edited !== this._edited || !sameValue(next.keys, this._editedKeys)) {
        this._edited = next.edited;
        this._editedKeys = next.keys;
        listed = true;
      }
    }
    if (listed) this._drawChanges();
    // An element that held focus is gone and no dialog took it: the card keeps it.
    if (held && !this._dialogOpen() && !root.contains(doc.activeElement)) root.focus({ preventScroll: true });
    return this;
  }

  /**
   * Settles the request from outside: an answer the application received elsewhere, a request
   * that timed out, or a prevented answer the application has now carried out. Emits nothing.
   * @param {ApprovalStatus} status New status.
   * @param {{by?: string|null, at?: string|Date|null, reason?: string|null}} [answer={}] Who answered,
   *   when (now, by the `now` clock, when left out), and the reason a rejection was given.
   * @returns {this}
   */
  setStatus(status, answer = {}) {
    if (this._destroyed) return this;
    const next = normalizeApprovalStatus(status);
    const changed = next !== this._status;
    this._status = next;
    if (answer && answer.by !== undefined) this._by = textOrNull(answer.by);
    if (answer && answer.reason !== undefined) this._reason = textOrNull(answer.reason);
    if (next === 'pending') {
      this._at = null;
    } else {
      if (answer && answer.at !== undefined) this._at = toDate(answer.at);
      else if (changed || !this._at) this._at = this._now();
      this._closeDialogs();
    }
    this._sync();
    return this;
  }

  /** @returns {ApprovalStatus} Where the request stands. */
  getStatus() {
    return this._status;
  }

  /** @returns {Record<string, unknown>} A copy of the values, edits included. */
  getValues() {
    return cloneValues(this._values);
  }

  /**
   * @returns {string[]|null} The fields listed under "Edited by you", in field order: empty when
   *   the request was not edited, null when every field is listed.
   */
  getEditedKeys() {
    if (!this._edited) return [];
    return this._editedKeys ? [...this._editedKeys] : null;
  }

  /**
   * Moves focus to the card, so a thread can bring the reader to a request when a run starts
   * waiting on it.
   * @param {FocusOptions} [options] Native focus options.
   * @returns {this}
   */
  focus(options) {
    /** @type {HTMLElement} */ (this.el).focus(options);
    return this;
  }

  /**
   * Answers a key: A approves, E edits, R rejects. Acts only while the request is pending, never
   * from a text control or with a modifier held, and never while one of the card's dialogs is
   * open. The card calls it for keys inside itself; an application may forward keys from
   * elsewhere.
   * @param {KeyboardEvent} event Key event.
   * @returns {boolean} Whether the key was used; a used key has its default prevented.
   */
  handleKey(event) {
    if (this._destroyed || !event || this._busy()) return false;
    const target = event.target instanceof Element ? event.target : null;
    // A key from inside a dialog — one of the card's, or any other — is that dialog's.
    const dialog = target?.closest('dialog') ?? null;
    if (dialog && !dialog.contains(this.el)) return false;
    // A card nested in another card's details answers its own keys.
    const owner = target?.closest('.zx-approval-card') ?? null;
    if (owner && owner !== this.el && this.el.contains(owner)) return false;
    const action = approvalKeyAction(event, {
      status: this._status,
      canEdit: Boolean(this._fields),
      editable: isEditableTarget(target)
    });
    if (!action) return false;
    event.preventDefault();
    this._run(action);
    return true;
  }

  /** @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._confirm?.destroy();
    this._confirm = null;
    if (this._editor) {
      this._editor.fieldset.destroy();
      this._editor.dialog.destroy();
      this._editor = null;
    }
    if (this._rejecter) {
      this._rejecter.field.destroy();
      this._rejecter.dialog.destroy();
      this._rejecter = null;
    }
    super.destroy();
    if (this._original) restoreTarget(this.el, this._original);
  }

  /** @private @returns {boolean} Whether one of the card's dialogs is open or opening. */
  _busy() {
    return this._confirming || this._dialogOpen();
  }

  /** @private @returns {boolean} Whether one of the card's dialogs is open. */
  _dialogOpen() {
    return Boolean(this._confirm?.isOpen())
      || Boolean(this._editor?.dialog.isOpen())
      || Boolean(this._rejecter?.dialog.isOpen());
  }

  /** @private @returns {Date} Now, by the `now` clock when there is one. */
  _now() {
    return (this._clock ? toDate(this._clock()) : null) ?? new Date();
  }

  /** @private @param {MouseEvent} event @returns {void} */
  _onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const control = /** @type {HTMLElement|null} */ (target?.closest('[data-approval-action]') ?? null);
    if (!control || control.closest('.zx-approval-card') !== this.el) return;
    const action = control.dataset.approvalAction;
    if (action === 'preview') this._togglePreview();
    else if (action === 'approve' || action === 'edit' || action === 'reject') this._run(action);
  }

  /** @private @param {ApprovalAction} action @returns {void} */
  _run(action) {
    if (action === 'approve') void this._requestApprove();
    else if (action === 'edit') this._openEdit();
    else this._requestReject();
  }

  /** @private @returns {void} */
  _togglePreview() {
    if (!this._previewToggle || !this._previewBody) return;
    const open = this._previewToggle.getAttribute('aria-expanded') !== 'true';
    this._previewToggle.setAttribute('aria-expanded', String(open));
    this._previewBody.hidden = !open;
  }

  /**
   * Approves, after the typed confirmation when the request asks for one.
   * @private
   * @returns {Promise<void>}
   */
  async _requestApprove() {
    if (this._status !== 'pending' || this._busy()) return;
    const expected = this._confirmText;
    if (expected) {
      this._confirming = true;
      const doc = this.el.ownerDocument;
      const before = new Set(doc.querySelectorAll('dialog'));
      let confirmed = false;
      try {
        const answer = Dialog.confirm({
          title: this._title,
          message: this._description,
          okLabel: this.msg('approvalCard.approve'),
          cancelLabel: this.msg('approvalCard.cancel'),
          danger: true,
          confirmText: expected
        });
        // The confirmation is created and opened synchronously; keep it so destroy() can close it.
        const opened = [...doc.querySelectorAll('dialog')].find((element) => !before.has(element));
        this._confirm = opened ? /** @type {Dialog|null} */ (Dialog.from(opened)) : null;
        confirmed = await answer;
      } finally {
        this._confirming = false;
        this._confirm = null;
      }
      // An update may have changed the text to type while the dialog was open, which closes it.
      if (!confirmed || this._destroyed || this._status !== 'pending' || this._confirmText !== expected) return;
    }
    const event = this.emit('approve', { values: this.getValues() }, { honorDomCancellation: true });
    if (event.defaultPrevented) return;
    this._answer('approved', null);
  }

  /** @private @returns {void} */
  _openEdit() {
    const fields = this._fields;
    if (this._status !== 'pending' || !fields || this._busy()) return;
    const editor = this._editor ?? this._buildEditor(fields);
    if (editor.fields !== fields) {
      // The fields changed since the form was built: the same dialog takes a new form.
      const fieldset = editForm(fields);
      editor.fieldset.destroy();
      editor.dialog.setContent(fieldset.el);
      editor.fieldset = fieldset;
      editor.fields = fields;
    }
    editor.fieldset.reset();
    editor.fieldset.clearHighlights();
    editor.fieldset.setValues(this._values, { silent: true });
    editor.dialog.open();
    const first = Object.keys(fields)[0];
    // After the dialog's own initial focus, which lands on its close button.
    queueMicrotask(() => {
      if (!this._destroyed && editor.dialog.isOpen()) editor.fieldset.focus(first);
    });
  }

  /**
   * The Edit dialog, built the first time it is needed.
   * @private
   * @param {Record<string, FieldOptions>} fields
   * @returns {{dialog: Dialog, fieldset: Fieldset, fields: Record<string, FieldOptions>}}
   */
  _buildEditor(fields) {
    const fieldset = editForm(fields);
    const dialog = new Dialog(null, {
      title: this.msg('approvalCard.editTitle'),
      size: 'md',
      scope: this.el,
      content: fieldset.el,
      buttons: [
        { label: this.msg('approvalCard.cancel'), action: 'cancel' },
        { label: this.msg('approvalCard.save'), kind: 'primary', action: () => this._saveEdit() }
      ]
    });
    this.listen(dialog.el, 'keydown', (event) => {
      if (isSubmitKey(/** @type {KeyboardEvent} */ (event))) {
        event.preventDefault();
        this._saveEdit();
      }
    });
    this._editor = { dialog, fieldset, fields };
    return this._editor;
  }

  /** @private @returns {void} */
  _saveEdit() {
    const editor = this._editor;
    const fields = this._fields;
    if (!editor || !fields || editor.fields !== fields || this._status !== 'pending') return;
    const entered = editor.fieldset.getValues();
    const missing = Object.keys(fields).filter((key) => fields[key]?.required && isEmptyValue(entered[key]));
    if (missing.length) {
      editor.fieldset.setHighlights(Object.fromEntries(missing.map((key) => [key, this.msg('approvalCard.required')])));
      editor.fieldset.focus(missing[0]);
      return;
    }
    const values = { ...this._values, ...entered };
    const changed = changedKeys(fields, this._values, values);
    const editedKeys = mergeEditedKeys(this._edited ? this._editedKeys : [], changed, fields);
    const event = this.emit('edit', {
      values: cloneValues(values),
      changed: [...changed],
      editedKeys: editedKeys ? [...editedKeys] : null
    }, { honorDomCancellation: true });
    editor.dialog.close();
    if (event.defaultPrevented) return;
    this._values = values;
    this._edited = true;
    this._editedKeys = editedKeys;
    this._drawChanges();
  }

  /** @private @returns {void} */
  _requestReject() {
    if (this._status !== 'pending' || this._busy()) return;
    if (this._reasonMode === 'none') {
      this._commitReject('');
      return;
    }
    const rejecter = this._rejecter ?? this._buildRejecter();
    if (rejecter.mode !== this._reasonMode) {
      // The reason became required or optional since the dialog was built: it takes a new field.
      const field = this._reasonField();
      rejecter.field.destroy();
      rejecter.dialog.setContent(field.el);
      rejecter.field = field;
      rejecter.mode = this._reasonMode;
    }
    rejecter.field.setValue('', { silent: true });
    rejecter.field.clearHighlight();
    this._syncRejectButton();
    rejecter.dialog.open();
    queueMicrotask(() => {
      if (!this._destroyed && rejecter.dialog.isOpen()) rejecter.field.focus();
    });
  }

  /**
   * The Reject dialog, built the first time it is needed.
   * @private
   * @returns {{dialog: Dialog, field: Field, blocked: boolean, mode: ApprovalReasonMode}}
   */
  _buildRejecter() {
    const required = this._reasonMode === 'required';
    const field = this._reasonField();
    const dialog = new Dialog(null, {
      title: this.msg('approvalCard.rejectTitle'),
      size: 'sm',
      scope: this.el,
      content: field.el,
      buttons: this._rejectButtons(required)
    });
    // On the dialog rather than the field, so a field built anew answers too.
    this.listen(dialog.el, 'input', () => this._syncRejectButton());
    this.listen(dialog.el, 'keydown', (event) => {
      if (isSubmitKey(/** @type {KeyboardEvent} */ (event))) {
        event.preventDefault();
        this._confirmReject();
      }
    });
    this._rejecter = { dialog, field, blocked: required, mode: this._reasonMode };
    return this._rejecter;
  }

  /** @private @returns {Field} The reason textarea, required or optional as the request asks. */
  _reasonField() {
    const required = this._reasonMode === 'required';
    const field = new Field(null, {
      type: 'textarea',
      label: this.msg('approvalCard.reasonLabel'),
      description: this.msg(required ? 'approvalCard.reasonRequired' : 'approvalCard.reasonOptional'),
      required,
      props: { rows: 3 }
    });
    field.el.classList.add('zx-approval-card__reason-field');
    return field;
  }

  /**
   * @private
   * @param {boolean} blocked Whether Reject is held until a reason is given.
   * @returns {import('../dialog/dialog.js').DialogButton[]}
   */
  _rejectButtons(blocked) {
    return [
      { label: this.msg('approvalCard.cancel'), action: 'cancel' },
      { label: this.msg('approvalCard.reject'), kind: 'danger', disabled: blocked, action: () => this._confirmReject() }
    ];
  }

  /** @private @returns {void} */
  _syncRejectButton() {
    const rejecter = this._rejecter;
    if (!rejecter) return;
    const blocked = this._reasonMode === 'required' && !String(rejecter.field.getValue() ?? '').trim();
    if (blocked === rejecter.blocked) return;
    rejecter.blocked = blocked;
    rejecter.dialog.setButtons(this._rejectButtons(blocked));
  }

  /** @private @returns {void} */
  _confirmReject() {
    const rejecter = this._rejecter;
    if (!rejecter || this._status !== 'pending' || this._reasonMode === 'none') return;
    const text = String(rejecter.field.getValue() ?? '').trim();
    if (this._reasonMode === 'required' && !text) {
      rejecter.field.setHighlight(this.msg('approvalCard.reasonMissing'), 'danger');
      rejecter.field.focus();
      return;
    }
    rejecter.dialog.close();
    this._commitReject(text);
  }

  /** @private @param {string} reason @returns {void} */
  _commitReject(reason) {
    const event = this.emit('reject', { reason }, { honorDomCancellation: true });
    if (event.defaultPrevented) return;
    this._answer('rejected', reason || null);
  }

  /**
   * Freezes the card into its record, answered now by whoever `answeredBy` names.
   * @private
   * @param {'approved'|'rejected'} status
   * @param {string|null} reason
   * @returns {void}
   */
  _answer(status, reason) {
    this._status = status;
    this._at = this._now();
    this._reason = reason;
    this._closeDialogs();
    this._sync();
  }

  /** @private @returns {void} */
  _closeDialogs() {
    this._confirm?.close(false);
    this._editor?.dialog.close();
    this._rejecter?.dialog.close();
  }

  /** @private @returns {string} Who answers, as the verdict names them. */
  _byText() {
    return this._by ?? this.msg('approvalCard.you');
  }

  /** @private @returns {void} Draws the icon tile, or takes it away when there is no icon. */
  _drawTile() {
    const name = this._icon;
    if (!name) {
      this._tileEl?.remove();
      this._tileEl = null;
      return;
    }
    const tile = this._tileEl ?? h('span', { class: 'zx-approval-card__tile', 'aria-hidden': 'true' });
    tile.dataset.tone = this._tone;
    tile.replaceChildren(icon(name, { size: 14 }));
    if (!this._tileEl) this._headEl.prepend(tile);
    this._tileEl = tile;
  }

  /** @private @returns {void} Draws the line under the title, and what describes the card. */
  _drawDescription() {
    const text = this._description;
    if (text && !this._descriptionEl) {
      this._descriptionEl = h('p', { class: 'zx-approval-card__description', id: this._descriptionId });
      this._titleEl.after(this._descriptionEl);
    } else if (!text && this._descriptionEl) {
      this._descriptionEl.remove();
      this._descriptionEl = null;
    }
    if (this._descriptionEl) this._descriptionEl.textContent = text;
    this.el.setAttribute('aria-describedby', [text ? this._descriptionId : '', this._noteEl.id].filter(Boolean).join(' '));
  }

  /** @private @param {unknown} details @returns {void} */
  _drawDetails(details) {
    this._details = snapshotContent(details);
    const node = contentNode(details, this._blockLevel);
    if (!node) {
      this._detailsEl?.remove();
      this._detailsEl = null;
    } else if (this._detailsEl) {
      this._detailsEl.replaceChildren(node);
    } else {
      this._detailsEl = h('div', { class: 'zx-approval-card__details' }, node);
      this._headEl.after(this._detailsEl);
    }
  }

  /**
   * Draws the preview disclosure, keeping its toggle — and whether it is open — across a change.
   * @private
   * @param {{label: string, content: unknown}|null} preview
   * @returns {void}
   */
  _drawPreview(preview) {
    const before = this._preview;
    this._preview = preview;
    if (!preview) {
      this._previewEl?.remove();
      this._previewEl = this._previewToggle = this._previewLabel = this._previewBody = null;
      return;
    }
    const fresh = !this._previewEl;
    if (fresh) {
      const bodyId = uid('zx-approval-card-preview');
      this._previewLabel = h('span');
      this._previewToggle = h('button', {
        type: 'button',
        class: 'zx-approval-card__disclosure',
        'aria-expanded': 'false',
        'aria-controls': bodyId,
        dataset: { approvalAction: 'preview' }
      }, icon('chevron-right', { size: 14 }), this._previewLabel);
      this._previewBody = h('div', { class: 'zx-approval-card__preview-body', id: bodyId, hidden: true });
      this._previewEl = h('div', { class: 'zx-approval-card__preview' }, this._previewToggle, this._previewBody);
      this._actionsEl.before(this._previewEl);
    }
    const label = /** @type {HTMLElement} */ (this._previewLabel);
    const body = /** @type {HTMLElement} */ (this._previewBody);
    label.textContent = preview.label || this.msg('approvalCard.preview');
    if (fresh || !sameValue(preview.content, before?.content)) {
      const node = contentNode(preview.content, this._blockLevel);
      body.replaceChildren(...(node ? [node] : []));
    }
  }

  /** @private @returns {void} Adds the Edit button when there are fields, and takes it away when not. */
  _drawEditButton() {
    if (this._fields && !this._editEl) {
      this._editEl = actionButton('edit', this.msg('approvalCard.edit'), 'E', this._keys);
      this._approveEl.after(this._editEl);
    } else if (!this._fields && this._editEl) {
      this._editEl.remove();
      this._editEl = null;
    }
  }

  /**
   * Draws everything that follows the status and the edits.
   * @private
   * @returns {void}
   */
  _sync() {
    this._drawState();
    this._drawChanges();
  }

  /**
   * Draws what follows the status: the state glyph and word, the line under the title, the
   * reason, and whether the actions show.
   * @private
   * @returns {void}
   */
  _drawState() {
    const root = /** @type {HTMLElement} */ (this.el);
    const status = this._status;
    root.dataset.state = status;

    const entry = STATUS[APPROVAL_STATES[status]];
    this._statusEl.replaceChildren(
      statusIcon(entry.status, { tone: /** @type {import('../select/glyphs.js').StatusTone} */ (entry.tone) }),
      h('span', { class: 'zx-approval-card__status-label' }, this.msg(STATUS_WORDS[status])));

    const verdict = answerVerdict(status, { by: this._byText(), at: this._at, now: this._at ? this._now() : null });
    this._noteEl.textContent = this.msg(verdict.key, ...verdict.args);

    const reason = status === 'pending' ? null : this._reason;
    this._reasonEl.replaceChildren(...(reason ? [
      h('p', { class: 'zx-approval-card__label' }, this.msg('approvalCard.reason')),
      h('blockquote', { class: 'zx-approval-card__quote' }, reason)
    ] : []));
    this._reasonEl.hidden = !reason;

    const pending = status === 'pending';
    const focused = root.ownerDocument.activeElement;
    const hadFocus = Boolean(focused && this._actionsEl.contains(focused));
    this._actionsEl.hidden = !pending;
    // The button that answered is gone; the card keeps focus rather than dropping it to the page.
    if (hadFocus && !pending) root.focus({ preventScroll: true });
  }

  /** @private @returns {void} Draws "Edited by you" over the edited values, or nothing. */
  _drawChanges() {
    if (!this._edited) {
      this._changesEl.replaceChildren();
      this._changesEl.hidden = true;
      return;
    }
    const entries = editedEntries(this._fields, this._values, this._editedKeys);
    this._changesEl.replaceChildren(
      h('p', { class: 'zx-approval-card__label' }, this.msg('approvalCard.editedBy', this._byText())),
      entries.length ? h('dl', { class: 'zx-approval-card__values' }, entries.map((item) => h('div', { class: 'zx-approval-card__value' },
        h('dt', { class: 'zx-approval-card__value-label' }, item.label),
        h('dd', { class: 'zx-approval-card__value-text' }, item.text || EMPTY_VALUE)))) : null);
    this._changesEl.hidden = false;
  }
}

/**
 * Fired when Approve goes through: after the typed confirmation when one is asked for.
 * Preventable: a prevented approval leaves the card pending.
 * @event ApprovalCard#approve
 * @type {CustomEvent<{values: Record<string, unknown>}>}
 */
/**
 * Fired when the Edit form is saved, with the values as saved, the fields this save changed, and
 * every field edited so far. Preventable: a prevented edit keeps the earlier values and the
 * earlier list of edited fields.
 * @event ApprovalCard#edit
 * @type {CustomEvent<ApprovalEditDetail>}
 */
/**
 * Fired when Reject goes through, with the reason given (empty when none was).
 * Preventable: a prevented rejection leaves the card pending.
 * @event ApprovalCard#reject
 * @type {CustomEvent<{reason: string}>}
 */

/* ------------------------------------------------------------------ helpers -- */

/**
 * Reads a request status, falling back to `pending` for anything unknown.
 * @param {unknown} status
 * @returns {ApprovalStatus}
 */
export function normalizeApprovalStatus(status) {
  return typeof status === 'string' && Object.hasOwn(APPROVAL_STATES, status)
    ? /** @type {ApprovalStatus} */ (status)
    : 'pending';
}

/**
 * Reads a reason mode, falling back to `optional`.
 * @param {unknown} reason
 * @returns {ApprovalReasonMode}
 */
export function normalizeReasonMode(reason) {
  return reason === 'required' || reason === 'none' ? reason : 'optional';
}

/**
 * The action a key asks for, or null: A approves, E edits (only with an Edit form), R rejects —
 * on a pending request, outside text controls, with no modifier held, and not while an input
 * method is composing or the key repeats.
 * @param {{key?: string, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean,
 *   isComposing?: boolean, repeat?: boolean, defaultPrevented?: boolean}|null|undefined} event Key event.
 * @param {{status: ApprovalStatus, canEdit?: boolean, editable?: boolean}} state The card's state,
 *   and whether the key came from a text control.
 * @returns {ApprovalAction|null}
 */
export function approvalKeyAction(event, state) {
  if (!event || !state || state.status !== 'pending' || state.editable) return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.isComposing || event.repeat || event.defaultPrevented) return null;
  const key = typeof event.key === 'string' && event.key.length === 1 ? event.key.toLowerCase() : '';
  const action = Object.hasOwn(ACTION_KEYS, key) ? ACTION_KEYS[/** @type {keyof typeof ACTION_KEYS} */ (key)] : null;
  if (action === 'edit' && !state.canEdit) return null;
  return /** @type {ApprovalAction|null} */ (action);
}

/**
 * The line under the title: the pause note while pending, otherwise who answered and when.
 * @param {ApprovalStatus} status
 * @param {{by?: string, time?: string}} [answer={}] Who answered, and the formatted time.
 * @returns {{key: string, args: string[]}} Message key and its arguments.
 */
export function approvalVerdict(status, { by = 'you', time = '' } = {}) {
  switch (normalizeApprovalStatus(status)) {
    case 'approved':
      return time ? { key: 'approvalCard.approvedBy', args: [by, time] } : { key: 'approvalCard.approvedByUndated', args: [by] };
    case 'rejected':
      return time ? { key: 'approvalCard.rejectedBy', args: [by, time] } : { key: 'approvalCard.rejectedByUndated', args: [by] };
    case 'expired':
      return time ? { key: 'approvalCard.expiredAt', args: [time] } : { key: 'approvalCard.expiredUndated', args: [] };
    default:
      return { key: 'approvalCard.paused', args: [] };
  }
}

/**
 * The line under the title for a request as it stands, the answer time written against `now`:
 * the clock alone on the same day, the date as well on another.
 * @param {ApprovalStatus} status
 * @param {{by?: string, at?: string|Date|null, now?: Date|null}} [answer={}] Who answered, when,
 *   and the time it is now (real time when null).
 * @returns {{key: string, args: string[]}} Message key and its arguments.
 */
export function answerVerdict(status, { by = 'you', at = null, now = null } = {}) {
  const date = toDate(at);
  return approvalVerdict(status, { by, time: date ? formatAnsweredAt(date, toDate(now) ?? new Date()) : '' });
}

/**
 * Reads a list of edited value names: the distinct non-empty strings, in the order given, or
 * null when it is not a list.
 * @param {unknown} keys
 * @returns {string[]|null}
 */
export function normalizeEditedKeys(keys) {
  if (!Array.isArray(keys)) return null;
  return [...new Set(keys.filter((key) => typeof key === 'string' && key !== ''))];
}

/**
 * Whether a request reads as edited, and which values it lists as edited. A non-empty
 * `editedKeys` marks it edited; `edited` without a list lists every field.
 * @param {unknown} edited The `edited` option.
 * @param {unknown} editedKeys The `editedKeys` option.
 * @returns {{edited: boolean, keys: string[]|null}} The values to list: null for every field,
 *   empty when the request was not edited.
 */
export function editedState(edited, editedKeys) {
  const keys = normalizeEditedKeys(editedKeys);
  if (keys?.length || edited) return { edited: true, keys };
  return { edited: false, keys: [] };
}

/**
 * The fields edited so far once another save is added: the union, in field order, with names
 * no field has kept at the end. Null — every field — stays null.
 * @param {string[]|null|undefined} current The fields edited before.
 * @param {string[]|null|undefined} added The fields the save changed.
 * @param {Record<string, unknown>|null} [fields=null] The Edit form, for the order.
 * @returns {string[]|null}
 */
export function mergeEditedKeys(current, added, fields = null) {
  if (current === null) return null;
  return inFieldOrder(normalizeEditedKeys([...(current ?? []), ...(added ?? [])]) ?? [], fields);
}

/**
 * Whether two option values are the same: equal primitives, dates at the same time, and arrays
 * and plain objects with the same contents. Anything else — a node, a function — only when it is
 * the very same object.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function sameValue(a, b) {
  return sameAt(a, b, 0);
}

/**
 * Reads a time: a Date, a local ISO date-time ("2026-11-03T10:31"), or epoch milliseconds.
 * @param {unknown} value
 * @returns {Date|null}
 */
export function toDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? new Date(value.getTime())
    : typeof value === 'number' || typeof value === 'string' ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * How an answer time is written: the clock alone on the day it is read, the day and month within
 * the year, and the full date before that.
 * @param {Date} date
 * @param {Date} [now=new Date()]
 * @returns {string} A `formatDate()` pattern.
 */
export function answeredTimeFormat(date, now = new Date()) {
  if (date.getFullYear() !== now.getFullYear()) return translate('approvalCard.fullDateTimeFormat');
  if (date.getMonth() !== now.getMonth() || date.getDate() !== now.getDate()) return translate('approvalCard.dateTimeFormat');
  return '%H:%M';
}

/**
 * An answer time as the verdict writes it: "10:31", "2 Nov, 10:31", "2 Nov 2025, 10:31".
 * @param {Date} date
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function formatAnsweredAt(date, now = new Date()) {
  return formatDate(date, answeredTimeFormat(date, now));
}

/**
 * Whether a value counts as not given: nothing, blank text, or an empty list.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmptyValue(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return Array.isArray(value) && value.length === 0;
}

/**
 * The fields whose value differs between two sets of values. Nothing, `undefined`, and empty text
 * count as the same.
 * @param {Record<string, unknown>|null} fields
 * @param {Record<string, unknown>} before
 * @param {Record<string, unknown>} after
 * @returns {string[]} Field keys, in field order.
 */
export function changedKeys(fields, before, after) {
  return Object.keys(fields ?? {}).filter((key) => comparable(before?.[key]) !== comparable(after?.[key]));
}

/**
 * A value as the list of edited values shows it. A choice field's option label stands for its
 * value; a list joins with commas.
 * @param {unknown} value
 * @param {{options?: unknown}|null} [field]
 * @returns {string} The text, or '' for no value.
 */
export function displayValue(value, field = null) {
  const options = field?.options;
  const labels = options && typeof options === 'object' && !Array.isArray(options)
    ? /** @type {Record<string, unknown>} */ (options) : null;
  /** @param {unknown} item @returns {string} */
  const label = (item) => (labels && Object.hasOwn(labels, String(item)) ? String(labels[String(item)]) : String(item));
  if (isEmptyValue(value)) return '';
  if (Array.isArray(value)) return value.filter((item) => !isEmptyValue(item)).map(label).join(', ');
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return label(value);
}

/**
 * The edited values to list: the changed fields when they are known, otherwise every field.
 * A request restored from a record with no fields lists every value it carries.
 * @param {Record<string, {label?: string, options?: unknown}>|null} fields
 * @param {Record<string, unknown>} values
 * @param {Set<string>|string[]|null} changed The edited values to list; null for every field.
 * @returns {Array<{key: string, label: string, text: string}>} In field order.
 */
export function editedEntries(fields, values, changed) {
  const keys = fields ? Object.keys(fields) : Object.keys(values ?? {});
  const only = changed == null ? null : new Set(changed);
  return keys
    .filter((key) => !only || only.has(key))
    .map((key) => ({
      key,
      label: String(fields?.[key]?.label || key),
      text: displayValue(values?.[key], fields?.[key] ?? null)
    }));
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @param {number} depth How deep the comparison has gone; past 32 levels it gives up as different.
 * @returns {boolean}
 */
function sameAt(a, b, depth) {
  if (Object.is(a, b)) return true;
  if (depth > 32 || !a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((item, index) => sameAt(item, b[index], depth + 1));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const left = /** @type {Record<string, unknown>} */ (a);
  const right = /** @type {Record<string, unknown>} */ (b);
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && sameAt(left[key], right[key], depth + 1));
}

/** @param {object} value @returns {boolean} Whether it is a plain object rather than an instance. */
function isPlainObject(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Value names in field order, with names no field has kept after them in the order given.
 * @param {string[]} keys
 * @param {Record<string, unknown>|null} fields
 * @returns {string[]}
 */
function inFieldOrder(keys, fields) {
  const order = Object.keys(fields ?? {});
  const listed = new Set(keys);
  return [...order.filter((key) => listed.has(key)), ...keys.filter((key) => !order.includes(key))];
}

/**
 * What content was drawn from, kept to compare an update against: a copy of blocks, so a caller
 * changing its own array later still reads as a change; a node as itself.
 * @param {unknown} content
 * @returns {unknown}
 */
function snapshotContent(content) {
  if (content == null) return null;
  if (typeof content !== 'object' || typeof (/** @type {Node} */ (content)).nodeType === 'number') return content;
  try {
    return structuredClone(content);
  } catch {
    return content;
  }
}

/**
 * The preview as the card draws it, or null for none.
 * @param {unknown} preview
 * @returns {{label: string, content: unknown}|null}
 */
function previewState(preview) {
  if (!preview || typeof preview !== 'object') return null;
  const value = /** @type {ApprovalPreview} */ (preview);
  return {
    label: value.label == null ? '' : String(value.label),
    content: snapshotContent(value.content ?? value.blocks ?? null)
  };
}

/** @param {unknown} tone @returns {ApprovalTone} A known tone, blue otherwise. */
function normalizeTone(tone) {
  return TONES.includes(String(tone)) ? /** @type {ApprovalTone} */ (String(tone)) : 'blue';
}

/** @param {unknown} text @returns {string} The text Approve asks for, or '' for none. */
function confirmTextOf(text) {
  return text == null ? '' : String(text).trim();
}

/**
 * One of the card's action buttons, carrying its action and, with keys on, its key hint.
 * @param {ApprovalAction} action
 * @param {string} label
 * @param {string} letter
 * @param {boolean} keys Whether the card answers its keys.
 * @param {'default'|'primary'} [kind='default']
 * @returns {HTMLButtonElement}
 */
function actionButton(action, label, letter, keys, kind = 'default') {
  const control = button({ label, kind, shortcut: keys ? { label: letter, keys: letter } : undefined });
  control.dataset.approvalAction = action;
  return control;
}

/**
 * The Edit form for a set of fields.
 * @param {Record<string, FieldOptions>} fields
 * @returns {Fieldset}
 */
function editForm(fields) {
  const fieldset = new Fieldset(null, { fields });
  fieldset.el.classList.add('zx-approval-card__form');
  return fieldset;
}

/** @param {unknown} value @returns {string} */
function comparable(value) {
  if (value === undefined || value === null || value === '') return 'null';
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return String(value);
  }
}

/** @param {unknown} value @returns {string|null} */
function textOrNull(value) {
  return value == null || String(value).trim() === '' ? null : String(value);
}

/**
 * A copy of the values, so neither the caller's object nor a listener's changes reach the card.
 * @param {unknown} values
 * @returns {Record<string, unknown>}
 */
function cloneValues(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
  try {
    return structuredClone(/** @type {Record<string, unknown>} */ (values));
  } catch {
    return { .../** @type {Record<string, unknown>} */ (values) };
  }
}

/**
 * The Edit form's fields, or null for no Edit.
 * @param {unknown} fields
 * @returns {Record<string, FieldOptions>|null}
 */
function editFields(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null;
  return Object.keys(fields).length ? /** @type {Record<string, FieldOptions>} */ (fields) : null;
}

/**
 * Draws a node or blocks. Blocks are set as interface-sized prose, their text as text only.
 * @param {unknown} content
 * @param {2|3|4|5} headingLevel
 * @returns {Node|null}
 */
function contentNode(content, headingLevel) {
  if (content == null) return null;
  if (Array.isArray(content)) {
    return h('div', { class: 'zx-prose zx-approval-card__blocks', dataset: { size: 'sm', zxMeasure: 'full' } },
      renderBlocks(/** @type {Block[]} */ (content), { headingLevel }));
  }
  if (typeof content === 'string') return h('p', { class: 'zx-approval-card__text' }, content);
  if (typeof (/** @type {Node} */ (content)).nodeType === 'number') return /** @type {Node} */ (content);
  return null;
}

/** @param {KeyboardEvent} event @returns {boolean} Whether the key is Mod+Enter. */
function isSubmitKey(event) {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.isComposing;
}
