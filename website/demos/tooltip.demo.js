import { Tooltip, describe, h, tooltip } from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-4)',
  marginBlockEnd: 'var(--zx-space-6)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

const PLACEMENTS = ['top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end'];

export default {
  title: 'Tooltip',
  group: 'Overlays',
  blurb: 'A description bubble that never takes focus and never takes the pointer: hover opens it '
    + 'after a beat, keyboard focus opens it at once, and touch leaves it alone.',

  /**
   * Mounts placement, trigger, content, and keyboard examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    /** @type {Tooltip[]} */
    const instances = [];
    const log = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
    }, 'Hover or tab to a control to see its events.');

    /**
     * Wires a tooltip's events into the shared log.
     * @param {Tooltip} instance Tooltip to watch.
     * @param {string} name Label used in the log line.
     * @returns {Tooltip}
     */
    function track(instance, name) {
      instance.on('open', () => { log.textContent = `${name}: open`; });
      instance.on('close', () => { log.textContent = `${name}: close`; });
      instances.push(instance);
      return instance;
    }

    /* ---------------------------------------------------------------- placements -- */

    const placementGrid = h('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 'var(--zx-space-6)',
        placeItems: 'center',
        paddingBlock: 'var(--zx-space-6)'
      }
    });

    for (const placement of PLACEMENTS) {
      const anchor = demoButton(placement);
      // `tooltip()` takes either a content value or a full option object.
      track(tooltip(anchor, { content: `Placed ${placement}`, placement, delay: 120 }), placement);
      placementGrid.append(anchor);
    }

    /* ------------------------------------------------------------------ keyboard -- */

    const keyboardRow = h('div', {
      style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-3)', alignItems: 'center' }
    });
    const save = demoButton('Save');
    const revert = demoButton('Revert');
    const search = h('input', {
      type: 'search', placeholder: 'Search records', style: { inlineSize: '200px' }
    });
    // `describe()` is the one-liner replacement for a title attribute: every default in place.
    track(describe(save, 'Writes the record and closes the editor.'), 'Save');
    track(describe(revert, 'Throws away every unsaved change.'), 'Revert');
    track(describe(search, 'Matches company, contact, and city.'), 'Search');
    keyboardRow.append(save, revert, search);

    /* ------------------------------------------------------------------- content -- */

    let hovers = 0;
    const counter = demoButton('Live content');
    track(tooltip(counter, {
      // A function is evaluated on every open, so the bubble can describe state that moved.
      content: () => `Opened ${(hovers += 1)} time${hovers === 1 ? '' : 's'}`,
      placement: 'bottom',
      delay: 120
    }), 'Live content');

    const rich = demoButton('Node content');
    track(tooltip(rich, {
      content: h('span', {},
        h('strong', {}, 'Danube Systems AG'),
        h('br'),
        'Quarterly business review every January.'
      ),
      placement: 'bottom-start',
      delay: 120
    }), 'Node content');

    const wide = demoButton('Narrow bubble');
    track(tooltip(wide, {
      content: 'A long description wraps at maxWidth instead of stretching across the viewport, '
        + 'so it stays readable next to the control it belongs to.',
      maxWidth: 180,
      placement: 'bottom',
      delay: 120
    }), 'Narrow bubble');

    /* ------------------------------------------------------------------ triggers -- */

    const hoverOnly = demoButton('Hover only');
    track(tooltip(hoverOnly, { content: 'Tabbing here shows nothing.', trigger: 'hover', delay: 120 }), 'Hover only');

    const focusOnly = demoButton('Focus only');
    track(tooltip(focusOnly, { content: 'Tab to me — the pointer is ignored.', trigger: 'focus' }), 'Focus only');

    const manualAnchor = demoButton('Manual');
    const manual = track(new Tooltip(manualAnchor, {
      content: 'Opened by toggle(), closed by nothing else.',
      trigger: 'manual',
      placement: 'top'
    }), 'Manual');
    const manualToggle = demoButton('toggle()', () => manual.toggle());

    const switchable = demoButton('Suppressible');
    const suppressible = track(tooltip(switchable, { content: 'Enabled.', delay: 120 }), 'Suppressible');
    const switchButton = demoButton('disable()', () => {
      if (suppressible.isDisabled()) {
        suppressible.enable();
        switchButton.textContent = 'disable()';
      } else {
        suppressible.disable();
        switchButton.textContent = 'enable()';
      }
    });

    /* --------------------------------------------------------------------- stage -- */

    const marker = h('div', {},
      section('Every placement',
        hint('The bubble flips to the other side when the preferred one would leave the viewport.'),
        placementGrid,
        log
      ),
      section('Keyboard and screen readers',
        hint('Tab through these three controls. Keyboard focus opens the tooltip immediately — a '
          + 'keyboard user cannot “hover a moment longer”. While open, the control carries '
          + 'aria-describedby; Escape dismisses it without moving focus.'),
        keyboardRow
      ),
      section('Content',
        hint('Content may be text, a node, or a function re-evaluated on every open.'),
        row(counter, rich, wide)
      ),
      section('Triggers',
        hint('trigger: hover, focus, both (the default), or manual — which installs no listeners '
          + 'at all and leaves everything to show(), hide(), and toggle().'),
        row(hoverOnly, focusOnly, manualAnchor, manualToggle, switchable, switchButton)
      )
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => instances.forEach((instance) => instance.destroy()));
  }
};

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: sectionStyle },
    h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children
  );
}

/** @param {string} text @returns {HTMLElement} */
function hint(text) {
  return h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } }, text);
}

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', {
    style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-3)', alignItems: 'center' }
  }, children);
}

/** @param {string} label @param {() => void} [onclick] @returns {HTMLButtonElement} */
function demoButton(label, onclick) {
  return /** @type {HTMLButtonElement} */ (
    h('button', { class: 'zx-btn', type: 'button', onclick }, label)
  );
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
