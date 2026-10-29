// @ts-check

/**
 * The overlay kernel: one z-order, one registry of open overlays, and one document-level
 * dispatcher for Escape, outside presses, and focus leaving an overlay.
 *
 * Before it, every overlay counted its own order and listened to the document itself, and none of
 * them knew about the others: a non-modal Sheet closed itself when an item was chosen in a menu it
 * had opened, and one Escape closed a sheet while leaving its dropdown stranded on a hidden anchor.
 * Here each open overlay is one entry, and two rules decide everything:
 *
 * - **Escape goes to one layer.** The topmost entry that handles Escape gets it, and only that
 *   one. An event that arrives `defaultPrevented` was already spent by something inside (a Select
 *   closing its own list) and reaches no overlay at all. A modal `<dialog>` handles Escape natively,
 *   so reaching one stops the search without touching the event.
 * - **Inside means inside the opener chain.** Each entry records the overlay its anchor sits in as
 *   its parent. A press inside a popup anchored from within a sheet is therefore inside the sheet,
 *   wherever in the DOM the popup's panel lives; a press outside both dismisses both.
 *
 * Closing an entry also closes the entries opened from it that asked to follow their parent, so a
 * sheet never leaves a dropdown open on an element that is no longer on screen.
 *
 * The document listeners exist only while at least one overlay is open, and go away with the last
 * one through a single AbortController.
 */

/**
 * What kind of layer an entry is.
 *
 * - `modal` — a `showModal()` dialog. Escape and the backdrop belong to the browser, and nothing
 *   below a modal reacts to presses or keys.
 * - `non-modal` — a dialog that leaves the page live (a floating non-modal Sheet).
 * - `popup` — an anchored panel: a Dropdown, a menu, a flyout.
 * - `tooltip` — a description bubble. Any press outside it dismisses it, whatever lies above, and
 *   it is never anybody's parent.
 * - `toast` — a message region. It never takes Escape and is never a parent, and a press inside one
 *   dismisses nothing, so acting on a toast does not close the drawer it reports on.
 * @typedef {'modal'|'non-modal'|'popup'|'tooltip'|'toast'} OverlayKind
 */

/**
 * @typedef {Object} OverlayEntryOptions
 * @property {OverlayKind} kind Layer kind.
 * @property {Element} root The overlay's own root: the panel, dialog, or region.
 * @property {unknown} [owner=null] Component that owns the entry; informational.
 * @property {Element|null|Array<Element|null|undefined>} [anchor=null] Element(s) the overlay was
 *   opened from or is anchored to. The topmost entry whose root contains one becomes the parent.
 * @property {Array<Element|null|undefined>} [inside=[]] Further elements that count as part of the
 *   overlay for outside presses and focus — a dropdown's trigger, which toggles it on its own.
 * @property {(event: KeyboardEvent, handle: OverlayHandle) => boolean|void} [onEscape] Handles an
 *   Escape routed to this entry. Return `false` to decline, which passes it to the next layer down.
 *   The dispatcher calls `preventDefault()` on an Escape an entry handled.
 * @property {(event: Event, handle: OverlayHandle) => void} [onOutsidePointer] Called for a press
 *   outside the entry's chain, while nothing above it contained the press.
 * @property {(event: FocusEvent, handle: OverlayHandle) => void} [onFocusOutside] Called when focus
 *   moves to an element outside the entry's chain.
 * @property {(handle: OverlayHandle) => void} [onParentClose] Called when the parent entry closes.
 *   An entry without it outlives its parent and is re-parented to the grandparent.
 */

/**
 * One registered overlay, as the stack keeps it.
 * @typedef {Object} OverlayEntry
 * @property {number} order Z-order; higher is on top. Unique and increasing, never reused.
 * @property {OverlayKind} kind Layer kind.
 * @property {Element} root Overlay root.
 * @property {unknown} owner Owning component.
 * @property {Element[]} anchors Anchor elements.
 * @property {Element[]} inside Extra elements that count as inside.
 * @property {OverlayEntry|null} parent Overlay the anchor sat in when the entry opened.
 * @property {OverlayEntryOptions['onEscape']} [onEscape] Escape handler.
 * @property {OverlayEntryOptions['onOutsidePointer']} [onOutsidePointer] Outside-press handler.
 * @property {OverlayEntryOptions['onFocusOutside']} [onFocusOutside] Focus-outside handler.
 * @property {OverlayEntryOptions['onParentClose']} [onParentClose] Parent-close handler.
 */

/**
 * Returned by `push()`: the owner's grip on its entry.
 * @typedef {Object} OverlayHandle
 * @property {OverlayEntry} entry The registered entry.
 * @property {number} order The entry's z-order, for `data-zx-overlay-order`.
 * @property {() => boolean} isOpen Whether the entry is still registered.
 * @property {() => boolean} isTopmost Whether no other entry (toasts aside) sits above it.
 * @property {(node: Node|null|undefined) => boolean} contains Whether a node is inside the entry's
 *   chain: its root, its `inside` elements, or any overlay opened from it.
 * @property {() => void} release Unregisters the entry and closes the children that follow it.
 *   Safe to call repeatedly.
 */

/** Kinds that can never contain another overlay's anchor. */
const LEAF_KINDS = new Set(['tooltip', 'toast']);

/**
 * Whether `node` is `root` or inside it, crossing shadow roots.
 * @param {Node|null|undefined} root Container.
 * @param {Node|null|undefined} node Candidate.
 * @returns {boolean}
 */
export function containsNode(root, node) {
  if (!root || !node) return false;
  for (let current = /** @type {any} */ (node); current; current = current.parentNode ?? current.host ?? null) {
    if (current === root) return true;
  }
  return false;
}

/**
 * The entry an overlay opened from `anchors` belongs under: the topmost one whose root contains an
 * anchor. Tooltips and toasts are never parents.
 * @param {readonly OverlayEntry[]} entries Registered entries, bottom to top.
 * @param {readonly Element[]} anchors Anchor elements of the overlay being opened.
 * @returns {OverlayEntry|null}
 */
export function findParent(entries, anchors) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (LEAF_KINDS.has(entry.kind)) continue;
    if (anchors.some((anchor) => containsNode(entry.root, anchor))) return entry;
  }
  return null;
}

/**
 * Whether a node is inside an entry's chain: its root, its `inside` elements, or — recursively —
 * any entry whose parent it is.
 * @param {readonly OverlayEntry[]} entries Registered entries.
 * @param {OverlayEntry} entry Entry to test.
 * @param {Node|null|undefined} node Candidate.
 * @returns {boolean}
 */
export function insideChain(entries, entry, node) {
  if (!node) return false;
  if (containsNode(entry.root, node)) return true;
  if (entry.inside.some((element) => containsNode(element, node))) return true;
  return entries.some((candidate) => candidate.parent === entry && insideChain(entries, candidate, node));
}

/**
 * The topmost entry, toasts aside, optionally narrowed by a predicate.
 * @param {readonly OverlayEntry[]} entries Registered entries, bottom to top.
 * @param {(entry: OverlayEntry) => boolean} [filter] Extra condition.
 * @returns {OverlayEntry|null}
 */
export function topmostEntry(entries, filter = () => true) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.kind !== 'toast' && filter(entry)) return entry;
  }
  return null;
}

/**
 * The entries an Escape may be offered to, in the order they are asked: from the top down, those
 * with an Escape handler, stopping at the first modal (whose Escape is the browser's).
 *
 * `within` is the open modal dialog the key was pressed in, when there is one. Everything outside
 * it is inert, so an entry whose root lies outside it is never offered the key — which keeps a
 * modal the stack does not know about (a `<dialog>` an application opened with `showModal()`)
 * from losing its Escape to a popup left open behind it.
 * @param {readonly OverlayEntry[]} entries Registered entries, bottom to top.
 * @param {Node|null} [within=null] Open modal dialog containing the key's target.
 * @returns {OverlayEntry[]}
 */
export function escapeCandidates(entries, within = null) {
  const candidates = [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.kind === 'modal') break;
    if (within && !containsNode(within, entry.root)) continue;
    if (typeof entry.onEscape === 'function') candidates.push(entry);
  }
  return candidates;
}

/**
 * The entries a press on `node` dismisses, topmost first.
 *
 * A press inside a toast dismisses nothing. Tooltips go on any press outside them. For the rest,
 * the walk runs from the top down and stops at the first entry whose chain contains the press — it
 * landed on that layer, and the layers beneath are covered by it or own it — or at a modal, below
 * which everything is inert. Every entry passed on the way that handles outside presses is
 * dismissed. As for Escape, a press inside an open modal dialog dismisses nothing outside it.
 * @param {readonly OverlayEntry[]} entries Registered entries, bottom to top.
 * @param {Node|null|undefined} node Press target.
 * @param {Node|null} [within=null] Open modal dialog containing the press.
 * @returns {OverlayEntry[]}
 */
export function outsideTargets(entries, node, within = null) {
  if (entries.some((entry) => entry.kind === 'toast' && containsNode(entry.root, node))) return [];
  const targets = [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.kind === 'tooltip') {
      if (!insideChain(entries, entry, node) && entry.onOutsidePointer) targets.push(entry);
    }
  }
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (LEAF_KINDS.has(entry.kind)) continue;
    if (insideChain(entries, entry, node)) break;
    if (entry.kind === 'modal') break;
    if (within && !containsNode(within, entry.root)) continue;
    if (entry.onOutsidePointer) targets.push(entry);
  }
  return targets;
}

/**
 * A registry of open overlays. The library uses the one shared instance, `overlayStack`; separate
 * instances exist for tests and for documents other than the global one.
 */
export class OverlayStack {
  /** @type {OverlayEntry[]} Bottom to top. */
  #entries = [];
  #order = 0;
  /** @type {AbortController|null} */
  #listening = null;
  /** @type {Set<(entries: readonly OverlayEntry[]) => void>} */
  #listeners = new Set();
  /** @type {EventTarget|null} */
  #target;
  /** @type {WeakMap<OverlayEntry, OverlayHandle>} */
  #handles = new WeakMap();

  /**
   * @param {{target?: EventTarget|null}} [options={}] Where to listen; the global document when
   *   omitted. Pass `null` to install no listeners and drive the dispatch methods directly.
   */
  constructor(options = {}) {
    this.#target = options.target === undefined
      ? (typeof document === 'undefined' ? null : document)
      : options.target;
  }

  /**
   * Registers an open overlay above every other.
   * @param {OverlayEntryOptions} options Entry description.
   * @returns {OverlayHandle}
   */
  push(options) {
    const anchors = toList(options.anchor);
    /** @type {OverlayEntry} */
    const entry = {
      order: ++this.#order,
      kind: options.kind,
      root: options.root,
      owner: options.owner ?? null,
      anchors,
      inside: toList(options.inside),
      parent: options.kind === 'toast' ? null : findParent(this.#entries, anchors),
      onEscape: options.onEscape,
      onOutsidePointer: options.onOutsidePointer,
      onFocusOutside: options.onFocusOutside,
      onParentClose: options.onParentClose
    };
    this.#entries.push(entry);
    /** @type {OverlayHandle} */
    const handle = {
      entry,
      order: entry.order,
      isOpen: () => this.#entries.includes(entry),
      isTopmost: () => topmostEntry(this.#entries) === entry,
      contains: (node) => this.#entries.includes(entry) && insideChain(this.#entries, entry, node),
      release: () => this.#release(entry)
    };
    this.#handles.set(entry, handle);
    this.#listen();
    this.#notify();
    return handle;
  }

  /**
   * The registered entries, bottom to top. A copy: changing it changes nothing.
   * @returns {OverlayEntry[]}
   */
  entries() {
    return this.#entries.slice();
  }

  /**
   * The topmost entry, toasts aside.
   * @param {(entry: OverlayEntry) => boolean} [filter] Extra condition.
   * @returns {OverlayEntry|null}
   */
  topmost(filter) {
    return topmostEntry(this.#entries, filter);
  }

  /**
   * Root of the topmost open modal dialog, or null when none is open. Asks the registry first and
   * falls back to the document, so a `<dialog>` opened with `showModal()` outside the library still
   * counts.
   * @returns {Element|null}
   */
  topmostModal() {
    const entry = topmostEntry(this.#entries, (candidate) => candidate.kind === 'modal'
      && candidate.root.isConnected && matches(candidate.root, ':modal', true));
    if (entry) return entry.root;
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return null;
    let modals;
    try {
      modals = document.querySelectorAll('dialog:modal');
    } catch {
      return null;
    }
    return modals.length ? modals[modals.length - 1] : null;
  }

  /**
   * Whether a node is inside any registered overlay's root or `inside` elements.
   * @param {Node|null|undefined} node Candidate.
   * @returns {boolean}
   */
  containsNode(node) {
    return this.#entries.some((entry) => containsNode(entry.root, node)
      || entry.inside.some((element) => containsNode(element, node)));
  }

  /**
   * Subscribes to registry changes: called after every push and release.
   * @param {(entries: readonly OverlayEntry[]) => void} listener Change listener.
   * @returns {() => void} Unsubscribes.
   */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  /**
   * Routes an Escape keydown to the topmost layer that handles it. Ignores other keys and events
   * already `defaultPrevented`. Installed on the document while overlays are open; public so a
   * stack created without a target can be driven directly.
   * @param {KeyboardEvent} event Keydown event.
   * @returns {OverlayEntry|null} The entry that handled it.
   */
  handleKeydown(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return null;
    for (const entry of escapeCandidates(this.#entries, modalAround(eventNode(event)))) {
      const handle = this.#handles.get(entry);
      if (!handle || !this.#entries.includes(entry)) continue;
      if (entry.onEscape?.(event, handle) === false) continue;
      event.preventDefault();
      return entry;
    }
    return null;
  }

  /**
   * Dismisses the layers a press landed outside of. Installed on the document, capture phase, while
   * overlays are open; public so a stack created without a target can be driven directly.
   * @param {Event} event Pointerdown event.
   * @returns {OverlayEntry[]} The entries asked to dismiss, topmost first.
   */
  handlePointerdown(event) {
    const node = eventNode(event);
    const targets = outsideTargets(this.#entries, node, modalAround(node));
    for (const entry of targets) {
      const handle = this.#handles.get(entry);
      if (handle && this.#entries.includes(entry)) entry.onOutsidePointer?.(event, handle);
    }
    return targets;
  }

  /**
   * Tells the entries that watch focus that it moved outside them.
   * @param {FocusEvent} event Focusin event.
   * @returns {void}
   */
  handleFocusin(event) {
    const node = eventNode(event);
    for (const entry of this.#entries.slice().reverse()) {
      if (typeof entry.onFocusOutside !== 'function' || !this.#entries.includes(entry)) continue;
      if (insideChain(this.#entries, entry, node)) continue;
      const handle = this.#handles.get(entry);
      if (handle) entry.onFocusOutside(event, handle);
    }
  }

  /** @param {OverlayEntry} entry @returns {void} */
  #release(entry) {
    const index = this.#entries.indexOf(entry);
    if (index < 0) return;
    this.#entries.splice(index, 1);
    const children = this.#entries.filter((candidate) => candidate.parent === entry);
    // Re-parented first, so a child that outlives its parent is still in somebody's chain.
    for (const child of children) child.parent = entry.parent;
    if (this.#entries.length === 0) this.#unlisten();
    this.#notify();
    for (const child of children.reverse()) {
      const handle = this.#handles.get(child);
      if (handle && this.#entries.includes(child)) child.onParentClose?.(handle);
    }
  }

  /** @returns {void} */
  #listen() {
    if (this.#listening || !this.#target || typeof this.#target.addEventListener !== 'function') return;
    const controller = new AbortController();
    this.#listening = controller;
    const { signal } = controller;
    this.#target.addEventListener('keydown', (event) => this.handleKeydown(/** @type {KeyboardEvent} */ (event)), { signal });
    this.#target.addEventListener('pointerdown', (event) => this.handlePointerdown(event), { capture: true, signal });
    this.#target.addEventListener('focusin', (event) => this.handleFocusin(/** @type {FocusEvent} */ (event)), { signal });
  }

  /** @returns {void} */
  #unlisten() {
    this.#listening?.abort();
    this.#listening = null;
  }

  /** @returns {void} */
  #notify() {
    const snapshot = this.#entries.slice();
    for (const listener of [...this.#listeners]) {
      try {
        listener(snapshot);
      } catch (error) {
        queueMicrotask(() => { throw error; });
      }
    }
  }
}

/**
 * The document's overlay stack, shared by every overlay in the library.
 * @type {OverlayStack}
 */
export const overlayStack = new OverlayStack();

/**
 * Registers an open overlay on the shared stack. Shorthand for `overlayStack.push(options)`.
 * @param {OverlayEntryOptions} options Entry description.
 * @returns {OverlayHandle}
 */
export function pushOverlay(options) {
  return overlayStack.push(options);
}

/**
 * @param {Element|null|undefined|Array<Element|null|undefined>} value
 * @returns {Element[]}
 */
function toList(value) {
  const list = Array.isArray(value) ? value : [value];
  return /** @type {Element[]} */ (list.filter((item, index) => item != null && list.indexOf(item) === index));
}

/**
 * The innermost open modal dialog around a node, or null.
 * @param {Node|null} node
 * @returns {Element|null}
 */
function modalAround(node) {
  for (let current = /** @type {any} */ (node); current; current = current.parentNode ?? current.host ?? null) {
    if (current.localName === 'dialog' && typeof current.matches === 'function') {
      try {
        if (current.matches(':modal')) return current;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** @param {Event} event @returns {Node|null} */
function eventNode(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return /** @type {Node|null} */ (path[0] ?? event.target ?? null);
}

/**
 * `element.matches(selector)`, answering `fallback` where the selector is not supported.
 * @param {Element} element
 * @param {string} selector
 * @param {boolean} fallback
 * @returns {boolean}
 */
function matches(element, selector, fallback) {
  if (typeof element.matches !== 'function') return fallback;
  try {
    return element.matches(selector);
  } catch {
    return fallback;
  }
}
