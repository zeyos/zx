import {
  Breadcrumb, DateRangeBox, Dialog, Field, FileItem, Grid, InlineLoading,
  MenuButton, Select, SplitView, TagPicker, Toggle, Tooltip, addDays, badge, billingColumns, button,
  emptyState, formatCurrency, formatDate, formatNumber, formatPercent, grid, h, icon, isBillingLine,
  stack
} from '../../src/index.js';
import {
  DATE, SHELL_BREAKPOINTS, adaptiveShell, disposer, iconButton, later, layoutContext, modShortcut,
  paneHeader, renderScope, shortcuts, suiteNav, toaster, unavailable
} from './kit.js';
import { COMPANIES, ME, NOW, ORGANISATION, company, person } from './fixtures.js';

/** Postal and tax details per customer, keyed by the company ids in the shared fixtures. */
const CUSTOMER_DETAILS = {
  alpine: { number: '10118', lines: ['Grabenweg 68', '6020 Innsbruck'], vatId: 'ATU 7731 2084' },
  danube: { number: '10127', lines: ['Lassallestraße 7b', '1020 Vienna'], vatId: 'ATU 6204 9917' },
  kestrel: { number: '10142', lines: ['4 Jordan Street', 'Manchester M1 5HW'], vatId: 'GB 284 1937 05' },
  northstar: { number: '10163', lines: ['Waalhaven Oostzijde 82', '3087 BM Rotterdam'], vatId: 'NL 8620 41853 B01' },
  helios: { number: '10189', lines: ['27 Rue de la Villette', '69003 Lyon'], vatId: 'FR 61 834 205 117' },
  bruckner: { number: '10234', lines: ['Landsberger Straße 302', '80687 Munich'], vatId: 'DE 291 447 860' },
  atelier: { number: '10251', lines: ['Große Elbstraße 145', '22767 Hamburg'], vatId: 'DE 307 118 254' },
  meridian: { number: '10277', lines: ['Hardturmstrasse 161', '8005 Zurich'], vatId: 'CHE-114.582.903' }
};

/** Countries whose business customers are invoiced under the EU reverse-charge rule. */
const EU_COUNTRIES = ['Austria', 'France', 'Netherlands'];

/** ACME's register and tax details for the page footer. */
const IMPRINT = {
  court: 'Charlottenburg local court',
  register: 'HRB 214553 B',
  taxNumber: '29/518/40263',
  email: 'billing@acme.example'
};

/** The product catalogue the position search offers. Prices are net, in EUR. */
const PRODUCTS = [
  { ID: 'AC-PLT-BUS', name: 'ACME Platform, Business plan', unit: 'month', price: 1450, vat: 19, icon: 'cloud' },
  { ID: 'AC-SEAT', name: 'Additional user seats', unit: 'seat', price: 24, vat: 19, icon: 'users' },
  { ID: 'SV-IMPL', name: 'Implementation consulting', unit: 'hour', price: 145, vat: 19, icon: 'clock-regular' },
  { ID: 'SV-WS', name: 'On-site workshop, full day', unit: 'day', price: 1280, vat: 19, icon: 'users' },
  { ID: 'SV-SUP', name: 'Premium support, quarterly', unit: 'quarter', price: 2400, vat: 19, icon: 'shield-halved' },
  { ID: 'HW-GW2', name: 'Edge gateway G2', unit: 'piece', price: 389, vat: 19, icon: 'server' },
  { ID: 'BK-ADM', name: 'Administrator handbook, printed', unit: 'piece', price: 39.9, vat: 7, icon: 'book-open' },
  { ID: 'BK-WB', name: 'Training workbook, printed', unit: 'piece', price: 18.5, vat: 7, icon: 'book-open' },
  { ID: 'SV-TRV', name: 'Travel expenses, flat rate', unit: 'flat', price: 320, vat: 19, icon: 'route' }
];

/** Units a position can be billed in, with their singular and plural forms. */
const UNITS = [
  { value: 'hour', label: 'Hours', one: 'hour', many: 'hours' },
  { value: 'day', label: 'Days', one: 'day', many: 'days' },
  { value: 'month', label: 'Months', one: 'month', many: 'months' },
  { value: 'quarter', label: 'Quarters', one: 'quarter', many: 'quarters' },
  { value: 'seat', label: 'Seats', one: 'seat', many: 'seats' },
  { value: 'piece', label: 'Pieces', one: 'pc', many: 'pcs' },
  { value: 'flat', label: 'Flat rate', one: 'flat', many: 'flat' }
];

/** German VAT rates: standard, reduced (printed matter), and exempt. */
const VAT_RATES = [
  { value: 19, label: '19% standard' },
  { value: 7, label: '7% reduced' },
  { value: 0, label: '0% exempt' }
];

/** Payment terms; `cash` is an early-payment discount. */
const PAYMENT_TERMS = [
  { ID: 'now', name: 'Due on receipt', days: 0 },
  { ID: 'net14', name: '14 days net', days: 14 },
  { ID: 'net30', name: '30 days net', days: 30 },
  { ID: 'cash', name: '2% in 10 days, 30 net', days: 30, cash: { days: 10, rate: 2 } }
];

/** Below this width of the invoice pane the editor and the page take turns instead of sharing it. */
const SIDE_BY_SIDE = 960;

/** Field names `Grid.BillingItems()` reads; these are its defaults, spelled out for `billingColumns()`. */
const BILLING_FIELDS = {
  id: 'id', parent: 'parent', item: 'item', kind: 'kind', quantity: 'quantity',
  unit: 'unit', unitPrice: 'unitPrice', currency: 'currency', total: 'total'
};

/** The draft being edited; it is dated today. */
const INVOICE = {
  number: 'RE-2026-0142',
  customer: 'bruckner',
  period: ['2026-09-01', '2026-09-30'],
  terms: 'net14',
  reference: 'PO-55120',
  intro: 'Thank you for your order. As agreed, we invoice the following services for September 2026.',
  closing: 'If you have any questions about this invoice, please contact us at billing@acme.example.'
};

/** Its positions, as `Grid.BillingItems()` rows. */
const LINES = [
  { id: 'l1', kind: 'line', sku: 'AC-PLT-BUS', item: 'ACME Platform, Business plan', quantity: 1, unit: 'month', unitPrice: 1450, vat: 19, discount: 0 },
  { id: 'l2', kind: 'line', sku: 'AC-SEAT', item: 'Additional user seats', quantity: 18, unit: 'seat', unitPrice: 24, vat: 19, discount: 10 },
  { id: 'l3', kind: 'line', sku: 'SV-IMPL', item: 'Implementation consulting', quantity: 12.5, unit: 'hour', unitPrice: 145, vat: 19, discount: 0 },
  { id: 'l4', kind: 'line', sku: 'SV-WS', item: 'On-site workshop, Munich', quantity: 1, unit: 'day', unitPrice: 1280, vat: 19, discount: 0 },
  { id: 'l5', kind: 'line', sku: 'BK-ADM', item: 'Administrator handbook, printed', quantity: 6, unit: 'piece', unitPrice: 39.9, vat: 7, discount: 0 }
];

/** Destinations in the navigation column, one list per group. */
const NAVIGATION = {
  home: [{ id: 'dashboard', label: 'Dashboard', icon: 'gauge' }],
  documents: [
    { id: 'invoices', label: 'Invoices', icon: 'file-invoice', badge: 3 },
    { id: 'quotes', label: 'Quotes', icon: 'file-lines' },
    { id: 'credit-notes', label: 'Credit notes', icon: 'receipt' },
    { id: 'delivery-notes', label: 'Delivery notes', icon: 'truck' }
  ],
  business: [
    { id: 'customers', label: 'Customers', icon: 'users' },
    { id: 'products', label: 'Products', icon: 'box' },
    { id: 'payments', label: 'Payments', icon: 'credit-card', badge: 2 },
    { id: 'reports', label: 'Reports', icon: 'chart-column' }
  ]
};

/**
 * Parses a `YYYY-MM-DD` string as a local calendar day.
 * @param {string} iso
 * @returns {Date}
 */
function isoDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Rounds a euro amount to whole cents, the way an accounting system books it.
 * @param {number} value
 * @returns {number}
 */
function cents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Formats an amount in euros with the shared Zx formatter.
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return formatCurrency(value, 'EUR');
}

/**
 * Formats a date the way it is written on the page: "8 October 2026".
 * @param {Date} date
 * @returns {string}
 */
function longDate(date) {
  return formatDate(date, DATE.long);
}

/**
 * Writes a percentage given in whole points: `percent(19)` is "19%", `percent(2.5)` "2.5%".
 * @param {number} points
 * @returns {string}
 */
function percent(points) {
  return formatPercent(Number(points) / 100, { decimals: Number.isInteger(Number(points)) ? 0 : 1 });
}

/**
 * Writes a service period compactly: "1–30 September 2026", or "1 Sep – 15 Oct 2026".
 * @param {{start: Date|null, end: Date|null}} period
 * @returns {string}
 */
function periodText({ start, end }) {
  if (!start || !end) return start ? longDate(start) : '—';
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${longDate(end)}`;
  }
  return `${formatDate(start, DATE.year)} – ${formatDate(end, DATE.year)}`;
}

/**
 * The quantity's unit in the right number: "1 day", "12.5 hours".
 * @param {string} unit
 * @param {number} quantity
 * @returns {string}
 */
function unitLabel(unit, quantity) {
  const entry = UNITS.find((candidate) => candidate.value === unit);
  if (!entry) return unit ?? '';
  return Number(quantity) === 1 ? entry.one : entry.many;
}

/**
 * A position's net amount: quantity × unit price, less its discount.
 * @param {Record<string, any>} row
 * @returns {number}
 */
function lineNet(row) {
  const gross = Number(row.quantity ?? 0) * Number(row.unitPrice ?? 0);
  return cents(gross * (1 - Number(row.discount ?? 0) / 100));
}

/**
 * A customer from the fixtures merged with its postal and tax details.
 * @param {string} id
 * @returns {(typeof COMPANIES)[number] & {number: string, lines: string[], vatId: string}}
 */
function customerOf(id) {
  return { ...company(id), ...CUSTOMER_DETAILS[id] };
}

/**
 * The people an invoice to this customer can be addressed to.
 * @param {ReturnType<typeof customerOf>} customer
 * @returns {{ID: string, name: string, email: string, attention: string, salutation: string}[]}
 */
function contactsOf(customer) {
  return [
    {
      ID: 'main', name: customer.contact, email: customer.email,
      attention: `Attn. ${customer.contact}`, salutation: `Dear ${customer.contact},`
    },
    {
      ID: 'payables', name: 'Accounts payable', email: `invoices@${customer.domain}`,
      attention: 'Accounts payable', salutation: 'Dear Sir or Madam,'
    }
  ];
}

/**
 * Which VAT treatment a German supplier applies to a business customer in this country: the
 * treatment in words, the customer's region as a categorical badge, and the legal note it prints.
 * @param {ReturnType<typeof customerOf>} customer
 * @returns {{taxable: boolean, label: string, region: string, tone: 'slate'|'blue'|'violet',
 *   note: string|null}}
 */
function taxRule(customer) {
  if (customer.country === ORGANISATION.country) {
    return { taxable: true, label: 'German VAT', region: 'Domestic', tone: 'slate', note: null };
  }
  if (EU_COUNTRIES.includes(customer.country)) {
    return {
      taxable: false,
      label: 'Reverse charge',
      region: 'EU',
      tone: 'blue',
      note: 'Reverse charge: VAT is payable by the recipient (Article 196, Council Directive 2006/112/EC).'
    };
  }
  return {
    taxable: false,
    label: 'No German VAT',
    region: 'Outside the EU',
    tone: 'violet',
    note: 'Not taxable in Germany: the place of supply is the recipient’s country (Section 3a (2) German VAT Act).'
  };
}

/**
 * @param {Record<string, any>} row A billing row.
 * @returns {boolean} Whether the position carries a line discount.
 */
function hasDiscount(row) {
  return Number(row.discount ?? 0) > 0;
}

/**
 * A position's article cell: the description over its catalogue number, and the line's actions,
 * which a draft shows at the end of the cell while the line is pointed at or focused.
 * @param {Record<string, any>} row
 * @param {Node|null} [actions]
 * @returns {HTMLElement}
 */
function articleCell(row, actions = null) {
  return h('span', { class: 'invoicing__article', title: row.item || null },
    h('span', { class: 'invoicing__article-name' }, row.item ?? ''),
    row.sku ? h('span', { class: 'invoicing__article-sku' }, row.sku) : null,
    actions);
}

/**
 * A position's quantity with its unit, as a booked invoice shows it: "18 seats".
 * @param {Record<string, any>} row
 * @returns {string}
 */
function quantityText(row) {
  return row.quantity == null ? '' : `${formatNumber(row.quantity)} ${unitLabel(row.unit, row.quantity)}`;
}

/**
 * Totals an invoice: list price, discounts, net, VAT per rate, and the amount due.
 * VAT is computed once per rate on the summed net, not per position.
 * @param {Record<string, any>[]} lines Billing rows.
 * @param {{taxable: boolean}} rule Tax treatment.
 * @returns {{list: number, discount: number, net: number, vat: number, total: number,
 *   rates: {rate: number, base: number, amount: number}[]}}
 */
function summarize(lines, rule) {
  const buckets = new Map();
  let list = 0;
  let net = 0;
  for (const line of lines) {
    const amount = lineNet(line);
    const rate = rule.taxable ? Number(line.vat ?? 0) : 0;
    list += Number(line.quantity ?? 0) * Number(line.unitPrice ?? 0);
    net += amount;
    buckets.set(rate, (buckets.get(rate) ?? 0) + amount);
  }
  const rates = [...buckets].sort(([a], [b]) => b - a)
    .map(([rate, base]) => ({ rate, base: cents(base), amount: cents(base * rate / 100) }));
  const vat = cents(rates.reduce((sum, entry) => sum + entry.amount, 0));
  return { list: cents(list), discount: cents(list - net), net: cents(net), vat, total: cents(net + vat), rates };
}

/**
 * Hosts a Zx input component inside a labelled `Field`, so composed pickers share the label,
 * spacing, and disabled state of the plain fields beside them.
 * @param {string} label Visible label.
 * @param {Select|DateRangeBox|TagPicker} control The component to host; the field destroys it.
 * @returns {Field}
 */
function controlField(label, control) {
  return new Field(null, {
    type: 'custom',
    label,
    adapter: (field) => {
      field.own(control);
      // The component announces its own `change`; the native one from its input would repeat it.
      field.listen(control.el, 'change', (event) => event.stopImmediatePropagation());
      field.listen(field.el, 'click', (event) => {
        if (event.target.closest?.('.zx-field__label')) control.focus();
      });
      return {
        el: control.el,
        get: () => null,
        set: () => {},
        focus: () => control.focus(),
        setDisabled: (disabled) => (disabled ? control.disable() : control.enable())
      };
    }
  });
}

export default {
  title: 'Invoice editor',
  category: 'Finance',
  blurb: 'A draft invoice beside its live A4 page, with VAT per rate and a send step that locks it.',
  components: [
    'Grid', 'SplitView', 'DateRangeBox', 'Select', 'Field', 'Datebox', 'TagPicker', 'FileItem',
    'Dialog', 'Breadcrumb', 'InlineLoading', 'MenuButton', 'Toggle', 'Tooltip', 'Badge', 'Message',
    'AppSidebar', 'ModuleBar', 'AccountMenu'
  ],

  /**
   * Mounts the invoice editor: navigation, the editing form with its positions grid, and the
   * page preview that re-typesets on every change.
   * @param {HTMLElement} container Gallery stage.
   * @param {Partial<import('./kit.js').LayoutContext>} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const me = person(ME);

    // ---------------------------------------------------------------- navigation column
    // The suite's navigation: Billing's own menu beside every other module of the suite. Only the
    // invoices are part of this example; every other destination says so.
    const nav = suiteNav(context, { module: 'billing', menu: navigationItems(), active: 'invoices' });
    const root = h('div', { class: 'invoicing shell' }, nav.column);
    // Narrow, the navigation becomes a drawer; the editor and the page then take turns (see
    // `fitView()`), and a phone keeps only the header's icons.
    const shell = adaptiveShell(root, context);
    const notify = toaster(context, root);
    const gridScope = renderScope(context);
    const sendScope = renderScope(context);

    const state = {
      status: /** @type {'draft'|'sent'|'paid'} */ ('draft'),
      deleted: false,
      number: INVOICE.number,
      customer: INVOICE.customer,
      contact: 'main',
      date: new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()),
      period: { start: isoDate(INVOICE.period[0]), end: isoDate(INVOICE.period[1]) },
      terms: INVOICE.terms,
      reference: INVOICE.reference,
      intro: INVOICE.intro,
      closing: INVOICE.closing,
      zoom: /** @type {'fit'|number} */ ('fit'),
      // Whether the page is showing — beside the editor where both fit, instead of it where not.
      page: true,
      switching: false,
      phone: false,
      recipients: /** @type {string[]} */ ([]),
      // The discount column is shown only while a position carries a discount.
      discounts: LINES.some(hasDiscount)
    };
    let lineCount = LINES.length;
    let cancelSave = () => {};
    /** @type {HTMLElement|null} What had focus in the editor when the page took its place. */
    let editorFocus = null;

    // ------------------------------------------------------------------- header
    // The trail's last item is the invoice number, which is also the page's title.
    const crumbs = keep(new Breadcrumb(null, {
      items: crumbItems(),
      onselect: () => notify(unavailable('The invoice list'), 'info')
    }));
    const statusSlot = h('span', { class: 'invoicing__status' });
    const saveState = keep(new InlineLoading(null, { status: 'inactive', size: 'sm', description: 'All changes saved' }));
    const saveKey = modShortcut('s');
    // On a phone, Save draft moves into the More menu and the other actions keep only their icons.
    const saveButton = button({ label: 'Save draft', title: `Save draft (${saveKey.label})`, onclick: save });
    saveButton.setAttribute('aria-keyshortcuts', saveKey.keys);
    saveButton.dataset.narrow = 'hide';
    const previewKey = modShortcut('p');
    const previewButton = button({
      label: 'Preview', icon: 'eye-regular', title: `Show or hide the page (${previewKey.label})`,
      onclick: () => setPreview(!state.page)
    });
    previewButton.setAttribute('aria-keyshortcuts', previewKey.keys);
    previewButton.classList.add('invoicing__preview-toggle');
    const finalizeButton = button({
      label: 'Finalize & send', icon: 'paper-plane', kind: 'primary', onclick: openFinalize,
      shortcut: modShortcut('Enter', '↵')
    });
    finalizeButton.dataset.narrow = 'icon';
    const paymentButton = button({ label: 'Record payment', icon: 'coins', kind: 'primary', onclick: recordPayment });
    paymentButton.dataset.narrow = 'icon';
    paymentButton.hidden = true;
    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost', placement: 'bottom-end', items: menuItems()
    }));

    // ------------------------------------------------------------------- editor
    const customerSelect = Select.entity(null, {
      label: 'Customer',
      items: COMPANIES.map((entry) => ({
        ID: entry.id, name: entry.name, description: `${entry.city}, ${entry.country}`, icon: 'building'
      })),
      value: state.customer,
      filter: 'local',
      searchKeys: ['name', 'description'],
      onchange: (event) => {
        if (event.detail.value) changeCustomer(String(event.detail.value));
      }
    });
    const contactSelect = Select.entity(null, {
      label: 'Contact',
      items: contactsOf(customerOf(state.customer)),
      value: state.contact,
      subtitleKey: 'email',
      onchange: (event) => {
        if (!event.detail.value) return;
        state.contact = String(event.detail.value);
        renderAddress();
        edited();
      }
    });
    const periodBox = new DateRangeBox(null, {
      start: state.period.start,
      end: state.period.end,
      onchange: (event) => {
        state.period = { start: event.detail.start, end: event.detail.end };
        edited();
      }
    });

    // The card's title names the customer picker, so the picker carries no label of its own.
    keep(customerSelect);
    const fields = {
      contact: keep(controlField('Contact', contactSelect)),
      number: keep(new Field(null, { type: 'text', label: 'Invoice number', value: state.number })),
      date: keep(new Field(null, {
        type: 'date', label: 'Invoice date', value: state.date, props: { clearable: false },
        onchange: (event) => {
          if (!(event.detail.value instanceof Date)) return;
          state.date = event.detail.value;
          edited();
        }
      })),
      terms: keep(new Field(null, {
        type: 'zxselect', label: 'Payment terms', value: state.terms,
        props: { items: PAYMENT_TERMS, valueKey: 'ID', labelKey: 'name' },
        onchange: (event) => {
          state.terms = String(event.detail.value ?? 'net14');
          edited();
        }
      })),
      period: keep(controlField('Service period', periodBox)),
      reference: keep(new Field(null, {
        type: 'text', label: 'PO reference', value: state.reference, placeholder: 'Customer order number'
      })),
      intro: keep(new Field(null, { type: 'textarea', label: 'Introduction', value: state.intro, props: { rows: 3 } })),
      closing: keep(new Field(null, { type: 'textarea', label: 'Closing text', value: state.closing, props: { rows: 3 } }))
    };
    for (const key of ['number', 'reference', 'intro', 'closing']) bindText(fields[key], key);

    const address = h('address', { class: 'invoicing__address' });
    // The VAT treatment follows from the customer's country; it is read, never typed.
    const treatment = h('dd', { class: 'invoicing__treatment' });
    const lineCountText = h('span', { class: 'surface__meta' });
    const totalsList = h('dl', { class: 'invoicing__totals' });
    const totalDue = h('dl', { class: 'invoicing__total-due' });

    const adder = keep(Select.entity(null, {
      label: 'Add a position from the catalogue',
      placeholder: 'Add from the catalogue…',
      items: PRODUCTS,
      subtitleKey: (item) => `${item.ID} · ${money(item.price)} per ${unitLabel(item.unit, 1)} · ${percent(item.vat)} VAT`,
      filter: 'local',
      searchKeys: ['name', 'ID'],
      create: { label: 'Add a free-text position', icon: 'pen' },
      onchange: (event) => {
        if (!event.detail.item) return;
        addProduct(/** @type {(typeof PRODUCTS)[number]} */ (event.detail.item));
        adder.set(null, { silent: true });
      },
      onaction: () => addBlankLine()
    }));
    const addLineButton = button({ label: 'Blank line', icon: 'plus', kind: 'ghost', onclick: () => addBlankLine() });
    const editingHelp = iconButton('circle-info', 'How to edit positions');
    keep(new Tooltip(editingHelp, {
      content: 'Click a cell to edit it. Drag a line by its handle, or press Space on the handle, to reorder.',
      placement: 'top-end'
    }));
    const adderArea = h('div', { class: 'invoicing__adder' }, adder.toElement(), addLineButton, editingHelp);

    const gridHost = h('div', { class: 'invoicing__grid' });
    let billing = gridScope.own(createGrid(LINES.map((line) => ({ ...line, currency: 'EUR', total: lineNet(line) })), false));
    gridHost.append(billing.toElement());

    const lockedNote = h('div', { class: 'invoicing__locked', hidden: true });

    const editor = h('div', { class: 'shell__body shell__body--padded invoicing__editor' }, stack({ gap: 4 },
      lockedNote,
      // The details need the wider half: two fields side by side.
      h('div', { class: 'invoicing__cards' },
        h('section', { class: 'surface invoicing__card', 'aria-label': 'Customer' },
          h('h3', { class: 'surface__title' }, 'Customer'),
          customerSelect.toElement(),
          fields.contact.toElement(),
          h('div', { class: 'invoicing__bill-to' }, h('p', { class: 'invoicing__caption' }, 'Bill to'), address)),
        h('section', { class: 'surface invoicing__card', 'aria-label': 'Invoice details' },
          h('h3', { class: 'surface__title' }, 'Details'),
          grid({ columns: 2, min: '7rem', gap: 3, class: 'invoicing__fields' },
            fields.number.toElement(), fields.date.toElement(),
            fields.terms.toElement(), fields.reference.toElement(),
            h('div', { class: 'invoicing__wide' }, fields.period.toElement()),
            h('dl', { class: 'invoicing__wide invoicing__fact' }, h('dt', {}, 'VAT treatment'), treatment)))),
      h('section', { class: 'surface', 'aria-label': 'Positions' },
        stack({ direction: 'row', justify: 'between', align: 'baseline', gap: 3 },
          h('h3', { class: 'surface__title' }, 'Positions'), lineCountText),
        h('div', { class: 'invoicing__positions' }, gridHost, adderArea),
        h('div', { class: 'invoicing__summary' }, totalsList, totalDue)),
      h('section', { class: 'surface', 'aria-label': 'Texts' },
        h('h3', { class: 'surface__title' }, 'Texts'),
        grid({ columns: 2, min: '14rem', gap: 4 }, fields.intro.toElement(), fields.closing.toElement()))));

    // ------------------------------------------------------------------ preview
    const paper = h('article', {
      class: 'invoicing__paper',
      'aria-label': 'Invoice page preview',
      // Paper stays paper in the dark theme: the page is a light-theme island of the same tokens.
      dataset: { zxTheme: 'light' }
    });
    const sheet = h('div', { class: 'invoicing__sheet' }, paper);
    const viewport = h('div', { class: 'shell__body invoicing__viewport', tabIndex: 0, 'aria-label': 'Page preview' }, sheet);
    const zoomMenu = keep(new MenuButton(null, { label: formatPercent(1), kind: 'ghost', placement: 'top', items: [] }));
    const zoomBar = h('div', { class: 'invoicing__zoom', role: 'toolbar', 'aria-label': 'Zoom' },
      iconButton('minus', 'Zoom out', () => stepZoom(-1)),
      zoomMenu.toElement(),
      iconButton('plus', 'Zoom in', () => stepZoom(1)));
    const preview = h('div', { class: 'invoicing__preview' }, viewport, zoomBar);

    const split = keep(new SplitView(h('div', { class: 'invoicing__split' }), {
      start: editor,
      end: preview,
      size: '56%',
      min: 420,
      collapsible: 'end',
      label: 'Resize editor and preview',
      // The divider folds the page away (Enter) and brings it back; only side by side.
      oncollapse: (event) => {
        if (!state.switching && event.detail.pane === 'end') syncPreview(false);
      },
      onexpand: () => {
        syncPreview(true);
        layoutSheet();
      }
    }));
    previewButton.setAttribute('aria-pressed', 'true');

    const deletedView = h('div', { class: 'invoicing__deleted' }, emptyState({
      icon: 'trash-can',
      title: 'Draft moved to the bin',
      description: 'It stays there for 30 days. Restore it to keep working on it.',
      actions: [{ label: 'Restore draft', icon: 'rotate-left', onclick: () => setDeleted(false) }]
    }));

    const main = h('section', { class: 'shell__main invoicing__main', 'aria-label': 'Invoice' },
      paneHeader({
        leading: [shell.navToggle(), crumbs.toElement(), statusSlot],
        actions: [saveState.toElement(), saveButton, previewButton, finalizeButton, paymentButton, more.toElement()]
      }),
      split.toElement(),
      deletedView);

    root.append(main);
    container.append(root);

    const resizer = new ResizeObserver(() => layoutSheet());
    resizer.observe(viewport);
    resizer.observe(paper);
    const fitter = new ResizeObserver(() => fitView());
    fitter.observe(main);
    context.cleanup(() => {
      resizer.disconnect();
      fitter.disconnect();
    });

    shortcuts(root, {
      'Mod+s': save,
      'Mod+Enter': openFinalize,
      'Mod+p': () => setPreview(!state.page),
      // Where the page stands in for the editor, Escape goes back to editing.
      Escape: () => (state.switching && state.page && !state.deleted ? setPreview(false) : false)
    }, context);

    renderStatus();
    renderAddress();
    render();
    renderZoomMenu();
    fitView();

    // ---------------------------------------------------------------- functions

    /** @returns {Record<string, any>[]} Billing's menu: the overview, then documents and business. */
    function navigationItems() {
      const entry = (item) => ({
        ...item,
        invoke: () => (item.id === 'invoices' ? null : notify(unavailable(item.label), 'info'))
      });
      return [
        ...NAVIGATION.home.map(entry),
        { section: true, label: 'Documents', children: NAVIGATION.documents.map(entry) },
        { section: true, label: 'Business', children: NAVIGATION.business.map(entry) }
      ];
    }

    /** @returns {{name: string, label: string}[]} The breadcrumb trail for the current number. */
    function crumbItems() {
      return [{ name: 'invoices', label: 'Invoices' }, { name: 'invoice', label: state.number || 'New invoice' }];
    }

    /**
     * The overflow menu, with Delete only while a draft. On a phone, where the header has no room
     * for it, Save draft leads it.
     * @returns {Array<object|string>}
     */
    function menuItems() {
      const saving = state.phone && state.status === 'draft'
        ? [{ label: 'Save draft', icon: 'cloud-arrow-up', value: 'save', shortcut: saveKey.label, onselect: save }, '-']
        : [];
      return [
        ...saving,
        { label: 'Duplicate', icon: 'copy-regular', value: 'duplicate', onselect: () => notify(`Duplicated as draft ${INVOICE.number.replace(/\d+$/, '0143')}.`) },
        { label: 'Download PDF', icon: 'file-pdf', value: 'pdf', onselect: () => notify(`${state.number}.pdf downloaded.`) },
        '-',
        { label: 'Delete draft', icon: 'trash-can', value: 'delete', danger: true, disabled: state.status !== 'draft', onselect: confirmDelete }
      ];
    }

    /**
     * Keeps a text field and the invoice state in step on every keystroke.
     * @param {Field} field
     * @param {'number'|'reference'|'intro'|'closing'} key
     * @returns {void}
     */
    function bindText(field, key) {
      field.getInput().addEventListener('input', (event) => {
        state[key] = /** @type {HTMLInputElement} */ (event.target).value;
        if (key === 'number') crumbs.setItems(crumbItems());
        edited();
      }, { signal: context.signal });
    }

    /**
     * Builds the positions grid. A sent invoice gets a read-only one: no editors, no handles.
     * @param {Record<string, any>[]} data Billing rows.
     * @param {boolean} locked
     * @returns {Grid}
     */
    function createGrid(data, locked) {
      return Grid.BillingItems(null, {
        data,
        columns: positionColumns(locked),
        hierarchy: false,
        columnVisibility: false,
        rowReorder: !locked,
        editMode: locked ? false : 'cell',
        zebra: false,
        // The card is the frame: no box of the table's own, hairlines between the lines.
        variant: 'plain',
        // The lines stay a grid at every width — a narrow card scrolls them sideways — so every
        // cell stays editable in place, as a spreadsheet's would.
        responsive: false,
        lineTotal: (row) => lineNet(row),
        emptyText: () => emptyState({
          icon: 'file-invoice', size: 'sm', title: 'No positions yet',
          description: 'Search the catalogue below or add a blank line.'
        }),
        ondatachange: () => render(),
        oneditcommit: (event) => {
          if (!Object.is(event.detail.value, event.detail.previous)) markDirty();
        },
        onrowmove: () => markDirty()
      });
    }

    /**
     * The grid's columns. The article takes the room the figures leave. A draft edits quantity and
     * unit in two cells that read as one ("18 seats"); a booked invoice prints them as one and
     * numbers its lines instead of offering handles. Discounts get a column only while a line
     * carries one.
     * @param {boolean} locked
     * @returns {import('../../src/components/table/table.js').TableColumn[]}
     */
    function positionColumns(locked) {
      const taxable = () => taxRule(customerOf(state.customer)).taxable;
      const editable = (type) => (row) => (!locked && isBillingLine(row) ? type : false);
      const preset = Object.fromEntries(billingColumns(BILLING_FIELDS, {
        units: UNITS, currencies: [], currency: 'EUR', decimals: 2,
        columnOverrides: {
          item: {
            label: 'Article', width: '4.2fr', sortable: false, popin: false, editable: editable('text'),
            render: (row) => articleCell(row, locked ? null : lineActions(row)),
            validate: (value) => (String(value ?? '').trim() ? true : 'Describe the position.')
          },
          quantity: locked
            ? { label: 'Qty', width: '1.5fr', type: 'number', render: quantityText }
            : { label: 'Qty', width: '.75fr', type: 'number', editable: editable('number') },
          unit: {
            label: '', headerTitle: 'Unit', width: '.85fr', editable: editable('select'),
            render: (row) => unitLabel(row.unit, row.quantity)
          },
          // Every line is in euros, said once above the grid, so the figures go without the sign.
          unitPrice: { label: 'Price', headerTitle: 'Unit price', width: '1.32fr', type: 'number', editable: editable('number') },
          total: { label: 'Total', width: '1.4fr', type: 'number' }
        }
      }).map((column) => [column.id, column]));
      return [
        locked ? {
          id: 'position', label: '', headerTitle: 'Position', width: '.5fr',
          render: (_row, index) => h('span', { class: 'invoicing__position' }, String(index + 1).padStart(2, '0'))
        } : null,
        preset.item,
        preset.quantity,
        locked ? null : preset.unit,
        preset.unitPrice,
        {
          id: 'vat', label: 'VAT', width: '.78fr', align: 'end', options: VAT_RATES,
          editable: (row) => (taxable() ? editable('select')(row) : false),
          render: (row) => percent(taxable() ? row.vat : 0)
        },
        state.discounts ? {
          id: 'discount', label: 'Disc.', width: '.78fr', align: 'end', type: 'number',
          editable: editable('number'), editorProps: { min: 0, max: 100, step: 0.5, unit: '%' },
          render: (row) => (hasDiscount(row) ? percent(row.discount) : '–')
        } : null,
        preset.total
      ].filter(Boolean);
    }

    /**
     * A draft line's actions: remove it, and — while no line has one — give it a discount.
     * @param {Record<string, any>} row
     * @returns {HTMLElement}
     */
    function lineActions(row) {
      const name = row.item || 'this position';
      return h('span', { class: 'invoicing__line-actions' },
        state.discounts ? null : iconButton('percent', `Add a discount to ${name}`, () => addDiscount(row.id)),
        iconButton('trash-can', `Remove ${name}`, () => removeLine(row.id)));
    }

    /**
     * Shows the discount column for a line and opens its discount for typing.
     * @param {string} id
     * @returns {void}
     */
    function addDiscount(id) {
      setDiscountColumn(true);
      billing.startEdit(id, 'discount');
    }

    /**
     * Shows or hides the discount column. Only rows coming and going call this, never an edit, so
     * a discount set back to zero keeps its column — and its focus — until the lines change.
     * @param {boolean} visible
     * @returns {void}
     */
    function setDiscountColumn(visible) {
      if (state.discounts === visible) return;
      state.discounts = visible;
      billing.setColumns(positionColumns(state.status !== 'draft'));
    }

    /** Fits the discount column to the lines after rows were added or removed. @returns {void} */
    function syncDiscountColumn() {
      setDiscountColumn(positions().some(hasDiscount));
    }

    /** @returns {Record<string, any>[]} The billing lines in invoice order. */
    function positions() {
      return billing.getData().filter((row) => isBillingLine(row));
    }

    /**
     * Appends a catalogue product as a new position.
     * @param {(typeof PRODUCTS)[number]} product
     * @returns {void}
     */
    function addProduct(product) {
      const row = {
        id: `l${++lineCount}`, kind: 'line', sku: product.ID, item: product.name, quantity: 1,
        unit: product.unit, unitPrice: product.price, vat: product.vat, discount: 0, currency: 'EUR'
      };
      billing.addData([{ ...row, total: lineNet(row) }]);
      syncDiscountColumn();
      markDirty();
      notify(`Added “${product.name}”.`);
    }

    /** Appends an empty position and opens its description for typing. @returns {void} */
    function addBlankLine() {
      const id = `l${++lineCount}`;
      // Quantity and price start empty, so whatever is typed into them is the whole value.
      billing.addData([{
        id, kind: 'line', sku: '', item: '', quantity: null, unit: 'hour', unitPrice: null, vat: 19,
        discount: 0, currency: 'EUR', total: 0
      }]);
      syncDiscountColumn();
      markDirty();
      // After the catalogue search has closed and handed focus back, not before.
      queueMicrotask(() => billing.startEdit(id, 'item'));
    }

    /**
     * Removes a position and offers to put it back.
     * @param {string} id
     * @returns {void}
     */
    function removeLine(id) {
      const data = billing.getData();
      const index = data.findIndex((row) => row.id === id);
      if (index < 0) return;
      const [removed] = data.splice(index, 1);
      billing.removeRow(id);
      syncDiscountColumn();
      markDirty();
      notify(h('span', { class: 'toast-action' }, `Removed “${removed.item || 'blank line'}”.`,
        button({
          label: 'Undo', kind: 'ghost', size: 'sm',
          onclick: () => {
            if (state.status !== 'draft' || billing.getRow(id)) return;
            const rows = billing.getData();
            rows.splice(index, 0, removed);
            billing.setData(rows);
            syncDiscountColumn();
          }
        })), 'info');
    }

    /**
     * Switches the customer: contacts, address, and the VAT treatment follow it.
     * @param {string} id
     * @returns {void}
     */
    function changeCustomer(id) {
      state.customer = id;
      state.contact = 'main';
      contactSelect.setItems(contactsOf(customerOf(id)));
      contactSelect.set('main', { silent: true });
      renderAddress();
      billing.setData(billing.getData());
      edited();
    }

    /** Marks the draft changed and re-derives what depends on it. @returns {void} */
    function edited() {
      markDirty();
      render();
    }

    /** Flags unsaved changes on a draft. @returns {void} */
    function markDirty() {
      if (state.status !== 'draft') return;
      cancelSave();
      saveState.set('inactive', 'Unsaved changes');
    }

    /** Saves the draft (simulated round trip). @returns {void} */
    function save() {
      if (state.status !== 'draft' || state.deleted) return;
      if (billing.isEditing()) billing.commitEdit();
      saveState.set('active', 'Saving…');
      cancelSave();
      cancelSave = later(context, () => saveState.set('success', 'Draft saved'), 700);
    }

    /** Paints the status badge in the header: a tinted badge, coloured by where the invoice stands. @returns {void} */
    function renderStatus() {
      const look = { draft: ['Draft', 'neutral'], sent: ['Sent', 'info'], paid: ['Paid', 'success'] }[state.status];
      statusSlot.replaceChildren(badge({ label: look[0], kind: look[1] }));
    }

    /** Shows the selected customer's postal address and tax treatment. @returns {void} */
    function renderAddress() {
      const customer = customerOf(state.customer);
      const rule = taxRule(customer);
      // `replaceChildren` would print a null as text, so the optional country is filtered out first.
      address.replaceChildren(...[
        h('span', { class: 'invoicing__address-name' }, customer.name),
        ...customer.lines.map((line) => h('span', {}, line)),
        customer.country === ORGANISATION.country ? null : h('span', {}, customer.country),
        h('span', { class: 'invoicing__address-meta' }, `Customer no. ${customer.number}`, h('br'), `VAT ID ${customer.vatId}`)
      ].filter(Boolean));
      treatment.replaceChildren(rule.label, badge({ label: rule.region, tone: rule.tone }));
    }

    /**
     * Everything the totals, the page, and the send dialog are derived from, computed once.
     * @returns {{customer: ReturnType<typeof customerOf>, contact: ReturnType<typeof contactsOf>[number],
     *   rule: ReturnType<typeof taxRule>, lines: Record<string, any>[], totals: ReturnType<typeof summarize>,
     *   term: (typeof PAYMENT_TERMS)[number], due: Date|null}}
     */
    function derive() {
      const customer = customerOf(state.customer);
      const rule = taxRule(customer);
      const lines = positions();
      const term = PAYMENT_TERMS.find((entry) => entry.ID === state.terms) ?? PAYMENT_TERMS[1];
      return {
        customer, rule, lines, term,
        contact: contactsOf(customer).find((entry) => entry.ID === state.contact),
        totals: summarize(lines, rule),
        due: term.days === 0 ? null : addDays(state.date, term.days)
      };
    }

    /** Re-derives the totals block and the page after any change. @returns {void} */
    function render() {
      const view = derive();
      renderTotals(view);
      renderPaper(view);
    }

    /**
     * Refreshes the editor's totals block, line count, and due date.
     * @param {ReturnType<typeof derive>} view
     * @returns {void}
     */
    function renderTotals({ lines, rule, totals, due }) {
      lineCountText.textContent = `${lines.length} ${lines.length === 1 ? 'position' : 'positions'} · net prices in EUR`;
      const row = (label, value) => [h('dt', {}, label), h('dd', {}, value)];
      totalsList.replaceChildren(
        ...(totals.discount > 0 ? row('Line discounts', `− ${money(totals.discount)}`) : []),
        ...row('Net amount', money(totals.net)),
        ...(rule.taxable
          ? totals.rates.flatMap((entry) => row(`VAT ${percent(entry.rate)} on ${money(entry.base)}`, money(entry.amount)))
          : row('VAT', money(0))));
      // The amount due closes the block: under its own rule, the largest figure, and when it falls due.
      totalDue.replaceChildren(
        h('dt', {}, 'Total due'),
        h('dd', { class: 'invoicing__total' }, money(totals.total)),
        h('dd', { class: 'invoicing__due' }, due ? `Due ${formatDate(due, DATE.year)}` : 'Due on receipt'));
    }

    /**
     * Typesets the A4 page.
     * @param {ReturnType<typeof derive>} view
     * @returns {void}
     */
    function renderPaper({ customer, contact, rule, lines, totals, term, due }) {
      const discounted = lines.some(hasDiscount);
      const recipient = [
        customer.name, contact.attention, ...customer.lines,
        customer.country === ORGANISATION.country ? null : customer.country.toUpperCase()
      ].filter(Boolean);
      const facts = [
        ['Invoice no.', state.number],
        ['Invoice date', longDate(state.date)],
        ['Customer no.', customer.number],
        ['Your reference', state.reference],
        ['Service period', periodText(state.period)],
        ['Due date', due ? longDate(due) : 'On receipt'],
        rule.taxable ? null : ['Your VAT ID', customer.vatId],
        ['Your contact', me.name]
      ].filter((fact) => fact && fact[1]);

      paper.dataset.status = state.status;
      // `replaceChildren` would print a null as text, so optional parts are filtered out first.
      paper.replaceChildren(...[
        h('span', { class: 'invoicing__mark', dataset: { mark: 'fold' }, 'aria-hidden': 'true' }),
        h('span', { class: 'invoicing__mark', dataset: { mark: 'punch' }, 'aria-hidden': 'true' }),
        h('span', { class: 'invoicing__mark', dataset: { mark: 'fold-lower' }, 'aria-hidden': 'true' }),
        state.status === 'draft'
          ? h('div', { class: 'invoicing__watermark', 'aria-hidden': 'true' }, h('span', {}, 'Draft'))
          : null,
        h('header', { class: 'invoicing__letterhead' },
          h('span', { class: 'invoicing__brand-mark', 'aria-hidden': 'true' }, ORGANISATION.name[0]),
          h('span', { class: 'invoicing__brand' },
            h('span', { class: 'invoicing__brand-name' }, ORGANISATION.name),
            h('span', { class: 'invoicing__brand-line' }, 'Software and services'))),
        h('div', { class: 'invoicing__addressing' },
          h('div', { class: 'invoicing__window' },
            h('p', { class: 'invoicing__return' },
              `${ORGANISATION.legalName} · ${ORGANISATION.street} · ${ORGANISATION.city}`),
            h('p', { class: 'invoicing__recipient' },
              recipient.flatMap((line, index) => (index ? [h('br'), line] : [line])))),
          h('dl', { class: 'invoicing__facts' },
            facts.flatMap(([label, value]) => [h('dt', {}, label), h('dd', {}, value)]))),
        h('h2', { class: 'invoicing__subject' }, `Invoice ${state.number}`),
        h('p', { class: 'invoicing__text' }, contact.salutation),
        h('p', { class: 'invoicing__text' }, state.intro),
        paperLines(lines, discounted, rule.taxable),
        paperTotals(totals, rule.taxable),
        h('p', { class: 'invoicing__text' }, paymentText(totals, term, due)),
        rule.note ? h('p', { class: 'invoicing__text invoicing__legal' }, rule.note) : null,
        h('p', { class: 'invoicing__text' }, state.closing),
        h('p', { class: 'invoicing__text invoicing__signature' }, 'Kind regards', h('br'),
          h('strong', {}, me.name), h('br'), `${me.role}, ${ORGANISATION.legalName}`),
        h('footer', { class: 'invoicing__imprint' },
          h('p', {}, h('strong', {}, ORGANISATION.legalName), h('br'), ORGANISATION.street, h('br'),
            `${ORGANISATION.city}, ${ORGANISATION.country}`, h('br'), IMPRINT.email),
          h('p', {}, h('strong', {}, 'Bank details'), h('br'), `IBAN ${ORGANISATION.iban}`, h('br'),
            `BIC ${ORGANISATION.bic}`),
          h('p', {}, h('strong', {}, IMPRINT.court), h('br'), IMPRINT.register, h('br'),
            `VAT ID ${ORGANISATION.vatId}`, h('br'), `Tax no. ${IMPRINT.taxNumber}`))
      ].filter(Boolean));
    }

    /**
     * The positions table as it is printed.
     * @param {Record<string, any>[]} lines
     * @param {boolean} discounted Whether any line carries a discount (adds the column).
     * @param {boolean} taxable Whether German VAT applies.
     * @returns {HTMLTableElement}
     */
    function paperLines(lines, discounted, taxable) {
      const end = { dataset: { align: 'end' } };
      return h('table', { class: 'invoicing__lines' },
        h('thead', {}, h('tr', {},
          h('th', {}, 'Pos.'), h('th', {}, 'Description'), h('th', end, 'Quantity'),
          h('th', end, 'Unit price'), discounted ? h('th', end, 'Disc.') : null,
          h('th', end, 'VAT'), h('th', end, 'Amount'))),
        h('tbody', {}, lines.map((line, index) => h('tr', {},
          h('td', {}, String(index + 1)),
          h('td', {}, line.item || '—', line.sku ? h('span', { class: 'invoicing__sku' }, line.sku) : null),
          h('td', end, quantityText(line)),
          h('td', end, line.unitPrice == null ? '' : money(Number(line.unitPrice))),
          discounted ? h('td', end, hasDiscount(line) ? percent(line.discount) : '') : null,
          h('td', end, percent(taxable ? line.vat : 0)),
          h('td', end, money(lineNet(line)))))));
    }

    /**
     * The totals block as it is printed: net, VAT per rate, amount due.
     * @param {ReturnType<typeof summarize>} totals
     * @param {boolean} taxable
     * @returns {HTMLTableElement}
     */
    function paperTotals(totals, taxable) {
      const row = (label, value, total = false) => h('tr', total ? { dataset: { total: '' } } : {},
        h('th', { scope: 'row' }, label), h('td', {}, value));
      return h('table', { class: 'invoicing__sum' }, h('tbody', {},
        row('Net amount', money(totals.net)),
        taxable
          ? totals.rates.map((entry) => row(`VAT ${percent(entry.rate)} on ${money(entry.base)}`, money(entry.amount)))
          : row(`VAT ${percent(0)}`, money(0)),
        row('Total amount', money(totals.total), true)));
    }

    /**
     * The payment instruction under the totals, with the early-payment discount where agreed.
     * @param {ReturnType<typeof summarize>} totals
     * @param {(typeof PAYMENT_TERMS)[number]} term
     * @param {Date|null} due
     * @returns {string}
     */
    function paymentText(totals, term, due) {
      const quoting = `quoting ${state.number}`;
      if (!due) {
        return `Payable on receipt without deduction. Please transfer ${money(totals.total)} to the account below, ${quoting}.`;
      }
      let text = `Please transfer ${money(totals.total)} by ${longDate(due)} to the account below, ${quoting}.`;
      if (term.cash) {
        const discount = cents(totals.total * term.cash.rate / 100);
        text += ` If paid by ${longDate(addDays(state.date, term.cash.days))}, you may deduct ${percent(term.cash.rate)} (${money(discount)}) and transfer ${money(cents(totals.total - discount))}.`;
      }
      return text;
    }

    /**
     * Shows or hides the page. Side by side it opens beside the editor; where only one fits, it
     * takes the editor's place, and showing the editor again puts it back.
     * @param {boolean} open
     * @returns {void}
     */
    function setPreview(open) {
      if (state.deleted) return;
      const leaving = open ? editor : preview;
      const active = document.activeElement;
      // Focus inside the view that is about to give way goes to the one that takes its place.
      const stranded = state.switching && active instanceof HTMLElement && leaving.contains(active);
      if (stranded && open) editorFocus = active;
      syncPreview(open);
      applyView();
      if (!stranded) return;
      if (open) viewport.focus({ preventScroll: true });
      else (editorFocus?.isConnected ? editorFocus : previewButton).focus({ preventScroll: true });
    }

    /**
     * Records whether the page is showing and says so on the Preview button.
     * @param {boolean} open
     * @returns {void}
     */
    function syncPreview(open) {
      state.page = open;
      previewButton.setAttribute('aria-pressed', String(open));
    }

    /** Puts the split in the state `state.page` and `state.switching` describe. @returns {void} */
    function applyView() {
      if (state.switching) {
        main.dataset.view = 'switch';
        split.collapse(state.page ? 'start' : 'end');
      } else {
        delete main.dataset.view;
        if (state.page) split.expand();
        else split.collapse('end');
      }
      if (state.page) layoutSheet();
    }

    /**
     * Follows the invoice pane's width: below `SIDE_BY_SIDE` the editor and the page take turns,
     * starting with the editor, and on a phone the More menu takes over Save draft.
     * @returns {void}
     */
    function fitView() {
      const width = main.clientWidth;
      const switching = width > 0 && width < SIDE_BY_SIDE;
      const phone = width > 0 && width <= SHELL_BREAKPOINTS.single;
      if (phone !== state.phone) {
        state.phone = phone;
        more.setItems(menuItems());
      }
      if (switching === state.switching) return;
      state.switching = switching;
      if (switching && state.page) {
        if (preview.contains(document.activeElement)) previewButton.focus({ preventScroll: true });
        syncPreview(false);
      }
      applyView();
    }

    /** @returns {number} The page scale for the current zoom choice. */
    function scale() {
      if (state.zoom !== 'fit') return state.zoom;
      const style = getComputedStyle(viewport);
      const room = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return Math.min(1.5, Math.max(0.3, room / (paper.offsetWidth || 1)));
    }

    /** Sizes the scaled page so the viewport scrolls exactly as far as the page reaches. @returns {void} */
    function layoutSheet() {
      if (!viewport.clientWidth) return;
      const factor = scale();
      sheet.style.setProperty('--invoicing-zoom', String(factor));
      sheet.style.setProperty('--invoicing-page-height', `${paper.offsetHeight}px`);
      // Fold and punch marks are millimetre details; below 60% they only add noise.
      sheet.dataset.marks = factor < 0.6 ? 'hidden' : 'shown';
      zoomMenu.setLabel(formatPercent(factor));
    }

    /**
     * Moves the zoom one step in or out from the current scale.
     * @param {-1|1} direction
     * @returns {void}
     */
    function stepZoom(direction) {
      const steps = [0.5, 0.75, 1, 1.25, 1.5];
      const current = scale();
      const next = direction > 0
        ? steps.find((step) => step > current + 0.001) ?? steps.at(-1)
        : [...steps].reverse().find((step) => step < current - 0.001) ?? steps[0];
      setZoom(next);
    }

    /**
     * @param {'fit'|number} zoom
     * @returns {void}
     */
    function setZoom(zoom) {
      state.zoom = zoom;
      renderZoomMenu();
      layoutSheet();
    }

    /** Lists the zoom choices, checking the active one. @returns {void} */
    function renderZoomMenu() {
      zoomMenu.setItems([
        { label: 'Fit width', value: 'fit', role: 'menuitemradio', checked: state.zoom === 'fit', onselect: () => setZoom('fit') },
        '-',
        ...[0.5, 0.75, 1, 1.25, 1.5].map((step) => ({
          label: formatPercent(step), value: String(step), role: 'menuitemradio',
          checked: state.zoom === step, onselect: () => setZoom(step)
        }))
      ]);
    }

    /** Opens the send dialog after checking the draft is complete. @returns {void} */
    function openFinalize() {
      if (state.status !== 'draft' || state.deleted) return;
      if (billing.isEditing()) billing.commitEdit();
      const { customer, contact, lines, totals, due } = derive();
      if (lines.length === 0 || lines.some((line) => !String(line.item ?? '').trim() || line.quantity == null)) {
        notify('Every position needs a description and a quantity before the invoice can be sent.', 'warning');
        return;
      }

      sendScope.reset();
      const own = sendScope.own;
      const recipients = new TagPicker(null, {
        items: contactsOf(customer).map((entry) => ({ ID: entry.email, name: `${entry.name} <${entry.email}>` })),
        values: [contact.email],
        allowCreate: true,
        placeholder: 'Add a recipient'
      });
      const to = own(controlField('To', recipients));
      const subject = own(new Field(null, {
        type: 'text', label: 'Subject', value: `Invoice ${state.number} from ${ORGANISATION.legalName}`
      }));
      const message = own(new Field(null, {
        type: 'textarea', label: 'Message', props: { rows: 8 },
        value: `${contact.salutation}\n\nplease find attached invoice ${state.number} for ${money(totals.total)}, `
          + `${due ? `due on ${longDate(due)}` : 'due on receipt'}.\n\n`
          + `Kind regards\n${me.name}\n${ORGANISATION.legalName}`
      }));
      const attachment = own(new FileItem(null, {
        name: `${state.number}.pdf`, size: 48_312, mime: 'application/pdf',
        subtitle: 'Invoice · 1 page'
      }));
      const copy = own(new Toggle(null, { label: `Send a copy to ${me.email}`, checked: true }));

      const dialog = own(new Dialog(null, {
        title: `Finalize and send ${state.number}`,
        size: 'md',
        content: h('div', { class: 'form-sheet' }, stack({ gap: 4 },
          stack({ direction: 'row', align: 'start', gap: 2 }, icon('lock'),
            h('span', { class: 'meta' }, 'Finalizing books the invoice under its number. Afterwards it '
              + 'can only be corrected with a credit note.')),
          to.toElement(), subject.toElement(), message.toElement(),
          stack({ gap: 1 }, h('span', { class: 'meta' }, 'Attachment'), attachment.toElement()),
          copy.toElement())),
        buttons: [
          { label: 'Cancel', action: 'cancel' },
          {
            label: 'Finalize & send', kind: 'primary',
            action: () => {
              const values = recipients.getValues().map(String);
              if (values.length === 0) {
                to.setHighlight('Add at least one recipient.');
                return;
              }
              state.recipients = values;
              dialog.close();
              finalize();
            }
          }
        ]
      }));
      dialog.once('close', () => sendScope.reset());
      dialog.open();
    }

    /** Books the invoice: Draft → Sent, and every editing control locks. @returns {void} */
    function finalize() {
      state.status = 'sent';
      cancelSave();
      for (const field of Object.values(fields)) field.setDisabled(true);
      customerSelect.disable();
      adder.disable();
      addLineButton.disabled = true;
      adderArea.hidden = true;
      const data = billing.getData();
      state.discounts = data.some(hasDiscount);
      gridScope.reset();
      billing = gridScope.own(createGrid(data, true));
      gridHost.replaceChildren(billing.toElement());
      saveButton.hidden = true;
      finalizeButton.hidden = true;
      paymentButton.hidden = false;
      saveState.set('success', `Sent ${formatDate(state.date, DATE.short)}`);
      more.setItems(menuItems());
      lockedNote.hidden = false;
      lockedNote.replaceChildren(icon('lock'),
        h('span', {}, `Sent to ${state.recipients.join(', ')} on ${longDate(state.date)}. `
          + 'A booked invoice cannot be changed; correct it with a credit note.'),
        button({
          label: 'Create credit note', size: 'sm',
          onclick: () => notify(`Credit note draft GS-2026-0018 created for ${state.number}.`, 'info')
        }));
      renderStatus();
      render();
      notify(`${state.number} sent to ${state.recipients.join(', ')}.`);
    }

    /** Marks the sent invoice as paid in full. @returns {void} */
    function recordPayment() {
      if (state.status !== 'sent') return;
      state.status = 'paid';
      paymentButton.hidden = true;
      saveState.set('success', 'Paid in full');
      renderStatus();
      notify(`Payment of ${money(derive().totals.total)} recorded.`);
    }

    /** Asks before moving the draft to the bin. @returns {Promise<void>} */
    async function confirmDelete() {
      if (state.status !== 'draft') return;
      const confirmed = await Dialog.confirm({
        title: `Delete draft ${state.number}?`,
        message: 'The draft and its positions move to the bin for 30 days.',
        okLabel: 'Delete draft',
        danger: true
      });
      if (!confirmed || context.signal.aborted) return;
      setDeleted(true);
      notify(`Draft ${state.number} moved to the bin.`, 'info');
    }

    /**
     * Swaps the editor for the "in the bin" state and back.
     * @param {boolean} deleted
     * @returns {void}
     */
    function setDeleted(deleted) {
      state.deleted = deleted;
      main.dataset.state = deleted ? 'deleted' : 'editing';
      for (const control of [saveButton, previewButton, finalizeButton, more.el]) control.disabled = deleted;
      saveState.set('inactive', deleted ? 'In the bin' : 'All changes saved');
      if (!deleted) layoutSheet();
    }
  }
};
