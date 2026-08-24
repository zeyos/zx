import { Sheet, SheetStack, button, h } from '../../src/index.js';

/** @param {string} text @returns {HTMLElement} */
function prose(text) {
  return h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } }, text);
}

/** @returns {{title: string, blurb: string}[]} */
function levels() {
  return [
    { title: 'Northwind GmbH', blurb: 'The customer record. Everything below drills into it.' },
    { title: 'Invoice #4021', blurb: 'One of the customer’s invoices.' },
    { title: 'Line item 3', blurb: 'A single position on that invoice.' }
  ];
}

export default {
  title: 'SheetStack',
  group: 'Overlays',
  blurb: 'A group of Sheets that reads as one drill-down — and stays small, because the browser '
    + 'already stacks dialogs and already makes Escape unwind them one at a time.',

  examples: [
    {
      title: 'Two ways to show depth',
      blurb: 'stack slides covered sheets back toward their edge, scales them down, and takes '
        + 'them out of the tab order — only the top one is usable. cascade shifts each covered '
        + 'sheet clear of the ones in front, by their measured size rather than a guess, so they '
        + 'sit side by side and all stay usable. For an ERP screen cascade is usually the one you '
        + 'want: the parent record stays readable while a line item is edited.',
      render: ({ cleanup, log }) => {
        const build = (layout) => {
          const group = new SheetStack({ layout, offset: 28 });
          const sheets = levels().map(({ title, blurb }, index) => new Sheet(null, {
            side: 'end', title, size: 300 + index * 24, content: prose(blurb)
          }));
          group.on('push', ({ detail }) => log(`${layout}: pushed ${detail.sheet.options.title}`));
          group.on('pop', ({ detail }) => log(`${layout}: popped ${detail.sheet.options.title}`));
          return { group, sheets };
        };
        const drill = build('stack');
        const side = build('cascade');
        cleanup(() => {
          for (const { group, sheets } of [drill, side]) {
            group.destroy();
            sheets.forEach((sheet) => sheet.destroy());
          }
        });
        const openAll = ({ group, sheets }) => sheets.forEach((sheet) => group.push(sheet));
        return [
          button({ label: 'Drill down (stack)', kind: 'primary', onclick: () => openAll(drill) }),
          button({ label: 'Side by side (cascade)', onclick: () => openAll(side) })
        ];
      }
    },
    {
      title: 'Unwinding',
      blurb: 'Escape closes the topmost sheet and nothing else — that is the browser’s own '
        + 'behaviour, not something the stack implements. popTo() returns to any sheet in the '
        + 'group, clear() closes them all, and pop fires however a sheet left: popped, dismissed '
        + 'with Escape, or closed by its own button.',
      render: ({ cleanup, log }) => {
        const group = new SheetStack({ layout: 'cascade' });
        const sheets = levels().map(({ title, blurb }, index) => new Sheet(null, {
          side: 'end', title, size: 300 + index * 24, content: prose(blurb)
        }));
        group.on('pop', ({ detail }) => log(`popped ${detail.sheet.options.title} — ${group.size()} left`));
        cleanup(() => { group.destroy(); sheets.forEach((sheet) => sheet.destroy()); });
        return [
          button({ label: 'Open all three', kind: 'primary', onclick: () => sheets.forEach((s) => group.push(s)) }),
          button({ label: 'Pop one', onclick: () => group.pop() }),
          button({ label: 'Back to the customer', onclick: () => group.popTo(sheets[0]) }),
          button({ label: 'Close all', onclick: () => group.clear() })
        ];
      }
    }
  ]
};
