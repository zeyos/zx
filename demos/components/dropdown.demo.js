import { Dropdown, h } from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-4)',
  marginBlockEnd: 'var(--zx-space-6)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

export default {
  title: 'Dropdown',
  group: 'Overlays',

  /**
   * Mounts placement, width matching, and scroll-following examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const instances = [];
    const log = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
    }, 'Open a dropdown to see its event.');
    const placementGrid = h('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'var(--zx-space-6)',
        alignItems: 'center',
        minBlockSize: '280px'
      }
    });

    for (const placement of ['bottom-start', 'bottom-end', 'top-start', 'top-end', 'bottom', 'top']) {
      const anchor = demoButton(placement);
      const dropdown = new Dropdown(anchor, {
        placement,
        content: panelContent(placement)
      });
      dropdown.on('open', () => { log.textContent = `${placement}: open`; });
      dropdown.on('close', () => { log.textContent = `${placement}: close`; });
      instances.push(dropdown);
      placementGrid.append(h('div', {
        style: { display: 'grid', placeItems: 'center', minBlockSize: '80px' }
      }, anchor));
    }

    const widthAnchor = demoButton('A 240 px wide anchor');
    widthAnchor.style.inlineSize = '240px';
    const widthDropdown = new Dropdown(widthAnchor, {
      matchWidth: true,
      content: h('div', {}, 'This panel has the anchor’s minimum width.')
    });
    instances.push(widthDropdown);

    const scrollAnchor = demoButton('Scroll-following anchor');
    const scrollDropdown = new Dropdown(scrollAnchor, {
      placement: 'bottom-start',
      content: h('div', {}, 'I follow the anchor and flip near the viewport edge.')
    });
    instances.push(scrollDropdown);
    const scroller = h('div', {
      style: {
        overflow: 'auto',
        blockSize: '220px',
        border: '1px solid var(--zx-color-border)',
        borderRadius: 'var(--zx-radius-md)',
        background: 'var(--zx-color-bg-page)',
        paddingInline: 'var(--zx-space-5)'
      }
    }, h('div', { style: { blockSize: '130px' } }), scrollAnchor, h('div', { style: { blockSize: '300px' } }));

    const marker = h('div', {},
      section('All six placements',
        h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } },
          'Open a panel near a viewport edge to see vertical flipping and inline clamping.'
        ),
        placementGrid,
        log
      ),
      section('Match anchor width', widthAnchor),
      section('Scroll-following check',
        h('p', { style: { margin: '0' } }, 'Open the panel, then scroll this inner container.'),
        scroller,
        h('small', { style: { color: 'var(--zx-color-text-muted)' } },
          'The kernel selects CSS anchor positioning when supported and its JS fallback otherwise; it exposes no force-fallback toggle.'
        )
      )
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => instances.forEach((instance) => instance.destroy()));
  }
};

/** @param {string} placement @returns {HTMLElement} */
function panelContent(placement) {
  return h('div', { style: { display: 'grid', gap: 'var(--zx-space-2)', inlineSize: '190px' } },
    h('strong', {}, placement),
    h('span', { style: { color: 'var(--zx-color-text-muted)' } }, 'Manual top-layer popover panel')
  );
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: sectionStyle },
    h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children
  );
}

/** @param {string} label @returns {HTMLButtonElement} */
function demoButton(label) {
  return /** @type {HTMLButtonElement} */ (h('button', { class: 'zx-btn', type: 'button' }, label));
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
