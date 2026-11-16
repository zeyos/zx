// @ts-check
/**
 * The pure half of AgentAvatar: which face a seed gets ({@link agentTraits}) and the shapes that
 * draw it in one activity at one size ({@link agentFace}). Nothing here touches the DOM, so the
 * same seed gives the same face on a server, in a test, and on every screen.
 *
 * Every trait table below is contract, order included: the hash picks an index, so reordering or
 * inserting an entry re-faces every agent that has ever been drawn.
 */
import { AVATAR_TONES, avatarTone } from '../avatar/avatar.js';

/** @typedef {import('../avatar/avatar.js').AvatarTone} AvatarTone */
/** @typedef {import('../../internal/agent-model.js').AgentActivity} AgentActivity */

/** @typedef {'token'|'glyph'} AgentVariant */
/** @typedef {'circle'|'squircle'|'hexagon'|'triangle'|'drop'|'pill'|'clover'|'dome'} AgentBody */
/** @typedef {'round'|'oval'|'square'|'pill'|'moon'|'chevron'} AgentEyes */
/** @typedef {'none'|'line'|'tick'|'cheek'} AgentMark */

/**
 * The traits a seed resolves to. `body` is null for a glyph and `mark` is null for a token.
 * @typedef {Object} AgentTraits
 * @property {AgentVariant} variant
 * @property {AvatarTone} tone
 * @property {AgentBody|null} body
 * @property {AgentEyes} eyes
 * @property {0|1|2} spacing How far apart the eyes sit: narrow, middle, wide.
 * @property {AgentMark|null} mark
 */

/**
 * Single traits to fix instead of deriving them. One that does not belong to the variant is ignored.
 * @typedef {Object} AgentTraitOverrides
 * @property {AgentVariant} [variant='token']
 * @property {AvatarTone|null} [tone]
 * @property {AgentBody|null} [body]
 * @property {AgentEyes|null} [eyes]
 */

/**
 * One shape to draw: an SVG element name, the part it plays (styled as `.zx-agent-avatar__<part>`),
 * its attributes, and, for a group, its children.
 * @typedef {Object} AgentShape
 * @property {string} tag
 * @property {string|null} part
 * @property {Record<string, string|number>} attrs
 * @property {AgentShape[]} [children]
 */

/** The variants, the first being the default. @type {ReadonlyArray<AgentVariant>} */
export const AGENT_VARIANTS = Object.freeze(['token', 'glyph']);

/** A token's silhouettes, in hash order. @type {ReadonlyArray<AgentBody>} */
export const AGENT_BODIES = Object.freeze(['circle', 'squircle', 'hexagon', 'triangle', 'drop', 'pill', 'clover', 'dome']);

/** A token's eye shapes, in hash order. @type {ReadonlyArray<AgentEyes>} */
export const AGENT_TOKEN_EYES = Object.freeze(['round', 'oval', 'square']);

/** A glyph's eye shapes, in hash order. @type {ReadonlyArray<AgentEyes>} */
export const AGENT_GLYPH_EYES = Object.freeze(['round', 'pill', 'square', 'moon', 'chevron', 'oval']);

/** A glyph's marks, in hash order. @type {ReadonlyArray<AgentMark>} */
export const AGENT_MARKS = Object.freeze(['none', 'line', 'tick', 'cheek']);

/** The rendered pixel size each preset stands for when picking the level of detail. */
export const AGENT_PRESET_PX = Object.freeze({ sm: 24, md: 32, lg: 40 });

/** The eye spacings, as half the distance between eye centres in view-box units. */
const SPREAD = Object.freeze([0.85, 1, 1.15]);
const GLYPH_SPREAD = Object.freeze([8, 9.5, 11]);

/**
 * Where a token's eyes sit on each silhouette (centre height, half-spacing at the middle spacing)
 * and the shapes that draw it. Polygons round their corners with a stroke the colour of the fill.
 * @type {Readonly<Record<AgentBody, {y: number, gap: number, shapes: AgentShape[]}>>}
 */
const BODIES = Object.freeze({
  circle: { y: 30, gap: 11, shapes: [shape('circle', 'body', { cx: 32, cy: 32, r: 28 })] },
  squircle: { y: 29, gap: 11, shapes: [shape('rect', 'body', { x: 5, y: 5, width: 54, height: 54, rx: 20 })] },
  hexagon: { y: 30, gap: 10, shapes: [shape('polygon', 'body', { points: '32,6 55,19 55,45 32,58 9,45 9,19', 'stroke-width': 8, 'stroke-linejoin': 'round' })] },
  triangle: { y: 40, gap: 8, shapes: [shape('polygon', 'body', { points: '32,9 57,53 7,53', 'stroke-width': 9, 'stroke-linejoin': 'round' })] },
  drop: { y: 32, gap: 11, shapes: [shape('path', 'body', { d: 'M32 5H59V32A27 27 0 1 1 32 5Z' })] },
  pill: { y: 30, gap: 11, shapes: [shape('rect', 'body', { x: 4, y: 15, width: 56, height: 34, rx: 17, transform: 'rotate(-20 32 32)' })] },
  clover: { y: 30, gap: 11, shapes: [
    shape('circle', 'body', { cx: 21, cy: 21, r: 15 }), shape('circle', 'body', { cx: 43, cy: 21, r: 15 }),
    shape('circle', 'body', { cx: 21, cy: 43, r: 15 }), shape('circle', 'body', { cx: 43, cy: 43, r: 15 }),
    shape('rect', 'body', { x: 16, y: 16, width: 32, height: 32 })
  ] },
  dome: { y: 36, gap: 11, shapes: [shape('path', 'body', { d: 'M5 52V40A27 27 0 0 1 59 40V52Q59 56 55 56H9Q5 56 5 52Z' })] }
});

/**
 * Resolves the face a seed gets. The tone is `avatarTone(seed)`, so an agent's initials tile and
 * its face agree when they share a key; every other trait comes from FNV-1a over the same
 * normalised key plus a per-trait salt, independent of the tone and of each other.
 * @param {unknown} seed The agent's stable identity — an id, or its name.
 * @param {AgentTraitOverrides} [overrides={}] Traits to fix instead of deriving them.
 * @returns {AgentTraits}
 */
export function agentTraits(seed, overrides = {}) {
  const key = normaliseKey(seed);
  const variant = AGENT_VARIANTS.includes(/** @type {AgentVariant} */ (overrides.variant))
    ? /** @type {AgentVariant} */ (overrides.variant) : 'token';
  const tone = AVATAR_TONES.includes(/** @type {AvatarTone} */ (overrides.tone))
    ? /** @type {AvatarTone} */ (overrides.tone) : avatarTone(key);
  const eyeTable = variant === 'token' ? AGENT_TOKEN_EYES : AGENT_GLYPH_EYES;
  const eyes = eyeTable.includes(/** @type {AgentEyes} */ (overrides.eyes))
    ? /** @type {AgentEyes} */ (overrides.eyes) : pick(key, 'eyes', eyeTable);
  const spacing = /** @type {0|1|2} */ (pick(key, 'spacing', [0, 1, 2]));
  if (variant === 'glyph') {
    return { variant, tone, body: null, eyes, spacing, mark: pick(key, 'mark', AGENT_MARKS) };
  }
  const body = AGENT_BODIES.includes(/** @type {AgentBody} */ (overrides.body))
    ? /** @type {AgentBody} */ (overrides.body) : pick(key, 'body', AGENT_BODIES);
  return { variant, tone, body, eyes, spacing, mark: null };
}

/**
 * The shapes that draw a face in one activity at one rendered size, in a 64-unit view box, as
 * plain data. The level of detail follows `px`: a token drops its pupils below 20px and both
 * variants enlarge their eyes at 24px and below, where a glyph also drops its mark.
 * @param {AgentTraits} traits From {@link agentTraits}.
 * @param {AgentActivity|string|null} [activity=null] What the agent is doing; unknown is idle.
 * @param {number} [px=32] The rendered size in CSS pixels.
 * @returns {AgentShape[]}
 */
export function agentFace(traits, activity = null, px = 32) {
  const state = activity ?? 'idle';
  const small = px <= 24;
  if (traits.variant === 'glyph') {
    const shapeName = traits.eyes;
    const tall = shapeName === 'pill' || shapeName === 'oval';
    const spread = GLYPH_SPREAD[traits.spacing] ?? GLYPH_SPREAD[1];
    const out = [eyePair({
      xs: [32 - spread, 32 + spread], y: 28, w: small ? 12 : 9,
      h: tall ? (small ? 16 : 13) : (small ? 12 : 9), shape: shapeName, pupils: false, heavy: small
    }, state)];
    if (!small) {
      const mark = traits.mark ?? 'none';
      if (mark === 'line') out.push(shape('rect', 'mark', { x: 23, y: 43, width: 18, height: 2.4, rx: 1.2 }));
      if (mark === 'tick') out.push(shape('path', 'mark-line', { d: 'M46 44l4-4' }));
      if (mark === 'cheek') out.push(shape('circle', 'mark-solid', { cx: 32 + spread + 6, cy: 39, r: 3.4 }));
    }
    return out;
  }
  const body = BODIES[traits.body ?? 'circle'] ?? BODIES.circle;
  const width = small ? 15 : 13;
  const gap = body.gap * (small ? 0.95 : (SPREAD[traits.spacing] ?? 1));
  return [
    shape('g', 'shape', {}, body.shapes.map(copyShape)),
    eyePair({
      xs: [32 - gap, 32 + gap], y: body.y, w: width, h: traits.eyes === 'oval' ? width * 1.25 : width,
      shape: traits.eyes, pupils: px >= 20, heavy: small
    }, state)
  ];
}

/**
 * Two eyes with the activity's static expression. The `look` group is what drifts and scans, an
 * `eye` group is what blinks, and a `gaze` group moves a pupil.
 * @param {{xs: number[], y: number, w: number, h: number, shape: AgentEyes, pupils: boolean, heavy: boolean}} eye
 * @param {string} activity
 * @returns {AgentShape}
 */
function eyePair(eye, activity) {
  const { xs, y } = eye;
  let { w, h } = eye;
  /** @type {AgentShape[]} */
  const eyes = [];
  if (activity === 'blocked') {
    const bar = eye.heavy ? 4 : 3.2;
    for (const x of xs) eyes.push(shape('rect', 'sclera', { x: r(x - w * 0.6), y: r(y - bar / 2), width: r(w * 1.2), height: bar, rx: 1.4 }));
    return shape('g', 'eyes', {}, [shape('g', 'look', {}, eyes)]);
  }
  if (activity === 'offline') {
    for (const x of xs) {
      eyes.push(shape('path', 'line', {
        d: `M${r(x - w * 0.55)} ${r(y)}Q${r(x)} ${r(y + h * 0.45)} ${r(x + w * 0.55)} ${r(y)}`,
        'stroke-width': eye.heavy ? 3 : 2.2
      }));
    }
    return shape('g', 'eyes', {}, [shape('g', 'look', {}, eyes)]);
  }
  let dx = 0; let dy = 0; let px = 0; let py = 0;
  if (activity === 'thinking') {
    if (eye.pupils) { px = w * 0.2; py = -h * 0.22; } else { dx = 2.5; dy = -3; }
  }
  if (activity === 'working') {
    if (eye.pupils) py = h * 0.2; else dy = 2;
    h *= 0.62;
  }
  if (activity === 'needs-you') { w *= 1.2; h *= 1.2; }
  xs.forEach((x, index) => {
    const scale = activity === 'thinking' && !eye.pupils && index === 1 ? 0.85 : 1;
    const ew = w * scale;
    const eh = h * scale;
    const cx = x + dx;
    const cy = y + dy;
    /** @type {AgentShape[]} */
    const parts = [eyeShape(eye.shape, cx, cy, ew, eh, eye.heavy)];
    if (eye.pupils) {
      const radius = Math.min(ew, eh) * (activity === 'needs-you' ? 0.36 : 0.3);
      parts.push(shape('g', 'gaze', {}, [shape('circle', 'pupil', { cx: r(cx + px), cy: r(cy + py), r: r(radius) })]));
    }
    eyes.push(shape('g', 'eye', {}, parts));
  });
  return shape('g', 'eyes', {}, [shape('g', 'look', {}, eyes)]);
}

/**
 * One open eye.
 * @param {AgentEyes} name @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {boolean} heavy
 * @returns {AgentShape}
 */
function eyeShape(name, x, y, w, h, heavy) {
  switch (name) {
    case 'pill':
      return shape('rect', 'sclera', { x: r(x - w * 0.4), y: r(y - h / 2), width: r(w * 0.8), height: r(h), rx: r(w * 0.4) });
    case 'square':
      return shape('rect', 'sclera', { x: r(x - w / 2), y: r(y - h / 2), width: r(w), height: r(h), rx: r(Math.min(w, h) * 0.22) });
    case 'moon':
      // Flat side down: a dome, which reads calm; flat side up reads as a frown.
      return shape('path', 'sclera', { d: `M${r(x - w / 2)} ${r(y + h * 0.3)}H${r(x + w / 2)}A${r(w / 2)} ${r(h * 0.75)} 0 0 0 ${r(x - w / 2)} ${r(y + h * 0.3)}Z` });
    case 'chevron':
      return shape('path', 'line', { d: `M${r(x - w / 2)} ${r(y + h * 0.2)}L${r(x)} ${r(y - h * 0.3)}L${r(x + w / 2)} ${r(y + h * 0.2)}`, 'stroke-width': heavy ? 3.2 : 2.6 });
    case 'oval':
      return shape('ellipse', 'sclera', { cx: r(x), cy: r(y), rx: r(w * 0.42), ry: r(h / 2) });
    default:
      return shape('ellipse', 'sclera', { cx: r(x), cy: r(y), rx: r(w / 2), ry: r(h / 2) });
  }
}

/**
 * @param {string} tag @param {string|null} part @param {Record<string, string|number>} attrs
 * @param {AgentShape[]} [children]
 * @returns {AgentShape}
 */
function shape(tag, part, attrs, children) {
  return children ? { tag, part, attrs, children } : { tag, part, attrs };
}

/** A copy, so a caller changing the drawing never changes the table. @param {AgentShape} source @returns {AgentShape} */
function copyShape(source) {
  return shape(source.tag, source.part, { ...source.attrs }, source.children?.map(copyShape));
}

/** Rounds to two decimals so the drawing is stable text. @param {number} value @returns {number} */
function r(value) {
  return Math.round(value * 100) / 100;
}

/** The key every trait hashes: trimmed, NFC-normalised, lower-cased — as `avatarTone()` does. @param {unknown} seed @returns {string} */
function normaliseKey(seed) {
  return String(seed ?? '').trim().normalize('NFC').toLowerCase();
}

/**
 * Picks from a table by FNV-1a over the key and a salt, finished with the MurmurHash3 mixer. FNV-1a
 * alone will not do: its low bits depend only on the input's low bits, so a salted hash taken modulo
 * a small table is a fixed function of the unsalted one — the tone — and every violet agent would get
 * the same body. The mixer spreads every bit of the hash into the low ones.
 * @template T
 * @param {string} key @param {string} salt @param {ReadonlyArray<T>} table
 * @returns {T}
 */
function pick(key, salt, table) {
  const text = `${key}\u0000${salt}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return table[(hash >>> 0) % table.length];
}
