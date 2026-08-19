import { Stepper, button, h } from '../../src/index.js';

const CHECKOUT = [
  { name: 'cart', title: 'Cart', description: 'Article and quantity' },
  { name: 'address', title: 'Address', description: 'Where it ships' },
  { name: 'payment', title: 'Payment', description: 'How you pay', optional: true },
  { name: 'confirm', title: 'Confirm', description: 'Review and place' }
];

export default {
  title: 'Stepper',
  group: 'Layout',
  blurb: 'The wizard progress rail: four step states, an optional \u201cStep 2 of 4\u201d counter, and a '
    + 'preventable change event so a step can refuse to be left.',

  examples: [
    {
      title: 'Wizard rail',
      blurb: 'The rail owns where the reader is; the content stays yours. Advancing marks every '
        + 'step it passed complete, so a completed step becomes a button that goes back to it. '
        + 'change fires before the move is applied and is preventable \u2014 tick the box to veto '
        + 'forward moves the way a failing validation would.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const veto = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox' }));
        const stage = h('div', { class: 'demo-card' });

        const wizard = new Stepper(null, {
          counter: true,
          steps: CHECKOUT,
          onchange: (event) => {
            if (veto.checked && event.detail.index > wizard.getIndex()) {
              event.preventDefault();
              log(`vetoed: ${event.detail.previous} \u2192 ${event.detail.name}`);
              return;
            }
            log(`change: ${event.detail.previous} \u2192 ${event.detail.name}`);
            queueMicrotask(paint);
          }
        });

        const back = button({ label: 'Back', icon: 'chevron-left', onclick: () => wizard.previous() });
        const next = button({ label: 'Continue', kind: 'primary', icon: 'chevron-right', onclick: () => wizard.next() });

        const paint = () => {
          const state = wizard.getState();
          stage.replaceChildren(
            h('strong', {}, `You are on \u201c${state.active}\u201d`),
            h('br'),
            h('span', { style: { color: 'var(--zx-color-text-muted)', fontSize: 'var(--zx-text-sm)' } },
              `completed: [${state.completed.join(', ') || '\u2014'}] \u00b7 errored: [${state.errored.join(', ') || '\u2014'}]`));
          back.disabled = state.index <= 0;
          next.disabled = state.index >= CHECKOUT.length - 1;
        };
        paint();

        cleanup(() => wizard.destroy());
        return [
          wizard.toElement(),
          stage,
          h('div', { class: 'demo-row' },
            back,
            next,
            h('label', { class: 'demo-row' }, veto, 'Veto forward moves'),
            h('button', {
              type: 'button',
              onclick: () => {
                const errored = !wizard.getState().errored.includes('address');
                wizard.setError('address', errored);
                paint();
                log(`setError('address', ${errored})`);
              }
            }, "setError('address', \u2026)"))
        ];
      }
    },
    {
      title: 'Vertical rail',
      blurb: 'orientation: "vertical" turns the connectors into a spine beside the steps, and '
        + 'clickable: "all" lets the reader jump to anything not disabled. Invoiced is disabled, '
        + 'so Tab skips it and next() walks past it.',
      render: ({ cleanup, log }) => {
        const rail = new Stepper(null, {
          orientation: 'vertical',
          clickable: 'all',
          active: 'review',
          steps: [
            { name: 'draft', title: 'Draft', description: 'Prepare the quotation' },
            { name: 'review', title: 'Internal review', description: 'Two approvals required' },
            { name: 'sent', title: 'Sent to customer', optional: true },
            { name: 'signed', title: 'Signed' },
            { name: 'invoiced', title: 'Invoiced', disabled: true, description: 'Unlocks once signed' }
          ],
          onchange: ({ detail }) => log(`change \u2192 ${detail.name}`)
        });
        rail.complete('draft');
        cleanup(() => rail.destroy());
        return rail.toElement();
      }
    }
  ]
};
