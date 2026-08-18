import { DateRangeBox, DateRangePicker, Form, h } from '../../src/index.js';

const cardStyle = {
  display: 'grid',
  alignContent: 'start',
  gap: 'var(--zx-space-3)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

export default {
  title: 'Date range',
  group: 'Inputs',
  blurb: 'Two calendars driven as one roving-focus grid: the first click opens a range, hovering '
    + 'or arrowing previews where it would end, and the second click closes it. DateRangeBox wraps '
    + 'the same picker in a typed text field with an anchored popover.',

  /** @param {HTMLElement} container Demo stage. @returns {void} */
  mount(container) {
    const log = eventLog('Pick a start date, then an end date.');

    const inline = new DateRangePicker(null, {
      start: new Date(2026, 7, 1),
      end: new Date(2026, 7, 14),
      presets: true,
      showWeekNumbers: true,
      onselect: (event) => write(log, 'select', event.detail),
      onchange: (event) => write(log, 'change', event.detail),
      onmonthchange: (event) => {
        log.textContent = `monthchange: ${event.detail.year}-${pad(event.detail.month + 1)}`;
      }
    });

    const box = new DateRangeBox(null, {
      start: new Date(2026, 7, 3),
      end: new Date(2026, 7, 9),
      presets: true,
      onchange: (event) => write(log, 'box change', event.detail),
      oninvalid: (event) => {
        log.textContent = `box invalid: kept “${event.detail.text}” for correction`;
      },
      onopen: () => { log.textContent = 'box open'; },
      onclose: () => { log.textContent = 'box close'; }
    });

    const bounded = new DateRangePicker(null, {
      months: 2,
      min: new Date(2026, 7, 10),
      max: new Date(2026, 8, 12),
      minNights: 3,
      maxNights: 21,
      onselect: (event) => write(log, 'bounded select', event.detail),
      onchange: (event) => write(log, 'bounded change', event.detail)
    });

    const form = new Form(null, {
      fieldsets: [{
        title: 'Reporting period',
        columns: 1,
        fields: {
          period: {
            type: 'daterange',
            label: 'Period',
            description: 'Registered as a Form field type; the value is a {start, end} pair.',
            value: { start: new Date(2026, 0, 1), end: new Date(2026, 2, 31) },
            props: { presets: true, clearable: true }
          }
        }
      }],
      actions: [{ label: 'Run report', type: 'submit', kind: 'primary' }],
      onsubmit: (event) => {
        const period = event.detail.values.period ?? {};
        log.textContent = `form submit: ${stamp(period.start)} → ${stamp(period.end)}`;
      }
    });

    const controls = h('div', {
      style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-2)' }
    },
    h('button', {
      type: 'button',
      onclick: () => inline.set({ start: new Date(2026, 7, 5), end: new Date(2026, 7, 20) })
    }, 'set() a range'),
    h('button', { type: 'button', onclick: () => inline.clear() }, 'clear()'),
    h('button', { type: 'button', onclick: () => inline.focus() }, 'focus()'),
    h('button', {
      type: 'button',
      onclick: () => {
        const range = inline.get();
        log.textContent = `get(): ${stamp(range.start)} → ${stamp(range.end)}`;
      }
    }, 'get()'));

    const marker = h('div', { style: { display: 'grid', gap: 'var(--zx-space-5)' } },
      card('Inline picker with presets',
        h('p', {}, 'Arrow keys move a day, PageUp/PageDown a month, Shift+PageUp/PageDown a year, '
          + 'Home/End jump to the ends of the week, Enter or Space selects, and Escape abandons a '
          + 'half-picked range. Both months share one tab stop, so arrowing right off 31 August '
          + 'continues on 1 September. Narrow the demo pane to watch the container query drop the '
          + 'second month.'),
        inline.el,
        controls),
      h('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-5)', alignItems: 'start' }
      },
      card('DateRangeBox in a form row',
        h('p', {}, 'Type “01.08.2026 – 14.08.2026”, or open the calendar with the button or '
          + 'ArrowDown. Unparseable text keeps the field editable and marks it invalid.'),
        h('div', {
          style: { display: 'flex', alignItems: 'center', gap: 'var(--zx-space-3)' }
        },
        h('label', { style: { fontWeight: '600' } }, 'Stay'),
        box.el)),
      card('Bounded: 10 August – 12 September, 3–21 nights',
        h('p', {}, 'Days outside the bounds stay keyboard-focusable but are marked '
          + 'aria-disabled. Once a start is picked, days that would break the night limits become '
          + 'unselectable too — clicking before the start restarts the range there instead.'),
        bounded.el)),
      card('daterange field type', form),
      log);

    container.append(marker);
    cleanupWhenRemoved(marker, [inline, box, bounded, form]);
  }
};

/** @param {string} title @param {...(Node|{toElement: () => Node})} children @returns {HTMLElement} */
function card(title, ...children) {
  return h('section', { style: cardStyle }, h('h2', { style: { margin: '0' } }, title), ...children);
}

/** @param {string} initial @returns {HTMLElement} */
function eventLog(initial) {
  return h('pre', {
    ariaLive: 'polite',
    style: {
      margin: '0',
      color: 'var(--zx-color-text-muted)',
      fontFamily: 'var(--zx-font-mono)'
    }
  }, initial);
}

/** @param {HTMLElement} log @param {string} type @param {{start: Date|null, end: Date|null}} range @returns {void} */
function write(log, type, range) {
  log.textContent = `${type}: ${stamp(range.start)} → ${stamp(range.end)}`;
}

/** @param {Date|null|undefined} date @returns {string} */
function stamp(date) {
  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : 'null';
}

/** @param {number} value @returns {string} */
function pad(value) {
  return String(value).padStart(2, '0');
}

/** @param {HTMLElement} marker @param {{destroy: () => void}[]} components @returns {void} */
function cleanupWhenRemoved(marker, components) {
  const observer = new MutationObserver(() => {
    if (marker.isConnected) return;
    for (const component of components) component.destroy();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
