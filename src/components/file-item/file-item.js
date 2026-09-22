// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { formatFileSize } from '../../core/format.js';
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
 * @property {string} [mime=''] MIME type.
 * @property {EntityRefContent} [subtitle=null] Optional supporting text before generated metadata.
 * @property {EntityRefIcon} [icon='file'] File icon name, node, component, or lazy renderer.
 * @property {EntityRefMetadata[]} [metadata=[]] Additional labelled metadata.
 * @property {EntityRefLinkValue} [link=null] Optional safe native file/download link.
 * @property {EntityRefActionEntry[]} [actions=[]] File actions; application policy stays external.
 * @property {FileStatus} [status='ready'] Durable or transient presentation state.
 * @property {string|null} [statusLabel=null] Overrides the generated state label; an empty string hides it.
 * @property {number|null} [progress=null] Completed percentage, clamped to 0–100.
 * @property {boolean} [indeterminate=false] Whether active progress has no known amount.
 * @property {'sm'|'md'|'lg'} [density='md'] File-identity presentation size.
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
 * @property {EntityRefContent} subtitle Supporting content.
 * @property {EntityRefIcon} icon File visual.
 * @property {EntityRefMetadata[]} metadata Additional metadata.
 * @property {import('../entity-ref/entity-ref.js').EntityRefLink|null} link Safe native link.
 * @property {EntityRefActionEntry[]} actions Normalized actions.
 * @property {FileStatus} status Presentation state.
 * @property {string|null} statusLabel Explicit state label, or null for the generated label.
 * @property {number|null} progress Completed percentage.
 * @property {boolean} indeterminate Unknown-progress state.
 * @property {'sm'|'md'|'lg'} density Identity size.
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
    subtitle: null,
    icon: 'file',
    metadata: [],
    link: null,
    actions: [],
    status: 'ready',
    statusLabel: null,
    progress: null,
    indeterminate: false,
    density: 'md',
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
    root.dataset.density = state.density;
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
    density: source.density === 'sm' || source.density === 'lg' ? source.density : 'md',
    wrap: Boolean(source.wrap),
    actionsLabel: String(source.actionsLabel || 'File actions'),
    locale: normalizeLocale(source.locale)
  };
}

/** @param {FileItemState} state @returns {import('../entity-ref/entity-ref.js').EntityRefOptions} */
function entityOptions(state) {
  const metadata = [];
  if (state.mime) metadata.push({ label: 'Type', value: state.mime, showLabel: false });
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
    icon: state.icon,
    metadata,
    link: state.link,
    actions: state.actions,
    size: state.density,
    wrap: state.wrap,
    actionsLabel: state.actionsLabel
  };
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
