import { SplitView, h } from '../../src/index.js';

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
  title: 'Split view',
  group: 'Layout',
  blurb: 'Two panes and a divider the user owns: drag it, tab to it and use the arrow keys, '
    + 'double-click to reset, and — where it is allowed — fold a pane away entirely.',

  /**
   * Mounts horizontal, vertical, nested, and collapsible examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    /** @type {SplitView[]} */
    const instances = [];
    const log = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
    }, 'Drag the divider, or tab to it and press the arrow keys.');

    /* --------------------------------------------------------------- horizontal -- */

    // The split view takes over an element that already has a height, so the panes have one too.
    const horizontal = new SplitView(stage('260px'), {
      start: pane('Records', '8 contacts in this filter.'),
      end: pane('Details', 'Everything about the selected record.'),
      size: '38%',
      min: 180,
      max: 520,
      // A drag that ends within 12px of 38%, the minimum, or the maximum lands exactly on it.
      snap: 12,
      // Remembered across reloads; a storage area that refuses writes degrades to memory.
      storageKey: 'demo-records',
      onresize: (event) => {
        log.textContent = `resize → ${Math.round(event.detail.size)}px `
          + `(${(event.detail.ratio * 100).toFixed(1)}%)`;
      },
      onresizeend: (event) => {
        log.textContent = `resizeend → ${Math.round(event.detail.size)}px `
          + `(${(event.detail.ratio * 100).toFixed(1)}%)`;
      }
    });
    instances.push(horizontal);

    /* ----------------------------------------------------------------- vertical -- */

    const vertical = new SplitView(stage('280px'), {
      orientation: 'vertical',
      start: pane('Query', 'The editor keeps the top of the screen.'),
      end: pane('Result', 'The grid takes whatever is left below it.'),
      size: 120,
      min: 64
    });
    instances.push(vertical);

    /* ------------------------------------------------------------------- nested -- */

    const inner = new SplitView(null, {
      orientation: 'vertical',
      start: pane('Message', 'Subject, sender, and body.'),
      end: pane('Attachments', 'Two files.'),
      size: '60%',
      min: 60
    });
    // The nested view is a block child of a pane, so give it the pane's full height.
    /** @type {HTMLElement} */ (inner.toElement()).style.blockSize = '100%';
    const nested = new SplitView(stage('320px'), {
      start: pane('Folders', 'Inbox, Assigned, Sent, Archive.'),
      end: inner,
      size: 200,
      min: 120,
      max: 320
    });
    instances.push(inner, nested);

    /* -------------------------------------------------------------- collapsible -- */

    const collapseLog = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
    }, 'The start pane is showing.');
    const collapsible = new SplitView(stage('240px'), {
      start: pane('Navigation', 'Enter or Space on the divider folds this away.'),
      end: pane('Workspace', 'This pane takes the whole width once the other is gone.'),
      size: 220,
      min: 140,
      collapsible: 'start',
      oncollapse: (event) => { collapseLog.textContent = `collapse → ${event.detail.pane}`; },
      onexpand: () => { collapseLog.textContent = 'expand → start is back at its old size'; }
    });
    instances.push(collapsible);

    const collapseControls = row(
      demoButton('collapse()', () => collapsible.collapse('start')),
      demoButton('expand()', () => collapsible.expand()),
      demoButton('setSize(320)', () => collapsible.setSize(320)),
      demoButton('Report', () => {
        collapseLog.textContent = `getSize() → ${Math.round(collapsible.getSize())}px, `
          + `isCollapsed() → ${collapsible.isCollapsed()}`;
      })
    );

    /* ---------------------------------------------------------------- disabling -- */

    const lockable = new SplitView(stage('200px'), {
      start: pane('Fixed', 'Resizing is blocked while the divider is disabled.'),
      end: pane('Fixed', 'The divider leaves the tab order too.'),
      size: '50%'
    });
    instances.push(lockable);
    const lockButton = demoButton('disable()', () => {
      if (lockable.isDisabled()) {
        lockable.enable();
        lockButton.textContent = 'disable()';
      } else {
        lockable.disable();
        lockButton.textContent = 'enable()';
      }
    });

    /* -------------------------------------------------------------------- stage -- */

    const marker = h('div', {},
      section('Horizontal',
        hint('Drag the divider, or double-click it to go back to the initial 38%. The size is '
          + 'clamped to [180, 520] every frame and while the container shrinks.'),
        horizontal.toElement(),
        log
      ),
      section('Keyboard',
        hint('Tab to a divider: ← → move it by 16px (↑ ↓ when the split is vertical), Shift '
          + 'moves 64px, Home goes to the minimum, End to the maximum, and Enter or Space folds a '
          + 'collapsible pane away. The divider is a separator carrying aria-valuenow, '
          + 'aria-valuemin, and aria-valuemax in pixels.'),
        collapsible.toElement(),
        collapseControls,
        collapseLog
      ),
      section('Vertical',
        hint('orientation: "vertical" stacks the panes behind a horizontal divider; the size '
          + 'option then means the height of the top pane.'),
        vertical.toElement()
      ),
      section('Nested',
        hint('A split view is ordinary content, so one pane can hold another — here a vertical '
          + 'split inside the trailing pane of a horizontal one.'),
        nested.toElement()
      ),
      section('Disabled',
        hint('disable() blocks the pointer and the keyboard and takes the divider out of the tab '
          + 'order; the programmatic setters keep working.'),
        lockable.toElement(),
        row(lockButton)
      )
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => instances.forEach((instance) => instance.destroy()));
  }
};

/** @param {string} blockSize @returns {HTMLElement} */
function stage(blockSize) {
  return h('div', {
    style: {
      blockSize,
      overflow: 'hidden',
      border: '1px solid var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-md)',
      background: 'var(--zx-color-bg-page)'
    }
  });
}

/** @param {string} title @param {string} body @returns {HTMLElement} */
function pane(title, body) {
  return h('div', {
    style: {
      display: 'grid',
      gap: 'var(--zx-space-2)',
      alignContent: 'start',
      padding: 'var(--zx-space-4)'
    }
  },
  h('strong', {}, title),
  h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } }, body)
  );
}

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

/** @param {string} label @param {() => void} onclick @returns {HTMLButtonElement} */
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
