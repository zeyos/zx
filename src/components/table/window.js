import { h } from '../../core/dom.js';

/** Row height assumed until a row has been measured: the default `--zx-row-height`. */
const ASSUMED_ROW_HEIGHT = 36;
/** Scroll-region height assumed until one has been measured. */
const ASSUMED_VIEWPORT = 600;

/**
 * Which rows to draw for a scroll position: those in view, plus `overscan` viewports' worth above
 * and below. Positions are zero-based and `end` is exclusive. The scroll position is clamped to
 * what the rows can reach, so a list that just got shorter still draws its last rows while the
 * browser catches up. Rows with no usable height yield one row, which is what gets measured.
 * @param {{total: number, rowHeight: number, scrollTop: number, viewport: number, overscan?: number}} state
 * Row count, height of one row, distance scrolled past the first row, height of the region the rows
 * show through, and overscan in viewports.
 * @returns {{start: number, end: number}} Half-open range of rows; empty for an empty table.
 */
export function tableWindow({ total, rowHeight, scrollTop, viewport, overscan = 1 }) {
  const count = Math.max(0, Math.trunc(Number(total) || 0));
  const height = Number(rowHeight);
  if (count === 0) return { start: 0, end: 0 };
  if (!(height > 0)) return { start: 0, end: 1 };
  const view = Math.max(Number(viewport) || 0, height);
  const top = Math.min(Math.max(Number(scrollTop) || 0, 0), Math.max(0, count * height - view));
  const first = Math.floor(top / height);
  const last = Math.ceil((top + view) / height);
  const extra = Math.ceil(view * Math.max(0, Number(overscan) || 0) / height);
  return { start: Math.max(0, first - extra), end: Math.min(count, last + extra) };
}

/**
 * Splits a table into what is drawn and what stands in for it: runs of rows and the gaps between
 * them, in display order. A pinned row outside the window is drawn where it belongs, on its own,
 * with a gap either side, so the rows stay in order and the scroll height stays right. Positions
 * out of range are ignored.
 * @param {number} total Row count.
 * @param {number} start First row of the window.
 * @param {number} end End of the window, exclusive.
 * @param {Array<number|null|undefined>} [pinned=[]] Rows that stay drawn wherever they are.
 * @returns {Array<{from: number, to: number}|{gap: number}>} Segments; a gap counts rows.
 */
export function tableWindowSegments(total, start, end, pinned = []) {
  const runs = end > start ? [{ from: start, to: end }] : [];
  for (const index of pinned) {
    if (!Number.isInteger(index) || index < 0 || index >= total) continue;
    if (index < start || index >= end) runs.push({ from: index, to: index + 1 });
  }
  runs.sort((left, right) => left.from - right.from);

  /** @type {Array<{from: number, to: number}|{gap: number}>} */
  const segments = [];
  /** @type {{from: number, to: number}|null} */
  let run = null;
  let cursor = 0;
  for (const { from, to } of runs) {
    if (run && from <= cursor) {
      // Touching the previous run, or the same row pinned twice.
      run.to = Math.max(run.to, to);
    } else {
      if (from > cursor) segments.push({ gap: from - cursor });
      run = { from, to };
      segments.push(run);
    }
    cursor = run.to;
  }
  if (cursor < total) segments.push({ gap: total - cursor });
  return segments;
}

/**
 * Where to scroll so a row is in view, moving as little as possible: a row already in view keeps
 * the scroll position, and one outside it lands on the nearer edge.
 * @param {{index: number, rowHeight: number, scrollTop: number, viewport: number}} state Row, height
 * of one row, distance scrolled past the first row, and height of the region the rows show through.
 * @returns {number} New distance past the first row.
 */
export function tableWindowScroll({ index, rowHeight, scrollTop, viewport }) {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewport) return Math.max(0, Math.min(top, bottom - viewport));
  return scrollTop;
}

/**
 * @typedef {Object} RowWindowHost
 * @property {HTMLElement} scroller The element that scrolls.
 * @property {HTMLElement} body Element the rows are children of.
 * @property {HTMLElement} head Element above the rows.
 * @property {boolean} sticky Whether `head` stays in place while the rows scroll under it.
 * @property {(entry: any) => HTMLElement} draw Builds the row for an entry.
 * @property {(row: HTMLElement) => void} release Forgets a row that left the DOM.
 * @property {() => Array<number|undefined>} pins Positions that stay drawn wherever they are.
 * @property {() => number} colspan Cells one row occupies.
 * @property {() => void} changed Called after the drawn rows change.
 */

/**
 * Keeps a table body down to the rows around the scroll position. Spacer rows stand in for the rest,
 * sized from one measured row, so the scroll height is the height of every row. Rows that stay in
 * the window are never touched: moving one would blur it. Holds no listeners of its own except the
 * `ResizeObserver` released by `stop()`.
 */
export class RowWindow {
  /** @param {RowWindowHost} host Table side of the arrangement. */
  constructor(host) {
    this.host = host;
    /** @type {any[]} */
    this.entries = [];
    /** @type {Map<number, HTMLElement>} Drawn rows by position. */
    this.drawn = new Map();
    /** @type {HTMLElement[]} Spacer rows, reused by position. */
    this.spacers = [];
    this.rowHeight = ASSUMED_ROW_HEIGHT;
    this.viewport = ASSUMED_VIEWPORT;
    // Pixels of `head` that scroll away with the rows; none while it sticks.
    this.offset = 0;
    this.measured = false;
    this.live = false;
    this.frame = 0;
    /** @type {ResizeObserver|null} */
    this.observer = null;
    // A sized box that answers to the row-height token, which no row can be trusted to report:
    // rows come and go, and an observer attached to one goes with it.
    this.probe = h('div', { class: 'zx-table__row-probe', ariaHidden: 'true' });
    host.scroller.append(this.probe);
  }

  /** @returns {number} Rows in the table, drawn or not. */
  get total() {
    return this.entries.length;
  }

  /**
   * Starts following the size of the scroll region and of a row. The first measurement arrives
   * through the observer too, so it happens once the table is laid out and styled, however late it
   * is attached. It waits for the next frame because a measurement may resize the scroll region
   * itself, which an observer callback must not do.
   * @returns {void}
   */
  start() {
    this.live = true;
    this.observer = new ResizeObserver(() => this.schedule());
    this.observer.observe(this.host.scroller);
    this.observer.observe(this.probe);
  }

  /** Measures on the next frame, however many times this is asked before it. @returns {void} */
  schedule() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.measure());
  }

  /** Stops measuring. @returns {void} */
  stop() {
    this.live = false;
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Forgets every drawn row: the table is about to show none. @returns {void} */
  clear() {
    this.entries = [];
    this.drawn = new Map();
    this.spacers = [];
  }

  /**
   * Draws the window for a new set of entries into a fragment. The caller replaces the old rows
   * with it and has forgotten them already, so nothing is released here.
   * @param {any[]} entries Every row, in display order.
   * @param {DocumentFragment} fragment Receives the rows.
   * @returns {void}
   */
  fill(entries, fragment) {
    this.clear();
    this.entries = entries;
    this._lay(this._segments(), (node) => fragment.append(node));
  }

  /** Measures a table that has not been measured yet, once it can be. @returns {void} */
  settle() {
    if (this.live && !this.measured) this.measure();
  }

  /**
   * Reads the height of a row and of the scroll region, and redraws if either changed. A table that
   * is not laid out, detached or `display: none`, keeps what it knew.
   * @returns {void}
   */
  measure() {
    const row = this.drawn.values().next().value;
    if (!row?.isConnected) return;
    const { scroller, head, sticky } = this.host;
    const rowHeight = row.getBoundingClientRect().height;
    const region = scroller.clientHeight;
    if (!(rowHeight > 0) || !(region > 0)) return;
    const headHeight = head.getBoundingClientRect().height;
    const viewport = Math.max(rowHeight, region - (sticky ? headHeight : 0));
    const offset = sticky ? 0 : headHeight;
    const changed = rowHeight !== this.rowHeight || viewport !== this.viewport || offset !== this.offset;
    this.rowHeight = rowHeight;
    this.viewport = viewport;
    this.offset = offset;
    this.measured = true;
    if (changed) this.update();
  }

  /**
   * Brings the drawn rows in line with the scroll position and the pins: rows that left are removed,
   * rows that arrived are built, and rows that stayed are left exactly where they are.
   * @returns {void}
   */
  update() {
    if (this.total === 0) return;
    const segments = this._segments();
    const { drawn, spacers } = this;
    const { body, release, changed } = this.host;
    for (const [index, row] of drawn) {
      if (segments.some((part) => 'from' in part && index >= part.from && index < part.to)) continue;
      drawn.delete(index);
      row.remove();
      release(row);
    }
    // Out of the way first, so the only children left are rows that stay, in order, and laying the
    // segments over them never has to move one.
    for (const spacer of spacers) spacer.remove();
    let cursor = body.firstChild;
    this._lay(segments, (node) => {
      if (node === cursor) cursor = cursor.nextSibling;
      else body.insertBefore(node, cursor);
    });
    changed();
  }

  /**
   * Draws a row if it is not, with the scroll region moved so it is in view.
   * @param {number} index Row position.
   * @returns {HTMLElement|null} The row, or null when there is none at that position.
   */
  reveal(index) {
    if (index < 0 || index >= this.total) return null;
    this.measure();
    const position = this._position();
    const next = tableWindowScroll({
      index, rowHeight: this.rowHeight, scrollTop: position, viewport: this.viewport
    });
    if (next !== position) this.host.scroller.scrollTop = next + this.offset;
    this.update();
    return this.drawn.get(index) ?? null;
  }

  /** @returns {number} Distance the rows have scrolled past the first one. */
  _position() {
    return Math.max(0, this.host.scroller.scrollTop - this.offset);
  }

  /** @returns {Array<{from: number, to: number}|{gap: number}>} What the body should hold now. */
  _segments() {
    const { start, end } = tableWindow({
      total: this.total, rowHeight: this.rowHeight, scrollTop: this._position(), viewport: this.viewport
    });
    return tableWindowSegments(this.total, start, end, this.host.pins());
  }

  /**
   * Walks the segments and hands each node to `place`, building rows that are not drawn.
   * @param {Array<{from: number, to: number}|{gap: number}>} segments Segments in display order.
   * @param {(node: HTMLElement) => void} place Puts one node after the previous one.
   * @returns {void}
   */
  _lay(segments, place) {
    let gaps = 0;
    for (const part of segments) {
      if ('gap' in part) {
        place(this._spacer(gaps, part.gap));
        gaps += 1;
        continue;
      }
      for (let index = part.from; index < part.to; index += 1) {
        let row = this.drawn.get(index);
        if (!row) {
          row = this.host.draw(this.entries[index]);
          this.drawn.set(index, row);
        }
        place(row);
      }
    }
  }

  /**
   * The spacer row standing in for a run of rows that are not drawn.
   * @param {number} position Which gap this is, from the top.
   * @param {number} rows Rows it stands in for.
   * @returns {HTMLElement}
   */
  _spacer(position, rows) {
    let spacer = this.spacers[position];
    if (!spacer) {
      spacer = h('tr', { class: 'zx-table__spacer', ariaHidden: 'true' },
        h('td', { colspan: this.host.colspan() }));
      this.spacers[position] = spacer;
    }
    /** @type {HTMLElement} */ (spacer.firstElementChild).style.blockSize = `${rows * this.rowHeight}px`;
    return spacer;
  }
}
