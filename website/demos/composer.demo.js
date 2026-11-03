import { Composer, Select, button, h } from '../../src/index.js';

// The agents "@" can mention. The composer filters them as the reader types; `items` may also be
// a function that answers a query itself, synchronously or with a Promise.
function agents() {
  return [
    { id: 'finance', label: 'Finance agent', description: 'Invoices, payments and cash forecasts', icon: 'table' },
    { id: 'sales', label: 'Sales agent', description: 'Pipeline, quotes and renewals', icon: 'star' },
    { id: 'support', label: 'Support agent', description: 'Tickets, returns and replies', icon: 'mail' }
  ];
}

// The commands "/" opens, as Launcher items. An item with `items` opens a page of its own; the
// application decides what a command does when the composer reports it.
function commands() {
  return [
    { id: 'summarize', label: 'Summarize the conversation', icon: 'list' },
    { id: 'reminder', label: 'Draft a payment reminder', icon: 'mail' },
    { id: 'prompts', label: 'Saved prompts', icon: 'book', placeholder: 'Search saved prompts', items: [
      { id: 'overdue', label: 'Overdue invoices', value: 'Which invoices are more than 14 days overdue?' },
      { id: 'forecast', label: 'Cash forecast', value: 'Forecast our cash position for the next four weeks.' },
      { id: 'churn', label: 'Accounts at risk', value: 'Which accounts have not ordered since the summer?' }
    ] }
  ];
}

// What the message is about: the records selected beside the conversation. `ref` is the
// application's own data; the composer hands it back in `send` without reading it.
function selection() {
  return [{ id: 'selection', label: '3 invoices', icon: 'file', ref: { invoices: [2041, 2042, 2045] } }];
}

// The models the picker beside the composer offers. Picking one updates the composer in place:
// its placeholder and note name the model, and what was written, attached and focused stays.
function models() {
  return [
    { ID: 'halden-3', name: 'Halden 3', description: 'Balanced for everyday work' },
    { ID: 'halden-3-swift', name: 'Halden 3 Swift', description: 'Fastest answers' },
    { ID: 'halden-3-deep', name: 'Halden 3 Deep', description: 'Reasons step by step first' }
  ];
}

// Further buttons in the bar. A boolean `pressed` makes a toggle; the composer only reports a
// press, and the application decides what it means — here, flipping the toggle.
function tools() {
  return [
    { id: 'web', label: 'Web search', icon: 'search', pressed: true },
    { id: 'parameters', label: 'Parameters', icon: 'gear' }
  ];
}

export default {
  title: 'Composer',
  group: 'Agents',
  api: ['Composer'],
  blurb: 'The message box of an agent conversation: a growing text with Send and Stop, attachments, '
    + '@-mentions, / commands, and context chips.',
  examples: [
    {
      title: 'Chat composer',
      blurb: 'Enter sends and Shift+Enter breaks the line. Type @ to mention an agent and / on an '
        + 'empty text for commands; paste or drop files to attach them. Sending makes the agent '
        + 'busy: Send becomes Stop, and Escape in the text stops it too. The unsent text is kept '
        + 'as a draft across reloads.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const composer = new Composer(null, {
          placeholder: 'Ask anything — @ to mention an agent, / for commands',
          attachments: true,
          mentions: { items: agents() },
          commands: commands(),
          context: selection(),
          draftKey: 'docs-composer',
          note: 'Agents ask before they send anything or change a record.',
          onsend: ({ detail }) => {
            const mentioned = detail.mentions.map((item) => item.label).join(', ') || 'no one';
            log(`send "${detail.text}" · ${detail.files.length} files · mentions ${mentioned} · context ${detail.context.map((chip) => chip.label).join(', ') || 'none'}`);
            composer.setBusy(true);
          },
          onstop: () => {
            log('stop');
            composer.setBusy(false);
          },
          onmention: ({ detail }) => log(`mention ${detail.item.label}`),
          oncommand: ({ detail }) => {
            log(`command ${detail.item.id}`);
            if (typeof detail.item.value === 'string') composer.setValue(detail.item.value).focus();
          },
          onattach: ({ detail }) => log(`attach ${detail.files.map((file) => file.name).join(', ')}`),
          onremove: ({ detail }) => log(`remove ${detail.kind} ${detail.id}`),
          onhistoryprevious: () => log('historyprevious')
        });
        cleanup(() => composer.destroy());
        return [
          composer.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Toggle busy', onclick: () => composer.setBusy(!composer.isBusy()) }),
            button({ label: 'Add context', onclick: () => composer.addContext({ id: 'quarter', label: 'Q3 report', icon: 'table' }) }),
            button({ label: 'Remove context', onclick: () => composer.removeContext('selection').removeContext('quarter') }))
        ];
      }
    },
    {
      title: 'Tools and model',
      blurb: 'tools adds icon buttons to the bar, each reported as a tool event; a boolean pressed '
        + 'makes one a toggle, and setToolPressed() flips it. Picking another model calls update(), '
        + 'which changes the placeholder and note in place: the text, its caret and the focus stay.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const first = models()[0];
        const composer = new Composer(null, {
          placeholder: `Message ${first.name}`,
          note: `${first.name} can make mistakes. Check figures before you share them.`,
          tools: tools(),
          ontool: ({ detail }) => {
            if (typeof detail.tool.pressed === 'boolean') {
              composer.setToolPressed(detail.id, !detail.tool.pressed);
              log(`tool ${detail.id} ${detail.tool.pressed ? 'off' : 'on'}`);
            } else {
              log(`tool ${detail.id}`);
            }
          },
          onsend: ({ detail }) => log(`send "${detail.text}"`)
        });
        const picker = new Select(null, {
          label: 'Model',
          items: models(),
          value: first.ID,
          onchange: ({ detail }) => {
            const model = models().find((entry) => entry.ID === detail.value) ?? first;
            composer.update({
              placeholder: `Message ${model.name}`,
              note: `${model.name} can make mistakes. Check figures before you share them.`
            });
            log(`update ${model.name}`);
          }
        });
        cleanup(() => {
          picker.destroy();
          composer.destroy();
        });
        return [h('div', { class: 'demo-row' }, picker.toElement()), composer.toElement()];
      }
    },
    {
      title: 'Instruction style',
      blurb: 'With submitKey: \'mod+enter\', Enter breaks the line and Cmd+Enter (Ctrl+Enter '
        + 'elsewhere) sends, for longer instructions written over several lines. minRows: 3 keeps '
        + 'room for them from the start, and sendLabel names the button "Start task" (its word '
        + 'hides in a narrow composer, and stays its name).',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const composer = new Composer(null, {
          label: 'Instructions',
          placeholder: 'Describe the task for the agent',
          submitKey: 'mod+enter',
          hint: 'Enter adds a line',
          minRows: 3,
          maxRows: 8,
          sendLabel: 'Start task',
          oninput: ({ detail }) => log(`input ${detail.text.length} characters`),
          onsend: ({ detail }) => {
            log(`send ${detail.text.split('\n').length} lines`);
            composer.setBusy(true);
          },
          onstop: () => {
            log('stop');
            composer.setBusy(false);
          }
        });
        cleanup(() => composer.destroy());
        return composer.toElement();
      }
    }
  ]
};
