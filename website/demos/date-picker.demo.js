import { DatePicker, MonthPicker, TimePicker, h } from '../../src/index.js';

const cardStyle = {
  display: 'grid',
  gap: 'var(--zx-space-3)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

export default {
  title: 'Date picker',
  group: 'Inputs',

  /** @param {HTMLElement} container Demo stage. @returns {void} */
  mount(container) {
    const log = eventLog('Choose a date, month, or time.');
    const calendar = new DatePicker(null, {
      value: new Date(2026, 6, 17, 9, 30),
      min: new Date(2026, 6, 10),
      max: new Date(2026, 7, 12),
      showWeekNumbers: true,
      onchange: (event) => write(log, 'date change', event.detail.date),
      onmonthchange: (event) => {
        log.textContent = `monthchange: ${event.detail.year}-${String(event.detail.month + 1).padStart(2, '0')}`;
      }
    });
    const months = new MonthPicker(null, {
      value: new Date(2026, 6, 1),
      min: new Date(2026, 2, 1),
      max: new Date(2027, 8, 1),
      onchange: (event) => write(log, 'month change', event.detail.date)
    });
    const time = new TimePicker(null, {
      value: { h: 14, m: 35, s: 20 },
      seconds: true,
      step: 5,
      onchange: (event) => {
        const value = event.detail.time;
        log.textContent = `time change: ${pad(value.h)}:${pad(value.m)}:${pad(value.s)}`;
      }
    });

    const marker = h('div', {
      style: { display: 'grid', gap: 'var(--zx-space-5)' }
    },
    card('Calendar with bounds and week numbers',
      h('p', {}, 'Dates outside 10 July–12 August remain keyboard-focusable but cannot be selected.'),
      calendar.el),
    h('div', {
      style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-5)', alignItems: 'start' }
    },
    card('Month picker', months.el),
    card('Time picker',
      h('p', {}, 'Arrow keys step each spinbutton; entering two digits advances focus. The clock '
        + 'button opens a dial: pick an hour on the outer (1–12) or inner (13–23, 00) ring and it '
        + 'moves on to the minutes. Pass clock: false to leave the spinbuttons on their own.'),
      time.el)),
    log);
    container.append(marker);
    cleanupWhenRemoved(marker, [calendar, months, time]);
  }
};

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
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

/** @param {HTMLElement} log @param {string} type @param {Date|null} value @returns {void} */
function write(log, type, value) {
  log.textContent = `${type}: ${value ? value.toString() : 'null'}`;
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

