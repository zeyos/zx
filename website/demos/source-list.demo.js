import { SourceList, button, h } from '../../src/index.js';

// The sources an answer cites, in the order its [n] markers number them: a web page, a file, a
// customer record, and the tool call a figure came from. No favicon is ever loaded for them.
function answerSources() {
  return [
    {
      id: 'fees', kind: 'web', title: 'Late payment fees for business accounts', site: 'bank.example',
      href: 'https://bank.example/business/late-fees', snippet: 'A fee of €40 applies to each invoice paid more than 30 days late.'
    },
    {
      id: 'policy', kind: 'file', title: 'Dunning policy 2026', site: 'dunning-policy.pdf',
      snippet: 'A second reminder goes out 14 days after the first, and names the fee.'
    },
    {
      id: 'customer', kind: 'record', title: 'Harbor Logistics GmbH', site: 'Customer', ref: { entity: 'customer', id: 'C-1042' },
      snippet: 'Note from 12 October: agreed a payment plan for RE-0121.'
    },
    {
      id: 'bank', kind: 'call', title: 'Bank feed match since 1 October', site: 'bank.match', call: 'bank',
      snippet: '5 payments matched, 2 invoices still open.'
    }
  ];
}

export default {
  title: 'Source list',
  group: 'Agents',
  api: ['SourceList'],
  blurb: 'The sources an answer cites, as numbered chips with a card of each one’s title, '
    + 'site, and the passage used. It never loads a remote resource.',

  examples: [
    {
      title: 'Chips',
      blurb: 'Activating a source emits a preventable select. Unprevented, a web source opens its '
        + 'https address in a new tab; every other kind is the application’s to handle, for '
        + 'example by revealing the trace step it came from. highlight(n) answers a citation [n].',
      layout: 'stack',
      width: '560px',
      render: ({ cleanup, log }) => {
        const list = new SourceList(null, { sources: answerSources() });
        list.on('select', (event) => {
          const { source, n } = event.detail;
          // Kept from opening here; without preventDefault() a web source opens in a new tab.
          if (source.kind === 'web') event.preventDefault();
          log(`select [${n}] ${source.kind}: ${source.href ?? source.ref?.id ?? source.call ?? source.title}`);
        });
        cleanup(() => list.destroy());
        return [
          list.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Cite [2]', onclick: () => list.highlight(2) }),
            button({ label: 'Cite [4]', onclick: () => list.highlight(4) }))
        ];
      }
    },
    {
      title: 'As a list',
      blurb: 'layout: \'list\' gives each source a row with its title and where it is — the '
        + 'host a web address opens, or the site. Pass label: \'\' to drop the visible label when a '
        + 'heading above already names the list.',
      layout: 'stack',
      width: '420px',
      render: ({ cleanup, log }) => {
        const list = new SourceList(null, { sources: answerSources(), layout: 'list', label: 'Cited in this answer' });
        list.on('select', (event) => {
          event.preventDefault();
          log(`select ${event.detail.source.id}`);
        });
        cleanup(() => list.destroy());
        return list.toElement();
      }
    }
  ]
};
