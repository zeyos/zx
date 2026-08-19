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
