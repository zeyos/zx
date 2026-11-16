// Internal exploration — agent avatar layout options. Not part of the site or the package.
// Every option is a pure function (seed, size, activity) → SVG, drawn in a 64-unit viewBox.
import { avatarTone } from '../../src/index.js';

const NS = 'http://www.w3.org/2000/svg';
const TONES = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet'];
const ACTIVITIES = ['idle', 'thinking', 'working', 'needs-you', 'blocked', 'offline'];
const ACTIVITY_WORDS = { idle: 'Idle', thinking: 'Thinking', working: 'Working', 'needs-you': 'Needs you', blocked: 'Blocked', offline: 'Offline' };
const NAMES = ['Atlas', 'Juniper', 'Quill', 'Ledger', 'Nova', 'Scout', 'Harbor', 'Pixel', 'Mosaic', 'Tally', 'Echo', 'Rook'];
const LADDER = [16, 20, 24, 32, 48, 64, 96, 128];

// ------------------------------------------------------------------ seeding

/** FNV-1a, re-hashed per trait with a salt so traits are independent of each other and of the tone. */
function hash(text) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { value ^= text.charCodeAt(i); value = Math.imul(value, 0x01000193); }
  return value >>> 0;
}
const key = (seed) => String(seed).trim().normalize('NFC').toLowerCase();
const pick = (seed, salt, list) => list[hash(`${key(seed)}\u0000${salt}`) % list.length];
const toneOf = (seed) => avatarTone(seed);
const secondTone = (tone) => TONES[(TONES.indexOf(tone) + 3) % TONES.length];

// ------------------------------------------------------------------ svg helpers

function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) if (value !== null && value !== undefined && value !== false) el.setAttribute(name, String(value));
  for (const child of children.flat()) if (child) el.append(child);
  return el;
}
let uid = 0;
const nextId = (prefix) => `${prefix}${(uid += 1)}`;

function svgRoot(seed, size, activity, tone, tone2 = secondTone(tone)) {
  const root = s('svg', { class: 'agent', viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': 'true', 'data-activity': activity, 'data-animate': '' });
  root.style.setProperty('--t-solid', `var(--zx-color-tone-${tone}-solid)`);
  root.style.setProperty('--t-bg', `var(--zx-color-tone-${tone}-bg)`);
  root.style.setProperty('--t-fg', `var(--zx-color-tone-${tone}-fg)`);
  root.style.setProperty('--t2-solid', `var(--zx-color-tone-${tone2}-solid)`);
  root.style.setProperty('--phase', `${-(hash(`${key(seed)}\u0000phase`) % 5000) / 1000}s`);
  return root;
}

// ------------------------------------------------------------------ eyes (shared vocabulary)

/**
 * Draws a pair (or one) of eyes with the activity's static expression. Motion is added by CSS
 * classes: `.blink` per eye, `.gaze` on whatever moves with the look.
 * @param {{xs:number[], y:number, w:number, h:number, shape:string, fill:string, pupil?:boolean, pupilFill?:string, small?:boolean}} c
 */
function eyes(c, activity) {
  let { xs, y, w, h } = c;
  const fill = c.fill;
  const group = s('g', { class: 'eyes' });
  if (activity === 'blocked') {
    for (const x of xs) group.append(s('rect', { x: x - w * 0.6, y: y - 1.6, width: w * 1.2, height: 3.2, rx: 1.4, class: fill }));
    return group;
  }
  if (activity === 'offline') {
    for (const x of xs) group.append(s('path', { d: `M${x - w * 0.55} ${y} Q${x} ${y + h * 0.45} ${x + w * 0.55} ${y}`, class: fill.replace('f-', 'stroke-'), fill: 'none', 'stroke-width': c.small ? 3 : 2.2, 'stroke-linecap': 'round' }));
    return group;
  }
  let dx = 0; let dy = 0; let px = 0; let py = 0;
  if (activity === 'thinking') { if (c.pupil) { px = w * 0.2; py = -h * 0.22; } else { dx = 2.5; dy = -3; } }
  if (activity === 'working') { if (c.pupil) py = h * 0.2; else dy = 2; h *= 0.62; }
  if (activity === 'needs-you') { w *= 1.2; h *= 1.2; }
  const gaze = s('g', { class: c.pupil ? null : 'gaze' });
  xs.forEach((x, index) => {
    const scale = activity === 'thinking' && !c.pupil && index === 1 && xs.length > 1 ? 0.85 : 1;
    const ew = w * scale; const eh = h * scale;
    const eye = s('g', { class: 'blink' });
    eye.append(eyeShape(c.shape, x, y, ew, eh, fill));
    if (c.pupil) {
      const r = Math.min(ew, eh) * (activity === 'needs-you' ? 0.36 : 0.3);
      eye.append(s('g', { class: 'gaze' }, s('circle', { cx: x + px, cy: y + py, r, class: c.pupilFill ?? 'f-ink' })));
    }
    gaze.append(eye);
  });
  group.append(s('g', { transform: `translate(${dx} ${dy})` }, gaze));
  return group;
}

function eyeShape(shape, x, y, w, h, fill) {
  switch (shape) {
    case 'pill': return s('rect', { x: x - w * 0.4, y: y - h / 2, width: w * 0.8, height: h, rx: w * 0.4, class: fill });
    case 'square': return s('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: Math.min(w, h) * 0.22, class: fill });
    case 'moon': return s('path', { d: `M${x - w / 2} ${y + h * 0.3} H${x + w / 2} A${w / 2} ${h * 0.75} 0 0 0 ${x - w / 2} ${y + h * 0.3} Z`, class: fill });
    case 'oval': return s('ellipse', { cx: x, cy: y, rx: w * 0.42, ry: h / 2, class: fill });
    case 'chevron': return s('path', { d: `M${x - w / 2} ${y + h * 0.2} L${x} ${y - h * 0.3} L${x + w / 2} ${y + h * 0.2}`, fill: 'none', class: fill.replace('f-', 'stroke-'), 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    default: return s('ellipse', { cx: x, cy: y, rx: w / 2, ry: h / 2, class: fill });
  }
}

const tile = (cls = 'f-bg') => s('rect', { x: 0, y: 0, width: 64, height: 64, rx: 14, class: cls });

// ------------------------------------------------------------------ 1 · Token — free silhouettes

const TOKEN_SHAPES = {
  circle: { el: () => s('circle', { cx: 32, cy: 32, r: 28 }), y: 30, gap: 11 },
  squircle: { el: () => s('rect', { x: 5, y: 5, width: 54, height: 54, rx: 20 }), y: 29, gap: 11 },
  hexagon: { el: () => s('polygon', { points: '32,6 55,19 55,45 32,58 9,45 9,19', 'stroke-width': 8, 'stroke-linejoin': 'round' }), y: 30, gap: 10 },
  triangle: { el: () => s('polygon', { points: '32,9 57,53 7,53', 'stroke-width': 9, 'stroke-linejoin': 'round' }), y: 40, gap: 8 },
  drop: { el: () => s('path', { d: 'M32 5 H59 V32 A27 27 0 1 1 32 5 Z' }), y: 32, gap: 11 },
  pill: { el: () => s('rect', { x: 4, y: 15, width: 56, height: 34, rx: 17, transform: 'rotate(-20 32 32)' }), y: 30, gap: 11 },
  clover: { el: () => s('g', {}, s('circle', { cx: 21, cy: 21, r: 15 }), s('circle', { cx: 43, cy: 21, r: 15 }), s('circle', { cx: 21, cy: 43, r: 15 }), s('circle', { cx: 43, cy: 43, r: 15 }), s('rect', { x: 16, y: 16, width: 32, height: 32 })), y: 30, gap: 11 },
  dome: { el: () => s('path', { d: 'M5 52 V40 A27 27 0 0 1 59 40 V52 Q59 56 55 56 H9 Q5 56 5 52 Z' }), y: 36, gap: 11 }
};

function token(seed, size, activity) {
  const tone = toneOf(seed);
  const root = svgRoot(seed, size, activity, tone);
  const shapeName = pick(seed, 'body', Object.keys(TOKEN_SHAPES));
  const shape = TOKEN_SHAPES[shapeName];
  const body = shape.el();
  body.setAttribute('class', 'f-solid stroke-solid');
  const eyeShapeName = pick(seed, 'eyes', ['dot', 'oval', 'square']);
  const spread = pick(seed, 'spacing', [0.85, 1, 1.15]);
  const small = size <= 24;
  const ew = small ? 15 : 13;
  const gap = shape.gap * (small ? 0.95 : spread);
  root.append(s('g', { class: 'bob' }, body,
    eyes({ xs: [32 - gap, 32 + gap], y: shape.y, w: ew, h: eyeShapeName === 'oval' ? ew * 1.25 : ew, shape: eyeShapeName, fill: 'f-eye', pupil: !small || size >= 20, small }, activity)));
  return root;
}

// ------------------------------------------------------------------ 2 · Peek — bust rising from the tile's bottom edge

const PEEK_BODIES = {
  dome: () => s('path', { d: 'M8 70 V38 A24 24 0 0 1 56 38 V70 Z' }),
  block: () => s('rect', { x: 10, y: 15, width: 44, height: 60, rx: 9 }),
  trapezoid: () => s('path', { d: 'M4 70 L15 18 Q16 14 20 14 H44 Q48 14 49 18 L60 70 Z' }),
  hex: () => s('path', { d: 'M8 70 V30 L20 13 H44 L56 30 V70 Z' }),
  arch: () => s('path', { d: 'M8 70 V38 A24 24 0 0 1 25 15 A7 7 0 0 0 39 15 A24 24 0 0 1 56 38 V70 Z' }),
  twin: () => s('path', { d: 'M6 70 V28 A15 15 0 0 1 32 18 A15 15 0 0 1 58 28 V70 Z' })
};

function peek(seed, size, activity) {
  const tone = toneOf(seed);
  const root = svgRoot(seed, size, activity, tone);
  const clip = nextId('peek');
  root.append(s('defs', {}, s('clipPath', { id: clip }, s('rect', { x: 0, y: 0, width: 64, height: 64, rx: 14 }))));
  root.append(tile());
  const small = size <= 20;
  const posture = { thinking: 'translate(0 -2) rotate(3 32 64)', 'needs-you': 'translate(0 -5) rotate(-6 32 64)', offline: 'translate(0 8)' }[activity] ?? '';
  const content = s('g', { 'clip-path': `url(#${clip})` });
  const lift = s('g', { transform: posture });
  const bob = s('g', { class: 'bob bob--ground' });
  if (small) {
    bob.append(s('rect', { x: -2, y: -2, width: 68, height: 72, class: 'f-solid' }));
    bob.append(eyes({ xs: [21, 43], y: 26, w: 13, h: 15, shape: 'pill', fill: 'f-eye', small: true }, activity));
  } else {
    const body = pick(seed, 'body', Object.keys(PEEK_BODIES));
    const el = PEEK_BODIES[body](); el.setAttribute('class', 'f-solid');
    const accessory = size >= 48 ? pick(seed, 'accessory', ['none', 'antenna', 'ears', 'brow']) : 'none';
    if (accessory === 'antenna') bob.append(s('line', { x1: 32, y1: 16, x2: 32, y2: 7, class: 'stroke-solid', 'stroke-width': 2.5, 'stroke-linecap': 'round' }), s('circle', { cx: 32, cy: 6, r: 3.2, class: 'f-solid pulse' }));
    if (accessory === 'ears') bob.append(s('rect', { x: 4, y: 30, width: 8, height: 13, rx: 3, class: 'f-solid' }), s('rect', { x: 52, y: 30, width: 8, height: 13, rx: 3, class: 'f-solid' }));
    bob.append(el);
    if (accessory === 'brow') bob.append(s('rect', { x: 20, y: 17.5, width: 24, height: 2.6, rx: 1.3, class: 'f-eye', opacity: 0.7 }));
    const spacing = size <= 24 ? 9 : pick(seed, 'spacing', [8, 9.5, 11]);
    const shape = size <= 24 ? 'pill' : pick(seed, 'eyes', ['dot', 'pill', 'square', 'moon']);
    bob.append(eyes({ xs: [32 - spacing, 32 + spacing], y: 30, w: 9, h: shape === 'pill' ? 13 : 9, shape, fill: 'f-eye' }, activity));
  }
  lift.append(bob); content.append(lift); root.append(content);
  return root;
}

// ------------------------------------------------------------------ 3 · Pebble — soft tinted body with one solid facet

const PEBBLE_CONTOURS = [
  'M32 5 C50 5 60 16 60 33 C60 50 49 60 31 60 C14 60 4 49 4 32 C4 15 15 5 32 5 Z',
  'M30 6 C46 5 57 14 59 30 C61 48 50 59 32 59 C13 59 4 50 5 33 C6 17 15 7 30 6 Z',
  'M35 4 C51 6 60 19 59 36 C58 52 46 60 30 60 C14 59 5 48 5 33 C6 15 19 3 35 4 Z',
  'M15 6 H47 C55 6 59 11 59 20 V42 C59 54 52 59 40 59 H23 C11 59 5 53 5 42 V20 C5 11 9 6 15 6 Z'
];
const PEBBLE_FACETS = ['28,-2 66,-2 66,36', '-2,26 -2,66 34,66', '30,66 66,66 66,30'];

function pebble(seed, size, activity) {
  const tone = toneOf(seed);
  const root = svgRoot(seed, size, activity, tone);
  const contour = pick(seed, 'body', PEBBLE_CONTOURS);
  const clip = nextId('pebble');
  root.append(s('defs', {}, s('clipPath', { id: clip }, s('path', { d: contour }))));
  const bob = s('g', { class: 'morph' });
  bob.append(s('path', { d: contour, class: 'f-bg' }));
  if (size >= 24) bob.append(s('g', { 'clip-path': `url(#${clip})` }, s('polygon', { points: pick(seed, 'facet', PEBBLE_FACETS), class: 'f-solid' })));
  bob.append(s('path', { d: contour, fill: 'none', class: 'stroke-fg', 'stroke-width': size >= 48 ? 2 : 3, opacity: 0.5 }));
  const spacing = pick(seed, 'spacing', [8.5, 10, 11.5]);
  bob.append(eyes({ xs: [32 - spacing, 32 + spacing], y: 28, w: size <= 24 ? 11 : 9, h: size <= 24 ? 15 : 13, shape: 'oval', fill: 'f-fg', small: size <= 24 }, activity));
  root.append(s('g', { class: 'bob' }, bob));
  return root;
}

// ------------------------------------------------------------------ 4 · Totem — two-tone constructivist stack

const TOTEM_HEADS = {
  block: () => s('rect', { x: 12, y: 6, width: 40, height: 32, rx: 7 }),
  round: () => s('circle', { cx: 32, cy: 22, r: 17 }),
  bowl: () => s('path', { d: 'M12 6 H52 V20 A20 18 0 0 1 12 20 Z' }),
  quarter: () => s('path', { d: 'M12 38 V6 H24 A28 32 0 0 1 52 38 Z' }),
  dome: () => s('path', { d: 'M12 38 V24 A20 18 0 0 1 52 24 V38 Z' })
};
const TOTEM_BASES = {
  slab: () => s('rect', { x: 8, y: 44, width: 48, height: 16, rx: 4 }),
  arch: () => s('path', { d: 'M8 60 V52 A24 10 0 0 1 56 52 V60 Z' }),
  steps: () => s('path', { d: 'M8 60 V52 H20 V44 H44 V52 H56 V60 Z' }),
  wedge: () => s('path', { d: 'M8 60 L18 44 H46 L56 60 Z' }),
  pair: () => s('g', {}, s('circle', { cx: 20, cy: 52, r: 8 }), s('circle', { cx: 44, cy: 52, r: 8 }), s('rect', { x: 20, y: 44, width: 24, height: 16 }))
};
const TOTEM_CAPS = { none: null, tri: () => s('polygon', { points: '26,6 38,6 32,-2' }), dot: () => s('circle', { cx: 32, cy: 2, r: 4 }), bar: () => s('rect', { x: 22, y: 0, width: 20, height: 5, rx: 2.5 }) };

function totem(seed, size, activity) {
  const tone = toneOf(seed);
  const root = svgRoot(seed, size, activity, tone);
  const headName = pick(seed, 'head', Object.keys(TOTEM_HEADS));
  const head = TOTEM_HEADS[headName](); head.setAttribute('class', 'f-solid');
  const eyeShapeName = pick(seed, 'eyes', ['dot', 'square']);
  const eyeY = { bowl: 17, dome: 30, quarter: 27, round: 22, block: 21 }[headName];
  if (size < 32) {
    // Crop to the head alone, scaled up to fill the box.
    root.append(s('g', { transform: 'translate(-12.8 -2) scale(1.4)' }, s('g', { class: 'bob' }, head,
      eyes({ xs: [25, 39], y: eyeY, w: 8, h: 8, shape: eyeShapeName, fill: 'f-eye', small: true }, activity))));
    return root;
  }
  const baseName = pick(seed, 'base', Object.keys(TOTEM_BASES));
  const base = TOTEM_BASES[baseName](); base.setAttribute('class', 'f-solid2');
  const neck = s('rect', { x: 26, y: 36, width: 12, height: 10, class: 'f-solid2' });
  const capFactory = TOTEM_CAPS[size >= 48 ? pick(seed, 'cap', Object.keys(TOTEM_CAPS)) : 'none'];
  const cap = capFactory ? capFactory() : null;
  if (cap) cap.setAttribute('class', 'f-solid2');
  const top = s('g', { class: 'sway-head' }, cap, head, eyes({ xs: [25, 39], y: eyeY, w: 7, h: 7, shape: eyeShapeName, fill: 'f-eye' }, activity));
  root.append(s('g', { class: 'bob' }, base, neck, top));
  return root;
}

// ------------------------------------------------------------------ 5 · Orbit — core with a satellite

function orbit(seed, size, activity) {
  const tone = toneOf(seed);
  const root = svgRoot(seed, size, activity, tone);
  const oval = pick(seed, 'core', [false, true]);
  const small = size < 32;
  const core = oval ? s('ellipse', { cx: 32, cy: 33, rx: small ? 29 : 23, ry: small ? 26 : 20, class: 'f-solid' }) : s('circle', { cx: 32, cy: 32, r: small ? 28 : 22, class: 'f-solid' });
  const g = s('g', { class: 'bob' }, core,
    eyes({ xs: [32 - (small ? 10 : 8), 32 + (small ? 10 : 8)], y: 30, w: small ? 10 : 7, h: pick(seed, 'eyes', ['dot', 'pill']) === 'pill' ? (small ? 15 : 11) : (small ? 10 : 7), shape: pick(seed, 'eyes', ['dot', 'pill']), fill: 'f-ink', small }, activity));
  root.append(g);
  if (!small) {
    const angle = pick(seed, 'satellite', [-50, -140, 30, 150]);
    const rad = (angle * Math.PI) / 180;
    const spin = s('g', { class: 'spin' });
    spin.append(s('circle', { cx: 32, cy: 32, r: 29, fill: 'none', class: 'stroke-fg', 'stroke-width': 1.2, 'stroke-dasharray': '2 3', opacity: size >= 48 ? 0.45 : 0 }));
    spin.append(s('circle', { cx: 32 + 29 * Math.cos(rad), cy: 32 + 29 * Math.sin(rad), r: 5.5, class: 'f-solid2' }));
    root.append(spin);
  }
  return root;
}

// ------------------------------------------------------------------ 6 · Visor — device face, pips for eyes

function visor(seed, size, activity) {
  const tone = toneOf(seed);
  const root = svgRoot(seed, size, activity, tone);
  root.append(tile());
  const slot = pick(seed, 'slot', ['wide', 'short', 'arc', 'offset']);
  const small = size <= 24;
  const g = s('g', { class: 'bob' });
  const y = small ? 18 : 22; const hgt = small ? 18 : 15;
  const x = small ? 8 : slot === 'short' ? 16 : slot === 'offset' ? 6 : 10;
  const w = small ? 48 : slot === 'short' ? 32 : slot === 'offset' ? 40 : 44;
  const offline = activity === 'offline';
  g.append(s('rect', { x, y, width: w, height: hgt, rx: hgt / 2, class: offline ? 'stroke-fg' : 'f-fg', fill: offline ? 'none' : null, 'stroke-width': offline ? 2 : null, 'stroke-dasharray': offline ? '3 3' : null }));
  if (slot === 'offset' && !small) g.append(s('circle', { cx: 54, cy: y + hgt / 2, r: 4, class: 'f-solid pulse' }));
  const cx = x + w / 2; const cy = y + hgt / 2;
  const pipShape = pick(seed, 'pips', ['round', 'square', 'three']);
  const pr = small ? 3.6 : 3;
  const pip = (px, py, pw = pr * 2, ph = pr * 2, cls = 'f-bg') => s('rect', { x: px - pw / 2, y: py - ph / 2, width: pw, height: ph, rx: pipShape === 'square' ? 1 : Math.min(pw, ph) / 2, class: cls });
  const spread = small ? 11 : w * 0.24;
  if (activity === 'blocked') g.append(pip(cx - spread, cy, 8, 2.6), pip(cx + spread, cy, 8, 2.6));
  else if (activity === 'working') g.append(s('g', { class: 'sweep' }, pip(cx, cy, 10, 4.5)));
  else if (activity === 'needs-you') g.append(s('g', { class: 'blink' }, pip(cx - spread, cy, pr * 2.4, hgt - 4)), s('g', { class: 'blink' }, pip(cx + spread, cy, pr * 2.4, hgt - 4)));
  else if (activity === 'thinking') g.append(pip(cx - spread + 3, cy - 2.5), pip(cx + spread + 3, cy - 2.5), s('g', { class: 'pulse' }, pip(cx + 3, cy + 3, 3, 3)));
  else if (!offline) {
    const pips = pipShape === 'three' && !small ? [cx - spread, cx, cx + spread] : [cx - spread, cx + spread];
    for (const px of pips) g.append(s('g', { class: 'blink' }, pip(px, cy, pipShape === 'three' ? pr * 1.5 : pr * 2, pipShape === 'three' ? pr * 1.5 : pr * 2)));
  }
  if (!small) {
    const detail = pick(seed, 'detail', ['chin', 'notch', 'none']);
    if (detail === 'chin') g.append(s('rect', { x: 22, y: 46, width: 20, height: 4, rx: 2, class: 'f-solid' }));
    if (detail === 'notch') g.append(s('path', { d: 'M50 0 H64 V14 Z', class: 'f-solid' }));
  }
  root.append(g);
  return root;
}

// ------------------------------------------------------------------ 7 · Prism — angular face plate, slot eyes

const PRISM_PROFILES = [
  '32,5 57,17 57,47 32,59 7,47 7,17',
  '14,6 50,6 59,32 50,58 14,58 5,32',
  '10,8 54,8 58,40 32,58 6,40',
  '18,5 46,5 59,22 59,52 5,52 5,22'
];

function prism(seed, size, activity) {
  const tone = toneOf(seed);
  const root = svgRoot(seed, size, activity, tone);
  const pts = pick(seed, 'body', PRISM_PROFILES);
  const g = s('g', { class: 'bob' });
  g.append(s('polygon', { points: pts, class: 'f-solid stroke-solid', 'stroke-width': 5, 'stroke-linejoin': 'round' }));
  if (size >= 32) {
    const inset = pts.split(' ').map((p) => p.split(',').map(Number)).map(([x, y]) => `${32 + (x - 32) * 0.62},${30 + (y - 32) * 0.55}`).join(' ');
    g.append(s('polygon', { points: inset, class: 'f-eye', opacity: 0.16 }));
  }
  if (size >= 48 && pick(seed, 'score', [true, false])) g.append(s('line', { x1: 14, y1: 46, x2: 50, y2: 46, class: 'stroke-ink', 'stroke-width': 1.5, opacity: 0.35 }));
  const slant = pick(seed, 'slant', [1.5, 0.75]);
  if (activity === 'blocked' || activity === 'offline') {
    g.append(eyes({ xs: [22, 42], y: 29, w: 12, h: 8, shape: 'square', fill: 'f-ink', small: size <= 24 }, activity));
  } else {
    let hgt = { working: 4, 'needs-you': 10 }[activity] ?? 7;
    if (size <= 24) hgt += 2;
    const dy = activity === 'thinking' ? -2 : 0;
    const slot = (x, dir) => s('g', { class: 'blink' }, s('polygon', { points: `${x - 7},${29 + dy + dir * slant} ${x + 7},${29 + dy - dir * slant} ${x + 7},${29 + dy - dir * slant + hgt} ${x - 7},${29 + dy + dir * slant + hgt}`, class: 'f-ink', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    g.append(s('g', { class: 'gaze' }, slot(22, 1), slot(42, -1)));
  }
  root.append(g);
  return root;
}

// ------------------------------------------------------------------ 8 · Glyph — eyes instead of initials

function glyph(seed, size, activity) {
  const tone = toneOf(seed);
  const root = svgRoot(seed, size, activity, tone);
  root.append(tile());
  const shape = pick(seed, 'eyes', ['dot', 'pill', 'square', 'moon', 'chevron', 'oval']);
  const spacing = pick(seed, 'spacing', [8, 9.5, 11]);
  const small = size <= 24;
  const g = s('g', { class: 'bob' });
  g.append(eyes({ xs: [32 - spacing, 32 + spacing], y: 28, w: small ? 12 : 9, h: shape === 'pill' || shape === 'oval' ? (small ? 16 : 13) : (small ? 12 : 9), shape, fill: 'f-fg', small }, activity));
  if (!small) {
    const mark = pick(seed, 'mark', ['none', 'line', 'tick', 'cheek']);
    if (mark === 'line') g.append(s('rect', { x: 23, y: 43, width: 18, height: 2.4, rx: 1.2, class: 'f-fg' }));
    if (mark === 'tick') g.append(s('path', { d: 'M46 44 l4 -4', class: 'stroke-fg', 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
    if (mark === 'cheek') g.append(s('circle', { cx: 32 + spacing + 6, cy: 39, r: 3.4, class: 'f-solid' }));
  }
  root.append(g);
  return root;
}

// ------------------------------------------------------------------ the options

const OPTIONS = [
  {
    id: 'token', title: 'Token', from: 'Fable',
    note: 'Free-standing solid silhouettes from the tone palette — circle, squircle, hexagon, triangle, drop, tilted pill, clover, dome — with white eyes and ink pupils. The most literal "colourful geometric shape with eyes".',
    traits: '8 tones × 8 silhouettes × 3 eye shapes × 3 spacings = 576',
    small: 'Silhouette survives best of all; pupils go below 20px.',
    pro: 'Maximum charm and colour; shape is fully redundant with hue (best for colour-blind readers).',
    con: 'No container, so rows look ragged, stacks overlap badly and the activity dot floats. Closest to what consumer chat products already do.',
    render: token
  },
  {
    id: 'peek', title: 'Peek', from: 'Fable · recommended there',
    note: 'A rounded tile in the tone tint with one solid body rising from the bottom edge, like a head-and-shoulders portrait reduced to a primitive. Posture is state: it rises when thinking, leans up for needs-you, sinks when offline — static poses that survive reduced motion.',
    traits: '8 tones × 6 bodies × 4 eye shapes × 3 spacings × 4 accessories = 2,304',
    small: '≤20px the body fills the tile; ≤24px eyes become pills; accessories (antenna, ears, brow) from 48px.',
    pro: 'Keeps today\'s agent = rounded tile convention and the dot\'s cut-out; reads as a portrait next to people; 16px and 128px are the same design.',
    con: 'Six bodies is a small family; at small sizes identity is mostly tone + eyes.',
    render: peek
  },
  {
    id: 'pebble', title: 'Pebble', from: 'Codex · recommended there',
    note: 'One slightly asymmetric rounded body in the quiet tone tint, outlined in the tone ink, with one flat solid facet cut into an edge. Ink oval eyes, no mouth. The calmest option.',
    traits: '8 tones × 4 contours × 3 facets × 3 spacings = 288',
    small: 'Facet dropped below 24px; two high-contrast ovals remain.',
    pro: 'Guaranteed 4.5:1 eyes (tone ink on tone tint); friendly without being a cartoon; sits quietly in dense rows.',
    con: 'Pale — a roster reads washed out next to the brief\'s "colourful"; contours look alike at 16px.',
    render: pebble
  },
  {
    id: 'totem', title: 'Totem', from: 'Codex + Fable',
    note: 'A two-tone constructivist stack: a solid head carrying the eyes, a neck, and a base from a second tone (three steps along the palette), with an optional cap. Bauhaus building blocks.',
    traits: '8 tones × 5 heads × 5 bases × 2 eye shapes × 4 caps = 1,600',
    small: 'Below 32px it crops to the head alone — effectively a second design for rows.',
    pro: 'The most ownable and varied look; superb at hero size in empty states.',
    con: 'Two colours per agent break "same colour as the initials tile"; loud on a data screen; two designs to keep related.',
    render: totem
  },
  {
    id: 'orbit', title: 'Orbit', from: 'Codex',
    note: 'A round or oval solid core with ink eyes and one satellite on a faint orbit. The satellite is identity at rest and turns while the agent works.',
    traits: '8 tones × 2 cores × 2 eye shapes × 4 satellite positions = 128',
    small: 'Satellite and orbit dropped below 32px; the core grows to fill the box.',
    pro: 'Expressive motion with a clear "busy" metaphor; distinctive at hero size.',
    con: 'Its defining feature disappears in lists; the satellite competes with the activity dot.',
    render: orbit
  },
  {
    id: 'visor', title: 'Visor', from: 'Fable',
    note: 'A device face: one visor slot in tone ink across a tinted tile, with light pips for eyes. Expression is pip geometry — pips slide up and a third pulses (thinking), merge into a sweeping bar (working), grow to full height (needs you), flatten (blocked), the slot empties (offline).',
    traits: '8 tones × 4 slots × 3 pip sets × 3 details = 288',
    small: 'Excellent: a dark bar with two light pips at any size.',
    pro: 'Most enterprise-safe; richest state language; only the documented fg-on-bg pair.',
    con: 'The least warm, reads as "robot"; agents differ mostly by colour.',
    render: visor
  },
  {
    id: 'prism', title: 'Prism', from: 'Codex',
    note: 'An angular face plate from four blunt polygon profiles with a translucent inset plane and slanted slot eyes in ink. Optional scored line at hero size.',
    traits: '8 tones × 4 profiles × 2 slants × 2 scores = 128',
    small: 'Inset and score dropped; the outer polygon and two slots remain.',
    pro: 'Strong silhouette; the least childish of the face options.',
    con: 'Slanted slots read stern or even angry; angular plates feel severe beside rounded UI.',
    render: prism
  },
  {
    id: 'glyph', title: 'Glyph', from: 'Fable',
    note: 'Exactly today\'s Avatar fallback tile — tone tint and ink — with two eye glyphs in place of the initials and one seeded mark (line, tick, solid cheek dot). The minimum change; could be an Avatar option.',
    traits: '8 tones × 6 eye shapes × 3 spacings × 4 marks = 576',
    small: 'Trivial: it already is a glyph.',
    pro: 'Zero new visual language, guaranteed contrast, smallest scope.',
    con: 'Low delight; not "colourful geometric shapes"; easily mistaken for a person\'s initials tile.',
    render: glyph
  }
];

// ------------------------------------------------------------------ page

const state = { activity: 'idle', dot: true };

function avatar(option, seed, size, activity) {
  const wrap = document.createElement('span');
  wrap.className = 'p-av';
  wrap.style.setProperty('--av', `${size}px`);
  wrap.dataset.activity = activity;
  wrap.append(option.render(seed, size, activity));
  if (state.dot) {
    const dot = document.createElement('span');
    dot.className = 'p-dot';
    wrap.append(dot);
  }
  wrap.title = `${seed} · ${ACTIVITY_WORDS[activity]}`;
  return wrap;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  for (const child of children.flat()) node.append(child);
  return node;
}

function band(title, ...content) {
  return el('div', { class: 'p-band' }, el('h3', {}, title), el('div', { class: 'p-row' }, ...content));
}

function cell(node, caption) { return el('div', { class: 'p-cellv' }, node, caption); }

function renderOption(option, index) {
  const head = el('div', { class: 'p-option__head' },
    el('h2', {}, el('span', { class: 'p-option__num' }, String(index + 1).padStart(2, '0')), option.title, el('span', { class: 'p-option__from' }, option.from)),
    el('p', {}, option.note),
    el('dl', {},
      el('dt', {}, 'Variety'), el('dd', {}, option.traits),
      el('dt', {}, 'Small sizes'), el('dd', {}, option.small),
      el('dt', {}, 'For'), el('dd', {}, option.pro),
      el('dt', {}, 'Against'), el('dd', {}, option.con)));
  const roster = band('Roster · 48px', NAMES.map((n) => cell(avatar(option, n, 48, state.activity), n)));
  const ladder = band('Sizes', LADDER.map((size) => cell(avatar(option, 'Juniper', size, state.activity), `${size}`)));
  const states = band('Activity · 56px', ACTIVITIES.map((a) => cell(avatar(option, 'Harbor', 56, a), ACTIVITY_WORDS[a])));
  const chat = el('div', { class: 'p-chat' }, avatar(option, 'Ledger', 32, 'working'),
    el('div', {}, el('div', { class: 'p-chat__name' }, 'Ledger'), el('p', { class: 'p-chat__text' }, 'Reconciling 214 open items against the October bank statement…')));
  const list = el('div', { class: 'p-list' }, [['Atlas', 'thinking'], ['Quill', 'needs-you'], ['Scout', 'blocked'], ['Tally', 'offline'], ['Mosaic', 'idle']].map(([n, a]) =>
    el('div', { class: 'p-list__row' }, avatar(option, n, 20, a), n, el('span', { class: 'p-list__state' }, ACTIVITY_WORDS[a]))));
  const stack = el('div', { class: 'p-stack' }, ['Atlas', 'Nova', 'Pixel', 'Echo', 'Rook'].map((n) => avatar(option, n, 28, 'idle')));
  const hero = el('div', { class: 'p-hero' }, avatar(option, 'Nova', 112, state.activity), el('strong', {}, 'Nova'), el('p', {}, 'Ask about invoices, orders and stock.'));
  const context = band('In context', el('div', { class: 'p-context' }, chat, list, el('div', { class: 'p-cellv' }, stack, 'Stack · 28px'), hero));
  return el('section', { class: 'p-option', id: option.id }, head, roster, ladder, states, context);
}

function renderAll() {
  const main = document.getElementById('options');
  main.replaceChildren(...OPTIONS.map(renderOption));
}

const form = document.getElementById('controls');
const jump = document.getElementById('jump');
jump.append(new Option('—', ''), ...OPTIONS.map((o, i) => new Option(`${i + 1}. ${o.title}`, o.id)));
form.addEventListener('change', (event) => {
  const data = new FormData(form);
  document.documentElement.dataset.zxTheme = String(data.get('theme'));
  if (data.get('preset')) document.documentElement.dataset.zxPreset = String(data.get('preset'));
  else delete document.documentElement.dataset.zxPreset;
  if (data.get('motion')) delete document.body.dataset.zxMotion; else document.body.dataset.zxMotion = 'reduced';
  state.dot = Boolean(data.get('dot'));
  if (event.target === jump && jump.value) { document.getElementById(jump.value)?.scrollIntoView({ behavior: 'smooth' }); return; }
  const next = String(data.get('activity'));
  if (next !== state.activity || event.target.name === 'dot') { state.activity = next; renderAll(); }
});
const params = new URLSearchParams(location.search);
if (params.get('theme')) { form.theme.value = params.get('theme'); document.documentElement.dataset.zxTheme = params.get('theme'); }
renderAll();
if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
