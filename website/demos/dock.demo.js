import { Dock, Field, Table, badge, button, h, stack } from '../../src/index.js';

/** @returns {{ref: string, customer: string, total: string}[]} */
function invoiceRows() {
  return [
    { ref: 'INV-4021', customer: 'Northwind GmbH', total: '€ 6,240.00' },
    { ref: 'INV-4022', customer: 'Contoso AG', total: '€ 1,180.00' },
    { ref: 'INV-4023', customer: 'Fabrikam Ltd', total: '€ 12,900.00' },
    { ref: 'INV-4024', customer: 'Tailspin BV', total: '€ 430.00' }
  ];
}

const INVOICE_COLUMNS = [
  { id: 'ref', label: 'Reference' },
  { id: 'customer', label: 'Customer' },
  { id: 'total', label: 'Total', align: 'end' }
];

/** @param {[string, string][]} rows @returns {HTMLElement} */
function facts(rows) {
  return stack({ gap: 2 }, ...rows.map(([label, value]) => h('div', {
    style: { display: 'flex', justifyContent: 'space-between', gap: 'var(--zx-space-4)' }
  },
  h('span', { style: { color: 'var(--zx-color-text-muted)' } }, label),
  h('span', { style: { fontVariantNumeric: 'tabular-nums' } }, value))));
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } }, text);
}

/**
 * A dock has no size of its own, so a host that wants one filled has to supply the height —
 * `display: grid` makes the dock stretch into it. Without that the growing pane gets nothing.
 * @param {Node} child Dock element.
 * @param {string} [height='380px'] Frame height.
 * @returns {HTMLElement}
 */
function frame(child, height = '380px') {
  return h('div', {
    style: {
      display: 'grid',
      blockSize: height,
      inlineSize: '100%',
      border: '1px solid var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-lg)',
      overflow: 'hidden'
    }
  }, child);
}

export default {
  title: 'Dock',
  group: 'Layout',
  blurb: 'A stack of collapsible, resizable panes — the inspector column of a design tool, and the '
    + 'detail side of a master–detail screen.',

  examples: [
    {
      title: 'An object inspector',
      blurb: 'The common shape: several panes describing one record, each collapsible to its '
        + 'header and resizable by the divider above it. Exactly one pane grows to absorb the '
        + 'slack, which is what keeps the column filled however many are collapsed.',
      layout: 'plain',
      width: 380,
      render: ({ cleanup, log }) => {
        const dock = new Dock(null, {
          panes: [
            { name: 'summary', title: 'Summary', size: 130, content: facts([
              ['Reference', 'INV-4021'], ['Customer', 'Northwind GmbH'],
              ['Issued', '2026-08-01'], ['Due', '2026-09-01']
            ]) },
            { name: 'status', title: 'Status', size: 120, content: stack({ gap: 3 },
              badge({ label: 'Open', kind: 'warning' }),
              note('Payment reminder queued for 2026-09-08.')) },
            { name: 'notes', title: 'Internal notes', grow: true, content: note(
              'Framework agreement renewed in June. Net 30 agreed by exception.') },
            { name: 'audit', title: 'Audit trail', collapsed: true, content: note('7 changes.') }
          ]
        });
        dock.on('collapse', ({ detail }) => log(`collapsed ${detail.name}`));
        dock.on('expand', ({ detail }) => log(`expanded ${detail.name}`));
        cleanup(() => dock.destroy());
        return frame(dock.toElement());
      }
    },
    {
      title: 'Tab groups',
      blurb: 'A pane with tabs puts its strip where the title would go, so several panes share one '
        + 'slot in the stack. That is the pattern every panel dock uses, and it is why tabs is a '
        + 'key on a pane rather than a component nested inside one.',
      layout: 'plain',
      width: 380,
      render: ({ cleanup, log }) => {
        const dock = new Dock(null, {
          panes: [
            { name: 'props', title: 'Properties', size: 190, content: stack({ gap: 3 },
              new Field(null, { type: 'text', name: 'ref', label: 'Reference', value: 'INV-4021' }).toElement(),
              new Field(null, {
                type: 'select', name: 'status', label: 'Status', value: 'open',
                options: { open: 'Open', paid: 'Paid', overdue: 'Overdue' }
              }).toElement()) },
            { name: 'library', title: 'Library', grow: true, active: 'symbols', tabs: [
              { name: 'swatches', title: 'Swatches', content: () => note('Six swatches.') },
              { name: 'symbols', title: 'Symbols', content: () => note('Symbol grid goes here.') },
              { name: 'styles', title: 'Styles', content: () => note('Paragraph and character styles.') }
            ] },
            { name: 'colour', title: 'Color', collapsed: true, content: note('Colour picker.') }
          ]
        });
        dock.on('tabchange', ({ detail }) => log(`${detail.pane}: ${detail.previous} → ${detail.tab}`));
        cleanup(() => dock.destroy());
        return frame(dock.toElement());
      }
    },
    {
      title: 'A region with content',
      blurb: 'Give the dock a content and it becomes a region: the content takes the middle and '
        + 'absorbs the slack, and each pane declares which side of it to sit on. Nest one dock in '
        + 'another pane and you have a workbench — a canvas with an inspector column beside it.',
      layout: 'plain',
      render: ({ cleanup }) => {
        const table = new Table(null, { columns: INVOICE_COLUMNS, data: invoiceRows(), rowId: 'ref' });
        const inspector = new Dock(null, {
          panes: [
            { name: 'detail', title: 'Detail', size: 140, content: facts([
              ['Reference', 'INV-4023'], ['Customer', 'Fabrikam Ltd'], ['Total', '€ 12,900.00']
            ]) },
            { name: 'history', title: 'History', grow: true, content: note('Sent 2026-08-12.') }
          ]
        });
        const workbench = new Dock(null, {
          orientation: 'horizontal',
          content: table,
          panes: [
            { name: 'nav', title: 'Filters', side: 'start', size: 160, content: note('Saved filters.') },
            { name: 'inspector', title: 'Inspector', side: 'end', size: 260, content: inspector }
          ]
        });
        cleanup(() => { workbench.destroy(); inspector.destroy(); table.destroy(); });
        return frame(workbench.toElement(), '420px');
      }
    },
    {
      title: 'Revealing and remembering',
      blurb: 'reveal() takes a pane name or a tab name, expands whatever holds it, activates the '
        + 'right tab, and scrolls it into view — the one call a "show me this" link needs. Give '
        + 'the dock a storageKey and sizes, collapsed panes, and active tabs come back next visit.',
      layout: 'plain',
      width: 380,
      render: ({ cleanup, log }) => {
        const dock = new Dock(null, {
          storageKey: 'demo-inspector',
          panes: [
            { name: 'summary', title: 'Summary', size: 100, content: note('Totals and dates.') },
            { name: 'docs', title: 'Documents', size: 110, collapsed: true, tabs: [
              { name: 'files', title: 'Files', content: () => note('3 attachments.') },
              { name: 'mail', title: 'Mail', content: () => note('Last sent 2026-08-12.') }
            ] },
            { name: 'audit', title: 'Audit trail', grow: true, collapsed: true, content: note('7 changes.') }
          ]
        });
        dock.on('reveal', ({ detail }) => log(`revealed ${detail.name}`));
        cleanup(() => dock.destroy());
        return stack({ gap: 4 },
          h('div', { class: 'demo-row' },
            button({ label: 'Reveal audit trail', onclick: () => dock.reveal('audit') }),
            button({ label: 'Reveal the Mail tab', onclick: () => dock.reveal('mail') })),
          frame(dock.toElement(), '300px'));
      }
    }
  ]
};
