import { Dropdown, button, h } from '../../src/index.js';

const PLACEMENTS = ['bottom-start', 'bottom-end', 'top-start', 'top-end', 'bottom', 'top'];

export default {
  title: 'Dropdown',
  group: 'Overlays',
  blurb: 'A top-layer panel tethered to an anchor. It is the positioning primitive under Select, '
    + 'MenuButton, and the date pickers.',

  examples: [
    {
      title: 'All six placements',
      blurb: 'placement names the preferred side. A panel that would not fit flips vertically and '
        + 'clamps horizontally, so the requested placement is a preference rather than a promise — '
        + 'open one near the top or bottom of the window to see it.',
      render: ({ cleanup, log }) => {
        const dropdowns = PLACEMENTS.map((placement) => {
          const anchor = button({ label: placement });
          const dropdown = new Dropdown(anchor, {
            placement,
            content: h('div', { style: { display: 'grid', gap: 'var(--zx-space-2)', inlineSize: '190px' } },
              h('strong', {}, placement),
              h('span', { style: { color: 'var(--zx-color-text-muted)' } }, 'Manual top-layer panel'))
          });
          dropdown.on('open', () => log(`${placement}: open`));
          dropdown.on('close', () => log(`${placement}: close`));
          return { anchor, dropdown };
        });
        cleanup(() => dropdowns.forEach(({ dropdown }) => dropdown.destroy()));
        return h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--zx-space-6)',
            minBlockSize: '240px',
            alignItems: 'center'
          }
        }, dropdowns.map(({ anchor }) => h('div', { style: { display: 'grid', placeItems: 'center' } }, anchor)));
      }
    },
    {
      title: 'Matching the anchor width',
      blurb: 'matchWidth: true gives the panel the anchor’s width as a minimum — what a combobox '
        + 'list wants, so the options line up under the field that opened them.',
      render: ({ cleanup }) => {
        const anchor = button({ label: 'A 240px wide anchor' });
        anchor.style.inlineSize = '240px';
        const dropdown = new Dropdown(anchor, {
          matchWidth: true,
          content: h('div', {}, 'This panel has the anchor’s minimum width.')
        });
        cleanup(() => dropdown.destroy());
        return anchor;
      }
    },
    {
      title: 'Following a scrolling anchor',
      blurb: 'Open the panel, then scroll the inner container. The kernel uses CSS anchor '
        + 'positioning where the browser supports it and a JS fallback everywhere else; there is '
        + 'no toggle, because the two are meant to be indistinguishable.',
      render: ({ cleanup }) => {
        const anchor = button({ label: 'Scroll-following anchor' });
        const dropdown = new Dropdown(anchor, {
          placement: 'bottom-start',
          content: h('div', {}, 'I follow the anchor and flip near the viewport edge.')
        });
        cleanup(() => dropdown.destroy());
        return h('div', {
          style: {
            overflow: 'auto',
            blockSize: '220px',
            inlineSize: '100%',
            border: '1px solid var(--zx-color-border)',
            borderRadius: 'var(--zx-radius-md)',
            paddingInline: 'var(--zx-space-5)'
          }
        },
        h('div', { style: { blockSize: '130px' } }),
        anchor,
        h('div', { style: { blockSize: '300px' } }));
      }
    }
  ]
};
