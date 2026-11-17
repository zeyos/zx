import assert from 'node:assert/strict';
import test from 'node:test';

import { configureIcons, getIconConfig } from '../../src/core/icons.js';
import { ZEYOS_ICON_KIT, moduleChip, moduleIcon, useZeyosIcons, zeyosAppIcon } from '../../src/zeyos/icons.js';
import { moduleInfo, moduleKeys } from '../../src/zeyos/modules.js';

/*
 * The ZeyOS icon layer: loading the ZeyOS Font Awesome kit, the module glyph, and the module's
 * application identity. Rendering runs against a small document stand-in; the kit "loads" when a
 * test fires the injected script's load event.
 */

/* ------------------------------------------------------------------- useZeyosIcons -- */

test('useZeyosIcons injects the ZeyOS kit once and switches icons to Font Awesome', async () => {
  await withDocument(async (document) => {
    const loading = useZeyosIcons();
    assert.equal(document.injected.length, 1);
    const [script] = document.injected;
    assert.equal(script.src, ZEYOS_ICON_KIT);
    assert.equal(script.async, true);
    script.fire('load');
    const config = await loading;
    assert.equal(config.provider, 'fontawesome');
    assert.equal(config.kit, ZEYOS_ICON_KIT);

    // Repeat calls reuse the first load: no second script, and they resolve at once.
    const again = await useZeyosIcons();
    assert.equal(document.injected.length, 1);
    assert.equal(again.provider, 'fontawesome');
  });
});

test('useZeyosIcons passes a default style through and keeps the ZeyOS kit', async () => {
  await withDocument(async (document) => {
    const config = await settle(document, useZeyosIcons({ style: 'duotone', fixedWidth: true }));
    assert.equal(config.style, 'duotone');
    assert.equal(config.fixedWidth, true);
    assert.equal(config.kit, ZEYOS_ICON_KIT);
  });
});

test('useZeyosIcons loads a different kit when one is named', async () => {
  await withDocument(async (document) => {
    const loading = useZeyosIcons({ kit: 'abc1234567' });
    assert.equal(document.injected.at(-1)?.src, 'https://kit.fontawesome.com/abc1234567.js');
    document.injected.at(-1)?.fire('load');
    assert.equal((await loading).kit, 'https://kit.fontawesome.com/abc1234567.js');
  });
});

test('useZeyosIcons treats a kit passed as undefined as no kit passed', async () => {
  await withDocument(async (document) => {
    // A wrapper forwarding `{ kit: settings.kit }` with nothing configured means "the default".
    const config = await settle(document, useZeyosIcons({ kit: undefined, style: 'regular' }));
    assert.equal(config.kit, ZEYOS_ICON_KIT);
    assert.equal(config.style, 'regular');
    // A null options object is as good as none.
    assert.equal((await settle(document, useZeyosIcons(/** @type {any} */ (null)))).kit, ZEYOS_ICON_KIT);
  });
});

test('useZeyosIcons with activate: false loads the kit without switching the renderer', async () => {
  await withDocument(async (document) => {
    const config = await settle(document, useZeyosIcons({ activate: false }));
    assert.equal(config.provider, 'builtin');
    assert.equal(config.kit, ZEYOS_ICON_KIT);
  });
});

test('useZeyosIcons rejects on a malformed kit and when the kit fails to load', async () => {
  await withDocument(async (document) => {
    await assert.rejects(() => useZeyosIcons({ kit: 'not a token' }), RangeError);
    const failing = useZeyosIcons({ kit: 'deadbeef00' });
    document.injected.at(-1)?.fire('error');
    await assert.rejects(failing, /failed to load/);
  });
});

/* ---------------------------------------------------------------------- moduleIcon -- */

test('moduleIcon renders the kit glyph of a module, decorative by default', async () => {
  await withDocument(async () => {
    const element = moduleIcon('notes');
    assert.equal(element.tagName, 'I');
    assert.deepEqual(classes(element), ['zx-icon', 'fa-kit', 'fa-zeyos-notes']);
    assert.equal(element.getAttribute('aria-hidden'), 'true');
    assert.equal(element.getAttribute('role'), null);
    assert.equal(element.style.fontSize, '16px');
  });
});

test('moduleIcon accepts module, entity, and resource names in any spelling', async () => {
  await withDocument(async () => {
    assert.ok(classes(moduleIcon('transactions.billing')).includes('fa-zeyos-transactions-billing'));
    assert.ok(classes(moduleIcon('invoices')).includes('fa-zeyos-transactions-billing'), 'API resource alias');
    assert.ok(classes(moduleIcon('  Notes ')).includes('fa-zeyos-notes'), 'case and whitespace');
    assert.ok(classes(moduleIcon('transactions_billing')).includes('fa-zeyos-transactions-billing'));
  });
});

test('moduleIcon falls back to the ZeyOS default glyph for unknown and empty names', async () => {
  await withDocument(async () => {
    for (const name of ['no-such-module', '', '   ', null, undefined, 'constructor', '__proto__']) {
      assert.deepEqual(classes(moduleIcon(/** @type {any} */ (name))), ['zx-icon', 'fa-kit', 'fa-zeyos-default'],
        `${String(name)} should fall back to the default glyph`);
    }
  });
});

test('moduleIcon with standard renders the stock Font Awesome fallback', async () => {
  await withDocument(async () => {
    assert.deepEqual(classes(moduleIcon('notes', { standard: true })), ['zx-icon', 'fa-solid', 'fa-note-sticky']);
    assert.deepEqual(classes(moduleIcon('nope', { standard: true })), ['zx-icon', 'fa-solid', 'fa-cube']);
  });
});

test('every module renders its own kit glyph and its own stock fallback', async () => {
  await withDocument(async () => {
    for (const key of moduleKeys()) {
      const info = moduleInfo(key);
      assert.deepEqual(classes(moduleIcon(key)), ['zx-icon', 'fa-kit', `fa-${info.icon}`], `${key} kit glyph`);
      // No stock name may be rewritten on the way, the way a bundled glyph name would be.
      assert.deepEqual(classes(moduleIcon(key, { standard: true })), ['zx-icon', 'fa-solid', `fa-${info.fa}`],
        `${key} stock fallback`);
    }
  });
});

test('moduleIcon forwards label, size, and class, and keeps standard to itself', async () => {
  await withDocument(async () => {
    const element = moduleIcon('tickets', { label: 'Tickets', size: 24, class: ['nav-icon', 'is-big'] });
    assert.equal(element.getAttribute('role'), 'img');
    assert.equal(element.getAttribute('aria-label'), 'Tickets');
    assert.equal(element.getAttribute('aria-hidden'), null);
    assert.equal(element.style.fontSize, '24px');
    assert.deepEqual(classes(element), ['zx-icon', 'fa-kit', 'fa-zeyos-tickets', 'nav-icon', 'is-big']);
    assert.equal(moduleIcon('tickets', { size: '2em' }).style.fontSize, '2em');
    const standard = moduleIcon('tickets', { standard: true });
    assert.equal(standard.getAttribute('standard'), null);
  });
});

test('moduleIcon leaves the options object it was given untouched', async () => {
  await withDocument(async () => {
    const options = Object.freeze({ standard: true, label: 'Notes' });
    assert.doesNotThrow(() => moduleIcon('notes', options));
  });
});

/* ---------------------------------------------------------------- zeyosAppIcon -- */

test('zeyosAppIcon draws the module glyph in a circular vessel on the module colour', async () => {
  await withDocument(async () => {
    const element = zeyosAppIcon('notes');
    assert.equal(element.dataset.shape, 'circle');
    assert.equal(element.dataset.module, 'notes');
    assert.equal(element.dataset.glass, 'subtle');
    assert.ok(classes(element).includes('zx-app-icon'));
    assert.ok(classes(element).includes('zx-module-icon'));
    assert.equal(element.style.getPropertyValue('--zx-module-color'), '#008853');
    assert.equal(element.style.getPropertyValue('--zx-app-icon-color'), '#008853');
    assert.equal(element.style.getPropertyValue('--zx-app-icon-size'), '24px');
    assert.equal(element.style.getPropertyValue('--zx-app-icon-glyph'), 'var(--zx-color-app-icon-glyph)');
    assert.equal(element.getAttribute('aria-hidden'), 'true', 'decorative unless labelled');
    assert.equal(element.title, '');

    const glyph = find(element, (node) => classes(node).includes('fa-zeyos-notes'));
    assert.ok(glyph, 'the kit glyph is inside the vessel');
    assert.equal(glyph.style.fontSize, '1em', 'AppIcon sizes the glyph, not the icon element');
  });
});

test('zeyosAppIcon keeps the module key of an alias and falls back for unknown names', async () => {
  await withDocument(async () => {
    const invoice = zeyosAppIcon('invoices');
    assert.equal(invoice.dataset.module, 'transactions-billing');
    assert.equal(invoice.style.getPropertyValue('--zx-module-color'), moduleInfo('transactions-billing').color);
    const unknown = zeyosAppIcon('a-weblet-nobody-registered');
    assert.equal(unknown.dataset.module, 'default');
    assert.equal(unknown.style.getPropertyValue('--zx-module-color'), moduleInfo('default').color);
  });
});

test('zeyosAppIcon keeps its circle when a wrapper forwards shape as undefined', async () => {
  await withDocument(async () => {
    assert.equal(zeyosAppIcon('notes', { shape: undefined }).dataset.shape, 'circle');
    assert.equal(zeyosAppIcon('notes', null).dataset.shape, 'circle');
  });
});

test('zeyosAppIcon takes AppIcon options, a tile shape included', async () => {
  await withDocument(async () => {
    const element = zeyosAppIcon('tickets', {
      shape: 'tile', size: 40, label: 'Tickets', title: true, badge: 3, selected: true, glass: false,
      class: 'rail-item'
    });
    assert.equal(element.dataset.shape, 'tile');
    assert.equal(element.dataset.glass, 'none');
    assert.equal(element.style.getPropertyValue('--zx-app-icon-size'), '40px');
    assert.equal(element.getAttribute('role'), 'img');
    assert.equal(element.getAttribute('aria-label'), 'Tickets');
    assert.equal(element.title, 'Tickets');
    assert.equal(element.hasAttribute('data-selected'), true);
    assert.ok(classes(element).includes('rail-item'));
    const badge = find(element, (node) => classes(node).includes('zx-app-icon__badge'));
    assert.equal(badge?.textContent, '3');
  });
});

test('zeyosAppIcon uses a valid colour override and ignores an unsafe one', async () => {
  await withDocument(async () => {
    const forked = zeyosAppIcon('notes', { color: '#123456' });
    assert.equal(forked.style.getPropertyValue('--zx-module-color'), '#123456');
    assert.equal(forked.style.getPropertyValue('--zx-app-icon-color'), '#123456');
    for (const color of ['url(https://tracker.example/x.png)', 'red; background: blue', '', 42]) {
      const element = zeyosAppIcon('notes', { color: /** @type {any} */ (color) });
      assert.equal(element.style.getPropertyValue('--zx-module-color'), '#008853', `${String(color)} is not a colour`);
    }
  });
});

test('zeyosAppIcon renders the standard glyph or an explicit icon override', async () => {
  await withDocument(async (document) => {
    const standard = zeyosAppIcon('notes', { standard: true });
    assert.ok(find(standard, (node) => classes(node).includes('fa-note-sticky')));
    const custom = document.createElement('b');
    const overridden = zeyosAppIcon('notes', { icon: custom });
    assert.ok(find(overridden, (node) => node === custom), 'the override replaces the module glyph');
    assert.equal(find(overridden, (node) => classes(node).includes('fa-zeyos-notes')), null);
  });
});

test('moduleChip stays a tile, the compact shape for records and entity lists', async () => {
  await withDocument(async () => {
    assert.equal(moduleChip('notes').dataset.shape, 'tile');
    assert.equal(moduleChip('notes', { shape: 'circle' }).dataset.shape, 'circle');
  });
});

/* ------------------------------------------------------------------------- helpers -- */

/**
 * Resolves a pending kit load by firing the newest injected script's load event, if one was
 * injected for it, and returns the configuration it settles with.
 * @param {FakeDocument} document
 * @param {Promise<any>} loading
 * @returns {Promise<any>}
 */
async function settle(document, loading) {
  document.injected.at(-1)?.fire('load');
  return loading;
}

/** @param {any} element @returns {string[]} */
function classes(element) {
  return String(element?.className ?? '').split(/\s+/).filter(Boolean);
}

/** @param {any} root @param {(node: any) => boolean} predicate @returns {any} */
function find(root, predicate) {
  for (const child of root.children ?? []) {
    if (predicate(child)) return child;
    const nested = find(child, predicate);
    if (nested) return nested;
  }
  return null;
}

/**
 * Runs `run` with a fresh document stand-in, restoring the document and the icon configuration
 * afterwards so every test starts from the built-in provider.
 * @param {(document: FakeDocument) => Promise<void>} run
 */
async function withDocument(run) {
  const previous = globalThis.document;
  const icons = getIconConfig();
  const document = new FakeDocument();
  globalThis.document = /** @type {any} */ (document);
  try {
    await run(document);
  } finally {
    configureIcons(icons);
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

/* Enough of a document for icons, AppIcon, and kit loading. */
class FakeElement {
  /** @param {string} tag */
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.title = '';
    /** @type {any[]} */
    this.children = [];
    /** @type {Record<string, string>} */
    this.dataset = {};
    /** @type {Map<string, string>} */
    this.attributeMap = new Map();
    /** @type {Record<string, Function[]>} */
    this.listeners = {};
    /** @type {Map<string, string>} */
    const properties = new Map();
    this.style = {
      fontSize: '',
      /** @param {string} name @param {string} value */
      setProperty: (name, value) => { properties.set(name, String(value)); },
      /** @param {string} name */
      removeProperty: (name) => { properties.delete(name); },
      /** @param {string} name */
      getPropertyValue: (name) => properties.get(name) ?? ''
    };
    const element = this;
    this.classList = {
      /** @param {string} name */
      contains: (name) => classes(element).includes(name),
      /** @param {...string} names */
      add: (...names) => { element.className = [...new Set([...classes(element), ...names])].join(' '); },
      /** @param {...string} names */
      remove: (...names) => { element.className = classes(element).filter((name) => !names.includes(name)).join(' '); }
    };
  }

  /** @param {string} name @param {unknown} value */
  setAttribute(name, value) {
    if (name.startsWith('data-')) this.dataset[name.slice(5)] = String(value);
    else this.attributeMap.set(name, String(value));
  }

  /** @param {string} name @returns {string|null} */
  getAttribute(name) {
    if (name.startsWith('data-')) return this.dataset[name.slice(5)] ?? null;
    return this.attributeMap.get(name) ?? null;
  }

  /** @param {string} name */
  removeAttribute(name) {
    if (name.startsWith('data-')) delete this.dataset[name.slice(5)];
    else this.attributeMap.delete(name);
  }

  /** @param {string} name @returns {boolean} */
  hasAttribute(name) {
    return this.getAttribute(name) !== null;
  }

  /** @param {string} name @param {boolean} [force] @returns {boolean} */
  toggleAttribute(name, force) {
    const on = force ?? !this.hasAttribute(name);
    if (on) this.setAttribute(name, '');
    else this.removeAttribute(name);
    return on;
  }

  /** Only what AppIcon asks: is the root itself interactive? A fresh span never is. */
  matches() {
    return false;
  }

  /** @param {...any} nodes */
  append(...nodes) {
    this.children.push(...nodes);
  }

  /** @param {...any} nodes */
  replaceChildren(...nodes) {
    this.children = [...nodes];
  }

  get textContent() {
    return this.children.map((child) => child.textContent ?? '').join('');
  }

  /** @param {string} type @param {Function} fn */
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }

  /** @param {string} type */
  fire(type) {
    for (const fn of this.listeners[type] ?? []) fn(new Event(type));
  }
}

class FakeDocument {
  constructor() {
    this.baseURI = 'https://app.example/';
    this.readyState = 'complete';
    /** @type {FakeElement[]} */
    this.scripts = [];
    /** @type {FakeElement[]} Scripts appended to the head, in order. */
    this.injected = [];
    const document = this;
    this.head = {
      /** @param {...FakeElement} nodes */
      append: (...nodes) => {
        document.scripts.push(...nodes);
        document.injected.push(...nodes);
      }
    };
  }

  /** @param {string} tag */
  createElement(tag) { return new FakeElement(tag); }
  /** @param {string} _namespace @param {string} tag */
  createElementNS(_namespace, tag) { return new FakeElement(tag); }
  /** @param {unknown} value */
  createTextNode(value) { return { nodeType: 3, textContent: String(value) }; }
  querySelector() { return null; }
}
