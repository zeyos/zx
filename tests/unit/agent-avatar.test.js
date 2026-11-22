import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ACTIVITY_EXPRESSION, AGENT_BODIES, AGENT_EXPRESSIONS, AGENT_EYES, AGENT_MOUTHS, agentFace, agentTraits, faceExpression
} from '../../src/components/agent-avatar/agent-face.js';
import { AVATAR_TONES, avatarTone } from '../../src/components/avatar/avatar.js';

/**
 * A few seeds pinned to their faces. The generator is contract; see the table-order test. When the
 * eye table grew from three shapes to six these three took their families' solid siblings — oval to
 * capsule, square to pixel, round to dot — and every face gained a mouth and a cheeks choice.
 */
const PINNED = {
  'agt-7f3a': { tone: 'violet', body: 'trapezoid', eyes: 'capsule', spacing: 0, mouth: 'grin', cheeks: true },
  Ledger: { tone: 'orange', body: 'clover', eyes: 'pixel', spacing: 0, mouth: 'cat', cheeks: false },
  Nova: { tone: 'violet', body: 'drop', eyes: 'dot', spacing: 2, mouth: 'grin', cheeks: false }
};

/** The eye shapes drawn with pupils. */
const PUPIL_EYES = ['round', 'oval', 'square'];

/** Every shape in a drawing, depth first. */
const flatten = (shapes) => shapes.flatMap((shape) => [shape, ...flatten(shape.children ?? [])]);
const parts = (shapes) => flatten(shapes).map((shape) => shape.part);
const seeds = (count) => Array.from({ length: count }, (_, index) => `agent-${index}`);

test('the trait tables and their order are fixed', () => {
  assert.deepEqual([...AGENT_BODIES], ['circle', 'squircle', 'hexagon', 'triangle', 'drop', 'pill', 'clover', 'dome',
    'wedge', 'pentagon', 'trapezoid', 'cross', 'diamond', 'octagon']);
  assert.deepEqual([...AGENT_EYES], ['round', 'oval', 'square', 'dot', 'capsule', 'pixel']);
  assert.deepEqual([...AGENT_MOUTHS], ['smile', 'grin', 'cat']);
  assert.deepEqual([...AGENT_EXPRESSIONS], ['calm', 'happy', 'listening', 'thinking', 'focused', 'alert', 'worried', 'asleep']);
});

test('the eye table grew by its own length, so every agent kept its eye family', () => {
  // The pick of the three-shape table, as it was: FNV-1a over key and salt, then the Murmur mixer.
  const before = (seed) => {
    const text = `${String(seed).trim().normalize('NFC').toLowerCase()}\u0000eyes`;
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
    return ['round', 'oval', 'square'][(hash >>> 0) % 3];
  };
  let kept = 0;
  for (const seed of seeds(1200)) {
    const index = AGENT_EYES.indexOf(agentTraits(seed).eyes);
    assert.equal(AGENT_EYES[index % 3], before(seed), seed);
    if (index < 3) kept += 1;
  }
  assert.ok(kept > 500 && kept < 700, `about half keep their exact eyes: ${kept}`);
});

test('pinned seeds keep their faces', () => {
  for (const [seed, traits] of Object.entries(PINNED)) assert.deepEqual(agentTraits(seed), traits, seed);
});

test('the tone is avatarTone of the seed, so a face and an initials Avatar agree', () => {
  for (const seed of ['Ada Lovelace', 'agt-19c2', 'Research agent', '山田 太郎']) {
    assert.equal(agentTraits(seed).tone, avatarTone(seed), seed);
  }
  assert.equal(agentTraits('').tone, 'slate');
});

test('traits ignore case, outer whitespace and Unicode composition', () => {
  assert.deepEqual(agentTraits('  Ledger '), agentTraits('ledger'));
  assert.deepEqual(agentTraits('Amélie'), agentTraits('Amélie'));
});

test('overrides fix one trait and leave the rest derived; unknown ones are ignored', () => {
  const derived = agentTraits('agt-7f3a');
  assert.deepEqual(agentTraits('agt-7f3a', { tone: 'teal', body: 'hexagon', eyes: 'square' }),
    { ...derived, tone: 'teal', body: 'hexagon', eyes: 'square' });
  assert.deepEqual(agentTraits('agt-7f3a', { tone: 'chartreuse', body: 'star', eyes: 'chevron' }), derived);
  assert.ok(AVATAR_TONES.includes(agentTraits('agt-7f3a', { tone: 'slate' }).tone));
  assert.deepEqual(agentTraits('agt-7f3a', { mouth: 'cat', cheeks: false }), { ...derived, mouth: 'cat', cheeks: false });
  assert.equal(agentTraits('agt-7f3a', { mouth: 'none' }).mouth, 'none', 'none is a mouth a face can be given');
  assert.deepEqual(agentTraits('agt-7f3a', { mouth: 'fangs', cheeks: /** @type {any} */ ('yes') }), derived);
});

test('every trait value is reachable and traits do not follow the tone', () => {
  const all = seeds(2400).map((seed) => agentTraits(seed));
  assert.deepEqual(new Set(all.map((traits) => traits.body)), new Set(AGENT_BODIES));
  assert.deepEqual(new Set(all.map((traits) => traits.eyes)), new Set(AGENT_EYES));
  assert.deepEqual(new Set(all.map((traits) => traits.spacing)), new Set([0, 1, 2]));
  assert.deepEqual(new Set(all.map((traits) => traits.mouth)), new Set(AGENT_MOUTHS), 'none is never derived');
  assert.deepEqual(new Set(all.map((traits) => traits.cheeks)), new Set([true, false]));
  // Within one tone the bodies still spread: the body is not a function of the colour.
  for (const tone of new Set(all.map((traits) => traits.tone))) {
    const bodies = new Set(all.filter((traits) => traits.tone === tone).map((traits) => traits.body));
    assert.equal(bodies.size, AGENT_BODIES.length, tone);
  }
  // No body takes more than twice its fair share.
  for (const body of AGENT_BODIES) {
    assert.ok(all.filter((traits) => traits.body === body).length < (2 * all.length) / AGENT_BODIES.length, body);
  }
});

test('every body keeps its eyes inside the view box, clear of the edge', () => {
  for (const body of AGENT_BODIES) {
    for (const spacing of [0, 1, 2]) {
      const scleras = flatten(agentFace({ tone: 'blue', body, eyes: 'square', spacing }, 'needs-you', 48))
        .filter((shape) => shape.part === 'sclera');
      for (const { attrs } of scleras) {
        assert.ok(attrs.x >= 4 && attrs.y >= 4 && attrs.x + attrs.width <= 60 && attrs.y + attrs.height <= 60, `${body} ${spacing}`);
      }
    }
  }
});

test('a face draws its body, two eyes with pupils and a mouth, and draws less when small', () => {
  const traits = { ...agentTraits('Ledger'), eyes: 'square', mouth: 'smile', cheeks: true };
  const face = agentFace(traits, 'idle', 32);
  const count = (shapes, part) => parts(shapes).filter((name) => name === part).length;
  assert.ok(parts(face).includes('body'));
  assert.equal(count(face, 'eye'), 2);
  assert.equal(count(face, 'pupil'), 2);
  assert.equal(count(face, 'mouth'), 1);
  assert.equal(count(face, 'cheek'), 2);
  assert.equal(count(agentFace(traits, 'idle', 20), 'pupil'), 2);
  assert.equal(count(agentFace(traits, 'idle', 20), 'mouth'), 1, 'a 20px face keeps its mouth');
  assert.equal(count(agentFace(traits, 'idle', 24), 'cheek'), 0, 'no blush below 28px');
  assert.equal(count(agentFace(traits, 'idle', 16), 'pupil'), 0);
  assert.equal(count(agentFace(traits, 'idle', 16), 'mouth'), 0, 'no mouth below 20px');
  assert.deepEqual(agentFace(traits, null, 32), face, 'no activity draws the idle face');
  assert.deepEqual(agentFace(traits, 'dancing', 32), face, 'an unknown activity draws the idle face');
  for (const eyes of ['dot', 'capsule', 'pixel']) {
    const solid = agentFace({ ...traits, eyes }, 'idle', 48);
    assert.equal(count(solid, 'eye'), 2, eyes);
    assert.equal(count(solid, 'pupil'), 0, `${eyes} eyes are solid`);
  }
  // Traits from before faces had a mouth draw eyes only, centred where they always were.
  const classic = agentFace({ tone: 'blue', body: 'circle', eyes: 'round', spacing: 1 }, 'idle', 48);
  assert.equal(count(classic, 'mouth') + count(classic, 'cheek'), 0);
  assert.equal(flatten(classic).find((shape) => shape.part === 'sclera').attrs.cy, 30);
  assert.equal(count(agentFace({ ...traits, mouth: 'none' }, 'idle', 48), 'mouth'), 0);
  assert.equal(count(agentFace({ ...traits, cheeks: false }, 'idle', 48), 'cheek'), 0);
});

test('the blush shows only on a content face', () => {
  const traits = { ...agentTraits('Ledger'), mouth: 'smile', cheeks: true };
  const blushing = AGENT_EXPRESSIONS.filter((expression) => parts(agentFace(traits, null, 48, expression)).includes('cheek'));
  assert.deepEqual(blushing, ['calm', 'happy', 'listening']);
});

test('each activity has its own static expression, and an expression can stand in for it', () => {
  const activities = ['idle', 'thinking', 'working', 'needs-you', 'blocked', 'offline'];
  for (const traits of [agentTraits('Ledger'), { tone: 'blue', body: 'circle', eyes: 'square', spacing: 1 }]) {
    const drawings = activities.map((activity) => JSON.stringify(agentFace(traits, activity, 48)));
    assert.equal(new Set(drawings).size, 6, 'two activities draw the same face');
    for (const activity of activities) {
      assert.deepEqual(agentFace(traits, null, 48, ACTIVITY_EXPRESSION[activity]), agentFace(traits, activity, 48), activity);
    }
    const all = AGENT_EXPRESSIONS.map((expression) => JSON.stringify(agentFace(traits, 'idle', 48, expression)));
    assert.equal(new Set(all).size, AGENT_EXPRESSIONS.length, 'two expressions draw the same face');
  }
  assert.equal(faceExpression('needs-you', 'happy'), 'happy', 'the expression wins over the activity');
  assert.equal(faceExpression('needs-you', 'smug'), 'alert', 'an unknown expression is ignored');
  assert.equal(faceExpression(null, null), 'calm');
  const eyesOf = (shapes) => flatten(shapes.find((shape) => shape.part === 'features').children.find((shape) => shape.part === 'eyes').children);
  // Without a mouth, trouble shows as flat bars; with one, the mouth turns down.
  const classic = { tone: 'blue', body: 'circle', eyes: 'square', spacing: 1 };
  const bars = eyesOf(agentFace(classic, 'blocked', 48));
  assert.ok(!bars.some((shape) => shape.part === 'pupil') && bars.filter((shape) => shape.part === 'sclera').every((shape) => shape.tag === 'rect'));
  for (const traits of [classic, agentTraits('Ledger')]) {
    for (const expression of ['asleep', 'happy']) {
      const eyes = eyesOf(agentFace(traits, null, 48, expression));
      assert.ok(!eyes.some((shape) => shape.part === 'pupil') && eyes.filter((shape) => shape.part === 'line').length === 2, expression);
    }
  }
  const listening = agentFace(agentTraits('Ledger'), null, 48, 'listening').find((shape) => shape.part === 'features');
  assert.match(String(listening.attrs.transform), /^rotate\(/, 'a listening face tilts');
});

/**
 * The box a drawn shape covers, its stroke included. Paths take the commands the face uses: M, H, Z,
 * a quadratic Q measured at its true extreme, and A as the lower half of its ellipse (the grin).
 */
function bounds(shape) {
  const a = shape.attrs;
  const half = (Number(a['stroke-width']) || 0) / 2;
  let box;
  if (shape.tag === 'circle') box = [a.cx - a.r, a.cy - a.r, a.cx + a.r, a.cy + a.r];
  else if (shape.tag === 'ellipse') box = [a.cx - a.rx, a.cy - a.ry, a.cx + a.rx, a.cy + a.ry];
  else if (shape.tag === 'rect') box = [a.x, a.y, a.x + a.width, a.y + a.height];
  else {
    const xs = []; const ys = [];
    let x = 0; let y = 0;
    /** The extreme of one coordinate of a quadratic, or null when it lies at an end. */
    const extreme = (p0, p1, p2) => {
      const denominator = p0 - 2 * p1 + p2;
      if (denominator === 0) return null;
      const t = (p0 - p1) / denominator;
      return t > 0 && t < 1 ? (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2 : null;
    };
    for (const [, command, args] of String(a.d).matchAll(/([MQHAZ])([^MQHAZ]*)/g)) {
      const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (command === 'M') { [x, y] = n; }
      else if (command === 'H') { [x] = n; }
      else if (command === 'A') { ys.push(y + n[1]); [x, y] = [n[5], n[6]]; }
      else if (command === 'Q') {
        for (let index = 0; index < n.length; index += 4) {
          const [cx, cy, ex, ey] = n.slice(index, index + 4);
          const ix = extreme(x, cx, ex); const iy = extreme(y, cy, ey);
          if (ix !== null) xs.push(ix);
          if (iy !== null) ys.push(iy);
          [x, y] = [ex, ey];
          xs.push(x); ys.push(y);
        }
        continue;
      }
      if (command !== 'Z') { xs.push(x); ys.push(y); }
    }
    box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  return [box[0] - half, box[1] - half, box[2] + half, box[3] + half];
}

test('every feature stays in the view box, and the mouth stays clear of the eyes', () => {
  const drawn = (shapes, part) => flatten(shapes).filter((shape) => shape.part === part)
    .flatMap((shape) => flatten(shape.children ?? [])).filter((shape) => !shape.children);
  for (const [body, MOUTH] of AGENT_BODIES.flatMap((name) => AGENT_MOUTHS.map((mouth) => [name, mouth]))) {
    for (const eyes of AGENT_EYES) {
      for (const spacing of [0, 1, 2]) {
        for (const px of [24, 48]) {
          for (const expression of AGENT_EXPRESSIONS) {
            const face = agentFace({ tone: 'blue', body, eyes, spacing, mouth: MOUTH, cheeks: true }, null, px, expression);
            const label = `${body} ${eyes} ${spacing} ${px}px ${expression}`;
            for (const shape of [...drawn(face, 'eyes'), ...drawn(face, 'mouth'), ...drawn(face, 'cheeks')]) {
              const [left, top, right, bottom] = bounds(shape);
              assert.ok(left >= 3 && top >= 3 && right <= 61 && bottom <= 61, label);
            }
            const eyeFoot = Math.max(...drawn(face, 'eyes').map((shape) => bounds(shape)[3]));
            const mouthTop = Math.min(...drawn(face, 'mouth').map((shape) => bounds(shape)[1]));
            assert.ok(mouthTop - eyeFoot >= 0.5, `${label}: the mouth touches the eyes (${eyeFoot} / ${mouthTop})`);
            // The blush fades out toward its edge; what is visibly tinted keeps clear of the mouth.
            for (const cheek of drawn(face, 'cheeks')) {
              const { cx, cy, rx, ry } = cheek.attrs;
              const [left, top, right, bottom] = [cx - rx * 0.8, cy - ry * 0.8, cx + rx * 0.8, cy + ry * 0.8];
              for (const mouthShape of drawn(face, 'mouth')) {
                const box = bounds(mouthShape);
                const apart = right <= box[0] || left >= box[2] || bottom <= box[1] || top >= box[3];
                assert.ok(apart, `${label}: the blush sits on the mouth`);
              }
            }
          }
        }
      }
    }
  }
});

test('the drawing is a copy: changing it never changes the next one', () => {
  const traits = agentTraits('Ledger');
  flatten(agentFace(traits, 'idle', 48)).forEach((shape) => { shape.attrs.mutated = 1; });
  assert.ok(flatten(agentFace(traits, 'idle', 48)).every((shape) => !('mutated' in shape.attrs)));
});

test('every tone has its solid fill in the stylesheet', () => {
  const css = readFileSync(new URL('../../src/components/agent-avatar/agent-avatar.css', import.meta.url), 'utf8');
  for (const tone of AVATAR_TONES) {
    assert.match(css, new RegExp(`\\[data-tone="${tone}"\\][^}]*--zx-color-tone-${tone}-solid`), tone);
  }
});

test('every pupil stays inside its eye white, in every activity, eye shape and size', () => {
  /** Whether a circle lies inside a sclera shape, checked around its whole edge. */
  const inside = (sclera, pupil) => {
    const a = sclera.attrs;
    for (let step = 0; step < 360; step += 1) {
      const angle = (step * Math.PI) / 180;
      const x = pupil.cx + pupil.r * Math.cos(angle);
      const y = pupil.cy + pupil.r * Math.sin(angle);
      if (sclera.tag === 'rect') {
        if (x < a.x - 1e-6 || x > a.x + a.width + 1e-6 || y < a.y - 1e-6 || y > a.y + a.height + 1e-6) return false;
      } else if (((x - a.cx) / a.rx) ** 2 + ((y - a.cy) / a.ry) ** 2 > 1 + 1e-6) {
        return false;
      }
    }
    return true;
  };
  for (const eyes of PUPIL_EYES) {
    for (const activity of ['idle', 'thinking', 'working', 'needs-you', 'blocked']) {
      for (const px of [20, 24, 32, 40, 48, 64]) {
        for (const spacing of [0, 1, 2]) {
          const drawn = flatten(agentFace({ tone: 'blue', body: 'circle', eyes, spacing, mouth: 'smile' }, activity, px))
            .filter((shape) => shape.part === 'eye');
          assert.equal(drawn.length, 2);
          for (const eye of drawn) {
            const sclera = eye.children.find((shape) => shape.part === 'sclera');
            const pupil = flatten(eye.children).find((shape) => shape.part === 'pupil');
            assert.ok(inside(sclera, pupil.attrs), `${eyes} ${activity} ${px}px spacing ${spacing}`);
          }
        }
      }
    }
  }
});

test('the pupils still point the way each activity looks', () => {
  for (const eyes of PUPIL_EYES) {
    const traits = { tone: 'blue', body: 'circle', eyes, spacing: 1 };
    const pupil = (activity) => flatten(agentFace(traits, activity, 48)).find((shape) => shape.part === 'pupil').attrs;
    const centre = (activity) => flatten(agentFace(traits, activity, 48)).find((shape) => shape.part === 'sclera').attrs;
    const offset = (activity) => {
      const sclera = centre(activity);
      const cx = sclera.cx ?? sclera.x + sclera.width / 2;
      const cy = sclera.cy ?? sclera.y + sclera.height / 2;
      return { x: pupil(activity).cx - cx, y: pupil(activity).cy - cy };
    };
    assert.ok(offset('thinking').x > 0 && offset('thinking').y < 0, `${eyes} thinking looks up and to the side`);
    assert.ok(offset('working').y > 0, `${eyes} working looks down`);
    assert.ok(Math.abs(offset('idle').x) < 1e-9 && Math.abs(offset('idle').y) < 1e-9, `${eyes} idle looks straight out`);
  }
});

test('spacing is a trait override, so the traits getTraits() reports give the same face back', () => {
  const derived = agentTraits('agt-7f3a');
  for (const spacing of [0, 1, 2]) assert.equal(agentTraits('agt-7f3a', { spacing }).spacing, spacing);
  assert.deepEqual(agentTraits('agt-7f3a', { spacing: 3 }), derived, 'an unknown spacing is ignored');
  assert.deepEqual(agentTraits('agt-7f3a', { spacing: /** @type {any} */ ('1') }), derived);
  const stored = agentTraits('Ledger');
  assert.deepEqual(agentTraits('A new name', stored), stored, 'the stored traits keep the look across a rename');
  const flipped = { ...stored, mouth: 'none', cheeks: !stored.cheeks };
  assert.deepEqual(agentTraits('A new name', flipped), flipped, 'a mouth and cheeks choice round-trips too');
});

/* ------------------------------------------------------------------ presence loop -- */

/**
 * A browser just big enough for the presence loop: animation frames run by hand, an
 * IntersectionObserver that reports what the test says, and counted motion watchers.
 */
function presenceBrowser() {
  const saved = {};
  for (const key of ['requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver', 'MutationObserver', 'matchMedia']) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  }
  let frames = [];
  let next = 0;
  let now = 0;
  const env = {
    observers: [],
    mutations: [],
    mediaListeners: 0,
    reduced: false,
    doc: { hidden: false, addEventListener() {}, documentElement: { closest: () => null } },
    element() {
      return {
        ownerDocument: env.doc,
        style: { transform: '', removeProperty(name) { this[name] = ''; } },
        closest: (selector) => (env.region && selector.includes('reduced') ? {} : null),
        getRootNode() { return env.doc; }
      };
    },
    /** Runs animation frames 16.7 ms apart; returns how many ran. */
    run(count) {
      let ran = 0;
      while (frames.length && ran < count) {
        const frame = frames.shift();
        now += 16.7;
        frame.fn(now);
        ran += 1;
      }
      return ran;
    },
    get scheduled() { return frames.length > 0; },
    restore() {
      for (const [key, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  };
  globalThis.requestAnimationFrame = (fn) => { next += 1; frames.push({ id: next, fn }); return next; };
  globalThis.cancelAnimationFrame = (id) => { frames = frames.filter((frame) => frame.id !== id); };
  globalThis.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; env.observers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.targets = 0; this.connected = true; env.mutations.push(this); }
    observe() { this.targets += 1; }
    disconnect() { this.connected = false; }
  };
  globalThis.matchMedia = () => ({
    get matches() { return env.reduced; },
    addEventListener() { env.mediaListeners += 1; },
    removeEventListener() { env.mediaListeners -= 1; }
  });
  const originalNow = performance.now.bind(performance);
  saved.performanceNow = originalNow;
  performance.now = () => now;
  const restore = env.restore;
  env.restore = () => { restore(); performance.now = originalNow; };
  return env;
}

test('an idle animated avatar keeps breathing: the loop never stops at the rest point of its cycle', async () => {
  const { trackPresence } = await import('../../src/internal/presence-loop.js');
  const env = presenceBrowser();
  try {
    for (const phase of [0, 0.25, 0.5]) {
      const element = env.element();
      const handle = trackPresence(/** @type {any} */ (element), 'idle', { phase });
      env.observers[0].callback([{ target: element, isIntersecting: true }]);
      // Ten seconds: two breaths, each through rest and back.
      assert.equal(env.run(600), 600, `phase ${phase}: the loop stopped`);
      assert.ok(env.scheduled, `phase ${phase}: nothing is scheduled`);
      assert.match(element.style.transform, /scale\(/);
      handle.untrack();
      assert.equal(element.style.transform, '', 'untrack puts it back at rest');
      env.observers.length = 0;
    }
    // An activity that stays at rest lets the loop sleep once it has settled.
    const still = env.element();
    const handle = trackPresence(/** @type {any} */ (still), 'blocked');
    env.observers[0].callback([{ target: still, isIntersecting: true }]);
    env.run(600);
    assert.equal(env.scheduled, false, 'a blocked avatar keeps the loop running');
    handle.set('working');
    assert.ok(env.scheduled, 'a new moving activity starts it again');
    handle.untrack();
  } finally {
    env.restore();
  }
});

test('the presence loop watches motion once, however many avatars it moves', async () => {
  const { trackPresence } = await import('../../src/internal/presence-loop.js');
  const env = presenceBrowser();
  try {
    const elements = [env.element(), env.element(), env.element()];
    const handles = elements.map((element) => trackPresence(/** @type {any} */ (element), 'working'));
    env.observers[0].callback(elements.map((target) => ({ target, isIntersecting: true })));
    assert.equal(env.mutations.length, 1, 'one MutationObserver for the loop');
    assert.equal(env.mediaListeners, 1, 'one reduced-motion listener for the loop');
    env.run(30);
    assert.ok(elements.every((element) => element.style.transform), 'every avatar moves');

    // A reduced-motion region appears: every avatar goes to rest and the loop stops.
    env.region = true;
    env.mutations[0].callback([]);
    assert.ok(elements.every((element) => element.style.transform === ''), 'an avatar kept moving in a reduced region');
    env.run(5);
    assert.equal(env.scheduled, false);
    env.region = false;
    env.mutations[0].callback([]);
    assert.ok(env.scheduled, 'motion starts again once the region is gone');

    for (const handle of handles) handle.untrack();
    assert.equal(env.mutations[0].connected, false, 'the last avatar out disconnects the watcher');
  } finally {
    env.restore();
  }
});
