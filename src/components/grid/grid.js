import { Table } from '../table/table.js';

/** @typedef {Record<string, any>} BillingRow */
/**
 * @typedef {Object} GridOptions
 * Grid inherits its constructor options and runtime API from `Table`; this record owns the Grid
 * name in generated documentation, where the Table API is shown alongside it.
 */
/**
 * @typedef {Object} BillingFields
 * @property {string} [id='id'] Row identifier field.
 * @property {string} [parent='parent'] Parent identifier field.
 * @property {string} [item='item'] Line description field.
 * @property {string} [kind='kind'] Line-kind field (`group`/`subtotal` rows are read-only).
 * @property {string} [quantity='quantity'] Quantity field.
 * @property {string} [unit='unit'] Unit field.
 * @property {string} [unitPrice='unitPrice'] Unit-price field.
 * @property {string} [currency='currency'] Currency-code field.
 * @property {string} [total='total'] Line-total field.
 */
/**
 * @typedef {Object} BillingItemsOptions
 * @property {BillingRow[]} [data=[]] Billing rows.
 * @property {Partial<BillingFields>} [fields={}] Schema field overrides.
 * @property {Array<{value: unknown, label: string}>|Record<string, string>} [units=[]] Unit choices.
 * @property {Array<{value: unknown, label: string}>|Record<string, string>} [currencies=[]] Currency choices.
 * @property {string} [currency='EUR'] Fallback currency.
 * @property {string} [locale] Number/currency locale.
 * @property {number} [decimals=2] Currency fraction digits.
 * @property {Record<string, object>} [columnOverrides={}] Per-canonical-column overrides.
 * @property {(row: BillingRow, changes: Record<string, unknown>) => number|null|undefined} [lineTotal] Optional total calculation; defaults to quantity × unit price.
 * @property {import('../table/table.js').TableColumn[]} [columns] Complete column replacement.
 * @property {(event: CustomEvent<import('../table/table.js').TableEditCommitDetail>) => void} [oneditcommit] Caller edit listener, invoked after total calculation.
 */

/**
 * Public data grid. It deliberately inherits Table's DOM/CSS/API instead of forking the data layer.
 * @extends {Table}
 */
export class Grid extends Table {
  // The lowercase `grid()` layout factory owns `.zx-grid`; the data Grid is a Table specialization.
  static cssName = 'table';

  /**
   * Creates a generic data grid with the complete inherited Table contract.
   * @param {Element|string|null} target Grid target.
   * @param {GridOptions & import('../table/table.js').TableOptions} [options={}] Grid/Table options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /**
   * Creates an editable hierarchical billing-line grid.
   * @param {Element|string|null} target Grid target.
   * @param {BillingItemsOptions & import('../table/table.js').TableOptions} [options={}] Preset and Table overrides.
   * @returns {Grid}
   */
  static BillingItems(target, options = {}) {
    const grid = new Grid(target, billingItemsConfig(options));
    grid.el.dataset.preset = 'billing-items';
    return grid;
  }
}

/**
 * Builds the Table-compatible options behind `Grid.BillingItems()` without touching the DOM.
 * @param {BillingItemsOptions & import('../table/table.js').TableOptions} [options={}] Preset and Table overrides.
 * @returns {import('../table/table.js').TableOptions}
 */
export function billingItemsConfig(options = {}) {
  const {
    fields: requestedFields = {},
    units = [],
    currencies = [],
    currency = 'EUR',
    locale,
    decimals = 2,
    columnOverrides = {},
    lineTotal = null,
    columns: suppliedColumns,
    oneditcommit,
    rowClass,
    ...tableOptions
  } = options;
  const fields = { ...DEFAULT_FIELDS, ...requestedFields };
  const calculateLineTotal = typeof lineTotal === 'function' ? lineTotal : (row) => {
    const quantity = billingNumber(row?.[fields.quantity]);
    const price = billingNumber(row?.[fields.unitPrice]);
    return quantity !== null && price !== null ? quantity * price : null;
  };
  const columns = Array.isArray(suppliedColumns) ? suppliedColumns.map((column) => ({ ...column }))
    : billingColumns(fields, { units, currencies, currency, locale, decimals, columnOverrides });
  return {
    rowId: fields.id,
    editMode: 'cell',
    hierarchy: { parentId: fields.parent, column: fields.item, expanded: true },
    responsive: 'sm',
    ...tableOptions,
    columns,
    rowClass(row) {
      const own = isBillingLine(row, fields) ? '' : 'zx-grid-billing__summary';
      const supplied = typeof rowClass === 'function' ? rowClass(row) : '';
      return [own, supplied].filter(Boolean).join(' ');
    },
    oneditcommit(event) {
      const { row, changes } = event.detail;
      if (isBillingLine(row, fields)) {
        const next = { ...row, ...changes };
        const calculated = calculateLineTotal(next, changes);
        if (calculated !== undefined && calculated !== null && Number.isFinite(Number(calculated))) {
          changes[fields.total] = Number(calculated);
        }
      }
      oneditcommit?.(event);
    }
  };
}

/** @type {Readonly<BillingFields>} */
const DEFAULT_FIELDS = Object.freeze({
  id: 'id',
  parent: 'parent',
  item: 'item',
  kind: 'kind',
  quantity: 'quantity',
  unit: 'unit',
  unitPrice: 'unitPrice',
  currency: 'currency',
  total: 'total'
});

/**
 * Returns whether a billing row is an editable line rather than a group/subtotal.
 * @param {BillingRow} row Row.
 * @param {BillingFields} [fields=DEFAULT_FIELDS] Field map.
 * @returns {boolean}
 */
export function isBillingLine(row, fields = DEFAULT_FIELDS) {
  const kind = String(row?.[fields.kind] ?? 'line').toLowerCase();
  return !['group', 'subtotal', 'header', 'section'].includes(kind);
}

/**
 * Produces the preset columns without mutating overrides.
 * @param {BillingFields} fields Field map.
 * @param {{units: unknown, currencies: unknown, currency: string, locale?: string, decimals: number, columnOverrides: Record<string, object>}} options Formatting/editor options.
 * @returns {import('../table/table.js').TableColumn[]}
 */
export function billingColumns(fields, { units, currencies, currency, locale, decimals, columnOverrides }) {
  const editableLine = (type) => (row) => isBillingLine(row, fields) ? type : false;
  const rowCurrency = (row) => String(row?.[fields.currency] || currency);
  const rowUnit = (row) => String(row?.[fields.unit] ?? '');
  const columns = {
    item: {
      id: fields.item,
      label: 'Item',
      width: '2fr',
      sortable: true,
      editable: editableLine('text')
    },
    quantity: {
      id: fields.quantity,
      label: 'Quantity',
      width: '1fr',
      type: 'unit',
      locale,
      unit: rowUnit,
      editable: editableLine('number'),
      editorProps: { min: 0, step: 0.01 }
    },
    unit: {
      id: fields.unit,
      label: 'Unit',
      width: '.8fr',
      editable: editableLine(hasChoices(units) ? 'select' : 'text'),
      options: units
    },
    unitPrice: {
      id: fields.unitPrice,
      label: 'Unit price',
      width: '1fr',
      type: 'currency',
      locale,
      decimals,
      currency: rowCurrency,
      editable: editableLine('number'),
      editorProps: { min: 0, step: 0.01 }
    },
    currency: {
      id: fields.currency,
      label: 'Currency',
      width: '.8fr',
      editable: editableLine(hasChoices(currencies) ? 'select' : 'text'),
      options: currencies
    },
    total: {
      id: fields.total,
      label: 'Line total',
      width: '1fr',
      type: 'currency',
      locale,
      decimals,
      currency: rowCurrency
    }
  };
  return Object.entries(columns).map(([key, column]) => ({ ...column, ...(columnOverrides?.[key] ?? {}) }));
}

/** @param {unknown} value @returns {boolean} */
function hasChoices(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value && typeof value === 'object' && Object.keys(value).length);
}

/** Missing billing operands stay missing; explicit numeric zero remains a valid value. @param {unknown} value @returns {number|null} */
function billingNumber(value) {
  if (value == null || typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
