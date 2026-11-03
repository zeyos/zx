# WP59 — Table at scale: measure, then window

Table draws every row by default. With `growing` it draws more as the reader scrolls, but rows it
has drawn stay in the DOM, so scrolling to the end of 10,000 rows leaves 10,000 rows on the page.
Only Tree virtualises. An ERP shows tables of that size. This WP first measures what large tables
cost, and then, only if a budget is missed, adds windowed rendering as an opt-in.

Work on the branch `wp/59-table-at-scale`, from `main`. `AGENTS.md` applies. `src/core/**` is
**not** in scope. `CHANGELOG.md` is central: report changelog lines. `docs/api.json` is
regenerated. Public files must not mention this spec.

## Decisions (binding)

1. **Measure first.** §1 is always done. §2 is done only if §1 misses the budget, and the report
   gives the numbers either way.
2. **The budget,** for 10,000 rows of eight columns on the machine running the benchmark:
   - first render under 400 ms;
   - a sort under 250 ms;
   - scripting under 4 ms per frame while scrolling;
   - under 150,000 DOM nodes after scrolling to the end.
3. **Windowing is opt-in.** `virtual: false` stays the default. Nothing changes for a table that
   does not ask for it.
4. **A windowed table stays one grid.** It keeps the APG grid semantics: `aria-rowcount` on the
   grid, `aria-rowindex` on every drawn row, and the full keyboard map moving through all rows,
   drawing them on demand. The focused row and a row being edited are never removed.
5. **Fixed row height.** A windowed table measures one row and takes that height for all, following
   `--zx-row-height`. Rows of differing height are not supported in this mode, and the
   documentation says so.

## §1 · Benchmark

**Scope:** new `tools/bench-table.js`, `package.json` (`bench:table`).

- Drives the installed Chrome through playwright-core, as `tools/run-smoke.js` does, on a random
  port.
- **Cases:** 1,000, 10,000 and 50,000 rows; plain, sorted with `selectable: 'multi'`, and grouped.
  With `--virtual` (once §2 exists), the same cases windowed.
- **Measures:** time to first render, time to sort, scripting time per frame during a scripted
  scroll to the end, DOM node count after it, and JS heap after it.
- **Output:** a table on stdout and `--json <file>`. The exit code is 1 when a Decision 2 budget is
  missed.

## §2 · Windowed rendering (only if §1 misses the budget)

**Scope:** `src/components/table/**`, new `src/components/table/window.js`,
`tests/unit/table-window.test.js`, `tests/smoke/smoke.js`, `website/demos/table.demo.js`,
`docs/llms.md`, `src/core/messages.js` (new keys only, if any).

- **`virtual: true`:** only the rows in view plus an overscan of one viewport above and below are in
  the DOM; spacer rows keep the scroll height.
- **`window.js`:** the pure window arithmetic (which rows to draw for a scroll position, viewport
  and row height, with overscan), unit-tested.
- **Must keep working when windowed:** sorting, selection (including Shift ranges over rows not
  drawn), filtering, grouping, row actions, inline editing, sticky header, export (which reads data,
  not the DOM), `reveal`/scroll-to-row, and keyboard navigation including Home, End, PageUp,
  PageDown and Ctrl+Home/End.
- `growing` and `virtual` together: `virtual` wins, and the conflict is reported once through the
  console.
- **Documented limits:** find-in-page does not see rows that are not drawn, and rows have one
  height.
- **Demo:** a 10,000-row windowed table with sorting and selection.

## Out of scope

- Windowing other views (CardView, KanbanView, Grid).
- Rows of variable height, and horizontal (column) windowing.
- Changing the default behaviour of Table.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean.
2. `npm run bench:table` runs; the report gives its numbers for every case, and states whether §2
   was needed.
3. If §2 was done:
   - `npm run bench:table -- --virtual` meets every budget;
   - unit tests cover the window arithmetic, including the first and last rows and an empty table;
   - smoke cases cover keyboard navigation to the last row and back, a Shift range over rows not
     drawn, sorting while scrolled, and that the focused row survives scrolling away;
   - the demo works in light and dark with no console errors.
4. Changelog lines are reported.
