import { DateTimeBox, Datebox, h } from '../../src/index.js';

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: 'var(--zx-space-5)'
};

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
  title: 'Datebox',
  group: 'Inputs',

  /** @param {HTMLElement} container Demo stage. @returns {void} */
  mount(container) {
    const log = output('Events appear here.');
    const standard = new Datebox(null, {
      value: new Date(2026, 6, 17),
      onchange: (event) => writeDate(log, 'default change', event.detail.date)
    });
    const datetime = DateTimeBox(null, {
      value: new Date(2026, 6, 17, 14, 35),
      onchange: (event) => writeDate(log, 'datetime change', event.detail.date)
    });
    const us = new Datebox(null, {
      value: '07/17/2026',
      format: '%m/%d/%Y',
      onchange: (event) => writeDate(log, 'US change', event.detail.date)
    });
    const invalid = new Datebox(null, {
      placeholder: 'Try 31.02.2026',
      oninvalid: (event) => {
        log.textContent = `invalid: kept “${event.detail.text}” for correction`;
      }
    });
    const unix = new Datebox(null, {
      value: 1784296800,
      clearable: true,
      onchange: (event) => writeDate(log, 'Unix box change', event.detail.date)
    });

    const unixReadout = output(`get('seconds') = ${unix.get('seconds')}`);
    const controls = h('div', {
      style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-2)' }
    },
    h('button', {
      type: 'button',
      onclick: () => {
        unixReadout.textContent = `get('seconds') = ${unix.get('seconds')}`;
      }
    }, 'Read Unix seconds'),
    h('button', {
      type: 'button',
      onclick: () => {
        unix.set(1798761600);
        unixReadout.textContent = `set(1798761600) → ${unix.get('seconds')}`;
      }
    }, 'Set Unix seconds'));

    const marker = h('div', { style: { display: 'grid', gap: 'var(--zx-space-5)' } },
      h('div', { style: gridStyle },
        card('Default format', h('code', {}, '%d.%m.%Y'), standard.el),
        card('Date and time', h('code', {}, '%d.%m.%Y %H:%M'), datetime.el),
        card('US format', h('code', {}, '%m/%d/%Y'), us.el),
        card('Invalid input',
          h('p', {}, 'Enter an impossible date and blur or press Enter. The text stays editable.'),
          invalid.el),
        card('Clear and Unix interop', unix.el, controls, unixReadout)
      ),
      log
    );
    container.append(marker);
    cleanupWhenRemoved(marker, [standard, datetime, us, invalid, unix]);
  }
};

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function card(title, ...children) {
  return h('section', { style: cardStyle }, h('h2', { style: { margin: '0' } }, title), ...children);
}

/** @param {string} text @returns {HTMLElement} */
function output(text) {
  return h('output', {
    ariaLive: 'polite',
    style: { color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
  }, text);
}

/** @param {HTMLElement} log @param {string} type @param {Date|null} date @returns {void} */
function writeDate(log, type, date) {
  log.textContent = `${type}: ${date ? date.toString() : 'null'}`;
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

