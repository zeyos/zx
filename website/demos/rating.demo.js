import { Rating, h } from '../../src/index.js';

export default {
  title: 'Rating',
  group: 'Inputs',
  blurb: 'A star rating built as a radio group: one tab stop, arrow-key selection, optional half '
    + 'steps, and a read-only display mode.',

  /**
   * Mounts interactive, half-step, read-only, and custom-symbol ratings.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Pick a rating with the mouse or the arrow keys.');

    const basic = new Rating(null, {
      value: 3,
      label: 'Overall satisfaction',
      showValue: true,
      onchange: (event) => write(log, `satisfaction → ${event.detail.value || 'cleared'}`)
    });

    const halves = new Rating(null, {
      value: 3.5,
      allowHalf: true,
      showValue: true,
      label: 'Service quality',
      onchange: (event) => write(log, `service → ${event.detail.value}`)
    });

    const labelled = new Rating(null, {
      value: 4,
      label: 'Priority',
      labels: ['Very low', 'Low', 'Normal', 'High', 'Critical'],
      onchange: (event) => write(log, `priority → ${event.detail.value}`),
      onhover: (event) => {
        if (event.detail.value !== null) write(log, `preview → ${event.detail.value}`);
      }
    });

    const readonly = new Rating(null, {
      value: 4.5,
      allowHalf: true,
      readonly: true,
      showValue: true,
      count: 128,
      label: 'Average customer rating'
    });

    const hearts = new Rating(null, { value: 2, icon: 'heart', max: 3, size: 'lg', label: 'Favourite' });
    const large = new Rating(null, { value: 7, max: 10, size: 'sm', label: 'Score out of ten', showValue: true });
    const disabled = new Rating(null, { value: 2, disabled: true, label: 'Locked rating' });

    container.append(
      section('Interactive',
        row(
          field('Whole steps', basic.toElement()),
          field('Half steps', halves.toElement()),
          field('Named steps', labelled.toElement())
        ),
        note('Clicking the current value clears it, because `clearable` defaults to true. '
          + 'Delete and Backspace do the same from the keyboard.')),
      section('Display and variants',
        row(
          field('Read-only with a count', readonly.toElement()),
          field('Hearts, three of them', hearts.toElement()),
          field('Ten small steps', large.toElement()),
          field('Disabled', disabled.toElement())
        )),
      section('Programmatic API',
        row(
          h('button', { class: 'zx-btn', type: 'button', onclick: () => basic.set(5) }, 'set(5)'),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => basic.clear() }, 'clear()'),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => readonly.setCount(129) },
            'setCount(129)'),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => basic.focus() }, 'focus()')
        )),
      log
    );
  }
};

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 'var(--zx-space-6)'
  } }, children);
}

/** @param {string} label @param {Node} control @returns {HTMLElement} */
function field(label, control) {
  return h('div', { style: { display: 'grid', gap: 'var(--zx-space-2)' } },
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
