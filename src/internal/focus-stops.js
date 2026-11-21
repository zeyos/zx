// @ts-check
/**
 * Tab stops for elements that are not controls: a tab panel and a scrolling block.
 *
 * Both carry `data-zx-focus="region"` (see `styles/base.css`), so when the keyboard does reach them
 * the ring is drawn inset. These helpers decide whether the keyboard reaches them at all.
 */

/** Elements the browser puts in the Tab order without a `tabindex` of their own. */
const NATIVE_STOPS = [
  'a[href]', 'area[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'iframe',
  'object', 'embed', 'audio[controls]', 'video[controls]', 'details > summary:first-of-type',
  '[contenteditable]:not([contenteditable="false"])'
].join(',');

/** Every element that may be a Tab stop: the native ones and anything with a `tabindex`. */
const CANDIDATES = `${NATIVE_STOPS},[tabindex]`;

/**
 * Keeps a tab panel in the Tab order only while nothing inside it is a Tab stop, as the WAI-ARIA
 * tabs pattern asks: a panel holding controls hands Tab straight to its first control, and a panel
 * of plain text stays reachable from its tab so it can be read and scrolled.
 *
 * The decision is made from the markup — tab indexes, `disabled`, and `hidden`, `inert` or closed
 * `<details>` subtrees inside the panel — and from layout only while the panel is rendered, so it
 * holds for a panel that is not in the document yet. Call it whenever a panel is shown or its
 * content is replaced, and again just before focus can move from the tab list into the panel. A
 * panel that holds focus keeps its stop until a later call. Controls inside a shadow root are not
 * seen, so a panel whose only controls sit in a custom element's shadow tree stays a stop itself.
 * @param {HTMLElement} panel The `role="tabpanel"` element.
 * @returns {boolean} Whether the panel is now a Tab stop itself.
 */
export function syncPanelStop(panel) {
  const stop = !containsTabStop(panel);
  if (stop && panel.getAttribute('tabindex') !== '0') panel.tabIndex = 0;
  // A panel holding focus keeps its stop, so focus never drops to <body>; a later call settles it.
  else if (!stop && panel.hasAttribute('tabindex') && panel.ownerDocument.activeElement !== panel) {
    panel.removeAttribute('tabindex');
  }
  return stop;
}

/**
 * Whether Tab can stop anywhere inside a container.
 * @param {Element} container Container to search.
 * @returns {boolean}
 */
export function containsTabStop(container) {
  const rendered = isRendered(container);
  for (const element of container.querySelectorAll(CANDIDATES)) {
    if (isTabStop(element, container, rendered)) return true;
  }
  return false;
}

/**
 * Keeps a scrolling block in the Tab order only while its content overflows, so the keyboard can
 * scroll what the pointer can, and a block that fits is no stop at all. A block that is not laid
 * out (detached, or inside something hidden) measures nothing and is left out until it is. A
 * block holding focus keeps its stop, so a resize never drops focus; a later call settles it.
 * @param {HTMLElement} element The scrolling element.
 * @returns {boolean} Whether the element now overflows.
 */
export function syncScrollStop(element) {
  const overflowing = isOverflowing(element);
  if (overflowing && !element.hasAttribute('tabindex')) element.tabIndex = 0;
  else if (!overflowing && element.hasAttribute('tabindex') && element.ownerDocument.activeElement !== element) {
    element.removeAttribute('tabindex');
  }
  return overflowing;
}

/**
 * Whether an element's content is larger than its box on either axis.
 * @param {Element} element Element to measure.
 * @returns {boolean}
 */
export function isOverflowing(element) {
  return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
}

/**
 * @param {Element} element Candidate found by `CANDIDATES`.
 * @param {Element} container The container being searched; ancestors above it do not count.
 * @param {boolean} rendered Whether the container is laid out, so layout can be asked too.
 * @returns {boolean}
 */
function isTabStop(element, container, rendered) {
  const html = /** @type {HTMLElement} */ (element);
  if (typeof html.focus !== 'function') return false;
  const index = Number.parseInt(element.getAttribute('tabindex') ?? '', 10);
  if (Number.isNaN(index) ? !element.matches(NATIVE_STOPS) : index < 0) return false;
  if (element.matches(':disabled')) return false;
  for (let node = /** @type {Element|null} */ (element); node && node !== container; node = node.parentElement) {
    if (/** @type {HTMLElement} */ (node).hidden || node.hasAttribute('inert')) return false;
    const parent = node.parentElement;
    if (parent?.localName === 'details' && !(/** @type {HTMLDetailsElement} */ (parent).open)
      && node !== parent.querySelector(':scope > summary')) return false;
  }
  if (!rendered) return true;
  if (typeof html.checkVisibility === 'function') return html.checkVisibility({ visibilityProperty: true });
  return html.getClientRects().length > 0;
}

/** @param {Element} element @returns {boolean} Whether the element is laid out at all. */
function isRendered(element) {
  return element.isConnected && element.getClientRects().length > 0;
}
