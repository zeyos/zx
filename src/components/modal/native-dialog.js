/*
 * The platform calls the overlays are built on, each behind a support check. Where a method is
 * missing — a DOM implementation used for unit tests, such as jsdom, has `<dialog>` but neither
 * `showModal()` nor `showPopover()` — the overlay falls back to the `open` attribute, which is what
 * the stylesheet and `isOpen()` read either way. The fallback has no top layer, no inertness and
 * no backdrop; it keeps the lifecycle (`open`, `close`, the result, `destroy()`) working.
 */

/**
 * Asks a state pseudo-class of an element. A selector engine that does not know `:modal` or
 * `:popover-open` throws on it; there the element is in neither state.
 * @param {Element|null|undefined} element Element to ask.
 * @param {string} selector A selector such as `':modal'` or `':popover-open'`.
 * @returns {boolean}
 */
export function matchesState(element, selector) {
  if (!element || typeof element.matches !== 'function') return false;
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

/**
 * The open modal dialogs of a document, in document order; empty where `:modal` is unknown.
 * @param {Document} doc Document to search.
 * @returns {Element[]}
 */
export function modalDialogs(doc) {
  try {
    return Array.from(doc.querySelectorAll('dialog:modal'));
  } catch {
    return [];
  }
}

/**
 * Whether a dialog is presented, by the reflected `open` property or the attribute itself.
 * @param {Element} dialog Dialog element.
 * @returns {boolean}
 */
export function isDialogOpen(dialog) {
  return Boolean(/** @type {HTMLDialogElement} */ (dialog).open) || dialog.hasAttribute('open');
}

/**
 * Presents a dialog modally with `showModal()`, or with the `open` attribute where it is missing.
 * @param {Element} dialog Dialog element.
 * @returns {boolean} Whether the platform presented it; false for the attribute fallback.
 */
export function showDialogModal(dialog) {
  const element = /** @type {HTMLDialogElement} */ (dialog);
  if (typeof element.showModal === 'function') {
    element.showModal();
    return true;
  }
  element.setAttribute('open', '');
  return false;
}

/**
 * Presents a dialog non-modally with `show()`, or with the `open` attribute where it is missing.
 * @param {Element} dialog Dialog element.
 * @returns {void}
 */
export function showDialog(dialog) {
  const element = /** @type {HTMLDialogElement} */ (dialog);
  if (typeof element.show === 'function') element.show();
  else element.setAttribute('open', '');
}

/**
 * Closes a dialog with `close()`. Where it is missing the `open` attribute is removed and the
 * `close` event the platform would queue is queued here, so one listener settles both.
 * @param {Element} dialog Dialog element.
 * @param {string} [result] Native string return value.
 * @returns {void}
 */
export function closeDialog(dialog, result) {
  const element = /** @type {HTMLDialogElement} */ (dialog);
  if (typeof element.close === 'function') {
    if (result === undefined) element.close();
    else element.close(result);
    return;
  }
  if (!isDialogOpen(element)) return;
  if (result !== undefined) element.returnValue = String(result);
  element.removeAttribute('open');
  queueMicrotask(() => element.dispatchEvent(new Event('close')));
}
