import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';

/**
 * A categorical tone from the design system's tone palette (`--zx-color-tone-*`).
 * @typedef {'blue'|'teal'|'green'|'amber'|'orange'|'red'|'pink'|'violet'|'slate'} AvatarTone
 */

/**
 * @typedef {Object} AvatarOptions
 * @property {string|null} [src=null] Image URL.
 * @property {string} [name=''] Name used to derive the fallback initials and tone.
 * @property {string|null} [initials=null] Explicit fallback initials.
 * @property {string|null} [label=null] Accessible label; null makes the avatar decorative.
 * @property {string|number} [size='md'] Preset — `sm` 24px, `md` 32px, `lg` 40px at the default
 * spacing unit — or a pixel size. Below 24px the fallback shows a single initial.
 * @property {'circle'|'rounded'|'square'} [shape='circle'] Avatar shape.
 * @property {AvatarTone|null} [tone=null] Fallback colour from the tone palette. `null` derives a
 * stable tone from the name (or the initials when there is no name), so the same person gets the
 * same colour on every screen; see {@link avatarTone}.
 * @property {'online'|'away'|'busy'|'offline'|null} [status=null] Optional presence state.
 * @property {string|null} [statusLabel=null] Text alternative for the presence state.
 */

/**
 * The tone palette, in hash order. Every entry is a valid `tone`; the hash picks among the
 * chromatic ones and keeps `slate`, the neutral, for a fallback with no name behind it. Order is
 * part of the contract: changing it moves every derived avatar to a different colour.
 * @type {ReadonlyArray<AvatarTone>}
 */
export const AVATAR_TONES = Object.freeze(['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate']);

/** The tones a name can hash to: the palette without its neutral. */
const HASHED_TONES = Object.freeze(AVATAR_TONES.filter((tone) => tone !== 'slate'));

/** Below this rendered size the fallback has room for one initial, not two. */
const SINGLE_INITIAL_BELOW = 24;

/**
 * Stable-size user image with a deterministic fallback — initials on a tone picked from the name —
 * and an optional presence state.
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
    tone: null,
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
      tone: this.options.tone,
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
    for (const key of ['src', 'name', 'initials', 'label', 'size', 'shape', 'tone', 'status', 'statusLabel']) {
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
    const name = String(this._state.name ?? '');
    const limit = typeof size === 'number' && size < SINGLE_INITIAL_BELOW ? 1 : 2;
    this.refs.fallback.textContent = this._state.initials
      ? clipGraphemes(String(this._state.initials), limit)
      : avatarInitials(name, limit);
    const tone = AVATAR_TONES.includes(this._state.tone)
      ? this._state.tone
      : avatarTone(name.trim() ? name : this._state.initials);
    this.el.dataset.tone = tone;
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
 * Derives uppercase initials from the first and last words of a name.
 * @param {unknown} name Name-like value.
 * @param {1|2} [limit=2] How many initials to return: two by default, one for an avatar too small
 * to hold two legibly.
 * @returns {string}
 */
export function avatarInitials(name, limit = 2) {
  const words = String(name ?? '').trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return '?';
  const first = uppercaseInitial(words[0]);
  const last = limit > 1 && words.length > 1 ? uppercaseInitial(words[words.length - 1]) : '';
  return `${first}${last}`;
}

/**
 * Picks a stable fallback tone for a name.
 *
 * The name is trimmed, NFC-normalised and lower-cased, then hashed with 32-bit FNV-1a over its
 * UTF-16 code units, and the hash picks one of the eight chromatic tones of {@link AVATAR_TONES}.
 * The result depends on nothing but the name — not the locale, the page, or the order avatars
 * render in — so a person keeps their colour everywhere. An empty name is `slate`, the neutral
 * tone, which no name hashes to.
 * @param {unknown} name Name-like value.
 * @returns {AvatarTone}
 */
export function avatarTone(name) {
  const key = String(name ?? '').trim().normalize('NFC').toLowerCase();
  if (!key) return 'slate';
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return HASHED_TONES[(hash >>> 0) % HASHED_TONES.length];
}

/** Keeps the first `limit` graphemes of explicit initials. @param {string} value @param {number} limit @returns {string} */
function clipGraphemes(value, limit) {
  if (limit > 1) return value;
  return firstGrapheme(value.trim()) || value;
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
