import { DataFilter, Form, MasterPanel, Message, Panel, Table, h } from '../../src/index.js';

/** Seed records for the list. A real screen would fetch these from @zeyos/client. */
const RECORDS = [
  { ID: 1, company: 'Alpine Works GmbH', contact: 'Nadine Roth', city: 'Innsbruck', stage: 'customer', owner: 'sales', volume: 148000, email: 'nadine.roth@alpine.example', phone: '+43 512 990 12', notes: 'Renewal due in March. Wants the extended SLA.' },
  { ID: 2, company: 'Northstar Systems', contact: 'Piet Vermeer', city: 'Rotterdam', stage: 'prospect', owner: 'sales', volume: 0, email: 'p.vermeer@northstar.example', phone: '+31 10 240 88', notes: 'Introduced at the logistics fair. Waiting on a technical review.' },
  { ID: 3, company: 'Atelier West', contact: 'Camille Fournier', city: 'Lyon', stage: 'customer', owner: 'service', volume: 32400, email: 'camille@atelier-west.example', phone: '+33 4 78 55 21', notes: 'Small account, very responsive. Two open tickets.' },
  { ID: 4, company: 'Danube Systems AG', contact: 'Tobias Kern', city: 'Linz', stage: 'customer', owner: 'sales', volume: 512900, email: 'kern@danube.example', phone: '+43 732 771 04', notes: 'Largest account. Quarterly business review every January.' },
  { ID: 5, company: 'Helios Energie', contact: 'Marta Silva', city: 'Porto', stage: 'lead', owner: 'marketing', volume: 0, email: 'm.silva@helios.example', phone: '+351 22 330 77', notes: 'Downloaded the integration whitepaper twice.' },
  { ID: 6, company: 'Bruckner Logistik', contact: 'Ines Bauer', city: 'Salzburg', stage: 'prospect', owner: 'sales', volume: 0, email: 'i.bauer@bruckner.example', phone: '+43 662 448 90', notes: 'Needs a migration plan for their legacy dispatch tool.' },
  { ID: 7, company: 'Kestrel Analytics', contact: 'Owen Blythe', city: 'Bristol', stage: 'customer', owner: 'service', volume: 96300, email: 'owen@kestrel.example', phone: '+44 117 902 31', notes: 'Uses the reporting API heavily. Watch rate limits.' },
  { ID: 8, company: 'Salzmann & Partner', contact: 'Ruth Salzmann', city: 'Bern', stage: 'lead', owner: 'marketing', volume: 0, email: 'ruth@salzmann.example', phone: '+41 31 508 66', notes: 'Requested pricing for twelve seats.' }
];

// DataFilter takes `[{value, label}]`; a Field of type `select` takes a `{value: label}` map.
const STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' }
];
const STAGE_LABELS = Object.fromEntries(STAGES.map((stage) => [stage.value, stage.label]));

const OWNERS = [
  { ID: 'sales', name: 'Sales' },
  { ID: 'service', name: 'Service' },
  { ID: 'marketing', name: 'Marketing' }
];

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0
});

export default {
  title: 'Master–detail',
  group: 'Applications',
  blurb: 'The workhorse ERP screen: a filterable record list on the left, an editable detail form '
    + 'on the right, and a single application shell around both.',

  /**
   * Mounts a contacts screen: DataFilter + Table drive a Form inside a MasterPanel.
   * @param {HTMLElement} container Documentation stage.
   * @returns {void}
   */
  mount(container) {
    /** @type {Record<string, unknown>|null} The record currently loaded into the detail form. */
    let selected = null;
    /** Working copy of the dataset so edits survive filtering. */
    const records = RECORDS.map((record) => ({ ...record }));

    const table = new Table(null, {
      columns: [
        { id: 'company', label: 'Company', sortable: true, width: '2fr' },
        { id: 'contact', label: 'Contact', sortable: true, width: '1.4fr' },
        { id: 'city', label: 'City', sortable: true, width: '1fr' },
        {
          id: 'stage',
          label: 'Stage',
          sortable: true,
          width: '1fr',
          render: (row) => h('span', { class: 'stage-pill', dataset: { stage: row.stage } },
            STAGE_LABELS[row.stage] ?? '—')
        },
        {
          id: 'volume',
          label: 'Volume',
          sortable: true,
          align: 'right',
          width: '1fr',
          render: (row) => (row.volume ? currency.format(row.volume) : '—')
        }
      ],
      data: records,
      rowId: 'ID',
      sortMode: 'local',
      sort: { id: 'company', dir: 'asc' },
      selectable: 'single',
      stickyHeader: true,
      height: 420,
      emptyText: 'No records match the current filters.',
      onrowclick: (event) => select(event.detail.row)
    });

    const count = h('p', { class: 'layout-hint' }, `${records.length} records`);

    const filter = new DataFilter(null, {
      data: records,
      clearLabel: 'Clear',
      filters: [
        {
          type: 'text',
          id: 'search',
          label: 'Find',
          fields: ['company', 'contact', 'city'],
          placeholder: 'Company, contact, or city'
        },
        {
          type: 'select',
          id: 'stage',
          label: 'Stage',
          field: 'stage',
          emptyLabel: 'All stages',
          options: STAGES
        },
        {
          type: 'select',
          id: 'owner',
          label: 'Owner',
          field: 'owner',
          emptyLabel: 'All teams',
          options: OWNERS.map((owner) => ({ value: owner.ID, label: owner.name }))
        }
      ],
      onfilter: (event) => {
        table.setData(event.detail.rows);
        count.textContent = `${event.detail.rows.length} of ${records.length} records`;
      }
    });

    // The detail pane swaps between an empty state and the form, so the form is built once.
    const form = new Form(null, {
      fieldsets: [
        {
          title: 'Contact',
          columns: 2,
          fields: {
            company: { type: 'text', label: 'Company', required: true },
            contact: { type: 'text', label: 'Primary contact', required: true },
            email: { type: 'text', label: 'E-mail' },
            phone: { type: 'text', label: 'Phone' },
            city: { type: 'text', label: 'City' },
            stage: { type: 'select', label: 'Stage', options: STAGE_LABELS }
          }
        },
        {
          title: 'Account',
          columns: 2,
          fields: {
            owner: {
              type: 'zxselect',
              label: 'Owning team',
              props: { items: OWNERS, filter: false }
            },
            volume: { type: 'float', label: 'Annual volume (EUR)' },
            notes: { type: 'textarea', label: 'Notes', props: { rows: 3 } }
          }
        }
      ],
      actions: [
        { label: 'Save', kind: 'primary', icon: 'check', onClick: () => form.submit() },
        { label: 'Revert', kind: 'ghost', onClick: () => selected && load(selected) }
      ],
      onsubmit: (event) => {
        // The form only holds the edited fields, so merge them onto the record it was loaded from.
        const saved = Object.assign(selected, event.detail.values);
        table.updateRow(saved.ID, saved);
        detail.setTitle(saved.company);
        count.textContent = `${table.getData().length} of ${records.length} records`;
        Message.success(`${saved.company} saved.`);
      }
    });

    const empty = h('div', { class: 'layout-empty' },
      h('p', {}, 'Select a record on the left to edit it here.'));
    const detail = new Panel(null, {
      title: 'Details',
      content: empty,
      collapsible: false
    });

    const workspace = h('div', { class: 'layout-split' },
      h('div', { class: 'layout-stack' }, filter.toElement(), table.toElement(), count),
      detail.toElement()
    );

    const shell = new MasterPanel(null, {
      title: 'Contacts',
      module: 'contacts',
      content: workspace,
      buttons: [
        {
          label: 'New contact',
          icon: 'plus',
          kind: 'primary',
          onclick: () => select(blankRecord())
        },
        {
          label: 'Export',
          icon: 'upload',
          onclick: () => Message.info('Export would stream the filtered rows as CSV.')
        }
      ],
      footer: 'Master–detail · list, filter, and editor share one dataset'
    });

    container.append(h('div', { class: 'layout-frame' }, shell.toElement()));

    /**
     * Loads a record into the detail form and marks it selected in the list.
     * @param {Record<string, unknown>} record
     * @returns {void}
     */
    function select(record) {
      selected = record;
      load(record);
      detail.setTitle(record.company || 'New contact');
      detail.setContent(form.toElement());
      table.setSelection([record.ID]);
    }

    /** @param {Record<string, unknown>} record @returns {void} */
    function load(record) {
      form.clearHighlights();
      form.setValues(record, { silent: true });
    }

    /**
     * Appends an empty record to both the dataset and the visible list, so the new row is there
     * to select while it is being filled in.
     * @returns {Record<string, unknown>}
     */
    function blankRecord() {
      const record = {
        ID: Math.max(...records.map((item) => item.ID)) + 1,
        company: '', contact: '', city: '', stage: 'lead',
        owner: 'sales', volume: 0, email: '', phone: '', notes: ''
      };
      records.push(record);
      table.addData([record]);
      count.textContent = `${table.getData().length} of ${records.length} records`;
      return record;
    }
  }
};
