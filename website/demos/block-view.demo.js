import { BlockView, button, h, prefersReducedMotion } from '../../src/index.js';

// An agent's answer as blocks: plain JSON the agent produces and the view draws. Inside a text
// run, **bold**, `code`, and [n] citations are the whole grammar — nothing is read as HTML.
function forecastAnswer() {
  return [
    { type: 'p', text: 'October should close about **€62,400.00** ahead of September [1][2].' },
    { type: 'figures', rows: [
      ['Expected in', '58 invoices', '€246,800.00'],
      ['Going out', 'Payroll and 14 bills', '€184,400.00']
    ] },
    { type: 'heading', level: 2, text: 'The tight week' },
    { type: 'p', text: 'The second payroll leaves on `27 Oct`, three days before Alpine Works pays [1].' },
    { type: 'list', items: ['Ask Alpine Works to pay on the 25th', 'Move the Bruckner bill to November'] },
    { type: 'callout', tone: 'warning', title: 'Assumption', text: 'Helios Energie pays on its due date, as it has six times running.' },
    { type: 'table', columns: ['Day', 'In', 'Out'], align: [null, 'end', 'end'], rows: [
      ['15 Oct', '€38,200.00', '€85,600.00'],
      ['27 Oct', '€12,900.00', '€98,800.00']
    ] },
    { type: 'code', language: 'sql', code: "select due, sum(total)\n  from invoices\n where status = 'open' -- October only\n group by due;" },
    { type: 'artifact', id: 'forecast', title: 'October cash forecast', kind: 'document', versions: 2 }
  ];
}

// The sources the citations point at, in citation order.
function forecastSources() {
  return [
    { id: 'invoices', title: 'Open invoices · October 2026', kind: 'record', site: 'Invoices' },
    { id: 'payroll', title: 'Payroll calendar · October', kind: 'record', site: 'Payroll' }
  ];
}

// The same answer as a stream of text, the way a model writes it.
const STREAMED = 'Three invoices are more than **14 days** overdue [1]. Kestrel\'s was reissued on '
  + '`7 Oct`, so it is left out.\n\nI drafted a first reminder for each of the other three; nothing '
  + 'has been sent.';

export default {
  title: 'Block view',
  group: 'Agents',
  api: ['BlockView', 'renderBlocks'],
  blurb: 'An answer an agent wrote, drawn block by block as prose and written to as it streams.',
  examples: [
    {
      title: 'An answer with figures, a table, code, and an artifact',
      blurb: 'Citations are buttons that report which source they name; the artifact card reports '
        + 'its id. Copy the answer as Markdown with toMarkdown().',
      layout: 'stack',
      width: '680px',
      render: ({ cleanup, log }) => {
        const view = new BlockView(null, {
          blocks: forecastAnswer(),
          sources: forecastSources(),
          oncite: ({ detail }) => log(`cite ${detail.n}: ${detail.source?.title ?? 'unknown source'}`),
          onartifact: ({ detail }) => log(`artifact ${detail.id}`)
        });
        cleanup(() => view.destroy());
        return [
          view.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Log as Markdown', onclick: () => log(view.toMarkdown().split('\n')[0]) }))
        ];
      }
    },
    {
      title: 'Streaming',
      blurb: 'appendText() continues the last paragraph and a blank line opens the next; earlier '
        + 'paragraphs are never redrawn. A marker split across two chunks resolves when its close '
        + 'arrives. With reduced motion the demo writes the answer at once.',
      layout: 'stack',
      width: '680px',
      render: ({ cleanup, log }) => {
        const view = new BlockView(null, { onend: () => log('end') });
        let timer = 0;
        // The demo plays the part of the model: six characters every 40 ms.
        const stream = () => {
          clearTimeout(timer);
          view.setBlocks([], { streaming: true });
          if (prefersReducedMotion(view.toElement())) {
            view.appendText(STREAMED).end();
            return;
          }
          let index = 0;
          const tick = () => {
            view.appendText(STREAMED.slice(index, index + 6));
            index += 6;
            if (index < STREAMED.length) timer = window.setTimeout(tick, 40);
            else view.end();
          };
          tick();
        };
        cleanup(() => {
          clearTimeout(timer);
          view.destroy();
        });
        return [
          view.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Stream the answer', kind: 'primary', onclick: stream }),
            button({ label: 'Stop', onclick: () => {
              clearTimeout(timer);
              view.stop();
              log('stopped');
            } }))
        ];
      }
    }
  ]
};
