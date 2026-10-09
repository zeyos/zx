import {
  AccountMenu, ActivityList, AppSidebar, Avatar, Breadcrumb, CheckButton, Dialog, FileList, Form,
  InlineLoading, MenuButton, Sheet, Tabbox, Table, TagPicker, badge, button, emptyState, formatCurrency,
  formatDate, formatNumber, formatPercent, formatRelativeTime, h, icon, stack, statTile, uid
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, dot, iconButton, later, layoutContext, modShortcut, paneHeader, propList,
  renderScope, sectionLabel, shortcuts, toaster, unavailable, unavailablePane, workspaceHeader
} from './kit.js';
import { ME, NOW, person } from './fixtures.js';

/** The application's destinations: three groups, always open, each its own navigation list. */
const NAVIGATION = [
  {
    label: 'Stock', items: [
      { id: 'items', label: 'Items', icon: 'box' },
      { id: 'stock-entries', label: 'Stock entries', icon: 'dolly' },
      { id: 'warehouses', label: 'Warehouses', icon: 'warehouse' },
      { id: 'purchase-receipts', label: 'Purchase receipts', icon: 'receipt' },
      { id: 'delivery-notes', label: 'Delivery notes', icon: 'truck' },
      { id: 'stock-ledger', label: 'Stock ledger', icon: 'book-open' }
    ]
  },
  {
    label: 'Reports', items: [
      { id: 'stock-balance', label: 'Stock balance', icon: 'scale-balanced' },
      { id: 'projected-quantity', label: 'Projected quantity', icon: 'chart-line' }
    ]
  },
  {
    label: 'Masters', items: [
      { id: 'item-groups', label: 'Item groups', icon: 'tags' },
      { id: 'suppliers', label: 'Suppliers', icon: 'building' },
      { id: 'units', label: 'Units', icon: 'hashtag' }
    ]
  }
];

/** The staff an item can be assigned to. */
const TEAM = ['lea', 'tobias', 'nadine', 'owen', 'piet', 'ruth'];

/** Stock locations, in the order every per-warehouse table lists them. */
const WAREHOUSES = [
  { ID: 'BER', name: 'Berlin central' },
  { ID: 'HAM', name: 'Hamburg port' },
  { ID: 'MUC', name: 'Munich south' },
  { ID: 'RMA', name: 'Returns & repair' }
];

/** Choices offered by the record's select fields. */
const ITEM_GROUPS = [
  { ID: 'scanners', name: 'Scanners' }, { ID: 'printers', name: 'Printers' },
  { ID: 'accessories', name: 'Accessories' }, { ID: 'consumables', name: 'Consumables' }
];
const UNITS = [{ ID: 'pcs', name: 'Pieces (pcs)' }, { ID: 'box', name: 'Box of 10' }, { ID: 'set', name: 'Set' }];
const VALUATION_METHODS = [{ ID: 'moving', name: 'Moving average' }, { ID: 'fifo', name: 'FIFO' }];
const SUPPLIERS = [
  { ID: 'alpine', name: 'Alpine Works GmbH' },
  { ID: 'voss', name: 'Voss Elektronik KG' },
  { ID: 'tidewater', name: 'Tidewater Devices B.V.' }
];
const TAGS = [
  { ID: 'rugged', name: 'Rugged' }, { ID: 'bestseller', name: 'Bestseller' },
  { ID: 'serialised', name: 'Serialised' }, { ID: 'rental', name: 'Rental pool' },
  { ID: 'eol', name: 'End of life' }
];

/** Document types linked to an item, grouped the way the Connections block shows them. */
const CONNECTIONS = [
  { title: 'Buying', types: [{ ID: 'mr', label: 'Material requests' }, { ID: 'po', label: 'Purchase orders' }] },
  { title: 'Selling', types: [{ ID: 'qt', label: 'Quotations' }, { ID: 'so', label: 'Sales orders' }] },
  { title: 'Stock', types: [{ ID: 'se', label: 'Stock entries' }, { ID: 'dn', label: 'Delivery notes' }] },
  { title: 'Quality', types: [{ ID: 'qi', label: 'Quality inspections' }] }
];

/** The status dot of each document status. */
const STATUS_TONES = {
  Pending: 'warning', 'To receive': 'info', Completed: 'success', Open: 'info', 'To deliver': 'warning',
  Delivered: 'success', Accepted: 'success', Receipt: 'success', Transfer: 'info', Issue: 'neutral'
};

/**
 * Three stock items, as the server would send them. `values` is the saved form record; stock,
 * suppliers, and prices are child tables; documents and activity are what the record links to.
 * Dates are ISO strings in local time; every label shown for them is derived when it is drawn.
 */
const ITEMS = [
  {
    code: 'SKU-2047',
    values: {
      name: 'Charging cradle CC-4', group: 'accessories', brand: 'Fieldstone', unit: 'pcs',
      barcode: '4260748 120478', enabled: true, maintainStock: true, serialised: false,
      description: 'Four-slot charging cradle for HS-40 scanners, with a spare-battery bay and wall bracket.',
      valuation: 'moving', warehouse: 'BER', shelfLife: null, warranty: 24, weight: 0.9,
      supplier: 'voss', leadTime: 10, minOrder: 20, purchaseUnit: 'pcs', salesUnit: 'pcs', maxDiscount: 10
    },
    rate: 64.9,
    reservedLastWeek: 9,
    trend: [104, 98, 112, 96, 91, 88, 100],
    stock: [
      { ID: 'BER', actual: 62, reserved: 8, ordered: 0, reorderLevel: 30, reorderQty: 60, request: 'purchase' },
      { ID: 'HAM', actual: 24, reserved: 4, ordered: 40, reorderLevel: 20, reorderQty: 40, request: 'transfer' },
      { ID: 'MUC', actual: 11, reserved: 0, ordered: 0, reorderLevel: 15, reorderQty: 30, request: 'transfer' },
      { ID: 'RMA', actual: 3, reserved: 0, ordered: 0, reorderLevel: 0, reorderQty: 0, request: 'purchase' }
    ],
    suppliers: [{ ID: 'voss', part: 'VE-CC4-B', leadTime: 10, price: 58.2, preferred: true }],
    prices: [
      { ID: 'standard', list: 'Standard selling', rate: 99, validFrom: '2026-01-01' },
      { ID: 'partner', list: 'Partner', rate: 89, validFrom: '2026-01-01' }
    ],
    tags: ['serialised'], assigned: ['lea'], followers: ['lea'],
    files: [{ id: 'f1', name: 'CC-4 datasheet.pdf', size: 384210 }],
    created: '2025-03-12', modified: { by: 'lea', at: '2026-10-05T15:20' },
    documents: [
      { type: 'po', ID: 'PO-26-0227', date: '2026-09-30', party: 'Voss Elektronik KG', qty: 40, status: 'To receive' },
      { type: 'so', ID: 'SO-26-1179', date: '2026-10-05', party: 'Northstar Freight', qty: 8, status: 'To deliver' },
      { type: 'se', ID: 'SE-26-0402', date: '2026-10-01', party: 'Berlin central', qty: 30, status: 'Receipt' },
      { type: 'dn', ID: 'DN-26-0941', date: '2026-10-02', party: 'Atelier West', qty: 4, status: 'Delivered' }
    ],
    activity: [
      { id: 'c3', at: '2026-10-05T15:20', actor: 'lea', title: 'changed the Hamburg reorder level from 15 to 20' },
      { id: 'c2', at: '2026-10-01T14:30', actor: 'lea', title: 'received 30 pcs into Berlin central', meta: ['SE-26-0402'] },
      { id: 'c1', at: '2026-09-30T10:05', actor: 'ines', title: 'ordered 40 pcs from Voss Elektronik KG', meta: ['PO-26-0227'] }
    ]
  },
  {
    code: 'SKU-2048',
    values: {
      name: 'Handheld scanner HS-40', group: 'scanners', brand: 'Fieldstone', unit: 'pcs',
      barcode: '4260748 120485', enabled: true, maintainStock: true, serialised: true,
      description: 'Rugged 2D barcode scanner for warehouse floors: IP65, 1.8 m drop rating, hot-swap '
        + 'battery, and Wi-Fi 6. Ships with a hand strap and a USB-C cable.',
      valuation: 'moving', warehouse: 'BER', shelfLife: null, warranty: 36, weight: 0.42,
      supplier: 'alpine', leadTime: 21, minOrder: 50, purchaseUnit: 'box', salesUnit: 'pcs', maxDiscount: 15
    },
    rate: 186.4,
    reservedLastWeek: 41,
    trend: [286, 301, 322, 297, 318, 331, 354],
    stock: [
      { ID: 'BER', actual: 214, reserved: 36, ordered: 120, reorderLevel: 80, reorderQty: 150, request: 'purchase' },
      { ID: 'HAM', actual: 92, reserved: 18, ordered: 0, reorderLevel: 60, reorderQty: 100, request: 'transfer' },
      { ID: 'MUC', actual: 41, reserved: 4, ordered: 0, reorderLevel: 50, reorderQty: 80, request: 'transfer' },
      { ID: 'RMA', actual: 7, reserved: 0, ordered: 0, reorderLevel: 0, reorderQty: 0, request: 'purchase' }
    ],
    suppliers: [
      { ID: 'alpine', part: 'AW-HS40-EU', leadTime: 21, price: 172.5, preferred: true },
      { ID: 'voss', part: 'VE-77120', leadTime: 14, price: 179, preferred: false }
    ],
    prices: [
      { ID: 'standard', list: 'Standard selling', rate: 289, validFrom: '2026-10-02' },
      { ID: 'partner', list: 'Partner', rate: 259, validFrom: '2026-04-01' },
      { ID: 'public', list: 'Public sector', rate: 274, validFrom: '2026-04-01' }
    ],
    tags: ['rugged', 'bestseller', 'serialised'], assigned: ['lea', 'tobias'], followers: ['lea', 'ines', 'nadine'],
    files: [
      { id: 'f1', name: 'HS-40 datasheet.pdf', size: 1203911 },
      { id: 'f2', name: 'Drop test report.pdf', size: 642118 }
    ],
    created: '2024-11-04', modified: { by: 'nadine', at: '2026-10-08T09:12' },
    documents: [
      { type: 'mr', ID: 'MR-26-0042', date: '2026-10-06', party: 'Munich south', qty: 80, status: 'Pending' },
      { type: 'po', ID: 'PO-26-0231', date: '2026-10-02', party: 'Alpine Works GmbH', qty: 120, status: 'To receive' },
      { type: 'po', ID: 'PO-26-0198', date: '2026-09-11', party: 'Alpine Works GmbH', qty: 150, status: 'Completed' },
      { type: 'po', ID: 'PO-26-0164', date: '2026-08-19', party: 'Voss Elektronik KG', qty: 60, status: 'Completed' },
      { type: 'qt', ID: 'QT-26-0310', date: '2026-10-07', party: 'Meridian Health', qty: 25, status: 'Open' },
      { type: 'so', ID: 'SO-26-1187', date: '2026-10-08', party: 'Bruckner Logistik', qty: 24, status: 'To deliver' },
      { type: 'so', ID: 'SO-26-1180', date: '2026-10-05', party: 'Northstar Freight', qty: 18, status: 'To deliver' },
      { type: 'so', ID: 'SO-26-1160', date: '2026-10-01', party: 'Danube Systems AG', qty: 12, status: 'To deliver' },
      { type: 'so', ID: 'SO-26-1142', date: '2026-09-28', party: 'Helios Energie', qty: 4, status: 'To deliver' },
      { type: 'se', ID: 'SE-26-0418', date: '2026-10-07', party: 'Hamburg port → Munich south', qty: 20, status: 'Transfer' },
      { type: 'se', ID: 'SE-26-0409', date: '2026-10-05', party: 'Returns & repair', qty: 3, status: 'Issue' },
      { type: 'se', ID: 'SE-26-0396', date: '2026-09-30', party: 'Berlin central', qty: 40, status: 'Receipt' },
      { type: 'dn', ID: 'DN-26-0954', date: '2026-10-06', party: 'Bruckner Logistik', qty: 30, status: 'Delivered' },
      { type: 'dn', ID: 'DN-26-0938', date: '2026-10-01', party: 'Atelier West', qty: 6, status: 'Delivered' },
      { type: 'qi', ID: 'QI-26-0077', date: '2026-09-12', party: 'PO-26-0198', qty: 150, status: 'Accepted' }
    ],
    activity: [
      { id: 'h6', at: '2026-10-08T09:12', actor: 'nadine', title: 'reserved 24 pcs for Bruckner Logistik', meta: ['SO-26-1187'] },
      { id: 'h5', at: '2026-10-07T16:40', actor: 'lea', title: 'transferred 20 pcs from Hamburg port to Munich south', meta: ['SE-26-0418'] },
      {
        id: 'h4', at: '2026-10-07T11:05', actor: 'tobias', title: 'commented',
        content: 'Bruckner wants 50 units held for the depot rollout in November. Can we keep them in Berlin?'
      },
      { id: 'h3', at: '2026-10-06T14:20', actor: 'lea', title: 'raised a material request for Munich south', meta: ['MR-26-0042'] },
      { id: 'h2', at: '2026-10-02T11:30', actor: 'ruth', title: 'changed the standard selling rate from €279.00 to €289.00' },
      { id: 'h1', at: '2026-10-02T09:45', actor: 'ines', title: 'ordered 120 pcs from Alpine Works GmbH', meta: ['PO-26-0231'] }
    ]
  },
  {
    code: 'SKU-2049',
    values: {
      name: 'Label printer LP-200', group: 'printers', brand: 'Fieldstone', unit: 'pcs',
      barcode: '4260748 120492', enabled: true, maintainStock: true, serialised: true,
      description: 'Thermal-transfer label printer, 203 dpi, 100 mm print width, Ethernet and USB.',
      valuation: 'fifo', warehouse: 'HAM', shelfLife: null, warranty: 24, weight: 2.8,
      supplier: 'tidewater', leadTime: 28, minOrder: 10, purchaseUnit: 'pcs', salesUnit: 'pcs', maxDiscount: 8
    },
    rate: 312,
    reservedLastWeek: 2,
    trend: [18, 22, 21, 19, 14, 12, 9],
    stock: [
      { ID: 'BER', actual: 4, reserved: 2, ordered: 0, reorderLevel: 6, reorderQty: 12, request: 'transfer' },
      { ID: 'HAM', actual: 5, reserved: 3, ordered: 10, reorderLevel: 8, reorderQty: 20, request: 'purchase' },
      { ID: 'MUC', actual: 0, reserved: 0, ordered: 0, reorderLevel: 4, reorderQty: 8, request: 'transfer' },
      { ID: 'RMA', actual: 0, reserved: 0, ordered: 0, reorderLevel: 0, reorderQty: 0, request: 'purchase' }
    ],
    suppliers: [{ ID: 'tidewater', part: 'TD-LP200-203', leadTime: 28, price: 288, preferred: true }],
    prices: [{ ID: 'standard', list: 'Standard selling', rate: 449, validFrom: '2026-01-01' }],
    tags: ['rental'], assigned: ['owen'], followers: ['owen', 'lea'],
    files: [],
    created: '2025-06-30', modified: { by: 'owen', at: '2026-10-07T10:45' },
    documents: [
      { type: 'po', ID: 'PO-26-0229', date: '2026-10-01', party: 'Tidewater Devices B.V.', qty: 10, status: 'To receive' },
      { type: 'so', ID: 'SO-26-1183', date: '2026-10-06', party: 'Kestrel Analytics', qty: 3, status: 'To deliver' },
      { type: 'so', ID: 'SO-26-1171', date: '2026-10-03', party: 'Meridian Health', qty: 2, status: 'To deliver' }
    ],
    activity: [
      { id: 'l2', at: '2026-10-07T10:45', actor: 'owen', title: 'tagged the item as Rental pool' },
      { id: 'l1', at: '2026-10-01T13:10', actor: 'ines', title: 'ordered 10 pcs from Tidewater Devices B.V.', meta: ['PO-26-0229'] }
    ]
  }
];

/**
 * The record's editable fields, one Form per tab. Keys are the value ids in `ITEMS[].values`.
 * @returns {Record<string, import('../../src/components/fieldset/fieldset.js').FieldsetOptions[]>}
 */
function recordFieldsets() {
  const select = (label, items, extra = {}) => ({ type: 'zxselect', label, props: { items, ...extra } });
  const number = (label, props) => ({ type: 'number', label, props });
  const sets = {
    details: [
      {
        title: 'General', columns: 3, fields: {
          code: { type: 'text', label: 'Item code', disabled: true },
          name: { type: 'text', label: 'Item name', required: true },
          group: select('Item group', ITEM_GROUPS),
          brand: { type: 'text', label: 'Brand' },
          unit: select('Default unit', UNITS),
          barcode: { type: 'text', label: 'Barcode (EAN-13)' }
        }
      },
      {
        title: 'Flags', columns: 3, fields: {
          enabled: { type: 'toggle', label: 'Status', props: { label: 'Enabled' } },
          maintainStock: { type: 'toggle', label: 'Inventory', props: { label: 'Maintain stock' } },
          serialised: { type: 'toggle', label: 'Tracking', props: { label: 'Serial numbers' } }
        }
      },
      { fields: { description: { type: 'textarea', label: 'Description', props: { rows: 3 } } } }
    ],
    inventory: [{
      title: 'Valuation and storage', columns: 3, fields: {
        valuation: select('Valuation method', VALUATION_METHODS),
        warehouse: select('Default warehouse', WAREHOUSES),
        weight: number('Weight per unit', { unit: 'kg', step: 0.01, min: 0 }),
        warranty: number('Warranty', { unit: 'months', min: 0 }),
        shelfLife: number('Shelf life', { unit: 'days', min: 0, placeholder: 'Unlimited' })
      }
    }],
    purchasing: [{
      title: 'Purchasing', columns: 3, fields: {
        supplier: select('Default supplier', SUPPLIERS),
        leadTime: number('Lead time', { unit: 'days', min: 0 }),
        minOrder: number('Minimum order', { unit: 'pcs', min: 1 }),
        purchaseUnit: select('Purchase unit', UNITS)
      }
    }],
    sales: [{
      title: 'Selling', columns: 3, fields: {
        salesUnit: select('Sales unit', UNITS),
        maxDiscount: number('Maximum discount', { unit: '%', min: 0, max: 100 })
      }
    }]
  };
  return sets;
}

export default {
  title: 'Item & inventory',
  category: 'Operations',
  blurb: 'One stock item as a record: levels per warehouse, linked documents, tabbed settings, and a movement log.',
  components: [
    'StatTile', 'Table', 'Form', 'Tabbox', 'ActivityList', 'FileList', 'TagPicker', 'Select', 'NumberField',
    'Toggle', 'Breadcrumb', 'MenuButton', 'InlineLoading', 'CheckButton', 'Dialog', 'Sheet', 'Avatar', 'Message'
  ],

  /**
   * Mounts the item record with its navigation, dashboard, tabbed form, and timeline.
   * @param {HTMLElement} container Gallery stage.
   * @param {Partial<import('./kit.js').LayoutContext>} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const items = structuredClone(ITEMS);
    const state = { index: 1, view: 'items', dirty: false, saving: false, edited: new Set() };
    /** @returns {(typeof ITEMS)[number]} The open item. */
    const item = () => items[state.index];
    // The side column is redrawn per item; its avatars belong to one drawing.
    const asideParts = renderScope(context);
    // Narrow, the navigation and then the side column become drawers opened from the header.
    const root = h('div', { class: 'inventory shell' });
    const shell = adaptiveShell(root, context, { asideLabel: 'Item details' });
    const notify = toaster(context, root);

    // ------------------------------------------------------------- navigation column --
    const navGroups = NAVIGATION.map((group) => keep(new AppSidebar(null, {
      label: group.label,
      collapsible: false,
      items: group.items.map((entry) => ({ ...entry, invoke: () => show(entry.id) }))
    })));
    const me = person(ME);
    const account = keep(new AccountMenu(null, {
      account: { name: me.name, secondary: me.role, status: me.status },
      placement: 'top-start',
      items: [
        { label: 'Preferences', value: 'prefs', icon: 'gear' },
        '-',
        { label: 'Sign out', value: 'out', icon: 'power-off' }
      ],
      onselect: (event) => notify(unavailable(event.detail.item.label), 'info')
    }));
    const navColumn = h('div', { class: 'shell__nav' },
      workspaceHeader(),
      h('div', { class: 'shell__body' },
        NAVIGATION.map((group, index) => [sectionLabel(group.label), navGroups[index].toElement()])),
      h('div', { class: 'shell__footer' }, account.toElement()));

    // ------------------------------------------------------------------ record header --
    const crumbs = keep(new Breadcrumb(null, {
      items: [],
      onselect: (event) => show(event.detail.name === 'items' ? 'items' : 'stock-balance')
    }));
    const unsaved = badge({ label: 'Not saved', kind: 'warning', dot: true });
    const saveStatus = keep(new InlineLoading(null, { status: 'inactive', size: 'sm' }));
    const stateSlot = h('span', { class: 'inventory__state' });
    const saveButton = button({ label: 'Save', kind: 'primary', shortcut: modShortcut('s'), onclick: () => save() });
    const previous = iconButton('chevron-left', 'Previous item', () => step(-1), { shortcut: { label: '[', keys: '[' } });
    const next = iconButton('chevron-right', 'Next item', () => step(1), { shortcut: { label: ']', keys: ']' } });
    const create = keep(new MenuButton(null, {
      label: 'Create',
      icon: 'plus',
      placement: 'bottom-end',
      items: [
        { label: 'Purchase order', icon: 'cart-shopping', onselect: () => createDocument('po') },
        { label: 'Stock entry', icon: 'dolly', shortcut: 'N', onselect: () => openStockEntry() },
        { label: 'Material request', icon: 'clipboard-list', onselect: () => createDocument('mr') }
      ]
    }));
    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost',
      placement: 'bottom-end',
      items: [
        { label: 'Duplicate item', icon: 'copy-regular', onselect: () => notify(`A copy of ${item().code} was created as a draft.`) },
        { label: 'Print shelf label', icon: 'print', onselect: () => notify(`Shelf label for ${item().code} sent to the printer.`) },
        '-',
        { label: 'Delete item', icon: 'trash-can', danger: true, onselect: () => remove() }
      ]
    }));

    // ------------------------------------------------------------------ record body --
    const title = h('h2', { class: 'record-title inventory__title' });
    const enabledBadge = h('span', { class: 'inventory__enabled' });
    const subtitle = h('p', { class: 'inventory__subtitle meta' });
    // The figures are text; a caption under each says what it is made of. The projected tile is the
    // only one that takes a colour, and only while a warehouse is due for reordering.
    const tiles = {
      stock: keep(statTile({ label: 'In stock', format: pieces, deltaLabel: 'vs. last week' })),
      reserved: keep(statTile({ label: 'Reserved', format: pieces, deltaLabel: 'vs. last week' })),
      projected: keep(statTile({ label: 'Projected', format: pieces })),
      value: keep(statTile({ label: 'Stock value', format: 'currency', currency: 'EUR', deltaLabel: 'vs. last week' }))
    };

    const levels = keep(new Table(null, {
      responsive: 'sm',
      columns: [
        {
          id: 'warehouse', label: 'Warehouse', width: '1.5fr',
          render: (row) => h('span', { class: 'inventory__warehouse' }, h('span', {}, row.name),
            h('span', { class: 'meta mono' }, row.ID))
        },
        { id: 'bar', label: 'Level', width: '1.6fr', render: (row) => quantityBar(row) },
        { id: 'actual', label: 'In stock', type: 'number', align: 'end', width: '0.8fr' },
        { id: 'reserved', label: 'Reserved', type: 'number', align: 'end', width: '0.8fr' },
        {
          id: 'projected', label: 'Projected', align: 'end', width: '1.4fr',
          headerTitle: 'In stock, less reserved, plus on order', render: (row) => projectedCell(row)
        },
        { id: 'status', label: 'Status', width: '1fr', render: (row) => statusText(stockStatus(row)) }
      ],
      data: [],
      zebra: false,
      stickyHeader: false
    }));
    levels.toElement().classList.add('inventory__levels');
    const levelsMeta = h('span', { class: 'meta' });
    const legend = h('div', { class: 'inventory__legend meta', 'aria-hidden': 'true' },
      h('span', {}, h('i', { class: 'inventory__swatch' }), 'Available'),
      h('span', {}, h('i', { class: 'inventory__swatch inventory__swatch--reserved' }), 'Reserved'),
      h('span', {}, h('i', { class: 'inventory__swatch inventory__swatch--reorder' }), 'Reorder level'));

    const connections = h('div', { class: 'inventory__connections' });

    // Each settings tab is a Form; the tables below them edit the record's child rows in place.
    const sets = recordFieldsets();
    const forms = Object.fromEntries(Object.entries(sets).map(([name, fieldsets]) => [name, keep(new Form(null, {
      fieldsets,
      onchange: (event) => {
        if (event.detail.id === 'enabled') paintTitle();
        markDirty(event.detail.id);
      }
    }))]));
    const editableTable = (columns, section) => {
      const table = keep(new Table(null, {
        columns, data: [], variant: 'plain', zebra: false, stickyHeader: false, editMode: 'cell', editTrigger: 'single',
        oneditcommit: (event) => {
          if (Object.keys(event.detail.changes).length === 0) return;
          markDirty(section);
          // The table writes the committed row back after this handler returns; reorder levels feed
          // the stock table, so it repaints once the new value is in place.
          if (section === 'reorder levels') queueMicrotask(paintLevels);
        }
      }));
      table.toElement().classList.add('inventory__child-table');
      return table;
    };
    const reorder = editableTable([
      { id: 'name', label: 'Warehouse', width: '1.4fr' },
      { id: 'reorderLevel', label: 'Reorder level', type: 'number', align: 'end', width: '1fr', editable: 'number', editorProps: { min: 0 } },
      { id: 'reorderQty', label: 'Reorder quantity', type: 'number', align: 'end', width: '1fr', editable: 'number', editorProps: { min: 0 } },
      {
        id: 'request', label: 'Replenish by', width: '1fr', editable: 'select',
        options: { purchase: 'Purchase', transfer: 'Transfer' },
        render: (row) => (row.request === 'purchase' ? 'Purchase' : 'Transfer')
      }
    ], 'reorder levels');
    const supplierRows = editableTable([
      { id: 'supplier', label: 'Supplier', width: '1.6fr', render: (row) => SUPPLIERS.find((s) => s.ID === row.ID)?.name ?? row.ID },
      { id: 'part', label: 'Supplier part no.', width: '1.2fr', editable: 'text', render: (row) => h('span', { class: 'mono' }, row.part) },
      { id: 'leadTime', label: 'Lead time (days)', type: 'number', align: 'end', width: '1fr', editable: 'number' },
      { id: 'price', label: 'Last price', type: 'currency', currency: 'EUR', align: 'end', width: '1fr', editable: 'number' },
      { id: 'preferred', label: '', width: '0.8fr', render: (row) => (row.preferred ? h('span', { class: 'meta' }, 'Preferred') : '') }
    ], 'suppliers');
    const priceRows = editableTable([
      { id: 'list', label: 'Price list', width: '1.6fr' },
      { id: 'rate', label: 'Rate', type: 'currency', currency: 'EUR', align: 'end', width: '1fr', editable: 'number' },
      { id: 'validFrom', label: 'Valid from', width: '1fr', render: (row) => formatDate(localDate(row.validFrom), DATE.year) },
      { id: 'margin', label: 'Margin', align: 'end', width: '0.8fr', render: (row) => margin(row.rate) }
    ], 'price lists');

    const timeline = keep(new ActivityList(null, { items: [], label: 'Item activity', itemHeadingLevel: 3 }));
    const comment = h('textarea', {
      class: 'inventory__comment-input', rows: 1, tabindex: '0', placeholder: 'Add a comment…',
      'aria-label': 'Comment', 'aria-keyshortcuts': modShortcut('Enter').keys,
      oninput: () => { postButton.disabled = comment.value.trim() === ''; }
    });
    const postButton = button({
      label: 'Comment', disabled: true, shortcut: modShortcut('Enter', '↵'), onclick: () => postComment()
    });
    shortcuts(comment, { 'Mod+Enter': () => postComment() }, context);

    // The record's tabs sit right under its title, so every settings form is one click away. The
    // overview is the dashboard: the figures, the stock per warehouse, and the linked documents.
    const tabs = keep(new Tabbox(null, {
      variant: 'line',
      label: 'Item sections',
      tabs: [
        {
          name: 'overview', title: 'Overview',
          content: h('div', { class: 'inventory__tab' },
            h('div', { class: 'inventory__stats' }, Object.values(tiles).map((tile) => tile.toElement())),
            recordSection('Stock levels', {
              meta: levelsMeta,
              actions: button({
                label: 'New stock entry', icon: 'plus', size: 'sm', shortcut: { label: 'N', keys: 'N' },
                onclick: () => openStockEntry()
              })
            }, levels.toElement(), legend),
            recordSection('Connections', {}, connections))
        },
        {
          // The item's details read as data: a field shows its frame only when pointed at.
          name: 'details', title: 'Details',
          content: h('div', { class: 'form-sheet form-sections inventory__tab', 'data-zx-fields': 'quiet' }, forms.details.toElement())
        },
        {
          name: 'inventory', title: 'Inventory',
          content: tabPanel(forms.inventory, recordSection('Reorder levels', {
            description: 'Raise a request when projected stock falls below the level.'
          }, reorder.toElement()))
        },
        {
          name: 'purchasing', title: 'Purchasing',
          content: tabPanel(forms.purchasing, recordSection('Suppliers', {
            description: 'Last purchase prices and lead times per supplier.'
          }, supplierRows.toElement()))
        },
        {
          name: 'sales', title: 'Sales',
          content: tabPanel(forms.sales, recordSection('Price lists', {
            description: 'Margins are measured against the current valuation rate.'
          }, priceRows.toElement()))
        },
        {
          name: 'activity', title: 'Activity',
          content: h('div', { class: 'inventory__tab' },
            h('div', { class: 'inventory__composer' },
              keep(new Avatar(null, { name: me.name, size: 'sm' })).toElement(), comment, postButton),
            timeline.toElement())
        }
      ],
      active: 'overview'
    }));
    // The tab row stays put under the title; the open tab scrolls beneath it.
    tabs.toElement().classList.add('shell__tabs', 'inventory__tabs');

    const record = h('div', { class: 'inventory__record' },
      h('div', { class: 'inventory__head' },
        h('div', { class: 'inventory__heading' }, title, enabledBadge),
        subtitle),
      tabs.toElement());

    const recordHeader = paneHeader({
      className: 'inventory__header',
      leading: [shell.navToggle(), crumbs.toElement()],
      actions: [stateSlot, h('span', { class: 'inventory__pager' }, previous, next), create.toElement(),
        saveButton, more.toElement(), shell.asideToggle()]
    });

    // ------------------------------------------------------------- secondary screens --
    const list = keep(new Table(null, {
      responsive: 'sm',
      columns: [
        { id: 'code', label: 'Item code', width: '0.8fr', render: (row) => h('span', { class: 'mono' }, row.code) },
        { id: 'name', label: 'Item name', width: '1.8fr' },
        { id: 'group', label: 'Item group', width: '1fr' },
        { id: 'stock', label: 'In stock', type: 'number', align: 'end', width: '0.8fr' },
        { id: 'value', label: 'Stock value', type: 'currency', currency: 'EUR', align: 'end', width: '1fr' },
        { id: 'status', label: 'Status', width: '0.9fr', render: (row) => statusText(row.status) }
      ],
      data: [],
      rowId: 'code',
      selectable: 'single',
      onrowclick: (event) => open(items.findIndex((entry) => entry.code === event.detail.id))
    }));
    const otherTitle = h('span');
    const otherBody = h('div', { class: 'shell__body shell__body--padded' });
    const otherCount = h('span', { class: 'meta' });
    const otherHeader = paneHeader({ leading: shell.navToggle(), title: otherTitle, actions: otherCount });
    const otherHeading = /** @type {HTMLElement} */ (otherHeader.querySelector('.shell__title'));

    // The side column: the item's picture, key facts, people, tags, and attachments. Each block
    // is a quiet heading with its icon and, at the far end, the one action that adds to it.
    const fileInput = h('input', {
      type: 'file', hidden: true, multiple: true,
      onchange: () => {
        for (const file of fileInput.files ?? []) {
          item().files.push({ id: uid('file'), name: file.name, size: file.size });
          log(ME, `attached ${file.name}`);
        }
        fileInput.value = '';
        paintAside();
      }
    });
    const side = {
      details: h('div'),
      assigned: h('div', { class: 'inventory__people' }),
      followers: h('div', { class: 'inventory__followers' })
    };
    const assignButton = iconButton('plus', 'Assign someone');
    const assignMenu = keep(new MenuButton(assignButton, { kind: 'ghost', placement: 'bottom-end', items: [] }));
    // Tags read as plain chips, a read-only picker. The + button or a click on the chips makes it
    // editable; leaving it, or Escape once its list is closed, turns it back into chips.
    const tags = keep(new TagPicker(null, {
      items: TAGS, allowCreate: true, readonly: true, placeholder: 'Add a tag',
      onchange: (event) => { item().tags = [...event.detail.values]; },
      onadd: (event) => log(ME, `tagged the item as ${event.detail.item?.name ?? event.detail.value}`)
    }));
    const editTags = () => tags.setReadonly(false).focus().open();
    const addTag = iconButton('plus', 'Add a tag', editTags);
    const tagsRoot = tags.toElement();
    tagsRoot.addEventListener('click', () => { if (tagsRoot.hasAttribute('data-readonly')) editTags(); },
      { signal: context.signal });
    tagsRoot.addEventListener('focusout', (event) => {
      if (!tagsRoot.contains(/** @type {Node|null} */ (event.relatedTarget))) tags.setReadonly(true);
    }, { signal: context.signal });
    tagsRoot.addEventListener('keydown', (event) => {
      // The picker's own Escape closes its list first; the next one ends the edit.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      addTag.focus();
    }, { signal: context.signal });
    const files = keep(new FileList(null, {
      items: [],
      label: 'Attachments',
      emptyText: 'No files attached.',
      onactivate: (event) => {
        event.preventDefault();
        notify(unavailable('The file viewer'), 'info');
      },
      onaction: (event) => {
        event.preventDefault();
        detach(event.detail.file);
      }
    }));
    const follow = keep(new CheckButton(null, {
      label: ['Following', 'Follow'],
      onchange: (event) => {
        const current = item();
        current.followers = event.detail.checked
          ? [...current.followers, ME] : current.followers.filter((id) => id !== ME);
        paintAside();
      }
    }));
    follow.toElement().classList.add('inventory__follow');
    const aside = h('aside', { class: 'shell__aside', 'aria-label': 'Item details' },
      paneHeader({ title: 'Item' }),
      h('div', { class: 'shell__body' },
        h('div', { class: 'panel-block' },
          h('div', { class: 'inventory__photo', role: 'img', 'aria-label': 'No product photo' },
            icon('image', { size: 20 }), h('span', { 'aria-hidden': 'true' }, 'No photo'))),
        sideBlock({ title: 'Details', icon: 'circle-info' }, side.details),
        sideBlock({ title: 'Assigned to', icon: 'user', action: assignMenu.toElement() }, side.assigned),
        sideBlock({ title: 'Tags', icon: 'tag', action: addTag }, h('div', { 'data-zx-fields': 'quiet' }, tagsRoot)),
        sideBlock({ title: 'Attachments', icon: 'paperclip', action: iconButton('plus', 'Attach a file', () => fileInput.click()) },
          files.toElement(), fileInput),
        sideBlock({ title: 'Followers', icon: 'eye', action: follow.toElement() }, side.followers)));
    const main = h('section', { class: 'shell__main', 'aria-label': 'Inventory' },
      recordHeader, record, otherHeader, otherBody);
    root.append(navColumn, main, aside);

    shortcuts(root, {
      'Mod+s': () => save(),
      n: () => openStockEntry(),
      '[': () => step(-1),
      ']': () => step(1)
    }, context);
    // Typing marks the record dirty before the field commits its value on blur.
    for (const form of Object.values(forms)) {
      form.toElement().addEventListener('input', (event) => {
        if (!(event.target instanceof Element) || event.target.closest('.zx-select')) return;
        markDirty(event.target.closest('[data-field-id]')?.getAttribute('data-field-id') ?? 'details');
      }, { signal: context.signal });
    }

    container.append(root);
    open(state.index);

    // ---------------------------------------------------------------------- views --

    /**
     * Fills every part of the record from one item: header, dashboard, forms, tables, side column, and
     * timeline. Called on mount and whenever another item is opened.
     * @param {number} index Position in `items`.
     * @returns {void}
     */
    function open(index) {
      if (index < 0) return;
      state.index = index;
      const current = item();
      for (const form of Object.values(forms)) {
        form.setValues({ ...current.values, code: current.code }, { silent: true });
        form.clearHighlights();
      }
      reorder.setData(current.stock.map((row) => ({ ...row, name: warehouseName(row.ID) })));
      supplierRows.setData(current.suppliers.map((row) => ({ ...row })));
      priceRows.setData(current.prices.map((row) => ({ ...row })));
      timeline.setItems(current.activity.map(activityItem));
      tabs.setBadge('activity', String(current.activity.length));
      crumbs.setItems([{ name: 'stock', label: 'Stock' }, { name: 'items', label: 'Items' }, { name: 'record', label: current.code }]);
      previous.disabled = index === 0;
      next.disabled = index === items.length - 1;
      previous.title = index > 0 ? `Previous: ${items[index - 1].values.name} ([)` : 'No previous item';
      next.title = index < items.length - 1 ? `Next: ${items[index + 1].values.name} (])` : 'No next item';
      setDirty(false);
      saveStatus.set('inactive', '');
      paintTitle();
      paintLevels();
      paintPrices();
      paintConnections();
      paintAside();
      show('record');
    }

    /**
     * Switches the main pane between the record, the item list, and the other destinations.
     * @param {string} view `'record'`, `'items'`, or a navigation id.
     * @returns {void}
     */
    function show(view) {
      const onRecord = view === 'record';
      state.view = view;
      // Each group is its own list; the one holding the destination marks it, the others clear.
      for (const group of navGroups) group.setActive(onRecord ? 'items' : view);
      recordHeader.hidden = !onRecord;
      record.hidden = !onRecord;
      aside.hidden = !onRecord;
      otherHeader.hidden = onRecord;
      otherBody.hidden = onRecord;
      if (onRecord) {
        keepFocus(title);
        return;
      }
      if (view === 'items') {
        otherTitle.textContent = 'Items';
        list.setData(items.map((entry) => ({
          code: entry.code,
          name: entry.values.name,
          group: ITEM_GROUPS.find((group) => group.ID === entry.values.group)?.name ?? '',
          stock: total(entry, 'actual'),
          value: total(entry, 'actual') * entry.rate,
          status: entry.values.enabled ? { label: 'Enabled', kind: 'success' } : { label: 'Disabled', kind: 'neutral' }
        })));
        list.setSelection([item().code]);
        otherCount.textContent = `${items.length} items`;
        otherBody.replaceChildren(list.toElement());
        keepFocus(otherHeading);
        return;
      }
      const label = NAVIGATION.flatMap((group) => group.items).find((entry) => entry.id === view)?.label ?? 'Stock';
      otherTitle.textContent = label;
      otherCount.textContent = '';
      otherBody.replaceChildren(unavailablePane(label, { label: `Back to ${item().code}`, onclick: () => show('record') }));
      keepFocus(otherHeading);
    }

    /**
     * When a view switch hid what had focus — a breadcrumb, a row of the list — focus moves to
     * the heading of the view now showing, so it is never lost and a screen reader hears where it went.
     * @param {HTMLElement} heading
     * @returns {void}
     */
    function keepFocus(heading) {
      const active = document.activeElement;
      if (context.preview || !main.contains(active) || (active instanceof HTMLElement && active.checkVisibility())) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }

    /** Writes the item name, its enabled state, and the record subtitle. @returns {void} */
    function paintTitle() {
      const current = item();
      const enabled = forms.details.getValue('enabled');
      title.textContent = forms.details.getValue('name') || current.values.name;
      enabledBadge.replaceChildren(badge(enabled
        ? { label: 'Enabled', kind: 'success', dot: true }
        : { label: 'Disabled', kind: 'neutral', dot: true }));
      const group = ITEM_GROUPS.find((entry) => entry.ID === current.values.group)?.name;
      const editor = person(current.modified.by);
      subtitle.replaceChildren(
        h('span', { class: 'mono' }, current.code), ' · ', group, ' · ', current.values.brand, ' · ',
        `Modified ${formatRelativeTime(new Date(current.modified.at), { now: NOW })} by ${editor?.name}`);
    }

    /** Recomputes the stat tiles and the per-warehouse table from the stock rows. @returns {void} */
    function paintLevels() {
      const current = item();
      const levelsByWarehouse = new Map(reorder.getData().map((row) => [row.ID, row]));
      const rows = current.stock.map((row) => {
        const settings = levelsByWarehouse.get(row.ID) ?? row;
        return {
          ...row,
          name: warehouseName(row.ID),
          reorderLevel: Number(settings.reorderLevel) || 0,
          projected: row.actual - row.reserved + row.ordered
        };
      });
      const scale = niceCeiling(Math.max(...rows.map((row) => Math.max(row.actual + row.ordered, row.reorderLevel))));
      levels.setData(rows.map((row) => ({ ...row, scale })));
      const inStock = total(current, 'actual');
      const reserved = total(current, 'reserved');
      const ordered = total(current, 'ordered');
      const lastWeek = current.trend.at(-2);
      const stocked = rows.filter((row) => row.actual > 0).length;
      const orders = current.documents.filter((doc) => doc.type === 'so' && doc.status === 'To deliver').length;
      const short = rows.filter((row) => ['warning', 'danger'].includes(stockStatus(row).kind)).length;
      tiles.stock.update({
        value: inStock, delta: inStock - lastWeek,
        caption: stocked === rows.length ? `in all ${rows.length} warehouses` : `in ${stocked} of ${rows.length} warehouses`
      });
      tiles.reserved.update({
        value: reserved, delta: reserved - current.reservedLastWeek,
        caption: `for ${orders} sales order${orders === 1 ? '' : 's'}`
      });
      tiles.projected.update({
        value: inStock - reserved + ordered,
        kind: short ? 'warning' : 'neutral',
        caption: short ? `${short} warehouse${short === 1 ? '' : 's'} to reorder`
          : ordered ? `incl. ${formatNumber(ordered)} on order` : 'nothing on order'
      });
      tiles.value.update({
        value: inStock * current.rate, delta: (inStock - lastWeek) * current.rate,
        caption: `at ${formatCurrency(current.rate, 'EUR')} per piece`
      });
      levelsMeta.textContent = short === 0
        ? `${rows.length} warehouses · all above reorder level`
        : `${rows.length} warehouses · ${short} need${short === 1 ? 's' : ''} attention`;
    }

    /** Recomputes price-list margins after a rate or valuation change. @returns {void} */
    function paintPrices() {
      for (const row of priceRows.getData()) priceRows.updateRow(row.ID, { ...row });
    }

    /**
     * Rebuilds the Connections section from the item's linked documents: one row per document
     * type, with its count at the end, grouped by the part of the business it belongs to.
     * @returns {void}
     */
    function paintConnections() {
      const documents = item().documents;
      connections.replaceChildren(...CONNECTIONS.map((group) => h('div', { class: 'inventory__connection-group' },
        h('h4', { class: 'inventory__connection-title' }, group.title),
        ...group.types.map((type) => {
          const count = documents.filter((doc) => doc.type === type.ID).length;
          return h('button', {
            type: 'button',
            class: 'inventory__connection',
            dataset: { empty: count === 0 ? '' : null },
            onclick: () => openDocuments(type)
          }, h('span', { class: 'inventory__connection-label' }, type.label),
          h('span', { class: 'inventory__connection-count' }, String(count)));
        }))));
    }

    /**
     * Repaints the side column for the open item: details, people, tags, and files.
     * @returns {void}
     */
    function paintAside() {
      const current = item();
      asideParts.reset();
      side.details.replaceChildren(propList([
        ['Item code', h('span', { class: 'mono' }, current.code)],
        ['Valuation rate', formatCurrency(current.rate, 'EUR')],
        ['Created', formatDate(localDate(current.created), DATE.year)],
        ['Owner', who('lea')]
      ]));
      side.assigned.replaceChildren(...current.assigned.map((id) => h('div', { class: 'inventory__person' }, who(id),
        iconButton('x', `Unassign ${person(id).name}`, () => unassign(id)))));
      const unassigned = TEAM.filter((id) => !current.assigned.includes(id));
      assignMenu.setItems(unassigned
        .map((id) => ({ label: person(id).name, description: person(id).role, onselect: () => assign(id) })));
      assignButton.disabled = unassigned.length === 0;
      side.followers.replaceChildren(
        h('span', { class: 'avatar-stack' }, current.followers.map((id) => avatar(id, true))),
        h('span', { class: 'meta' }, `${current.followers.length} following`));
      follow.set(current.followers.includes(ME), { silent: true });
      tags.setValues(current.tags, { silent: true });
      files.setItems(current.files.map((file) => ({
        ...file, icon: fileIcon(file.name), identitySize: 'sm',
        actions: [{ id: 'remove', icon: 'trash', title: `Remove ${file.name}` }]
      })), { silent: true });
    }

    /**
     * An avatar for the side column; destroyed on the next repaint and on unmount.
     * @param {string} id Person id.
     * @param {boolean} [named] Give the avatar its own accessible name, for avatars without text.
     * @returns {HTMLElement}
     */
    function avatar(id, named = false) {
      const name = person(id).name;
      return asideParts.own(new Avatar(null, { name, size: 'sm', label: named ? name : undefined })).toElement();
    }

    /** @param {string} id Person id. @returns {HTMLElement} Their avatar and name. */
    function who(id) {
      return h('span', { class: 'person' }, avatar(id), h('span', { class: 'person__name' }, person(id).name));
    }

    // -------------------------------------------------------------------- editing --

    /**
     * Notes an edit and shows the unsaved state.
     * @param {string} what Field id or child-table name that changed.
     * @returns {void}
     */
    function markDirty(what) {
      if (state.saving) return;
      state.edited.add(what);
      setDirty(true);
    }

    /** @param {boolean} dirty @returns {void} */
    function setDirty(dirty) {
      state.dirty = dirty;
      if (!dirty) state.edited.clear();
      stateSlot.replaceChildren(dirty ? unsaved : saveStatus.toElement());
    }

    /**
     * Validates the forms, then saves through an `InlineLoading` that reads "Saving…" and "Saved".
     * @returns {void}
     */
    function save() {
      if (state.view !== 'record' || state.saving) return;
      if (!state.dirty) {
        stateSlot.replaceChildren(saveStatus.toElement());
        saveStatus.set('success', 'No changes');
        later(context, () => saveStatus.set('inactive', ''), 1800);
        return;
      }
      if (!forms.details.submit()) {
        tabs.openTab('details');
        stateSlot.replaceChildren(saveStatus.toElement());
        saveStatus.set('error', 'Fix the highlighted field');
        return;
      }
      state.saving = true;
      saveButton.disabled = true;
      stateSlot.replaceChildren(saveStatus.toElement());
      saveStatus.set('active', 'Saving…');
      later(context, () => {
        const current = item();
        const values = Object.assign({}, ...Object.values(forms).map((form) => form.getValues()));
        delete values.code;
        const labels = [...state.edited].map((id) => fieldLabel(id) ?? id);
        Object.assign(current.values, values);
        const settings = new Map(reorder.getData().map((row) => [row.ID, row]));
        current.stock = current.stock.map((row) => {
          const { reorderLevel, reorderQty, request } = settings.get(row.ID) ?? row;
          return { ...row, reorderLevel, reorderQty, request };
        });
        current.suppliers = supplierRows.getData().map((row) => ({ ...row }));
        current.prices = priceRows.getData().map((row) => ({ ...row }));
        current.modified = { by: ME, at: isoMinute(NOW) };
        log(ME, `updated ${listOf(labels)}`);
        state.saving = false;
        saveButton.disabled = false;
        setDirty(false);
        stateSlot.replaceChildren(saveStatus.toElement());
        saveStatus.set('success', 'Saved');
        paintTitle();
        later(context, () => { if (!state.dirty) saveStatus.set('inactive', ''); }, 2400);
      }, 700);
    }

    /**
     * Opens the neighbouring item, asking first when the record has unsaved edits.
     * @param {-1|1} direction
     * @returns {Promise<void>}
     */
    async function step(direction) {
      const target = state.index + direction;
      if (state.view !== 'record' || target < 0 || target >= items.length || state.saving) return;
      if (state.dirty && !await Dialog.confirm({
        title: 'Discard unsaved changes?',
        message: `Your edits to ${item().code} have not been saved.`,
        okLabel: 'Discard changes',
        danger: true
      })) return;
      open(target);
    }

    /** Asks before deleting the item, then returns to the item list. @returns {Promise<void>} */
    async function remove() {
      const current = item();
      if (items.length === 1) {
        notify('This example keeps at least one item.', 'info');
        return;
      }
      const confirmed = await Dialog.confirm({
        title: `Delete ${current.code}?`,
        message: `${current.values.name} and its ${current.stock.length} stock rows will be removed. `
          + 'Posted stock entries stay in the ledger.',
        okLabel: 'Delete item',
        danger: true
      });
      if (!confirmed) return;
      items.splice(state.index, 1);
      state.index = Math.min(state.index, items.length - 1);
      show('items');
      notify(`${current.code} deleted.`);
    }

    // ---------------------------------------------------------------- stock entries --

    /** Opens the stock entry dialog, created on first use. @returns {void} */
    function openStockEntry() {
      if (state.view !== 'record' || context.preview) return;
      entryDialog().open();
    }

    /**
     * Builds the "New stock entry" dialog once: a form for the movement and a live preview line.
     * @returns {Dialog}
     */
    function entryDialog() {
      if (state.entry) return state.entry.dialog;
      const summary = h('p', { class: 'meta', 'aria-live': 'polite' });
      const form = keep(new Form(null, {
        fieldsets: [{
          columns: 2,
          fields: {
            kind: {
              type: 'optionlist', label: 'Movement', value: 'receipt',
              options: { receipt: 'Receipt', transfer: 'Transfer', issue: 'Issue' }
            },
            date: { type: 'date', label: 'Posting date', value: new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()) },
            from: { type: 'zxselect', label: 'From warehouse', value: 'BER', props: { items: WAREHOUSES } },
            to: { type: 'zxselect', label: 'To warehouse', value: 'BER', props: { items: WAREHOUSES } },
            qty: { type: 'number', label: 'Quantity', required: true, value: 50, props: { min: 1, unit: 'pcs' } },
            rate: { type: 'number', label: 'Unit cost', props: { min: 0, step: 0.01, unit: '€' } }
          }
        }],
        onchange: () => preview()
      }));
      const dialog = keep(new Dialog(null, {
        title: 'New stock entry',
        size: 680,
        content: stack({ gap: 3, class: 'form-sheet' }, form.toElement(), summary),
        buttons: [
          { label: 'Cancel', action: 'cancel' },
          { label: 'Post entry', kind: 'primary', action: () => post() }
        ]
      }));
      dialog.on('open', () => {
        form.setValues({ kind: 'receipt', qty: 50, to: item().values.warehouse, from: item().values.warehouse, rate: item().rate }, { silent: true });
        form.clearHighlights();
        preview();
      });
      state.entry = { dialog, form, summary };
      return dialog;

      /** Enables the fields the movement uses and describes what posting will do. @returns {void} */
      function preview() {
        const { kind, from, to, qty } = form.getValues();
        form.getField('from')?.setDisabled(kind === 'receipt');
        form.getField('to')?.setDisabled(kind === 'issue');
        form.getField('rate')?.setDisabled(kind !== 'receipt');
        const amount = Number(qty) || 0;
        const level = (id) => item().stock.find((row) => row.ID === id)?.actual ?? 0;
        const parts = [];
        if (kind !== 'receipt' && amount > level(from)) {
          summary.textContent = `${warehouseName(from)} holds ${level(from)} pcs.`;
          return;
        }
        if (kind !== 'receipt') parts.push(`${warehouseName(from)}: ${level(from)} → ${level(from) - amount} pcs`);
        if (kind !== 'issue') parts.push(`${warehouseName(to)}: ${level(to)} → ${level(to) + amount} pcs`);
        summary.textContent = parts.join(' · ');
      }

      /** Validates the movement and applies it to the stock rows. @returns {void} */
      function post() {
        const { kind, from, to, qty, rate, date } = form.getValues();
        const amount = Number(qty) || 0;
        const current = item();
        const source = current.stock.find((row) => row.ID === from);
        const target = current.stock.find((row) => row.ID === to);
        if (!form.submit()) return;
        if (amount <= 0) { form.setHighlights({ qty: 'Enter a quantity above zero.' }); return; }
        if (kind === 'transfer' && from === to) { form.setHighlights({ to: 'Choose a different warehouse.' }); return; }
        if (kind !== 'receipt' && amount > source.actual) {
          form.setHighlights({ qty: `Only ${source.actual} pcs in ${warehouseName(from)}.` });
          return;
        }
        const id = nextNumber('se', 'SE-26-');
        if (kind === 'receipt') {
          const cost = Number(rate) || current.rate;
          const held = total(current, 'actual');
          current.rate = Math.round(((held * current.rate + amount * cost) / (held + amount)) * 100) / 100;
          target.actual += amount;
        } else {
          source.actual -= amount;
          if (kind === 'transfer') target.actual += amount;
        }
        current.trend[current.trend.length - 1] = total(current, 'actual');
        const where = kind === 'receipt' ? warehouseName(to)
          : kind === 'issue' ? warehouseName(from) : `${warehouseName(from)} → ${warehouseName(to)}`;
        current.documents.unshift({
          type: 'se', ID: id, date: isoDay(date instanceof Date ? date : NOW), party: where, qty: amount,
          status: kind === 'receipt' ? 'Receipt' : kind === 'issue' ? 'Issue' : 'Transfer'
        });
        const verb = { receipt: `received ${amount} pcs into ${where}`, issue: `issued ${amount} pcs from ${where}`,
          transfer: `transferred ${amount} pcs from ${warehouseName(from)} to ${warehouseName(to)}` }[kind];
        log(ME, verb, [id]);
        dialog.close();
        paintLevels();
        paintPrices();
        paintConnections();
        paintAside();
        notify(`Stock entry ${id} posted.`);
      }
    }

    /**
     * Creates a purchase order or a material request for the warehouse furthest below its reorder
     * level, or for the default warehouse when every level is met. An order counts as stock on
     * order straight away; a request only waits for approval.
     * @param {'po'|'mr'} type
     * @returns {void}
     */
    function createDocument(type) {
      const current = item();
      const settings = new Map(reorder.getData().map((row) => [row.ID, row]));
      const shortfall = (row) => (settings.get(row.ID)?.reorderLevel ?? 0) - (row.actual - row.reserved + row.ordered);
      const target = current.stock.filter((row) => shortfall(row) > 0).sort((a, b) => shortfall(b) - shortfall(a))[0]
        ?? current.stock.find((row) => row.ID === forms.inventory.getValue('warehouse')) ?? current.stock[0];
      const qty = Math.max(settings.get(target.ID)?.reorderQty || 0, current.values.minOrder || 1);
      const where = warehouseName(target.ID);
      const supplier = SUPPLIERS.find((entry) => entry.ID === current.values.supplier)?.name ?? 'the default supplier';
      const id = nextNumber(type, type === 'po' ? 'PO-26-' : 'MR-26-');
      if (type === 'po') target.ordered += qty;
      current.documents.unshift({
        type, ID: id, date: isoDay(NOW), party: type === 'po' ? supplier : where, qty, status: type === 'po' ? 'To receive' : 'Pending'
      });
      log(ME, type === 'po' ? `ordered ${qty} pcs from ${supplier} for ${where}` : `requested ${qty} pcs for ${where}`, [id]);
      paintLevels();
      paintConnections();
      notify(type === 'po' ? `Purchase order ${id} placed: ${qty} pcs for ${where}.` : `Material request ${id} raised for ${where}.`);
    }

    /**
     * Lists one type of linked document in a side sheet.
     * @param {{ID: string, label: string}} type
     * @returns {void}
     */
    function openDocuments(type) {
      if (context.preview) return;
      if (!state.documents) {
        const table = keep(new Table(null, {
          columns: [
            { id: 'ID', label: 'Document', width: '1.1fr', render: (row) => h('span', { class: 'mono' }, row.ID) },
            { id: 'date', label: 'Date', width: '0.7fr', render: (row) => formatDate(localDate(row.date), DATE.short) },
            { id: 'party', label: 'Party or warehouse', width: '2.2fr' },
            { id: 'qty', label: 'Qty', type: 'number', align: 'end', width: '0.5fr' },
            { id: 'status', label: 'Status', width: '0.9fr', render: (row) => statusText({ label: row.status, kind: STATUS_TONES[row.status] ?? 'neutral' }) }
          ],
          data: [],
          emptyText: () => emptyState({ icon: 'file-lines', title: 'Nothing linked yet', size: 'sm' })
        }));
        const sheet = keep(new Sheet(null, { side: 'end', size: 700, title: '', content: table.toElement() }));
        state.documents = { sheet, table };
      }
      const { sheet, table } = state.documents;
      sheet.setTitle(`${type.label} · ${item().code}`);
      table.setData(item().documents.filter((doc) => doc.type === type.ID));
      sheet.open();
    }

    // -------------------------------------------------------------- side column --

    /** @param {string} id Person to assign. @returns {void} */
    function assign(id) {
      item().assigned.push(id);
      log(ME, `assigned the item to ${person(id).name}`);
      paintAside();
    }

    /** @param {string} id Person to unassign. @returns {void} */
    function unassign(id) {
      item().assigned = item().assigned.filter((entry) => entry !== id);
      paintAside();
    }

    /**
     * Asks before removing an attachment.
     * @param {{id: string, name: string}} file
     * @returns {Promise<void>}
     */
    async function detach(file) {
      if (!await Dialog.confirm({
        title: 'Remove attachment?',
        message: `${file.name} will be removed from ${item().code}.`,
        okLabel: 'Remove attachment',
        danger: true
      })) return;
      item().files = item().files.filter((entry) => entry.id !== file.id);
      paintAside();
      notify(`${file.name} removed.`);
    }

    /** Posts the composer's text to the timeline. @returns {void} */
    function postComment() {
      const text = comment.value.trim();
      if (!text) return;
      log(ME, 'commented', [], text);
      comment.value = '';
      postButton.disabled = true;
    }

    // ------------------------------------------------------------------ helpers --

    /**
     * Prepends an entry to the open item's timeline.
     * @param {string} actor Person id.
     * @param {string} text What they did.
     * @param {string[]} [meta] Linked document numbers.
     * @param {string} [content] A comment's text.
     * @returns {void}
     */
    function log(actor, text, meta = [], content = undefined) {
      const entry = { id: uid('a'), at: isoMinute(NOW), actor, title: text, meta, content };
      item().activity.unshift(entry);
      timeline.prependItems(activityItem(entry));
      tabs.setBadge('activity', String(item().activity.length));
    }

    /** @param {string} id @returns {string|undefined} The visible label of a form field. */
    function fieldLabel(id) {
      for (const form of Object.values(forms)) {
        const field = form.getField(id);
        if (field) return String(field.options.label).toLowerCase();
      }
      return undefined;
    }

    /**
     * The next free number in a document series.
     * @param {string} type Document type.
     * @param {string} series Number prefix.
     * @returns {string}
     */
    function nextNumber(type, series) {
      const numbers = items.flatMap((entry) => entry.documents)
        .filter((doc) => doc.type === type).map((doc) => Number(doc.ID.slice(series.length)));
      return `${series}${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
    }

    /** @param {number} rate Selling rate. @returns {string} Margin over the valuation rate. */
    function margin(rate) {
      return formatPercent((rate - item().rate) / rate, { decimals: 1 });
    }
  }
};

/**
 * The content of one settings tab: its form, then the sections with child tables below it.
 * @param {Form} form
 * @param {...Node} sections
 * @returns {HTMLElement}
 */
function tabPanel(form, ...sections) {
  return h('div', { class: 'form-sheet form-sections inventory__tab' }, form.toElement(), sections);
}

/**
 * A section of a record tab: a heading with an optional note, actions, and description, then its
 * content. Sections are set apart by a hairline, not boxed.
 * @param {string} title
 * @param {{meta?: Node, actions?: Node|Node[], description?: string}} head
 * @param {...Node} children
 * @returns {HTMLElement}
 */
function recordSection(title, { meta, actions, description } = {}, ...children) {
  return h('section', { class: 'inventory__section' },
    h('div', { class: 'inventory__section-head' },
      h('h3', { class: 'inventory__section-title' }, title),
      meta ?? null,
      actions ? h('span', { class: 'inventory__section-actions' }, actions) : null,
      description ? h('p', { class: 'inventory__section-description meta' }, description) : null),
    children);
}

/**
 * A block of the side column: its icon and a quiet title, the action that adds to it at the far
 * end, and the block's content beneath.
 * @param {{title: string, icon: string, action?: Node|null}} head
 * @param {...Node} children
 * @returns {HTMLElement}
 */
function sideBlock({ title, icon: name, action = null }, ...children) {
  return h('section', { class: 'panel-block' },
    h('div', { class: 'inventory__block-head' },
      h('h3', { class: 'panel-block__title' }, icon(name, { size: 14 }), title), action),
    children);
}

/**
 * A stock row's bar on a scale shared by every warehouse: the available stock solid, the reserved
 * part of it lighter, and the reorder level as a tick. Stock on order is said in the Projected
 * column, and every number has a column of its own, so the bar itself is decorative.
 * @param {{actual: number, reserved: number, reorderLevel: number, scale: number}} row
 * @returns {HTMLElement}
 */
function quantityBar(row) {
  const share = (value) => `${Math.min(100, (value / row.scale) * 100)}%`;
  const reserved = Math.min(row.reserved, row.actual);
  return h('span', {
    class: 'inventory__bar',
    'aria-hidden': 'true',
    dataset: { tone: stockStatus(row).kind },
    style: {
      '--qty-available': share(row.actual - reserved),
      '--qty-reserved': share(reserved),
      '--qty-reorder': share(row.reorderLevel)
    }
  }, h('span', { class: 'inventory__bar-available' }),
  reserved ? h('span', { class: 'inventory__bar-reserved' }) : null,
  row.reorderLevel ? h('span', { class: 'inventory__bar-reorder' }) : null);
}

/**
 * The projected quantity, with the stock on order that it counts written beside it.
 * @param {{projected: number, ordered: number}} row
 * @returns {HTMLElement}
 */
function projectedCell(row) {
  return h('span', { class: 'inventory__projected' },
    row.ordered ? h('span', { class: 'meta' }, `incl. ${formatNumber(row.ordered)} on order`) : null,
    h('span', { class: 'num' }, formatNumber(row.projected)));
}

/**
 * A status in a table cell: a dot and its word. The dot repeats the word, so it is hidden.
 * @param {{label: string, kind: 'success'|'warning'|'danger'|'info'|'neutral'}} status
 * @returns {HTMLElement}
 */
function statusText({ label, kind }) {
  return h('span', { class: 'inventory__status' }, dot(kind), label);
}

/**
 * Classifies a warehouse row against its reorder level.
 * @param {{actual: number, reserved: number, ordered: number, reorderLevel: number}} row
 * @returns {{label: string, kind: 'success'|'warning'|'danger'|'neutral'}}
 */
function stockStatus(row) {
  if (row.actual === 0) return { label: row.reorderLevel ? 'Out of stock' : 'Empty', kind: row.reorderLevel ? 'danger' : 'neutral' };
  if (row.actual - row.reserved + row.ordered < row.reorderLevel) return { label: 'Reorder', kind: 'warning' };
  return { label: 'In stock', kind: 'success' };
}

/**
 * Converts a stored activity entry into ActivityList item options; the time reads relative to now.
 * @param {{id: string, at: string, actor: string, title: string, content?: string, meta?: string[]}} entry
 * @returns {import('../../src/components/activity-item/activity-item.js').ActivityItemOptions}
 */
function activityItem(entry) {
  const actor = person(entry.actor);
  const at = new Date(entry.at);
  return {
    id: entry.id,
    actor: actor.name,
    avatar: { name: actor.name, size: 'sm' },
    title: entry.title,
    content: entry.content ?? null,
    timestamp: at,
    timeLabel: formatRelativeTime(at, { now: NOW }),
    metadata: (entry.meta ?? []).map((text) => h('span', { class: 'mono' }, text)),
    kind: entry.content ? 'comment' : 'event'
  };
}

/**
 * The icon for an attachment, chosen from its file name.
 * @param {string} name
 * @returns {string}
 */
function fileIcon(name) {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'pdf') return 'file-pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return 'image';
  return 'file-lines';
}

/** @param {string} iso A calendar day, `2026-10-08`. @returns {Date} Its start in local time. */
function localDate(iso) {
  return new Date(`${iso}T00:00`);
}

/** @param {Date} date @returns {string} The calendar day as stored, `2026-10-08`. */
function isoDay(date) {
  return formatDate(date, '%Y-%m-%d');
}

/** @param {Date} date @returns {string} The moment as stored, `2026-10-08T10:30`. */
function isoMinute(date) {
  return formatDate(date, '%Y-%m-%dT%H:%M');
}

/**
 * Sums one stock column over every warehouse.
 * @param {{stock: Array<Record<string, number>>}} entry
 * @param {'actual'|'reserved'|'ordered'} key
 * @returns {number}
 */
function total(entry, key) {
  return entry.stock.reduce((sum, row) => sum + row[key], 0);
}

/** @param {string} id Warehouse id. @returns {string} Its display name. */
function warehouseName(id) {
  return WAREHOUSES.find((entry) => entry.ID === id)?.name ?? id;
}

/** @param {number} value @returns {string} A quantity in pieces. */
function pieces(value) {
  return `${formatNumber(value)} pcs`;
}

/** @param {number} value @returns {number} A round upper bound for a bar scale. */
function niceCeiling(value) {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(value, 1))) - 1) * 5;
  return Math.max(step, Math.ceil(value / step) * step);
}

/** @param {string[]} labels @returns {string} "a, b and c". */
function listOf(labels) {
  if (labels.length <= 1) return labels[0] ?? 'the item';
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}
