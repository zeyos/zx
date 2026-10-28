import assert from 'node:assert/strict';
import test from 'node:test';

import { connectedOverlayHost, openDialogOf, overlayHost, overlayScope } from '../../src/core/overlay-host.js';

/*
 * The host rules need nothing from a document but `closest()`, `isConnected`, and the body, so
 * plain objects stand in for elements. A source not yet in the document must not be hosted on
 * <body>: that is how a component created before its anchor was connected ended up outside its
 * theme scope. `closest()` answers the open dialog for the dialog selector and the theme scope for
 * the other, which is all the two rules ask of the DOM.
 */
class FakeElement {
  constructor({ connected = true, scope = null, dialog = null } = {}) {
    this.nodeType = 1;
    this.isConnected = connected;
    this.scope = scope;
    this.dialog = dialog;
  }

  closest(selector) {
    return selector.includes('dialog') ? this.dialog : this.scope;
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

test('an anchor inside an open dialog is hosted by the dialog, so showModal() leaves it usable', async () => {
  await withDocument(() => {
    const scope = element();
    const dialog = element({ scope });
    const anchor = element({ scope, dialog });
    assert.equal(openDialogOf(anchor), dialog);
    assert.equal(overlayHost(anchor), dialog);
    assert.equal(connectedOverlayHost(anchor), dialog);
  });
});

test('a closed panel, a dialog itself, and a toast region rest in the theme scope', async () => {
  await withDocument(() => {
    const scope = element();
    const anchor = element({ scope, dialog: element({ scope }) });
    assert.equal(overlayScope(anchor), scope);
    assert.equal(connectedOverlayHost(anchor, { dialog: false }), scope);
    assert.equal(connectedOverlayHost(element({ connected: false, scope }), { dialog: false }), null);
  });
});

test('the focused-element default never picks a dialog', async () => {
  await withDocument((doc) => {
    const scope = element();
    doc.activeElement = element({ scope, dialog: element({ scope }) });
    assert.equal(overlayHost(), scope);
    assert.equal(overlayScope(), scope);
  });
});

test('an anchor in no dialog keeps its theme scope', async () => {
  await withDocument((doc) => {
    const scope = element();
    assert.equal(overlayHost(element({ scope })), scope);
    assert.equal(overlayHost(element()), doc.body);
    assert.equal(openDialogOf(null), null);
  });
});
