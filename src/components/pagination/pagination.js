import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { ICON_SIZE, icon } from '../../core/icons.js';
import { Toggle } from '../toggle/toggle.js';

/** @typedef {'pages'|'loadmore'} PaginationMode */

/** The gap glyph {@link paginationRange} inserts between runs of page numbers. */
const ELLIPSIS = '…';
/** Modes the component supports. */
const MODES = new Set(['pages', 'loadmore']);
/** The page size that fits the page to the viewport. */
const AUTO = 'auto';

/**
 * @typedef {Object} PaginationRangeOptions
 * @property {number} page One-based current page.
 * @property {number} pages Total number of pages.
 * @property {number} [siblings=1] Pages shown either side of the current one.
 * @property {number} [boundaries=1] Pages pinned at each end of the range.
 */

/**
 * Computes the page window: the numbers a pager shows, with `'…'` standing in for every run it
 * skipped. Pure arithmetic, no DOM — the component renders whatever this returns.
 *
 * The window has a fixed width of `boundaries * 2 + siblings * 2 + 3` entries (the current page
 * plus two possible gaps), so it never jitters as the user walks through the pages. Any shorter
 * range is returned in full. A single skipped page is printed instead of a gap, because `…`
 * standing for one number would be a lie. `boundaries: 0` drops the pinned first and last pages.
 * @param {PaginationRangeOptions} options Window description.
 * @returns {Array<number|'…'>} One-based page numbers interleaved with ellipses.
 */
export function paginationRange({ page = 1, pages = 1, siblings = 1, boundaries = 1 } = {}) {
  const total = toCount(pages);
  if (total <= 0) return [];
  const current = clamp(toCount(page) || 1, 1, total);
  const sibling = Math.max(0, toCount(siblings));
  const boundary = Math.max(0, toCount(boundaries));

  const slots = boundary * 2 + sibling * 2 + 3;
  if (total <= slots) return numberRange(1, total);

  const startPages = numberRange(1, Math.min(boundary, total));
  const endPages = numberRange(Math.max(total - boundary + 1, boundary + 1), total);

  // The sibling run is pushed away from both ends so the window keeps its width at the extremes.
  const siblingsStart = Math.max(
    Math.min(current - sibling, total - boundary - sibling * 2 - 1),
    boundary + 2
  );
  const siblingsEnd = Math.min(
    Math.max(current + sibling, boundary + sibling * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : total - 1
  );

  return [
    ...startPages,
    ...(siblingsStart > boundary + 2
      ? [ELLIPSIS]
      : boundary + 1 < total - boundary ? [boundary + 1] : []),
    ...numberRange(siblingsStart, siblingsEnd),
    ...(siblingsEnd < total - boundary - 1
      ? [ELLIPSIS]
      : total - boundary > boundary ? [total - boundary] : []),
    ...endPages
  ];
}

/**
 * @typedef {Object} FitPageSizeOptions
 * @property {number} available Height the rows may fill, in pixels: the viewport's content box.
 * @property {number} rowHeight Height of one row of items, the gap to the next included, in pixels.
 * @property {number} [perRow=1] Items per row: 1 for a table or a list, the column count of a grid.
 * @property {number} [reserve=0] Pixels of `available` something else takes, such as a sticky
 *   table header. Negative gives space back — a grid's last row has no gap after it.
 * @property {number} [min=1] Smallest size returned.
 * @property {number} [max=Infinity] Largest size returned.
 */

/**
 * Computes how many items fill a viewport: whole rows only, times the items per row, clamped into
 * `[min, max]`. Pure arithmetic, no DOM — the component measures, this decides.
 *
 * Returns 0 when there is nothing to measure yet (no height, no row height), so a caller can keep
 * the size it has rather than collapse to the minimum while a view is still hidden.
 * @param {FitPageSizeOptions} options Measurements.
 * @returns {number} Items per page, or 0 when unknown.
 */
export function fitPageSize({ available, rowHeight, perRow = 1, reserve = 0, min = 1, max = Infinity } = /** @type {FitPageSizeOptions} */ ({})) {
  const height = Number(available);
  const pitch = Number(rowHeight);
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(pitch) || pitch <= 0) return 0;
  const space = height - (Number(reserve) || 0);
  const columns = Math.max(1, Math.trunc(Number(perRow)) || 1);
  // Half a pixel of tolerance: subpixel layout must not drop a row that visibly fits.
  const rows = Math.max(0, Math.floor((space + 0.5) / pitch));
  const lower = Math.max(1, toCount(min) || 1);
  const upper = max == null || Number(max) === Infinity ? Infinity : Math.max(lower, toCount(max) || lower);
  return clamp(rows * columns, lower, upper);
}

/**
 * A measurement the pager takes from its viewport: a number of pixels (or items, for `perRow`),
 * or a function that reads it from the viewport — returning null hands back to the default.
 * @typedef {number|((viewport: Element) => number|null|undefined)|null} PaginationMeasure
 */

/**
 * @typedef {Object} PaginationOptions
 * @property {number} [page=1] One-based current page.
 * @property {number|'auto'} [pageSize=25] Rows per page, or `'auto'`: as many as fit `viewport`
 *   without scrolling, measured again whenever the viewport changes size.
 * @property {number} [total=0] Total row count; 0 is one empty page.
 * @property {Array<number|'auto'>} [pageSizes=[25, 50, 100]] Choices offered by the page-size
 *   select. `'auto'` offers the fitted size, shown with the count it currently stands for.
 * @property {number} [siblings=1] Pages shown either side of the current one.
 * @property {number} [boundaries=1] Pages pinned at each end of the range.
 * @property {boolean} [showPageSize=true] Whether to render the page-size select.
 * @property {boolean} [showSummary=true] Whether to render the "26–50 of 312" summary.
 * @property {PaginationMode} [mode='pages'] `pages` renders a numbered pager, `loadmore` a single
 *   "Load more" button for append-style lists.
 * @property {boolean} [autoLoad=false] Loads the next page by itself when the end of the list
 *   scrolls into view — infinite scroll. The pager then appends, as in `loadmore`, whatever `mode`
 *   says; `mode` is what it returns to when auto-load is switched off.
 * @property {boolean} [showAutoLoad=false] Whether to render the Auto-load switch, so the reader
 *   decides between paging and continuous scrolling.
 * @property {Element|string|(() => Element|null)|null} [viewport=null] The element the rows
 *   scroll in. `'auto'` fits the page to its height; auto-load watches its scroll position. A
 *   function is asked again on `refit()`, for a host that swaps its views. Without one, auto-load
 *   watches the pager itself approach the end of its scrolling ancestor, which suits a pager that
 *   follows the rows; a pager in a fixed footer needs the viewport.
 * @property {PaginationMeasure} [rowHeight=null] One row's height, gap included. By default the
 *   first body row of a Zx Table in the viewport (`tbody > tr[data-row]`), else `--zx-row-height`.
 * @property {PaginationMeasure} [perRow=1] Items per row, for a grid of cards.
 * @property {PaginationMeasure} [reserve=null] Pixels of the viewport the rows cannot use. By
 *   default the height of the viewport's `thead`, which sticks above the rows.
 * @property {number} [minPageSize=5] Smallest fitted page size.
 * @property {number} [maxPageSize=200] Largest fitted page size.
 * @property {number|null} [autoLoadMargin=null] How close to the end, in pixels, auto-load
 *   starts on the next page; half the viewport by default, so the rows arrive before they are due.
 * @property {boolean} [disabled=false] Whether every control starts disabled.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<PaginationChangeDetail>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<{autoLoad: boolean}>) => void} [onautoload] Auto-load switch listener.
 */

/**
 * @typedef {Object} PaginationState
 * @property {number} page One-based current page.
 * @property {number} pageSize Rows per page: the fitted count while `auto`.
 * @property {number} total Total row count.
 * @property {number} pages Number of pages; at least 1.
 * @property {number} offset Zero-based row offset of the current page.
 * @property {boolean} auto Whether the page size is fitted to the viewport.
 * @property {boolean} autoLoad Whether the next page loads as the end comes into view.
 * @property {PaginationMode} mode What the pager shows: `loadmore` while auto-load is on.
 */

/**
 * Why a `change` fired: `page` (a page button, previous/next, `setPage()`), `pageSize` (the select,
 * `setPageSize()`), `fit` (the fitted size followed the viewport), `more` (Load more), `scroll`
 * (auto-load), `mode` (auto-load switched between paging and appending), or `state` (`setState()`).
 * @typedef {'page'|'pageSize'|'fit'|'more'|'scroll'|'mode'|'state'} PaginationReason
 */

/**
 * @typedef {PaginationState & {reason: PaginationReason, append: boolean}} PaginationChangeDetail
 *   `append` is true when the rows `offset … offset + pageSize` go after the ones already shown
 *   (Load more, auto-load). Otherwise the slice is shown from scratch: rows
 *   `offset … offset + pageSize` when paging, rows `0 … page × pageSize` while appending.
 */

/**
 * The pager for a server-backed list. It owns no data: it reports which slice the user asked for
 * — `page`, `pageSize`, and the zero-based row `offset = (page - 1) * pageSize` — and lets the
 * application fetch it.
 *
 * The pager is one-based and defaults to 25 rows per page. The ZeyOS bindings are zero-based,
 * default to 50 rows, and append pages above zero unless told to replace, so connecting the two
 * takes a small mapping rather than a direct hand-off:
 *
 * ```js
 * const binding = zeyosTable(client, 'contacts', { pageSize: 25 });
 * const pager = new Pagination(host, { pageSize: binding.pageSize });
 * pager.on('change', async ({ detail }) => {
 *   const result = await binding.load({ page: detail.page - 1, pageSize: detail.pageSize, replace: true });
 *   pager.setTotal(result.count ?? 0);
 * });
 * ```
 *
 * In `loadmore` mode each `change` stands for one `binding.loadMore()`, which appends.
 *
 * Two things adapt the pager to the screen. `pageSize: 'auto'` fits the page to `viewport` — no
 * scrollbar, no empty half page — and follows it as the window, the theme's row height, or a drawer changes
 * its height, keeping the first row of the page on it. `autoLoad` turns paging into continuous
 * scrolling: the next page arrives as the end of the list comes into view. An application loading
 * asynchronously calls `disable()` in its `change` listener and `enable()` once the rows are in;
 * auto-load waits for that, so it never asks for two pages at once.
 *
 * `page` is clamped into `[1, pages]` after every state change, so shrinking `total` under the
 * user's feet can never leave the pager pointing past the end of the data.
 * @fires Pagination#change
 * @fires Pagination#autoload
 * @extends {Component<PaginationOptions>}
 */
export class Pagination extends Component {
  static cssName = 'pagination';

  /** @type {Readonly<PaginationOptions>} */
  static defaults = {
    page: 1,
    pageSize: 25,
    total: 0,
    pageSizes: [25, 50, 100],
    siblings: 1,
    boundaries: 1,
    showPageSize: true,
    showSummary: true,
    mode: 'pages',
    autoLoad: false,
    showAutoLoad: false,
    viewport: null,
    rowHeight: null,
    perRow: 1,
    reserve: null,
    minPageSize: 5,
    maxPageSize: 200,
    autoLoadMargin: null,
    disabled: false
  };

  /**
   * Creates or enhances a pager.
   * @param {Element|string|null} target Existing container, selector, or null.
   * @param {PaginationOptions} [options={}] Pagination options.
   */
  constructor(target, options = {}) {
    super(target, options);
  }

  /**
   * Builds the pager. Runs inside the base constructor, so instance state is initialized here.
   * @returns {HTMLElement}
   */
  render() {
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);
    this._destroyed = false;
    const choices = Array.isArray(this.options.pageSizes) ? this.options.pageSizes : [];
    this._offerAuto = choices.some(isAuto);
    this._pageSizes = choices.filter((size) => !isAuto(size))
      .map((size) => toSize(size, 0))
      .filter((size) => size > 0);
    this._auto = isAuto(this.options.pageSize);
    // Until the viewport can be measured, an auto pager pages by the first size it offers.
    this._pageSize = this._auto ? this._pageSizes[0] ?? 25 : toSize(this.options.pageSize, 25);
    this._total = Math.max(0, toCount(this.options.total));
    this._page = Math.max(1, toCount(this.options.page) || 1);
    this._disabled = Boolean(this.options.disabled);
    this._autoLoad = Boolean(this.options.autoLoad);
    this._sizeKey = '';
    /** @type {{fit: number, load: number}} Pending animation frames, one per kind of check. */
    this._frames = { fit: 0, load: 0 };
    /** @type {number[]} The fitted sizes most recently applied, to stop a resize from oscillating. */
    this._fitTrail = [];
    /** @type {ResizeObserver|null} */
    this._observer = null;
    /** @type {Element|null} The viewport being observed. */
    this._observed = null;
    /** @type {Element|null} The viewport's first child, observed beside it. */
    this._observedContent = null;
    /** @type {Toggle|null} */
    this._switch = null;

    if (!MODES.has(this.options.mode)) {
      throw new RangeError(`Unknown pagination mode: ${this.options.mode}`);
    }
    this._page = clamp(this._page, 1, this._pageCount());

    const root = /** @type {HTMLElement} */ (this.el ?? h('nav'));
    this.el = root;
    if (root.tagName !== 'NAV') root.setAttribute('role', 'navigation');
    root.setAttribute('aria-label', this._message('pagination.label', 'Pagination'));

    /** @type {Node[]} */
    const children = [];
    if (this.options.showSummary) {
      children.push(h('span', { class: 'zx-pagination__summary', ref: 'summary', ariaLive: 'polite' }));
    }
    // The summary, the page size, and the Auto-load switch describe the slice and sit together at
    // the start; the pager walks the slice and sits alone at the end, where the next-page action
    // is reached last.
    if (this.options.showPageSize) children.push(this._renderPageSize());
    if (this.options.showAutoLoad) children.push(this._renderAutoLoad());
    children.push(h('span', { class: 'zx-pagination__spacer' }));
    // Both ends are built once; switching auto-load shows one and hides the other.
    children.push(this._renderPages(), this._renderLoadMore());
    root.replaceChildren(...children);

    this._sync();
    this._wire();
    this._observe();
    return root;
  }

  /**
   * Moves to a page, clamped into `[1, pages]`.
   * @param {number} page One-based page number.
   * @returns {this}
   * @fires Pagination#change
   */
  setPage(page) {
    return this._apply({ page }, 'page');
  }

  /**
   * Replaces the total row count and re-clamps the page. Silent: servers report the count as part
   * of a response the pager itself asked for, so echoing a `change` back would loop.
   * @param {number} total Total row count.
   * @returns {this}
   */
  setTotal(total) {
    return this.setState({ total }, { silent: true });
  }

  /**
   * Replaces the page size and returns to page 1. `'auto'` fits it to the viewport.
   * @param {number|'auto'} pageSize Rows per page.
   * @returns {this}
   * @fires Pagination#change
   */
  setPageSize(pageSize) {
    return this._apply({ pageSize, page: 1 }, 'pageSize');
  }

  /**
   * Applies any combination of page, page size, and total in one pass, then clamps the page.
   * `change` fires when the effective page or page size moved — updating only `total` is silent
   * unless the new count clamps the page.
   * @param {{page?: number, pageSize?: number|'auto', total?: number}} [state={}] Values to change.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress the event.
   * @returns {this}
   * @fires Pagination#change
   */
  setState(state = {}, { silent = false } = {}) {
    return this._apply(state, 'state', silent);
  }

  /**
   * Switches auto-load. Where that changes what the pager shows — paging becomes appending, or
   * back — it returns to page 1 and fires `change` with reason `mode`.
   * @param {boolean} autoLoad Whether the next page loads as the end comes into view.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress both events.
   * @returns {this}
   * @fires Pagination#autoload
   * @fires Pagination#change
   */
  setAutoLoad(autoLoad, { silent = false } = {}) {
    const next = Boolean(autoLoad);
    if (next === this._autoLoad) return this;
    const before = this._continuous();
    this._autoLoad = next;
    this._switch?.set(next, { silent: true });
    const moved = before !== this._continuous();
    if (moved) this._page = 1;
    this._sync();
    if (!silent) {
      this.emit('autoload', { autoLoad: next });
      if (moved) this._emitChange('mode', false);
    }
    this._schedule('load');
    return this;
  }

  /**
   * Measures the viewport again — after the host swapped what it shows in it, or replaced it
   * (a `viewport` function is asked again) — and refits an `'auto'` page size. Cheap to call after
   * every redraw: it measures once on the next frame and fires only when the fitted size moved.
   * @returns {this}
   * @fires Pagination#change
   */
  refit() {
    this._observe();
    this._schedule('fit');
    this._schedule('load');
    return this;
  }

  /**
   * Returns the current slice description.
   * @returns {PaginationState}
   */
  getState() {
    const pages = this._pageCount();
    return {
      page: this._page,
      pageSize: this._pageSize,
      total: this._total,
      pages,
      offset: (this._page - 1) * this._pageSize,
      auto: this._auto,
      autoLoad: this._autoLoad,
      mode: this._continuous() ? 'loadmore' : 'pages'
    };
  }

  /**
   * Enables every control, and lets auto-load continue.
   * @returns {this}
   */
  enable() {
    this._disabled = false;
    this._sync();
    this._schedule('load');
    return this;
  }

  /**
   * Disables every control, for instance while a page is in flight. Auto-load waits too.
   * @returns {this}
   */
  disable() {
    this._disabled = true;
    this._sync();
    return this;
  }

  /**
   * Aborts listeners and restores an enhanced target to the markup it had before the takeover.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const kind of /** @type {Array<'fit'|'load'>} */ (['fit', 'load'])) cancelFrame(this._frames[kind]);
    this._observer?.disconnect();
    this._switch?.destroy();
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }

  /* ------------------------------------------------------------------ internals -- */

  /** @returns {number} Page count; an empty list is one empty page. */
  _pageCount() {
    return this._total <= 0 ? 1 : Math.ceil(this._total / this._pageSize);
  }

  /** @returns {boolean} Whether pages append — Load more, or auto-load — rather than replace. */
  _continuous() {
    return this._autoLoad || this.options.mode === 'loadmore';
  }

  /**
   * The one place state changes: applies, clamps, redraws, and reports.
   * @param {{page?: number, pageSize?: number|'auto', total?: number}} state Values to change.
   * @param {PaginationReason} reason Why, for the event.
   * @param {boolean} [silent=false] Suppresses the event.
   * @returns {this}
   */
  _apply(state, reason, silent = false) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('Pagination state must be an object');
    }
    const fromPage = this._page;
    const fromSize = this._pageSize;
    const fromAuto = this._auto;
    if (Object.hasOwn(state, 'total')) this._total = Math.max(0, toCount(state.total));
    if (Object.hasOwn(state, 'pageSize')) {
      if (isAuto(state.pageSize)) {
        if (!this._auto) {
          this._auto = true;
          this._fitTrail = [];
          this._pageSize = this._measure() || this._pageSize;
        }
      } else {
        const size = toSize(state.pageSize, 0);
        if (size > 0) {
          this._auto = false;
          this._pageSize = size;
        }
      }
    }
    if (Object.hasOwn(state, 'page')) {
      // Any real number is accepted and then clamped; only garbage leaves the page where it was.
      const page = Math.trunc(Number(state.page));
      if (Number.isFinite(page)) this._page = page;
    }
    this._page = clamp(this._page, 1, this._pageCount());
    this._sync();
    if (!silent && (this._page !== fromPage || this._pageSize !== fromSize || this._auto !== fromAuto)) {
      this._emitChange(reason, (reason === 'more' || reason === 'scroll') && this._page === fromPage + 1);
    }
    // The viewport may not be full yet — a short page, a total that grew — so look again.
    if (this._auto && !fromAuto) this._schedule('fit');
    this._schedule('load');
    return this;
  }

  /**
   * @param {PaginationReason} reason
   * @param {boolean} append
   * @returns {void}
   */
  _emitChange(reason, append) {
    this.emit('change', { ...this.getState(), reason, append });
  }

  /** @returns {HTMLElement} The page-size select and its visible label. */
  _renderPageSize() {
    const label = this._message('pagination.pageSize', 'Rows per page');
    return h('label', { class: 'zx-pagination__size' },
      h('span', { class: 'zx-pagination__size-label' }, label),
      h('select', {
        class: 'zx-pagination__select',
        ref: 'select',
        ariaLabel: label
      }));
  }

  /** @returns {HTMLElement} The Auto-load switch. */
  _renderAutoLoad() {
    this._switch = new Toggle(null, {
      label: this._message('pagination.autoLoad', 'Auto-load'),
      checked: this._autoLoad,
      onchange: ({ detail }) => this.setAutoLoad(detail.checked)
    });
    return h('span', { class: 'zx-pagination__autoload' }, this._switch.toElement());
  }

  /** @returns {HTMLElement} Previous / page buttons / next. */
  _renderPages() {
    return h('div', { class: 'zx-pagination__controls', ref: 'controls' },
      this._navButton('prev', 'chevron-left', this._message('pagination.previous', 'Previous page')),
      h('div', { class: 'zx-pagination__pages', ref: 'pages' }),
      this._navButton('next', 'chevron-right', this._message('pagination.next', 'Next page')));
  }

  /**
   * @param {string} ref Ref name.
   * @param {string} glyph Icon name.
   * @param {string} label Accessible name.
   * @returns {HTMLElement}
   */
  _navButton(ref, glyph, label) {
    return h('button', {
      class: 'zx-btn zx-pagination__nav',
      type: 'button',
      ref,
      ariaLabel: label,
      dataset: { kind: 'default', size: 'sm' }
    }, icon(glyph, { size: ICON_SIZE.chevron }));
  }

  /** @returns {HTMLElement} The append-style trigger; under auto-load, the keyboard's way on. */
  _renderLoadMore() {
    return h('button', {
      class: 'zx-btn zx-pagination__more',
      type: 'button',
      ref: 'more',
      dataset: { kind: 'default', size: 'md' }
    }, h('span', { class: 'zx-btn__label' }, this._message('pagination.loadMore', 'Load more')));
  }

  /** Attaches the delegated listeners once, after the shell exists. @returns {void} */
  _wire() {
    if (this.refs.select) {
      this.listen(this.refs.select, 'change', () => {
        const value = /** @type {HTMLSelectElement} */ (this.refs.select).value;
        this.setPageSize(isAuto(value) ? AUTO : Number(value));
      });
    }
    this.listen(this.refs.prev, 'click', () => this.setPage(this._page - 1));
    this.listen(this.refs.next, 'click', () => this.setPage(this._page + 1));
    this.listen(this.refs.pages, 'click', (event) => {
      const control = /** @type {Element} */ (event.target).closest?.('[data-page]');
      if (!control || !this.refs.pages.contains(control)) return;
      this.setPage(Number(/** @type {HTMLElement} */ (control).dataset.page));
    });
    this.listen(this.refs.more, 'click', () => this._apply({ page: this._page + 1 }, 'more'));
    // Scrolling anywhere may bring the end of the list near; the check itself is one per frame.
    const doc = this.el.ownerDocument;
    const view = doc?.defaultView;
    if (doc) {
      this.listen(doc, 'scroll', () => {
        if (this._autoLoad) this._schedule('load');
      }, { capture: true, passive: true });
    }
    if (view) {
      this.listen(view, 'resize', () => {
        if (this._autoLoad) this._schedule('load');
      }, { passive: true });
    }
  }

  /** Pushes the current state onto every control. @returns {void} */
  _sync() {
    const pages = this._pageCount();
    const continuous = this._continuous();
    this.el.dataset.mode = continuous ? 'loadmore' : 'pages';
    this.el.dataset.autoload = this._autoLoad ? 'true' : 'false';
    this.el.dataset.disabled = this._disabled ? 'true' : 'false';
    if (this.refs.summary) this.refs.summary.textContent = this._summary();
    if (this.refs.select) this._syncPageSize();
    if (this._switch) {
      if (this._disabled) this._switch.disable();
      else this._switch.enable();
    }
    /** @type {HTMLElement} */ (this.refs.controls).hidden = continuous;
    /** @type {HTMLElement} */ (this.refs.more).hidden = !continuous;
    /** @type {HTMLButtonElement} */ (this.refs.more).disabled = this._disabled || this._page >= pages;
    if (continuous) return;
    /** @type {HTMLButtonElement} */ (this.refs.prev).disabled = this._disabled || this._page <= 1;
    /** @type {HTMLButtonElement} */ (this.refs.next).disabled = this._disabled || this._page >= pages;
    this._syncPages(pages);
  }

  /**
   * @returns {string} The "26–50 of 312" line.
   */
  _summary() {
    if (this._total <= 0) return this._message('pagination.empty', '0 of 0');
    const offset = (this._page - 1) * this._pageSize;
    const to = Math.min(offset + this._pageSize, this._total);
    // Appending lists have shown everything up to `to`, not just the newest page.
    if (this._continuous()) {
      return this._message('pagination.loaded', '%1 of %2', count(to), count(this._total));
    }
    return this._message('pagination.summary', '%1–%2 of %3',
      count(offset + 1), count(to), count(this._total));
  }

  /** Rebuilds the page-size options only when the choice set actually changed. @returns {void} */
  _syncPageSize() {
    const select = /** @type {HTMLSelectElement} */ (this.refs.select);
    const sizes = [...new Set(this._auto ? this._pageSizes : [...this._pageSizes, this._pageSize])]
      .sort((left, right) => left - right);
    const auto = this._offerAuto || this._auto
      ? this._auto
        ? this._message('pagination.autoSize', 'Auto (%1)', count(this._pageSize))
        : this._message('pagination.auto', 'Auto')
      : null;
    const key = `${auto ?? ''}|${sizes.join(',')}`;
    if (key !== this._sizeKey) {
      this._sizeKey = key;
      select.replaceChildren(
        ...(auto === null ? [] : [h('option', { value: AUTO }, auto)]),
        ...sizes.map((size) => h('option', { value: String(size) }, String(size))));
    }
    select.value = this._auto ? AUTO : String(this._pageSize);
    select.disabled = this._disabled;
  }

  /**
   * Rebuilds the page buttons, keeping the keyboard focus on the same page number when the user
   * paged with the keyboard and that number survived the rebuild.
   * @param {number} pages Page count.
   * @returns {void}
   */
  _syncPages(pages) {
    const container = /** @type {HTMLElement} */ (this.refs.pages);
    const active = this.el.ownerDocument?.activeElement ?? null;
    const focused = active && container.contains(active)
      ? /** @type {HTMLElement} */ (active).dataset.page ?? null
      : null;

    const entries = paginationRange({
      page: this._page,
      pages,
      siblings: this.options.siblings,
      boundaries: this.options.boundaries
    });
    container.replaceChildren(...entries.map((entry) => entry === ELLIPSIS
      ? h('span', { class: 'zx-pagination__ellipsis', ariaHidden: 'true' }, ELLIPSIS)
      : h('button', {
        class: 'zx-btn zx-pagination__page',
        type: 'button',
        disabled: this._disabled,
        ariaCurrent: entry === this._page ? 'page' : null,
        ariaLabel: this._message('pagination.page', 'Page %1', entry),
        dataset: { kind: 'default', size: 'sm', page: String(entry) }
      }, String(entry))));

    if (focused === null) return;
    const restored = /** @type {HTMLButtonElement|null} */ (
      container.querySelector(`[data-page="${focused}"]`));
    if (restored && !restored.disabled) restored.focus();
  }

  /* -------------------------------------------------------- fitting and loading -- */

  /** @returns {Element|null} The viewport option, resolved now. */
  _viewport() {
    const option = this.options.viewport;
    const value = typeof option === 'function' ? option() : option;
    if (typeof value === 'string') return this.el.ownerDocument?.querySelector(value) ?? null;
    return value && typeof value === 'object' && /** @type {Node} */ (value).nodeType === 1
      ? /** @type {Element} */ (value) : null;
  }

  /**
   * Observes the current viewport and what it holds, letting go of previous ones. The viewport's
   * size is the space; its content's size changes when the rows themselves do — a table stacking
   * into cards on a narrow screen, a new row height, a font arriving.
   * @returns {void}
   */
  _observe() {
    const viewport = this._viewport();
    const content = viewport?.firstElementChild ?? null;
    if (viewport === this._observed && content === this._observedContent) return;
    this._observer?.disconnect();
    this._observed = viewport;
    this._observedContent = content;
    if (!viewport || typeof ResizeObserver !== 'function') return;
    this._observer ??= new ResizeObserver(() => {
      this._schedule('fit');
      this._schedule('load');
    });
    this._observer.observe(viewport);
    if (content) this._observer.observe(content);
  }

  /**
   * Runs a fit or an auto-load check on the next frame, once however often it is asked for — a
   * resize or a scroll asks many times a frame, and measuring inside a ResizeObserver callback
   * that changes the rows would loop.
   * @param {'fit'|'load'} kind
   * @returns {void}
   */
  _schedule(kind) {
    if (this._destroyed || this._frames[kind]) return;
    if (kind === 'fit' ? !this._auto : !this._autoLoad) return;
    this._frames[kind] = requestFrame(() => {
      this._frames[kind] = 0;
      if (this._destroyed) return;
      if (kind === 'fit') this._fit();
      else this._checkAutoLoad();
    });
  }

  /**
   * Measures the viewport and, when the fitted size moved, keeps the page's first row on the new
   * page. Appending pagers fit only their first batch: later batches keep its size, so the rows
   * loaded so far always number `page × pageSize`.
   * @returns {void}
   */
  _fit() {
    if (!this._auto || (this._continuous() && this._page > 1)) return;
    const size = this._measure();
    if (!size || size === this._pageSize) return;
    // A size that would take the pager back to where it was two fits ago, upwards, is a resize
    // feeding on itself (a footer that wraps with the page count); the smaller size stays.
    const trail = this._fitTrail;
    if (trail.length >= 2 && trail[trail.length - 2] === size && size > this._pageSize) return;
    trail.push(size);
    if (trail.length > 4) trail.shift();
    const offset = (this._page - 1) * this._pageSize;
    this._pageSize = size;
    this._page = clamp(Math.floor(offset / size) + 1, 1, this._pageCount());
    this._sync();
    this._emitChange('fit', false);
    this._schedule('load');
  }

  /**
   * How many items fit the viewport now, or 0 when it cannot be measured (absent, hidden).
   * @returns {number}
   */
  _measure() {
    const viewport = this._viewport();
    if (!viewport || !viewport.isConnected) return 0;
    const view = viewport.ownerDocument.defaultView;
    const style = view?.getComputedStyle(viewport);
    const padding = style
      ? (Number.parseFloat(style.paddingBlockStart) || 0) + (Number.parseFloat(style.paddingBlockEnd) || 0)
      : 0;
    /**
     * @param {PaginationMeasure|undefined} option
     * @param {() => number} fallback
     * @returns {number}
     */
    const read = (option, fallback) => {
      const value = typeof option === 'function' ? option(viewport) : option;
      const number = Number(value);
      return value == null || !Number.isFinite(number) ? fallback() : number;
    };
    return fitPageSize({
      available: viewport.clientHeight - padding,
      reserve: read(this.options.reserve, () => headerHeight(viewport)),
      rowHeight: read(this.options.rowHeight, () => rowHeightIn(viewport)),
      perRow: read(this.options.perRow, () => 1),
      min: this.options.minPageSize,
      max: this.options.maxPageSize
    });
  }

  /** Loads the next page when auto-load is on, idle, and the end of the list is near. @returns {void} */
  _checkAutoLoad() {
    if (!this._autoLoad || this._disabled || this._page >= this._pageCount()) return;
    const root = /** @type {HTMLElement} */ (this.el);
    if (!root.isConnected || (typeof root.checkVisibility === 'function' && !root.checkVisibility())) return;
    if (!this._nearEnd()) return;
    this._apply({ page: this._page + 1 }, 'scroll');
  }

  /** @returns {boolean} Whether the end of the list is within the auto-load margin. */
  _nearEnd() {
    const option = this.options.autoLoadMargin;
    /** @param {number} height @returns {number} */
    const margin = (height) => (typeof option === 'number' && option >= 0 ? option : height / 2);
    const viewport = this._viewport();
    if (viewport) {
      if (viewport.clientHeight <= 0) return false;
      return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= margin(viewport.clientHeight);
    }
    const scroller = scrollParent(this.el);
    const view = this.el.ownerDocument?.defaultView;
    const bounds = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: view?.innerHeight ?? 0 };
    const height = bounds.bottom - bounds.top;
    if (height <= 0) return false;
    return this.el.getBoundingClientRect().top <= bounds.bottom + margin(height);
  }

  /**
   * Resolves a message through the host translator, falling back to the built-in English text.
   * @param {string} key Message key.
   * @param {string} fallback Built-in text, with `%1`-style placeholders.
   * @param {...unknown} args Interpolation values.
   * @returns {string}
   */
  _message(key, fallback, ...args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
  }
}

/**
 * Fired whenever the slice changes — a page number, previous/next, a new page size (which returns
 * to page 1), Load more, auto-load, a fitted size that followed the viewport, or auto-load switching
 * between paging and appending. `detail.reason` says which.
 * @event Pagination#change
 * @type {CustomEvent<PaginationChangeDetail>}
 */

/**
 * Fired when auto-load is switched on or off — by the switch or `setAutoLoad()` — before any
 * `change` that follows from it; the moment to remember the reader's preference.
 * @event Pagination#autoload
 * @type {CustomEvent<{autoLoad: boolean}>}
 */

/** @param {unknown} value @returns {boolean} Whether a page-size value asks for the fitted size. */
function isAuto(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === AUTO;
}

/**
 * Height of the header that sticks above a table's rows inside the viewport.
 * @param {Element} viewport
 * @returns {number}
 */
function headerHeight(viewport) {
  const head = viewport.querySelector('thead');
  return head ? head.getBoundingClientRect().height : 0;
}

/**
 * One row's height: a Zx Table's first body row when there is one — the rows as drawn, stacked
 * on a narrow screen or not — else the theme's `--zx-row-height`, read through a probe.
 * @param {Element} viewport
 * @returns {number}
 */
function rowHeightIn(viewport) {
  const row = viewport.querySelector('tbody > tr[data-row]');
  const height = row ? row.getBoundingClientRect().height : 0;
  if (height > 0) return height;
  const probe = h('div', {
    ariaHidden: 'true',
    style: { position: 'absolute', visibility: 'hidden', inlineSize: '0', blockSize: 'var(--zx-row-height)' }
  });
  viewport.append(probe);
  const probed = probe.getBoundingClientRect().height;
  probe.remove();
  return probed;
}

/**
 * The nearest ancestor that scrolls vertically, or null for the window.
 * @param {Element} element
 * @returns {Element|null}
 */
function scrollParent(element) {
  const view = element.ownerDocument?.defaultView;
  for (let node = element.parentElement; node && node !== element.ownerDocument.body; node = node.parentElement) {
    const overflow = view?.getComputedStyle(node).overflowY ?? '';
    if (/(auto|scroll|overlay)/.test(overflow)) return node;
  }
  return null;
}

/** @param {() => void} fn @returns {number} A handle for {@link cancelFrame}. */
function requestFrame(fn) {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(fn)
    : /** @type {number} */ (/** @type {unknown} */ (setTimeout(fn, 16)));
}

/** @param {number} handle From {@link requestFrame}; 0 is no frame. @returns {void} */
function cancelFrame(handle) {
  if (!handle) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  else clearTimeout(handle);
}

/** @param {unknown} value @returns {number} A non-negative integer, or 0. */
function toCount(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

/** @param {unknown} value @param {number} fallback @returns {number} A positive integer. */
function toSize(value, fallback) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/** @param {number} value @param {number} min @param {number} max @returns {number} */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** @param {number} start @param {number} end @returns {number[]} Inclusive range, empty when reversed. */
function numberRange(start, end) {
  if (end < start) return [];
  return Array.from({ length: end - start + 1 }, (_value, index) => start + index);
}

/** @param {number} value @returns {string} Group-separated number for the summary line. */
function count(value) {
  return value.toLocaleString();
}
