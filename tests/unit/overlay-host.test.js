import assert from 'node:assert/strict';
import test from 'node:test';

import { connectedOverlayHost, overlayHost } from '../../src/core/overlay-host.js';

/*
 * The host rules need nothing from a document but `closest()`, `isConnected`, and the body, so
 * plain objects stand in for elements. A source not yet in the document must not be hosted on
 * <body>: that is how a component created before its anchor was connected ended up outside its
 * theme scope.
 */
class FakeElement {
  constructor({ connected = true, scope = null } = {}) {
    this.nodeType = 1;
    this.isConnected = connected;
    this.scope = scope;
  }

  closest() {
    return this.scope;
  }
}

const element = (options) => new FakeElement(options);

async function withDocument(run) {
  const previous = { document: globalThis.document, Element: globalThis.Element };
  const body = element();
  const doc = { body, documentElement: element(), activeElement: body };
  globalThis.document = /** @type {any} */ (doc);
  globalThis.Element = /** @type {any} */ (FakeElement);
  try {
    await run(doc);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete (/** @type {any} */ (globalThis))[name];
      else (/** @type {any} */ (globalThis))[name] = value;
    }
  }
}

test('a connected source is hosted by its nearest scope, and by <body> without one', async () => {
  await withDocument((doc) => {
    const scope = element();
    assert.equal(connectedOverlayHost(element({ scope })), scope);
    assert.equal(connectedOverlayHost(element()), doc.body);
  });
});

test('a source not yet in the document gets no host until it is', async () => {
  await withDocument((doc) => {
    const detachedScope = element({ connected: false });
    assert.equal(connectedOverlayHost(element({ connected: false })), null);
    assert.equal(connectedOverlayHost(element({ connected: false, scope: detachedScope })), null);
    // What the component calls on open, when the anchor is in place, always has an answer.
    assert.equal(overlayHost(element({ connected: false })), doc.body);
  });
});

test('without a source the focused element supplies the scope, as before', async () => {
  await withDocument((doc) => {
    const scope = element();
    doc.activeElement = element({ scope });
    assert.equal(connectedOverlayHost(null), scope);
    assert.equal(connectedOverlayHost(), scope);
  });
});
