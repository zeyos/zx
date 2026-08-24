import { Dock, Field, Sheet, button, h, stack } from '../../src/index.js';

/** @returns {{label: string, value: string}[]} */
function invoiceLines() {
  return [
    { label: 'Subscription — Q3', value: '€ 4,200.00' },
    { label: 'Onboarding, 12 h', value: '€ 1,440.00' },
    { label: 'Support retainer', value: '€ 600.00' }
  ];
}

/** @param {string} text @returns {HTMLElement} */
function prose(text) {
  return h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } }, text);
}

/** @returns {HTMLElement} */
function summary() {
  return stack({ gap: 3 },
    ...invoiceLines().map(({ label, value }) => h('div', {
      style: { display: 'flex', justifyContent: 'space-between', gap: 'var(--zx-space-4)' }
    }, h('span', {}, label), h('strong', { style: { fontVariantNumeric: 'tabular-nums' } }, value))));
}

export default {
  title: 'Sheet',
  group: 'Overlays',
  blurb: 'An edge-anchored Dialog — one component covers both side sheets and mobile drawers, '
    + 'since only the edge and presentation differ.',

  examples: [
    {
      title: 'Sides',
      blurb: 'side is logical, so start and end follow the writing direction while top and bottom '
        + 'are fixed. A top or bottom sheet rounds its inner corners, which is what makes the same '
        + 'component read as a drawer on a phone.',
      render: ({ cleanup, log }) => {
        const sheets = ['start', 'end', 'top', 'bottom'].map((side) => {
          const sheet = new Sheet(null, {
            side,
            title: `Sheet from ${side}`,
            content: prose(`This sheet is anchored to the ${side} edge. Escape or the backdrop closes it.`),
            buttons: [{ label: 'Done', kind: 'primary', action: 'close' }]
          });
          sheet.on('close', () => log(`${side}: closed`));
          return { side, sheet };
        });
        cleanup(() => sheets.forEach(({ sheet }) => sheet.destroy()));
        return sheets.map(({ side, sheet }) =>
          button({ label: side, onclick: () => sheet.open() }));
      }
    },
    {
      title: 'Modality',
      blurb: 'Three real behaviours, not two. A modal sheet hands focus containment, page '
        + 'inertness, Escape, and the backdrop to the browser. trap-focus keeps the page scrolling '
        + 'but holds Tab inside. false leaves everything interactive — useful for an inspector you '
        + 'keep open while working in the table behind it.',
      render: ({ cleanup, log }) => {
        const modes = [
          { modal: true, label: 'modal' },
          { modal: 'trap-focus', label: 'trap-focus' },
          { modal: false, label: 'non-modal' }
        ];
        const sheets = modes.map(({ modal, label }) => {
          const sheet = new Sheet(null, {
            modal,
            title: label,
            size: 340,
            content: stack({ gap: 4 },
              prose(modal === true
                ? 'The page behind is inert and locked from scrolling.'
                : 'The page behind still scrolls. Try it.'),
              new Field(null, { type: 'text', name: 'note', label: 'Note' }).toElement())
          });
          sheet.on('open', () => log(`${label}: open`));
          sheet.on('close', () => log(`${label}: closed`));
          return sheet;
        });
        cleanup(() => sheets.forEach((sheet) => sheet.destroy()));
        return sheets.map((sheet, index) =>
          button({ label: modes[index].label, onclick: () => sheet.open() }));
      }
    },
    {
      title: 'Backdrop',
      blurb: 'dim is the default, blur reads --zx-overlay-blur, and none keeps the sheet modal '
        + 'without shading what is behind it. Only a modal sheet has a ::backdrop at all, so the '
        + 'option does nothing for the other two modalities — deliberately, rather than painting a '
        + 'fake backdrop that would make a non-blocking sheet look blocking.',
      render: ({ cleanup }) => {
        const sheets = ['dim', 'blur', 'none'].map((backdrop) => new Sheet(null, {
          backdrop,
          title: `backdrop: ${backdrop}`,
          content: prose('Look at the page behind this sheet.'),
          buttons: [{ label: 'Close', action: 'close' }]
        }));
        cleanup(() => sheets.forEach((sheet) => sheet.destroy()));
        return ['dim', 'blur', 'none'].map((backdrop, index) =>
          button({ label: backdrop, onclick: () => sheets[index].open() }));
      }
    },
    {
      title: 'Resizing, detents, and swipe',
      blurb: 'One gesture, not three. Dragging the inner edge resizes; with snap it settles on the '
        + 'nearest detent instead of wherever you let go; and pulling it below half the smallest '
        + 'detent dismisses it. Which one a drag turns out to be is decided when the pointer '
        + 'settles, so the sheet follows your finger the whole way. The handle is a separator with '
        + 'live values \u2014 arrow keys step it, Shift steps further.',
      render: ({ cleanup, log }) => {
        const resizable = new Sheet(null, {
          side: 'end', title: 'Resizable', size: 360, resizable: true, min: 260, max: 640,
          content: prose('Drag the left edge. Arrow keys work too, once it has focus.')
        });
        const drawer = new Sheet(null, {
          side: 'bottom', title: 'Bottom drawer', snap: [0.3, 0.6, 0.95], min: 120,
          content: prose('Drag the handle between the three detents, or flick it down to dismiss.')
        });
        for (const [name, sheet] of Object.entries({ resizable, drawer })) {
          sheet.on('resize', ({ detail }) => log(`${name}: ${Math.round(detail.size)}px`));
          sheet.on('close', () => log(`${name}: closed`));
        }
        cleanup(() => { resizable.destroy(); drawer.destroy(); });
        return [
          button({ label: 'Resizable sheet', onclick: () => resizable.open() }),
          button({ label: 'Drawer with detents', onclick: () => drawer.open() }),
          button({ label: 'Snap to largest', onclick: () => { drawer.open(); drawer.snapTo(2); } })
        ];
      }
    },
    {
      title: 'Adopted by a Dock',
      blurb: 'A Dock can take over a sheet\u2019s positioning: the sheet becomes a track in the '
        + 'dock\u2019s flow rather than an overlay, and the dock owns its side and size. Give it a '
        + 'dockAt breakpoint and the dock hands it back to a free overlay when it gets too narrow \u2014 '
        + 'measured on the dock\u2019s own width, not the viewport. Nothing is rebuilt across the '
        + 'handoff, so listeners and scroll position survive it.',
      layout: 'plain',
      render: ({ cleanup, log }) => {
        const dock = new Dock(null, {
          orientation: 'horizontal',
          content: h('div', { style: { padding: 'var(--zx-space-4)' } }, 'Invoice list')
        });
        const sheet = new Sheet(null, {
          side: 'end',
          title: 'Invoice #4021',
          content: prose('Docked, this sheet squeezes the list beside it. Floating, it covers it.')
        });
        sheet.on('dockchange', ({ detail }) => log(detail.docked ? 'docked' : 'floating'));
        dock.adopt(sheet, { side: 'end', size: 280, dockAt: 'md' });
        cleanup(() => { sheet.destroy(); dock.destroy(); });
        return stack({ gap: 4 },
          h('div', { class: 'demo-row' },
            button({ label: 'Open', kind: 'primary', onclick: () => sheet.open() }),
            button({ label: 'Close', onclick: () => sheet.close() })),
          h('div', {
            class: 'demo-resizable',
            style: {
              display: 'grid',
              blockSize: '260px',
              border: '1px solid var(--zx-color-border)',
              borderRadius: 'var(--zx-radius-lg)',
              overflow: 'hidden',
              resize: 'horizontal'
            }
          }, dock.toElement()),
          h('p', { style: { margin: '0', fontSize: 'var(--zx-text-sm)', color: 'var(--zx-color-text-muted)' } },
            'Drag the bottom-right corner narrower than 768px to watch it hand itself back.'));
      }
    },
    {
      title: 'A record detail sheet',
      blurb: 'The shape an ERP screen actually uses: a title, a scrolling body, and footer '
        + 'actions. Everything here is inherited from Dialog — Sheet only moved it to the edge.',
      render: ({ cleanup, log }) => {
        const sheet = new Sheet(null, {
          side: 'end',
          size: 420,
          title: 'Invoice #4021',
          content: stack({ gap: 5 },
            summary(),
            new Field(null, {
              type: 'select', name: 'status', label: 'Status',
              options: { open: 'Open', paid: 'Paid', overdue: 'Overdue' }, value: 'open'
            }).toElement(),
            new Field(null, { type: 'textarea', name: 'note', label: 'Internal note' }).toElement()),
          buttons: [
            { label: 'Cancel', action: 'close' },
            { label: 'Save', kind: 'primary', action: (instance) => { log('saved'); instance.close('saved'); } }
          ]
        });
        cleanup(() => sheet.destroy());
        return button({ label: 'Open invoice', kind: 'primary', onclick: () => sheet.open() });
      }
    }
  ]
};
