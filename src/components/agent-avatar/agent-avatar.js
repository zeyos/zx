// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { ACTIVITY, AGENT_MESSAGES, normalizeActivity } from '../../internal/agent-model.js';
import { normalizePhase, presencePhase, trackPresence } from '../../internal/presence-loop.js';
import { AGENT_PRESET_PX, agentFace, agentTraits } from './agent-face.js';

export { AGENT_BODIES, AGENT_EYES, AGENT_PIXEL_BODIES, agentFace, agentTraits } from './agent-face.js';

/** @typedef {import('./agent-face.js').AgentBody} AgentBody */
/** @typedef {import('./agent-face.js').AgentEyes} AgentEyes */
/** @typedef {import('./agent-face.js').AgentTraits} AgentTraits */
/** @typedef {import('./agent-face.js').AgentShape} AgentShape */
/** @typedef {import('../avatar/avatar.js').AvatarTone} AvatarTone */
/** @typedef {import('../../internal/agent-model.js').AgentActivity} AgentActivity */

/**
 * @typedef {Object} AgentAvatarOptions
 * @property {string|null} [seed=null] The agent's stable identity — an id. Every trait is derived
 * from it, so renaming an agent does not change its face. `null` uses `name`.
 * @property {string} [name=''] The agent's name; the seed when `seed` is null.
 * @property {AvatarTone|null} [tone=null] Colour from the tone palette; `null` derives it from the
 * seed with `avatarTone()`, so the face matches an initials tile keyed the same way.
 * @property {AgentBody|null} [body=null] The silhouette, instead of the derived one: one of eight
 * smooth shapes or four pixel creatures.
 * @property {AgentEyes|null} [eyes=null] The eye shape, instead of the derived one.
 * @property {string|number} [size='md'] Preset — `sm` 24px, `md` 32px, `lg` 40px at the default
 * spacing unit — or a pixel size. Small sizes draw less: no pupils below 20px, larger eyes at 24px
 * and below.
 * @property {string|null} [label=null] Accessible label; null makes the avatar decorative.
 * @property {AgentActivity|null} [activity=null] What the agent is doing. The eyes take the
 * activity's expression, the activity dot shows it, and its word joins the accessible name.
 * @property {string|null} [activityLabel=null] The activity's word, when the default is not the one
 * to show.
 * @property {boolean} [indicator=true] Whether to draw the activity dot. Without it, show the
 * activity's word nearby: the expression alone is a weaker signal.
 * @property {boolean} [animate=false] Moves the avatar with its activity in the shared presence loop
 * (as Avatar does) and lets its eyes blink, drift and scan. Motion is never the only signal and
 * stops under reduced motion. While it is on, the root's `transform` belongs to the loop.
 * @property {number|null} [phase=null] Where in its activity's cycle the avatar moves, as a fraction
 * from 0 up to 1. `null` derives one from the seed.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized
 * messages: the activity words, `agent.activity.<activity>`.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The values `set()` accepts. */
const SETTABLE = Object.freeze(['seed', 'name', 'tone', 'body', 'eyes', 'size', 'label',
  'activity', 'activityLabel', 'indicator', 'animate', 'phase']);

/** How long one blink cycle takes, in seconds; the phase offsets the eyes within it. */
const BLINK_PERIOD = 5.2;

/**
 * A generated face for an agent without a picture: a coloured silhouette — a geometric shape or a
 * pixel creature — with eyes that take the agent's activity, deterministic from the agent's seed.
 * @extends {Component<AgentAvatarOptions>}
 */
export class AgentAvatar extends Component {
  static cssName = 'agent-avatar';

  /** @type {Readonly<AgentAvatarOptions>} */
  static defaults = {
    seed: null,
    name: '',
    tone: null,
    body: null,
    eyes: null,
    size: 'md',
    label: null,
    activity: null,
    activityLabel: null,
    indicator: true,
    animate: false,
    phase: null,
    msg: AGENT_MESSAGES
  };

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('span'));
    this.el = root;
    this._original = this._createdRoot ? null : snapshotTarget(root);
    /** @type {Record<string, any>} */
    this._state = {};
    for (const key of SETTABLE) this._state[key] = this.options[key] ?? AgentAvatar.defaults[key];
    /** @type {AgentTraits|null} */
    this._traits = null;
    /** @type {import('../../internal/presence-loop.js').PresenceHandle|null} */
    this._presence = null;

    const face = document.createElementNS(SVG_NS, 'svg');
    face.setAttribute('class', 'zx-agent-avatar__face');
    face.setAttribute('viewBox', '0 0 64 64');
    face.setAttribute('aria-hidden', 'true');
    face.setAttribute('focusable', 'false');
    this.refs.face = face;
    const dot = h('span', { ref: 'activity', class: 'zx-agent-avatar__activity', ariaHidden: 'true', hidden: true });
    root.replaceChildren(face, dot);
    this._sync();
    return root;
  }

  /**
   * Replaces identity and presentation values: any option but `msg`.
   * @param {Partial<AgentAvatarOptions>} values New values.
   * @returns {this}
   */
  set(values = {}) {
    if (!values || typeof values !== 'object') return this;
    for (const key of SETTABLE) {
      if (Object.hasOwn(values, key)) this._state[key] = values[key];
    }
    this._sync();
    return this;
  }

  /**
   * Sets what the agent is doing and, optionally, the word for it. `null` clears the activity.
   * @param {AgentActivity|null} activity
   * @param {string|null} [label=null] The word, when the default is not the one to show.
   * @returns {this}
   */
  setActivity(activity, label = null) {
    this._state.activity = activity;
    this._state.activityLabel = label;
    this._sync();
    return this;
  }

  /** @returns {AgentActivity|null} What the agent is doing, or null. */
  getActivity() {
    return normalizeActivity(this._state.activity);
  }

  /**
   * The traits the face is drawn from, so an application can store them — to keep a look across a
   * rename, or to settle a collision between two agents once.
   * @returns {AgentTraits}
   */
  getTraits() {
    return { ...(this._traits ?? this._resolveTraits()) };
  }

  /** Restores an enhanced target or removes an owned root. @returns {void} */
  destroy() {
    this._presence?.untrack();
    this._presence = null;
    super.destroy();
    if (!this._createdRoot) restoreTarget(this.el, this._original);
  }

  /** @returns {AgentTraits} */
  _resolveTraits() {
    const { seed, name, tone, body, eyes } = this._state;
    const key = seed == null || String(seed).trim() === '' ? name : seed;
    return agentTraits(key, { tone, body, eyes });
  }

  /** @returns {number} The rendered size the level of detail is picked for. */
  _px() {
    const size = this._state.size;
    if (typeof size === 'number' && Number.isFinite(size)) return Math.max(1, size);
    return AGENT_PRESET_PX[/** @type {'sm'|'md'|'lg'} */ (size)] ?? AGENT_PRESET_PX.md;
  }

  /** @returns {void} */
  _sync() {
    const root = /** @type {HTMLElement} */ (this.el);
    const { size } = this._state;
    const traits = this._resolveTraits();
    this._traits = traits;
    const activity = normalizeActivity(this._state.activity);
    root.dataset.tone = traits.tone;
    root.dataset.size = typeof size === 'number' ? 'custom' : (['sm', 'md', 'lg'].includes(size) ? size : 'md');
    if (typeof size === 'number' && Number.isFinite(size)) {
      root.style.setProperty('--zx-agent-avatar-size', `${Math.max(1, size)}px`);
    } else {
      root.style.removeProperty('--zx-agent-avatar-size');
    }
    if (activity) root.dataset.activity = activity;
    else delete root.dataset.activity;

    const face = /** @type {SVGSVGElement} */ (this.refs.face);
    face.replaceChildren(...agentFace(traits, activity, this._px()).map(drawShape));

    const dot = /** @type {HTMLElement} */ (this.refs.activity);
    const word = this._activityWord();
    dot.hidden = !activity || !this._state.indicator;
    if (word) dot.setAttribute('title', word);
    else dot.removeAttribute('title');

    const label = this._state.label;
    if (label) {
      root.setAttribute('role', 'img');
      root.setAttribute('aria-label', [String(label), word].filter(Boolean).join(', '));
      root.removeAttribute('aria-hidden');
    } else {
      root.removeAttribute('role');
      root.removeAttribute('aria-label');
      root.setAttribute('aria-hidden', 'true');
    }
    this._syncMotion(activity);
  }

  /** The word for the current activity, or null without one. @returns {string|null} */
  _activityWord() {
    const activity = normalizeActivity(this._state.activity);
    if (!activity) return null;
    return this._state.activityLabel ? String(this._state.activityLabel) : this.msg(ACTIVITY[activity].key);
  }

  /**
   * Joins, follows, or leaves the shared presence loop, and offsets the eyes' own animations.
   * @param {AgentActivity|null} activity
   * @returns {void}
   */
  _syncMotion(activity) {
    const root = /** @type {HTMLElement} */ (this.el);
    const animate = Boolean(this._state.animate) && activity !== null;
    const phase = normalizePhase(this._state.phase) ?? presencePhase(this._seedKey());
    if (animate) {
      root.dataset.animate = '';
      root.style.setProperty('--zx-agent-avatar-delay', `${-(phase * BLINK_PERIOD).toFixed(2)}s`);
    } else {
      delete root.dataset.animate;
      root.style.removeProperty('--zx-agent-avatar-delay');
    }
    if (!animate) {
      this._presence?.untrack();
      this._presence = null;
    } else if (this._presence) {
      this._presence.set(activity, { phase });
    } else {
      this._presence = trackPresence(root, activity, { phase });
    }
  }

  /** @returns {string} */
  _seedKey() {
    const { seed, name } = this._state;
    return seed == null || String(seed).trim() === '' ? String(name ?? '') : String(seed);
  }
}

/**
 * Builds one shape of {@link agentFace} as an SVG element.
 * @param {AgentShape} shape
 * @returns {SVGElement}
 */
function drawShape(shape) {
  const element = /** @type {SVGElement} */ (document.createElementNS(SVG_NS, shape.tag));
  if (shape.part) element.setAttribute('class', `zx-agent-avatar__${shape.part}`);
  for (const [name, value] of Object.entries(shape.attrs)) element.setAttribute(name, String(value));
  if (shape.children) element.append(...shape.children.map(drawShape));
  return element;
}
