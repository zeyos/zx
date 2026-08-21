// @ts-check
/**
 * @typedef {Object} CsvColumn
 * @property {string} id Row property read when no `value` accessor is given, and the default label.
 * @property {string} [label] Header text; defaults to `id`.
 * @property {(row: any) => unknown} [value] Accessor returning the cell value for a row.
 */

/**
 * @typedef {Object} CsvOptions
 * @property {string} [delimiter=','] Field separator; use `';'` for German Excel locales.
 * @property {boolean} [header=true] Whether to emit the header row.
 * @property {string} [newline='\r\n'] Record separator; RFC 4180 uses CRLF.
 */

/**
 * @typedef {Object} DownloadOptions
 * @property {string} [type='text/plain;charset=utf-8'] MIME type of the generated blob.
 */

/** Characters that make a spreadsheet treat a text cell as a formula. */
const FORMULA_STARTERS = ['=', '+', '-', '@'];
/** Object URLs are revoked late so the browser has started the download before they disappear. */
const REVOKE_DELAY = 1000;

/**
 * Serialises rows to RFC 4180 CSV text.
 *
 * Fields containing the delimiter, a double quote, CR, or LF are quoted with inner quotes doubled.
 * Dates become ISO strings, null and undefined become empty fields, and text that starts with
 * `=`, `+`, `-`, or `@` is prefixed with a tab so spreadsheets treat it as text rather than a
 * formula. Numbers are never prefixed, so negative amounts survive intact.
 *
 * @param {Iterable<any>|null|undefined} rows Row objects.
 * @param {Array<string|CsvColumn>} columns Column ids, or descriptors with a label and accessor.
 * @param {CsvOptions} [options={}] Serialisation options.
 * @returns {string}
 */
export function toCsv(rows, columns, options = {}) {
  const { delimiter = ',', header = true, newline = '\r\n' } = options;
  const definitions = normalizeColumns(columns);
  const lines = [];

  if (header) {
    lines.push(definitions
      .map((column) => escapeField(column.label, delimiter, needsFormulaGuard(column.label)))
      .join(delimiter));
  }
  for (const row of rows ?? []) {
    const fields = definitions.map((column) => {
      const value = typeof column.value === 'function' ? column.value(row) : readProperty(row, column.id);
      return escapeField(formatValue(value), delimiter, needsFormulaGuard(value));
    });
    lines.push(fields.join(delimiter));
  }
  return lines.join(newline);
}

/**
 * Saves data to the user's downloads through a temporary object URL and anchor click.
 * A UTF-8 BOM is prepended to CSV strings so Excel reads them as UTF-8.
 * @param {string} filename Suggested file name including its extension.
 * @param {string|Blob|ArrayBuffer|ArrayBufferView} data Payload to save.
 * @param {DownloadOptions} [options={}] Blob options.
 * @returns {void}
 */
export function downloadBlob(filename, data, options = {}) {
  const { type = 'text/plain;charset=utf-8' } = options;
  const blob = toBlob(data, type);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = String(filename ?? 'download');
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
}

/**
 * Copies text to the clipboard, falling back to a hidden textarea when the async Clipboard API is
 * unavailable or blocked. Never rejects.
 * @param {string} text Text to copy.
 * @returns {Promise<boolean>} Whether the copy succeeded.
 */
export async function copyToClipboard(text) {
  const value = String(text ?? '');
  if (globalThis.navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Denied permission or a non-secure context falls through to the legacy path.
    }
  }
  return legacyCopy(value);
}

/**
 * Copies through a hidden textarea and `document.execCommand`, restoring focus afterwards.
 * @param {string} value Text to copy.
 * @returns {boolean}
 */
function legacyCopy(value) {
  if (typeof document === 'undefined' || !document.body) return false;
  const active = document.activeElement;
  const textarea = document.createElement('textarea');

  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.cssText = 'position:fixed;inset-block-start:-1000px;opacity:0;pointer-events:none';
  document.body.append(textarea);

  let copied = false;
  try {
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    copied = document.execCommand?.('copy') === true;
  } catch {
    copied = false;
  } finally {
    textarea.remove();
    if (active instanceof HTMLElement) active.focus({ preventScroll: true });
  }
  return copied;
}

/**
 * @param {Array<string|CsvColumn>} columns Column ids or descriptors.
 * @returns {Array<{id: string, label: string, value?: (row: any) => unknown}>}
 */
function normalizeColumns(columns) {
  return (columns ?? []).map((column) => {
    if (typeof column === 'string') return { id: column, label: column };
    const id = String(column?.id ?? '');
    return { id, label: String(column?.label ?? id), value: column?.value };
  });
}

/** @param {any} row @param {string} id @returns {unknown} */
function readProperty(row, id) {
  return row == null ? undefined : row[id];
}

/**
 * Converts a cell value to its CSV text form.
 * @param {unknown} value Cell value.
 * @returns {string}
 */
function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Reports whether a value is text that a spreadsheet could execute as a formula.
 * @param {unknown} value Cell value.
 * @returns {boolean}
 */
function needsFormulaGuard(value) {
  if (typeof value !== 'string') return false;
  return FORMULA_STARTERS.includes(value.charAt(0));
}

/**
 * @param {string} field Text form of a cell.
 * @param {string} delimiter Active field separator.
 * @param {boolean} [guard=false] Whether to defuse a leading formula character.
 * @returns {string}
 */
function escapeField(field, delimiter, guard = false) {
  const text = guard ? `\t${field}` : field;
  const mustQuote = text.includes(delimiter) || text.includes('"') ||
    text.includes('\n') || text.includes('\r');
  return mustQuote ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * @param {string|Blob|ArrayBuffer|ArrayBufferView} data Payload.
 * @param {string} type MIME type.
 * @returns {Blob}
 */
function toBlob(data, type) {
  if (typeof Blob === 'function' && data instanceof Blob) return data;
  // Excel only recognises UTF-8 CSV when the file opens with a byte-order mark.
  const parts = /** @type {BlobPart[]} */ (
    typeof data === 'string' && /^text\/csv\b/i.test(type) ? ['\uFEFF', data] : [data]
  );
  return new Blob(parts, { type });
}
