import { h, Toggle } from '../../src/index.js';

export default {
  title: 'Toggle',
  group: 'Inputs',
  blurb: 'A labelled switch for settings that take effect immediately.',

  examples: [
    {
      title: 'States',
      blurb: 'Click, Space, or Enter flips a switch. Use a toggle where the change applies at '
        + 'once, and a checkbox where it applies when the form is submitted.',
      render: ({ cleanup, log }) => {
        const toggles = [
          new Toggle(null, { label: 'Notifications', value: 'notifications' }),
          new Toggle(null, { label: 'Automatic sync', checked: true, value: 'sync' }),
          new Toggle(null, { label: 'Unavailable', disabled: true })
        ];
        for (const toggle of toggles) {
          toggle.on('change', ({ detail }) => log(`change checked=${detail.checked} value=${detail.value}`));
        }
        cleanup(() => toggles.forEach((toggle) => toggle.destroy()));
        return toggles.map((toggle) => toggle.toElement());
      }
    },
    {
      title: 'A switch without visible text',
      blurb: 'hideLabel keeps the label for assistive technology only: nothing is drawn beside the '
        + 'track and the label becomes the switch\'s accessible name. Use it where the layout '
        + 'already says what the switch is for — here the row\'s own text — and call setLabel() '
        + 'when that changes. A switch with neither a label nor a Field around it has no name.',
      render: ({ cleanup, log }) => {
        const toggle = new Toggle(null, { label: 'Email me about new invoices', hideLabel: true, checked: true });
        toggle.on('change', ({ detail }) => {
          log(`change checked=${detail.checked} — named "${toggle.el.getAttribute('aria-label')}"`);
        });
        cleanup(() => toggle.destroy());
        return h('div', { class: 'demo-row' },
          h('span', {}, 'New invoices'),
          toggle.toElement());
      }
    },
    {
      title: 'Programmatic control',
      blurb: 'toggle(), enable(), and getValue() drive a switch from elsewhere on the page — the '
        + 'same calls a form controller would make.',
      render: ({ cleanup, log }) => {
        const toggle = new Toggle(null, { label: 'Automatic sync', value: 'sync' });
        cleanup(() => toggle.destroy());
        return [
          toggle.toElement(),
          h('button', { type: 'button', onclick: () => toggle.toggle() }, 'toggle()'),
          h('button', {
            type: 'button',
            onclick: () => log(`getValue() → ${String(toggle.getValue())}`)
          }, 'getValue()')
        ];
      }
    }
  ]
};
