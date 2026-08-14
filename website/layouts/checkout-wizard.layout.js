import { Form, MasterPanel, Message, NumberField, Rating, button, h, icon } from '../../src/index.js';

const SHIPPING = { standard: 'Standard — 3–5 days (free)', express: 'Express — next day (€ 14.90)' };
const PAYMENT = { invoice: 'On account', card: 'Credit card', transfer: 'Bank transfer' };
const LINE_PRICE = 249;
const EXPRESS_SURCHARGE = 14.9;
const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

export default {
  title: 'Wizard (horizontal steps)',
  group: 'Applications',
  blurb: 'The same guided flow as the record wizard, with the steps laid out horizontally above '
    + 'the form — the shape that suits a short, linear checkout.',

  /**
   * Mounts a four-step checkout with a horizontal stepper and a live order summary.
   * @param {HTMLElement} container Documentation stage.
   * @returns {void}
   */
  mount(container) {
    const draft = { quantity: 3, shipping: 'standard' };
    let current = 0;

    const quantity = new NumberField(null, {
      value: draft.quantity,
      min: 1,
      max: 99,
      onchange: (event) => {
        draft.quantity = event.detail.value ?? 1;
        renderSummary();
      }
    });

    const cartForm = new Form(null, {
      fieldsets: [{
        title: 'Your order',
        columns: 2,
        fields: {
          article: {
            type: 'select',
            label: 'Article',
            value: 'lic-std',
            options: {
              'lic-std': 'Platform licence — standard',
              'lic-ent': 'Platform licence — enterprise'
            }
          },
          reference: { type: 'text', label: 'Your reference', placeholder: 'Optional' }
        }
      }]
    });

    const addressForm = new Form(null, {
      fieldsets: [{
        title: 'Delivery address',
        columns: 2,
        fields: {
          company: { type: 'text', label: 'Company', required: true, value: 'Bruckner Logistik' },
          contact: { type: 'text', label: 'Contact', required: true, value: 'Ines Bauer' },
          street: { type: 'text', label: 'Street', required: true, value: 'Alpenstraße 14' },
          zip: { type: 'text', label: 'Postcode', required: true, value: '5020' },
          city: { type: 'text', label: 'City', required: true, value: 'Salzburg' },
          country: {
            type: 'select',
            label: 'Country',
            value: 'AT',
            options: { AT: 'Austria', DE: 'Germany', CH: 'Switzerland' }
          }
        }
      }]
    });

    const paymentForm = new Form(null, {
      fieldsets: [{
        title: 'Shipping and payment',
        columns: 2,
        fields: {
          shipping: {
            type: 'optionlist',
            label: 'Shipping',
            value: 'standard',
            options: SHIPPING
          },
          payment: { type: 'select', label: 'Payment', value: 'invoice', options: PAYMENT },
          note: { type: 'textarea', label: 'Delivery note', props: { rows: 2 } }
        }
      }],
      onchange: (event) => {
        if (event.detail.id === 'shipping') {
          draft.shipping = String(event.detail.value);
          renderSummary();
        }
      }
    });

    const summary = h('dl', { class: 'summary-list' });
    const rating = new Rating(null, { value: 0, label: 'How easy was this checkout?', showValue: true });
    const confirmStep = h('div', { class: 'layout-stack' },
      h('p', { class: 'layout-hint' }, 'Everything below is what would be submitted.'),
      summary,
      h('div', { class: 'layout-toolbar' },
        h('span', { class: 'layout-hint' }, 'Rate this checkout:'),
        rating.toElement()));

    const steps = [
      { title: 'Cart', hint: 'Article and quantity', form: cartForm, element: cartStep() },
      { title: 'Address', hint: 'Where it ships', form: addressForm, element: addressForm.toElement() },
      { title: 'Payment', hint: 'How you pay', form: paymentForm, element: paymentForm.toElement() },
      { title: 'Confirm', hint: 'Review and place', form: null, element: confirmStep }
    ];

    const stepper = h('ol', { class: 'stepper' });
    const stage = h('div', { class: 'layout-stack' });
    const back = button({ label: 'Back', icon: 'chevron-left', onclick: () => go(current - 1) });
    const next = button({
      label: 'Continue',
      kind: 'primary',
      icon: 'chevron-right',
      onclick: () => go(current + 1)
    });
    const total = h('strong', { class: 'stepper-total' });

    const shell = new MasterPanel(null, {
      title: 'Checkout',
      module: 'procurement',
      content: h('div', { class: 'layout-stack' },
        stepper,
        stage,
        h('div', { class: 'layout-toolbar' },
          back, total, h('span', { class: 'layout-toolbar__spacer' }), next)),
      footer: 'Horizontal stepper · each step validates before the next one opens'
    });

    container.append(h('div', { class: 'layout-frame' }, shell.toElement()));
    renderSummary();
    go(0);

    /** @returns {HTMLElement} */
    function cartStep() {
      return h('div', { class: 'layout-stack' },
        cartForm.toElement(),
        h('div', { class: 'layout-toolbar' },
          h('label', { class: 'layout-hint' }, 'Quantity'),
          quantity.toElement(),
          h('span', { class: 'layout-hint' }, `× ${currency.format(LINE_PRICE)} per licence`)));
    }

    /**
     * Moves to a step, validating the one being left when moving forward.
     * @param {number} index Target step index.
     * @returns {void}
     */
    function go(index) {
      if (index > current) {
        const leaving = steps[current];
        if (leaving.form && !leaving.form.submit()) {
          Message.error('Please complete the highlighted fields.');
          return;
        }
        if (leaving.form) Object.assign(draft, leaving.form.getValues());
      }
      if (index >= steps.length) return commit();

      current = Math.max(0, Math.min(index, steps.length - 1));
      if (current === steps.length - 1) renderSummary();
      stage.replaceChildren(steps[current].element);
      back.disabled = current === 0;
      next.querySelector('.zx-btn__label').textContent =
        current === steps.length - 1 ? 'Place order' : 'Continue';
      renderStepper();
    }

    /** Redraws the horizontal stepper. Completed steps stay clickable so users can go back. */
    function renderStepper() {
      stepper.replaceChildren(...steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'active' : 'pending';
        const marker = h('span', { class: 'stepper__marker' },
          state === 'done' ? icon('check', { size: 12 }) : String(index + 1));
        const item = h('li', {
          class: 'stepper__step',
          dataset: { state },
          'aria-current': index === current ? 'step' : undefined
        },
        marker,
        h('span', { class: 'stepper__text' },
          h('span', { class: 'stepper__title' }, step.title),
          h('span', { class: 'stepper__hint' }, step.hint)));
        if (state === 'done') {
          item.append(h('button', {
            class: 'stepper__jump',
            type: 'button',
            ariaLabel: `Back to ${step.title}`,
            onclick: () => go(index)
          }));
        }
        return item;
      }));
    }

    /** Recomputes the order total and the review list. @returns {void} */
    function renderSummary() {
      const values = { ...draft, ...cartForm.getValues(), ...paymentForm.getValues() };
      const net = LINE_PRICE * (draft.quantity || 1)
        + (draft.shipping === 'express' ? EXPRESS_SURCHARGE : 0);
      total.textContent = `Total ${currency.format(net)}`;
      summary.replaceChildren(...[
        ['Article', values.article === 'lic-ent' ? 'Enterprise licence' : 'Standard licence'],
        ['Quantity', String(draft.quantity ?? 1)],
        ['Ship to', [values.company, values.street, `${values.zip ?? ''} ${values.city ?? ''}`]
          .filter(Boolean).join(', ')],
        ['Shipping', SHIPPING[draft.shipping]],
        ['Payment', PAYMENT[values.payment] ?? PAYMENT.invoice],
        ['Total', currency.format(net)]
      ].flatMap(([term, value]) => [h('dt', {}, term), h('dd', {}, String(value || '—'))]));
    }

    /** Finishes the wizard. @returns {void} */
    function commit() {
      Message.success(`Order placed for ${draft.company ?? 'the customer'}.`);
      steps.forEach((step) => step.form?.reset());
      rating.clear();
      go(0);
    }
  }
};
