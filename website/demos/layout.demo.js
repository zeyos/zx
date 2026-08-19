import { aspect, badge, breakpointOf, button, grid, h, onBreakpoint, stack } from '../../src/index.js';

export default {
  title: 'Layout',
  group: 'Layout',
  api: ['Stack', 'Grid', 'Aspect'],
  blurb: 'The small pieces under Panel and SplitView: consistent spacing, a grid that reflows on '
    + 'its own width rather than the viewport, and a fixed-ratio box.',

  examples: [
    {
      title: 'Stack',
      blurb: 'One-dimensional flow with one spacing decision. gap takes 1–8 from the spacing scale '
        + 'or any CSS length; direction: "row" turns the same call into a toolbar row. The classes '
        + 'are plain — .zx-stack works from server-rendered markup with no JavaScript at all.',
      render: () => [
        h('div', { class: 'demo-field' }, h('span', {}, 'Column, gap 2'),
          stack({ gap: 2 },
            badge({ label: 'Draft' }), badge({ label: 'Posted', kind: 'success' }),
            badge({ label: 'Overdue', kind: 'danger' }))),
        h('div', { class: 'demo-field' }, h('span', {}, 'Row, wrapping'),
          stack({ direction: 'row', gap: 2, wrap: true },
            button({ label: 'Save', kind: 'primary' }), button({ label: 'Save and new' }),
            button({ label: 'Discard', kind: 'ghost' }))),
        h('div', { class: 'demo-field' }, h('span', {}, 'Row, pushed apart'),
          h('div', { style: 'inline-size: 100%' },
            stack({ direction: 'row', justify: 'between', gap: 3 },
              h('strong', {}, 'Invoice INV-1042'), badge({ label: 'Overdue', kind: 'danger' }))))
      ]
    },
    {
      title: 'Grid',
      blurb: 'Drag the box wider and narrower. The grid asks for four columns but never lets a '
        + 'track go below min, so it drops to three, then two, then one — on its own width, not '
        + 'the window’s. That is why it behaves the same inside a split pane or a modal, where '
        + 'a media-query grid gets it wrong.',
      render: () => {
        const cell = (text) => h('div', { class: 'demo-card' }, text);
        return h('div', { class: 'demo-resizable' },
          grid({ columns: 4, min: 140, gap: 3 },
            cell('Revenue'), cell('Open items'), cell('Overdue'), cell('Credit notes'),
            cell('Orders'), cell('Deliveries'), cell('Returns'), cell('Stock'))
        );
      }
    },
    {
      title: 'Grid without a column count',
      blurb: 'Leaving columns out fills each row with as many min-wide tracks as fit. Use it when '
        + 'the item count varies and no particular number of columns is meaningful.',
      render: () => h('div', { class: 'demo-resizable' },
        grid({ min: 180, gap: 3 },
          ...['Nordwind GmbH', 'Halbe Systeme', 'Kestrel Ltd', 'Aurora AB', 'Vega Handel']
            .map((name) => h('div', { class: 'demo-card' }, name)))
      )
    },
    {
      title: 'Aspect ratio',
      blurb: 'Holds its ratio at any width, so an image, a map, or a chart reserves its space '
        + 'before it loads and nothing below it jumps.',
      render: () => h('div', { style: 'inline-size: 260px' },
        aspect({ ratio: '16 / 9' },
          h('div', { class: 'demo-card', style: 'display: grid; place-items: center' }, '16 : 9'))
      )
    },
    {
      title: 'Reacting to width from script',
      blurb: 'Zx’s own utilities reflow without breakpoints, so this module is for the decisions '
        + 'only script can make — rendering a Table as cards below a width, collapsing a panel. '
        + 'onBreakpoint watches an element, not the viewport, which is the whole point inside a '
        + 'split pane. Resize the box.',
      render: ({ cleanup }) => {
        const readout = h('strong', {}, '…');
        const box = h('div', { class: 'demo-resizable' },
          h('p', {}, 'This box is at breakpoint ', readout, '.'),
          h('p', { class: 'demo-caption' }, 'xs < 480 · sm 480 · md 768 · lg 1024 · xl 1280')
        );
        const controller = onBreakpoint(
          (name, width) => { readout.textContent = `${name} (${Math.round(width)}px)`; },
          { target: box }
        );
        cleanup(() => controller.destroy());
        return [box, h('p', { class: 'demo-caption' },
          `breakpointOf(900) is "${breakpointOf(900)}"`)];
      }
    }
  ]
};
