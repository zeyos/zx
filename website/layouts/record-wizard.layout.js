import { Form, MasterPanel, Message, button, h } from '../../src/index.js';

// A Field of type `select` takes a `{value: label}` map; keys come back as strings.
const PAYMENT_TERMS = { 14: '14 days net', 30: '30 days net', 60: '60 days net' };

const CATALOGUE = [
  { ID: 'lic-std', name: 'Platform licence — standard' },
  { ID: 'lic-ent', name: 'Platform licence — enterprise' },
  { ID: 'impl', name: 'Implementation package' },
  { ID: 'train', name: 'On-site training day' },
  { ID: 'support', name: 'Priority support (annual)' }
];

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

export default {
  title: 'Record wizard',
  group: 'Applications',
  blurb: 'A guided, multi-step creation flow: one form per step, validation before advancing, and '
    + 'a read-only summary before the record is written.',

  /**
   * Mounts a three-step quotation wizard driven by three Form instances.
   * @param {HTMLElement} container Documentation stage.
   * @returns {void}
   */
  mount(container) {
    /** Collected values across all steps; each step merges into it on a successful validate. */
    const draft = {};
    let current = 0;

    const customerForm = new Form(null, {
      fieldsets: [{
        title: 'Who is this quotation for?',
        columns: 2,
        fields: {
          company: { type: 'text', label: 'Company', required: true, value: 'Bruckner Logistik' },
          contact: { type: 'text', label: 'Contact person', required: true, value: 'Ines Bauer' },
          email: { type: 'text', label: 'E-mail', required: true, value: 'i.bauer@bruckner.example' },
          reference: { type: 'text', label: 'Customer reference', placeholder: 'Optional' },
          terms: { type: 'select', label: 'Payment terms', options: PAYMENT_TERMS, value: '30' },
          validUntil: { type: 'date', label: 'Valid until', value: addDays(new Date(), 30) }
        }
      }]
    });

    const positionsForm = new Form(null, {
      fieldsets: [{
        title: 'What is being quoted?',
        columns: 2,
        fields: {
          items: {
            type: 'checklist',
            label: 'Line items',
            description: 'Pick everything that belongs on the quotation.',
            required: true,
            value: ['lic-std', 'impl'],
            props: { items: CATALOGUE, search: true, height: 168 }
          },
          discount: { type: 'float', label: 'Discount (%)', value: 5 },
          net: { type: 'float', label: 'Net total (EUR)', required: true, value: 48500 },
          note: {
            type: 'textarea',
            label: 'Note on the quotation',
            props: { rows: 3 },
            value: 'Implementation starts within four weeks of signature.'
          }
        }
      }]
    });

    const summary = h('dl', { class: 'summary-list' });
    const reviewStep = h('div', { class: 'layout-stack' },
      h('p', { class: 'layout-hint' }, 'Check the draft before it is written to ZeyOS.'),
      summary
    );

    const steps = [
      { title: 'Customer', element: customerForm.toElement(), form: customerForm },
      { title: 'Positions', element: positionsForm.toElement(), form: positionsForm },
      { title: 'Review', element: reviewStep, form: null }
    ];

    const rail = h('ol', { class: 'wizard-rail' });
    const stage = h('div', { class: 'layout-stack' });

    const back = button({ label: 'Back', icon: 'chevron-left', onclick: () => go(current - 1) });
    const next = button({
      label: 'Continue',
      kind: 'primary',
      icon: 'chevron-right',
      onclick: () => go(current + 1)
    });
    const controls = h('div', { class: 'layout-toolbar' },
      back, h('span', { class: 'layout-toolbar__spacer' }), next);

    const shell = new MasterPanel(null, {
      title: 'New quotation',
      module: 'opportunities',
      content: h('div', { class: 'layout-split' },
        h('div', { class: 'layout-stack' }, stage, controls),
        h('div', { class: 'layout-stack' },
          h('p', { class: 'layout-hint' }, 'Steps'),
          rail)
      ),
      buttons: [{
        label: 'Discard',
        kind: 'ghost',
        icon: 'x',
        onclick: () => {
          steps.forEach((step) => step.form?.reset());
          go(0);
          Message.info('Draft discarded.');
        }
      }],
      footer: 'Record wizard · validation gates every step forward'
    });

    container.append(h('div', { class: 'layout-frame' }, shell.toElement()));
    go(0);

    /**
     * Moves to a step. Moving forward first validates the step being left; moving past the last
     * step commits the draft.
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
        current === steps.length - 1 ? 'Create quotation' : 'Continue';
      renderRail();
    }

    /** Redraws the step rail with done / active / pending states. */
    function renderRail() {
      rail.replaceChildren(...steps.map((step, index) => h('li', {
        dataset: { state: index < current ? 'done' : index === current ? 'active' : 'pending' },
        'aria-current': index === current ? 'step' : undefined
      },
      h('span', { class: 'wizard-rail__index' }, String(index + 1)),
      h('span', {}, step.title))));
    }

    /** Fills the review list from the collected draft. */
    function renderSummary() {
      const values = { ...draft, ...positionsForm.getValues() };
      const selectedItems = (values.items ?? [])
        .map((id) => CATALOGUE.find((entry) => entry.ID === id)?.name)
        .filter(Boolean);
      const gross = Number(values.net || 0) * (1 - Number(values.discount || 0) / 100);

      const rows = [
        ['Company', values.company],
        ['Contact', `${values.contact} · ${values.email}`],
        ['Payment terms', PAYMENT_TERMS[values.terms]],
        ['Valid until', values.validUntil instanceof Date ? values.validUntil.toLocaleDateString() : '—'],
        ['Line items', selectedItems.join(', ') || 'None selected'],
        ['Net total', currency.format(values.net || 0)],
        ['After discount', `${currency.format(gross)} (−${values.discount || 0}%)`]
      ];
      summary.replaceChildren(...rows.flatMap(([term, value]) => [
        h('dt', {}, term),
        h('dd', {}, String(value ?? '—'))
      ]));
    }

    /** Finishes the wizard. A real screen would POST the draft here. */
    function commit() {
      Message.success(`Quotation for ${draft.company} created.`);
      steps.forEach((step) => step.form?.reset());
      go(0);
    }
  }
};

/** @param {Date} date @param {number} days @returns {Date} */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
