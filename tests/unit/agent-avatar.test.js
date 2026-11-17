import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { AGENT_BODIES, AGENT_EYES, agentFace, agentTraits } from '../../src/components/agent-avatar/agent-face.js';
import { AVATAR_TONES, avatarTone } from '../../src/components/avatar/avatar.js';

/** A few seeds pinned to their faces. The generator is contract; see the table-order test. */
const PINNED = {
  'agt-7f3a': { tone: 'violet', body: 'trapezoid', eyes: 'oval', spacing: 0 },
  Ledger: { tone: 'orange', body: 'clover', eyes: 'square', spacing: 0 },
  Nova: { tone: 'violet', body: 'drop', eyes: 'round', spacing: 2 }
};

/** Every shape in a drawing, depth first. */
const flatten = (shapes) => shapes.flatMap((shape) => [shape, ...flatten(shape.children ?? [])]);
const parts = (shapes) => flatten(shapes).map((shape) => shape.part);
const seeds = (count) => Array.from({ length: count }, (_, index) => `agent-${index}`);

test('the trait tables and their order are fixed', () => {
  assert.deepEqual([...AGENT_BODIES], ['circle', 'squircle', 'hexagon', 'triangle', 'drop', 'pill', 'clover', 'dome',
    'wedge', 'pentagon', 'trapezoid', 'cross', 'diamond', 'octagon']);
  assert.deepEqual([...AGENT_EYES], ['round', 'oval', 'square']);
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
});

test('every trait value is reachable and traits do not follow the tone', () => {
  const all = seeds(2400).map((seed) => agentTraits(seed));
  assert.deepEqual(new Set(all.map((traits) => traits.body)), new Set(AGENT_BODIES));
  assert.deepEqual(new Set(all.map((traits) => traits.eyes)), new Set(AGENT_EYES));
  assert.deepEqual(new Set(all.map((traits) => traits.spacing)), new Set([0, 1, 2]));
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

test('a face draws its body and two eyes with pupils, and drops the pupils below 20px', () => {
  const traits = agentTraits('Ledger');
  const face = agentFace(traits, 'idle', 32);
  assert.ok(parts(face).includes('body'));
  assert.equal(parts(face).filter((part) => part === 'eye').length, 2);
  assert.equal(parts(face).filter((part) => part === 'pupil').length, 2);
  assert.equal(parts(agentFace(traits, 'idle', 20)).filter((part) => part === 'pupil').length, 2);
  assert.equal(parts(agentFace(traits, 'idle', 16)).filter((part) => part === 'pupil').length, 0);
  assert.deepEqual(agentFace(traits, null, 32), face, 'no activity draws the idle face');
  assert.deepEqual(agentFace(traits, 'dancing', 32), face, 'an unknown activity draws the idle face');
});

test('each activity has its own static expression', () => {
  const traits = agentTraits('Ledger');
  const drawings = ['idle', 'thinking', 'working', 'needs-you', 'blocked', 'offline']
    .map((activity) => JSON.stringify(agentFace(traits, activity, 48)));
  assert.equal(new Set(drawings).size, 6, 'two activities draw the same face');
  const blocked = agentFace(traits, 'blocked', 48);
  assert.ok(!parts(blocked).includes('pupil') && flatten(blocked).filter((shape) => shape.part === 'sclera').every((shape) => shape.tag === 'rect'));
  const offline = agentFace(traits, 'offline', 48);
  assert.ok(!parts(offline).includes('pupil') && parts(offline).filter((part) => part === 'line').length === 2);
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
  for (const eyes of AGENT_EYES) {
    for (const activity of ['idle', 'thinking', 'working', 'needs-you']) {
      for (const px of [20, 24, 32, 40, 48, 64]) {
        for (const spacing of [0, 1, 2]) {
          const drawn = flatten(agentFace({ tone: 'blue', body: 'circle', eyes, spacing }, activity, px))
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
  for (const eyes of AGENT_EYES) {
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
