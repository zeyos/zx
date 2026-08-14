import { NumberField, h } from '../../src/index.js';

export default {
  title: 'Number field',
  group: 'Inputs',
  blurb: 'A spinbutton with step buttons: bounded ranges, fractional steps, units, and wrapping.',

  /**
   * Mounts quantity, currency, percentage, and wrapping number fields.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Type, use the arrow keys, or click the buttons.');

    const quantity = new NumberField(null, {
      value: 1,
      min: 1,
      max: 999,
      onchange: (event) => write(log, `quantity → ${event.detail.value}`)
    });

    const price = new NumberField(null, {
      value: 1249.9,
      min: 0,
      step: 0.01,
      group: true,
      unit: '€',
      onchange: (event) => write(log, `price → ${event.detail.value}`)
    });

    const discount = new NumberField(null, {
      value: 5,
      min: 0,
      max: 100,
      step: 2.5,
      unit: '%',
      onchange: (event) => write(log, `discount → ${event.detail.value}`)
    });

    const hour = new NumberField(null, {
      value: 9,
      min: 0,
      max: 23,
      wrap: true,
      onchange: (event) => write(log, `hour → ${event.detail.value}`)
    });

    const empty = new NumberField(null, {
      value: null,
      min: 10,
      max: 500,
      step: 10,
      placeholder: 'Optional',
      onchange: (event) => write(log, `budget → ${event.detail.value ?? 'empty'}`)
    });

    const disabled = new NumberField(null, { value: 42, disabled: true });
    const readonly = new NumberField(null, { value: 7, readonly: true });

    container.append(
      section('Common shapes',
        row(
          field('Quantity (1–999)', quantity.toElement()),
          field('Price (step 0.01, grouped)', price.toElement()),
          field('Discount (step 2.5)', discount.toElement())
        )),
      section('Empty, wrapping, and inert',
        row(
          field('Budget (starts empty)', empty.toElement()),
          field('Hour (wraps 0–23)', hour.toElement()),
          field('Disabled', disabled.toElement()),
          field('Read-only', readonly.toElement())
        ),
        note('An empty field steps to its minimum first. A wrapping field jumps from its maximum '
          + 'back to its minimum, which is what hour and minute pickers want.')),
      section('Keyboard',
        note('↑/↓ step by one. PageUp/PageDown step by ten. Home and End jump to the minimum and '
          + 'maximum when they are set, and otherwise keep their normal caret meaning. The step '
          + 'buttons are pointer affordances only — they are not in the tab order, because the '
          + 'input itself is the spinbutton.'),
        row(
          h('button', { class: 'zx-btn', type: 'button', onclick: () => quantity.stepUp(5) },
            'quantity.stepUp(5)'),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => quantity.set(null) },
            'quantity.set(null)'),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => price.setRange(0, 100) },
            'price.setRange(0, 100)')
        )),
      log
    );
  }
};

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 'var(--zx-space-4)'
  } }, children);
}

/** @param {string} label @param {Node} control @returns {HTMLElement} */
function field(label, control) {
  return h('label', { style: { display: 'grid', gap: 'var(--zx-space-1)' } },
    h('span', { style: { color: 'var(--zx-color-text-muted)', fontSize: 'var(--zx-text-sm)' } }, label),
    control);
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: {
    display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
    border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
    background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-5)'
  } }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', { style: {
    margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
  } }, text);
}

/** @param {string} text @returns {HTMLOutputElement} */
function output(text) {
  return /** @type {HTMLOutputElement} */ (h('output', {
    ariaLive: 'polite', style: { display: 'block', color: 'var(--zx-color-text-muted)' }
  }, text));
}

/** @param {HTMLElement} log @param {string} text @returns {void} */
function write(log, text) {
  log.textContent = text;
}
