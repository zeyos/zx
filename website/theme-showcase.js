/*
 * The Theme studio's canvas: one dense card per family, covering a representative cross-section.
 *
 * The point of putting them on one page is comparison. A component looks fine on its own page
 * under any theme; what a theme has to survive is a table beside a form beside a toolbar, where
 * one accent that is a shade too loud, or a radius that suits buttons but not panels, shows up
 * immediately. So the cards are deliberately dense and deliberately adjacent.
 *
 * Each card is a plain factory returning an element. `mountShowcase` collects the teardown for
 * the few that own something outside their own subtree — toasts, overlays — and returns it, so
 * the canvas can be rebuilt from scratch whenever a token that components read at build time
 * changes.
 */

import {
  Breadcrumb, Card, Checklist, Component, ContextMenu, CopyInput, DataFilter, DateRangeBox, Datebox, DatePicker,
  Dialog, Dropdown, Finder, Form, Groupbox, InlineLoading, MasterPanel, MenuButton, Message,
  Modal, MultiValueEditor, NavigationBar, NumberField, Pagination, Panel, ProgressBar,
  Rating, Search, Select, Slider, Stepper, Table, Tabbox, TagPicker, Timebox, Toggle, Toolbar,
  TreeView, ValueList, badge, button, buttonGroup, CheckButton, emptyState, h, icon, iconNames,
  skeletonText, spinner, tooltip
} from '../src/index.js';

/** Semantic colours the palette card shows, in the order the theming guide lists them. */
const PALETTE = [
  ['Accent', '--zx-color-accent'],
  ['Accent hover', '--zx-color-accent-hover'],
  ['Accent subtle', '--zx-color-accent-subtle'],
  ['Selected', '--zx-color-bg-selected'],
  ['Surface', '--zx-color-bg-surface'],
  ['Raised', '--zx-color-bg-raised'],
  ['Muted', '--zx-color-bg-muted'],
  ['Border', '--zx-color-border'],
  ['Text', '--zx-color-text'],
  ['Muted text', '--zx-color-text-muted'],
  ['Success', '--zx-color-success'],
  ['Warning', '--zx-color-warning'],
  ['Danger', '--zx-color-danger'],
  ['Info', '--zx-color-info']
];

const BADGE_KINDS = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'];

const PEOPLE = [
  { ID: 1, name: 'Nadine Roth' },
  { ID: 2, name: 'Tobias Kern' },
  { ID: 3, name: 'Camille Fournier' },
  { ID: 4, name: 'Owen Blythe' }
];

const INVOICES = [
  { ID: 1, number: 'INV-26041', customer: 'Alpine Works GmbH', state: 'Paid', amount: 12_400 },
  { ID: 2, number: 'INV-26042', customer: 'Danube Systems AG', state: 'Open', amount: 4_950 },
  { ID: 3, number: 'INV-26043', customer: 'Kestrel Analytics', state: 'Overdue', amount: 18_200 },
  { ID: 4, number: 'INV-26044', customer: 'Atelier West', state: 'Draft', amount: 2_180 }
];

const STATE_KIND = { Paid: 'success', Open: 'info', Overdue: 'danger', Draft: 'neutral' };

const TREE = [
  {
    ID: 'accounts',
    name: 'Accounts',
    children: [
      { ID: 'alpine', name: 'Alpine Works GmbH' },
      { ID: 'danube', name: 'Danube Systems AG' }
    ]
  },
  { ID: 'products', name: 'Products', children: [{ ID: 'seats', name: 'Seat licences' }] }
];

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0
});

/**
 * Every card on the canvas, in reading order. Column-major flow puts roughly the first third in
 * the left column, so the loudest families come first.
 * @type {{id: string, title: string, hint: string, render: (teardown: (fn: () => void) => void) => Node}[]}
 */
export const CARDS = [
  { id: 'palette', title: 'Semantic palette', hint: 'What every component resolves its colour through', render: paletteCard },
  { id: 'type', title: 'Type scale', hint: '--zx-font-sans and the text steps', render: typeCard },
  { id: 'buttons', title: 'Buttons', hint: 'Four kinds, two sizes, joined groups', render: buttonsCard },
  { id: 'badges', title: 'Badges', hint: 'Six intents in three weights', render: badgesCard },
  { id: 'inputs', title: 'Text input', hint: 'Search, copy, numbers, native controls', render: inputsCard },
  { id: 'selection', title: 'Selection', hint: 'Select, tags, checklist, permission', render: selectionCard },
  { id: 'ranges', title: 'Ranges and progress', hint: 'Slider, rating, progress, loading', render: rangesCard },
  { id: 'dates', title: 'Dates and time', hint: 'Boxes, ranges, durations', render: datesCard },
  { id: 'calendar', title: 'Calendar', hint: 'The inline picker — the densest accent surface', render: calendarCard },
  { id: 'form', title: 'Form', hint: 'A fieldset of typed fields with actions', render: formCard },
  { id: 'table', title: 'Table', hint: 'Sorting, zebra rows, selection, pagination', render: tableCard },
  { id: 'filter', title: 'Data filter', hint: 'The filter bar above a table', render: filterCard },
  { id: 'tabs', title: 'Tabs', hint: 'All four Tabbox variants', render: tabsCard },
  { id: 'navigation', title: 'Navigation', hint: 'App bar, breadcrumb, steps, toolbar', render: navigationCard },
  { id: 'containers', title: 'Containers', hint: 'Card, panel, groupbox, master panel', render: containersCard },
  { id: 'overlays', title: 'Overlays', hint: 'Modal, dialog, menus, tooltips, toasts', render: overlaysCard },
  { id: 'hierarchy', title: 'Hierarchy', hint: 'Tree and finder', render: hierarchyCard },
  { id: 'lists', title: 'Value editors', hint: 'Chips and multi-value rows', render: listsCard },
  { id: 'states', title: 'Empty and loading', hint: 'What a screen shows before it has data', render: statesCard },
  { id: 'icons', title: 'Icons', hint: 'The bundled set, at control size', render: iconsCard }
];

/**
 * Builds the whole canvas.
 * @param {HTMLElement} container Element to fill.
 * @returns {() => void} Teardown for everything the cards created outside their own subtree.
 */
export function mountShowcase(container) {
  /** @type {(() => void)[]} */
  const teardowns = [];
  const collect = (fn) => teardowns.push(fn);
  /** @type {Set<Component>} */
  const components = new Set();
  const collectComponents = (node) => {
    const elements = node instanceof Element
      ? [node, ...node.querySelectorAll('*')]
      : node instanceof DocumentFragment ? [...node.querySelectorAll('*')] : [];
    for (const element of elements) {
      const component = Component.from(element);
      if (component) components.add(component);
    }
  };

  container.replaceChildren(...CARDS.map((card) => h('section', { class: 'studio-card', id: `card-${card.id}` },
    h('header', { class: 'studio-card__head' },
      h('h2', { class: 'studio-card__title' }, card.title),
      h('p', { class: 'studio-card__hint' }, card.hint)),
    h('div', { class: 'studio-card__body' }, body(card, collect, collectComponents)))));

  return () => {
    for (const component of [...components].reverse()) {
      try { component.destroy(); } catch { /* one component must not block the rebuild */ }
    }
    for (const teardown of [...teardowns].reverse()) {
      try { teardown(); } catch { /* a failed teardown must not block the rebuild */ }
    }
  };
}

/**
 * Renders one card, reporting a failure in place rather than taking the page with it.
 *
 * The canvas is twenty cards deep and its whole value is comparison; a single component throwing
 * during construction should cost that card, not the other nineteen.
 * @param {{title: string, render: (teardown: (fn: () => void) => void) => Node}} card
 * @param {(fn: () => void) => void} collect
 * @param {(node: Node) => void} collectComponents
 * @returns {Node}
 */
function body(card, collect, collectComponents) {
  try {
    const rendered = card.render(collect);
    collectComponents(rendered);
    return rendered;
  } catch (error) {
    console.error(`Theme studio: the ${card.title} card failed to render.`, error);
    return h('p', { class: 'studio-prose' }, `This card failed to render: ${error.message}`);
  }
}

/* ---------------------------------------------------------------------- cards -- */

/** @returns {Node} */
function paletteCard() {
  return h('div', { class: 'studio-swatches' }, PALETTE.map(([label, token]) =>
    h('div', { class: 'studio-swatch' },
      h('span', { class: 'studio-swatch__chip', style: { background: `var(${token})` } }),
      h('span', { class: 'studio-swatch__label' }, label))));
}

/** @returns {Node} */
function typeCard() {
  return h('div', { class: 'studio-type' },
    h('p', { class: 'studio-type__display' }, 'Invoices'),
    h('p', { class: 'studio-type__lead' },
      'A theme is a ramp and a handful of measurements, not a stylesheet per component.'),
    h('p', { class: 'studio-type__body' },
      'Body copy at --zx-text-md, the size every control inherits. Numerals matter in business '
      + 'software: 1 234,56 · 0 987 · 2026-08-21.'),
    h('p', { class: 'studio-type__muted' }, 'Secondary text at --zx-color-text-muted.'));
}

/** @returns {Node} */
function buttonsCard() {
  return h('div', { class: 'studio-stack' },
    row(
      button({ label: 'Default' }),
      button({ label: 'Primary', kind: 'primary', icon: 'plus' }),
      button({ label: 'Danger', kind: 'danger' }),
      button({ label: 'Ghost', kind: 'ghost' })),
    row(
      button({ label: 'Small', size: 'sm', icon: 'filter' }),
      button({ icon: 'reload', title: 'Reload' }),
      button({ label: 'Disabled', disabled: true }),
      buttonGroup([
        button({ label: 'List', size: 'sm' }),
        button({ label: 'Grid', size: 'sm', kind: 'primary' }),
        button({ label: 'Map', size: 'sm' })
      ])),
    row(
      new CheckButton(null, { label: ['Watching', 'Watch'], value: true }).toElement(),
      new Toggle(null, { label: 'Send receipts', value: true }).toElement(),
      new MenuButton(null, {
        label: 'Actions',
        items: [{ label: 'Duplicate', value: 'copy' }, { label: 'Archive', value: 'archive' }]
      }).toElement()));
}

/** @returns {Node} */
function badgesCard() {
  return h('div', { class: 'studio-stack' },
    ...['soft', 'solid', 'outline'].map((variant) => row(
      h('span', { class: 'studio-caption' }, variant),
      ...BADGE_KINDS.map((kind) => badge({ label: kind, kind, variant })))),
    row(
      badge({ label: 'Live', kind: 'success', dot: true }),
      badge({ label: 'Approved', icon: 'check', kind: 'accent' }),
      badge({ label: '3 issues', icon: 'warning', kind: 'warning', variant: 'solid' }),
      badge({ label: 'Locked', icon: 'lock', variant: 'outline', size: 'sm' })));
}

/** @returns {Node} */
function inputsCard() {
  return h('div', { class: 'studio-stack' },
    new Search(null, { placeholder: 'Search invoices…' }).toElement(),
    new CopyInput(null, { label: 'API endpoint', value: 'https://api.zeyos.com/v1' }).toElement(),
    row(
      field('Quantity', new NumberField(null, { value: 12, min: 0, max: 99 }).toElement()),
      field('Unit price', new NumberField(null, { value: 249.5, step: 0.5, min: 0 }).toElement())),
    field('Reference', h('input', { type: 'text', value: 'INV-26041', placeholder: 'Reference' })),
    field('Note', h('textarea', { rows: 2 }, 'A bare textarea inside .zx-scope, styled by base.css.')));
}

/** @returns {Node} */
function selectionCard() {
  return h('div', { class: 'studio-stack' },
    field('Owner', new Select(null, { items: PEOPLE, value: 2, filter: 'local' }).toElement()),
    field('Recipients', new TagPicker(null, { items: PEOPLE, values: [1, 3] }).toElement()),
    field('Visibility', Select.permission(null, { groups: PEOPLE }).toElement()),
    field('Columns', new Checklist(null, {
      items: [{ ID: 'number', name: 'Number', on: true }, { ID: 'customer', name: 'Customer' },
        { ID: 'amount', name: 'Amount', on: true }],
      search: false
    }).toElement()));
}

/** @returns {Node} */
function rangesCard() {
  const progress = new ProgressBar(null, { label: 'Export', value: 62 });
  return h('div', { class: 'studio-stack' },
    new Slider(null, { label: 'Discount', value: 15, min: 0, max: 50, unit: '%' }).toElement(),
    field('Priority', new Rating(null, { value: 4 }).toElement()),
    progress.toElement(),
    row(
      new InlineLoading(null, { status: 'active', description: 'Posting…' }).toElement(),
      spinner({ label: 'Loading' })));
}

/** @returns {Node} */
function datesCard() {
  const today = new Date();
  const later = new Date(today.getTime() + 6 * 86_400_000);
  return h('div', { class: 'studio-stack' },
    field('Invoice date', new Datebox(null, { value: today }).toElement()),
    field('Service period', new DateRangeBox(null, { start: today, end: later }).toElement()),
    field('Time booked', new Timebox(null, { value: 135 }).toElement()));
}

/** @returns {Node} */
function calendarCard() {
  return new DatePicker(null, { value: new Date() }).toElement();
}

/** @returns {Node} */
function formCard() {
  return new Form(null, {
    fieldsets: [{
      title: 'Customer',
      columns: 2,
      fields: {
        company: { type: 'text', label: 'Company', value: 'Alpine Works GmbH', required: true },
        vat: { type: 'text', label: 'VAT ID', value: 'ATU12345678' },
        country: {
          type: 'select', label: 'Country', value: 'AT',
          options: { AT: 'Austria', DE: 'Germany', CH: 'Switzerland' }
        },
        terms: {
          type: 'optionlist', label: 'Payment terms', value: '14',
          options: { 7: '7 days', 14: '14 days', 30: '30 days' }
        },
        reminders: { type: 'checkbox', label: 'Send payment reminders', value: true },
        notes: { type: 'textarea', label: 'Notes', props: { rows: 2 } }
      }
    }],
    actions: [
      { label: 'Cancel', type: 'reset' },
      { label: 'Save customer', type: 'submit', kind: 'primary' }
    ]
  }).toElement();
}

/** @returns {Node} */
function tableCard() {
  const table = new Table(null, {
    columns: [
      { id: 'number', label: 'Number', sortable: true, width: '1.2fr' },
      { id: 'customer', label: 'Customer', sortable: true, width: '2fr' },
      {
        id: 'state',
        label: 'State',
        width: '1fr',
        render: (row) => badge({ label: row.state, kind: STATE_KIND[row.state], size: 'sm' })
      },
      {
        id: 'amount',
        label: 'Amount',
        sortable: true,
        align: 'right',
        width: '1fr',
        render: (row) => currency.format(row.amount)
      }
    ],
    data: INVOICES,
    rowId: 'ID',
    sortMode: 'local',
    sort: { id: 'amount', dir: 'desc' },
    selectable: 'multi',
    zebra: true
  });
  table.setSelection([1]);
  const pagination = new Pagination(null, { total: 128, page: 2, pageSize: 25 });
  return h('div', { class: 'studio-stack' }, table.toElement(), pagination.toElement());
}

/** @returns {Node} */
function filterCard() {
  return new DataFilter(null, {
    filters: [
      { type: 'text', id: 'query', label: 'Search', fields: ['customer'] },
      {
        type: 'select',
        id: 'state',
        label: 'State',
        field: 'state',
        options: [{ value: 'Paid', label: 'Paid' }, { value: 'Open', label: 'Open' },
          { value: 'Overdue', label: 'Overdue' }, { value: 'Draft', label: 'Draft' }],
        emptyLabel: 'Any state'
      },
      // No `options`: the distinct values in the data become the list.
      { type: 'select', id: 'customer', label: 'Customer', field: 'customer', emptyLabel: 'Anyone' }
    ],
    data: INVOICES
  }).toElement();
}

/** @returns {Node} */
function tabsCard() {
  const tabs = ['divided', 'bracket', 'line', 'segmented'].map((variant) => h('div', { class: 'studio-stack' },
    h('code', { class: 'studio-caption' }, `variant: '${variant}'`),
    new Tabbox(null, {
      variant,
      tabs: [
        { name: 'overview', title: 'Overview', icon: 'list', content: tabBody('Overview') },
        { name: 'lines', title: 'Lines', content: tabBody('Lines') },
        { name: 'history', title: 'History', content: tabBody('History') }
      ]
    }).toElement()));
  return h('div', { class: 'studio-stack studio-stack--wide' }, ...tabs);
}

/** @returns {Node} */
function navigationCard() {
  return h('div', { class: 'studio-stack' },
    new NavigationBar(null, {
      title: 'Billing',
      items: [
        { name: 'invoices', title: 'Invoices' },
        { name: 'credits', title: 'Credit notes', badge: '3' },
        { name: 'dunning', title: 'Dunning' }
      ],
      active: 'invoices'
    }).toElement(),
    new Breadcrumb(null, {
      items: [
        { name: 'home', label: 'Billing' },
        { name: 'invoices', label: 'Invoices' },
        { name: 'record', label: 'INV-26041' }
      ]
    }).toElement(),
    new Stepper(null, {
      steps: [
        { name: 'draft', title: 'Draft' },
        { name: 'review', title: 'Review' },
        { name: 'post', title: 'Post' }
      ],
      active: 'review'
    }).toElement(),
    new Toolbar(null, {
      items: [
        { name: 'new', label: 'New', icon: 'plus', kind: 'primary' },
        { name: 'edit', label: 'Edit', icon: 'file' },
        '-',
        { name: 'filter', label: 'Filter', icon: 'filter', active: true },
        { name: 'delete', label: 'Delete', icon: 'trash', kind: 'danger' }
      ]
    }).toElement());
}

/** @returns {Node} */
function containersCard() {
  return h('div', { class: 'studio-stack' },
    new Card(null, {
      title: 'Alpine Works GmbH',
      link: '#card-containers',
      content: 'Account · 3 open opportunities',
      footer: 'Last contact yesterday',
      actions: [{ icon: 'dots', title: 'Account actions', kind: 'ghost', size: 'sm' }]
    }).toElement(),
    new Panel(null, {
      title: 'Delivery address',
      content: h('p', { class: 'studio-prose' }, 'A raised surface with a header and an optional footer.'),
      buttons: [{ icon: 'reload', size: 'sm', kind: 'ghost', title: 'Refresh' }],
      footer: h('small', {}, 'Last edited 14:02')
    }).toElement(),
    new Groupbox(null, {
      title: 'Advanced options',
      content: h('p', { class: 'studio-prose' }, 'A flat collapsible section for secondary settings.')
    }).toElement(),
    h('div', { class: 'studio-frame' },
      new MasterPanel(null, {
        title: 'INV-26041',
        module: 'billing',
        content: h('p', { class: 'studio-prose' },
          'The module accent colours the header — a second, orthogonal colour axis that a theme '
          + 'preset leaves alone.'),
        buttons: [{ label: 'Post', kind: 'primary', size: 'sm' }]
      }).toElement()));
}

/**
 * @param {(fn: () => void) => void} teardown
 * @returns {Node}
 */
function overlaysCard(teardown) {
  const modal = new Modal(null, { width: 420 });
  modal.setContent(h('div', { class: 'studio-stack' },
    h('strong', {}, 'Post invoice'),
    h('p', { class: 'studio-prose' },
      'Posting locks the document and assigns the next number in the range.'),
    row(button({ label: 'Cancel', onclick: () => modal.close('cancel') }),
      button({ label: 'Post', kind: 'primary', onclick: () => modal.close('post') }))));

  const dialog = new Dialog(null, {
    title: 'Record payment',
    size: 'sm',
    content: h('p', { class: 'studio-prose' },
      'A dialog brings its own header, footer, and button row; a modal is the bare surface.'),
    buttons: [{ label: 'Close', kind: 'primary', action: 'close', autofocus: true }]
  });

  const anchor = button({ label: 'Assign to', icon: 'chevron-down' });
  const dropdown = new Dropdown(anchor, {
    matchWidth: true,
    content: h('div', { class: 'studio-menu' },
      PEOPLE.map((person) => button({ label: person.name, kind: 'ghost', size: 'sm' })))
  });

  const toasts = new Set();
  const contextTarget = h('div', { class: 'studio-contextzone' }, 'Right-click anywhere in this area');
  const menu = new ContextMenu(contextTarget, {
    items: [{ label: 'Open', icon: 'eye', value: 'open' }, { label: 'Duplicate', icon: 'copy', value: 'copy' },
      '-', { label: 'Delete', icon: 'trash', value: 'delete', danger: true }]
  });
  const hinted = button({ label: 'Hover me' });
  const hint = tooltip(hinted, 'Tooltips inherit the raised surface and the overlay shadow.');

  teardown(() => {
    for (const handle of toasts) handle.close();
    hint.destroy();
    modal.destroy();
    dialog.destroy();
    menu.destroy();
    dropdown.destroy();
  });

  const toast = (kind) => toasts.add(Message[kind](`A ${kind} toast, themed like everything else.`));

  return h('div', { class: 'studio-stack' },
    row(
      button({ label: 'Modal', onclick: () => modal.open() }),
      button({ label: 'Dialog', onclick: () => dialog.open() }),
      hinted),
    row(anchor),
    row(
      button({ label: 'Info', size: 'sm', onclick: () => toast('info') }),
      button({ label: 'Success', size: 'sm', onclick: () => toast('success') }),
      button({ label: 'Warning', size: 'sm', onclick: () => toast('warning') }),
      button({ label: 'Error', size: 'sm', kind: 'danger', onclick: () => toast('error') })),
    contextTarget);
}

/** @returns {Node} */
function hierarchyCard() {
  const tree = new TreeView(null, { items: TREE, expanded: ['accounts'], selected: ['alpine'] });
  return h('div', { class: 'studio-stack' },
    h('div', { class: 'studio-frame studio-frame--short' }, tree.toElement()),
    h('div', { class: 'studio-frame studio-frame--short' },
      new Finder(null, { items: TREE }).toElement()));
}

/** @returns {Node} */
function listsCard() {
  return h('div', { class: 'studio-stack' },
    field('Tags', new ValueList(null, { values: ['recurring', 'net-14'], placeholder: 'Add a tag…' }).toElement()),
    field('Contact e-mail', new MultiValueEditor(null, {
      values: ['billing@alpineworks.example', 'ap@alpineworks.example']
    }).toElement()));
}

/** @returns {Node} */
function statesCard() {
  return h('div', { class: 'studio-stack' },
    emptyState({
      icon: 'file',
      title: 'No credit notes yet',
      description: 'Credit notes raised against this invoice will appear here.',
      actions: [{ label: 'New credit note', kind: 'primary', icon: 'plus' }],
      size: 'sm'
    }),
    h('div', { class: 'studio-frame studio-frame--short' }, skeletonText({ lines: 3 })));
}

/** @returns {Node} */
function iconsCard() {
  return h('div', { class: 'studio-icons' },
    iconNames().map((name) => h('span', { class: 'studio-icons__cell', title: name }, icon(name))));
}

/* -------------------------------------------------------------------- helpers -- */

/** @param {...(Node|string)} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { class: 'studio-row' }, ...children);
}

/** @param {string} label @param {Node} control @returns {HTMLElement} */
function field(label, control) {
  return h('label', { class: 'studio-field' },
    h('span', { class: 'studio-field__label' }, label), control);
}

/** @param {string} name @returns {HTMLElement} */
function tabBody(name) {
  return h('p', { class: 'studio-prose' }, `${name} panel.`);
}
