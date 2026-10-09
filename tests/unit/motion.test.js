import assert from 'node:assert/strict';
import test from 'node:test';

import { MOTION_ATTRIBUTE, prefersReducedMotion, watchMotion } from '../../src/core/motion.js';
import { ChartJsAdapter } from '../../src/components/chart/chart.js';

/*
 * Motion as a setting, for script. The questions are pure tree walks, so they run against a small
 * element double: `closest()`, `getRootNode()`, and an attribute map — enough to model a document,
 * a reduced region, and a shadow root without a DOM.
 */

const REGION = '[data-zx-motion="reduced"]';

class FakeElement {
  /** @param {FakeElement|FakeShadowRoot|null} [parent] */
  constructor(parent = null) {
    this.nodeType = 1;
    this.parent = parent;
    /** @type {Map<string, string>} */
    this.attributes = new Map();
  }

  /** @param {string} selector @returns {FakeElement|null} */
  closest(selector) {
    assert.equal(selector, REGION, `unexpected selector ${selector}`);
    for (let node = /** @type {any} */ (this); node instanceof FakeElement; node = node.parent) {
      if (node.attributes.get(MOTION_ATTRIBUTE) === 'reduced') return node;
    }
    return null;
  }

  /** @returns {FakeElement|FakeShadowRoot} */
  getRootNode() {
    let node = /** @type {any} */ (this);
    while (node instanceof FakeElement && node.parent) node = node.parent;
    return node;
  }
}

class FakeShadowRoot {
  /** @param {FakeElement} host */
  constructor(host) {
    this.nodeType = 11;
    this.host = host;
  }
}

/** Installs a `matchMedia` and a `MutationObserver` double for one test. */
function environment(t, { reduced = false } = {}) {
  const media = new EventTarget();
  media.matches = reduced;
  /** @type {{callback: Function, targets: object[], disconnected: boolean}[]} */
  const observers = [];
  const saved = {
    matchMedia: globalThis.matchMedia,
    MutationObserver: globalThis.MutationObserver,
    document: globalThis.document
  };
  globalThis.matchMedia = (query) => {
    assert.equal(query, '(prefers-reduced-motion: reduce)');
    return media;
  };
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.record = { callback, targets: [], options: [], disconnected: false };
      observers.push(this.record);
    }
    observe(target, options) {
      this.record.targets.push(target);
      this.record.options.push(options);
    }
    disconnect() { this.record.disconnected = true; }
  };
  const html = new FakeElement();
  globalThis.document = /** @type {any} */ ({ documentElement: html });
  t.after(() => Object.assign(globalThis, saved));
  return {
    html,
    observers,
    /** Flips the operating-system preference and announces it. */
    setSystem(value) {
      media.matches = value;
      media.dispatchEvent(new Event('change'));
    },
    /** Announces an attribute mutation to every live observer. */
    mutate() {
      for (const observer of observers) if (!observer.disconnected) observer.callback([]);
    }
  };
}

test('motion is reduced under the system preference or inside a reduced region', (t) => {
  const env = environment(t);
  const region = new FakeElement(env.html);
  const leaf = new FakeElement(new FakeElement(region));

  assert.equal(prefersReducedMotion(leaf), false);
  region.attributes.set(MOTION_ATTRIBUTE, 'reduced');
  assert.equal(prefersReducedMotion(leaf), true, 'a descendant of a reduced region may still move');
  assert.equal(prefersReducedMotion(region), true, 'the region element itself may still move');
  assert.equal(prefersReducedMotion(env.html), false, 'the region leaked to its ancestor');

  // There is no "full": any other value is simply not a reduced region, and cannot override one.
  region.attributes.set(MOTION_ATTRIBUTE, 'system');
  assert.equal(prefersReducedMotion(leaf), false);
  env.setSystem(true);
  leaf.attributes.set(MOTION_ATTRIBUTE, 'full');
  assert.equal(prefersReducedMotion(leaf), true, 'a region overrode the system preference');
});

test('without an element the document root answers', (t) => {
  const env = environment(t);
  assert.equal(prefersReducedMotion(), false);
  env.html.attributes.set(MOTION_ATTRIBUTE, 'reduced');
  assert.equal(prefersReducedMotion(), true);
  assert.equal(prefersReducedMotion(null), true);
});

test('a region outside a shadow root reaches the element inside it', (t) => {
  const env = environment(t);
  const host = new FakeElement(env.html);
  const inner = new FakeElement(new FakeShadowRoot(host));
  assert.equal(prefersReducedMotion(inner), false);
  env.html.attributes.set(MOTION_ATTRIBUTE, 'reduced');
  assert.equal(prefersReducedMotion(inner), true);
});

test('watchMotion reports real changes from the system and from region attributes', (t) => {
  const env = environment(t);
  const host = new FakeElement(env.html);
  const shadow = new FakeShadowRoot(host);
  const element = new FakeElement(shadow);
  const seen = [];
  const stop = watchMotion(/** @type {any} */ (element), (reduced) => seen.push(reduced));

  // Both trees on the way up are watched, for the one attribute only.
  const [observer] = env.observers;
  assert.deepEqual(observer.targets, [shadow, env.html]);
  for (const options of observer.options) {
    assert.deepEqual(options, { attributes: true, attributeFilter: [MOTION_ATTRIBUTE], subtree: true });
  }

  env.mutate();
  assert.deepEqual(seen, [], 'called back without a change');
  env.html.attributes.set(MOTION_ATTRIBUTE, 'reduced');
  env.mutate();
  env.setSystem(true);
  assert.deepEqual(seen, [true], 'the system flip inside a reduced region is not a change');
  env.html.attributes.delete(MOTION_ATTRIBUTE);
  env.mutate();
  assert.deepEqual(seen, [true], 'the system still asks for reduced motion');
  env.setSystem(false);
  assert.deepEqual(seen, [true, false]);

  stop();
  stop();
  assert.equal(observer.disconnected, true);
  env.setSystem(true);
  assert.deepEqual(seen, [true, false], 'called back after the disposer ran');
});

test('watchMotion honours immediate and an abort signal', (t) => {
  const env = environment(t, { reduced: true });
  const seen = [];
  const controller = new AbortController();
  watchMotion(null, (reduced) => seen.push(reduced), { immediate: true, signal: controller.signal });
  assert.deepEqual(seen, [true]);
  controller.abort();
  assert.equal(env.observers[0].disconnected, true);
  env.setSystem(false);
  assert.deepEqual(seen, [true], 'called back after the signal aborted');

  const before = env.observers.length;
  watchMotion(null, () => assert.fail('an aborted signal still watched'), { signal: controller.signal });
  assert.equal(env.observers.length, before);
  assert.throws(() => watchMotion(null, /** @type {any} */ (null)), TypeError);
});

test('ChartJsAdapter turns the engine animation off when motion is reduced', () => {
  const configs = [];
  class FakeChart {
    constructor(canvas, config) {
      this.options = config.options;
      configs.push(config);
    }
    update() { configs.push({ options: this.options }); }
    destroy() {}
  }
  const adapter = new ChartJsAdapter(FakeChart);
  const spec = (reducedMotion) => ({
    type: 'bar',
    data: { labels: ['A'], datasets: [{ data: [1] }] },
    // An application's own animation settings lose to the reader's preference.
    options: { animation: { duration: 800 } },
    reducedMotion,
    onSelect() {}
  });
  const handle = adapter.create(/** @type {any} */ ({}), spec(false));
  assert.deepEqual(configs[0].options.animation, { duration: 800 });
  handle.update(spec(true));
  assert.equal(configs[1].options.animation, false);
  handle.update(spec(false));
  assert.deepEqual(configs[2].options.animation, { duration: 800 });
  handle.destroy();
});
