import assert from 'node:assert/strict';
import test from 'node:test';

import { skeleton, skeletonTable, skeletonText } from '../../src/components/skeleton/skeleton.js';

/*
 * Skeleton placeholders: the block, the stack of text lines, and the table grid. They are built
 * against a small document stand-in that records classes, attributes, data attributes, inline
 * style properties, and children.
 */

/* ------------------------------------------------------------------------ skeleton -- */

test('skeleton draws a hidden full-width block one line tall', () => {
  withDocument(() => {
    const block = skeleton();
    assert.equal(block.tagName, 'SPAN');
    assert.equal(block.className, 'zx-skeleton');
    assert.equal(block.getAttribute('aria-hidden'), 'true');
    assert.equal(block.dataset.radius, 'sm');
    assert.deepEqual(block.styles(), { 'inline-size': '100%', 'block-size': '1rem' });
  });
});

test('skeleton reads a number as pixels and passes any other length through', () => {
  withDocument(() => {
    assert.deepEqual(skeleton({ width: 40, height: 40, radius: 'full' }).styles(),
      { 'inline-size': '40px', 'block-size': '40px' });
    assert.deepEqual(skeleton({ width: '12rem', height: 'calc(1lh - 2px)' }).styles(),
      { 'inline-size': '12rem', 'block-size': 'calc(1lh - 2px)' });
    assert.deepEqual(skeleton({ width: 0 }).styles()['inline-size'], '0px');
  });
});

test('skeleton accepts the three radii and falls back to sm for anything else', () => {
  withDocument(() => {
    for (const radius of ['sm', 'md', 'full']) {
      assert.equal(skeleton({ radius: /** @type {any} */ (radius) }).dataset.radius, radius);
    }
    for (const radius of ['lg', 'FULL', '', null, 4]) {
      assert.equal(skeleton({ radius: /** @type {any} */ (radius) }).dataset.radius, 'sm', `${String(radius)}`);
    }
  });
});

test('an option passed as undefined keeps its default', () => {
  withDocument(() => {
    // A wrapper forwarding `{ height: props.height }` must not get a block with no height at all.
    const block = skeleton({ width: undefined, height: undefined, radius: undefined });
    assert.deepEqual(block.styles(), { 'inline-size': '100%', 'block-size': '1rem' });
    assert.equal(block.dataset.radius, 'sm');
  });
});

test('skeleton tolerates a missing options object', () => {
  withDocument(() => {
    assert.deepEqual(skeleton(/** @type {any} */ (null)).styles(), { 'inline-size': '100%', 'block-size': '1rem' });
  });
});

/* -------------------------------------------------------------------- skeletonText -- */

test('skeletonText draws three lines, the last one shorter, like the end of a paragraph', () => {
  withDocument(() => {
    const text = skeletonText();
    assert.equal(text.className, 'zx-skeleton-text');
    assert.equal(text.getAttribute('aria-hidden'), 'true');
    assert.equal(text.styles()['inline-size'], '100%');
    assert.equal(text.children.length, 3);
    assert.deepEqual(text.children.map((line) => line.styles()), [
      { 'inline-size': '100%', 'block-size': '0.75rem' },
      { 'inline-size': '100%', 'block-size': '0.75rem' },
      { 'inline-size': '60%', 'block-size': '0.75rem' }
    ]);
    assert.ok(text.children.every((line) => line.className === 'zx-skeleton'));
  });
});

test('skeletonText draws a taller first line as a heading', () => {
  withDocument(() => {
    const text = skeletonText({ lines: 2, heading: true, lastLineWidth: 120, width: '20rem' });
    assert.equal(text.styles()['inline-size'], '20rem');
    assert.deepEqual(text.children.map((line) => line.styles()), [
      { 'inline-size': '100%', 'block-size': '1.5rem' },
      { 'inline-size': '120px', 'block-size': '0.75rem' }
    ]);
  });
});

test('a single line is a full line, not a shortened last one', () => {
  withDocument(() => {
    const [only] = skeletonText({ lines: 1 }).children;
    assert.equal(only.styles()['inline-size'], '100%');
    const [heading] = skeletonText({ lines: 1, heading: true }).children;
    assert.deepEqual(heading.styles(), { 'inline-size': '100%', 'block-size': '1.5rem' });
  });
});

test('skeletonText keeps between one and twenty whole lines', () => {
  withDocument(() => {
    const count = (lines) => skeletonText({ lines: /** @type {any} */ (lines) }).children.length;
    assert.equal(count(0), 1);
    assert.equal(count(-4), 1);
    assert.equal(count(2.9), 2);
    assert.equal(count('4'), 4);
    assert.equal(count(20), 20);
    assert.equal(count(21), 20);
    assert.equal(count(1e9), 20);
    for (const lines of [Number.NaN, 'many', null, {}]) assert.equal(count(lines), 1, `${String(lines)}`);
    assert.equal(count(Number.POSITIVE_INFINITY), 20);
  });
});

test('skeletonText keeps its defaults for options passed as undefined', () => {
  withDocument(() => {
    const text = skeletonText({ lines: undefined, width: undefined, heading: undefined, lastLineWidth: undefined });
    assert.equal(text.children.length, 3);
    assert.equal(text.styles()['inline-size'], '100%');
    assert.equal(text.children[2].styles()['inline-size'], '60%');
  });
});

/* ------------------------------------------------------------------- skeletonTable -- */

test('skeletonTable draws a header and five rows of four cells', () => {
  withDocument(() => {
    const table = skeletonTable();
    assert.equal(table.className, 'zx-skeleton-table');
    assert.equal(table.getAttribute('aria-hidden'), 'true');
    assert.equal(table.tagName, 'DIV', 'plain elements: an empty table would be worse than none');
    assert.equal(table.styles()['--zx-skeleton-columns'], '4');
    assert.deepEqual(table.children.map((row) => row.dataset.kind), ['header', 'body', 'body', 'body', 'body', 'body']);
    for (const row of table.children) {
      assert.equal(row.className, 'zx-skeleton-table__row');
      assert.equal(row.children.length, 4);
      for (const cell of row.children) {
        assert.equal(cell.className, 'zx-skeleton-table__cell');
        assert.equal(cell.children.length, 1);
        assert.equal(cell.children[0].className, 'zx-skeleton');
        assert.equal(cell.children[0].styles()['block-size'], '0.75rem');
      }
    }
  });
});

test('cell widths vary, and the last column is the narrowest', () => {
  withDocument(() => {
    const widths = (columns) => skeletonTable({ rows: 1, header: false, columns }).children[0].children
      .map((cell) => cell.children[0].styles()['inline-size']);
    assert.deepEqual(widths(4), ['80%', '65%', '80%', '55%']);
    assert.deepEqual(widths(5), ['80%', '65%', '80%', '65%', '55%']);
    assert.deepEqual(widths(1), ['55%']);
  });
});

test('header: false leaves the header row out', () => {
  withDocument(() => {
    const table = skeletonTable({ rows: 2, header: false });
    assert.deepEqual(table.children.map((row) => row.dataset.kind), ['body', 'body']);
  });
});

test('skeletonTable keeps between one and fifty rows and one and twenty columns', () => {
  withDocument(() => {
    const shape = (options) => {
      const table = skeletonTable({ header: false, ...options });
      return [table.children.length, table.children[0].children.length, table.styles()['--zx-skeleton-columns']];
    };
    assert.deepEqual(shape({ rows: 0, columns: 0 }), [1, 1, '1']);
    assert.deepEqual(shape({ rows: -3, columns: -3 }), [1, 1, '1']);
    assert.deepEqual(shape({ rows: 3.7, columns: 2.2 }), [3, 2, '2']);
    assert.deepEqual(shape({ rows: 51, columns: 21 }), [50, 20, '20']);
    assert.deepEqual(shape({ rows: 'x', columns: Number.NaN }), [1, 1, '1']);
  });
});

test('skeletonTable keeps its defaults for options passed as undefined', () => {
  withDocument(() => {
    const table = skeletonTable({ rows: undefined, columns: undefined, header: undefined });
    assert.equal(table.children.length, 6, 'a header and five rows');
    assert.equal(table.styles()['--zx-skeleton-columns'], '4');
    assert.equal(table.children[0].dataset.kind, 'header');
  });
});

/* ------------------------------------------------------------------------- helpers -- */

/** @param {() => void} run */
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

class FakeElement {
  /** @param {string} tag */
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    /** @type {any[]} */
    this.children = [];
    /** @type {Record<string, string>} */
    this.dataset = {};
    /** @type {Map<string, string>} */
    this.attributeMap = new Map();
    /** @type {Map<string, string>} */
    const properties = new Map();
    this.style = {
      /** @param {string} name @param {string} value */
      setProperty: (name, value) => {
        // As in a browser, an empty value removes the declaration rather than setting one.
        if (value === '') properties.delete(name);
        else properties.set(name, String(value));
      }
    };
    /** @returns {Record<string, string>} The inline style declarations, by property. */
    this.styles = () => Object.fromEntries(properties);
  }

  /** @param {string} name @param {unknown} value */
  setAttribute(name, value) { this.attributeMap.set(name, String(value)); }
  /** @param {string} name @returns {string|null} */
  getAttribute(name) { return this.attributeMap.get(name) ?? null; }
  /** @param {...any} nodes */
  append(...nodes) { this.children.push(...nodes); }
}

class FakeDocument {
  /** @param {string} tag */
  createElement(tag) { return new FakeElement(tag); }
  /** @param {unknown} value */
  createTextNode(value) { return { nodeType: 3, textContent: String(value) }; }
}
