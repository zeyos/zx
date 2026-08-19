import { SplitView, button, h } from '../../src/index.js';

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
    style: { display: 'grid', gap: 'var(--zx-space-2)', alignContent: 'start', padding: 'var(--zx-space-4)' }
  },
  h('strong', {}, title),
  h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } }, body));
}

export default {
  title: 'Split view',
  group: 'Layout',
  blurb: 'Two panes and a divider the reader owns: drag it, tab to it and use the arrow keys, '
    + 'double-click to reset, and \u2014 where it is allowed \u2014 fold a pane away entirely.',

  examples: [
    {
      title: 'Horizontal, with snapping and a remembered size',
      blurb: 'Drag the divider, or double-click it to go back to the initial 38%. The size is '
        + 'clamped to [180, 520] every frame, including while the container shrinks. snap: 12 '
        + 'makes a drag that ends within 12px of the initial size or a bound land exactly on it, '
        + 'and storageKey remembers the result across reloads.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const split = new SplitView(stage('260px'), {
          start: pane('Records', '8 contacts in this filter.'),
          end: pane('Details', 'Everything about the selected record.'),
          size: '38%',
          min: 180,
          max: 520,
          snap: 12,
          storageKey: 'demo-records',
          onresizeend: ({ detail }) =>
            log(`resizeend \u2192 ${Math.round(detail.size)}px (${(detail.ratio * 100).toFixed(1)}%)`)
        });
        cleanup(() => split.destroy());
        return split.toElement();
      }
    },
    {
      title: 'Keyboard and collapsing',
      blurb: 'Tab to the divider: \u2190 \u2192 move it by 16px, Shift moves 64px, Home goes to the '
        + 'minimum, End to the maximum, and Enter or Space folds a collapsible pane away. The '
        + 'divider is a separator carrying aria-valuenow, aria-valuemin, and aria-valuemax in '
        + 'pixels, so a screen reader announces the position as a number.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const split = new SplitView(stage('240px'), {
          start: pane('Navigation', 'Enter or Space on the divider folds this away.'),
          end: pane('Workspace', 'This pane takes the whole width once the other is gone.'),
          size: 220,
          min: 140,
          collapsible: 'start',
          oncollapse: ({ detail }) => log(`collapse \u2192 ${detail.pane}`),
          onexpand: () => log('expand \u2192 start is back at its old size')
        });
        cleanup(() => split.destroy());
        return [
          split.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: "collapse('start')", onclick: () => split.collapse('start') }),
            button({ label: 'expand()', onclick: () => split.expand() }),
            button({ label: 'setSize(320)', onclick: () => split.setSize(320) }),
            button({
              label: 'getSize()',
              onclick: () => log(`getSize() \u2192 ${Math.round(split.getSize())}px, isCollapsed() \u2192 ${split.isCollapsed()}`)
            }))
        ];
      }
    },
    {
      title: 'Vertical',
      blurb: 'orientation: "vertical" stacks the panes behind a horizontal divider; size then '
        + 'means the height of the top pane.',
      render: ({ cleanup }) => {
        const split = new SplitView(stage('280px'), {
          orientation: 'vertical',
          start: pane('Query', 'The editor keeps the top of the screen.'),
          end: pane('Result', 'The grid takes whatever is left below it.'),
          size: 120,
          min: 64
        });
        cleanup(() => split.destroy());
        return split.toElement();
      }
    },
    {
      title: 'Nested',
      blurb: 'A split view is ordinary content, so one pane can hold another \u2014 here a vertical '
        + 'split inside the trailing pane of a horizontal one, which is the classic mail layout.',
      render: ({ cleanup }) => {
        const inner = new SplitView(null, {
          orientation: 'vertical',
          start: pane('Message', 'Subject, sender, and body.'),
          end: pane('Attachments', 'Two files.'),
          size: '60%',
          min: 60
        });
        /** @type {HTMLElement} */ (inner.toElement()).style.blockSize = '100%';
        const outer = new SplitView(stage('320px'), {
          start: pane('Folders', 'Inbox, Assigned, Sent, Archive.'),
          end: inner,
          size: 200,
          min: 120,
          max: 320
        });
        cleanup(() => [inner, outer].forEach((split) => split.destroy()));
        return outer.toElement();
      }
    },
    {
      title: 'Disabled',
      blurb: 'disable() blocks the pointer and the keyboard and takes the divider out of the tab '
        + 'order, while the programmatic setters keep working.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const split = new SplitView(stage('200px'), {
          start: pane('Fixed', 'Resizing is blocked while the divider is disabled.'),
          end: pane('Fixed', 'The divider leaves the tab order too.'),
          size: '50%'
        });
        const toggle = button({ label: 'disable()' });
        toggle.addEventListener('click', () => {
          const off = split.isDisabled();
          if (off) split.enable();
          else split.disable();
          toggle.textContent = off ? 'disable()' : 'enable()';
        });
        cleanup(() => split.destroy());
        return [split.toElement(), toggle];
      }
    }
  ]
};
