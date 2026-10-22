import {
  Breadcrumb, Dialog, Form, InlineLoading, MenuButton, Stepper, addDays, button, emptyState,
  formatCurrency, formatDate, formatPercent, h
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, later, layoutContext, modShortcut, paneHeader, propList,
  shortcuts, suiteNav, toaster, unavailable
} from './kit.js';
import { COMPANIES, NOW, company } from './fixtures.js';

/** Billing's destinations in the navigation; the wizard is opened from Quotes. */
const NAVIGATION = {
  overview: [
    { id: 'dashboard', label: 'Dashboard', icon: 'gauge' },
    { id: 'activities', label: 'Activities', icon: 'list-check' }
  ],
  sales: [
    { id: 'opportunities', label: 'Opportunities', icon: 'bullseye' },
    { id: 'quotes', label: 'Quotes', icon: 'file-lines' },
    { id: 'orders', label: 'Orders', icon: 'cart-shopping' },
    { id: 'customers', label: 'Customers', icon: 'building' }
  ]
};

/** What a quotation can contain. Prices are net, in EUR. */
const CATALOGUE = [
  { ID: 'platform', name: 'ACME Platform, Business plan', unit: '12 months', price: 17400 },
  { ID: 'seats', name: 'Additional user seats', unit: '20 seats', price: 5760 },
  { ID: 'implementation', name: 'Implementation package', unit: 'Flat rate', price: 14800 },
  { ID: 'workshop', name: 'On-site workshop', unit: '2 days', price: 2560 },
  { ID: 'support', name: 'Premium support', unit: '12 months', price: 9600 }
];

/** Payment terms. A `select` field takes a `{value: label}` map and returns the key as a string. */
const PAYMENT_TERMS = { 14: '14 days net', 30: '30 days net', 60: '60 days net' };

/** The wizard's steps, in order, with the sentence that opens each one. */
const STEPS = [
  { name: 'customer', title: 'Customer', description: 'Who it is for', intro: 'Who is this quotation for?' },
  { name: 'positions', title: 'Positions', description: 'What is quoted', intro: 'Pick what belongs on the quotation.' },
  { name: 'review', title: 'Review', description: 'Check and create', intro: 'Check the quotation before it is created.' }
];

/** The number the next quotation is created under. */
const NEXT_NUMBER = 'QT-2026-0418';

/**
 * The two forms' fieldsets.
 * @returns {{customer: object[], positions: object[]}}
 */
function wizardFieldsets() {
  const customer = company('bruckner');
  return {
    customer: [
      {
        title: 'Recipient',
        columns: 2,
        fields: {
          customer: {
            type: 'zxselect', label: 'Customer', required: true, value: customer.id,
            props: {
              items: COMPANIES.map((entry) => ({ ID: entry.id, name: entry.name })),
              filter: 'local'
            }
          },
          reference: { type: 'text', label: 'Customer reference', placeholder: 'Optional' },
          contact: { type: 'text', label: 'Contact person', required: true, value: customer.contact },
          email: { type: 'text', label: 'E-mail', required: true, value: customer.email }
        }
      },
      {
        title: 'Terms',
        columns: 2,
        fields: {
          terms: { type: 'select', label: 'Payment terms', options: PAYMENT_TERMS, value: '30' },
          validUntil: { type: 'date', label: 'Valid until', required: true, value: addDays(NOW, 30) }
        }
      }
    ],
    positions: [
      {
        fields: {
          items: {
            type: 'checklist',
            label: 'Line items',
            required: true,
            value: ['platform', 'implementation'],
            props: {
              items: CATALOGUE,
              labelKey: (item) => `${item.name} · ${item.unit} · ${formatCurrency(item.price, 'EUR')}`,
              search: false,
              height: 320
            }
          }
        }
      },
      {
        columns: 2,
        fields: {
          discount: { type: 'number', label: 'Discount', value: 5, props: { unit: '%', min: 0, max: 20 } },
          note: {
            type: 'textarea', label: 'Note on the quotation', props: { rows: 3 },
            value: 'Implementation starts within four weeks of signature.'
          }
        }
      }
    ]
  };
}

/**
 * Writes a discount given in percentage points: `percent(5)` is "5%", `percent(2.5)` "2.5%".
 * @param {number} points
 * @returns {string}
 */
function percent(points) {
  const value = Number(points) || 0;
  return formatPercent(value / 100, { decimals: Number.isInteger(value) ? 0 : 1 });
}

/**
 * Totals a set of positions: their list price, the discount, and the net amount quoted.
 * @param {string[]} ids Catalogue ids.
 * @param {number} discount Percentage points.
 * @returns {{lines: typeof CATALOGUE, list: number, discount: number, net: number}}
 */
function totals(ids, discount) {
  const lines = CATALOGUE.filter((item) => ids.includes(item.ID));
  const list = lines.reduce((sum, item) => sum + item.price, 0);
  const off = Math.round(list * (Number(discount) || 0)) / 100;
  return { lines, list, discount: off, net: list - off };
}

export default {
  title: 'Record wizard',
  category: 'Pattern',
  blurb: 'A new quotation in three validated steps, with a running total and a review before it is created.',
  components: ['Stepper', 'Form', 'Checklist', 'Breadcrumb', 'InlineLoading', 'Dialog', 'ModuleBar'],

  /**
   * Mounts the wizard: the application's navigation, a vertical step rail beside the current
   * step's form, and a footer that moves between the steps.
   * @param {HTMLElement} container Gallery stage.
   * @param {Partial<import('./kit.js').LayoutContext>} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const state = { step: 0, created: false };
    let cancelSave = () => {};

    // ---------------------------------------------------------------- navigation column
    /** @param {{id: string, label: string, icon: string}} item @returns {Record<string, any>} */
    const destination = (item) => ({
      ...item,
      invoke: () => notify(unavailable(item.id === 'quotes' ? 'The quote list' : item.label), 'info')
    });
    // The suite's navigation: a new quotation is Billing's, opened from its quotes.
    const nav = suiteNav(context, {
      module: 'billing',
      active: 'quotes',
      menu: [
        ...NAVIGATION.overview.map(destination),
        { section: true, label: 'Sales', children: NAVIGATION.sales.map(destination) }
      ]
    });
    const root = h('div', { class: 'record-wizard shell' }, nav.column);
    // Narrow, the navigation becomes a drawer; on a phone the header's actions fold into a menu.
    const shell = adaptiveShell(root, context);
    const notify = toaster(context, root);

    // ------------------------------------------------------------------- header
    const crumbs = keep(new Breadcrumb(null, {
      items: [{ name: 'quotes', label: 'Quotes' }, { name: 'new', label: 'New quotation' }],
      onselect: () => notify(unavailable('The quote list'), 'info')
    }));
    const saveState = keep(new InlineLoading(null, { status: 'inactive', size: 'sm', description: 'Not saved yet' }));
    const saveKey = modShortcut('s');
    const saveButton = button({ label: 'Save draft', shortcut: saveKey, onclick: saveDraft });
    const discardButton = button({ label: 'Discard', onclick: confirmDiscard });
    saveButton.dataset.narrow = 'hide';
    discardButton.dataset.narrow = 'hide';
    // Where the two buttons give way, a phone, this menu holds them; wider, it stays out of sight.
    const actionMenu = keep(new MenuButton(iconButton('ellipsis', 'Draft actions'), {
      kind: 'ghost', placement: 'bottom-end', items: actionItems()
    }));
    actionMenu.toElement().classList.add('record-wizard__menu');

    // ------------------------------------------------------------------ the steps
    const sets = wizardFieldsets();
    const forms = {
      customer: keep(new Form(null, {
        fieldsets: sets.customer,
        onchange: (event) => {
          if (event.detail.id === 'customer') fillContact(String(event.detail.value ?? ''));
          edited();
        }
      })),
      positions: keep(new Form(null, { fieldsets: sets.positions, onchange: edited }))
    };

    const stepper = keep(new Stepper(null, {
      steps: STEPS.map(({ name, title, description }) => ({ name, title, description })),
      orientation: 'vertical',
      clickable: 'completed',
      onchange: (event) => {
        // Every move goes through here — the footer's buttons and clicks on completed steps alike —
        // so moving forward is vetoed until the step being left is valid.
        if (state.created || (event.detail.index > state.step && !validate(state.step))) {
          event.preventDefault();
          return;
        }
        show(event.detail.index);
      }
    }));

    const heading = h('h2', { class: 'record-title record-title--sm', tabIndex: -1 });
    const intro = h('p', { class: 'meta' });
    const content = h('div', { class: 'form-sections record-wizard__content' });
    const stage = h('section', { class: 'record-wizard__stage', 'aria-label': 'Current step' },
      h('header', { class: 'record-wizard__intro' }, heading, intro),
      content);

    // ------------------------------------------------------------------- footer
    const backButton = button({ label: 'Back', icon: 'chevron-left', onclick: () => stepper.previous() });
    backButton.dataset.narrow = 'icon';
    // A phone shows the amount only; the number of positions is on the Positions step.
    const totalCount = h('span', { class: 'record-wizard__count' });
    const totalAmount = h('span', {});
    const total = h('span', { class: 'record-wizard__total', 'aria-live': 'polite' }, totalCount, totalAmount);
    const nextButton = button({
      label: 'Continue', kind: 'primary', shortcut: modShortcut('Enter', '↵'), onclick: advance
    });
    const footer = h('div', { class: 'shell__footer record-wizard__footer' },
      backButton, h('span', { class: 'shell__spacer' }), total, nextButton);

    const main = h('section', { class: 'shell__main', 'aria-label': 'New quotation' },
      paneHeader({
        leading: [shell.navToggle(), crumbs.toElement()],
        actions: [saveState.toElement(), saveButton, discardButton, actionMenu.toElement()]
      }),
      h('div', { class: 'shell__body shell__body--padded' },
        h('div', { class: 'record-wizard__layout' },
          h('div', { class: 'record-wizard__rail' }, stepper.toElement()),
          stage)),
      footer);

    root.append(main);
    container.append(root);

    shortcuts(root, { 'Mod+Enter': advance, 'Mod+s': saveDraft }, context);
    show(0, { initial: true });

    // ---------------------------------------------------------------- functions

    /**
     * Shows a step: its heading, its form or the review, and the footer that fits it.
     * @param {number} index
     * @param {{initial?: boolean}} [options] The first rendering moves no focus.
     * @returns {void}
     */
    function show(index, { initial = false } = {}) {
      state.step = index;
      const step = STEPS[index];
      heading.textContent = step.title;
      intro.textContent = step.intro;
      content.replaceChildren(step.name === 'review'
        ? review()
        : h('div', { class: 'form-sheet' }, forms[step.name].toElement()));
      backButton.disabled = index === 0;
      nextButton.querySelector('.zx-btn__label').textContent = index === STEPS.length - 1 ? 'Create quotation' : 'Continue';
      renderTotal();
      if (!initial && !context.preview) heading.focus();
    }

    /** Moves on: to the next step, or on the last one, creates the quotation. @returns {void} */
    function advance() {
      if (state.created) return;
      if (state.step < STEPS.length - 1) stepper.next();
      else create();
    }

    /**
     * Checks the form of a step. An invalid step is flagged on the rail and its fields highlighted.
     * @param {number} index
     * @returns {boolean} Whether the step may be left forwards.
     */
    function validate(index) {
      const form = forms[STEPS[index].name];
      if (!form) return true;
      const valid = form.submit();
      stepper.setError(STEPS[index].name, !valid);
      if (!valid) notify('Complete the highlighted fields to continue.', 'warning');
      return valid;
    }

    /**
     * Fills the contact fields from the customer just picked.
     * @param {string} id
     * @returns {void}
     */
    function fillContact(id) {
      const picked = company(id);
      if (!picked) return;
      forms.customer.setValues({ contact: picked.contact, email: picked.email }, { silent: true });
    }

    /** @returns {{customer: Record<string, any>, positions: Record<string, any>}} Everything entered so far. */
    function values() {
      return { customer: forms.customer.getValues(), positions: forms.positions.getValues() };
    }

    /** @returns {Array<object|string>} The header's actions as menu items, for a phone. */
    function actionItems() {
      return [
        {
          label: 'Save draft', icon: 'cloud-arrow-up', value: 'save', shortcut: saveKey.label,
          disabled: state.created, onselect: saveDraft
        },
        '-',
        {
          label: 'Discard draft', icon: 'trash-can', value: 'discard', danger: true,
          disabled: state.created, onselect: confirmDiscard
        }
      ];
    }

    /** Re-derives the total in the footer and marks the draft changed. @returns {void} */
    function edited() {
      renderTotal();
      cancelSave();
      saveState.set('inactive', 'Unsaved changes');
    }

    /** Writes the running total of the selected positions into the footer. @returns {void} */
    function renderTotal() {
      const { positions } = values();
      const sum = totals(positions.items ?? [], positions.discount);
      totalCount.textContent = `${sum.lines.length} ${sum.lines.length === 1 ? 'position' : 'positions'} · `;
      totalAmount.textContent = `${formatCurrency(sum.net, 'EUR')} net`;
    }

    /** @returns {HTMLElement} The review: everything entered, each part with a way back to it. */
    function review() {
      const { customer, positions } = values();
      const sum = totals(positions.items ?? [], positions.discount);
      const edit = (index) => button({ label: 'Edit', size: 'sm', kind: 'ghost', onclick: () => stepper.goTo(STEPS[index].name) });
      const amount = (value) => h('span', { class: 'num' }, formatCurrency(value, 'EUR'));
      return h('div', { class: 'record-wizard__review' },
        h('section', { class: 'surface', 'aria-label': 'Customer' },
          h('div', { class: 'record-wizard__review-head' }, h('h3', { class: 'surface__title' }, 'Customer'), edit(0)),
          propList([
            ['Company', company(customer.customer)?.name],
            ['Contact', `${customer.contact} · ${customer.email}`],
            ['Reference', customer.reference || null],
            ['Payment terms', PAYMENT_TERMS[customer.terms]],
            ['Valid until', customer.validUntil instanceof Date ? formatDate(customer.validUntil, DATE.long) : null]
          ])),
        h('section', { class: 'surface', 'aria-label': 'Positions' },
          h('div', { class: 'record-wizard__review-head' }, h('h3', { class: 'surface__title' }, 'Positions'), edit(1)),
          h('ul', { class: 'record-wizard__lines' }, sum.lines.map((item) => h('li', {},
            h('span', {}, item.name, h('span', { class: 'meta' }, item.unit)),
            amount(item.price)))),
          h('dl', { class: 'record-wizard__sum' },
            h('dt', {}, 'List price'), h('dd', {}, amount(sum.list)),
            h('dt', {}, `Discount ${percent(positions.discount)}`),
            h('dd', {}, h('span', { class: 'num' }, `− ${formatCurrency(sum.discount, 'EUR')}`)),
            h('dt', { dataset: { total: '' } }, 'Net total'), h('dd', { dataset: { total: '' } }, amount(sum.net))),
          positions.note ? h('p', { class: 'record-wizard__note' }, positions.note) : null));
    }

    /** Creates the quotation and shows where it went. @returns {void} */
    function create() {
      const { customer, positions } = values();
      const sum = totals(positions.items ?? [], positions.discount);
      const name = company(customer.customer)?.name ?? 'the customer';
      state.created = true;
      stepper.complete('review');
      cancelSave();
      saveState.set('success', `Created ${formatDate(NOW, DATE.short)}`);
      for (const control of [saveButton, discardButton]) control.disabled = true;
      actionMenu.setItems(actionItems());
      footer.hidden = true;
      heading.textContent = 'Quotation created';
      intro.textContent = `${NEXT_NUMBER} is saved as a draft, ready to send.`;
      content.replaceChildren(emptyState({
        icon: 'circle-check',
        title: `${NEXT_NUMBER} for ${name}`,
        description: `${sum.lines.length} positions, ${formatCurrency(sum.net, 'EUR')} net, valid until `
          + `${formatDate(customer.validUntil, DATE.long)}.`,
        align: 'start',
        actions: [
          { label: 'Open quotation', kind: 'primary', onclick: () => notify(unavailable('The quotation'), 'info') },
          { label: 'New quotation', onclick: restart }
        ]
      }));
      notify(`Quotation ${NEXT_NUMBER} created for ${name}.`);
      // The footer that held the focus is gone; the outcome takes it.
      heading.focus();
    }

    /** Starts over with a fresh draft. @returns {void} */
    function restart() {
      state.created = false;
      for (const form of Object.values(forms)) form.reset();
      for (const step of STEPS) stepper.uncomplete(step.name).setError(step.name, false);
      for (const control of [saveButton, discardButton]) control.disabled = false;
      actionMenu.setItems(actionItems());
      footer.hidden = false;
      saveState.set('inactive', 'Not saved yet');
      // Going back is never vetoed, so the rail's change handler shows the first step.
      if (stepper.getIndex() === 0) show(0);
      else stepper.goTo(STEPS[0].name);
    }

    /** Saves the draft (a simulated round trip). @returns {void} */
    function saveDraft() {
      if (state.created) return;
      saveState.set('active', 'Saving…');
      cancelSave();
      cancelSave = later(context, () => saveState.set('success', `Draft saved ${formatDate(NOW, DATE.time)}`), 600);
    }

    /** Asks before throwing the draft away. @returns {Promise<void>} */
    async function confirmDiscard() {
      const confirmed = await Dialog.confirm({
        title: 'Discard this quotation?',
        message: 'Everything entered so far is lost.',
        okLabel: 'Discard draft',
        danger: true
      });
      if (!confirmed || context.signal.aborted) return;
      restart();
      notify('Draft discarded.', 'info');
    }
  }
};
