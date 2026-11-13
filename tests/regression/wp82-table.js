import assert from 'node:assert/strict';

/*
 * WP82, Table and Grid: pinned columns, header groups, `setExpanded()`, the floor of an `fr`
 * column, clicks on controls inside cells, and construction without a ResizeObserver. Every case
 * runs in both themes; the fixtures are built in the page because nothing here needs a demo.
 */

/** Installs the fixture builders the cases share. @param {import('playwright-core').Page} page */
async function fixtures(page) {
  await page.evaluate(() => {
    window.frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.host = (width, dir) => {
      const element = document.createElement('div');
      element.style.cssText = `inline-size:${width}px;margin:8px`;
      if (dir) element.dir = dir;
      document.body.append(element);
      return element;
    };
    /** Twelve figure columns in four groups between a pinned name and a pinned total. */
    window.wideColumns = (extra = {}) => [
      { id: 'name', label: 'Name', width: '200px', pin: 'start', ...extra.name },
      { id: 'owner', label: 'Owner', width: '140px', ...extra.owner },
      ...['Q1', 'Q2', 'Q3', 'Q4'].flatMap((quarter) => ['plan', 'actual', 'delta'].map((kind) => ({
        id: `${quarter}${kind}`, label: kind, group: quarter, width: '110px', type: 'number'
      }))),
      { id: 'total', label: 'Total', width: '120px', pin: 'end', type: 'number', ...extra.total }
    ];
    window.wideRows = (count, parents = false) => Array.from({ length: count }, (_, index) => {
      const row = {
        id: index + 1, name: `Row ${index + 1}`, owner: 'Owner', total: index * 12,
        parent: parents && index % 5 !== 0 ? index - index % 5 + 1 : null
      };
      for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        for (const kind of ['plan', 'actual', 'delta']) row[`${quarter}${kind}`] = index + 1;
      }
      return row;
    });
    window.rect = (element) => {
      const box = element.getBoundingClientRect();
      return { left: Math.round(box.left), right: Math.round(box.right), top: Math.round(box.top), bottom: Math.round(box.bottom), width: Math.round(box.width) };
    };
  });
}

export const cases = [
  {
    name: 'Pinned columns hold their edge while the table scrolls inline, in both directions',
    async run({ page }) {
      await fixtures(page);
      const result = await page.evaluate(async () => {
        const measure = async (dir) => {
          const box = host(700, dir);
          const table = new zx.Table(null, {
            rowId: 'id', height: 240, selectable: 'multi', columns: wideColumns(), data: wideRows(30)
          });
          box.append(table.el);
          await frame();
          const scroll = table.el.querySelector('.zx-table__scroll');
          // A row that is still below the two sticky header rows once the table has scrolled down.
          const row = table.el.querySelector('tbody tr[data-row]:nth-child(8)');
          table.setSelection([8]);
          const cells = () => ({
            scroll: rect(scroll), checkbox: rect(row.cells[0]), name: rect(row.cells[1]),
            total: rect(row.cells[row.cells.length - 1]), owner: rect(row.cells[2]),
            headName: rect(table.el.querySelector('th[data-column="name"]')),
            headRowTop: rect(table.el.querySelector('.zx-table__group')).top
          });
          const before = cells();
          scroll.scrollLeft = dir === 'rtl' ? -500 : 500;
          scroll.scrollTop = 120;
          await frame();
          const after = cells();
          const name = row.cells[1];
          const point = rect(name);
          const onTop = document.elementFromPoint(point.left + 20, point.top + 10)?.closest('td, th');
          const corner = table.el.querySelector('th[data-column="name"]');
          const cornerPoint = rect(corner);
          const cornerOnTop = document.elementFromPoint(cornerPoint.left + 20, cornerPoint.top + 10)?.closest('td, th');
          const style = getComputedStyle(name);
          const plain = getComputedStyle(table.el.querySelector('tbody tr[data-row]:nth-child(9)').cells[1]);
          const out = {
            before, after, moved: Math.abs(scroll.scrollLeft), scrolledDown: scroll.scrollTop,
            onTop: onTop === name, cornerOnTop: cornerOnTop === corner,
            position: style.position, base: style.backgroundColor, layers: style.backgroundImage,
            plainLayers: plain.backgroundImage, rowFill: getComputedStyle(row).backgroundColor,
            edgeStart: style.borderInlineEndWidth,
            edgeEnd: getComputedStyle(row.cells[row.cells.length - 1]).borderInlineStartWidth,
            pins: [...row.cells].map((cell) => cell.dataset.pin ?? '').join(',')
          };
          table.destroy();
          box.remove();
          return out;
        };
        return { ltr: await measure('ltr'), rtl: await measure('rtl') };
      });
      for (const [dir, run] of Object.entries(result)) {
        assert.ok(run.moved >= 400, `${dir}: the table scrolled inline (${run.moved})`);
        assert.ok(run.scrolledDown > 0, `${dir}: the table scrolled down`);
        assert.equal(run.position, 'sticky', dir);
        // The checkbox column is pinned with the first start column, and the two stack.
        assert.equal(run.pins.split(',').slice(0, 3).join(','), 'start,start,', dir);
        assert.ok(run.pins.endsWith(',end'), dir);
        const { scroll, checkbox, name, total, owner } = run.after;
        if (dir === 'ltr') {
          assert.ok(Math.abs(checkbox.left - scroll.left) <= 1, `checkbox at the start edge ${checkbox.left}/${scroll.left}`);
          assert.ok(Math.abs(name.left - checkbox.right) <= 1, 'name follows the checkbox column');
          assert.ok(Math.abs(total.right - scroll.right) <= 1, 'total at the end edge');
          assert.ok(owner.right <= name.right, 'the unpinned column scrolled under the pinned one');
        } else {
          assert.ok(Math.abs(checkbox.right - scroll.right) <= 1, `checkbox at the start edge ${checkbox.right}/${scroll.right}`);
          assert.ok(Math.abs(name.right - checkbox.left) <= 1, 'name follows the checkbox column');
          assert.ok(Math.abs(total.left - scroll.left) <= 1, 'total at the end edge');
          assert.ok(owner.left >= name.left, 'the unpinned column scrolled under the pinned one');
        }
        assert.equal(run.after.name.left, run.before.name.left, `${dir}: pinned cell did not move inline`);
        assert.equal(run.after.headName.top, run.before.headName.top, `${dir}: header did not move`);
        assert.equal(run.after.headRowTop, run.before.headRowTop, `${dir}: group row did not move`);
        assert.ok(run.onTop, `${dir}: the pinned cell paints over the cells scrolled under it`);
        assert.ok(run.cornerOnTop, `${dir}: the pinned header cell paints over body and header`);
        // Opaque base, with the selected row's fill laid over it — never a see-through cell.
        assert.doesNotMatch(run.base, /rgba\(0, 0, 0, 0\)|transparent/, dir);
        assert.ok(run.layers.includes(run.rowFill.replace(/^rgba?\(|\)$/g, '').split(',')[0].trim()),
          `${dir}: the selected fill ${run.rowFill} is part of ${run.layers}`);
        assert.notEqual(run.layers, run.plainLayers, `${dir}: a selected pinned cell differs from an unselected one`);
        assert.equal(run.edgeStart, '1px', dir);
        assert.equal(run.edgeEnd, '1px', dir);
      }
    }
  },
  {
    name: 'Header groups span their columns, stick as two rows, and keep the row indices right',
    async run({ page }) {
      await fixtures(page);
      const result = await page.evaluate(async () => {
        const out = {};
        for (const mode of ['plain', 'hierarchy', 'virtual']) {
          const box = host(700);
          const table = new zx.Table(null, {
            rowId: 'id', height: 240, columns: wideColumns(), data: wideRows(60, mode === 'hierarchy'),
            virtual: mode === 'virtual',
            hierarchy: mode === 'hierarchy' ? { parentId: 'parent', column: 'name', expanded: true } : false,
            interactive: true, label: 'Plan'
          });
          box.append(table.el);
          await frame();
          const scroll = table.el.querySelector('.zx-table__scroll');
          scroll.scrollTop = 400;
          scroll.scrollLeft = 300;
          await frame();
          const groupRow = table.el.querySelector('.zx-table__group-row');
          const headerRow = table.el.querySelector('.zx-table__header-row');
          const firstBody = table.el.querySelector('tbody tr[data-row]');
          const label = table.el.querySelector('.zx-table__group[data-group="Q1"] .zx-table__group-label');
          out[mode] = {
            role: table.el.querySelector('table').getAttribute('role'),
            cells: [...groupRow.cells].map((cell) =>
              `${cell.tagName}/${cell.colSpan}/${cell.textContent}/${cell.getAttribute('scope') ?? ''}/${cell.dataset.pin ?? ''}`),
            headerCells: headerRow.cells.length,
            rows: table.el.querySelectorAll('thead tr').length,
            groupTop: rect(groupRow.cells[2]).top - rect(scroll).top - scroll.clientTop,
            labelsTop: rect(headerRow.cells[2]).top - rect(groupRow.cells[2]).bottom,
            groupIndex: groupRow.getAttribute('aria-rowindex'),
            headerIndex: headerRow.getAttribute('aria-rowindex'),
            rowcount: table.el.querySelector('table').getAttribute('aria-rowcount'),
            colcount: table.el.querySelector('table').getAttribute('aria-colcount'),
            bodyIndex: firstBody.getAttribute('aria-rowindex'),
            bodyPosition: table._rowMeta.get(firstBody).visibleIndex,
            bodyCells: firstBody.cells.length,
            labelLeft: rect(label).left - rect(scroll).left,
            attr: table.el.hasAttribute('data-header-groups')
          };
          // Hiding a column inside a group shortens the span; hiding the whole group drops its cell.
          table.setColumnVisible('Q1delta', false);
          out[mode].afterHide = [...table.el.querySelectorAll('.zx-table__group')].map((cell) => `${cell.textContent}/${cell.colSpan}`);
          for (const id of ['Q2plan', 'Q2actual', 'Q2delta']) table.setColumnVisible(id, false);
          out[mode].afterGroupHidden = [...table.el.querySelectorAll('.zx-table__group')].map((cell) => `${cell.textContent}/${cell.colSpan}`);
          table.setColumns([{ id: 'name', label: 'Name' }, { id: 'owner', label: 'Owner' }]);
          out[mode].ungrouped = {
            rows: table.el.querySelectorAll('thead tr').length,
            attr: table.el.hasAttribute('data-header-groups'),
            bodyIndex: table.el.querySelector('tbody tr[data-row]').getAttribute('aria-rowindex'),
            vars: scroll.getAttribute('style')
          };
          table.destroy();
          box.remove();
        }
        return out;
      });
      for (const [mode, run] of Object.entries(result)) {
        assert.equal(run.role, mode === 'hierarchy' ? 'treegrid' : 'grid', mode);
        assert.deepEqual(run.cells, [
          'TD/1///start', 'TD/1///', 'TH/3/Q1/col/', 'TH/3/Q2/col/', 'TH/3/Q3/col/', 'TH/3/Q4/col/', 'TD/1///end'
        ], mode);
        assert.equal(run.headerCells, 15, mode);
        assert.equal(run.bodyCells, 15, mode);
        assert.equal(run.rows, 2, mode);
        assert.equal(run.colcount, '15', mode);
        assert.ok(run.attr, mode);
        // Scrolled down: the group row is at the top of the region and the labels right below it.
        assert.ok(Math.abs(run.groupTop) <= 1, `${mode}: group row sticks (${run.groupTop})`);
        assert.ok(Math.abs(run.labelsTop) <= 1, `${mode}: label row sticks below it (${run.labelsTop})`);
        // The Q1 label follows the scroll position inside its cell, clear of the pinned column.
        assert.ok(run.labelLeft >= 200, `${mode}: group label clears the pinned column (${run.labelLeft})`);
        if (mode === 'virtual') {
          assert.equal(run.groupIndex, '1');
          assert.equal(run.headerIndex, '2');
          assert.equal(run.rowcount, '62');
          assert.equal(Number(run.bodyIndex), run.bodyPosition + 3, 'body rows count both header rows');
        } else {
          assert.equal(run.groupIndex, null, mode);
          assert.equal(run.rowcount, null, mode);
        }
        assert.deepEqual(run.afterHide, ['Q1/2', 'Q2/3', 'Q3/3', 'Q4/3'], mode);
        assert.deepEqual(run.afterGroupHidden, ['Q1/2', 'Q3/3', 'Q4/3'], mode);
        assert.equal(run.ungrouped.rows, 1, mode);
        assert.equal(run.ungrouped.attr, false, mode);
        assert.doesNotMatch(run.ungrouped.vars ?? '', /--zx-table-pin|--zx-table-group/, `${mode}: offsets are cleared`);
        if (mode === 'virtual') assert.equal(run.ungrouped.bodyIndex, '2');
      }
    }
  },
  {
    name: 'Pins follow column changes, survive windowing and editing, and step aside when stacked',
    async run({ page }) {
      await fixtures(page);
      const result = await page.evaluate(async () => {
        const box = host(700);
        const table = new zx.Grid(null, {
          rowId: 'id', height: 240, virtual: true, rowReorder: true, selectable: 'multi', editMode: 'cell',
          columns: wideColumns({ name: { editable: true }, owner: { pin: 'start', width: '100px' } }),
          data: wideRows(400)
        });
        box.append(table.el);
        await frame();
        const scroll = table.el.querySelector('.zx-table__scroll');
        const out = { initial: scroll.getAttribute('style') };
        scroll.scrollTop = 6000;
        scroll.scrollLeft = 300;
        await frame();
        const row = [...table.el.querySelectorAll('tbody tr[data-row]')].find((tr) => rect(tr).top > rect(scroll).top + 80);
        out.drawnPins = [...row.cells].map((cell) => cell.dataset.pin ?? '').join(',');
        out.lefts = [...row.cells].slice(0, 4).map((cell) => rect(cell).left - rect(scroll).left);
        out.widths = [...row.cells].slice(0, 4).map((cell) => rect(cell).width);
        out.edges = [...row.cells].map((cell, index) => cell.hasAttribute('data-pin-edge') ? index : null).filter((index) => index !== null);
        // Editing a pinned cell must not unpin it.
        table.startEdit(table._rowMeta.get(row).id, 'name');
        const editing = table.el.querySelector('td[data-editing="true"]');
        out.editingPosition = getComputedStyle(editing).position;
        out.editingLeft = rect(editing).left - rect(scroll).left;
        table.cancelEdit();
        // Hiding a pinned column closes the gap it leaves in the offsets.
        table.setColumnVisible('name', false);
        await frame();
        const next = table.el.querySelector('tbody tr[data-row]');
        out.afterHide = {
          owner: rect(next.querySelector('td[data-column="owner"]')).left - rect(scroll).left,
          edge: next.querySelector('td[data-column="owner"]').hasAttribute('data-pin-edge'),
          start: scroll.style.getPropertyValue('--zx-table-pin-start')
        };
        table.setColumnVisible('name', true);
        // Moving a pinned column changes which one sits nearer the edge.
        table.setColumnOrder(['owner', 'name']);
        await frame();
        const moved = table.el.querySelector('tbody tr[data-row]');
        out.afterMove = {
          owner: rect(moved.querySelector('td[data-column="owner"]')).left - rect(scroll).left,
          name: rect(moved.querySelector('td[data-column="name"]')).left - rect(scroll).left
        };
        table.destroy();
        box.remove();

        const narrow = host(360);
        const stacked = new zx.Table(null, {
          rowId: 'id', responsive: 'md', columns: wideColumns(), data: wideRows(3)
        });
        narrow.append(stacked.el);
        await frame();
        await frame();
        const cell = stacked.el.querySelector('tbody td[data-pin]');
        out.stacked = {
          on: stacked.isStacked(), position: getComputedStyle(cell).position,
          edge: getComputedStyle(cell).borderInlineEndWidth, base: getComputedStyle(cell).backgroundColor
        };
        stacked.destroy();
        narrow.remove();
        return out;
      });
      assert.match(result.initial, /--zx-table-pin-start-3:/, 'handle, checkbox and two columns take four start slots');
      assert.equal(result.drawnPins.split(',').slice(0, 5).join(','), 'start,start,start,start,');
      assert.ok(result.drawnPins.endsWith(',end'));
      // Each pinned cell starts where the one before it ends.
      let edge = 0;
      result.lefts.forEach((left, index) => {
        assert.ok(Math.abs(left - edge) <= 1, `pinned cell ${index} at ${left}, expected ${edge}`);
        edge += result.widths[index];
      });
      assert.deepEqual(result.edges, [3, 16], 'the rule sits on the last start column and the first end column');
      assert.equal(result.editingPosition, 'sticky');
      assert.ok(Math.abs(result.editingLeft - result.lefts[2]) <= 1, 'the edited cell stays pinned');
      assert.ok(Math.abs(result.afterHide.owner - (result.lefts[2])) <= 1, 'the next pinned column moves up');
      assert.equal(result.afterHide.edge, true);
      assert.ok(Math.abs(result.afterMove.owner - result.lefts[2]) <= 1);
      assert.ok(result.afterMove.name > result.afterMove.owner);
      assert.equal(result.stacked.on, true);
      assert.equal(result.stacked.position, 'static');
      assert.equal(result.stacked.edge, '0px');
      assert.match(result.stacked.base, /rgba\(0, 0, 0, 0\)/, 'a card line has no fill of its own');
    }
  },
  {
    name: 'A cell focused by keyboard scrolls clear of the pinned columns',
    async run({ page }) {
      await fixtures(page);
      await page.evaluate(async () => {
        window.box = host(700);
        window.table = new zx.Table(null, {
          rowId: 'id', height: 240, editMode: 'cell', label: 'Plan',
          columns: wideColumns({ owner: { editable: true } }), data: wideRows(12)
        });
        box.append(table.el);
        await frame();
        table.el.querySelector('tbody td[data-column="total"]').focus();
      });
      // Walk back from the end-pinned column: each cell focused must be outside both pinned areas.
      for (let step = 0; step < 6; step += 1) await page.keyboard.press('ArrowLeft');
      const result = await page.evaluate(() => {
        const scroll = table.el.querySelector('.zx-table__scroll');
        const active = document.activeElement;
        const row = active.closest('tr');
        return {
          column: active.dataset.column, cell: rect(active),
          nameRight: rect(row.querySelector('td[data-column="name"]')).right,
          totalLeft: rect(row.querySelector('td[data-column="total"]')).left,
          scrollLeft: scroll.scrollLeft
        };
      });
      assert.equal(result.column, 'Q3plan');
      assert.ok(result.scrollLeft > 0);
      assert.ok(result.cell.left >= result.nameRight - 1, `focused cell is not under the start pin (${result.cell.left} / ${result.nameRight})`);
      assert.ok(result.cell.right <= result.totalLeft + 1, `focused cell is not under the end pin (${result.cell.right} / ${result.totalLeft})`);
    }
  },
  {
    name: 'A click on a control inside a cell does not activate the row',
    async run({ page }) {
      await fixtures(page);
      await page.evaluate(() => {
        window.events = [];
        const control = (kind) => {
          const make = (tag, props = {}) => Object.assign(document.createElement(tag), props);
          switch (kind) {
            case 'button': return make('button', { type: 'button', textContent: 'Go' });
            case 'icon-in-button': {
              const button = make('button', { type: 'button' });
              button.append(make('span', { textContent: 'x', className: 'inner' }));
              return button;
            }
            case 'link': return make('a', { href: '#x', textContent: 'Open' });
            case 'input': return make('input', { type: 'text', ariaLabel: 'Note' });
            case 'checkbox-label': {
              const label = make('label', { textContent: 'Flag ' });
              label.append(make('input', { type: 'checkbox' }));
              return label;
            }
            case 'select': {
              const select = make('select', { ariaLabel: 'Pick' });
              select.append(make('option', { textContent: 'One' }));
              return select;
            }
            case 'textarea': return make('textarea', { ariaLabel: 'Text' });
            case 'role-button': {
              const element = make('span', { textContent: 'Do' });
              element.setAttribute('role', 'button');
              element.tabIndex = 0;
              return element;
            }
            case 'role-switch': {
              const element = make('span', { textContent: 'On' });
              element.setAttribute('role', 'switch');
              return element;
            }
            case 'editable': {
              const element = make('span', { textContent: 'Edit me' });
              element.setAttribute('contenteditable', '');
              return element;
            }
            case 'opt-out': {
              const element = make('span', { textContent: 'Mine' });
              element.setAttribute('data-zx-table-no-edit', '');
              return element;
            }
            case 'toggle': return new zx.Toggle(null, { label: 'Active' }).el;
            default: return make('span', { textContent: 'plain text', className: 'plain' });
          }
        };
        window.kinds = ['button', 'icon-in-button', 'link', 'input', 'checkbox-label', 'select', 'textarea',
          'role-button', 'role-switch', 'editable', 'opt-out', 'toggle', 'text'];
        window.build = (Class, options = {}) => {
          const table = new Class(null, {
            rowId: 'id', selectable: 'single', label: 'Controls',
            columns: [{ id: 'name', label: 'Name' }, ...kinds.map((kind) => ({
              id: kind, label: kind, render: () => control(kind)
            }))],
            data: [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }],
            onrowclick: (event) => events.push(`rowclick:${event.detail.id}`),
            onrowdblclick: (event) => events.push(`rowdblclick:${event.detail.id}`),
            ...options
          });
          document.body.append(table.el);
          return table;
        };
        document.addEventListener('click', (event) => {
          if (event.target.closest?.('a[href]')) event.preventDefault();
        });
      });
      for (const Class of ['Table', 'Grid']) {
        const fired = await page.evaluate((Class) => {
          const table = build(zx[Class]);
          const out = {};
          const row = table.el.querySelector('tbody tr[data-row]:nth-child(2)');
          for (const kind of kinds) {
            events.length = 0;
            const cell = row.querySelector(`td[data-column="${kind}"]`);
            const target = cell.querySelector('.inner, .plain, input, button, a, select, textarea, label, [role], [contenteditable], [data-zx-table-no-edit]') ?? cell;
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            out[kind] = events.join(',');
          }
          out.selection = table.getSelection().map((entry) => entry.id).join(',');
          events.length = 0;
          row.cells[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
          out.cell = events.join(',');
          out.selectionAfterCell = table.getSelection().map((entry) => entry.id).join(',');
          table.destroy();
          table.el.remove();
          return out;
        }, Class);
        for (const kind of ['button', 'icon-in-button', 'link', 'input', 'checkbox-label', 'select', 'textarea',
          'role-button', 'role-switch', 'editable', 'opt-out', 'toggle']) {
          assert.equal(fired[kind], '', `${Class}: a click on ${kind} stays with the control`);
        }
        assert.equal(fired.text, 'rowclick:2,rowdblclick:2', `${Class}: plain content still activates the row`);
        assert.equal(fired.selection, '2', `${Class}: only the plain click selected the row`);
        assert.equal(fired.cell, 'rowclick:2', Class);
      }

      // Real pointer and keyboard: the button keeps its own click, Enter on the row still activates.
      await page.evaluate(() => {
        window.table = build(zx.Table, { rowKind: 'kind', rowKinds: { section: { span: true, render: () => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Collapse section';
          button.addEventListener('click', () => events.push('section-button'));
          return button;
        } } } });
        table.addData([{ id: 3, kind: 'section', name: 'Section' }]);
        table.el.querySelector('tbody tr[data-row] td[data-column="button"] button')
          .addEventListener('click', () => events.push('button'));
        events.length = 0;
      });
      await page.locator('tbody tr[data-row]').first().locator('td[data-column="button"] button').click();
      await page.getByRole('button', { name: 'Collapse section' }).click();
      assert.deepEqual(await page.evaluate(() => [...events]), ['button', 'section-button']);
      await page.evaluate(() => { events.length = 0; table.el.querySelector('tbody tr[data-row]').focus(); });
      await page.keyboard.press('Enter');
      assert.deepEqual(await page.evaluate(() => [...events]), ['rowclick:1']);
      // Enter on the button inside the cell is the button's, as before.
      await page.evaluate(() => {
        events.length = 0;
        table.el.querySelector('tbody tr[data-row] td[data-column="button"] button').focus();
      });
      await page.keyboard.press('Enter');
      assert.deepEqual(await page.evaluate(() => [...events]), ['button']);
    }
  },
  {
    name: 'An fr column keeps its floor in a narrow container and the table scrolls inline',
    async run({ page }) {
      await fixtures(page);
      const result = await page.evaluate(async () => {
        const measure = async (width, options, columns) => {
          const box = host(width);
          const table = new zx.Table(null, {
            rowId: 'id', height: 200, columns,
            data: Array.from({ length: 40 }, (_, id) => ({ id, a: 'alpha', b: 'a long middle value', c: 'gamma' })),
            ...options
          });
          box.append(table.el);
          await frame();
          const scroll = table.el.querySelector('.zx-table__scroll');
          const out = {
            widths: [...table.el.querySelectorAll('thead th')].map((th) => rect(th).width),
            overflow: scroll.scrollWidth - scroll.clientWidth,
            rem: parseFloat(getComputedStyle(document.documentElement).fontSize)
          };
          table.destroy();
          box.remove();
          return out;
        };
        const columns = (b = {}) => [
          { id: 'a', label: 'A', width: '10rem' }, { id: 'b', label: 'B', width: '1fr', ...b }, { id: 'c', label: 'C', width: '8rem' }
        ];
        return {
          virtual: await measure(320, { virtual: true }, columns()),
          plain: await measure(320, {}, columns()),
          explicit: await measure(320, { virtual: true }, columns({ minWidth: '12rem' })),
          pixels: await measure(320, { virtual: true }, columns({ minWidth: 150 })),
          lifted: await measure(320, { virtual: true }, columns({ minWidth: 0 })),
          wide: await measure(900, { virtual: true }, columns()),
          shares: await measure(300, {}, [{ id: 'a', label: 'A', width: '3fr' }, { id: 'b', label: 'B', width: '1fr' }]),
          checkbox: await measure(320, { virtual: true, selectable: 'multi' }, columns())
        };
      });
      const rem = result.virtual.rem;
      for (const mode of ['virtual', 'plain']) {
        assert.deepEqual(result[mode].widths.map(Math.round), [10 * rem, 5 * rem, 8 * rem], mode);
        assert.ok(result[mode].overflow > 0, `${mode}: the scroll region scrolls inline`);
      }
      assert.equal(result.explicit.widths[1], 12 * rem);
      assert.equal(result.pixels.widths[1], 150);
      assert.ok(result.lifted.widths[1] < 5 * rem, 'minWidth: 0 lifts the floor');
      assert.equal(result.lifted.overflow, 0);
      // Room to spare: nothing changes, the fr column takes what is left and nothing scrolls.
      assert.equal(result.wide.overflow, 0);
      assert.ok(result.wide.widths[1] > 500);
      // The smaller share reaches the floor, so the table is four floors wide.
      assert.ok(result.shares.widths[1] >= 5 * rem - 1, `1fr beside 3fr keeps its floor (${result.shares.widths[1]})`);
      assert.ok(Math.abs(result.shares.widths[0] - 3 * result.shares.widths[1]) <= 2);
      assert.ok(result.checkbox.widths[2] >= 5 * rem - 1, 'the checkbox column is counted in the minimum');
    }
  },
  {
    name: 'A windowed, pinned table constructs and works without ResizeObserver',
    async run({ page }) {
      await fixtures(page);
      const result = await page.evaluate(async () => {
        const saved = window.ResizeObserver;
        delete window.ResizeObserver;
        const out = {};
        try {
          const box = host(600);
          const table = new zx.Table(null, {
            rowId: 'id', height: 240, virtual: true, selectable: 'multi', responsive: 'sm',
            columns: wideColumns(), data: wideRows(500)
          });
          box.append(table.el);
          out.drawnAtOnce = table.getRenderedCount();
          await frame();
          const scroll = table.el.querySelector('.zx-table__scroll');
          out.pinStart = scroll.style.getPropertyValue('--zx-table-pin-start');
          scroll.scrollTop = 9000;
          await frame();
          out.drawn = table.getRenderedCount();
          out.firstIndex = Math.max(...[...table.el.querySelectorAll('tbody tr[data-row]')].map((tr) => Number(tr.getAttribute('aria-rowindex'))));
          out.revealed = table.reveal(499);
          table.setColumnVisible('owner', false);
          table.setData(wideRows(20));
          out.afterData = table.getRenderedCount();
          table.destroy();
          box.remove();
          const detached = new zx.Grid(null, { virtual: true, rowId: 'id', columns: wideColumns(), data: wideRows(50) });
          out.detached = detached.getRenderedCount();
          detached.destroy();
        } catch (error) {
          out.error = String(error?.stack ?? error);
        }
        window.ResizeObserver = saved;
        return out;
      });
      assert.equal(result.error, undefined, result.error);
      assert.ok(result.drawnAtOnce > 0 && result.drawnAtOnce < 500, `drew a window, not every row (${result.drawnAtOnce})`);
      assert.match(result.pinStart, /^\d+px$/, 'the pinned offsets are measured on a frame instead');
      assert.ok(result.drawn > 0 && result.drawn < 100, `still windowed after a scroll (${result.drawn})`);
      assert.ok(result.firstIndex > 100, 'the window followed the scroll position');
      assert.equal(result.revealed, true);
      assert.ok(result.afterData > 0);
      assert.ok(result.detached > 0);
    }
  },
  {
    name: 'setExpanded replaces the expanded branches with one render',
    async run({ page }) {
      await fixtures(page);
      const result = await page.evaluate(async () => {
        const toggles = [];
        const table = new zx.Table(null, {
          rowId: 'id', columns: [{ id: 'name', label: 'Name' }], data: wideRows(40, true),
          hierarchy: { parentId: 'parent', expanded: [1, 6] },
          onrowtoggle: (event) => toggles.push(`${event.detail.id}:${event.detail.expanded}`)
        });
        document.body.append(table.el);
        let renders = 0;
        const render = table._renderBody.bind(table);
        table._renderBody = () => { renders += 1; render(); };
        const rows = () => table.el.querySelectorAll('tbody tr[data-row]').length;
        const out = { initial: table.getExpanded(), initialRows: rows() };

        table.el.querySelector('tbody tr[data-row]').focus();
        table.setExpanded([6, 11, 16, 999, 2]);
        out.replaced = { expanded: table.getExpanded(), renders, toggles: [...toggles], rows: rows(),
          focus: document.activeElement?.closest('tr')?.textContent, ariaFirst: table.el.querySelector('tbody tr').getAttribute('aria-expanded') };

        renders = 0; toggles.length = 0;
        table.setExpanded([16, 11, 6]);
        out.same = { renders, toggles: [...toggles] };

        table.setExpanded(true, { silent: true });
        out.all = { expanded: table.getExpanded().length, renders, toggles: [...toggles], rows: rows() };

        renders = 0;
        table.setExpanded(false);
        out.none = { expanded: table.getExpanded(), renders, toggles: toggles.length, rows: rows() };

        const flat = new zx.Table(null, { rowId: 'id', columns: [{ id: 'name', label: 'Name' }], data: wideRows(3) });
        out.flat = flat.setExpanded([1]) === flat && flat.getExpanded().length === 0;
        flat.destroy();
        table.destroy();
        table.el.remove();
        return out;
      });
      assert.deepEqual(result.initial, [1, 6]);
      assert.equal(result.initialRows, 8 + 8);
      assert.deepEqual(result.replaced.expanded, [6, 11, 16], 'unknown ids and leaves are dropped');
      assert.equal(result.replaced.renders, 1);
      assert.deepEqual(result.replaced.toggles, ['1:false', '11:true', '16:true'], 'collapsed first, then expanded');
      assert.equal(result.replaced.rows, 8 + 12);
      assert.equal(result.replaced.ariaFirst, 'false');
      assert.equal(result.replaced.focus, 'Row 1', 'the focused row keeps focus across the render');
      assert.deepEqual(result.same, { renders: 0, toggles: [] }, 'an equal set renders and fires nothing');
      assert.deepEqual(result.all, { expanded: 8, renders: 1, toggles: [], rows: 40 });
      assert.deepEqual(result.none, { expanded: [], renders: 1, toggles: 8, rows: 8 });
      assert.equal(result.flat, true, 'a table without hierarchy ignores the call');
    }
  }
];
