import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FilterPanel, isActiveValue, normalizeOptions, parseFieldType, pruneValue, serializeDate,
  serializeFilterValue, toDateInput, toDraft
} from '../../src/components/filter-panel/filter-panel.js';

/**
 * The field map a ZeyOS list response publishes, in the shape the panel is handed it.
 * @returns {Record<string, import('../../src/components/filter-panel/filter-panel.js').FilterPanelField>}
 */
function fields() {
  return {
    subject: { type: 'text', label: 'Subject' },
    status: {
      type: 'select',
      label: 'Status',
      options: [{ value: 0, label: 'Draft' }, { value: 1, label: 'Open' }, { value: 2, label: 'Closed' }]
    },
    created: { type: 'date:range', label: 'Created' },
    due: { type: 'date', label: 'Due' },
    amount: { type: 'float:range', label: 'Amount', min: 0, max: 10000 },
    priority: { type: 'int', label: 'Priority' },
    location: { type: 'geo', label: 'Location' }
  };
}

/** Local midnight, so the expectations hold in every timezone the suite runs in. */
const DAY_START = new Date(2026, 0, 15, 0, 0, 0, 0);
const DAY_END = new Date(2026, 0, 15, 23, 59, 59, 999);

test('every type instance settings produce resolves, and nothing else does', () => {
  assert.deepEqual(parseFieldType('text'), { kind: 'text', range: false, integer: false });
  assert.deepEqual(parseFieldType('select'), { kind: 'select', range: false, integer: false });
  assert.deepEqual(parseFieldType('date'), { kind: 'date', range: false, integer: false });
  assert.deepEqual(parseFieldType('date:range'), { kind: 'date', range: true, integer: false });
  assert.deepEqual(parseFieldType('int'), { kind: 'number', range: false, integer: true });
  assert.deepEqual(parseFieldType('float'), { kind: 'number', range: false, integer: false });
  assert.deepEqual(parseFieldType('number'), { kind: 'number', range: false, integer: false });
  assert.deepEqual(parseFieldType('int:range'), { kind: 'number', range: true, integer: true });
  assert.deepEqual(parseFieldType('float:range'), { kind: 'number', range: true, integer: false });
  assert.deepEqual(parseFieldType('number:range'), { kind: 'number', range: true, integer: false });

  // Server metadata is not always tidy about case or whitespace; an actually unknown type is null.
  assert.deepEqual(parseFieldType(' Date:Range '), { kind: 'date', range: true, integer: false });
  assert.equal(parseFieldType('geo'), null);
  assert.equal(parseFieldType(''), null);
  assert.equal(parseFieldType(null), null);
  assert.equal(parseFieldType(undefined), null);
});

test('0 is a value; empty, null and empty containers are not', () => {
  assert.equal(isActiveValue(0), true);
  assert.equal(isActiveValue('0'), true);
  assert.equal(isActiveValue(-0), true);
  assert.equal(isActiveValue([0]), true);
  assert.equal(isActiveValue({ from: 0, to: null }), true);

  assert.equal(isActiveValue(''), false);
  assert.equal(isActiveValue('   '), false);
  assert.equal(isActiveValue(null), false);
  assert.equal(isActiveValue(undefined), false);
  assert.equal(isActiveValue(Number.NaN), false);
  assert.equal(isActiveValue([]), false);
  assert.equal(isActiveValue(['']), false);
  assert.equal(isActiveValue({}), false);
  assert.equal(isActiveValue({ from: null, to: null }), false);
});

test('pruning keeps the constraints and drops the open ends of a range', () => {
  assert.deepEqual(pruneValue({
    subject: '',
    status: [],
    priority: 0,
    amount: { from: 0, to: null },
    created: { from: null, to: null },
    missing: null
  }), { priority: 0, amount: { from: 0 } });

  assert.deepEqual(pruneValue({}), {});
  assert.deepEqual(pruneValue(null), {}, 'a missing value object prunes to an empty one, not a throw');
});

test('a calendar day is recognised however it comes back from a URL', () => {
  assert.equal(toDateInput('2026-01-15'), '2026-01-15');
  assert.equal(toDateInput(new Date(2026, 0, 15, 13, 30)), '2026-01-15');
  assert.equal(toDateInput(Math.floor(DAY_START.getTime() / 1000)), '2026-01-15', 'Unix seconds');
  assert.equal(toDateInput(DAY_START.getTime()), '2026-01-15', 'epoch milliseconds');
  assert.equal(toDateInput(String(Math.floor(DAY_END.getTime() / 1000))), '2026-01-15', 'seconds as text');
  assert.equal(toDateInput(DAY_START.toISOString()), '2026-01-15');

  assert.equal(toDateInput(''), '');
  assert.equal(toDateInput(null), '');
  assert.equal(toDateInput(undefined), '');
  assert.equal(toDateInput('not a date'), '');
  assert.equal(toDateInput(Number.NaN), '');
});

test('a range edge serializes to its own end of the day in all four modes', () => {
  assert.equal(serializeDate('2026-01-15', 'from'), Math.floor(DAY_START.getTime() / 1000));
  assert.equal(serializeDate('2026-01-15', 'to'), Math.floor(DAY_END.getTime() / 1000));

  assert.equal(serializeDate('2026-01-15', 'from', 'ms'), DAY_START.getTime());
  assert.equal(serializeDate('2026-01-15', 'to', 'ms'), DAY_END.getTime());

  assert.equal(serializeDate('2026-01-15', 'from', 'iso'), DAY_START.toISOString());
  assert.equal(serializeDate('2026-01-15', 'to', 'iso'), DAY_END.toISOString());

  const seen = [];
  const custom = (date, edge) => {
    seen.push([edge, date.getHours(), date.getMinutes()]);
    return `${edge}:${date.getFullYear()}`;
  };
  assert.equal(serializeDate('2026-01-15', 'from', custom), 'from:2026');
  assert.equal(serializeDate('2026-01-15', 'to', custom), 'to:2026');
  assert.deepEqual(seen, [['from', 0, 0], ['to', 23, 59]],
    'a custom serializer receives the edge instant, not the bare day');

  assert.equal(serializeDate('', 'from'), null);
  assert.equal(serializeDate(null, 'to'), null);
});

test('a one-day range still spans a whole day', () => {
  const value = serializeFilterValue({ created: { from: '2026-01-15', to: '2026-01-15' } }, fields());
  const { from, to } = /** @type {{from: number, to: number}} */ (value.created);
  assert.ok(to > from, 'the upper bound takes the end of its day or the range matches nothing');
  assert.equal(to - from, 86399);
});

test('select options are normalized from every spelling that reaches the component', () => {
  assert.deepEqual(normalizeOptions([{ value: 1, label: 'Open' }]), [{ value: 1, label: 'Open' }]);
  assert.deepEqual(normalizeOptions([{ ID: 7, name: 'Sales' }]), [{ value: 7, label: 'Sales' }]);
  assert.deepEqual(normalizeOptions(['Open', 3]), [{ value: 'Open', label: 'Open' }, { value: 3, label: '3' }]);
  assert.deepEqual(normalizeOptions([{ value: 0 }]), [{ value: 0, label: '0' }],
    'a value with no label is labelled by itself, including the falsy one');
  assert.deepEqual(normalizeOptions(undefined), []);
});

test('the emitted value carries only the constraints that are set', () => {
  assert.deepEqual(serializeFilterValue({
    subject: '   ',
    status: [],
    amount: { from: null, to: null },
    priority: null
  }, fields()), {}, 'nothing set is an empty query, not a query of empties');

  assert.deepEqual(serializeFilterValue({
    subject: '  invoice  ',
    status: [1, 2],
    amount: { from: 0, to: 250.5 },
    priority: 0
  }, fields()), {
    subject: 'invoice',
    status: [1, 2],
    amount: { from: 0, to: 250.5 },
    priority: 0
  }, 'text is trimmed, and a zero lower bound and a zero priority are both real constraints');
});

test('an unknown field type is excluded from the value rather than guessed at', () => {
  const value = serializeFilterValue({ location: '52.5,13.4', subject: 'x' }, fields());
  assert.deepEqual(value, { subject: 'x' });
  assert.equal('location' in value, false);
  assert.equal('location' in toDraft({ location: '52.5,13.4' }, fields()), false,
    'it never reaches the draft either, so nothing can put it back in');
});

test('values coming back as text still name the option and the number they mean', () => {
  assert.deepEqual(serializeFilterValue({
    status: ['1', 2, 99],
    amount: { from: '1.234,56' },
    priority: '3.7'
  }, fields()), {
    status: [1, 2],
    amount: { from: 1234.56 },
    priority: 3
  });
});

test('selected values come back in option order, not in the order they were asked for', () => {
  assert.deepEqual(serializeFilterValue({ status: [2, 0] }, fields()).status, [0, 2]);
});

test('a scalar date names its day from the start of it', () => {
  assert.equal(serializeFilterValue({ due: '2026-01-15' }, fields()).due,
    Math.floor(DAY_START.getTime() / 1000));
});

test('a range accepts the shorthands that reach it, and drops the edge it has no value for', () => {
  assert.deepEqual(serializeFilterValue({ amount: [10, 20] }, fields()).amount, { from: 10, to: 20 },
    'a two-element array is the pair it looks like');
  assert.deepEqual(serializeFilterValue({ amount: 10 }, fields()).amount, { from: 10 },
    'a bare number is the lower bound');
  assert.deepEqual(serializeFilterValue({ created: { to: '2026-01-15' } }, fields()).created,
    { to: Math.floor(DAY_END.getTime() / 1000) },
    'an open lower bound is left out rather than sent as null');
});

test('what the panel emits goes back in unchanged', () => {
  const declared = fields();
  const applied = serializeFilterValue({
    subject: 'invoice',
    status: [0, 1],
    created: { from: '2026-01-15', to: '2026-02-01' },
    due: '2026-03-04',
    amount: { from: 0, to: 500 },
    priority: 2
  }, declared);

  assert.deepEqual(serializeFilterValue(applied, declared), applied,
    'seconds that left the component are read back as the days they came from');
  assert.deepEqual(serializeFilterValue(serializeFilterValue(applied, declared, 'iso'), declared, 'iso'),
    serializeFilterValue(applied, declared, 'iso'), 'and so are ISO timestamps');
});

test('the draft is the shape the controls hold, and drafting it again changes nothing', () => {
  const declared = fields();
  const draft = toDraft({ status: ['1'], created: { from: 1768435200 }, priority: '4', subject: ' x ' }, declared);

  assert.deepEqual(draft.status, [1]);
  assert.equal(draft.subject, 'x');
  assert.equal(draft.priority, 4);
  assert.equal(typeof (/** @type {{from: string}} */ (draft.created).from), 'string',
    'a date edge is the YYYY-MM-DD a native date input holds');
  assert.equal(draft.due, '', 'an unset date is an empty input, not null');
  assert.deepEqual(/** @type {{from: number|null}} */ (draft.amount), { from: null, to: null });

  assert.deepEqual(toDraft(draft, declared), draft);
});

test('an empty field map is an empty query, not an error', () => {
  assert.deepEqual(serializeFilterValue({ anything: 1 }, {}), {});
  assert.deepEqual(toDraft({ anything: 1 }, {}), {});
  assert.deepEqual(serializeFilterValue(null, {}), {});
});

/*
 * `clear()` and `reset()` differ only in whether they commit, which is a decision the class makes
 * and no pure function can be asked about. These drive the real methods against the document
 * stand-in below — the same approach `record-view-controls.test.js` takes — because the bug they
 * guard against is exactly the one that does not show up in the value-building logic: a panel that
 * empties its controls and leaves the list filtered behind it.
 */

/** Two plain-input filters: enough to exercise the commit path without the composed controls. */
const PANEL_FIELDS = { subject: { type: 'text', label: 'Subject' }, due: { type: 'date', label: 'Due' } };

test('clear() empties the applied value, not only the controls', () => {
  withDocument(() => {
    const panel = new FilterPanel(null, { fields: PANEL_FIELDS, value: { subject: 'invoice' } });
    const events = [];
    panel.on('change', ({ detail }) => events.push(['change', JSON.stringify(detail.value)]));
    panel.on('apply', ({ detail }) => events.push(['apply', JSON.stringify(detail.value)]));

    assert.deepEqual(panel.getValue(), { subject: 'invoice' });
    panel.clear();

    assert.deepEqual(panel.getValue(), {},
      'a cleared panel must not keep filtering: the records would look missing with nothing on '
      + 'screen to explain why');
    assert.deepEqual(events, [['change', '{}'], ['apply', '{}']],
      'change first, then the apply that commits it');
    panel.destroy();
  });
});

test('reset() restores the controls and leaves the filters in force', () => {
  withDocument(() => {
    const panel = new FilterPanel(null, { fields: PANEL_FIELDS, value: { subject: 'invoice' } });
    panel.setValue({ subject: 'credit note' });
    const events = [];
    panel.on('change', ({ detail }) => events.push(['change', JSON.stringify(detail.value)]));
    panel.on('apply', () => events.push(['apply']));

    panel.reset();

    assert.deepEqual(panel.getValue(), { subject: 'credit note' },
      'the Cancel semantic: the controls go back, the list keeps what it is filtered by');
    assert.deepEqual(events, [['change', '{"subject":"invoice"}']], 'reset commits nothing');
    panel.destroy();
  });
});

test('live mode has no uncommitted draft, so reset() applies there too', () => {
  withDocument(() => {
    const panel = new FilterPanel(null, { fields: PANEL_FIELDS, value: { subject: 'invoice' }, mode: 'live' });
    panel.setValue({ subject: 'credit note' });
    const applied = [];
    panel.on('apply', ({ detail }) => applied.push(JSON.stringify(detail.value)));

    panel.reset();
    panel.clear();

    assert.deepEqual(applied, ['{"subject":"invoice"}', '{}']);
    assert.deepEqual(panel.getValue(), {});
    panel.destroy();
  });
});

/** @param {() => void} run Body that needs a document. @returns {void} */
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

/*
 * Enough of a document to build, drive and tear down a panel of plain inputs: element creation,
 * the property surface `h()` writes to, parent/child movement, and listeners that honour the
 * `AbortSignal` every `listen()` passes.
 */
class FakeNode {
  /** @param {number} [nodeType=1] Node type. */
  constructor(nodeType = 1) {
    this.nodeType = nodeType;
    /** @type {FakeNode[]} */
    this.children = [];
    /** @type {FakeNode|null} */
    this.parentNode = null;
    /** @type {{type: string, fn: Function}[]} */
    this.listeners = [];
  }

  /** @param {string} type Event name. @param {Function} fn Listener. @param {any} [options={}] Options. @returns {void} */
  addEventListener(type, fn, options = {}) {
    const entry = { type, fn };
    this.listeners.push(entry);
    options?.signal?.addEventListener('abort', () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== entry);
    }, { once: true });
  }

  /** @param {string} type Event name. @param {Function} fn Listener. @returns {void} */
  removeEventListener(type, fn) {
    this.listeners = this.listeners.filter((entry) => entry.type !== type || entry.fn !== fn);
  }

  /** @param {Event} event Event to dispatch. @returns {boolean} */
  dispatchEvent(event) {
    Object.defineProperty(event, 'target', { configurable: true, value: this });
    for (let node = this; node; node = event.bubbles ? node.parentNode : null) {
      for (const entry of [...node.listeners]) {
        if (entry.type === event.type) entry.fn.call(node, event);
      }
    }
    return !event.defaultPrevented;
  }

  /** @returns {FakeNode[]} */
  get childNodes() {
    return this.children;
  }

  /** @returns {boolean} */
  get isConnected() {
    return this.parentNode !== null;
  }

  /** @param {...FakeNode} children Children to append. @returns {void} */
  append(...children) {
    for (const child of children) {
      child.remove();
      child.parentNode = this;
      this.children.push(child);
    }
  }

  /** @param {...FakeNode} children Replacement children. @returns {void} */
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
}

class FakeElement extends FakeNode {
  /** @param {string} tag Tag name. */
  constructor(tag) {
    super(1);
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.id = '';
    this.value = '';
    this.type = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    /** @type {Record<string, string>} */
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {} };
    /** @type {Map<string, string>} */
    this.attributeMap = new Map();
    this.classList = {
      /** @param {string} name Class name. @returns {boolean} */
      contains: (name) => String(this.className).split(/\s+/).includes(name),
      /** @param {string} name Class name. @returns {void} */
      add: (name) => {
        if (!this.classList.contains(name)) this.className = `${this.className} ${name}`.trim();
      },
      /** @param {string} name Class name. @returns {void} */
      remove: (name) => {
        this.className = String(this.className).split(/\s+/).filter((one) => one !== name).join(' ');
      }
    };
  }

  /** @param {string} name Attribute name. @param {unknown} value Attribute value. @returns {void} */
  setAttribute(name, value) {
    this.attributeMap.set(name, String(value));
  }

  /** @param {string} name Attribute name. @returns {string|null} */
  getAttribute(name) {
    return this.attributeMap.has(name) ? this.attributeMap.get(name) : null;
  }

  /** @param {string} name Attribute name. @returns {void} */
  removeAttribute(name) {
    this.attributeMap.delete(name);
  }

  /** Nothing in these tests dispatches a delegated event. @returns {boolean} */
  matches() {
    return false;
  }
}

class FakeText extends FakeNode {
  /** @param {unknown} value Text content. */
  constructor(value) {
    super(3);
    this.textContent = String(value);
  }
}

class FakeDocument {
  /** @param {string} tag Tag name. @returns {FakeElement} */
  createElement(tag) {
    return new FakeElement(tag);
  }

  /** @param {unknown} value Text content. @returns {FakeText} */
  createTextNode(value) {
    return new FakeText(value);
  }
}
