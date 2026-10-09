// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { formatFileSize } from '../../core/format.js';
import { getIconConfig, iconNames } from '../../core/icons.js';
import { isElement } from '../../core/util.js';
import { badge } from '../badge/badge.js';
import {
  EntityRef, normalizeEntityRefActions, normalizeEntityRefLink, normalizeEntityRefMetadata
} from '../entity-ref/entity-ref.js';

/** @typedef {import('../entity-ref/entity-ref.js').EntityRefContent} EntityRefContent */
/** @typedef {import('../entity-ref/entity-ref.js').EntityRefIcon} EntityRefIcon */
/** @typedef {import('../entity-ref/entity-ref.js').EntityRefMetadata} EntityRefMetadata */
/** @typedef {import('../entity-ref/entity-ref.js').EntityRefLinkValue} EntityRefLinkValue */
/** @typedef {import('../entity-ref/entity-ref.js').EntityRefActionEntry} EntityRefActionEntry */
/** @typedef {'ready'|'temporary'|'waiting'|'uploading'|'processing'|'success'|'error'} FileStatus */

/**
 * @typedef {Object} FileItemOptions
 * @property {unknown} [id=null] Application-owned file identifier included in events.
 * @property {string} [name=''] File name.
 * @property {number|string|null} [size=null] Byte count; invalid and negative values are omitted.
 * @property {string} [mime=''] MIME type. Shown as a readable type ("PDF", "Image"), never as
 *   the raw string, and used to pick the icon.
 * @property {string|null} [typeLabel=null] Type shown beside the size; null derives it from the
 *   MIME type (or the name's extension when the MIME type is unfamiliar), an empty string hides it.
 * @property {EntityRefContent} [subtitle=null] Optional supporting text before generated metadata.
 * @property {EntityRefIcon} [icon='file'] File icon name, node, component, or lazy renderer. The
 *   generic `'file'` glyph gives way to one for the MIME type when the active icon set has it.
 * @property {EntityRefMetadata[]} [metadata=[]] Additional labelled metadata.
 * @property {EntityRefLinkValue} [link=null] Optional safe native file/download link.
 * @property {EntityRefActionEntry[]} [actions=[]] File actions; application policy stays external.
 * @property {FileStatus} [status='ready'] Durable or transient presentation state.
 * @property {string|null} [statusLabel=null] Overrides the generated state label; an empty string hides it.
 * @property {number|null} [progress=null] Completed percentage, clamped to 0–100.
 * @property {boolean} [indeterminate=false] Whether active progress has no known amount.
 * @property {'sm'|'md'|'lg'} [identitySize='md'] Size of the file's icon and name.
 * @property {boolean} [wrap=false] Whether long identity text may wrap.
 * @property {string} [actionsLabel='File actions'] Accessible name for secondary actions.
 * @property {string} [locale] Locale passed to `formatFileSize`.
 * @property {(event: CustomEvent<{id: unknown, file: Readonly<FileItemState>, href: string, event: MouseEvent}>) => void} [onactivate]
 *   Preventable native-link listener.
 * @property {(event: CustomEvent<{id: string, fileId: unknown, action: object, file: Readonly<FileItemState>, event: MouseEvent}>) => void} [onaction]
 *   Preventable file-action listener.
 */

/**
 * @typedef {Object} FileItemState
 * @property {unknown} id File identifier.
 * @property {string} name File name.
 * @property {number|null} size Byte count.
 * @property {string} mime MIME type.
 * @property {string|null} typeLabel Explicit type label, or null for the one derived from `mime`.
 * @property {EntityRefContent} subtitle Supporting content.
 * @property {EntityRefIcon} icon File visual.
 * @property {EntityRefMetadata[]} metadata Additional metadata.
 * @property {import('../entity-ref/entity-ref.js').EntityRefLink|null} link Safe native link.
 * @property {EntityRefActionEntry[]} actions Normalized actions.
 * @property {FileStatus} status Presentation state.
 * @property {string|null} statusLabel Explicit state label, or null for the generated label.
 * @property {number|null} progress Completed percentage.
 * @property {boolean} indeterminate Unknown-progress state.
 * @property {'sm'|'md'|'lg'} identitySize Size of the file's icon and name.
 * @property {boolean} wrap Wrapping state.
 * @property {string} actionsLabel Action-group label.
 * @property {string|undefined} locale File-size locale.
 */

const FILE_STATUSES = new Set([
  'ready', 'temporary', 'waiting', 'uploading', 'processing', 'success', 'error'
]);

const STATUS_LABELS = Object.freeze({
  ready: '',
  temporary: 'Temporary',
  waiting: 'Waiting',
  uploading: 'Uploading',
  processing: 'Processing',
  success: 'Complete',
  error: 'Failed'
});

/**
 * Durable or transient file presentation. The host owns upload/download transport, authorization,
 * preview behavior, retry policy, and persistence.
 * @fires FileItem#activate
 * @fires FileItem#action
 * @extends {Component<FileItemOptions>}
 */
export class FileItem extends Component {
  static cssName = 'file-item';

  /** @type {Readonly<FileItemOptions>} */
  static defaults = {
    id: null,
    name: '',
    size: null,
    mime: '',
    typeLabel: null,
    subtitle: null,
    icon: 'file',
    metadata: [],
    link: null,
    actions: [],
    status: 'ready',
    statusLabel: null,
    progress: null,
    indeterminate: false,
    identitySize: 'md',
    wrap: false,
    actionsLabel: 'File actions'
  };

  /**
   * Creates or enhances a file row.
   * @param {Element|string|null} [target=null] Existing host, selector, or null.
   * @param {FileItemOptions} [options={}] File presentation.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    this._destroyed = false;
    this._state = normalizeFileItem(this.options);

    const entityHost = h('div', { ref: 'entity', class: 'zx-file-item__entity' });
    root.replaceChildren(
      entityHost,
      h('div', { ref: 'status', class: 'zx-file-item__status', role: 'status' }),
      h('div', { ref: 'progress', class: 'zx-file-item__progress' },
        h('div', { ref: 'progressHead', class: 'zx-file-item__progress-head' }),
        h('div', {
          ref: 'progressTrack',
          class: 'zx-file-item__progress-track',
          role: 'progressbar',
          ariaValuemin: '0',
          ariaValuemax: '100'
        }, h('div', { ref: 'progressFill', class: 'zx-file-item__progress-fill' })))
    );

    this._entity = new EntityRef(entityHost, entityOptions(this._state));
    this.listen(this._entity.el, 'zx-activate', (event) => this._forwardActivate(/** @type {CustomEvent} */ (event)));
    this.listen(this._entity.el, 'zx-action', (event) => this._forwardAction(/** @type {CustomEvent} */ (event)));
    this._sync();
    return root;
  }

  /**
   * Updates any subset of the file without replacing the row root.
   * @param {Partial<FileItemOptions>} values Next values.
   * @returns {this}
   */
  set(values = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) return this;
    this._state = normalizeFileItem({ ...this._state, ...values });
    this._sync();
    return this;
  }

  /**
   * Updates the file lifecycle state and, optionally, its visible label.
   * @param {FileStatus} status State.
   * @param {string|null} [statusLabel] Explicit label.
   * @returns {this}
   */
  setStatus(status, statusLabel) {
    return this.set({ status, ...(statusLabel === undefined ? {} : { statusLabel }) });
  }

  /**
   * Updates the progress meter.
   * @param {number|null} progress Completed percentage, or null.
   * @param {{indeterminate?: boolean}} [options={}] Unknown-progress override.
   * @returns {this}
   */
  setProgress(progress, { indeterminate = false } = {}) {
    return this.set({ progress, indeterminate });
  }

  /** Returns a defensive file snapshot. @returns {Readonly<FileItemState>} */
  getFile() {
    return fileSnapshot(this._state);
  }

  /** Focuses the native destination or first enabled action. @returns {this} */
  focus() {
    this._entity.focus();
    return this;
  }

  /** Restores an enhanced target exactly, or removes an owned row. @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const root = this.el;
    this._entity?.destroy();
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }

  /** @returns {void} */
  _sync() {
    const state = this._state;
    const root = /** @type {HTMLElement} */ (this.el);
    const status = /** @type {HTMLElement} */ (this.refs.status);
    const progress = /** @type {HTMLElement} */ (this.refs.progress);
    const track = /** @type {HTMLElement} */ (this.refs.progressTrack);
    const fill = /** @type {HTMLElement} */ (this.refs.progressFill);
    root.dataset.status = state.status;
    root.dataset.identitySize = state.identitySize;
    this._entity.set(entityOptions(state));

    const label = fileStatusLabel(state);
    status.replaceChildren(...(label ? [badge({
      label,
      kind: statusKind(state.status),
      size: 'sm',
      dot: state.status !== 'ready'
    })] : []));
    status.hidden = label === '';

    const visible = state.indeterminate || state.progress !== null;
    progress.hidden = !visible;
    progress.toggleAttribute('data-indeterminate', state.indeterminate);
    if (!visible) return;

    const progressLabel = `${label || 'Progress'}${state.indeterminate || state.progress === null
      ? '' : ` — ${Math.round(state.progress)}%`}`;
    this.refs.progressHead.textContent = progressLabel;
    track.setAttribute('aria-label', `${state.name || 'File'}: ${label || 'Progress'}`);
    if (state.indeterminate) {
      track.removeAttribute('aria-valuenow');
      track.removeAttribute('aria-valuetext');
      fill.style.removeProperty('--zx-file-progress');
    } else {
      const value = state.progress ?? 0;
      track.setAttribute('aria-valuenow', String(value));
      track.setAttribute('aria-valuetext', `${Math.round(value)}%`);
      fill.style.setProperty('--zx-file-progress', `${value}%`);
    }
  }

  /** @param {CustomEvent} event @returns {void} */
  _forwardActivate(event) {
    const detail = /** @type {{href?:string,event?:MouseEvent}} */ (event.detail ?? {});
    const forwarded = this.emit('activate', {
      id: this._state.id,
      file: this.getFile(),
      href: String(detail.href ?? ''),
      event: detail.event
    }, { honorDomCancellation: true });
    if (forwarded.defaultPrevented) event.preventDefault();
  }

  /** @param {CustomEvent} event @returns {void} */
  _forwardAction(event) {
    const detail = /** @type {{id?:string,action?:object,event?:MouseEvent}} */ (event.detail ?? {});
    const forwarded = this.emit('action', {
      id: String(detail.id ?? ''),
      fileId: this._state.id,
      action: detail.action ?? {},
      file: this.getFile(),
      event: detail.event
    }, { honorDomCancellation: true });
    if (forwarded.defaultPrevented) event.preventDefault();
  }
}

/**
 * Normalizes a file presentation without touching the DOM.
 * @param {Partial<FileItemOptions>|null|undefined} values Candidate values.
 * @returns {FileItemState}
 */
export function normalizeFileItem(values = {}) {
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const rawSize = source.size == null || source.size === '' ? null : Number(source.size);
  const rawProgress = source.progress == null ? null : Number(source.progress);
  const status = FILE_STATUSES.has(String(source.status))
    ? /** @type {FileStatus} */ (String(source.status)) : 'ready';
  return {
    id: source.id ?? null,
    name: String(source.name ?? ''),
    size: rawSize !== null && Number.isFinite(rawSize) && rawSize >= 0 ? rawSize : null,
    mime: String(source.mime ?? ''),
    typeLabel: source.typeLabel == null ? null : String(source.typeLabel),
    subtitle: normalizeFileContent(source.subtitle),
    icon: source.icon === undefined ? 'file' : source.icon,
    metadata: normalizeEntityRefMetadata(source.metadata),
    link: normalizeEntityRefLink(source.link),
    actions: normalizeEntityRefActions(source.actions),
    status,
    statusLabel: source.statusLabel == null ? null : String(source.statusLabel),
    progress: rawProgress === null || !Number.isFinite(rawProgress)
      ? null : Math.min(100, Math.max(0, rawProgress)),
    indeterminate: Boolean(source.indeterminate),
    identitySize: source.identitySize === 'sm' || source.identitySize === 'lg' ? source.identitySize : 'md',
    wrap: Boolean(source.wrap),
    actionsLabel: String(source.actionsLabel || 'File actions'),
    locale: normalizeLocale(source.locale)
  };
}

/** @param {FileItemState} state @returns {import('../entity-ref/entity-ref.js').EntityRefOptions} */
function entityOptions(state) {
  const metadata = [];
  const type = state.typeLabel ?? fileTypeLabel(state.mime, state.name);
  if (type) metadata.push({ label: 'Type', value: type, showLabel: false });
  if (state.size !== null) {
    metadata.push({
      label: 'Size',
      value: formatFileSize(state.size, { locale: state.locale }),
      showLabel: false
    });
  }
  metadata.push(...state.metadata);
  return {
    id: state.id,
    title: state.name,
    subtitle: state.subtitle,
    icon: state.icon === 'file' ? fileTypeIcon(state.mime) : state.icon,
    metadata,
    link: state.link,
    actions: state.actions,
    size: state.identitySize,
    wrap: state.wrap,
    actionsLabel: state.actionsLabel
  };
}

/**
 * What a MIME type is called and drawn as. Labels are what a reader recognises — a format's own
 * acronym where it has a well-known one, the family otherwise — and icons are Font Awesome names
 * in order of preference, used only when the active icon set can draw them.
 * @type {Readonly<Record<string, {label: string, icons: string[]}>>}
 */
const FILE_KINDS = Object.freeze({
  pdf: { label: 'PDF', icons: ['file-pdf'] },
  csv: { label: 'CSV', icons: ['file-csv', 'file-excel'] },
  tsv: { label: 'TSV', icons: ['file-csv', 'file-excel'] },
  spreadsheet: { label: 'Spreadsheet', icons: ['file-excel'] },
  document: { label: 'Document', icons: ['file-word', 'file-lines'] },
  presentation: { label: 'Presentation', icons: ['file-powerpoint'] },
  text: { label: 'Text', icons: ['file-lines'] },
  markdown: { label: 'Markdown', icons: ['file-lines'] },
  html: { label: 'HTML', icons: ['file-code', 'code'] },
  css: { label: 'CSS', icons: ['file-code', 'code'] },
  javascript: { label: 'JavaScript', icons: ['file-code', 'code'] },
  json: { label: 'JSON', icons: ['file-code', 'code'] },
  xml: { label: 'XML', icons: ['file-code', 'code'] },
  zip: { label: 'ZIP', icons: ['file-zipper'] },
  gzip: { label: 'GZIP', icons: ['file-zipper'] },
  tar: { label: 'TAR', icons: ['file-zipper'] },
  rar: { label: 'RAR', icons: ['file-zipper'] },
  sevenZip: { label: '7Z', icons: ['file-zipper'] },
  email: { label: 'Email', icons: ['envelope'] },
  calendar: { label: 'Calendar', icons: ['calendar'] },
  contact: { label: 'Contact', icons: ['address-card'] },
  image: { label: 'Image', icons: ['file-image', 'image'] },
  video: { label: 'Video', icons: ['file-video', 'video'] },
  audio: { label: 'Audio', icons: ['file-audio'] },
  font: { label: 'Font', icons: ['font'] }
});

/** Exact MIME types, lower case and without parameters, mapped to their kind. */
const MIME_KINDS = new Map(Object.entries({
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/comma-separated-values': 'csv',
  'text/tab-separated-values': 'tsv',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheet',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.oasis.opendocument.text': 'document',
  'application/rtf': 'document',
  'text/rtf': 'document',
  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
  'application/vnd.oasis.opendocument.presentation': 'presentation',
  'text/plain': 'text',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'text/css': 'css',
  'text/javascript': 'javascript',
  'application/javascript': 'javascript',
  'application/json': 'json',
  'application/ld+json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/gzip': 'gzip',
  'application/x-gzip': 'gzip',
  'application/x-tar': 'tar',
  'application/vnd.rar': 'rar',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': 'sevenZip',
  'message/rfc822': 'email',
  'text/calendar': 'calendar',
  'text/vcard': 'contact',
  'text/x-vcard': 'contact'
}));

/** Top-level MIME types that name a whole family. */
const MIME_FAMILIES = new Map([
  ['image', 'image'], ['video', 'video'], ['audio', 'audio'], ['font', 'font'], ['text', 'text']
]);

/**
 * @param {string} mime MIME type, possibly with parameters.
 * @returns {{label: string, icons: string[]}|null}
 */
function fileKind(mime) {
  const essence = String(mime ?? '').split(';')[0].trim().toLowerCase();
  if (!essence) return null;
  const kind = MIME_KINDS.get(essence) ?? MIME_FAMILIES.get(essence.split('/')[0]);
  return kind ? FILE_KINDS[kind] : null;
}

/**
 * A readable name for a file's type: "PDF", "CSV", "Image", "Spreadsheet". An unfamiliar MIME type
 * falls back to the name's extension in capitals ("EXE"); without a MIME type, or with neither,
 * the result is empty — a raw MIME string is never shown.
 * @param {string} mime MIME type, possibly with parameters (`text/csv; charset=utf-8`).
 * @param {string} [name=''] File name, consulted only when the MIME type is unfamiliar.
 * @returns {string}
 */
export function fileTypeLabel(mime, name = '') {
  if (!String(mime ?? '').trim()) return '';
  const kind = fileKind(mime);
  if (kind) return kind.label;
  const extension = /\.([a-z0-9]{1,5})$/i.exec(String(name ?? ''))?.[1];
  return extension ? extension.toUpperCase() : '';
}

/**
 * The icon name for a MIME type: a type-specific glyph when the active icon set can draw one,
 * `'file'` otherwise. Font Awesome resolves every name it is given; the bundled inline set only
 * those it carries or that `registerIcons()` added, so a missing glyph never shows a placeholder.
 * @param {string} mime MIME type, possibly with parameters.
 * @returns {string}
 */
export function fileTypeIcon(mime) {
  const candidates = fileKind(mime)?.icons ?? [];
  if (!candidates.length) return 'file';
  if (getIconConfig().provider === 'fontawesome') return candidates[0];
  const available = new Set(iconNames());
  return candidates.find((name) => available.has(name)) ?? 'file';
}

/** @param {FileItemState} state @returns {string} */
function fileStatusLabel(state) {
  return state.statusLabel === null ? STATUS_LABELS[state.status] : state.statusLabel;
}

/** @param {FileStatus} status @returns {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} */
function statusKind(status) {
  if (status === 'error') return 'danger';
  if (status === 'success') return 'success';
  if (status === 'temporary' || status === 'waiting') return 'warning';
  if (status === 'uploading') return 'info';
  if (status === 'processing') return 'accent';
  return 'neutral';
}

/** @param {unknown} value @returns {EntityRefContent} */
function normalizeFileContent(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value instanceof Component || (typeof value === 'object'
    && typeof /** @type {{nodeType?:unknown}} */ (value).nodeType === 'number')) {
    return /** @type {Node|Component} */ (value);
  }
  return String(value);
}

/** @param {unknown} value @returns {string|undefined} */
function normalizeLocale(value) {
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

/** @param {FileItemState} state @returns {Readonly<FileItemState>} */
function fileSnapshot(state) {
  return Object.freeze({
    ...state,
    metadata: state.metadata.map((entry) => ({ ...entry })),
    link: state.link ? { ...state.link } : null,
    actions: state.actions.map((entry) => isElement(entry) ? entry : { ...entry })
  });
}

/** Fired before a native file link continues. @event FileItem#activate @type {CustomEvent<{id: unknown, file: Readonly<FileItemState>, href: string, event: MouseEvent}>} */
/** Fired before a descriptor action callback runs. @event FileItem#action @type {CustomEvent<{id: string, fileId: unknown, action: object, file: Readonly<FileItemState>, event: MouseEvent}>} */
