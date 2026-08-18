import { Toolbar, button, h } from '../../src/index.js';

export default {
  title: 'Toolbar',
  group: 'Layout',
  blurb: 'One tab stop, arrow-key navigation, and an overflow menu that swallows what no longer fits.',

  /**
   * Mounts a record action bar, the alignment variants, and the programmatic API.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Activate an item — from the row or from the overflow menu.');

    // A realistic record action bar: primary action, editing actions, view toggles, and a tail of
    // secondary actions that are the first to collapse.
    const actions = new Toolbar(null, {
      label: 'Record actions',
      items: [
        { name: 'new', label: 'New', icon: 'plus', kind: 'primary' },
        { name: 'edit', label: 'Edit', icon: 'gear' },
        { name: 'delete', label: 'Delete', icon: 'trash', kind: 'danger' },
        '-',
        { name: 'list', label: 'List', icon: 'list', kind: 'ghost', active: true },
        { name: 'cards', label: 'Cards', icon: 'square', kind: 'ghost', active: false },
        '-',
        { name: 'filter', label: 'Filter', icon: 'filter' },
        { name: 'refresh', label: 'Refresh', icon: 'reload' },
        { name: 'export', label: 'Export', icon: 'upload' },
        { name: 'print', label: 'Print', icon: 'file' },
        { name: 'settings', label: 'Settings', icon: 'settings' }
      ],
      onaction: (event) => {
        const { name } = event.detail;
        if (name === 'list' || name === 'cards') {
          actions.setActive('list', name === 'list').setActive('cards', name === 'cards');
        }
        log.textContent = `action: ${name}`;
      }
    });

    const aligned = ['start', 'end', 'between'].map((align) => new Toolbar(null, {
      label: `Aligned ${align}`,
      align,
      overflow: false,
      items: [
        { name: 'back', label: 'Back', icon: 'chevron-left', kind: 'ghost' },
        { name: 'save', label: 'Save', icon: 'check', kind: 'primary' },
        '-',
        { name: 'more', label: 'Duplicate', icon: 'code' }
      ]
    }));

    // Element items are placed as they are; a `data-name` makes them reachable through getItem().
    const link = h('a', {
      href: '#components/toolbar',
      'data-name': 'help',
      class: 'zx-btn',
      'data-kind': 'ghost',
      'data-size': 'sm',
      style: { textDecoration: 'none' }
    }, 'Help');
    const dense = new Toolbar(null, {
      label: 'Dense toolbar',
      dense: true,
      items: [
        { name: 'cut', label: 'Cut', icon: 'x', kind: 'ghost' },
        { name: 'copy', label: 'Copy', icon: 'code', kind: 'ghost' },
        { name: 'paste', label: 'Paste', icon: 'file', kind: 'ghost', disabled: true },
        '-',
        { name: 'pin', label: 'Pin', icon: 'star', kind: 'ghost', active: false },
        link
      ],
      onaction: (event) => {
        if (event.detail.name === 'pin') {
          const pressed = dense.getItem('pin').getAttribute('aria-pressed') === 'true';
          dense.setActive('pin', !pressed);
        }
        log.textContent = `action: ${event.detail.name}`;
      }
    });

    const toolbars = [actions, ...aligned, dense];
    const marker = h('div', {},
      section('Record action bar',
        note('Drag the handle in the bottom-right corner of the frame. As the row runs out of '
          + 'room the trailing items are hidden and mirrored into the overflow menu — choosing one '
          + 'there activates the original control, so a collapsed item behaves exactly like a '
          + 'visible one. Tab reaches the toolbar once, then Arrow Left and Arrow Right move '
          + 'between the controls and Home and End jump to the ends.'),
        resizable(actions.toElement()),
        log),

      section('Alignment',
        note('`align` distributes the row: `start` (the default), `end`, and `between`. These '
          + 'examples set `overflow: false`, so they keep every item at any width.'),
        stack(...aligned.map((toolbar, index) => labelled(
          ['start', 'end', 'between'][index], toolbar.toElement()
        )))),

      section('Dense rows, Element items, and the API',
        note('`dense: true` tightens the gaps and drops the buttons to their small size. Any '
          + 'Element can be an item — the link below is plain markup — and `data-name` makes it '
          + 'reachable through `getItem()`.'),
        dense.toElement(),
        row(
          h('button', { type: 'button', onclick: () => actions.disable('delete') }, 'Disable delete'),
          h('button', { type: 'button', onclick: () => actions.enable('delete') }, 'Enable delete'),
          h('button', { type: 'button', onclick: () => actions.setActive('cards', true) }, 'Activate cards'),
          h('button', {
            type: 'button',
            onclick: () => actions.setItems([
              { name: 'new', label: 'New', icon: 'plus', kind: 'primary' },
              '-',
              { name: 'close', label: 'Close', icon: 'x' },
              button({ label: 'Raw button element', icon: 'star', size: 'sm' })
            ])
          }, 'Replace items'),
          h('button', {
            type: 'button',
            onclick: () => { log.textContent = `getItem('help') → ${dense.getItem('help')?.outerHTML.slice(0, 60)}…`; }
          }, "getItem('help')")
        ))
    );

    container.append(marker);
    cleanupWhenRemoved(marker, () => toolbars.forEach((toolbar) => toolbar.destroy()));
  }
};

/** @param {Node} child @returns {HTMLElement} */
function resizable(child) {
  return h('div', {
    style: {
      resize: 'horizontal', overflow: 'auto', inlineSize: '100%', minInlineSize: '180px',
      maxInlineSize: '100%', border: '1px dashed var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-lg)', padding: 'var(--zx-space-3)'
    }
  }, child);
}

/** @param {string} title @param {Node} child @returns {HTMLElement} */
function labelled(title, child) {
  return h('div', { style: { display: 'grid', gap: 'var(--zx-space-2)' } },
    h('span', {
      style: {
        color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)',
        fontSize: 'var(--zx-text-sm)'
      }
    }, title),
    h('div', {
      style: {
        border: '1px dashed var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
        padding: 'var(--zx-space-3)'
      }
    }, child));
}

/** @param {...Node} children @returns {HTMLElement} */
function stack(...children) {
  return h('div', { style: { display: 'grid', gap: 'var(--zx-space-4)' } }, children);
}

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', {
    style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)' }
  }, children);
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', {
    style: {
      display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
      border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
      background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-5)'
    }
  }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', {
    style: {
      margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
    }
  }, text);
}

/** @param {string} text @returns {HTMLOutputElement} */
function output(text) {
  return /** @type {HTMLOutputElement} */ (h('output', {
    ariaLive: 'polite', style: { display: 'block', color: 'var(--zx-color-text-muted)' }
  }, text));
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
