// @ts-check
import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { ACTIVITY, AGENT_MESSAGES, normalizeActivity } from '../../internal/agent-model.js';
import { normalizePhase, presencePhase, trackPresence } from '../../internal/presence-loop.js';

/**
 * A categorical tone from the design system's tone palette (`--zx-color-tone-*`).
 * @typedef {'blue'|'teal'|'green'|'amber'|'orange'|'red'|'pink'|'violet'|'slate'} AvatarTone
 */

/** @typedef {import('../../internal/agent-model.js').AgentActivity} AgentActivity */

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
 * @property {'online'|'away'|'busy'|'offline'|null} [status=null] Optional presence state of a
 * person. An agent's `activity` takes its place: when both are given, only the activity is drawn
 * and named.
 * @property {string|null} [statusLabel=null] Text alternative for the presence state.
 * @property {AgentActivity|null} [activity=null] What an agent is doing: `'idle'`, `'thinking'`,
 * `'working'`, `'needs-you'`, `'blocked'` or `'offline'`. Drawn as a dot whose shape and tone
 * differ per activity (a square for blocked, a hollow ring for idle, a dashed ring for offline);
 * its word joins the accessible name and the dot's tooltip. Wins over `status`.
 * @property {string|null} [activityLabel=null] The activity's word, when the default ("Working",
 * "Needs you", …) is not the one to show.
 * @property {boolean} [animate=false] Moves the avatar with its activity — idle breathes, thinking
 * sways, working bobs, needs-you leans and blinks — in the one animation loop every animated
 * avatar on the page shares. Motion is never the only signal, stops off screen and while the page
 * is hidden, and returns the avatar to rest under reduced motion (the system's, or a
 * `data-zx-motion="reduced"` region). While it is on, the root's `transform` belongs to the loop.
 * @property {number|null} [phase=null] Where in its activity's cycle the avatar moves, as a
 * fraction from 0 up to 1 (whole turns wrap): two avatars of the same agent on one screen — a
 * roster and an inspector — at different phases never move in step, and 0.5 puts them half a cycle
 * apart. `null` derives the phase from the name (or the initials), so the same agent always moves
 * the same way.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized
 * messages: the activity words, `agent.activity.<activity>`.
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

/** The presence states a person can have. */
const PRESENCE = Object.freeze(['online', 'away', 'busy', 'offline']);

/** The values `set()` accepts. */
const SETTABLE = Object.freeze(['src', 'name', 'initials', 'label', 'size', 'shape', 'tone', 'status', 'statusLabel',
  'activity', 'activityLabel', 'animate', 'phase']);

/**
 * Stable-size user image with a deterministic fallback — initials on a tone picked from the name —
 * and an optional presence state for a person, or activity for an agent.
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
    statusLabel: null,
    activity: null,
    activityLabel: null,
    animate: false,
    phase: null,
    msg: AGENT_MESSAGES
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
      statusLabel: this.options.statusLabel,
      activity: this.options.activity ?? null,
      activityLabel: this.options.activityLabel ?? null,
      animate: Boolean(this.options.animate),
      phase: this.options.phase ?? null
    };
    /** @type {import('../../internal/presence-loop.js').PresenceHandle|null} */
    this._presence = null;

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
    const activity = h('span', {
      ref: 'activity',
      class: 'zx-avatar__activity',
      ariaHidden: 'true',
      hidden: true
    });
    root.replaceChildren(image, fallback, status, activity);
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
   * Replaces avatar identity and presentation values: any option but `msg`, `phase` included, so
   * an animated avatar can be moved out of step with another of the same agent while it runs.
   * @param {Partial<AvatarOptions>} values New values.
   * @returns {this}
   */
  set(values = {}) {
    if (!values || typeof values !== 'object') return this;
    for (const key of SETTABLE) {
      if (Object.hasOwn(values, key)) this._state[key] = key === 'animate' ? Boolean(values[key]) : values[key];
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

  /**
   * Sets what an agent is doing and, optionally, the word for it. `null` clears the activity, and
   * a person's `status` shows again if one is set.
   * @param {AgentActivity|null} activity
   * @param {string|null} [label=null] The word, when the default is not the one to show.
   * @returns {this}
   */
  setActivity(activity, label = null) {
    this._state.activity = activity;
    this._state.activityLabel = label;
    this._syncLabel();
    this._syncStatus();
    return this;
  }

  /** @returns {AgentActivity|null} What the agent is doing, or null. */
  getActivity() {
    return normalizeActivity(this._state.activity);
  }

  /** Returns whether the image is currently visible. @returns {boolean} */
  hasImage() {
    return !(/** @type {HTMLElement} */ (this.refs.image)).hidden;
  }

  /** Restores an enhanced target or removes an owned root. @returns {void} */
  destroy() {
    const original = this._original;
    this._presence?.untrack();
    this._presence = null;
    super.destroy();
    if (!this._createdRoot && original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...original.children);
    }
  }

  /** @returns {void} */
  _sync() {
    const root = /** @type {HTMLElement} */ (this.el);
    const { size, shape } = this._state;
    root.dataset.size = typeof size === 'string' ? size : 'custom';
    root.dataset.shape = ['circle', 'rounded', 'square'].includes(shape) ? shape : 'circle';
    if (typeof size === 'number' && Number.isFinite(size)) {
      root.style.setProperty('--zx-avatar-size', `${Math.max(1, size)}px`);
    } else {
      root.style.removeProperty('--zx-avatar-size');
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
    root.dataset.tone = tone;
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
      const word = this._activityWord();
      const presence = word ?? (PRESENCE.includes(status) ? statusLabel : null);
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
    (/** @type {HTMLElement} */ (this.refs.image)).hidden = !visible;
    (/** @type {HTMLElement} */ (this.refs.fallback)).hidden = visible;
    (/** @type {HTMLElement} */ (this.el)).dataset.fallback = String(!visible);
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

  /** The word for the current activity, or null without one. @returns {string|null} */
  _activityWord() {
    const activity = normalizeActivity(this._state.activity);
    if (!activity) return null;
    return this._state.activityLabel ? String(this._state.activityLabel) : this.msg(ACTIVITY[activity].key);
  }

  /** @returns {void} */
  _syncStatus() {
    const root = /** @type {HTMLElement} */ (this.el);
    const activity = normalizeActivity(this._state.activity);
    const dot = /** @type {HTMLElement} */ (this.refs.activity);
    dot.hidden = activity === null;
    if (activity) {
      root.dataset.activity = activity;
      dot.setAttribute('title', String(this._activityWord()));
    } else {
      delete root.dataset.activity;
      dot.removeAttribute('title');
    }
    this._syncMotion(activity);
    const status = !activity && PRESENCE.includes(this._state.status) ? this._state.status : null;
    const presence = /** @type {HTMLElement} */ (this.refs.status);
    presence.hidden = status === null;
    if (status) presence.dataset.status = status;
    else delete presence.dataset.status;
    const label = this._state.statusLabel;
    if (label) {
      presence.setAttribute('title', String(label));
    } else {
      presence.removeAttribute('title');
    }
  }

  /**
   * Joins, follows, or leaves the shared presence loop.
   * @param {AgentActivity|null} activity
   * @returns {void}
   */
  _syncMotion(activity) {
    const root = /** @type {HTMLElement} */ (this.el);
    const animate = Boolean(this._state.animate) && activity !== null;
    if (animate) root.dataset.animate = '';
    else delete root.dataset.animate;
    if (!animate) {
      this._presence?.untrack();
      this._presence = null;
    } else if (this._presence) {
      this._presence.set(activity, { phase: this._phase() });
    } else {
      this._presence = trackPresence(root, activity, { phase: this._phase() });
    }
  }

  /**
   * The phase the avatar moves at: the `phase` option, or one derived from the name or initials.
   * @returns {number} A fraction of the cycle.
   */
  _phase() {
    const key = String(this._state.name ?? '') || String(this._state.initials ?? '');
    return normalizePhase(this._state.phase) ?? presencePhase(key);
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
