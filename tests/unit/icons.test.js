import assert from 'node:assert/strict';
import test from 'node:test';

import {
  faIconClasses, faNames, faStyles, kitUrl, parseIconSpec
} from '../../src/core/fontawesome.js';
import { icons } from '../../src/core/icons.js';

test('bare names are left for the active provider to interpret', () => {
  assert.deepEqual(parseIconSpec('check'), {
    provider: null, name: 'check', style: null, classes: null
  });
  assert.deepEqual(parseIconSpec('  chevron-down  '), {
    provider: null, name: 'chevron-down', style: null, classes: null
  });
});

test('prefixes select a renderer and a Font Awesome style', () => {
  assert.deepEqual(parseIconSpec('fa:user'), {
    provider: 'fa', name: 'user', style: null, classes: null
  });
  assert.equal(parseIconSpec('fas:user').style, 'solid');
  assert.equal(parseIconSpec('far:user').style, 'regular');
  assert.equal(parseIconSpec('duotone:user').style, 'duotone');
  assert.equal(parseIconSpec('kit:zeyos-notes').style, 'kit');
  assert.equal(parseIconSpec('fak:zeyos-notes').name, 'zeyos-notes');
  assert.deepEqual(parseIconSpec('builtin:check'), {
    provider: 'builtin', name: 'check', style: null, classes: null
  });
  assert.deepEqual(parseIconSpec('zx:check'), {
    provider: 'builtin', name: 'check', style: null, classes: null
  });
});

test('literal class lists pass through untouched', () => {
  assert.deepEqual(parseIconSpec('fa-solid fa-user').classes, ['fa-solid', 'fa-user']);
  assert.deepEqual(parseIconSpec('fa-kit fa-zeyos-notes').classes, ['fa-kit', 'fa-zeyos-notes']);
  assert.deepEqual(parseIconSpec('fa-user').classes, ['fa-user']);
  assert.equal(parseIconSpec('fa-sharp fa-solid fa-user').provider, 'fa');
});

test('an unknown prefix is not mistaken for a style', () => {
  assert.deepEqual(parseIconSpec('mdi:account'), {
    provider: null, name: 'mdi:account', style: null, classes: null
  });
});

test('class building applies style, family, and modifiers', () => {
  assert.deepEqual(faIconClasses('user'), ['fa-solid', 'fa-user']);
  assert.deepEqual(faIconClasses('fa-user'), ['fa-solid', 'fa-user']);
  assert.deepEqual(faIconClasses('user', { style: 'duotone' }), ['fa-duotone', 'fa-user']);
  assert.deepEqual(faIconClasses('user', { family: 'sharp' }), ['fa-sharp', 'fa-solid', 'fa-user']);
  assert.deepEqual(faIconClasses('user', { fixedWidth: true }), ['fa-solid', 'fa-user', 'fa-fw']);
  assert.deepEqual(faIconClasses('zeyos-notes', { style: 'kit' }), ['fa-kit', 'fa-zeyos-notes']);
  assert.deepEqual(faIconClasses('user', { style: 'nonsense' }), ['fa-solid', 'fa-user']);
});

test('built-in glyph names are translated to their Font Awesome counterpart', () => {
  assert.deepEqual(faIconClasses('x'), ['fa-solid', 'fa-xmark']);
  assert.deepEqual(faIconClasses('search'), ['fa-solid', 'fa-magnifying-glass']);
  assert.deepEqual(faIconClasses('warning'), ['fa-solid', 'fa-triangle-exclamation']);
  assert.deepEqual(faIconClasses('x', { translate: false }), ['fa-solid', 'fa-x']);
});

test('every built-in glyph resolves to a Font Awesome name', () => {
  for (const name of Object.keys(icons)) {
    const [, glyph] = faIconClasses(name);
    assert.match(glyph, /^fa-[a-z-]+$/, `${name} produced ${glyph}`);
  }
  for (const source of Object.keys(faNames)) {
    assert.ok(Object.hasOwn(icons, source), `${source} maps a glyph that no longer exists`);
  }
});

test('kit tokens expand to a kit URL and URLs are left alone', () => {
  assert.equal(kitUrl('ae8320b210'), 'https://kit.fontawesome.com/ae8320b210.js');
  assert.equal(
    kitUrl('https://kit.fontawesome.com/ae8320b210.js'),
    'https://kit.fontawesome.com/ae8320b210.js'
  );
  assert.equal(kitUrl('/assets/fontawesome.js'), '/assets/fontawesome.js');
  assert.throws(() => kitUrl('not a token'), RangeError);
});

test('the style and family tables cover the classes Font Awesome ships', () => {
  assert.equal(faStyles.solid, 'fa-solid');
  assert.equal(faStyles.kit, 'fa-kit');
  assert.deepEqual(faIconClasses('user', { family: 'sharp-duotone', style: 'duotone' }), [
    'fa-sharp-duotone', 'fa-duotone', 'fa-user'
  ]);
});
