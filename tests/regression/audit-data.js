import assert from 'node:assert/strict';

/*
 * Data and view components: a fitted pager following its viewport back up, Chart.js axes in the
 * theme's colours, the label of a pinned column group, lazy tree branches, the calendar's single
 * Tab stop and year grids, and a keyboard move of a selection that is not one unbroken run.
 */

export const cases = [
  {
    name: 'A fitted page size follows its viewport down and back up again',
    async run({ page }) {
      await page.evaluate(() => {
        const viewport = document.createElement('div');
        viewport.style.cssText = 'block-size:400px;overflow:auto;padding:0';
        viewport.append(document.createElement('div'));
        document.body.append(viewport);
        window.viewport = viewport;
        window.pager = new zx.Pagination(null, {
          pageSize: 'auto', pageSizes: ['auto', 25], total: 1000, viewport, rowHeight: 40, reserve: 0
        });
        document.body.append(pager.el);
      });
      const size = async (height) => {
        if (height) await page.evaluate((value) => { viewport.style.blockSize = `${value}px`; }, height);
        await page.waitForFunction((expected) => pager.getState().pageSize === expected, height / 40);
        return page.evaluate(() => pager.getState().pageSize);
      };
      assert.equal(await size(400), 10);
      // A drawer opens and closes, twice: the page shrinks with it and grows back every time.
      assert.equal(await size(200), 5);
      assert.equal(await size(400), 10);
      assert.equal(await size(200), 5);
      assert.equal(await size(400), 10);
      await page.evaluate(() => pager.destroy());
    }
  },
  {
    name: 'Chart.js axes take the theme text and border colours, not the engine defaults',
    async run({ page, base }) {
      await page.addScriptTag({ url: `${base}/node_modules/chart.js/dist/chart.umd.js` });
      const result = await page.evaluate(() => {
        const out = { scales: {} };
        for (const type of ['bar', 'radar']) {
          const host = document.createElement('div');
          host.style.inlineSize = '480px';
          document.body.append(host);
          const chart = new zx.Chart(host, {
            adapter: new zx.ChartJsAdapter(window.Chart), type,
            data: { labels: ['a', 'b', 'c'], datasets: [{ label: 'Series', data: [1, 2, 3] }] }
          });
          const instance = chart.getInstance();
          // The chart-level colours are the theme's, as the chart resolved it for the engine.
          out.text = instance.options.color;
          out.border = instance.options.borderColor;
          for (const [id, scale] of Object.entries(instance.scales)) {
            out.scales[`${type}.${id}`] = {
              ticks: scale.options.ticks.color,
              grid: scale.options.grid.color,
              labels: scale.options.pointLabels?.color ?? null
            };
          }
          chart.destroy();
          host.remove();
        }
        out.defaults = [window.Chart.defaults.color, window.Chart.defaults.borderColor];
        return out;
      });
      assert.deepEqual(Object.keys(result.scales), ['bar.x', 'bar.y', 'radar.r']);
      assert.ok(!result.defaults.includes(result.text) && !result.defaults.includes(result.border),
        `the theme colours differ from the engine defaults: ${JSON.stringify(result)}`);
      for (const [id, scale] of Object.entries(result.scales)) {
        assert.equal(scale.ticks, result.text, `${id} ticks`);
        assert.equal(scale.grid, result.border, `${id} grid`);
        if (scale.labels !== null) assert.equal(scale.labels, result.text, `${id} point labels`);
      }
    }
  },
  {
    name: 'The label of a group of pinned columns starts its cell instead of sticking at its far end',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const host = document.createElement('div');
        host.style.cssText = 'inline-size:700px;margin:8px';
        document.body.append(host);
        const columns = [
          { id: 'name', label: 'Name', width: '120px', pin: 'start', group: 'Who' },
          { id: 'role', label: 'Role', width: '120px', pin: 'start', group: 'Who' },
          ...['Q1', 'Q2'].flatMap((quarter) => ['plan', 'actual', 'delta'].map((kind) => ({
            id: `${quarter}${kind}`, label: kind, group: quarter, width: '110px', type: 'number'
          })))
        ];
        const data = Array.from({ length: 5 }, (_, index) => ({ id: index + 1, name: `Row ${index + 1}`, role: 'Lead' }));
        const table = new zx.Table(null, { rowId: 'id', columns, data });
        host.append(table.el);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const cell = table.el.querySelector('.zx-table__group[data-group="Who"]');
        const label = cell.querySelector('.zx-table__group-label');
        const scroll = table.el.querySelector('.zx-table__scroll');
        const offsets = () => {
          const box = cell.getBoundingClientRect();
          const text = label.getBoundingClientRect();
          return { start: Math.round(text.left - box.left), end: Math.round(box.right - text.right) };
        };
        const before = offsets();
        scroll.scrollLeft = 200;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const scrolled = offsets();
        // The unpinned group's label still follows the scroll position, clear of the pinned columns.
        const q2 = table.el.querySelector('.zx-table__group[data-group="Q2"] .zx-table__group-label');
        const pinnedEnd = cell.getBoundingClientRect().right;
        const q2Left = q2.getBoundingClientRect().left;
        return { pin: cell.dataset.pin, before, scrolled, q2Clear: q2Left >= pinnedEnd };
      });
      assert.equal(result.pin, 'start');
      assert.ok(result.before.start < 32, `label starts its cell: ${JSON.stringify(result.before)}`);
      assert.ok(result.before.end > 100, `label is not pushed to the end: ${JSON.stringify(result.before)}`);
      assert.deepEqual(result.scrolled, result.before, 'a pinned label does not move when the table scrolls');
      assert.ok(result.q2Clear, 'an unpinned label still sticks clear of the pinned columns');
    }
  },
  {
    name: 'A lazy branch marked expanded before it was loaded is collapsed until it loads',
    async run({ page }) {
      await page.evaluate(() => {
        window.loads = [];
        window.makeTree = (options = {}) => {
          const tree = new zx.TreeView(null, {
            items: [
              { ID: 'a', name: 'Alpha', hasChildren: true },
              { ID: 'b', name: 'Beta', hasChildren: true },
              { ID: 'c', name: 'Gamma' }
            ],
            load: (node) => {
              loads.push(node.ID);
              return Promise.resolve([{ ID: `${node.ID}1`, name: `${node.name} one` }, { ID: `${node.ID}2`, name: `${node.name} two` }]);
            },
            ...options
          });
          document.body.append(tree.el);
          return tree;
        };
        window.rows = (tree) => [...tree.el.querySelectorAll('[role="treeitem"]')]
          .map((row) => `${row.textContent}:${row.getAttribute('aria-expanded') ?? '-'}`);
        window.focused = () => document.activeElement?.textContent;
      });
      const wait = () => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 20)));

      // The `expanded` option: no loader call, and the row says collapsed, as it shows.
      await page.evaluate(() => { window.tree = makeTree({ expanded: ['a'] }); });
      assert.deepEqual(await page.evaluate(() => rows(tree)), ['Alpha:false', 'Beta:false', 'Gamma:-']);
      assert.deepEqual(await page.evaluate(() => loads), []);
      // → loads and opens it, focus stays; → again goes into the first child, not onto Beta.
      await page.locator('[role="treeitem"]', { hasText: 'Alpha' }).first().focus();
      await page.keyboard.press('ArrowRight');
      await wait();
      assert.deepEqual(await page.evaluate(() => rows(tree)),
        ['Alpha:true', 'Alpha one:-', 'Alpha two:-', 'Beta:false', 'Gamma:-']);
      assert.equal(await page.evaluate(() => focused()), 'Alpha');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => focused()), 'Alpha one');
      assert.deepEqual(await page.evaluate(() => loads), ['a']);
      await page.evaluate(() => tree.destroy());

      // toggle() on such a branch expands it (loading it), rather than collapsing nothing.
      await page.evaluate(async () => {
        loads.length = 0;
        window.tree = makeTree({ expanded: ['b'] });
        await tree.toggle('b');
      });
      assert.deepEqual(await page.evaluate(() => rows(tree)),
        ['Alpha:false', 'Beta:true', 'Beta one:-', 'Beta two:-', 'Gamma:-']);
      await page.evaluate(() => tree.destroy());

      // expandAll() opens loaded branches only; a filter leaves an unloaded branch closed too.
      await page.evaluate(() => {
        loads.length = 0;
        window.tree = makeTree();
        tree.expandAll();
      });
      assert.deepEqual(await page.evaluate(() => rows(tree)), ['Alpha:false', 'Beta:false', 'Gamma:-']);
      await page.evaluate(() => tree.setFilter('Al'));
      assert.deepEqual(await page.evaluate(() => rows(tree)), ['Alpha:false']);
      assert.deepEqual(await page.evaluate(() => loads), []);
      await page.evaluate(() => tree.destroy());

      // `*` expands every sibling, loading the lazy ones, and keeps focus where it was.
      await page.evaluate(() => {
        loads.length = 0;
        window.tree = makeTree();
      });
      await page.locator('[role="treeitem"]', { hasText: 'Alpha' }).first().focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('*');
      await wait();
      assert.deepEqual(await page.evaluate(() => rows(tree)), [
        'Alpha:true', 'Alpha one:-', 'Alpha two:-', 'Beta:true', 'Beta one:-', 'Beta two:-', 'Gamma:-'
      ]);
      assert.deepEqual(await page.evaluate(() => loads), ['a', 'b']);
      assert.equal(await page.evaluate(() => focused()), 'Beta');
      await page.evaluate(() => tree.destroy());
    }
  },
  {
    name: 'Month and year date cells share one Tab stop that the arrow keys carry',
    async run({ page }) {
      await page.evaluate(() => {
        window.calendar = new zx.Calendar(null, { view: 'month', date: new Date(2026, 10, 18), nowIndicator: false });
        document.body.append(calendar.el);
        window.stops = () => [...calendar.el.querySelectorAll('[data-date-cell]')]
          .filter((cell) => cell.tabIndex === 0).map((cell) => cell.dataset.date);
        window.focusedDate = () => document.activeElement?.dataset.date ?? null;
      });
      assert.deepEqual(await page.evaluate(() => stops()), ['2026-11-18'], 'the anchor date holds the only stop');
      assert.ok(await page.evaluate(() => calendar.el.querySelectorAll('.zx-calendar__month-day').length) >= 35);

      await page.locator('.zx-calendar__month-day[tabindex="0"]').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => focusedDate()), '2026-11-19');
      assert.deepEqual(await page.evaluate(() => stops()), ['2026-11-19'], 'the stop moves with the focus');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => focusedDate()), '2026-12-03');
      assert.deepEqual(await page.evaluate(() => stops()), ['2026-12-03']);
      // Past the last week shown: the calendar pages, and focus lands on the day itself.
      for (let week = 0; week < 3; week += 1) await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => focusedDate()), '2026-12-24');
      assert.equal(await page.evaluate(() => calendar.getDate().getMonth()), 11);
      assert.deepEqual(await page.evaluate(() => stops()), ['2026-12-24']);
      // Paging away from the focused day keeps the keyboard in the grid.
      await page.keyboard.press('PageDown');
      assert.ok(await page.evaluate(() => focusedDate()), 'focus stays on a date after PageDown');
      assert.deepEqual(await page.evaluate(() => stops()), [await page.evaluate(() => focusedDate())]);

      // The year: twelve grids of rows, each named by the heading outside it, one Tab stop in all.
      await page.evaluate(() => {
        calendar.setDate(new Date(2026, 10, 18));
        calendar.setView('year');
      });
      const year = await page.evaluate(() => {
        const grids = [...calendar.el.querySelectorAll('.zx-calendar__year-grid')];
        return {
          grids: grids.length,
          cells: calendar.el.querySelectorAll('.zx-calendar__year-day').length,
          stops: stops(),
          onlyRows: grids.every((grid) => [...grid.children].every((child) => child.getAttribute('role') === 'row')),
          named: grids.every((grid) => {
            const heading = document.getElementById(grid.getAttribute('aria-labelledby') ?? '');
            return heading?.localName === 'h3' && !grid.contains(heading) && heading.textContent.trim() !== '';
          }),
          cellsInRows: [...calendar.el.querySelectorAll('.zx-calendar__year-day')]
            .every((cell) => cell.parentElement.getAttribute('role') === 'row'),
          // Every day sits under its weekday name: the rows share the grid's seven columns.
          aligned: grids.every((grid) => {
            const heads = [...grid.querySelectorAll('[role="columnheader"]')].map((cell) => Math.round(cell.getBoundingClientRect().left));
            return [...grid.querySelectorAll('[role="row"]')].slice(1).every((row) =>
              [...row.children].every((cell, index) => Math.round(cell.getBoundingClientRect().left) === heads[index]));
          }),
          square: (() => {
            const box = calendar.el.querySelector('.zx-calendar__year-day').getBoundingClientRect();
            return Math.abs(box.width - box.height) < 1 && box.width > 10;
          })()
        };
      });
      assert.deepEqual(year, {
        grids: 12, cells: 365, stops: ['2026-11-18'], onlyRows: true, named: true, cellsInRows: true,
        aligned: true, square: true
      });
      await page.locator('.zx-calendar__year-day[tabindex="0"]').focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => focusedDate()), '2026-11-25');
      assert.deepEqual(await page.evaluate(() => stops()), ['2026-11-25']);
      await page.evaluate(() => calendar.destroy());
    }
  },
  {
    name: 'A keyboard move of a broken selection starts where the grabbed card is, and a drop in place moves nothing',
    async run({ page }) {
      const mount = () => page.evaluate(() => {
        window.board?.destroy();
        window.board = new zx.KanbanView(null, {
          fields: [{ id: 'title', label: 'Title' }, { id: 'stage', label: 'Stage' }],
          data: ['A', 'B', 'C', 'D'].map((title, index) => ({ ID: index + 1, title, stage: 'todo' })),
          recordId: 'ID', columnBy: 'stage', columns: [{ id: 'todo', label: 'To do' }, { id: 'done', label: 'Done' }],
          titleField: 'title', hiddenFields: ['stage'], moveMode: 'local',
          selectable: 'multi', selection: [1, 3], dragFrom: 'handle', moveHandle: 'always'
        });
        document.body.append(board.el);
      });
      const order = () => page.evaluate(() => board.getData()
        .filter((record) => record.stage === 'todo').map((record) => record.title).join(''));
      const grabC = () => page.locator('.zx-record-card', { hasText: 'C' })
        .locator('.zx-kanban-view__move-handle').focus();

      // Picked up and put down again: nothing moves, and A stays apart from C.
      await mount();
      await grabC();
      await page.keyboard.press('Space');
      await page.keyboard.press('Space');
      assert.equal(await order(), 'ABCD');
      assert.deepEqual(await page.evaluate(() => board.getSelectionIds()), [1, 3]);

      // Up and back down again is the same place.
      await grabC();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      assert.equal(await order(), 'ABCD');

      // One step up from C, which follows B: both cards go before B.
      await grabC();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Space');
      assert.equal(await order(), 'ACBD');
      await page.evaluate(() => board.destroy());
    }
  }
];
