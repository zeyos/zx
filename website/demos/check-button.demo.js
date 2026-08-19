import { CheckButton, h } from '../../src/index.js';

export default {
  title: 'CheckButton',
  group: 'Inputs',
  blurb: 'A button that stays pressed — a checkbox with the presence of a toolbar control.',

  examples: [
    {
      title: 'States',
      blurb: 'The indicator carries a glyph in both states — an empty box when off, a check when '
        + 'on — so an unpressed or disabled button still reads as a two-state control. A label '
        + 'pair swaps text with the state, and icon: false drops the indicator entirely.',
      render: ({ cleanup, log }) => {
        const buttons = [
          new CheckButton(null, { label: 'Pinned' }),
          new CheckButton(null, { label: ['Enabled', 'Disabled'], checked: true }),
          new CheckButton(null, { label: 'No icon', icon: false }),
          new CheckButton(null, { label: 'Unavailable', disabled: true }),
          new CheckButton(null, { label: 'Locked on', checked: true, disabled: true })
        ];
        for (const [index, checkButton] of buttons.entries()) {
          checkButton.on('change', ({ detail }) => log(`button ${index + 1} checked=${detail.checked}`));
        }
        cleanup(() => buttons.forEach((checkButton) => checkButton.destroy()));
        return buttons.map((checkButton) => checkButton.toElement());
      }
    },
    {
      title: 'Programmatic control',
      blurb: 'set() forces a state without firing a click, and setLabel() swaps the label pair '
        + 'while the button is live.',
      render: ({ cleanup }) => {
        const checkButton = new CheckButton(null, { label: 'Pinned' });
        cleanup(() => checkButton.destroy());
        return [
          checkButton.toElement(),
          h('button', { type: 'button', onclick: () => checkButton.set(true) }, 'set(true)'),
          h('button', {
            type: 'button',
            onclick: () => checkButton.setLabel(['On now', 'Off now'])
          }, 'setLabel([…])')
        ];
      }
    }
  ]
};
