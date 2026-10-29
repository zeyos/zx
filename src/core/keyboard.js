// @ts-check
const FOCUSABLE_SELECTOR = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'object', 'embed',
  '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])'
].join(',');

/** Attributes that change whether a roving item is available; nothing else is observed. */
const AVAILABILITY_ATTRIBUTES = ['hidden', 'disabled', 'aria-disabled', 'aria-hidden'];
/** `<input>` types without a caret, which a roving group may move focus away from freely. */
const CARETLESS_INPUT_TYPES = new Set(['button', 'checkbox', 'color', 'file', 'image', 'reset', 'submit']);

/**
 * @typedef {Object} RovingOptions
 * @property {'vertical'|'horizontal'} [orientation='vertical'] Arrow-key axis.
 * @property {boolean} [wrap=true] Whether navigation wraps at either end.
 * @property {'auto'|boolean} [rtl='auto'] Whether ArrowLeft and ArrowRight swap meaning in a
 *   horizontal group. `'auto'` reads the container's computed `direction` on every key press, so
 *   a group inside `dir="rtl"` moves to the visually next item; `true`/`false` force it.
 */
/**
 * @typedef {Object} FocusTrapController
 * @property {() => void} activate Activate the focus trap.
 * @property {() => void} deactivate Deactivate the focus trap and restore focus.
 */
/**
 * @typedef {Object} RovingController
 * @property {() => void} focusFirst Focus the first item.
 * @property {() => void} focusLast Focus the last item.
 * @property {() => void} destroy Remove behavior and restore tabindex values.
 */

/**
 * Creates a focus trap that cycles Tab focus within a container while active.
 * @param {Element} container Focus boundary.
 * @returns {FocusTrapController}
 */
export function focusTrap(container) {
  let active = false;
  let previousFocus = null;

  /** @returns {void} */
  function onKeydown(event) {
    if (event.key !== 'Tab') return;
    const items = focusableItems(container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  return {
    /** Activates trapping and focuses the first focusable descendant. @returns {void} */
    activate() {
      if (active) return;
      active = true;
      previousFocus = document.activeElement;
      document.addEventListener('keydown', onKeydown);
      focusableItems(container)[0]?.focus();
    },

    /** Deactivates trapping and restores focus when possible. @returns {void} */
    deactivate() {
      if (!active) return;
      active = false;
      document.removeEventListener('keydown', onKeydown);
      if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
      previousFocus = null;
    }
  };
}

/**
 * Applies the ARIA roving-tabindex keyboard pattern to matching descendants.
 *
 * Editable items keep the keys they need, as the APG toolbar pattern asks: Home and End always
 * stay with a text field, select, or contenteditable region, and so do the arrow keys — except
 * that a text field whose caret already sits at the edge the arrow points past hands focus on to
 * the neighbouring item, so a reader is never trapped in it. Under `dir="rtl"` the horizontal
 * arrows follow the visual order.
 *
 * The group re-reads its items when children are added or removed and when an item's
 * availability attributes (`hidden`, `disabled`, `aria-disabled`, `aria-hidden`) change; its own
 * `tabindex` writes and unrelated attribute churn inside the items are not observed.
 * @param {Element} container Event and query container.
 * @param {string} itemSelector Selector for roving items.
 * @param {RovingOptions} [options={}] Behavior options.
 * @returns {RovingController}
 */
export function rovingTabindex(container, itemSelector, { orientation = 'vertical', wrap = true, rtl = 'auto' } = {}) {
  const controller = new AbortController();
  const originals = new Map();
  let destroyed = false;

  /** @returns {HTMLElement[]} */
  function items() {
    return /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll(itemSelector)))
      .filter((item) => {
        remember(item);
        return isAvailable(item);
      });
  }

  /** @param {HTMLElement} item @returns {void} */
  function remember(item) {
    if (!originals.has(item)) originals.set(item, item.getAttribute('tabindex'));
  }

  /** @param {HTMLElement|null} selected @returns {void} */
  function update(selected = null) {
    const available = items();
    const active = selected && available.includes(selected) ? selected :
      available.find((item) => item.tabIndex === 0) ?? available[0];
    for (const item of available) {
      const tabindex = item === active ? 0 : -1;
      if (item.tabIndex !== tabindex) item.tabIndex = tabindex;
    }
  }

  /** @param {KeyboardEvent} event @returns {void} */
  function onKeydown(event) {
    const available = items();
    const current = /** @type {HTMLElement|null} */ (
      /** @type {Element|null} */ (event.target)?.closest?.(itemSelector) ?? null
    );
    const index = available.indexOf(current);
    if (index < 0) return;

    const reversed = orientation === 'horizontal' && isRightToLeft(container, rtl);
    const step = rovingStep(event.key, orientation, reversed);
    if (step === null) return;
    if (!editableAllowsRoving(/** @type {Element|null} */ (event.target), step)) return;
    let nextIndex = step === 'first' ? 0 : step === 'last' ? available.length - 1
      : step === 'previous' ? index - 1 : index + 1;
    if (available.length === 0) return;

    if (wrap) nextIndex = (nextIndex + available.length) % available.length;
    else nextIndex = Math.max(0, Math.min(available.length - 1, nextIndex));
    event.preventDefault();
    update(available[nextIndex]);
    available[nextIndex].focus();
  }

  /** @param {FocusEvent} event @returns {void} */
  function onFocus(event) {
    const item = /** @type {HTMLElement|null} */ (
      /** @type {Element|null} */ (event.target)?.closest?.(itemSelector) ?? null
    );
    if (item && container.contains(item)) update(item);
  }

  container.addEventListener('keydown', onKeydown, { signal: controller.signal });
  container.addEventListener('focusin', onFocus, { signal: controller.signal });
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver((records) => { if (records.some(concernsItems)) update(); })
    : null;
  observer?.observe(container, {
    childList: true, subtree: true, attributes: true, attributeFilter: AVAILABILITY_ATTRIBUTES
  });
  update();

  /**
   * Whether a mutation can change the item set: an item's availability attribute, or an added or
   * removed subtree that is, holds, or held an item. Content churn inside an item is ignored.
   * @param {MutationRecord} record Observed mutation.
   * @returns {boolean}
   */
  function concernsItems(record) {
    if (record.type === 'attributes') {
      return record.target instanceof Element && record.target.matches(itemSelector);
    }
    for (const node of record.addedNodes) {
      if (node instanceof Element && (node.matches(itemSelector) || node.querySelector(itemSelector))) return true;
    }
    for (const node of record.removedNodes) {
      if (!(node instanceof Element)) continue;
      if (originals.has(/** @type {HTMLElement} */ (node))) return true;
      for (const item of originals.keys()) if (node.contains(item)) return true;
    }
    return false;
  }

  return {
    /** Focuses the first available item. @returns {void} */
    focusFirst() {
      const first = items()[0];
      if (first) {
        update(first);
        first.focus();
      }
    },

    /** Focuses the last available item. @returns {void} */
    focusLast() {
      const available = items();
      const last = available[available.length - 1];
      if (last) {
        update(last);
        last.focus();
      }
    },

    /** Removes behavior and restores original tabindex attributes. @returns {void} */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      observer?.disconnect();
      for (const [item, tabindex] of originals) {
        if (tabindex === null) item.removeAttribute('tabindex');
        else item.setAttribute('tabindex', tabindex);
      }
      originals.clear();
    }
  };
}

/**
 * Where focus sat inside one keyed item of a collection, recorded before the collection re-renders.
 * @typedef {Object} ItemFocusMemo
 * @property {unknown} key The item's key.
 * @property {boolean} self Whether the item element itself held focus.
 * @property {number} index Position of the focused control among the item's focusable controls.
 * @property {string} signature Tag, data attributes, and name of the focused control, which
 *   identify its replacement after a rebuild.
 */

/**
 * Records which control of which keyed item holds focus, so a collection that rebuilds an item
 * can put focus back on the equivalent control afterwards. Returns null when focus is elsewhere.
 * @param {Element} root Collection root.
 * @param {(element: Element) => ({key: unknown, element: Element}|null)} locate Finds the keyed
 *   item an element belongs to.
 * @returns {ItemFocusMemo|null}
 */
export function captureItemFocus(root, locate) {
  const active = root?.ownerDocument?.activeElement ?? null;
  if (!active || active === root || !root.contains(active)) return null;
  const item = locate(active);
  if (!item) return null;
  const controls = itemControls(item.element);
  return {
    key: item.key,
    self: active === item.element,
    index: controls.indexOf(/** @type {HTMLElement} */ (active)),
    signature: controlSignature(active)
  };
}

/**
 * Puts focus back on the control a {@link captureItemFocus} memo describes, unless focus is still
 * on a live element inside the collection (nothing was lost). The replacement is the control with
 * the same signature, else the one at the same position, else the item's last control, else the
 * item itself when it is focusable. Scrolling is suppressed: the reader did not move.
 * @param {Element} root Collection root.
 * @param {ItemFocusMemo|null} memo Recorded focus.
 * @param {(key: unknown) => Element|null} resolve Finds the item element for a key after the update.
 * @returns {boolean} Whether focus was moved.
 */
export function restoreItemFocus(root, memo, resolve) {
  if (!memo || !root) return false;
  const active = root.ownerDocument?.activeElement ?? null;
  if (active && active !== root.ownerDocument?.body && active.isConnected && root.contains(active)) return false;
  const element = resolve(memo.key);
  if (!element) return false;
  const controls = itemControls(element);
  const target = memo.self ? /** @type {HTMLElement} */ (element)
    : controls.find((control) => controlSignature(control) === memo.signature)
      ?? controls[memo.index] ?? controls.at(-1) ?? null;
  if (!target || typeof target.focus !== 'function') return false;
  target.focus({ preventScroll: true });
  return root.ownerDocument?.activeElement === target;
}

/** @param {Element} element @returns {HTMLElement[]} Focusable, enabled controls inside an item. */
function itemControls(element) {
  return /** @type {HTMLElement[]} */ (Array.from(element.querySelectorAll(`${FOCUSABLE_SELECTOR},[tabindex="-1"]`)))
    .filter((control) => isAvailable(control));
}

/** @param {Element} element @returns {string} A rebuild-stable description of a control. */
function controlSignature(element) {
  const data = Object.entries(/** @type {HTMLElement} */ (element).dataset ?? {})
    .map(([name, value]) => `${name}=${value}`).sort().join('&');
  const name = element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '';
  return `${element.tagName}|${data}|${name}`;
}

/**
 * Creates a 500 ms buffered, case-insensitive first-letter typeahead handler.
 * @template T
 * @param {() => T[]} getItems Returns current candidate items.
 * @param {(item: T, index: number) => void} onMatch Called for the first prefix match.
 * @returns {(event: KeyboardEvent|string) => void}
 */
export function typeahead(getItems, onMatch) {
  let buffer = '';
  let timer = null;

  return function handleTypeahead(event) {
    const key = typeof event === 'string' ? event : event.key;
    if (typeof event !== 'string' && (event.ctrlKey || event.metaKey || event.altKey)) return;
    if (!key || key.length !== 1 || /\s/.test(key)) return;

    if (timer !== null) clearTimeout(timer);
    buffer += key.toLocaleLowerCase();
    if (buffer.split('').every((character) => character === buffer[0])) buffer = buffer[0];
    timer = setTimeout(() => {
      buffer = '';
      timer = null;
    }, 500);

    const candidates = getItems();
    const index = candidates.findIndex((item) => itemText(item).startsWith(buffer));
    if (index >= 0) onMatch(candidates[index], index);
  };
}

/**
 * Maps a key to a roving step, or null for a key the group does not handle.
 * @param {string} key `KeyboardEvent.key`.
 * @param {'vertical'|'horizontal'} orientation Arrow-key axis.
 * @param {boolean} reversed Whether the horizontal arrows are swapped (right-to-left).
 * @returns {'first'|'last'|'previous'|'next'|null}
 */
export function rovingStep(key, orientation, reversed = false) {
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  if (orientation === 'horizontal') {
    if (key === 'ArrowLeft') return reversed ? 'next' : 'previous';
    if (key === 'ArrowRight') return reversed ? 'previous' : 'next';
    return null;
  }
  if (key === 'ArrowUp') return 'previous';
  if (key === 'ArrowDown') return 'next';
  return null;
}

/**
 * Whether an element takes keyboard text input, so that arrow keys and Home/End move its caret
 * or its value: a text-like `<input>`, `<textarea>`, `<select>`, or a contenteditable region.
 * @param {Element|null} element Candidate, normally a key event's target.
 * @returns {boolean}
 */
export function isEditableTarget(element) {
  if (!element || typeof element !== 'object') return false;
  const tag = String(element.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    return !CARETLESS_INPUT_TYPES.has(String(/** @type {HTMLInputElement} */ (element).type ?? 'text').toLowerCase());
  }
  return Boolean(/** @type {HTMLElement} */ (element).isContentEditable);
}

/**
 * Whether a roving step may leave the event target. Non-editable targets always may. An editable
 * one keeps Home/End, and keeps the arrows unless it is a single-line text field whose collapsed
 * caret already sits at the edge the step points past: position 0 for `previous`, the end of the
 * value for `next`. The steps are logical, so under right-to-left the caret check still matches
 * the direction the caret would have moved.
 * @param {Element|null} target Key event target.
 * @param {'first'|'last'|'previous'|'next'} step Roving step.
 * @returns {boolean}
 */
export function editableAllowsRoving(target, step) {
  if (!isEditableTarget(target)) return true;
  if (step === 'first' || step === 'last') return false;
  if (String(target?.tagName ?? '').toUpperCase() !== 'INPUT') return false;
  const input = /** @type {HTMLInputElement} */ (target);
  let start;
  let end;
  try {
    start = input.selectionStart;
    end = input.selectionEnd;
  } catch {
    return false;
  }
  // Types without a selection API (number, date, range …) own their arrows outright.
  if (typeof start !== 'number' || typeof end !== 'number' || start !== end) return false;
  return step === 'previous' ? start === 0 : end === String(input.value ?? '').length;
}

/**
 * @param {Element} container Group container.
 * @param {'auto'|boolean} rtl Configured direction handling.
 * @returns {boolean}
 */
function isRightToLeft(container, rtl) {
  if (rtl === true || rtl === false) return rtl;
  try {
    return globalThis.getComputedStyle?.(container)?.direction === 'rtl';
  } catch {
    return false;
  }
}

/** @param {Element} container @returns {HTMLElement[]} */
function focusableItems(container) {
  return /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)))
    .filter((item) => isAvailable(item) && item.getClientRects().length > 0);
}

/** @param {Element} item @returns {item is HTMLElement} */
function isAvailable(item) {
  if (!(item instanceof HTMLElement)) return false;
  if (item.hidden || item.getAttribute('aria-hidden') === 'true' || item.matches(':disabled')) return false;
  return true;
}

/** @param {unknown} item @returns {string} */
function itemText(item) {
  if (typeof item === 'string' || typeof item === 'number') return String(item).trim().toLocaleLowerCase();
  if (item && typeof item === 'object' && 'textContent' in item) {
    return String(item.textContent ?? '').trim().toLocaleLowerCase();
  }
  if (item && typeof item === 'object') {
    const shape = /** @type {{label?: unknown, text?: unknown, value?: unknown}} */ (item);
    const value = shape.label ?? shape.text ?? shape.value;
    if (value != null) return String(value).trim().toLocaleLowerCase();
  }
  return String(item ?? '').trim().toLocaleLowerCase();
}
