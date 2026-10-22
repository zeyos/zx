import {
  Form, NumberField, Rating, Stepper, addDays, button, emptyState, formatCurrency, formatDate,
  formatNumber, h, icon
} from '../../src/index.js';
import {
  DATE, disposer, iconButton, iconTile, layoutContext, modShortcut, propList, renderScope, shortcuts,
  toaster, unavailable, workspaceHeader
} from './kit.js';
import { NOW, company } from './fixtures.js';

/** What is in the cart when the checkout opens. Prices are net, in EUR. */
const CART = [
  { ID: 'HW-GW2', name: 'Edge gateway G2', detail: 'Industrial gateway with 4G backup', price: 389, quantity: 3, icon: 'server', tone: 'blue' },
  { ID: 'HW-PSU', name: 'Power supply 24 V', detail: 'DIN rail mount, 60 W', price: 29.5, quantity: 3, icon: 'plug', tone: 'amber' },
  { ID: 'HW-RMK', name: 'Rack mounting kit', detail: '19-inch, holds four gateways', price: 49, quantity: 1, icon: 'box', tone: 'slate' }
];

/** Delivery methods: their price and how many working days they take. */
const SHIPPING = {
  standard: { label: 'Standard delivery', price: 0, days: [3, 5] },
  express: { label: 'Express delivery', price: 14.9, days: [1, 1] }
};

/** Payment methods. */
const PAYMENT = {
  account: 'On account, 14 days net',
  advance: 'Bank transfer in advance'
};

/** German VAT on hardware and delivery. */
const VAT_RATE = 0.19;

/** The checkout's steps, in order, with the sentence that opens each one. */
const STEPS = [
  { name: 'cart', title: 'Cart', intro: 'Check the quantities before you go on.' },
  { name: 'delivery', title: 'Delivery', intro: 'Where and how the order ships.' },
  { name: 'payment', title: 'Payment', intro: 'How the order is paid and who receives the invoice.' },
  { name: 'review', title: 'Review', intro: 'Everything below is what will be ordered.' }
];

/** The labels of the order summary's button, one per step. */
const NEXT_LABELS = ['Continue to delivery', 'Continue to payment', 'Review order', 'Place order'];

/** The number the order is placed under. */
const ORDER_NUMBER = 'AC-26-10482';

/** The customer placing the order, from the shared fixtures, with the address it ships to. */
const CUSTOMER = { ...company('bruckner'), street: 'Landsberger Straße 302', postcode: '80687' };

/**
 * The delivery and payment forms' fieldsets.
 * @returns {{delivery: object[], payment: object[]}}
 */
function checkoutFieldsets() {
  return {
    delivery: [
      {
        title: 'Address',
        columns: 2,
        fields: {
          company: { type: 'text', label: 'Company', required: true, value: CUSTOMER.name },
          contact: { type: 'text', label: 'Contact', required: true, value: CUSTOMER.contact },
          street: { type: 'text', label: 'Street and number', required: true, value: CUSTOMER.street },
          postcode: { type: 'text', label: 'Postcode', required: true, value: CUSTOMER.postcode },
          city: { type: 'text', label: 'City', required: true, value: CUSTOMER.city },
          country: {
            type: 'select', label: 'Country', value: 'DE',
            options: { DE: 'Germany', AT: 'Austria', CH: 'Switzerland', NL: 'Netherlands' }
          }
        }
      },
      {
        title: 'Delivery method',
        fields: {
          shipping: {
            type: 'optionlist', label: 'Method', value: 'standard',
            options: Object.fromEntries(Object.entries(SHIPPING).map(([key, method]) => [key,
              `${method.label}, ${deliveryText(method)} · ${method.price ? formatCurrency(method.price, 'EUR') : 'free'}`]))
          }
        }
      }
    ],
    payment: [
      {
        title: 'Payment method',
        fields: { payment: { type: 'optionlist', label: 'Method', value: 'account', options: PAYMENT } }
      },
      {
        title: 'Invoice',
        columns: 2,
        fields: {
          invoiceEmail: { type: 'text', label: 'Send the invoice to', required: true, value: `invoices@${CUSTOMER.domain}` },
          reference: { type: 'text', label: 'Purchase order number', placeholder: 'Optional' }
        }
      }
    ]
  };
}

/**
 * The date a delivery arrives, counted in working days from now.
 * @param {number} days
 * @returns {Date}
 */
function workingDaysFromNow(days) {
  let date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  for (let left = days; left > 0;) {
    date = addDays(date, 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) left -= 1;
  }
  return date;
}

/**
 * When a delivery method arrives, as the checkout says it: "Friday 9 October", or a range.
 * @param {{days: number[]}} method
 * @returns {string}
 */
function deliveryText({ days: [first, last] }) {
  if (first === last) return formatDate(workingDaysFromNow(first), DATE.day);
  return `${formatDate(workingDaysFromNow(first), DATE.short)}–${formatDate(workingDaysFromNow(last), DATE.short)}`;
}

/**
 * Formats an amount in euros with the shared Zx formatter.
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return formatCurrency(value, 'EUR');
}

export default {
  title: 'Checkout wizard',
  category: 'Pattern',
  blurb: 'A focused four-step checkout: cart, delivery, payment, and review, beside a live order summary.',
  components: ['Stepper', 'NumberField', 'Form', 'Rating'],

  /**
   * Mounts the checkout: a single column without navigation, a horizontal step rail, the current
   * step, and the order summary that carries the way forward.
   * @param {HTMLElement} container Gallery stage.
   * @param {Partial<import('./kit.js').LayoutContext>} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const root = h('div', { class: 'checkout shell' });
    const notify = toaster(context, root);
    const cartRows = renderScope(context);
    const confirmation = renderScope(context);
    const state = { step: 0, placed: false, cart: CART.map((line) => ({ ...line })) };

    // -------------------------------------------------------------------- the steps
    const sets = checkoutFieldsets();
    const forms = {
      delivery: keep(new Form(null, { fieldsets: sets.delivery, onchange: () => renderSummary() })),
      payment: keep(new Form(null, { fieldsets: sets.payment }))
    };
    const cartList = h('ul', { class: 'checkout__lines', 'aria-label': 'Cart' });
    const terms = h('input', { type: 'checkbox', class: 'checkout__terms-box' });
    const termsError = h('p', { class: 'checkout__terms-error', role: 'alert' });

    const stepper = keep(new Stepper(null, {
      steps: STEPS.map(({ name, title }) => ({ name, title })),
      clickable: 'completed',
      onchange: (event) => {
        // The summary's button and clicks on completed steps both arrive here; moving forward
        // waits until the step being left is complete.
        if (state.placed || (event.detail.index > state.step && !validate(state.step))) {
          event.preventDefault();
          return;
        }
        show(event.detail.index);
      }
    }));

    const heading = h('h2', { class: 'record-title record-title--sm', tabIndex: -1 });
    const intro = h('p', { class: 'meta' });
    const content = h('div', { class: 'form-sections checkout__content' });
    const backButton = button({ label: 'Back', icon: 'chevron-left', kind: 'ghost', onclick: () => stepper.previous() });
    const step = h('section', { class: 'checkout__step', 'aria-label': 'Current step' },
      h('header', { class: 'checkout__intro' }, heading, intro),
      content,
      h('div', { class: 'checkout__step-nav' }, backButton));

    // ------------------------------------------------------------------ the summary
    const summaryCount = h('span', { class: 'surface__meta' });
    const summaryLines = h('ul', { class: 'checkout__summary-lines' });
    const summaryTotals = h('dl', { class: 'checkout__totals' });
    const nextButton = button({ label: NEXT_LABELS[0], kind: 'primary', shortcut: modShortcut('Enter', '↵'), onclick: advance });
    const arrival = h('p', { class: 'checkout__arrival meta' });
    const summary = h('aside', { class: 'surface checkout__summary', 'aria-label': 'Order summary' },
      h('h3', { class: 'surface__title' }, 'Order summary', summaryCount),
      summaryLines, summaryTotals, nextButton, arrival);

    const main = h('section', { class: 'shell__main', 'aria-label': 'Checkout' },
      workspaceHeader({
        actions: [
          // A phone keeps only the lock; the words stay for assistive technology.
          h('span', { class: 'checkout__secure' },
            icon('lock'), h('span', { class: 'checkout__secure-label' }, 'Secure checkout')),
          button({ label: 'Continue shopping', kind: 'ghost', onclick: () => notify(unavailable('The store'), 'info') })
        ]
      }),
      h('div', { class: 'shell__body shell__body--padded' },
        h('div', { class: 'checkout__page' },
          stepper.toElement(),
          h('div', { class: 'checkout__columns' }, step, summary))));

    root.append(main);
    container.append(root);

    shortcuts(root, { 'Mod+Enter': advance }, context);
    renderCart();
    show(0, { initial: true });

    // ---------------------------------------------------------------- functions

    /**
     * Shows a step and fits the summary's button to it.
     * @param {number} index
     * @param {{initial?: boolean}} [options] The first rendering moves no focus.
     * @returns {void}
     */
    function show(index, { initial = false } = {}) {
      state.step = index;
      heading.textContent = STEPS[index].title;
      intro.textContent = STEPS[index].intro;
      const name = STEPS[index].name;
      content.replaceChildren(name === 'cart' ? cartList
        : name === 'review' ? review()
          : h('div', { class: 'form-sheet' }, forms[name].toElement()));
      backButton.hidden = index === 0;
      renderSummary();
      if (!initial && !context.preview) heading.focus();
    }

    /** Moves on: to the next step, or on the last one, places the order. @returns {void} */
    function advance() {
      if (state.placed || nextButton.disabled) return;
      if (state.step < STEPS.length - 1) stepper.next();
      else place();
    }

    /**
     * Checks a step before it is left forwards; an incomplete one is flagged on the rail.
     * @param {number} index
     * @returns {boolean}
     */
    function validate(index) {
      const name = STEPS[index].name;
      const valid = name === 'cart' ? state.cart.length > 0 : forms[name]?.submit() ?? true;
      stepper.setError(name, !valid);
      if (!valid && name !== 'cart') notify('Complete the highlighted fields to continue.', 'warning');
      return valid;
    }

    /** Draws the cart's lines, each with its quantity and a way to remove it. @returns {void} */
    function renderCart() {
      cartRows.reset();
      if (state.cart.length === 0) {
        cartList.replaceChildren(h('li', {}, emptyState({
          icon: 'cart-shopping',
          size: 'sm',
          title: 'Your cart is empty',
          description: 'Add something from the store to check out.',
          actions: [{ label: 'Continue shopping', onclick: () => notify(unavailable('The store'), 'info') }]
        })));
        return;
      }
      cartList.replaceChildren(...state.cart.map((line) => {
        const amount = h('span', { class: 'checkout__amount num' }, money(line.price * line.quantity));
        const quantity = cartRows.own(new NumberField(null, {
          value: line.quantity, min: 1, max: 99, label: `Quantity of ${line.name}`,
          onchange: (event) => {
            line.quantity = event.detail.value ?? 1;
            amount.textContent = money(line.price * line.quantity);
            renderSummary();
          }
        }));
        return h('li', { class: 'checkout__line' },
          iconTile(line.icon, line.tone, { size: 'lg' }),
          h('span', { class: 'checkout__item' },
            h('span', { class: 'checkout__item-name' }, line.name),
            h('span', { class: 'meta' }, `${line.detail} · ${line.ID} · ${money(line.price)} each`)),
          h('span', { class: 'checkout__qty' }, quantity.toElement()),
          amount,
          iconButton('trash-can', `Remove ${line.name}`, () => remove(line)));
      }));
    }

    /**
     * Takes a line out of the cart and offers to put it back.
     * @param {(typeof CART)[number]} line
     * @returns {void}
     */
    function remove(line) {
      const index = state.cart.indexOf(line);
      state.cart.splice(index, 1);
      renderCart();
      renderSummary();
      // The focused remove button went with its line: the next line's takes over, or the heading.
      const removers = cartList.querySelectorAll('.checkout__line .zx-icon-btn');
      (removers[Math.min(index, removers.length - 1)] ?? heading).focus();
      notify(h('span', { class: 'toast-action' }, `Removed ${line.name}.`,
        button({
          label: 'Undo', kind: 'ghost', size: 'sm',
          onclick: () => {
            if (state.placed || state.cart.includes(line)) return;
            state.cart.splice(index, 0, line);
            renderCart();
            renderSummary();
          }
        })), 'info');
    }

    /** @returns {{subtotal: number, shipping: number, vat: number, total: number, method: typeof SHIPPING.standard}} */
    function totals() {
      const method = SHIPPING[String(forms.delivery.getValue('shipping') || 'standard')] ?? SHIPPING.standard;
      const subtotal = state.cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
      const shipping = state.cart.length ? method.price : 0;
      const vat = Math.round((subtotal + shipping) * VAT_RATE * 100) / 100;
      return { subtotal, shipping, vat, total: subtotal + shipping + vat, method };
    }

    /** Redraws the order summary and its button. @returns {void} */
    function renderSummary() {
      const sum = totals();
      const items = state.cart.reduce((count, line) => count + line.quantity, 0);
      summaryCount.textContent = `${formatNumber(items)} ${items === 1 ? 'item' : 'items'}`;
      summaryLines.replaceChildren(...state.cart.map((line) => h('li', {},
        h('span', {}, line.name, h('span', { class: 'meta' }, ` × ${formatNumber(line.quantity)}`)),
        h('span', { class: 'num' }, money(line.price * line.quantity)))));
      const row = (label, value, attributes = {}) => [h('dt', attributes, label), h('dd', attributes, value)];
      summaryTotals.replaceChildren(
        ...row('Subtotal', money(sum.subtotal)),
        ...row('Delivery', sum.shipping ? money(sum.shipping) : 'Free'),
        ...row(`VAT ${formatNumber(VAT_RATE * 100)}%`, money(sum.vat)),
        ...row('Total', money(sum.total), { dataset: { total: '' } }));
      nextButton.querySelector('.zx-btn__label').textContent = NEXT_LABELS[state.step];
      nextButton.disabled = state.cart.length === 0;
      arrival.replaceChildren(icon('truck'), h('span', {}, `${sum.method.label}: arrives ${deliveryText(sum.method)}`));
    }

    /** @returns {HTMLElement} The review: delivery and payment, each with a way back, and the terms. */
    function review() {
      const delivery = forms.delivery.getValues();
      const payment = forms.payment.getValues();
      const { method } = totals();
      const edit = (index) => button({ label: 'Edit', size: 'sm', kind: 'ghost', onclick: () => stepper.goTo(STEPS[index].name) });
      termsError.textContent = '';
      return h('div', { class: 'checkout__review' },
        h('section', { class: 'surface', 'aria-label': 'Delivery' },
          h('div', { class: 'checkout__review-head' }, h('h3', { class: 'surface__title' }, 'Delivery'), edit(1)),
          propList([
            ['Ship to', h('span', { class: 'checkout__address' },
              [delivery.company, `Attn. ${delivery.contact}`, delivery.street, `${delivery.postcode} ${delivery.city}`]
                .map((line) => h('span', {}, line)))],
            ['Method', method.label],
            ['Arrives', deliveryText(method)]
          ])),
        h('section', { class: 'surface', 'aria-label': 'Payment' },
          h('div', { class: 'checkout__review-head' }, h('h3', { class: 'surface__title' }, 'Payment'), edit(2)),
          propList([
            ['Method', PAYMENT[payment.payment]],
            ['Invoice to', payment.invoiceEmail],
            ['Order number', payment.reference || null]
          ])),
        h('label', { class: 'checkout__terms' }, terms,
          h('span', {}, 'I accept the terms of sale and the delivery conditions.')),
        termsError);
    }

    /** Places the order once the terms are accepted, and shows the confirmation. @returns {void} */
    function place() {
      if (!terms.checked) {
        termsError.textContent = 'Accept the terms of sale to place the order.';
        terms.focus();
        return;
      }
      const sum = totals();
      const payment = forms.payment.getValues();
      state.placed = true;
      stepper.complete('review');
      for (const entry of STEPS) stepper.setDisabled(entry.name);
      backButton.hidden = true;
      nextButton.hidden = true;
      heading.textContent = 'Order placed';
      intro.textContent = `${ORDER_NUMBER} · ${money(sum.total)} including VAT`;
      confirmation.reset();
      const rating = confirmation.own(new Rating(null, {
        label: 'How easy was this checkout?',
        onchange: (event) => {
          if (event.detail.value) notify('Thanks for the feedback.');
        }
      }));
      content.replaceChildren(h('div', { class: 'checkout__done' },
        h('div', { class: 'checkout__done-head' },
          iconTile('circle-check', 'green', { size: 'lg' }),
          h('p', {}, `A confirmation is on its way to ${payment.invoiceEmail}. `
            + `${sum.method.label} arrives ${deliveryText(sum.method)}.`)),
        h('div', { class: 'checkout__rating' }, h('span', { class: 'meta' }, 'How easy was this checkout?'), rating.toElement()),
        h('div', { class: 'checkout__done-actions' },
          button({ label: 'Track the order', onclick: () => notify(unavailable('Order tracking'), 'info') }),
          button({ label: 'Start a new order', kind: 'ghost', onclick: restart }))));
      notify(`Order ${ORDER_NUMBER} placed.`);
      heading.focus();
    }

    /** Starts a new order with the original cart. @returns {void} */
    function restart() {
      state.placed = false;
      state.cart = CART.map((line) => ({ ...line }));
      terms.checked = false;
      confirmation.reset();
      for (const form of Object.values(forms)) form.reset();
      for (const entry of STEPS) stepper.setDisabled(entry.name, false).uncomplete(entry.name).setError(entry.name, false);
      nextButton.hidden = false;
      renderCart();
      if (stepper.getIndex() === 0) show(0);
      else stepper.goTo(STEPS[0].name);
    }
  }
};
