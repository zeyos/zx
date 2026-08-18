import { Stepper, button, h } from '../../src/index.js';

const CHECKOUT = [
  { name: 'cart', title: 'Cart', description: 'Article and quantity' },
  { name: 'address', title: 'Address', description: 'Where it ships' },
  { name: 'payment', title: 'Payment', description: 'How you pay', optional: true },
  { name: 'confirm', title: 'Confirm', description: 'Review and place' }
];

export default {
  title: 'Stepper',
  group: 'Layout',
  blurb: 'The wizard progress rail: four step states, an optional “Step 2 of 4” counter, and a '
    + 'preventable change event so a step can refuse to be left.',

  /**
   * Mounts a horizontal wizard rail with a vetoable step change, plus a vertical variant.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Use Continue and Back, or click a completed step to go back to it.');
    const veto = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox' }));
    const stage = h('div', { style: {
      display: 'grid', gap: 'var(--zx-space-1)',
      border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
      background: 'var(--zx-color-bg-muted)', padding: 'var(--zx-space-4)'
    } });

    // 1 — a horizontal rail driving a stage. The rail owns "where"; the content stays the
    //     application's, exactly as in the checkout and record wizard layouts.
    const wizard = new Stepper(null, {
      counter: true,
      steps: CHECKOUT,
      onchange: (event) => {
        // `change` is preventable: this is where a real wizard would validate the step being left.
        if (veto.checked && event.detail.index > wizard.getIndex()) {
          event.preventDefault();
          write(log, `vetoed: ${event.detail.previous} → ${event.detail.name}`);
          return;
        }
        write(log,
          `change: ${event.detail.previous} → ${event.detail.name} (index ${event.detail.index})`);
        // The event fires *before* the move is applied, so repaint on the next microtask to read
        // the state the user ended up in rather than the one they left.
        queueMicrotask(showStage);
      }
    });

    const back = button({ label: 'Back', icon: 'chevron-left', onclick: () => wizard.previous() });
    const next = button({
      label: 'Continue',
      kind: 'primary',
      icon: 'chevron-right',
      onclick: () => wizard.next()
    });

    /** Repaints the stage and the toolbar from the rail's state. @returns {void} */
    function showStage() {
      const state = wizard.getState();
      stage.replaceChildren(
        h('strong', {}, `You are on “${state.active}”`),
        h('span', { style: { color: 'var(--zx-color-text-muted)', fontSize: 'var(--zx-text-sm)' } },
          `completed: [${state.completed.join(', ') || '—'}] · `
          + `errored: [${state.errored.join(', ') || '—'}]`));
      back.disabled = state.index <= 0;
      next.disabled = state.index >= CHECKOUT.length - 1;
    }
    showStage();

    // 2 — the same component laid out vertically, with every enabled step reachable.
    const rail = new Stepper(null, {
      orientation: 'vertical',
      clickable: 'all',
      steps: [
        { name: 'draft', title: 'Draft', description: 'Prepare the quotation' },
        { name: 'review', title: 'Internal review', description: 'Two approvals required' },
        { name: 'sent', title: 'Sent to customer', optional: true },
        { name: 'signed', title: 'Signed' },
        { name: 'invoiced', title: 'Invoiced', disabled: true, description: 'Unlocks once signed' }
      ],
      active: 'review',
      onchange: (event) => write(log, `rail change: → ${event.detail.name}`)
    });
    rail.complete('draft');

    const marker = h('div', {},
      section('Wizard rail',
        note('Advancing marks every step it passed complete, so a completed step turns into a '
          + 'button that takes the user back to it. Tick the checkbox to veto forward moves the '
          + 'way a failing form validation would.'),
        wizard.toElement(),
        stage,
        row(back, next, check(veto, 'Veto forward moves')),
        row(
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => {
              const errored = !wizard.getState().errored.includes('address');
              wizard.setError('address', errored);
              write(log, `setError('address', ${errored})`);
              showStage();
            }
          }, 'Toggle error on “Address”'),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => {
              wizard.goTo('cart');
              for (const step of CHECKOUT) wizard.uncomplete(step.name);
              wizard.setError('address', false);
              showStage();
              write(log, 'reset');
            }
          }, 'Reset'))),
      section('Vertical rail',
        note('orientation: "vertical" turns the connectors into a spine beside the steps, and '
          + 'clickable: "all" lets the user jump to anything that is not disabled. “Invoiced” is '
          + 'disabled, so Tab skips it and next() walks past it.'),
        rail.toElement()),
      section('Keyboard',
        note('Clickable steps are ordinary buttons in the document tab order: Tab reaches them, '
          + 'Enter or Space activates them. Steps that cannot be entered right now — upcoming '
          + 'steps under the default clickable: "completed", and disabled steps in every mode — '
          + 'are not focusable at all. The active step carries aria-current="step".')),
      log);

    container.append(marker);
    cleanupWhenRemoved(marker, () => {
      wizard.destroy();
      rail.destroy();
    });
  }
};

/** @param {HTMLInputElement} input @param {string} label @returns {HTMLElement} */
function check(input, label) {
  return h('label', { style: {
    display: 'inline-flex', alignItems: 'center', gap: 'var(--zx-space-2)'
  } }, input, label);
}

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)'
  } }, children);
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

/** @param {Node} marker @param {() => void} cleanup @returns {void} */
function cleanupWhenRemoved(marker, cleanup) {
  const observer = new MutationObserver(() => {
    if (marker.isConnected) return;
    cleanup();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
