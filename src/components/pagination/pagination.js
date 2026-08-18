import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';

/** @typedef {'pages'|'loadmore'} PaginationMode */

/** The gap glyph {@link paginationRange} inserts between runs of page numbers. */
const ELLIPSIS = '…';
/** Modes the component supports. */
const MODES = new Set(['pages', 'loadmore']);

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
 * @typedef {Object} PaginationOptions
 * @property {number} [page=1] One-based current page.
 * @property {number} [pageSize=25] Rows per page.
 * @property {number} [total=0] Total row count; 0 is one empty page.
 * @property {number[]} [pageSizes=[25, 50, 100]] Choices offered by the page-size select.
 * @property {number} [siblings=1] Pages shown either side of the current one.
 * @property {number} [boundaries=1] Pages pinned at each end of the range.
 * @property {boolean} [showPageSize=true] Whether to render the page-size select.
 * @property {boolean} [showSummary=true] Whether to render the "26–50 of 312" summary.
 * @property {PaginationMode} [mode='pages'] `pages` renders a numbered pager, `loadmore` a single
 *   "Load more" button for append-style lists.
 * @property {boolean} [disabled=false] Whether every control starts disabled.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<PaginationChangeDetail>) => void} [onchange] Change listener.
 */

/**
 * @typedef {Object} PaginationState
 * @property {number} page One-based current page.
 * @property {number} pageSize Rows per page.
 * @property {number} total Total row count.
 * @property {number} pages Number of pages; at least 1.
 * @property {number} offset Zero-based row offset of the current page.
 */

/** @typedef {PaginationState} PaginationChangeDetail */

/**
 * The pager for a server-backed list. It owns no data: it reports which slice the user asked for
 * and lets the application fetch it, which is exactly the shape `zeyosTable()` expects —
 * `offset`/`pageSize` for `load()` in `pages` mode, or one `change` per `loadMore()` in
 * `loadmore` mode.
 *
 * `page` is clamped into `[1, pages]` after every state change, so shrinking `total` under the
 * user's feet can never leave the pager pointing past the end of the data.
 * @fires Pagination#change
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
    this._pageSize = toSize(this.options.pageSize, 25);
    this._total = Math.max(0, toCount(this.options.total));
    this._page = Math.max(1, toCount(this.options.page) || 1);
    this._disabled = Boolean(this.options.disabled);
    this._sizeKey = '';
    this._pageSizes = (Array.isArray(this.options.pageSizes) ? this.options.pageSizes : [])
      .map((size) => toSize(size, 0))
      .filter((size) => size > 0);

    if (!MODES.has(this.options.mode)) {
      throw new RangeError(`Unknown pagination mode: ${this.options.mode}`);
    }
    this._page = clamp(this._page, 1, this._pageCount());

    const root = /** @type {HTMLElement} */ (this.el ?? h('nav'));
    this.el = root;
    if (root.tagName !== 'NAV') root.setAttribute('role', 'navigation');
    root.setAttribute('aria-label', this._message('pagination.label', 'Pagination'));
    root.dataset.mode = this.options.mode;

    /** @type {Node[]} */
    const children = [];
    if (this.options.showSummary) {
      children.push(h('span', { class: 'zx-pagination__summary', ref: 'summary', ariaLive: 'polite' }));
    }
    children.push(h('span', { class: 'zx-pagination__spacer' }));
    if (this.options.showPageSize) children.push(this._renderPageSize());
    children.push(this.options.mode === 'pages' ? this._renderPages() : this._renderLoadMore());
    root.replaceChildren(...children);

    this._sync();
    this._wire();
    return root;
  }

  /**
   * Moves to a page, clamped into `[1, pages]`.
   * @param {number} page One-based page number.
   * @returns {this}
   * @fires Pagination#change
   */
  setPage(page) {
    return this.setState({ page });
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
   * Replaces the page size and returns to page 1.
   * @param {number} pageSize Rows per page.
   * @returns {this}
   * @fires Pagination#change
   */
  setPageSize(pageSize) {
    return this.setState({ pageSize, page: 1 });
  }

  /**
   * Applies any combination of page, page size, and total in one pass, then clamps the page.
   * `change` fires when the effective page or page size moved — updating only `total` is silent
   * unless the new count clamps the page.
   * @param {Partial<Pick<PaginationState, 'page'|'pageSize'|'total'>>} [state={}] Values to change.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress the event.
   * @returns {this}
   * @fires Pagination#change
   */
  setState(state = {}, { silent = false } = {}) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('Pagination state must be an object');
    }
    const fromPage = this._page;
    const fromSize = this._pageSize;
    if (Object.hasOwn(state, 'total')) this._total = Math.max(0, toCount(state.total));
    if (Object.hasOwn(state, 'pageSize')) this._pageSize = toSize(state.pageSize, this._pageSize);
    if (Object.hasOwn(state, 'page')) {
      // Any real number is accepted and then clamped; only garbage leaves the page where it was.
      const page = Math.trunc(Number(state.page));
      if (Number.isFinite(page)) this._page = page;
    }
    this._page = clamp(this._page, 1, this._pageCount());
    this._sync();
    if (!silent && (this._page !== fromPage || this._pageSize !== fromSize)) {
      this.emit('change', this.getState());
    }
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
      offset: (this._page - 1) * this._pageSize
    };
  }

  /**
   * Enables every control.
   * @returns {this}
   */
  enable() {
    this._disabled = false;
    this._sync();
    return this;
  }

  /**
   * Disables every control, for instance while a page is in flight.
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
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }

  /* ------------------------------------------------------------------ internals -- */

  /** @returns {number} Page count; an empty list is one empty page. */
  _pageCount() {
    return this._total <= 0 ? 1 : Math.ceil(this._total / this._pageSize);
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

  /** @returns {HTMLElement} Previous / page buttons / next. */
  _renderPages() {
    return h('div', { class: 'zx-pagination__controls' },
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
    }, icon(glyph, { size: 14 }));
  }

  /** @returns {HTMLElement} The append-style trigger. */
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
        this.setPageSize(Number(/** @type {HTMLSelectElement} */ (this.refs.select).value));
      });
    }
    if (this.options.mode === 'pages') {
      this.listen(this.refs.prev, 'click', () => this.setPage(this._page - 1));
      this.listen(this.refs.next, 'click', () => this.setPage(this._page + 1));
      this.listen(this.refs.pages, 'click', (event) => {
        const control = /** @type {Element} */ (event.target).closest?.('[data-page]');
        if (!control || !this.refs.pages.contains(control)) return;
        this.setPage(Number(/** @type {HTMLElement} */ (control).dataset.page));
      });
      return;
    }
    this.listen(this.refs.more, 'click', () => this.setPage(this._page + 1));
  }

  /** Pushes the current state onto every control. @returns {void} */
  _sync() {
    const pages = this._pageCount();
    this.el.dataset.disabled = this._disabled ? 'true' : 'false';
    if (this.refs.summary) this.refs.summary.textContent = this._summary();
    if (this.refs.select) this._syncPageSize();
    if (this.options.mode === 'pages') {
      /** @type {HTMLButtonElement} */ (this.refs.prev).disabled = this._disabled || this._page <= 1;
      /** @type {HTMLButtonElement} */ (this.refs.next).disabled = this._disabled || this._page >= pages;
      this._syncPages(pages);
      return;
    }
    /** @type {HTMLButtonElement} */ (this.refs.more).disabled = this._disabled || this._page >= pages;
  }

  /**
   * @returns {string} The "26–50 of 312" line.
   */
  _summary() {
    if (this._total <= 0) return this._message('pagination.empty', '0 of 0');
    const offset = (this._page - 1) * this._pageSize;
    const to = Math.min(offset + this._pageSize, this._total);
    // Appending lists have shown everything up to `to`, not just the newest page.
    if (this.options.mode === 'loadmore') {
      return this._message('pagination.loaded', '%1 of %2', count(to), count(this._total));
    }
    return this._message('pagination.summary', '%1–%2 of %3',
      count(offset + 1), count(to), count(this._total));
  }

  /** Rebuilds the page-size options only when the choice set actually changed. @returns {void} */
  _syncPageSize() {
    const select = /** @type {HTMLSelectElement} */ (this.refs.select);
    const sizes = [...new Set([...this._pageSizes, this._pageSize])].sort((left, right) => left - right);
    const key = sizes.join(',');
    if (key !== this._sizeKey) {
      this._sizeKey = key;
      select.replaceChildren(...sizes.map((size) => h('option', { value: String(size) }, String(size))));
    }
    select.value = String(this._pageSize);
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
 * Fired whenever the user picks a different slice — a page number, previous/next, a new page size
 * (which returns to page 1), or Load more.
 * @event Pagination#change
 * @type {CustomEvent<PaginationChangeDetail>}
 */

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
