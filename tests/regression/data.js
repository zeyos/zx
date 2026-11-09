import assert from 'node:assert/strict';

const accelerator = process.platform === 'darwin' ? 'Meta' : 'Control';

export const cases = [
  {
    name: 'CodeEditor indentation has native undo/redo and commits once on blur',
    async run({ page }) {
      await page.evaluate(() => {
        window.changes = [];
        window.inputs = [];
        window.editor = new zx.CodeEditor(null, {
          value: 'alpha', indent: '  ',
          onchange: (event) => changes.push(event.detail.value),
          oninput: (event) => inputs.push(event.detail.value)
        });
        const outside = document.createElement('button');
        outside.textContent = 'Outside';
        document.body.append(editor.el, outside);
        editor.focus();
        editor.el.querySelector('textarea').setSelectionRange(5, 5);
      });
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('textarea').inputValue(), 'alpha  ');
      assert.deepEqual(await page.evaluate(() => inputs), ['alpha  ']);
      await page.keyboard.press(`${accelerator}+z`);
      assert.equal(await page.locator('textarea').inputValue(), 'alpha');
      await page.keyboard.press(`${accelerator}+Shift+z`);
      assert.equal(await page.locator('textarea').inputValue(), 'alpha  ');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Outside');
      assert.deepEqual(await page.evaluate(() => changes), ['alpha  ']);

      await page.locator('textarea').focus();
      await page.keyboard.press(`${accelerator}+End`);
      await page.keyboard.type('x');
      await page.keyboard.press('Tab');
      await page.keyboard.type('y');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Tab');
      assert.deepEqual(await page.evaluate(() => changes), ['alpha  ', 'alpha  x  y']);
      await page.locator('textarea').focus();
      await page.getByRole('button', { name: 'Outside' }).click();
      assert.equal(await page.evaluate(() => changes.length), 2, 'unchanged blur does not commit');
      await page.evaluate(() => { editor.focus(); editor.setValue('replacement', { silent: true }); });
      await page.getByRole('button', { name: 'Outside' }).click();
      assert.equal(await page.evaluate(() => changes.length), 2, 'silent programmatic replacement stays silent');

      await page.evaluate(() => {
        editor.setValue('  one', { silent: true });
        editor.focus();
        editor.el.querySelector('textarea').setSelectionRange(2, 2);
      });
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('textarea').inputValue(), 'one');
      await page.keyboard.press(`${accelerator}+z`);
      assert.equal(await page.locator('textarea').inputValue(), '  one');
      await page.keyboard.press(`${accelerator}+Shift+z`);
      assert.equal(await page.locator('textarea').inputValue(), 'one');
      await page.getByRole('button', { name: 'Outside' }).click();
      assert.deepEqual(await page.evaluate(() => changes), ['alpha  ', 'alpha  x  y', 'one']);
    }
  },
  {
    name: 'CodeEditor unavailable native editing falls back to text input and one blur commit',
    async run({ page }) {
      for (const throws of [false, true]) {
        await page.evaluate((throws) => {
          window.changes = [];
          window.inputs = [];
          window.nativeCommand = document.execCommand;
          document.execCommand = () => {
            if (throws) throw new Error('Unavailable command');
            return false;
          };
          window.editor = new zx.CodeEditor(null, {
            value: '  one', indent: '  ', onchange: (event) => changes.push(event.detail.value),
            oninput: (event) => inputs.push(event.detail.value)
          });
          window.outside = document.createElement('button');
          outside.textContent = 'Outside';
          document.body.append(editor.el, outside);
          editor.focus();
        }, throws);
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Escape');
        await page.keyboard.press('Tab');
        assert.deepEqual(await page.evaluate(() => ({ value: editor.getValue(), inputs, changes })),
          { value: 'one', inputs: ['one'], changes: ['one'] });
        await page.evaluate(() => { document.execCommand = nativeCommand; editor.destroy(); outside.remove(); });
      }
    }
  },
  {
    name: 'CodeEditor selected-line outdent retains selection and Field receives its commit',
    async run({ page }) {
      await page.evaluate(() => {
        window.changes = [];
        window.field = new zx.Field(null, {
          type: 'code', value: 'one\ntwo', props: { indent: '  ' },
          onchange: (event) => changes.push(event.detail.value)
        });
        const outside = document.createElement('button');
        outside.textContent = 'Outside';
        document.body.append(field.el, outside);
        field.focus();
      });
      await page.keyboard.press(`${accelerator}+a`);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('textarea').inputValue(), '  one\n  two');
      assert.deepEqual(await page.locator('textarea').evaluate((input) => [input.selectionStart, input.selectionEnd]), [2, 11]);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('textarea').inputValue(), 'one\ntwo');
      assert.deepEqual(await page.locator('textarea').evaluate((input) => [input.selectionStart, input.selectionEnd]), [0, 7]);
      await page.keyboard.press(`${accelerator}+z`);
      assert.equal(await page.locator('textarea').inputValue(), '  one\n  two');
      await page.keyboard.press(`${accelerator}+Shift+z`);
      assert.equal(await page.locator('textarea').inputValue(), 'one\ntwo');
      await page.keyboard.press(`${accelerator}+a`);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Tab');
      assert.deepEqual(await page.evaluate(() => changes), ['  one\n  two']);
      assert.equal(await page.evaluate(() => field.getValue()), '  one\n  two');
    }
  },
  {
    name: 'Calendar paging retains relative slot focus and a single available tab stop',
    async run({ page }) {
      await page.evaluate(() => {
        window.calendar = new zx.Calendar(null, {
          view: 'week', date: new Date(2026, 10, 9), nowIndicator: false,
          slotMinTime: 540, slotMaxTime: 720, scrollTime: 540
        });
        const outside = document.createElement('button');
        outside.textContent = 'Outside';
        document.body.append(calendar.el, outside);
      });
      await page.locator('[data-slot]').first().focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('PageDown');
      const focus = () => page.evaluate(() => {
        const active = document.activeElement;
        const date = new Date(Number(active.dataset.slot));
        return {
          position: [active.dataset.rowIndex, active.dataset.dayIndex],
          date: [date.getDate(), date.getHours(), date.getMinutes()],
          stops: calendar.el.querySelectorAll('[data-slot][tabindex="0"]').length
        };
      });
      assert.deepEqual(await focus(), { position: ['1', '1'], date: [17, 9, 30], stops: 1 });
      await page.keyboard.press('PageUp');
      assert.deepEqual(await focus(), { position: ['1', '1'], date: [10, 9, 30], stops: 1 });
      await page.evaluate(() => calendar.setView('day'));
      assert.deepEqual(await focus(), { position: ['1', '0'], date: [9, 9, 30], stops: 1 });
      await page.getByRole('button', { name: 'Outside' }).focus();
      await page.evaluate(() => calendar.next());
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Outside');
      assert.equal(await page.locator('[data-slot][tabindex="0"]').count(), 1);
      assert.equal(await page.evaluate(() => calendar.getDate().getDate()), 10);
    }
  },
  {
    name: 'Calendar invalid keyboard resize retains the valid draft, cancellation and preventable commit',
    async run({ page }) {
      await page.evaluate(() => {
        window.proposals = [];
        window.cancelCommit = false;
        window.calendar = new zx.Calendar(null, {
          view: 'day', date: new Date(2026, 10, 9), nowIndicator: false,
          editable: true, optimistic: true, slotMinTime: 540, slotMaxTime: 720,
          events: [{ id: 1, title: 'Meeting', start: new Date(2026, 10, 9, 10), end: new Date(2026, 10, 9, 10, 30) }],
          oneventchange: (event) => {
            proposals.push(event.detail.event.end.getTime());
            if (cancelCommit) event.preventDefault();
          }
        });
        document.body.append(calendar.el);
      });
      const resize = page.locator('[data-event-action="resize"]');
      const end = () => page.evaluate(() => {
        const date = calendar.getEvents()[0].end;
        return [date.getDate(), date.getHours(), date.getMinutes()];
      });
      await resize.focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowLeft');
      assert.deepEqual(await page.evaluate(() => {
        const date = calendar._keyboardEdit.event.end;
        return [date.getDate(), date.getHours(), date.getMinutes()];
      }), [9, 11, 0]);
      await page.keyboard.press('Escape');
      assert.deepEqual(await end(), [9, 10, 30]);
      assert.deepEqual(await page.evaluate(() => proposals), []);
      await page.evaluate(() => { cancelCommit = true; });
      await resize.focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      assert.deepEqual(await end(), [9, 10, 30]);
      await page.evaluate(() => { cancelCommit = false; });
      await resize.focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      assert.deepEqual(await end(), [9, 11, 0]);
      assert.equal(await page.evaluate(() => proposals.length), 2);
    }
  },
  {
    name: 'TreeView late resolve and reject leave restored targets and replacement components untouched',
    async run({ page }) {
      for (const reject of [false, true]) {
        await page.evaluate(() => {
          window.events = [];
          window.root = document.createElement('div');
          root.textContent = 'Original markup';
          root.setAttribute('aria-label', 'Original label');
          document.body.append(root);
          root.addEventListener('zx-expand', () => events.push('expand'));
          root.addEventListener('zx-error', () => events.push('error'));
          window.tree = new zx.TreeView(root, {
            items: [{ ID: 'a', name: 'Old parent', hasChildren: true }],
            load: () => new Promise((resolve, reject) => { window.resolveLoad = resolve; window.rejectLoad = reject; })
          });
        });
        await page.locator('.zx-tree__row').focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => Boolean(window.resolveLoad));
        const result = await page.evaluate(async (reject) => {
          const pending = [...tree._loading.values()];
          tree.destroy();
          const restored = [root.textContent, root.getAttribute('aria-label')];
          const replacement = new zx.TreeView(root, { items: [{ ID: 'a', name: 'Replacement' }] });
          const before = root.outerHTML;
          if (reject) rejectLoad(new Error('Retired request'));
          else resolveLoad([{ ID: 'child', name: 'Stale child' }]);
          await Promise.all(pending);
          await new Promise(requestAnimationFrame);
          const result = { restored, unchanged: before === root.outerHTML, events: [...events] };
          replacement.destroy();
          root.remove();
          window.resolveLoad = null;
          return result;
        }, reject);
        assert.deepEqual(result, { restored: ['Original markup', 'Original label'], unchanged: true, events: [] });
      }
    }
  },
  {
    name: 'TreeView replacement and concurrent expansions keep only current work without losing selection',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const loads = [];
        const expanded = [];
        const tree = new zx.TreeView(null, {
          items: [{ ID: 'a', name: 'Old', hasChildren: true }], selected: ['a'],
          load: (node) => new Promise((resolve) => loads.push({ node, resolve })),
          onexpand: (event) => expanded.push(event.detail.id)
        });
        document.body.append(tree.el);
        const old = tree.expand('a');
        tree.setItems([{ ID: 'a', name: 'Current A', hasChildren: true }, { ID: 'b', name: 'Current B', hasChildren: true }]);
        const a = tree.expand('a');
        const sameA = tree.expand('a');
        const b = tree.expand('b');
        if (loads.length !== 3) throw new Error(`Expected a fresh replacement load and one per concurrent branch; received ${loads.length} loads`);
        loads[0].resolve([{ ID: 'stale', name: 'Stale' }]);
        await old;
        const afterOld = tree.el.textContent;
        loads[2].resolve([{ ID: 'b-child', name: 'B child' }]);
        loads[1].resolve([{ ID: 'a-child', name: 'A child' }]);
        await Promise.all([a, sameA, b]);
        const result = {
          calls: loads.length, afterOld, expanded: expanded.sort(), selection: tree.getSelection(),
          children: [tree.getNode('a').children[0].ID, tree.getNode('b').children[0].ID]
        };
        tree.setItems([{ ID: 'c', name: 'Collapsed', hasChildren: true }]);
        const canceled = tree.expand('c');
        tree.collapse('c');
        loads[3].resolve([{ ID: 'c-child', name: 'Hidden child' }]);
        await canceled;
        result.canceledVisible = tree.el.textContent.includes('Hidden child');
        result.expanded = [...expanded].sort();
        tree.destroy();
        return result;
      });
      assert.deepEqual(result, {
        calls: 3, afterOld: 'Current ACurrent B', expanded: ['a', 'b'], selection: ['a'],
        children: ['a-child', 'b-child'], canceledVisible: false
      });
    }
  },
  {
    name: 'Finder interactive selection and entry cannot resume after destroy',
    async run({ page }) {
      for (const enter of [false, true]) {
        await page.evaluate(() => {
          window.events = [];
          window.root = document.createElement('div');
          root.textContent = 'Original markup';
          document.body.append(root);
          root.addEventListener('zx-change', () => events.push('change'));
          root.addEventListener('zx-error', () => events.push('error'));
          window.finder = new zx.Finder(root, {
            items: [{ ID: 'a', name: 'Old parent', hasChildren: true }],
            load: () => new Promise((resolve, reject) => { window.resolveLoad = resolve; window.rejectLoad = reject; })
          });
        });
        if (enter) {
          await page.locator('.zx-finder__row').focus();
          await page.keyboard.press('ArrowRight');
        } else await page.locator('.zx-finder__row').click();
        await page.waitForFunction(() => Boolean(window.resolveLoad));
        const result = await page.evaluate(async (reject) => {
          const pending = [...finder._loading.values()];
          finder.destroy();
          const restored = root.textContent;
          const replacement = new zx.Finder(root, { items: [{ ID: 'a', name: 'Replacement' }] });
          const before = root.outerHTML;
          if (reject) rejectLoad(new Error('Retired request'));
          else resolveLoad([{ ID: 'child', name: 'Stale child' }]);
          await Promise.all(pending);
          await new Promise(requestAnimationFrame);
          const result = { restored, unchanged: before === root.outerHTML, events: [...events] };
          replacement.destroy();
          root.remove();
          window.resolveLoad = null;
          return result;
        }, enter);
        assert.deepEqual(result, { restored: 'Original markup', unchanged: true, events: [] });
      }
    }
  },
  {
    name: 'Finder races and data replacement keep the newest path, focus and successful loads',
    async run({ page }) {
      await page.evaluate(() => {
        window.loads = [];
        window.changes = [];
        window.finder = new zx.Finder(null, {
          items: [{ ID: 'a', name: 'A', hasChildren: true }, { ID: 'b', name: 'B', hasChildren: true }],
          load: (node) => new Promise((resolve) => loads.push({ id: node.ID, resolve })),
          onchange: (event) => changes.push(event.detail.path)
        });
        document.body.append(finder.el);
      });
      await page.locator('.zx-finder__row').first().focus();
      await page.keyboard.press('ArrowRight');
      await page.locator('.zx-finder__row').nth(1).click();
      await page.evaluate(async () => {
        loads[1].resolve([{ ID: 'b-child', name: 'B child' }]);
        await new Promise(requestAnimationFrame);
        loads[0].resolve([{ ID: 'a-child', name: 'A child' }]);
        await new Promise(requestAnimationFrame);
      });
      assert.deepEqual(await page.evaluate(() => ({ path: finder.getPath(), changes, focus: document.activeElement.textContent })),
        { path: ['b'], changes: [['b']], focus: 'B' });
      await page.keyboard.press('ArrowRight');
      assert.deepEqual(await page.evaluate(() => finder.getPath()), ['b', 'b-child']);
      const result = await page.evaluate(async () => {
        finder.setItems([{ ID: 'same', name: 'Old generation', hasChildren: true }]);
        const old = finder.setPath(['same', 'old-child']);
        finder.setItems([{ ID: 'same', name: 'Current generation', hasChildren: true }]);
        const current = finder.setPath(['same', 'current-child']);
        loads[2].resolve([{ ID: 'old-child', name: 'Old child' }]);
        await old;
        const afterOld = finder.getPath();
        loads[3].resolve([{ ID: 'current-child', name: 'Current child' }]);
        await current;
        return { afterOld, path: finder.getPath(), text: finder.el.textContent, calls: loads.length };
      });
      assert.deepEqual(result, { afterOld: [], path: ['same', 'current-child'], text: 'Current generationCurrent child', calls: 4 });
    }
  },
  {
    name: 'Kanban stationary-pointer auto-scroll tracks filtered multi-card insertion and final release',
    async run({ page }) {
      await mountKanban(page, true);
      const handle = page.locator('.zx-kanban-view__move-handle').first();
      const source = await handle.boundingBox();
      const destination = await page.locator('.zx-kanban-view__cards').nth(1).boundingBox();
      const point = { x: destination.x + destination.width / 2, y: destination.y + destination.height - 10 };
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      await page.mouse.down();
      await page.mouse.move(point.x, point.y, { steps: 5 });
      const initial = await page.evaluate(() => board._dragDestination.index);
      await page.waitForFunction(() => {
        const list = board.el.querySelectorAll('.zx-kanban-view__cards')[1];
        return list.scrollTop >= list.scrollHeight - list.clientHeight - 1;
      });
      const tracked = await page.evaluate((point) => {
        const list = board.el.querySelectorAll('.zx-kanban-view__cards')[1];
        const cards = [...list.querySelectorAll('.zx-record-card')];
        const index = cards.findIndex((card) => {
          const bounds = card.getBoundingClientRect();
          return point.y < bounds.top + bounds.height / 2;
        });
        return { actual: index < 0 ? cards.length : index, tracked: board._dragDestination.index };
      }, point);
      assert.ok(tracked.actual > initial + 3, 'content must move several insertion positions under the stationary pointer');
      assert.equal(tracked.tracked, tracked.actual);

      // Move the scroll region after the last animation frame and release in the same frame.
      // The release must independently hit-test, even when no pointermove or auto-scroll tick ran.
      await page.evaluate(() => {
        board.options.autoScroll = false;
        cancelAnimationFrame(board._dragFrame);
        board._dragFrame = 0;
        board.el.querySelectorAll('.zx-kanban-view__cards')[1].scrollTop = 0;
      });
      const expected = await page.evaluate((point) => {
        const cards = [...board.el.querySelectorAll('.zx-kanban-view__cards')[1].querySelectorAll('.zx-record-card')];
        const before = cards.find((card) => {
          const bounds = card.getBoundingClientRect();
          return point.y < bounds.top + bounds.height / 2;
        });
        const all = board.getData().filter((record) => record.stage === 'b').map((record) => record.ID);
        const title = before?.querySelector('.zx-record-card__title')?.textContent;
        const id = board.getData().find((record) => record.title === title)?.ID;
        all.splice(id === undefined ? all.length : all.indexOf(id), 0, 1, 2);
        return all;
      }, point);
      await page.mouse.up();
      assert.deepEqual(await page.evaluate(() => board.getData().filter((record) => record.stage === 'b').map((record) => record.ID)), expected);
      assert.deepEqual(await page.evaluate(() => board.getSelectionIds()), [1, 2]);
      assert.equal(await page.locator('[data-drop]').count(), 0);
    }
  },
  {
    name: 'Kanban keyboard moves remain cancelable and preserve multi-selection',
    async run({ page }) {
      await mountKanban(page, false);
      await page.evaluate(() => {
        window.blockMove = true;
        board.on('recordmove', (event) => { if (blockMove) event.preventDefault(); });
      });
      const handle = page.locator('.zx-kanban-view__move-handle').first();
      await handle.focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => board.getRecord(1).stage), 'a');
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => board.getRecord(1).stage), 'a');
      await page.evaluate(() => { blockMove = false; });
      await handle.focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      assert.deepEqual(await page.evaluate(() => [board.getRecord(1).stage, board.getRecord(2).stage]), ['b', 'b']);
      assert.deepEqual(await page.evaluate(() => board.getSelectionIds()), [1, 2]);
    }
  }
];

async function mountKanban(page, filtered) {
  await page.evaluate((filtered) => {
    window.board = new zx.KanbanView(null, {
      fields: [{ id: 'title', label: 'Title' }, { id: 'stage', label: 'Stage' }],
      data: [
        { ID: 1, title: 'Visible source one', stage: 'a' }, { ID: 2, title: 'Visible source two', stage: 'a' },
        ...Array.from({ length: 40 }, (_, index) => ({
          ID: index + 3, title: `${index % 2 ? 'Visible' : 'Hidden'} target ${index}`, stage: 'b'
        }))
      ],
      recordId: 'ID', columnBy: 'stage', columns: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      titleField: 'title', hiddenFields: ['stage'], moveMode: 'local', columnHeight: '300px',
      selectable: 'multi', selection: [1, 2], dragFrom: 'handle', moveHandle: 'always'
    });
    document.body.append(board.el);
    if (filtered) board.setSearch('Visible');
  }, filtered);
}
