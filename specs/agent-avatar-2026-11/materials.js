// Internal exploration — body materials for AgentAvatar. Not part of the site or the package.
// The geometry is the shipped one (agentTraits + agentFace); only the body's paint changes here.
import { AGENT_BODIES, Aurora, agentFace, agentTraits } from '../../src/index.js';

const NS = 'http://www.w3.org/2000/svg';
const TONES = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet'];
const ACTIVITIES = ['idle', 'thinking', 'working', 'needs-you', 'blocked', 'offline'];
const WORDS = { idle: 'Idle', thinking: 'Thinking', working: 'Working', 'needs-you': 'Needs you', blocked: 'Blocked', offline: 'Offline' };
const SEEDS = ['agt-7f3a', 'agt-19c2', 'agt-4d81', 'agt-b6e0', 'agt-2a57', 'agt-c913', 'agt-58fd', 'agt-e07b', 'agt-91aa', 'agt-3c6e'];
const LADDER = [16, 20, 24, 32, 48, 64, 96, 128];

/** Mixes the tone's solid fill with white (`eye`) or near black (`ink`). */
const lift = (share) => `color-mix(in srgb, var(--m-solid) ${share}%, var(--zx-color-agent-eye))`;
const sink = (share) => `color-mix(in srgb, var(--m-solid) ${share}%, var(--zx-color-agent-pupil))`;

let uid = 0;
const id = (prefix) => `${prefix}-${(uid += 1)}`;

function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) if (value != null) el.setAttribute(name, String(value));
  for (const child of children.flat()) if (child) el.append(child);
  return el;
}

function stop(offset, color, opacity = null) {
  const el = s('stop', { offset });
  el.style.setProperty('stop-color', color);
  if (opacity != null) el.style.setProperty('stop-opacity', String(opacity));
  return el;
}

/** A body-shaped clip path, from the drawing's own body shapes. */
function bodyClip(shapeGroup, clipId) {
  return s('clipPath', { id: clipId }, shapeGroup.children.map(draw));
}

function draw(shape) {
  const el = s(shape.tag, shape.attrs);
  if (shape.part) el.setAttribute('class', `zx-agent-avatar__${shape.part}`);
  if (shape.children) el.append(...shape.children.map(draw));
  return el;
}

function softGradient(gid) {
  return s('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 14, y1: 4, x2: 50, y2: 60 },
    stop(0, lift(74)), stop(0.5, 'var(--m-solid)'), stop(1, sink(84)));
}

/** A copy of the body shapes painted one colour, for layers under the body (lip, rim). */
function bodyCopy(shapeGroup, paint, transform = null) {
  const copy = draw(shapeGroup);
  for (const part of copy.querySelectorAll('.zx-agent-avatar__body')) {
    part.removeAttribute('class');
    part.style.setProperty('fill', paint);
    part.style.setProperty('stroke', paint);
  }
  if (transform) copy.setAttribute('transform', transform);
  return copy;
}

/**
 * Each material: how the body is painted (`paint`), what goes in <defs>, layers under the body,
 * transforms for the body and the eyes, an optional filter on the body group, overlays clipped to
 * the body, and an optional group opacity. `verdict` is where the sparring round landed.
 */
const MATERIALS = [
  {
    id: 'flat', title: 'Flat', from: 'shipped', verdict: 'Default — all three agree',
    note: 'The tone\'s solid fill, nothing else. The only treatment that is fully legible at 16–24px, where most avatars live; white eyes sit at 3.7–4.3:1 on every tone.',
    recipe: 'fill: --zx-color-tone-*-solid',
    cost: 'None. No ids, no filters.',
    build: () => ({ paint: 'var(--m-solid)' })
  },
  {
    id: 'soft', title: 'Soft', from: 'Fable', verdict: 'On-brand — the one gradient worth shipping',
    note: 'A vertical tonal ramp: barely lifted at the very top, the plain tone across the eye row, a little deeper at the foot. Lightens at most 10% and only above the eyes, so eye contrast never drops.',
    recipe: 'linearGradient userSpace 0,4 → 0,60 · 0% solid 90% + white · 30–50% solid · 100% solid 86% + ink',
    cost: 'One gradient per avatar. A deterministic id per tone (zx-agent-avatar-soft-blue) avoids counters: duplicates are identical.',
    build: () => {
      const g = id('soft');
      return { defs: [s('linearGradient', { id: g, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 4, x2: 0, y2: 60 },
        stop(0, lift(90)), stop(0.3, 'var(--m-solid)'), stop(0.5, 'var(--m-solid)'), stop(1, sink(86)))], paint: `url(#${g})` };
    }
  },
  {
    id: 'matte', title: 'Matte depth', from: 'Codex', verdict: 'On-brand — Codex\'s first choice if depth is wanted',
    note: 'Only a shade, never a highlight: the tone holds to the middle, then sinks toward the lower right. Eye contrast stays at least as strong as flat.',
    recipe: 'linearGradient userSpace 8,4 → 52,60 · 0% solid · 52% solid · 100% solid 84% + ink',
    cost: 'One gradient per avatar.',
    build: () => {
      const g = id('matte');
      return { defs: [s('linearGradient', { id: g, gradientUnits: 'userSpaceOnUse', x1: 8, y1: 4, x2: 52, y2: 60 },
        stop(0, 'var(--m-solid)'), stop(0.52, 'var(--m-solid)'), stop(1, sink(84)))], paint: `url(#${g})` };
    }
  },
  {
    id: 'lip', title: 'Lip', from: 'Fable', verdict: 'Robust, a little toy-like — suits the pixel creatures',
    note: 'A hard underside: the same silhouette in a deeper shade, 4 units below, with the face lifted 2 units. Reads as a keycap or a sticker on a block. No gradients, nothing to anti-alias.',
    recipe: 'body copy translate(0 2) fill solid 78% + ink · body and eyes translate(0 −2)',
    cost: 'Body shapes drawn twice; no ids.',
    build: (shapeGroup) => ({ paint: 'var(--m-solid)', under: [bodyCopy(shapeGroup, sink(78), 'translate(0 2)')], shift: 'translate(0 -2)' })
  },
  {
    id: 'rim', title: 'Rim', from: 'Fable', verdict: 'Utility — for avatars on coloured surfaces',
    note: 'A darker edge all round: the full silhouette in a deep shade, the body scaled to 88% on top. The only treatment that separates a blue agent from a blue banner.',
    recipe: 'body copy fill solid 78% + ink · body scale(.88) about the centre',
    cost: 'Body shapes drawn twice; no ids. Uneven on drop, clover and triangle because scaling is not an inset.',
    build: (shapeGroup) => ({ paint: 'var(--m-solid)', under: [bodyCopy(shapeGroup, sink(78))], bodyTransform: 'translate(32 32) scale(.88) translate(-32 -32)' })
  },
  {
    id: 'fold', title: 'Fold', from: 'Fable + Codex', verdict: 'Plausible for large illustration, too assertive as default',
    note: 'A hard diagonal split into two planes of the same tone — cut paper. Crisp at every size because it is an edge, not a ramp; adds a second diagonal to faces that already have tilted shapes.',
    recipe: 'linearGradient userSpace 12,8 → 52,56 · 0–56% solid · 56–100% solid 86% + ink',
    cost: 'One gradient per avatar.',
    build: () => {
      const g = id('fold');
      return { defs: [s('linearGradient', { id: g, gradientUnits: 'userSpaceOnUse', x1: 12, y1: 8, x2: 52, y2: 56 },
        stop(0, 'var(--m-solid)'), stop(0.56, 'var(--m-solid)'), stop(0.56, sink(86)), stop(1, sink(86)))], paint: `url(#${g})` };
    }
  },
  {
    id: 'ceramic', title: 'Ceramic', from: 'Codex', verdict: 'On-brand only this subtle',
    note: 'A diffuse radial light from the upper left, capped at 8% white, with a deeper rim. Softly rounded at 128px, flat at 16px. The brightest point brings white-eye contrast down to about 3.3:1 on the weakest tone.',
    recipe: 'radialGradient userSpace c 20,14 r 58 · 0% solid 92% + white · 36% solid · 100% solid 84% + ink',
    cost: 'One gradient per avatar.',
    build: () => {
      const g = id('ceramic');
      return { defs: [s('radialGradient', { id: g, gradientUnits: 'userSpaceOnUse', cx: 20, cy: 14, r: 58 },
        stop(0, lift(92)), stop(0.36, 'var(--m-solid)'), stop(1, sink(84)))], paint: `url(#${g})` };
    }
  },
  {
    id: 'duotone', title: 'Duotone', from: 'Claude', verdict: 'Most colourful — weakens "this agent is blue"',
    note: 'A diagonal blend from the agent\'s tone into its neighbour on the palette (blue → teal → green → amber → orange → red → pink → violet → blue). Closest to the Aurora mesh.',
    recipe: 'linearGradient userSpace 8,8 → 56,56 · tone solid → next tone solid',
    cost: 'One gradient per avatar. Two colours per agent double the colour-blind collisions.',
    build: () => {
      const g = id('duo');
      return { defs: [s('linearGradient', { id: g, gradientUnits: 'userSpaceOnUse', x1: 8, y1: 8, x2: 56, y2: 56 },
        stop(0, 'var(--m-solid)'), stop(1, 'var(--m-solid2)'))], paint: `url(#${g})` };
    }
  },
  {
    id: 'sticker', title: 'Sticker', from: 'Codex', verdict: 'Rare large display at most',
    note: 'The flat body lifted off the page by a small soft shadow beneath it; the face is untouched.',
    recipe: 'filter on the body group: feDropShadow dy 2, blur 1.2, ink 22%',
    cost: 'A filter per avatar — offscreen raster work, re-run while the presence loop moves it.',
    build: () => {
      const f = id('sticker');
      const shadow = s('feDropShadow', { dx: 0, dy: 2, stdDeviation: 1.2 });
      shadow.style.setProperty('flood-color', 'var(--zx-color-agent-pupil)');
      shadow.style.setProperty('flood-opacity', '0.22');
      return { defs: [s('filter', { id: f, x: '-25%', y: '-25%', width: '150%', height: '160%' }, shadow)], paint: 'var(--m-solid)', filter: `url(#${f})` };
    }
  },
  {
    id: 'gloss', title: 'Gloss', from: 'Claude', verdict: 'Gimmick — both reviewers',
    note: 'Flat tone with a broad specular sheet across the top and a faint shade at the foot, clipped to the silhouette. The highlight competes with the eyes as "the white thing".',
    recipe: 'flat fill · clipped ellipse 26,12 r 32×17 white 24% · clipped band y ≥ 46 ink 12%',
    cost: 'One clip path id per avatar; translucent overlays double-paint where clover pieces overlap.',
    build: (shapeGroup) => {
      const c = id('gloss');
      return {
        defs: [bodyClip(shapeGroup, c)], paint: 'var(--m-solid)',
        overlays: [s('g', { 'clip-path': `url(#${c})` },
          s('ellipse', { cx: 26, cy: 12, rx: 32, ry: 17, fill: 'var(--zx-color-agent-eye)', 'fill-opacity': 0.24 }),
          s('rect', { x: 0, y: 46, width: 64, height: 20, fill: 'var(--zx-color-agent-pupil)', 'fill-opacity': 0.12 }))]
      };
    }
  },
  {
    id: 'glass', title: 'Glass', from: 'Claude', verdict: 'Off-brand — both reviewers',
    note: 'A translucent body over whatever is behind it, with a highlight sheet. Its colour changes with the background, so it fails as an identity mark, and white-eye contrast depends on the backdrop.',
    recipe: 'group opacity .72 · soft gradient · clipped ellipse white 30% · clipped band ink 16%',
    cost: 'A clip id and an offscreen layer per avatar.',
    build: (shapeGroup) => {
      const g = id('glass'); const c = id('glassc');
      return {
        defs: [s('linearGradient', { id: g, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 4, x2: 0, y2: 60 },
          stop(0, lift(90)), stop(0.5, 'var(--m-solid)'), stop(1, sink(86))), bodyClip(shapeGroup, c)],
        paint: `url(#${g})`, opacity: 0.72,
        overlays: [s('g', { 'clip-path': `url(#${c})` },
          s('ellipse', { cx: 28, cy: 10, rx: 34, ry: 15, fill: 'var(--zx-color-agent-eye)', 'fill-opacity': 0.3 }),
          s('rect', { x: 0, y: 48, width: 64, height: 20, fill: 'var(--zx-color-agent-pupil)', 'fill-opacity': 0.16 }))]
      };
    }
  }
];

function floodEl(color, opacity, result) {
  const el = s('feFlood', { result });
  el.style.setProperty('flood-color', color);
  el.style.setProperty('flood-opacity', String(opacity));
  return el;
}

/** One avatar: the shipped drawing with the body repainted in a material. */
function face(material, seed, size, activity, overrides = {}) {
  const traits = agentTraits(seed, overrides);
  const [shapeGroup, eyes] = agentFace(traits, activity, size);
  const tone2 = TONES[(TONES.indexOf(traits.tone) + 1) % TONES.length] ?? 'blue';
  const svg = s('svg', { class: 'm-face', viewBox: '0 0 64 64', width: size, height: size, 'data-activity': activity });
  svg.style.setProperty('--m-solid', `var(--zx-color-tone-${traits.tone}-solid)`);
  svg.style.setProperty('--m-solid2', `var(--zx-color-tone-${tone2}-solid)`);
  const look = material.build(shapeGroup);
  if (look.defs) svg.append(s('defs', {}, look.defs));
  const body = draw(shapeGroup);
  for (const part of body.querySelectorAll('.zx-agent-avatar__body')) {
    part.style.setProperty('fill', look.paint);
    part.style.setProperty('stroke', look.paint);
  }
  if (look.bodyTransform) body.setAttribute('transform', look.bodyTransform);
  const group = s('g', { filter: look.filter ?? null, opacity: look.opacity ?? null }, body, look.overlays ?? []);
  const lifted = s('g', { transform: look.shift ?? null }, group, draw(eyes));
  svg.append(...(look.under ?? []), lifted);
  svg.setAttribute('aria-label', `${seed}, ${traits.body}, ${WORDS[activity]}`);
  svg.setAttribute('role', 'img');
  return svg;
}

// ------------------------------------------------------------------ page

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  for (const child of children.flat()) if (child != null) node.append(child);
  return node;
}
const band = (title, ...content) => el('div', { class: 'p-band' }, el('h3', {}, title), el('div', { class: 'p-row' }, ...content));
const cell = (node, caption) => el('div', { class: 'p-cellv' }, node, caption);

const state = { activity: 'idle' };
const auroras = [];

function renderAll() {
  for (const aurora of auroras.splice(0)) aurora.destroy();
  const overview = el('section', { class: 'm-overview' }, el('h2', {}, 'Side by side'),
    MATERIALS.flatMap((material) => [
      el('div', {}, el('a', { href: `#${material.id}` }, material.title), el('small', {}, `${material.from} · ${material.verdict}`)),
      el('div', { class: 'p-row' }, AGENT_BODIES.map((body) => face(material, `agt-${body}`, 40, state.activity, { body })))
    ]));
  const sections = MATERIALS.map((material, index) => {
    const aurora = el('div', { class: 'm-backdrop m-backdrop--aurora' }, SEEDS.slice(0, 5).map((seed) => face(material, seed, 48, state.activity)));
    auroras.push(new Aurora(aurora, { preset: 'mesh', intensity: 'vivid' }));
    return el('section', { class: 'p-option', id: material.id },
      el('div', { class: 'p-option__head' },
        el('h2', {}, el('span', { class: 'p-option__num' }, String(index + 1).padStart(2, '0')), material.title, el('span', { class: 'p-option__from' }, material.from)),
        el('p', {}, material.note),
        el('dl', {}, el('dt', {}, 'Verdict'), el('dd', {}, material.verdict), el('dt', {}, 'Recipe'), el('dd', {}, material.recipe), el('dt', {}, 'Cost'), el('dd', {}, material.cost))),
      band('Silhouettes · 56px', AGENT_BODIES.map((body) => cell(face(material, `agt-${body}`, 56, state.activity, { body }), body))),
      band('Sizes', LADDER.map((size) => cell(face(material, 'agt-4d81', size, state.activity, { body: 'squircle' }), String(size)))),
      band('Activity · 48px', ACTIVITIES.flatMap((activity) => [cell(face(material, 'agt-58fd', 48, activity, { body: 'circle' }), WORDS[activity]), cell(face(material, 'agt-58fd', 48, activity, { body: 'beacon' }), '')])),
      band('Backdrops', el('div', { class: 'm-backdrops' },
        el('div', { class: 'm-backdrop m-backdrop--page' }, SEEDS.slice(0, 5).map((seed) => face(material, seed, 48, state.activity))),
        el('div', { class: 'm-backdrop m-backdrop--surface' }, SEEDS.slice(5).map((seed) => face(material, seed, 48, state.activity))),
        aurora)));
  });
  document.getElementById('materials').replaceChildren(overview, ...sections);
}

const form = document.getElementById('controls');
const jump = document.getElementById('jump');
jump.append(new Option('—', ''), ...MATERIALS.map((m, i) => new Option(`${i + 1}. ${m.title}`, m.id)));
form.addEventListener('change', (event) => {
  const data = new FormData(form);
  document.documentElement.dataset.zxTheme = String(data.get('theme'));
  if (event.target === jump && jump.value) { document.getElementById(jump.value)?.scrollIntoView({ behavior: 'smooth' }); return; }
  if (data.get('activity') !== state.activity) { state.activity = String(data.get('activity')); renderAll(); }
});
const params = new URLSearchParams(location.search);
if (params.get('theme')) { form.theme.value = params.get('theme'); document.documentElement.dataset.zxTheme = params.get('theme'); }
renderAll();
if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
