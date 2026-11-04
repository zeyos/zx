import { Composer, PromptStarters, button, h } from '../../src/index.js';

// What an empty conversation offers. `text` is the prompt a pick stands for; `description`, when
// there is one, is shown in its place, for a prompt too long to read on the button.
function starters() {
  return [
    { id: 'escalations', title: 'Summarise escalations', text: 'Summarise this week’s customer escalations for the Monday operations review.', icon: 'list' },
    { id: 'reply', title: 'Draft a reply', text: 'Draft a friendly reply to Meridian Health asking to move our call to Tuesday.', icon: 'mail' },
    { id: 'join', title: 'Explain a concept', text: 'Explain what a LEFT JOIN does, with a short example.', icon: 'code' },
    {
      id: 'forecast',
      title: 'Forecast cash',
      description: 'The next four weeks, from open invoices and planned payments',
      text: 'Forecast our cash position for the next four weeks from open invoices and planned payments, and name the three largest risks to it.',
      icon: 'table'
    }
  ];
}

// A prompt can stop where the person goes on writing: filling the composer leaves the caret there.
function templates() {
  return [
    { id: 'summary', title: 'Summarise for a manager', description: 'Five bullets with owners and dates', text: 'Summarise the following for a manager in five bullets, with owners and due dates:\n\n' },
    { id: 'actions', title: 'Turn notes into actions', description: 'Decisions, owners, open questions', text: 'Turn these meeting notes into decisions, action items with owners, and open questions:\n\n' }
  ];
}

export default {
  title: 'Prompt starters',
  group: 'Agents',
  api: ['PromptStarters'],
  blurb: 'Starting points for an empty conversation. A pick is reported and nothing more: the '
    + 'application decides whether a starter sends at once or fills the composer.',
  examples: [
    {
      title: 'A pick that sends',
      blurb: 'The starters of a new conversation, sent as they are picked. Two columns, and one in '
        + 'a container narrower than 32rem: drag the frame or open the page on a phone. setItems() '
        + 'replaces them, and the focus stays on the starter with the same id.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const picker = new PromptStarters(null, {
          items: starters(),
          onpick: ({ detail }) => log(`pick ${detail.item.id}: send "${detail.item.text}"`)
        });
        cleanup(() => picker.destroy());
        return [
          picker.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Fewer starters', onclick: () => picker.setItems(starters().slice(0, 2)) }),
            button({ label: 'All starters', onclick: () => picker.setItems(starters()) }))
        ];
      }
    },
    {
      title: 'A pick that fills the composer',
      blurb: 'One column with a heading: headingLevel draws the label above the starters, and it '
        + 'names the group. The pick goes into the composer, ready to finish and send. Without '
        + 'description the text is shown, clamped to two lines.',
      layout: 'stack',
      width: '480px',
      render: ({ cleanup, log }) => {
        const composer = new Composer(null, {
          placeholder: 'Ask anything',
          onsend: ({ detail }) => log(`send "${detail.text}"`)
        });
        const picker = new PromptStarters(null, {
          items: templates(),
          label: 'Start from a template',
          columns: 1,
          headingLevel: 3,
          onpick: ({ detail }) => {
            log(`pick ${detail.item.id}`);
            composer.setValue(detail.item.text).focus();
          }
        });
        cleanup(() => {
          picker.destroy();
          composer.destroy();
        });
        return [picker.toElement(), composer.toElement()];
      }
    }
  ]
};
