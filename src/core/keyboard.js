// @ts-check
const FOCUSABLE_SELECTOR = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'object', 'embed',
  '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * @typedef {Object} RovingOptions
 * @property {'vertical'|'horizontal'} [orientation='vertical'] Arrow-key axis.
 * @property {boolean} [wrap=true] Whether navigation wraps at either end.
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
 * @param {Element} container Event and query container.
 * @param {string} itemSelector Selector for roving items.
 * @param {RovingOptions} [options={}] Behavior options.
 * @returns {RovingController}
 */
export function rovingTabindex(container, itemSelector, { orientation = 'vertical', wrap = true } = {}) {
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

    const previousKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    let nextIndex = null;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = available.length - 1;
    else if (event.key === previousKey) nextIndex = index - 1;
    else if (event.key === nextKey) nextIndex = index + 1;
    if (nextIndex === null || available.length === 0) return;

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
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(() => update()) : null;
  observer?.observe(container, { childList: true, subtree: true, attributes: true });
  update();

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
