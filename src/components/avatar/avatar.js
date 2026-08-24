import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';

/**
 * @typedef {Object} AvatarOptions
 * @property {string|null} [src=null] Image URL.
 * @property {string} [name=''] Name used to derive fallback initials.
 * @property {string|null} [initials=null] Explicit fallback initials.
 * @property {string|null} [label=null] Accessible label; null makes the avatar decorative.
 * @property {string|number} [size='md'] Preset (`sm`, `md`, `lg`) or pixel size.
 * @property {'circle'|'rounded'|'square'} [shape='circle'] Avatar shape.
 * @property {'online'|'away'|'busy'|'offline'|null} [status=null] Optional presence state.
 * @property {string|null} [statusLabel=null] Text alternative for the presence state.
 */

/**
 * Stable-size user image with deterministic initials fallback and optional presence state.
 * @extends {Component<AvatarOptions>}
 */
export class Avatar extends Component {
  static cssName = 'avatar';

  /** @type {Readonly<AvatarOptions>} */
  static defaults = {
    src: null,
    name: '',
    initials: null,
    label: null,
    size: 'md',
    shape: 'circle',
    status: null,
    statusLabel: null
  };

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('span'));
    this.el = root;
    this._original = this._createdRoot ? null : {
      attributes: Array.from(root.attributes, (attribute) => [attribute.name, attribute.value]),
      children: Array.from(root.childNodes)
    };
    this._state = {
      src: this.options.src,
      name: String(this.options.name ?? ''),
      initials: this.options.initials,
      label: this.options.label,
      size: this.options.size,
      shape: this.options.shape,
      status: this.options.status,
      statusLabel: this.options.statusLabel
    };

    const image = /** @type {HTMLImageElement} */ (h('img', {
      ref: 'image',
      class: 'zx-avatar__image',
      alt: '',
      draggable: false
    }));
    const fallback = h('span', {
      ref: 'fallback',
      class: 'zx-avatar__fallback',
      ariaHidden: 'true'
    });
    const status = h('span', {
      ref: 'status',
      class: 'zx-avatar__status',
      ariaHidden: 'true',
      hidden: true
    });
    root.replaceChildren(image, fallback, status);
    this.listen(image, 'load', () => {
      if (this._isCurrentImageSource()) this._showImage(true);
    });
    this.listen(image, 'error', () => {
      if (this._isCurrentImageSource()) this._showImage(false);
    });
    this._sync();
    return root;
  }

  /**
   * Replaces avatar identity and presentation values.
   * @param {Partial<AvatarOptions>} values New values.
   * @returns {this}
   */
  set(values = {}) {
    if (!values || typeof values !== 'object') return this;
    for (const key of ['src', 'name', 'initials', 'label', 'size', 'shape', 'status', 'statusLabel']) {
      if (Object.hasOwn(values, key)) this._state[key] = values[key];
    }
    this._sync();
    return this;
  }

  /** Sets the presence state and its text alternative. @param {AvatarOptions['status']} status @param {string|null} [label=null] @returns {this} */
  setStatus(status, label = null) {
    this._state.status = status;
    this._state.statusLabel = label;
    this._syncLabel();
    this._syncStatus();
    return this;
  }

  /** Returns whether the image is currently visible. @returns {boolean} */
  hasImage() {
    return !this.refs.image.hidden;
  }

  /** Restores an enhanced target or removes an owned root. @returns {void} */
  destroy() {
    const original = this._original;
    super.destroy();
    if (!this._createdRoot && original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...original.children);
    }
  }

  /** @returns {void} */
  _sync() {
    const { size, shape, label } = this._state;
    this.el.dataset.size = typeof size === 'string' ? size : 'custom';
    this.el.dataset.shape = ['circle', 'rounded', 'square'].includes(shape) ? shape : 'circle';
    if (typeof size === 'number' && Number.isFinite(size)) {
      this.el.style.setProperty('--zx-avatar-size', `${Math.max(1, size)}px`);
    } else {
      this.el.style.removeProperty('--zx-avatar-size');
    }
    this._syncLabel();
    this.refs.fallback.textContent = String(this._state.initials || avatarInitials(this._state.name));
    const src = this._state.src == null ? '' : String(this._state.src).trim();
    if (src) {
      this.refs.image.setAttribute('src', src);
      // Keep the fallback visible until this exact source has loaded successfully.
      this._showImage(/** @type {HTMLImageElement} */ (this.refs.image).complete
        && /** @type {HTMLImageElement} */ (this.refs.image).naturalWidth > 0);
    } else {
      this.refs.image.removeAttribute('src');
      this._showImage(false);
    }
    this._syncStatus();
  }

  /** Synchronizes the standalone accessible name, including valid presence text. @returns {void} */
  _syncLabel() {
    const { label, status, statusLabel } = this._state;
    if (label) {
      const presence = ['online', 'away', 'busy', 'offline'].includes(status) ? statusLabel : null;
      this.el.setAttribute('role', 'img');
      this.el.setAttribute('aria-label', [label, presence].filter(Boolean).join(', '));
      this.el.removeAttribute('aria-hidden');
    } else {
      this.el.removeAttribute('role');
      this.el.removeAttribute('aria-label');
      this.el.setAttribute('aria-hidden', 'true');
    }
  }

  /** @param {boolean} visible @returns {void} */
  _showImage(visible) {
    this.refs.image.hidden = !visible;
    this.refs.fallback.hidden = visible;
    this.el.dataset.fallback = String(!visible);
  }

  /** Ignores a late load/error from a source that has already been replaced. @returns {boolean} */
  _isCurrentImageSource() {
    const image = /** @type {HTMLImageElement} */ (this.refs.image);
    const requested = image.getAttribute('src');
    if (!requested) return false;
    try {
      return image.currentSrc === new URL(requested, document.baseURI).href;
    } catch {
      return image.currentSrc === requested;
    }
  }

  /** @returns {void} */
  _syncStatus() {
    const allowed = ['online', 'away', 'busy', 'offline'];
    const status = allowed.includes(this._state.status) ? this._state.status : null;
    this.refs.status.hidden = status === null;
    if (status) this.refs.status.dataset.status = status;
    else delete this.refs.status.dataset.status;
    const label = this._state.statusLabel;
    if (label) {
      this.refs.status.setAttribute('title', String(label));
    } else {
      this.refs.status.removeAttribute('title');
    }
  }
}

/**
 * Derives at most two uppercase initials from the first and last words of a name.
 * @param {unknown} name Name-like value.
 * @returns {string}
 */
export function avatarInitials(name) {
  const words = String(name ?? '').trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return '?';
  const first = uppercaseInitial(words[0]);
  const last = words.length > 1 ? uppercaseInitial(words[words.length - 1]) : '';
  return `${first}${last}`;
}

/** Returns one uppercased grapheme even when Unicode case expansion produces multiple letters. @param {string} word @returns {string} */
function uppercaseInitial(word) {
  return firstGrapheme(firstGrapheme(word).toUpperCase());
}

/** @param {string} value @returns {string} */
function firstGrapheme(value) {
  if (typeof Intl.Segmenter === 'function') {
    const iterator = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)[Symbol.iterator]();
    return iterator.next().value?.segment ?? '';
  }
  return Array.from(value)[0] ?? '';
}
