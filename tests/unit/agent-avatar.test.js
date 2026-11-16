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
