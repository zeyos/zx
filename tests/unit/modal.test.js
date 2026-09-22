import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Dialog } from '../../src/components/dialog/dialog.js';
import { Modal, initialFocusTarget } from '../../src/components/modal/modal.js';
import { Sheet } from '../../src/components/sheet/sheet.js';

/*
 * `Modal` was already a native `<dialog>` presented with `showModal()`, so focus containment, page
 * inertness, Escape and the implicit `dialog` role were never missing — they were the platform's
 * all along, which is why `Sheet` gets them by asking for `modal: true`. What was missing is what
 * the platform does not do: return focus to the opener on every close path, and put initial focus
 * on a control rather than stopping at the panel. Those are what these tests drive, against a
 * document stand-in that behaves the way a `<dialog>` does — `close` arrives in a queued task, and
 * `focus()` on a hidden element is a silent no-op, because both are what the code has to survive.
 */

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const modalSource = read('../../src/components/modal/modal.js');
const dialogSource = read('../../src/components/dialog/dialog.js');
const sheetSource = read('../../src/components/sheet/sheet.js');

test('the modal mode is the platform\'s, not a focus trap written on top of it', () => {
  // The root is a real dialog, and it is presented modally. Everything else follows from that.
  assert.match(modalSource, /h\('dialog',/);
  assert.match(modalSource, /this\.el\.showModal\(\)/);
  assert.match(modalSource, /matches\(':modal'\)/);

  // No second trap: no keyboard module, no Tab cycling, no inerting of the rest of the page.
  assert.doesNotMatch(modalSource, /core\/keyboard\.js|focusTrap/);
  assert.doesNotMatch(modalSource, /'Tab'|shiftKey|\binert\b\s*=/);
});

test('aria-modal states the presentation while it is open and is gone once it closes', async () => {
  await withDocument(async () => {
    const modal = new Modal(null, { content: 'Body' });
    assert.equal(modal.el.tagName, 'DIALOG',
      'the panel must stay a native dialog — its implicit role is what makes role= redundant');
    assert.equal(modal.el.getAttribute('aria-modal'), null, 'a closed overlay claims nothing');

    for (const cycle of ['first', 'second']) {
      modal.open();
      assert.equal(modal.el.getAttribute('aria-modal'), 'true', `${cycle} open`);
      modal.close();
      await flush();
      assert.equal(modal.el.getAttribute('aria-modal'), null, `${cycle} close`);
    }
    modal.destroy();
  });
});

test('focus returns to the opener on every one of the four close paths', async () => {
  /*
   * The four ways an overlay ends: a control inside it, Escape, a click on the backdrop, and a
   * host calling close(). They reach `_settleClose` by three different routes — `_dismiss()`, the
   * platform's own `close` event with no generation attached, and `close()` — which is exactly why
   * the restore hangs off the one event all three converge on.
   */
  const paths = {
    'a button inside the panel': (modal) => click(modal.refs.content.querySelector('button')),
    Escape: (modal) => pressEscape(modal),
    'light dismiss': (modal) => clickBackdrop(modal),
    'close()': (modal) => modal.close('programmatic')
  };

  for (const [name, dismiss] of Object.entries(paths)) {
    await withDocument(async (doc) => {
      const opener = doc.body.appendChild(doc.createElement('button'));
      const modal = new Modal(null, { lightDismiss: true });
      modal.setContent(h('button', { onclick: () => modal.close('button') }, 'Close'));

      opener.focus();
      assert.equal(doc.activeElement, opener, `${name}: the opener must start focused`);
      modal.open();
      await flush();
      assert.ok(modal.el.contains(doc.activeElement), `${name}: focus must move into the overlay`);

      dismiss(modal);
      await flush();
      assert.equal(modal.isOpen(), false, `${name}: the overlay must actually close`);
      assert.equal(doc.activeElement, opener, `${name}: focus must come back to the opener`);
      modal.destroy();
    });
  }
});

test('a second cycle restores to the opener that opened it, not the first one', async () => {
  await withDocument(async (doc) => {
    const first = doc.body.appendChild(doc.createElement('button'));
    const second = doc.body.appendChild(doc.createElement('button'));
    const modal = new Modal(null, { content: 'Body' });

    first.focus();
    modal.open();
    await flush();
    modal.close();
    await flush();
    assert.equal(doc.activeElement, first);

    second.focus();
    modal.open();
    await flush();
    modal.close();
    await flush();
    assert.equal(doc.activeElement, second, 'the capture must be per open, not per instance');

    // A disconnected opener is not focused, and must not leave focus stranded on a stale node.
    second.remove();
    modal.open();
    await flush();
    modal.close();
    await flush();
    assert.notEqual(doc.activeElement, second);
    modal.destroy();
  });
});

test('destroyOnClose restores focus before the overlay is taken apart', async () => {
  await withDocument(async (doc) => {
    const opener = doc.body.appendChild(doc.createElement('button'));
    const modal = new Modal(null, { content: 'Body', destroyOnClose: true });
    opener.focus();
    modal.open();
    await flush();
    modal.close();
    await flush();

    assert.equal(doc.activeElement, opener);
    assert.equal(modal.el.isConnected, false, 'destroyOnClose must still have destroyed it');
  });
});

test('initial focus lands on the first control, and on the panel when there is none', async () => {
  await withDocument(async (doc) => {
    const withControl = new Modal(null, {
      content: h('div', {}, h('p', {}, 'Intro'), h('input', {}), h('button', {}, 'Later'))
    });
    withControl.open();
    await flush();
    assert.equal(doc.activeElement.tagName, 'INPUT', 'the first focusable descendant wins');
    assert.equal(withControl.el.hasAttribute('tabindex'), false,
      'a panel with a control of its own must not be made focusable');
    withControl.close();
    await flush();

    const textOnly = new Modal(null, { content: 'Nothing to focus here.' });
    textOnly.open();
    await flush();
    assert.equal(doc.activeElement, textOnly.el, 'the panel is the last resort, never the document');
    assert.equal(textOnly.el.getAttribute('tabindex'), '-1',
      'and it is made focusable only for that, outside the Tab order');

    withControl.destroy();
    textOnly.destroy();
  });
});

test('a Dialog footer button marked autofocus still outranks the header close button', async () => {
  await withDocument(async (doc) => {
    const opener = doc.body.appendChild(doc.createElement('button'));
    const dialog = new Dialog(null, {
      title: 'Delete record?',
      content: 'This cannot be undone.',
      buttons: [
        { label: 'Cancel', action: 'close' },
        { label: 'Delete', kind: 'danger', action: 'close', autofocus: true }
      ]
    });

    opener.focus();
    dialog.open();
    await flush();
    assert.equal(doc.activeElement.textContent, 'Delete',
      'autofocus must beat the close button, which is first in document order');

    // And the footer button is a close path of its own: it restores focus like the rest.
    click(doc.activeElement);
    await flush();
    assert.equal(dialog.isOpen(), false);
    assert.equal(doc.activeElement, opener);

    // Without autofocus the header close button is simply the first focusable descendant.
    dialog.setButtons([{ label: 'Cancel', action: 'close' }]);
    dialog.open();
    await flush();
    assert.equal(doc.activeElement, dialog.refs.close);
    dialog.close();
    await flush();
    assert.equal(doc.activeElement, opener);
    dialog.destroy();
  });
});

test('initial focus skips candidates that cannot take it', async () => {
  await withDocument(async () => {
    const panel = h('div', {},
      // `closable: false` hides the close button; a hidden view hides everything inside it.
      h('button', { hidden: true }, 'Hidden'),
      h('section', { hidden: true, ariaHidden: 'true' }, h('input', { ref: 'buried' })),
      h('button', { disabled: true }, 'Disabled'),
      h('span', { tabindex: '-1' }, 'Not in the order'),
      h('a', {}, 'No href'),
      h('button', { ref: 'real' }, 'Real')
    );
    assert.equal(initialFocusTarget(panel).textContent, 'Real');

    // An aria-hidden subtree is skipped even when the element inside it declares autofocus:
    // focusing it would be a no-op and would leave the reader outside the overlay entirely.
    panel.querySelector('input').autofocus = true;
    assert.equal(initialFocusTarget(panel).textContent, 'Real');

    panel.querySelector('button[disabled]').autofocus = true;
    assert.equal(initialFocusTarget(panel).textContent, 'Real', 'a disabled autofocus is ignored');

    assert.equal(initialFocusTarget(h('div', {}, 'Just text')), null);
  });
});

test('Sheet keeps exactly one focus trap, and it is still its own', () => {
  assert.equal(Object.getPrototypeOf(Sheet.prototype), Dialog.prototype);
  assert.equal(Object.getPrototypeOf(Dialog.prototype), Modal.prototype);

  /*
   * The focus work is Modal's and is inherited whole. A copy on Sheet or Dialog would be a second
   * answer to the same question, and for `modal: 'trap-focus'` a second trap on the same Tab key.
   */
  for (const method of ['_focusInitial', 'close']) {
    assert.equal(Object.hasOwn(Dialog.prototype, method), false,
      `Dialog must not restate ${method}()`);
  }
  assert.equal(Object.hasOwn(Sheet.prototype, '_focusInitial'), false,
    'Sheet must not restate _focusInitial()');
  assert.equal(Sheet.prototype._focusInitial, Modal.prototype._focusInitial);
  assert.equal(Dialog.prototype._focusInitial, Modal.prototype._focusInitial);

  // One trap in the family, and it is Sheet's, for the two modes that have no native containment.
  assert.match(sheetSource, /focusTrap\(this\.el\)/);
  for (const source of [modalSource, dialogSource]) assert.doesNotMatch(source, /focusTrap/);

  // One restore registration, in the base, so Sheet's trap deactivation still runs after it.
  const restores = [modalSource, dialogSource, sheetSource]
    .filter((source) => /this\.on\('close'[\s\S]{0,60}?#restoreFocus\(\)\)/.test(source));
  assert.equal(restores.length, 1);
  assert.equal(restores[0], modalSource);

  // And Sheet's modal path still delegates to showModal() rather than trapping.
  assert.match(sheetSource, /modal === true && !this\._dock[\s\S]{0,200}?super\._show\(\);/);
});

/* ------------------------------------------------------------------ *
 * Document stand-in
 * ------------------------------------------------------------------ */

/**
 * Builds an element through the same `h()` the components use, so the test tree is the tree they
 * would build. Imported lazily because it needs `document` to exist first.
 * @param {...unknown} args Tag, properties, children.
 * @returns {any}
 */
function h(...args) {
  return domH(/** @type {any} */ (args[0]), /** @type {any} */ (args[1]), ...args.slice(2));
}

const { h: domH } = await import('../../src/core/dom.js');

/**
 * Runs the queued `close` event and the queued initial-focus step, both of which the platform
 * defers and the component therefore has to as well.
 * @returns {Promise<void>}
 */
function flush() {
  return new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
}

/** @param {any} element @returns {void} */
function click(element) {
  const event = new Event('click', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
}

/**
 * What the browser does on Escape in a modal dialog: a cancelable `cancel`, and the close itself
 * only if nothing prevented it.
 * @param {Modal} overlay Open overlay.
 * @returns {void}
 */
function pressEscape(overlay) {
  const cancel = new Event('cancel', { cancelable: true });
  overlay.el.dispatchEvent(cancel);
  if (!cancel.defaultPrevented) /** @type {any} */ (overlay.el).close();
}

/** @param {Modal} overlay @returns {void} */
function clickBackdrop(overlay) {
  const rect = overlay.el.getBoundingClientRect();
  const event = new Event('click', { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: rect.left - 20, clientY: rect.top - 20 });
  overlay.el.dispatchEvent(event);
}

/**
 * @param {(doc: FakeDocument) => Promise<void>|void} run Test body.
 * @returns {Promise<void>}
 */
async function withDocument(run) {
  const previous = {
    document: globalThis.document, Element: globalThis.Element, HTMLElement: globalThis.HTMLElement
  };
  const doc = new FakeDocument();
  globalThis.document = /** @type {any} */ (doc);
  globalThis.Element = /** @type {any} */ (FakeElement);
  globalThis.HTMLElement = /** @type {any} */ (FakeElement);
  try {
    await run(doc);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete (/** @type {any} */ (globalThis))[name];
      else (/** @type {any} */ (globalThis))[name] = value;
    }
  }
}

class FakeNode {
  /** @param {number} nodeType @param {FakeDocument} ownerDocument */
  constructor(nodeType, ownerDocument) {
    this.nodeType = nodeType;
    this.ownerDocument = ownerDocument;
    /** @type {FakeNode[]} */
    this.children = [];
    /** @type {FakeNode|null} */
    this.parentNode = null;
    /** @type {{type: string, fn: Function}[]} */
    this.listeners = [];
  }

  /** @returns {any} */
  get parentElement() {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null;
  }

  /** @returns {boolean} */
  get isConnected() {
    for (let node = /** @type {any} */ (this); node; node = node.parentNode) {
      if (node.isRoot) return true;
    }
    return false;
  }

  /** @param {string} type @param {Function} fn @param {any} [options={}] @returns {void} */
  addEventListener(type, fn, options = {}) {
    const entry = { type, fn };
    this.listeners.push(entry);
    options?.signal?.addEventListener('abort', () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== entry);
    }, { once: true });
  }

  /** @param {string} type @param {Function} fn @returns {void} */
  removeEventListener(type, fn) {
    this.listeners = this.listeners.filter((entry) => entry.type !== type || entry.fn !== fn);
  }

  /** @param {Event} event @returns {boolean} */
  dispatchEvent(event) {
    Object.defineProperty(event, 'target', { configurable: true, value: this });
    for (let node = /** @type {any} */ (this); node; node = event.bubbles ? node.parentNode : null) {
      Object.defineProperty(event, 'currentTarget', { configurable: true, value: node });
      for (const entry of [...node.listeners]) {
        if (entry.type === event.type) entry.fn.call(node, event);
      }
      // Property handlers (`element.onclick = fn`) are dispatched by the platform too.
      const handler = node[`on${event.type}`];
      if (typeof handler === 'function') handler.call(node, event);
    }
    return !event.defaultPrevented;
  }

  /** @param {any} child @returns {any} */
  appendChild(child) {
    child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  /** @param {...any} children @returns {void} */
  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  /** @param {...any} children @returns {void} */
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...children);
  }

  /** @returns {void} */
  remove() {
    const parent = this.parentNode;
    if (!parent) return;
    parent.children = parent.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  /** @param {any} node @returns {boolean} */
  contains(node) {
    for (let current = node; current; current = current.parentNode) if (current === this) return true;
    return false;
  }
}

class FakeElement extends FakeNode {
  /** @param {string} tag @param {FakeDocument} ownerDocument */
  constructor(tag, ownerDocument) {
    super(1, ownerDocument);
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.id = '';
    this.value = '';
    this.type = '';
    this.title = '';
    /** @type {Map<string, string>} */
    this.attributeMap = new Map();
    this.dataset = createDataset(this);
    this.style = createStyle();
    this.classList = createClassList(this);
    this._textContent = '';
  }

  /** @returns {boolean} */
  get hidden() {
    return this.hasAttribute('hidden');
  }

  /** @param {unknown} value */
  set hidden(value) {
    this.#toggle('hidden', Boolean(value));
  }

  /** @returns {boolean} */
  get disabled() {
    return this.hasAttribute('disabled');
  }

  /** @param {unknown} value */
  set disabled(value) {
    this.#toggle('disabled', Boolean(value));
  }

  /** @returns {boolean} */
  get autofocus() {
    return this.hasAttribute('autofocus');
  }

  /** @param {unknown} value */
  set autofocus(value) {
    this.#toggle('autofocus', Boolean(value));
  }

  /** @param {string} name @param {boolean} on @returns {void} */
  #toggle(name, on) {
    if (on) this.attributeMap.set(name, '');
    else this.attributeMap.delete(name);
  }

  /** @returns {string} */
  get textContent() {
    return this.children.length
      ? this.children.map((child) => /** @type {any} */ (child).textContent).join('')
      : this._textContent;
  }

  /** @param {unknown} value */
  set textContent(value) {
    this._textContent = String(value);
    this.replaceChildren();
  }

  /** @param {string} name @param {unknown} value @returns {void} */
  setAttribute(name, value) {
    this.attributeMap.set(name, String(value));
  }

  /** @param {string} name @returns {string|null} */
  getAttribute(name) {
    return this.attributeMap.get(name) ?? null;
  }

  /** @param {string} name @returns {boolean} */
  hasAttribute(name) {
    return this.attributeMap.has(name);
  }

  /** @param {string} name @returns {void} */
  removeAttribute(name) {
    this.attributeMap.delete(name);
  }

  /** @param {string} selector @returns {boolean} */
  matches(selector) {
    return matchesSelector(this, selector);
  }

  /** @param {string} selector @returns {any|null} */
  closest(selector) {
    for (let node = /** @type {any} */ (this); node; node = node.parentElement) {
      if (matchesSelector(node, selector)) return node;
    }
    return null;
  }

  /** @param {string} selector @returns {any|null} */
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  /** @param {string} selector @returns {any[]} */
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.nodeType !== 1) continue;
        if (matchesSelector(child, selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  /** @returns {{left: number, top: number, right: number, bottom: number, width: number, height: number}} */
  getBoundingClientRect() {
    return { left: 100, top: 100, right: 400, bottom: 300, width: 300, height: 200 };
  }

  /**
   * Focus the way the platform grants it: never to a disconnected, hidden or disabled element, so
   * a component that "focuses" one leaves focus where it was and the test sees that it did.
   * @returns {void}
   */
  focus() {
    if (!this.isConnected || this.disabled) return;
    for (let node = /** @type {any} */ (this); node; node = node.parentElement) {
      if (node.hidden) return;
    }
    this.ownerDocument.activeElement = this;
  }
}

/** The `<dialog>` behaviours `Modal` is built on, including the queued `close` event. */
class FakeDialogElement extends FakeElement {
  /** @param {FakeDocument} ownerDocument */
  constructor(ownerDocument) {
    super('dialog', ownerDocument);
    this.open = false;
    this.returnValue = '';
    this.modalMode = false;
  }

  /** @returns {void} */
  showModal() {
    if (this.open) throw new Error('InvalidStateError: the dialog is already open');
    this.open = true;
    this.modalMode = true;
    /*
     * The platform's own focusing step: an `autofocus` control if the content declares one, and
     * otherwise the dialog element itself. Emulated because stopping at the panel is precisely the
     * gap `_focusInitial()` closes, and a test that skipped it would not see the difference.
     */
    (this.querySelector('[autofocus]:not([disabled])') ?? this).focus();
  }

  /** @returns {void} */
  show() {
    this.open = true;
    this.modalMode = false;
  }

  /** @param {string} [result] Native return value. @returns {void} */
  close(result) {
    if (!this.open) return;
    if (result !== undefined) this.returnValue = String(result);
    this.open = false;
    this.modalMode = false;
    queueMicrotask(() => this.dispatchEvent(new Event('close')));
  }
}

class FakeDocument {
  constructor() {
    this.documentElement = new FakeElement('html', this);
    this.body = new FakeElement('body', this);
    /** @type {any} */
    this.body.isRoot = true;
    this.documentElement.appendChild(this.body);
    /** @type {any} */
    this.activeElement = this.body;
  }

  /** @param {string} tag @returns {any} */
  createElement(tag) {
    return tag === 'dialog' ? new FakeDialogElement(this) : new FakeElement(tag, this);
  }

  /** @param {string} _namespace @param {string} tag @returns {any} */
  createElementNS(_namespace, tag) {
    return new FakeElement(tag, this);
  }

  /** @param {unknown} value @returns {any} */
  createTextNode(value) {
    const node = new FakeNode(3, this);
    /** @type {any} */ (node).textContent = String(value);
    return node;
  }

  /** @param {string} selector @returns {any|null} */
  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  /** @param {string} selector @returns {any[]} */
  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

/**
 * Matches the shapes these components actually use: a comma-separated list of compound selectors
 * built from a tag name, classes, attribute tests, `:not(…)` of the same, and the `:modal`
 * state pseudo-class the modality check reads. No combinators — none appear.
 * @param {any} element Candidate.
 * @param {string} selector Selector list.
 * @returns {boolean}
 */
function matchesSelector(element, selector) {
  return selector.split(',').some((part) => matchesCompound(element, part.trim()));
}

/** @param {any} element @param {string} selector @returns {boolean} */
function matchesCompound(element, selector) {
  let rest = selector;
  if (!rest) return false;

  const tag = /^[a-zA-Z][\w-]*/.exec(rest);
  if (tag) {
    if (element.tagName !== tag[0].toUpperCase()) return false;
    rest = rest.slice(tag[0].length);
  }

  while (rest.length > 0) {
    if (rest.startsWith('.')) {
      const name = /^\.([\w-]+)/.exec(rest);
      if (!name || !element.classList.contains(name[1])) return false;
      rest = rest.slice(name[0].length);
    } else if (rest.startsWith(':not(')) {
      const end = rest.indexOf(')');
      if (end === -1 || matchesCompound(element, rest.slice(5, end))) return false;
      rest = rest.slice(end + 1);
    } else if (rest.startsWith('[')) {
      const end = rest.indexOf(']');
      if (end === -1 || !matchesAttribute(element, rest.slice(1, end))) return false;
      rest = rest.slice(end + 1);
    } else if (rest.startsWith(':')) {
      const pseudo = /^:([\w-]+)/.exec(rest);
      if (!pseudo || !matchesPseudo(element, pseudo[1])) return false;
      rest = rest.slice(pseudo[0].length);
    } else {
      throw new Error(`unsupported selector: ${selector}`);
    }
  }
  return true;
}

/** @param {any} element @param {string} test `name` or `name="value"`. @returns {boolean} */
function matchesAttribute(element, test) {
  const parsed = /^([\w-]+)(?:=["']?([^"'\]]*)["']?)?$/.exec(test);
  if (!parsed) throw new Error(`unsupported attribute selector: [${test}]`);
  const value = element.getAttribute(parsed[1]);
  if (value === null) return false;
  return parsed[2] === undefined || value === parsed[2];
}

/** @param {any} element @param {string} name @returns {boolean} */
function matchesPseudo(element, name) {
  if (name === 'modal') return Boolean(element.modalMode && element.open);
  if (name === 'popover-open') return element.getAttribute('popover') !== null && Boolean(element.open);
  if (name === 'disabled') return Boolean(element.disabled);
  throw new Error(`unsupported pseudo-class: :${name}`);
}

/** @param {FakeElement} element @returns {Record<string, string>} */
function createDataset(element) {
  const name = (key) => `data-${String(key).replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
  return /** @type {any} */ (new Proxy({}, {
    get: (_target, key) => element.getAttribute(name(key)) ?? undefined,
    set: (_target, key, value) => {
      element.setAttribute(name(key), String(value));
      return true;
    },
    deleteProperty: (_target, key) => {
      element.removeAttribute(name(key));
      return true;
    },
    has: (_target, key) => element.hasAttribute(name(key))
  }));
}

/** @returns {any} */
function createStyle() {
  /** @type {Record<string, string>} */
  const custom = {};
  return {
    setProperty(property, value) {
      custom[property] = String(value);
    },
    removeProperty(property) {
      delete custom[property];
    },
    getPropertyValue(property) {
      return custom[property] ?? '';
    }
  };
}

/** @param {FakeElement} element @returns {any} */
function createClassList(element) {
  const names = () => String(element.className ?? '').split(/\s+/).filter(Boolean);
  return {
    add(...added) {
      element.className = [...new Set([...names(), ...added])].join(' ');
    },
    remove(...removed) {
      element.className = names().filter((name) => !removed.includes(name)).join(' ');
    },
    contains(name) {
      return names().includes(name);
    }
  };
}
