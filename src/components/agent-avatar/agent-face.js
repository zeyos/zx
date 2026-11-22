// @ts-check
/**
 * The pure half of AgentAvatar: which face a seed gets ({@link agentTraits}) and the shapes that
 * draw it in one activity at one size ({@link agentFace}). Nothing here touches the DOM, so the
 * same seed gives the same face on a server, in a test, and on every screen.
 *
 * Every trait table below is contract, order and length included: the hash picks an index modulo
 * the table's length, so reordering, inserting or even appending an entry re-faces agents that
 * have already been drawn. The one exception is a table growing by exactly its own length, with
 * entry `i + n` a sibling of entry `i`: `hash mod 2n mod n` is `hash mod n`, so every agent keeps
 * what it had or takes its sibling. `AGENT_EYES` grew that way, from three shapes to six, each new
 * one the solid sibling of an old one.
 */
import { AVATAR_TONES, avatarTone } from '../avatar/avatar.js';

/** @typedef {import('../avatar/avatar.js').AvatarTone} AvatarTone */
/** @typedef {import('../../internal/agent-model.js').AgentActivity} AgentActivity */

/**
 * @typedef {'circle'|'squircle'|'hexagon'|'triangle'|'drop'|'pill'|'clover'|'dome'
 *   |'wedge'|'pentagon'|'trapezoid'|'cross'|'diamond'|'octagon'} AgentBody
 */
/** @typedef {'round'|'oval'|'square'|'dot'|'capsule'|'pixel'} AgentEyes */
/** @typedef {'smile'|'grin'|'cat'|'none'} AgentMouth */
/**
 * What a face shows. Each activity has one ({@link ACTIVITY_EXPRESSION}); `happy` and `listening`
 * are moments an application shows on purpose — a run that finished, a person typing to the agent.
 * @typedef {'calm'|'happy'|'listening'|'thinking'|'focused'|'alert'|'worried'|'asleep'} AgentExpression
 */

/**
 * The traits a seed resolves to.
 * @typedef {Object} AgentTraits
 * @property {AvatarTone} tone
 * @property {AgentBody} body
 * @property {AgentEyes} eyes
 * @property {0|1|2} spacing How far apart the eyes sit: narrow, middle, wide.
 * @property {AgentMouth} mouth The mouth's style; `none` draws a face with eyes only.
 * @property {boolean} cheeks Whether the face blushes when it is content.
 */

/**
 * Single traits to fix instead of deriving them. An unknown value is ignored.
 * @typedef {Object} AgentTraitOverrides
 * @property {AvatarTone|null} [tone]
 * @property {AgentBody|null} [body]
 * @property {AgentEyes|null} [eyes]
 * @property {0|1|2|null} [spacing] How far apart the eyes sit, as `AgentAvatar.getTraits()` reports it.
 * @property {AgentMouth|null} [mouth] The mouth's style, `none` included.
 * @property {boolean|null} [cheeks] Whether the face blushes.
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

/**
 * The silhouettes, in hash order.
 * @type {ReadonlyArray<AgentBody>}
 */
export const AGENT_BODIES = Object.freeze(['circle', 'squircle', 'hexagon', 'triangle', 'drop', 'pill', 'clover', 'dome',
  'wedge', 'pentagon', 'trapezoid', 'cross', 'diamond', 'octagon']);

/**
 * The eye shapes, in hash order: three white eyes with pupils, then their solid siblings in the
 * same order — `dot` for `round`, `capsule` for `oval`, `pixel` for `square` — so the table grew
 * without moving any agent out of its eye family (see the note at the top).
 * @type {ReadonlyArray<AgentEyes>}
 */
export const AGENT_EYES = Object.freeze(['round', 'oval', 'square', 'dot', 'capsule', 'pixel']);

/** The mouth styles a seed picks from, in hash order. `none` is only ever chosen. @type {ReadonlyArray<AgentMouth>} */
export const AGENT_MOUTHS = Object.freeze(['smile', 'grin', 'cat']);

/** Every expression, in the order they are documented. @type {ReadonlyArray<AgentExpression>} */
export const AGENT_EXPRESSIONS = Object.freeze(['calm', 'happy', 'listening', 'thinking', 'focused', 'alert', 'worried', 'asleep']);

/**
 * The expression each activity draws.
 * @type {Readonly<Record<AgentActivity, AgentExpression>>}
 */
export const ACTIVITY_EXPRESSION = Object.freeze({
  idle: 'calm', thinking: 'thinking', working: 'focused', 'needs-you': 'alert', blocked: 'worried', offline: 'asleep'
});

/** The rendered pixel size each preset stands for when picking the level of detail. */
export const AGENT_PRESET_PX = Object.freeze({ sm: 24, md: 32, lg: 40 });

/** The eye spacings, as factors of a body's middle spacing. */
const SPREAD = Object.freeze([0.85, 1, 1.15]);

/** Each eye shape's width and height in view-box units, at 32px. */
const EYE_SIZE = Object.freeze({
  round: [13, 13], oval: [13, 16.25], square: [13, 13], dot: [11.5, 11.5], capsule: [10, 17], pixel: [11, 11]
});

/** The eye shapes drawn solid, without a pupil. */
const SOLID_EYES = Object.freeze(['dot', 'capsule', 'pixel']);

/** How much larger the eyes are drawn at 24px and below, where every unit counts. */
const SMALL_EYES = 15 / 13;

/** The smallest rendered size a mouth is drawn at, and the smallest a blush is. */
const MOUTH_MIN_PX = 20;
const CHEEK_MIN_PX = 28;

/** The expressions a face with `cheeks` blushes in. */
const BLUSHING = Object.freeze(['calm', 'happy', 'listening']);

/**
 * The silhouettes with no room for a blush below and outside the eyes — they narrow below them, or
 * hold the eyes low over the mouth: there it sits beside the mouth instead, clear of its corners.
 */
const SNUG_CHEEKS = Object.freeze(['pill', 'wedge', 'diamond', 'triangle', 'cross']);

/** How far a listening face tilts, in degrees. */
const TILT = 9;

/**
 * The features of a face with a mouth follow a slanted silhouette part of the way, in degrees; a
 * listening face tilts further the same way.
 * @type {Readonly<Partial<Record<AgentBody, number>>>}
 */
const SLANT = Object.freeze({ pill: -12 });

/** Each mouth style's half-width at the calm size, for a blush to keep clear of. */
const MOUTH_HALF = Object.freeze({ smile: 5, grin: 5.5, cat: 6 });

/** The size of a mouth in each expression that draws the face's own style, against the calm one. */
const MOUTH_SCALE = Object.freeze({ calm: 1, listening: 0.9, focused: 0.75, happy: 1.25, asleep: 0.7 });

/**
 * Where the features sit on each silhouette and the shapes that draw it: `y` is the eye line of a
 * face without a mouth, `face` the eye line and the mouth line of one with, and `gap` the eyes'
 * half-spacing at the middle spacing. Polygons round their corners with a stroke the colour of the
 * fill.
 * @type {Readonly<Record<AgentBody, {y: number, face: [number, number], gap: number, shapes: AgentShape[]}>>}
 */
const BODIES = Object.freeze({
  circle: { y: 30, face: [27, 41], gap: 11, shapes: [shape('circle', 'body', { cx: 32, cy: 32, r: 28 })] },
  squircle: { y: 29, face: [26, 40], gap: 11, shapes: [shape('rect', 'body', { x: 5, y: 5, width: 54, height: 54, rx: 20 })] },
  hexagon: { y: 30, face: [27, 41], gap: 10, shapes: [shape('polygon', 'body', { points: '32,6 55,19 55,45 32,58 9,45 9,19', 'stroke-width': 8, 'stroke-linejoin': 'round' })] },
  triangle: { y: 40, face: [35.5, 49.5], gap: 8, shapes: [shape('polygon', 'body', { points: '32,9 57,53 7,53', 'stroke-width': 9, 'stroke-linejoin': 'round' })] },
  drop: { y: 32, face: [29, 43], gap: 11, shapes: [shape('path', 'body', { d: 'M32 5H59V32A27 27 0 1 1 32 5Z' })] },
  pill: { y: 30, face: [27.5, 41.5], gap: 11, shapes: [shape('rect', 'body', { x: 4, y: 15, width: 56, height: 34, rx: 17, transform: 'rotate(-20 32 32)' })] },
  clover: { y: 30, face: [27, 41], gap: 11, shapes: [
    shape('circle', 'body', { cx: 21, cy: 21, r: 15 }), shape('circle', 'body', { cx: 43, cy: 21, r: 15 }),
    shape('circle', 'body', { cx: 21, cy: 43, r: 15 }), shape('circle', 'body', { cx: 43, cy: 43, r: 15 }),
    shape('rect', 'body', { x: 16, y: 16, width: 32, height: 32 })
  ] },
  dome: { y: 36, face: [32.5, 46.5], gap: 11, shapes: [shape('path', 'body', { d: 'M5 52V40A27 27 0 0 1 59 40V52Q59 56 55 56H9Q5 56 5 52Z' })] },
  wedge: { y: 23, face: [20, 34], gap: 9.5, shapes: [shape('polygon', 'body', { points: '7,11 57,11 32,55', 'stroke-width': 9, 'stroke-linejoin': 'round' })] },
  pentagon: { y: 31, face: [28, 42], gap: 10, shapes: [shape('polygon', 'body', { points: '32,7 57,25 48,55 16,55 7,25', 'stroke-width': 8, 'stroke-linejoin': 'round' })] },
  trapezoid: { y: 31, face: [28, 42], gap: 10, shapes: [shape('polygon', 'body', { points: '17,11 47,11 58,53 6,53', 'stroke-width': 8, 'stroke-linejoin': 'round' })] },
  cross: { y: 31, face: [28, 42], gap: 11, shapes: [shape('polygon', 'body', { points: '22,7 42,7 42,21 57,21 57,43 42,43 42,57 22,57 22,43 7,43 7,21 22,21', 'stroke-width': 6, 'stroke-linejoin': 'round' })] },
  diamond: { y: 30, face: [26.5, 40.5], gap: 9.5, shapes: [shape('polygon', 'body', { points: '32,5 59,32 32,59 5,32', 'stroke-width': 8, 'stroke-linejoin': 'round' })] },
  octagon: { y: 30, face: [27, 41], gap: 11, shapes: [shape('polygon', 'body', { points: '22,5 42,5 59,22 59,42 42,59 22,59 5,42 5,22', 'stroke-width': 6, 'stroke-linejoin': 'round' })] }
});

/**
 * Resolves the face a seed gets. The tone is `avatarTone(seed)`, so an agent's initials Avatar and
 * its face agree when they share a key; every other trait comes from FNV-1a over the same
 * normalised key plus a per-trait salt, mixed, so traits are independent of the tone and of each
 * other.
 * @param {unknown} seed The agent's stable identity — an id, or its name.
 * @param {AgentTraitOverrides} [overrides={}] Traits to fix instead of deriving them.
 * @returns {AgentTraits}
 */
export function agentTraits(seed, overrides = {}) {
  const key = normaliseKey(seed);
  const tone = AVATAR_TONES.includes(/** @type {AvatarTone} */ (overrides.tone))
    ? /** @type {AvatarTone} */ (overrides.tone) : avatarTone(key);
  const body = AGENT_BODIES.includes(/** @type {AgentBody} */ (overrides.body))
    ? /** @type {AgentBody} */ (overrides.body) : pick(key, 'body', AGENT_BODIES);
  const eyes = AGENT_EYES.includes(/** @type {AgentEyes} */ (overrides.eyes))
    ? /** @type {AgentEyes} */ (overrides.eyes) : pick(key, 'eyes', AGENT_EYES);
  const spacing = [0, 1, 2].includes(/** @type {number} */ (overrides.spacing))
    ? /** @type {0|1|2} */ (overrides.spacing) : /** @type {0|1|2} */ (pick(key, 'spacing', [0, 1, 2]));
  const mouth = overrides.mouth === 'none' || AGENT_MOUTHS.includes(/** @type {AgentMouth} */ (overrides.mouth))
    ? /** @type {AgentMouth} */ (overrides.mouth) : pick(key, 'mouth', AGENT_MOUTHS);
  const cheeks = typeof overrides.cheeks === 'boolean' ? overrides.cheeks : pick(key, 'cheeks', [true, false]);
  return { tone, body, eyes, spacing, mouth, cheeks };
}

/**
 * The expression a face draws: `expression` when it is one, else the activity's, else `calm`.
 * @param {AgentActivity|string|null} [activity=null]
 * @param {AgentExpression|string|null} [expression=null]
 * @returns {AgentExpression}
 */
export function faceExpression(activity = null, expression = null) {
  if (AGENT_EXPRESSIONS.includes(/** @type {AgentExpression} */ (expression))) return /** @type {AgentExpression} */ (expression);
  return typeof activity === 'string' && Object.hasOwn(ACTIVITY_EXPRESSION, activity)
    ? ACTIVITY_EXPRESSION[/** @type {AgentActivity} */ (activity)] : 'calm';
}

/**
 * The shapes that draw a face in one activity at one rendered size, in a 64-unit view box, as
 * plain data. The level of detail follows `px`: the mouth and the pupils go below 20px, the blush
 * below 28px, and at 24px and below the eyes grow and sit at the middle spacing. Traits without a
 * `mouth` — drawn before faces had one — draw eyes only, centred, and no blush without `cheeks`.
 * @param {Partial<AgentTraits>} traits From {@link agentTraits}.
 * @param {AgentActivity|string|null} [activity=null] What the agent is doing; unknown is idle.
 * @param {number} [px=32] The rendered size in CSS pixels.
 * @param {AgentExpression|string|null} [expression=null] An expression to draw instead of the
 *   activity's.
 * @returns {AgentShape[]}
 */
export function agentFace(traits, activity = null, px = 32, expression = null) {
  const mood = faceExpression(activity, expression);
  const small = px <= 24;
  const body = typeof traits.body === 'string' && Object.hasOwn(BODIES, traits.body)
    ? BODIES[/** @type {AgentBody} */ (traits.body)] : BODIES.circle;
  const mouth = px >= MOUTH_MIN_PX && (traits.mouth === 'smile' || traits.mouth === 'grin' || traits.mouth === 'cat')
    ? traits.mouth : null;
  // Small eyes are drawn larger, so a small mouth sits a touch lower to keep clear of them.
  const [y, mouthY] = mouth ? [body.face[0], body.face[1] + (small ? 0.6 : 0)] : [body.y, body.y];
  const name = AGENT_EYES.includes(/** @type {AgentEyes} */ (traits.eyes)) ? /** @type {AgentEyes} */ (traits.eyes) : 'round';
  const [width, height] = EYE_SIZE[name];
  const grow = small ? SMALL_EYES : 1;
  const solid = SOLID_EYES.includes(name);
  const spread = traits.spacing === 0 || traits.spacing === 2 ? SPREAD[traits.spacing] : 1;
  const gap = body.gap * (small ? 0.95 : spread);
  const eye = {
    xs: [32 - gap, 32 + gap], y, w: width * grow, h: height * grow,
    shape: name, solid, pupils: !solid && px >= 20, heavy: small, mouth: mouth !== null
  };
  /** @type {AgentShape[]} */
  const features = [];
  if (traits.cheeks === true && px >= CHEEK_MIN_PX && BLUSHING.includes(mood)) {
    const snug = SNUG_CHEEKS.includes(/** @type {AgentBody} */ (traits.body));
    features.push(cheekPair(eye, snug, mouth ? { y: mouthY, half: MOUTH_HALF[mouth] * (MOUTH_SCALE[mood] ?? 1) } : null));
  }
  features.push(eyePair(eye, mood));
  if (mouth) features.push(mouthShape(mouth, mood, mouthY, small));
  const slant = mouth && typeof traits.body === 'string' && Object.hasOwn(SLANT, traits.body)
    ? /** @type {number} */ (SLANT[/** @type {AgentBody} */ (traits.body)]) : 0;
  const angle = mood === 'listening' ? slant + (slant < 0 ? -TILT : TILT) : slant;
  const tilt = angle ? { transform: `rotate(${angle} 32 ${r((y + mouthY) / 2)})` } : {};
  return [
    shape('g', 'shape', {}, body.shapes.map(copyShape)),
    shape('g', 'features', tilt, features)
  ];
}

/**
 * @typedef {Object} EyeSpec
 * @property {number[]} xs The eyes' centres across.
 * @property {number} y Their centre line.
 * @property {number} w @property {number} h Their size at rest.
 * @property {AgentEyes} shape
 * @property {boolean} solid Whether the shape is drawn without a pupil.
 * @property {boolean} pupils Whether pupils are drawn.
 * @property {boolean} heavy Whether lines are drawn heavier, for a small size.
 * @property {boolean} mouth Whether the face has a mouth to carry part of the expression.
 */

/**
 * Two eyes with the expression's static look. The `look` group is what drifts and scans, an `eye`
 * group is what blinks, and a `gaze` group moves a pupil.
 * @param {EyeSpec} eye
 * @param {AgentExpression} mood
 * @returns {AgentShape}
 */
function eyePair(eye, mood) {
  const { xs, y } = eye;
  let { w, h } = eye;
  /** @type {AgentShape[]} */
  const eyes = [];
  const group = () => shape('g', 'eyes', {}, [shape('g', 'look', {}, eyes)]);
  // A face without a mouth has only its eyes to look troubled with: flat bars.
  if (mood === 'worried' && !eye.mouth) {
    const bar = eye.heavy ? 4 : 3.2;
    for (const x of xs) eyes.push(shape('rect', 'sclera', { x: r(x - w * 0.6), y: r(y - bar / 2), width: r(w * 1.2), height: bar, rx: 1.4 }));
    return group();
  }
  if (mood === 'asleep' || mood === 'happy') {
    // Closed eyes curve down, smiling eyes up; with a mouth both are drawn at the mouth's weight.
    const stroke = eye.mouth ? (eye.heavy ? 3.4 : 2.8) : (eye.heavy ? 3 : 2.2);
    const half = eye.mouth || mood === 'happy' ? Math.max(w, 11.5) * 0.575 : w * 0.55;
    for (const x of xs) {
      const d = mood === 'asleep'
        ? `M${r(x - half)} ${r(y)}Q${r(x)} ${r(y + (eye.mouth ? 7 : h * 0.45))} ${r(x + half)} ${r(y)}`
        : `M${r(x - half)} ${r(y + 2)}Q${r(x)} ${r(y - 9)} ${r(x + half)} ${r(y + 2)}`;
      eyes.push(shape('path', 'line', { d, 'stroke-width': stroke }));
    }
    return group();
  }
  let dx = 0; let dy = 0; let px = 0; let py = 0;
  // The eye takes its final size first, so a pupil's offset is measured on the eye it sits in.
  if (mood === 'focused') h *= 0.62;
  // Wide eyes, a little less so above a mouth, and less again where small eyes are drawn large already.
  if (mood === 'alert') { const grow = eye.mouth ? (eye.heavy ? 1.06 : 1.12) : 1.2; w *= grow; h *= grow; }
  if (mood === 'worried') { w *= 0.9; h *= 0.9; }
  if (mood === 'thinking') {
    if (eye.pupils) { px = w * 0.2; py = -h * 0.22; } else if (eye.solid) { h *= 0.8; dx = 1.5; dy = -1.5; } else { dx = 2.5; dy = -3; }
  }
  if (mood === 'focused') {
    if (eye.pupils) py = h * 0.2; else dy = 2;
  }
  if (mood === 'worried' && eye.pupils) py = h * 0.18;
  xs.forEach((x, index) => {
    const scale = mood === 'thinking' && !eye.pupils && !eye.solid && index === 1 ? 0.85 : 1;
    const ew = w * scale;
    const eh = h * scale;
    const cx = x + dx;
    const cy = y + dy;
    /** @type {AgentShape[]} */
    const parts = [eyeShape(eye.shape, cx, cy, ew, eh)];
    if (eye.pupils) {
      const radius = Math.min(ew, eh) * (mood === 'alert' ? 0.36 : 0.3);
      const [ox, oy] = fitPupil(eye.shape, ew, eh, radius, px, py);
      parts.push(shape('g', 'gaze', {}, [shape('circle', 'pupil', { cx: r(cx + ox), cy: r(cy + oy), r: r(radius) })]));
    }
    eyes.push(shape('g', 'eye', {}, parts));
  });
  return group();
}

/**
 * The blush: a soft spot below and outside each eye. A silhouette that narrows below the eyes has no
 * room outside them: there a smaller spot sits beside the mouth, clear of its corners, or, on a face
 * without one, right below each eye.
 * @param {EyeSpec} eye
 * @param {boolean} snug Whether the silhouette narrows below the eyes.
 * @param {{y: number, half: number}|null} mouth The mouth line and the mouth's half-width, or null
 *   for a face without a mouth.
 * @returns {AgentShape}
 */
function cheekPair(eye, snug, mouth) {
  const [left, right] = eye.xs;
  if (snug && mouth) {
    const beside = mouth;
    const cx = beside.half + 5.6;
    const cy = r(beside.y - 0.6);
    return shape('g', 'cheeks', {}, [
      shape('ellipse', 'cheek', { cx: r(32 - cx), cy, rx: 3.8, ry: 2.6 }),
      shape('ellipse', 'cheek', { cx: r(32 + cx), cy, rx: 3.8, ry: 2.6 })
    ]);
  }
  const out = snug ? -1 : eye.w * 0.3 + 1.5;
  const cy = r(eye.y + eye.h / 2 + 2.6);
  return shape('g', 'cheeks', {}, [
    shape('ellipse', 'cheek', { cx: r(left - out), cy, rx: 4.6, ry: 3 }),
    shape('ellipse', 'cheek', { cx: r(right + out), cy, rx: 4.6, ry: 3 })
  ]);
}

/**
 * The mouth in one expression. Calm, listening, focused, happy and asleep draw the face's own
 * style at their size; thinking presses it flat, alert opens it round, worried turns it down.
 * @param {'smile'|'grin'|'cat'} style
 * @param {AgentExpression} mood
 * @param {number} y The mouth line.
 * @param {boolean} heavy Whether to draw it heavier, for a small size.
 * @returns {AgentShape}
 */
function mouthShape(style, mood, y, heavy) {
  const stroke = heavy ? 3.6 : 3;
  /** @param {string} d @returns {AgentShape} */
  const line = (d) => shape('path', 'line', { d, 'stroke-width': stroke });
  /** @type {AgentShape[]} */
  let parts;
  if (mood === 'thinking') {
    // Pressed flat and drawn to the side the eyes look to.
    parts = [line(`M29.5 ${r(y)}H37.5`)];
  } else if (mood === 'alert') {
    const radius = heavy ? 4.2 : 4.6;
    parts = [
      shape('circle', 'sclera', { cx: 32, cy: r(y + 1.4), r: radius }),
      shape('circle', 'pupil', { cx: 32, cy: r(y + 1.4), r: r(radius * 0.36) })
    ];
  } else if (mood === 'worried') {
    parts = [line(`M27.4 ${r(y + 2)}Q32 ${r(y - 3.6)} 36.6 ${r(y + 2)}`)];
  } else {
    const s = MOUTH_SCALE[/** @type {keyof typeof MOUTH_SCALE} */ (mood)] ?? 1;
    // An open grin is for a face that is awake.
    const kind = style === 'grin' && mood === 'asleep' ? 'smile' : style;
    if (kind === 'cat') {
      parts = [line(`M${r(32 - 6 * s)} ${r(y - 1.4 * s)}Q${r(32 - 3 * s)} ${r(y + 4 * s)} 32 ${r(y - 0.6 * s)}`
        + `Q${r(32 + 3 * s)} ${r(y + 4 * s)} ${r(32 + 6 * s)} ${r(y - 1.4 * s)}`)];
    } else if (kind === 'grin') {
      const half = 5.5 * s;
      const top = r(y - 2 * s);
      parts = [shape('path', 'fill', {
        d: `M${r(32 - half)} ${top}H${r(32 + half)}A${r(half)} ${r(4.8 * s)} 0 0 1 ${r(32 - half)} ${top}Z`,
        'stroke-width': 1.6
      })];
    } else {
      parts = [line(`M${r(32 - 5 * s)} ${r(y - 1.9 * s)}Q32 ${r(y + 5.7 * s)} ${r(32 + 5 * s)} ${r(y - 1.9 * s)}`)];
    }
  }
  return shape('g', 'mouth', {}, parts);
}

/** The least clearance a pupil keeps from the edge of its eye, in view-box units. */
const PUPIL_CLEARANCE = 0.3;

/**
 * A pupil's offset from the centre of its eye, drawn back toward the centre as far as it takes to
 * keep the whole pupil inside the eye white that {@link eyeShape} draws, however the activity
 * points it.
 * @param {AgentEyes} name @param {number} w @param {number} h The eye as drawn.
 * @param {number} radius The pupil's radius.
 * @param {number} ox @param {number} oy The offset the activity asks for.
 * @returns {[number, number]}
 */
function fitPupil(name, w, h, radius, ox, oy) {
  const a = name === 'oval' ? w * 0.42 : w / 2;
  const b = h / 2;
  const reach = radius + PUPIL_CLEARANCE;
  /** @param {number} k @returns {boolean} Whether the pupil fits at `k` times the offset. */
  const fits = (k) => {
    const x = ox * k;
    const y = oy * k;
    // A square eye's corners round less than a pupil does, so its box is the limit.
    if (name === 'square') return Math.abs(x) + reach <= a && Math.abs(y) + reach <= b;
    for (let step = 0; step < 32; step += 1) {
      const angle = (step * Math.PI) / 16;
      const px = x + reach * Math.cos(angle);
      const py = y + reach * Math.sin(angle);
      if ((px / a) ** 2 + (py / b) ** 2 > 1) return false;
    }
    return true;
  };
  if (fits(1)) return [ox, oy];
  let low = 0;
  let high = 1;
  for (let round = 0; round < 12; round += 1) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return [ox * low, oy * low];
}

/**
 * One open eye: an eye white for the shapes with pupils, a solid shape for their siblings.
 * @param {AgentEyes} name @param {number} x @param {number} y @param {number} w @param {number} h
 * @returns {AgentShape}
 */
function eyeShape(name, x, y, w, h) {
  if (name === 'square' || name === 'pixel' || name === 'capsule') {
    const radius = name === 'capsule' ? Math.min(w, h) / 2 : Math.min(w, h) * 0.22;
    return shape('rect', 'sclera', { x: r(x - w / 2), y: r(y - h / 2), width: r(w), height: r(h), rx: r(radius) });
  }
  if (name === 'oval') return shape('ellipse', 'sclera', { cx: r(x), cy: r(y), rx: r(w * 0.42), ry: r(h / 2) });
  return shape('ellipse', 'sclera', { cx: r(x), cy: r(y), rx: r(w / 2), ry: r(h / 2) });
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
