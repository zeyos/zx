import { h, truncate } from '../../src/index.js';

const LONG = 'Nordwind Handelsgesellschaft mbH & Co. KG — Zentraleinkauf Nord, Hamburg';
const NOTE = 'Delivery was refused at the gate because the packing list did not match the '
  + 'purchase order; the driver returned the pallets to the depot and a replacement delivery '
  + 'was booked for the following Tuesday morning.';

export default {
  title: 'Truncate',
  group: 'Helpers',
  blurb: 'Clamps text to a number of lines and hands the cut-off text back on hover — because a '
    + 'cell that silently drops the end of a value is a data-loss bug wearing a layout costume.',

  examples: [
    {
      title: 'One line',
      blurb: 'Drag the box narrower. The title tooltip appears exactly when the text runs out of '
        + 'room and disappears when it fits again — it is measured on every resize, not set once. '
        + 'Hover the clamped text to see it.',
      render: ({ cleanup }) => {
        const line = h('div', {}, LONG);
        const box = h('div', { class: 'demo-resizable' }, line);
        const controller = truncate(line);
        cleanup(() => controller.destroy());
        return box;
      }
    },
    {
      title: 'Several lines',
      blurb: 'lines clamps a block instead of a line, ending on an ellipsis at the limit. The '
        + 'controller reports the current state, so a “show more” affordance can appear only when '
        + 'there is more to show.',
      render: ({ cleanup, log }) => {
        const note = h('p', { style: 'margin: 0' }, NOTE);
        const box = h('div', { class: 'demo-resizable', style: 'inline-size: 320px' }, note);
        const controller = truncate(note, { lines: 2 });
        log(`clamped: ${controller.isTruncated()}`);

        const toggle = h('button', {
          class: 'zx-btn', type: 'button',
          onclick: () => {
            const expanded = note.hasAttribute('data-expanded');
            if (expanded) {
              note.removeAttribute('data-expanded');
              note.classList.add('zx-truncate');
            } else {
              note.setAttribute('data-expanded', '');
              note.classList.remove('zx-truncate');
            }
            toggle.textContent = expanded ? 'Show more' : 'Show less';
          }
        }, 'Show more');

        cleanup(() => controller.destroy());
        return [box, toggle];
      }
    },
    {
      title: 'Without the tooltip',
      blurb: 'title: false clamps and nothing else, for text that is decorative or already '
        + 'repeated nearby. The plain .zx-truncate class does the same from static markup, with '
        + 'no JavaScript involved.',
      render: () => h('div', { class: 'demo-resizable' },
        h('div', { class: 'zx-truncate' }, LONG))
    }
  ]
};
