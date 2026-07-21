import { Timebox, h } from '../../src/index.js';

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
  title: 'Timebox',
  group: 'Inputs',

  /** @param {HTMLElement} container Demo stage. @returns {void} */
  mount(container) {
    const minutesOutput = readout();
    const secondsOutput = readout();
    const signedOutput = readout();
    const minutes = new Timebox(null, {
      value: 95,
      unit: 'minutes',
      onchange: (event) => show(minutesOutput, event.detail.value, 'minutes')
    });
    const seconds = new Timebox(null, {
      value: 90061,
      unit: 'seconds',
      seconds: true,
      onchange: (event) => show(secondsOutput, event.detail.value, 'seconds')
    });
    const signed = new Timebox(null, {
      value: -90,
      unit: 'minutes',
      signed: true,
      onchange: (event) => show(signedOutput, event.detail.value, 'minutes')
    });
    show(minutesOutput, minutes.get(), 'minutes');
    show(secondsOutput, seconds.get(), 'seconds');
    show(signedOutput, signed.get(), 'minutes');

    const marker = h('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 'var(--zx-space-5)'
      }
    },
    card('Minutes unit', minutes.el, minutesOutput),
    card('Seconds unit with >24h', seconds.el, secondsOutput),
    card('Signed duration', signed.el, signedOutput));
    container.append(marker);
    cleanupWhenRemoved(marker, [minutes, seconds, signed]);
  }
};

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function card(title, ...children) {
  return h('section', { style: cardStyle }, h('h2', { style: { margin: '0' } }, title), ...children);
}

/** @returns {HTMLElement} */
function readout() {
  return h('output', {
    ariaLive: 'polite',
    style: { color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
  });
}

/** @param {HTMLElement} output @param {number} value @param {string} unit @returns {void} */
function show(output, value, unit) {
  output.textContent = `${value} ${unit}`;
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
