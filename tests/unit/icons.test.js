import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  faIconClasses, faNames, faStyles, kitUrl, parseIconSpec
} from '../../src/core/fontawesome.js';
import {
  configureIcons, icon, iconNames, icons, registerIcons, useBuiltinIcons, useFontAwesome
} from '../../src/core/icons.js';

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

/*
 * An unknown name used to throw `RangeError`, which meant one unconfigured name — and icon names
 * routinely come from a server — took out the whole screen it appeared on. It now renders a
 * placeholder and reports itself once. These tests hold that line, and hold the three paths that
 * must NOT have changed with it: the bundled glyphs, the aliases, and everything Font Awesome,
 * where a name is resolved in the browser at render time and is never "unknown" here.
 */

test('an unknown name renders a placeholder instead of throwing', () => {
  withDocument(() => {
    const element = quietly(() => icon('no-such-glyph'));
    assert.ok(element, 'icon() returned nothing for an unknown name');
    assert.equal(element.tagName, 'svg');
    assert.equal(element.getAttribute('class'), 'zx-icon');
    assert.equal(element.getAttribute('data-zx-icon-missing'), 'no-such-glyph');
    assert.equal(element.children.length, 0, 'the placeholder should carry no path');
  });
});

test('the placeholder occupies exactly the box the real glyph would have', () => {
  withDocument(() => {
    const options = { size: 24, class: 'zx-button__icon' };
    const real = icon('check', options);
    const placeholder = quietly(() => icon('no-such-glyph-sized', options));
    for (const attribute of [
      'class', 'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'focusable'
    ]) {
      assert.equal(placeholder.getAttribute(attribute), real.getAttribute(attribute),
        `placeholder ${attribute} differs from a real glyph's`);
    }
  });
});

test('the placeholder keeps the accessibility treatment the caller asked for', () => {
  withDocument(() => {
    const decorative = quietly(() => icon('no-such-glyph-decorative'));
    assert.equal(decorative.getAttribute('aria-hidden'), 'true');
    assert.equal(decorative.getAttribute('role'), null);

    const labelled = quietly(() => icon('no-such-glyph-labelled', { label: 'Delete' }));
    assert.equal(labelled.getAttribute('role'), 'img');
    assert.equal(labelled.getAttribute('aria-label'), 'Delete');
    assert.equal(labelled.getAttribute('aria-hidden'), null);
  });
});

test('a missing name is reported once, however many rows ask for it', () => {
  withDocument(() => {
    const warnings = recordWarnings(() => {
      for (let index = 0; index < 400; index += 1) icon('warned-once');
      icon('warned-separately');
      icon('warned-once');
    });
    assert.equal(warnings.length, 2, 'each distinct missing name should warn exactly once');
    assert.match(warnings[0], /warned-once/);
    assert.match(warnings[1], /warned-separately/);
  });
});

test('strict: true keeps the RangeError, and stays silent while doing it', () => {
  withDocument(() => {
    const warnings = recordWarnings(() => {
      assert.throws(() => icon('no-such-glyph-strict', { strict: true }), RangeError);
      assert.throws(() => icon('builtin:no-such-glyph-strict', { strict: true }), RangeError);
    });
    assert.deepEqual(warnings, [], 'strict callers handle the failure themselves');
    assert.doesNotThrow(() => icon('check', { strict: true }));
  });
});

test('every name the bundled set carries still resolves to its glyph', () => {
  withDocument(() => {
    const warnings = recordWarnings(() => {
      for (const name of iconNames()) {
        const element = icon(name);
        assert.equal(element.children.length, 1, `${name} did not render a path`);
        assert.equal(element.getAttribute('data-zx-icon-missing'), null,
          `${name} fell through to the placeholder`);
        assert.ok(element.getAttribute('viewBox'), `${name} lost its view box`);
      }
      // Legacy gx aliases and glyphs added at runtime resolve the same way.
      for (const alias of ['settings', 'clear', 'checked', 'question', 'range', 'fields']) {
        assert.equal(icon(alias).children.length, 1, `alias ${alias} did not render a path`);
      }
      registerIcons({ 'zeyos-ledger': ['0 0 16 16', 'M0 0h16v16H0z'] });
      assert.equal(icon('zeyos-ledger').getAttribute('viewBox'), '0 0 16 16');
    });
    assert.deepEqual(warnings, [], 'a resolvable name must never warn');
  });
});

test('builtin: routes to the bundled set and placeholders rather than throwing', () => {
  withDocument(() => {
    assert.equal(icon('builtin:check').children.length, 1);
    assert.equal(icon('zx:check').children.length, 1);
    const placeholder = quietly(() => icon('builtin:no-such-glyph-prefixed'));
    assert.equal(placeholder.getAttribute('data-zx-icon-missing'), 'no-such-glyph-prefixed');
    assert.equal(placeholder.getAttribute('class'), 'zx-icon');
  });
});

/*
 * The important half of the change: a kit resolves names in the browser, so a name the bundled
 * glyphs do not have is perfectly resolvable under one. Warning here would put a console line
 * on every icon in every application that loads a kit.
 */
test('Font Awesome names are never unknown and never warn', () => {
  withDocument(() => {
    const warnings = recordWarnings(() => {
      assert.equal(icon('fa:truck-fast').className, 'zx-icon fa-solid fa-truck-fast');
      assert.equal(icon('duotone:truck-fast').className, 'zx-icon fa-duotone fa-truck-fast');
      assert.equal(icon('kit:zeyos-notes').className, 'zx-icon fa-kit fa-zeyos-notes');
      assert.equal(icon('fa-solid fa-user').className, 'zx-icon fa-solid fa-user');
      assert.equal(icon('fa-kit fa-zeyos-notes').className, 'zx-icon fa-kit fa-zeyos-notes');
    });
    assert.deepEqual(warnings, [], 'an explicitly Font Awesome name must not warn');
  });
});

test('a bare name under a loaded kit renders through it without warning', () => {
  withDocument(() => {
    const warnings = recordWarnings(() => {
      // The state loadFontAwesome() leaves behind, without fetching the kit script.
      configureIcons({ kit: 'https://kit.fontawesome.com/ae8320b210.js' });
      useFontAwesome();
      assert.equal(icon('truck-fast').className, 'zx-icon fa-solid fa-truck-fast');
      assert.equal(icon('zeyos-notes', { style: 'kit' }).className, 'zx-icon fa-kit fa-zeyos-notes');
      assert.equal(icon('x').className, 'zx-icon fa-solid fa-xmark');
      // builtin: still opts one icon back out of the kit, and that one can still be missing.
      assert.equal(icon('builtin:check').tagName, 'svg');
    });
    assert.deepEqual(warnings, [], 'the kit resolves names at render time — nothing is unknown');
    useBuiltinIcons();
    configureIcons({ kit: null });
  });
});

/*
 * The bundled set is an outline set (Lucide, 24-unit grid). These hold the rendering contract —
 * stroke, not fill, on the root so the path inherits it — and the compatibility promise around it:
 * every name the set has ever carried still resolves, and `[viewBox, path]` pairs an application
 * registered (Font Awesome paths, typically) keep rendering filled.
 */

/** Every name the bundled set carried before it became an outline set. None may disappear. */
const BUILTIN_NAMES = [
  'arrow-up-wide-short', 'arrow-down-wide-short', 'chevron-down', 'chevron-up', 'chevron-left',
  'chevron-right', 'check', 'x', 'plus', 'minus', 'search', 'calendar', 'clock', 'trash', 'gear',
  'eye', 'lock', 'reload', 'list', 'filter', 'dots', 'info', 'warning', 'error', 'success',
  'upload', 'drag', 'star', 'heart', 'tag', 'folder', 'folder-open', 'file', 'copy', 'square',
  'code', 'book'
];

test('every historical built-in name is still bundled, as an outline in the 24-unit box', () => {
  for (const name of BUILTIN_NAMES) {
    assert.ok(Object.hasOwn(icons, name), `${name} is no longer bundled`);
    const [viewBox, path, paint] = icons[name];
    assert.equal(viewBox, '0 0 24 24', `${name} left the shared grid`);
    assert.equal(paint, 'stroke', `${name} is not an outline glyph`);
    // Each converted subpath opens with an absolute moveto; a leading relative one would be read
    // from the previous subpath's end point once the elements are joined into one path.
    assert.match(path, /^M/, `${name} does not open with an absolute moveto`);
  }
  assert.ok(Object.isFrozen(icons), 'the bundled table is shared and must stay frozen');
});

test('bundled glyphs render as strokes: no fill, currentColor, round caps and joins', () => {
  withDocument(() => {
    for (const name of BUILTIN_NAMES) {
      const element = icon(name);
      assert.equal(element.tagName, 'svg');
      assert.equal(element.getAttribute('class'), 'zx-icon');
      assert.equal(element.getAttribute('viewBox'), '0 0 24 24');
      assert.equal(element.getAttribute('fill'), 'none', `${name} is filled`);
      assert.equal(element.getAttribute('stroke'), 'currentColor', `${name} has no stroke`);
      assert.equal(element.getAttribute('stroke-width'), '1.75', `${name} stroke width`);
      assert.equal(element.getAttribute('stroke-linecap'), 'round');
      assert.equal(element.getAttribute('stroke-linejoin'), 'round');
      assert.equal(element.getAttribute('width'), '16', 'the default size stays 16px');
      // The paint lives on the root alone, so CSS on .zx-icon restyles the whole glyph.
      const [path] = element.children;
      assert.equal(path.tagName, 'path');
      assert.equal(path.getAttribute('d'), icons[name][1]);
      assert.equal(path.getAttribute('fill'), null);
      assert.equal(path.getAttribute('stroke'), null);
    }
  });
});

test('small outlines keep a one-pixel line instead of thinning with the box', () => {
  withDocument(() => {
    const width = (size) => Number(icon('check', { size }).getAttribute('stroke-width'));
    assert.equal(width(16), 1.75);
    assert.equal(width(24), 1.75, 'the width is proportional at and above the default');
    assert.equal(width(48), 1.75);
    assert.equal(width(12), 2, '12px: 2 of 24 units is one pixel');
    assert.equal(width(8), 3, '8px: 3 of 24 units is one pixel');
    assert.equal(width('12px'), 2, 'a pixel string is measured like a number');
    assert.equal(width('1.25rem'), 1.75, 'a length that cannot be measured keeps the proportion');
    for (const size of [7, 8, 11, 12, 13, 14, 15, 16, 18, 20, 24]) {
      assert.ok(width(size) * size / 24 >= 0.999, `${size}px renders a line under one pixel`);
    }
  });
});

test('registered [viewBox, path] pairs keep rendering filled', () => {
  withDocument(() => {
    registerIcons({
      'solid-rocket-pair': ['0 0 512 512', 'M156.6 384.9L125.7 354z'],
      'solid-rocket-explicit': ['0 0 512 512', 'M156.6 384.9L125.7 354z', 'fill']
    });
    for (const name of ['solid-rocket-pair', 'solid-rocket-explicit']) {
      const element = icon(name);
      assert.equal(element.getAttribute('viewBox'), '0 0 512 512');
      assert.equal(element.getAttribute('fill'), 'currentColor', `${name} lost its fill`);
      assert.equal(element.getAttribute('stroke'), null, `${name} gained a stroke`);
      assert.equal(element.getAttribute('stroke-width'), null);
      assert.equal(element.children[0].getAttribute('d'), 'M156.6 384.9L125.7 354z');
    }
  });
});

test('registerIcons takes outline glyphs as [viewBox, path, \'stroke\']', () => {
  withDocument(() => {
    registerIcons({
      'lucide-anchor': ['0 0 24 24', 'M12 6v16M5 12H2a10 10 0 0 0 20 0h-3', 'stroke'],
      'outline-on-48': ['0 0 48 48', 'M8 8h32v32H8z', 'stroke']
    });
    const anchor = icon('lucide-anchor');
    assert.equal(anchor.getAttribute('fill'), 'none');
    assert.equal(anchor.getAttribute('stroke'), 'currentColor');
    assert.equal(anchor.getAttribute('stroke-width'), '1.75',
      'a 24-unit outline set renders exactly like the bundled glyphs');
    assert.equal(anchor.getAttribute('stroke-linecap'), 'round');
    assert.equal(icon('outline-on-48').getAttribute('stroke-width'), '3.5',
      'another grid gets the same visual weight, scaled to its view box');
    assert.ok(iconNames().includes('lucide-anchor'));
    // A registered name replaces a bundled one, in either paint.
    registerIcons({ 'star-replaced-test': icons.star });
    assert.equal(icon('star-replaced-test').getAttribute('fill'), 'none',
      'a bundled entry round-trips through registerIcons with its paint');
  });
});

test('registerIcons rejects entries that are neither a pair nor a paint triple', () => {
  assert.throws(() => registerIcons({ bad: ['0 0 24 24'] }), TypeError);
  assert.throws(() => registerIcons({ bad: 'M0 0h24' }), TypeError);
  assert.throws(() => registerIcons({ bad: ['0 0 24 24', 'M0 0h24', 'outline'] }), TypeError);
  assert.throws(() => registerIcons({ bad: ['0 0 24 24', 'M0 0h24', 'stroke', 2] }), TypeError);
  assert.equal(iconNames().includes('bad'), false, 'a rejected entry is not half-registered');
});

/*
 * The application layouts were written against Font Awesome names. Their pack maps each to a Lucide
 * outline under the same name, so every literal name a template asks for must still resolve —
 * through the bundled set, a legacy alias, or the pack.
 */
test('every icon name the layout templates use resolves to an outline glyph', async () => {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const { LAYOUT_ICONS } = await import('../../website/layouts/layout-icons.js');
  for (const [name, entry] of Object.entries(LAYOUT_ICONS)) {
    assert.equal(entry.length, 3, `${name} is not an outline triple`);
    assert.equal(entry[0], '0 0 24 24', `${name} left the shared grid`);
    assert.equal(entry[2], 'stroke', `${name} is not an outline glyph`);
    assert.match(entry[1], /^M/, `${name} does not open with an absolute moveto`);
    assert.equal(Object.hasOwn(icons, name), false, `${name} shadows a bundled glyph`);
  }

  const used = new Map();
  const directory = join(root, 'website/layouts');
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.js') || file === 'layout-icons.js') continue;
    const source = await readFile(join(directory, file), 'utf8');
    const patterns = [
      /\b(?:icon|iconButton|iconTile)\(\s*'([a-z0-9-]+)'/g,
      /\b(?:icon|glyph):\s*'([a-z0-9-]+)'/g
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) used.set(match[1], file);
    }
  }
  assert.ok(used.size > 80, `expected the templates to use many icons, found ${used.size}`);
  const aliases = ['settings', 'clear', 'checked', 'question', 'range', 'fields'];
  const unresolved = [...used].filter(([name]) => !Object.hasOwn(icons, name)
    && !Object.hasOwn(LAYOUT_ICONS, name) && !aliases.includes(name));
  assert.deepEqual(unresolved, [], 'template icon names without a glyph');
});

/** Swallows the placeholder warning of a call whose warning is not what is under test. */
function quietly(run) {
  let result;
  recordWarnings(() => { result = run(); });
  return result;
}

/** Collects the `console.warn` lines a run produces. @param {() => void} run @returns {string[]} */
function recordWarnings(run) {
  const previous = console.warn;
  /** @type {string[]} */
  const warnings = [];
  console.warn = (...args) => { warnings.push(args.map(String).join(' ')); };
  try {
    run();
  } finally {
    console.warn = previous;
  }
  return warnings;
}

/** @param {() => void} run @returns {void} */
function withDocument(run) {
  const previous = globalThis.document;
  globalThis.document = /** @type {any} */ (new FakeDocument());
  try {
    run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

/* Enough of a document for the icon layer: element creation and the attribute surface it writes. */
class FakeElement {
  /** @param {string} tag */
  constructor(tag) {
    this.tagName = tag;
    this.className = '';
    /** @type {FakeElement[]} */
    this.children = [];
    this.style = {};
    /** @type {Map<string, string>} */
    this.attributeMap = new Map();
  }

  /** @param {string} name @param {unknown} value @returns {void} */
  setAttribute(name, value) {
    if (name === 'class') this.className = String(value);
    this.attributeMap.set(name, String(value));
  }

  /** @param {string} name @returns {string|null} */
  getAttribute(name) {
    if (name === 'class') return this.className || null;
    return this.attributeMap.get(name) ?? null;
  }

  /** @param {...FakeElement} nodes @returns {void} */
  append(...nodes) {
    this.children.push(...nodes);
  }
}

class FakeDocument {
  /** @param {string} tag @returns {FakeElement} */
  createElement(tag) {
    return new FakeElement(tag);
  }

  /** @param {string} _namespace @param {string} tag @returns {FakeElement} */
  createElementNS(_namespace, tag) {
    return new FakeElement(tag);
  }
}
