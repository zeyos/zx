import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  AGENT_BODIES, AGENT_GLYPH_EYES, AGENT_MARKS, AGENT_TOKEN_EYES, AGENT_VARIANTS, agentFace, agentTraits
} from '../../src/components/agent-avatar/agent-face.js';
import { AVATAR_TONES, avatarTone } from '../../src/components/avatar/avatar.js';

/** A few seeds pinned to their faces. The generator is contract; see the table-order test. */
const PINNED = {
  'agt-7f3a': { token: { tone: 'violet', body: 'drop', eyes: 'oval', spacing: 0 }, glyph: { eyes: 'chevron', mark: 'cheek' } },
  Ledger: { token: { tone: 'orange', body: 'hexagon', eyes: 'square', spacing: 0 }, glyph: { eyes: 'oval', mark: 'line' } },
  Nova: { token: { tone: 'violet', body: 'hexagon', eyes: 'round', spacing: 2 }, glyph: { eyes: 'moon', mark: 'line' } }
};

/** Every shape in a drawing, depth first. */
const flatten = (shapes) => shapes.flatMap((shape) => [shape, ...flatten(shape.children ?? [])]);
const parts = (shapes) => flatten(shapes).map((shape) => shape.part);
const seeds = (count) => Array.from({ length: count }, (_, index) => `agent-${index}`);

test('the trait tables and their order are fixed', () => {
  assert.deepEqual([...AGENT_VARIANTS], ['token', 'glyph']);
  assert.deepEqual([...AGENT_BODIES], ['circle', 'squircle', 'hexagon', 'triangle', 'drop', 'pill', 'clover', 'dome']);
  assert.deepEqual([...AGENT_TOKEN_EYES], ['round', 'oval', 'square']);
  assert.deepEqual([...AGENT_GLYPH_EYES], ['round', 'pill', 'square', 'moon', 'chevron', 'oval']);
  assert.deepEqual([...AGENT_MARKS], ['none', 'line', 'tick', 'cheek']);
});

test('pinned seeds keep their faces', () => {
  for (const [seed, faces] of Object.entries(PINNED)) {
    assert.deepEqual(agentTraits(seed), { variant: 'token', mark: null, ...faces.token }, seed);
    const glyph = agentTraits(seed, { variant: 'glyph' });
    assert.deepEqual(glyph, { variant: 'glyph', tone: faces.token.tone, body: null, spacing: faces.token.spacing, ...faces.glyph }, seed);
  }
});

test('the tone is avatarTone of the seed, so a face and an initials tile agree', () => {
  for (const seed of ['Ada Lovelace', 'agt-19c2', 'Research agent', '山田 太郎']) {
    assert.equal(agentTraits(seed).tone, avatarTone(seed), seed);
    assert.equal(agentTraits(seed, { variant: 'glyph' }).tone, avatarTone(seed), seed);
  }
  assert.equal(agentTraits('').tone, 'slate');
});

test('traits ignore case, outer whitespace and Unicode composition', () => {
  assert.deepEqual(agentTraits('  Ledger '), agentTraits('ledger'));
  assert.deepEqual(agentTraits('Amélie'), agentTraits('Amélie'));
});

test('overrides fix one trait and leave the rest derived; foreign ones are ignored', () => {
  const derived = agentTraits('Ledger');
  const fixed = agentTraits('Ledger', { tone: 'teal', body: 'hexagon', eyes: 'square' });
  assert.deepEqual(fixed, { ...derived, tone: 'teal', body: 'hexagon', eyes: 'square' });
  // A glyph has no body and draws no pupils-only eye shapes outside its table.
  assert.equal(agentTraits('Ledger', { variant: 'glyph', body: 'hexagon' }).body, null);
  assert.equal(agentTraits('Ledger', { eyes: 'chevron' }).eyes, derived.eyes, 'a token cannot take a glyph eye');
  assert.equal(agentTraits('Ledger', { tone: 'chartreuse', body: 'star', variant: 'cubist' }).tone, derived.tone);
  assert.equal(agentTraits('Ledger', { variant: 'cubist' }).variant, 'token');
  assert.ok(AVATAR_TONES.includes(agentTraits('Ledger', { tone: 'slate' }).tone));
});

test('every trait value is reachable and traits do not follow the tone', () => {
  const all = seeds(2000).map((seed) => agentTraits(seed));
  assert.deepEqual(new Set(all.map((traits) => traits.body)), new Set(AGENT_BODIES));
  assert.deepEqual(new Set(all.map((traits) => traits.eyes)), new Set(AGENT_TOKEN_EYES));
  assert.deepEqual(new Set(all.map((traits) => traits.spacing)), new Set([0, 1, 2]));
  const glyphs = seeds(2000).map((seed) => agentTraits(seed, { variant: 'glyph' }));
  assert.deepEqual(new Set(glyphs.map((traits) => traits.eyes)), new Set(AGENT_GLYPH_EYES));
  assert.deepEqual(new Set(glyphs.map((traits) => traits.mark)), new Set(AGENT_MARKS));
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

test('a token draws its body and two eyes with pupils, and drops the pupils below 20px', () => {
  const traits = agentTraits('Ledger');
  const face = agentFace(traits, 'idle', 32);
  assert.equal(parts(face).filter((part) => part === 'body').length, 1);
  assert.equal(parts(face).filter((part) => part === 'eye').length, 2);
  assert.equal(parts(face).filter((part) => part === 'pupil').length, 2);
  assert.equal(parts(agentFace(traits, 'idle', 20)).filter((part) => part === 'pupil').length, 2);
  assert.equal(parts(agentFace(traits, 'idle', 16)).filter((part) => part === 'pupil').length, 0);
  assert.deepEqual(agentFace(traits, null, 32), face, 'no activity draws the idle face');
  assert.deepEqual(agentFace(traits, 'dancing', 32), face, 'an unknown activity draws the idle face');
});

test('a glyph draws no body, and its mark only above 24px', () => {
  const seed = seeds(200).find((candidate) => agentTraits(candidate, { variant: 'glyph' }).mark === 'cheek');
  const traits = agentTraits(seed, { variant: 'glyph' });
  assert.ok(!parts(agentFace(traits, 'idle', 40)).includes('body'));
  assert.ok(parts(agentFace(traits, 'idle', 40)).includes('mark-solid'));
  assert.ok(!parts(agentFace(traits, 'idle', 24)).includes('mark-solid'));
});

test('each activity has its own static expression', () => {
  const traits = agentTraits('Ledger');
  const drawings = Object.fromEntries(['idle', 'thinking', 'working', 'needs-you', 'blocked', 'offline']
    .map((activity) => [activity, JSON.stringify(agentFace(traits, activity, 48))]));
  assert.equal(new Set(Object.values(drawings)).size, 6, 'two activities draw the same face');
  const blocked = agentFace(traits, 'blocked', 48);
  assert.ok(!parts(blocked).includes('pupil') && flatten(blocked).filter((shape) => shape.part === 'sclera').every((shape) => shape.tag === 'rect'));
  const offline = agentFace(traits, 'offline', 48);
  assert.ok(!parts(offline).includes('pupil') && parts(offline).filter((part) => part === 'line').length === 2);
});

test('the drawing is a copy: changing it never changes the next one', () => {
  const traits = agentTraits('Ledger');
  const first = agentFace(traits, 'idle', 48);
  flatten(first).forEach((shape) => { shape.attrs.mutated = 1; });
  assert.ok(flatten(agentFace(traits, 'idle', 48)).every((shape) => !('mutated' in shape.attrs)));
});

test('every tone has its colour roles in the stylesheet', () => {
  const css = readFileSync(new URL('../../src/components/agent-avatar/agent-avatar.css', import.meta.url), 'utf8');
  for (const tone of AVATAR_TONES) {
    for (const role of ['solid', 'bg', 'fg']) {
      assert.match(css, new RegExp(`\\[data-tone="${tone}"\\][^}]*--zx-color-tone-${tone}-${role}`), `${tone} ${role}`);
    }
  }
});
