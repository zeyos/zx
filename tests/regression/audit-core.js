import assert from 'node:assert/strict';

/** Waits two frames, long enough for rAF-batched drags and native dialog focus work. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

const activeId = (page) => page.evaluate(() => document.activeElement?.id ?? null);

export const cases = [
  {
    name: 'focus traps wrap around the roving stop of a toolbar, not its parked items',
    async run({ page }) {
      await page.evaluate(() => {
        const { h } = window.zx;
        const tools = h('div', { role: 'toolbar', ariaLabel: 'Format' },
          h('button', { id: 'bold' }, 'Bold'), h('button', { id: 'italic' }, 'Italic'),
          h('button', { id: 'underline' }, 'Underline'));
        window.boundary = h('div', { id: 'boundary' }, h('input', { id: 'name', ariaLabel: 'Name' }), tools);
        document.body.append(h('button', { id: 'before' }, 'Before'), boundary, h('button', { id: 'after' }, 'After'));
        window.group = zx.rovingTabindex(tools, 'button', { orientation: 'horizontal' });
        window.trap = zx.focusTrap(boundary);
        trap.activate();
      });
      assert.equal(await activeId(page), 'name');
      await page.keyboard.press('Tab');
      assert.equal(await activeId(page), 'bold', 'the toolbar holds one Tab stop');
      await page.keyboard.press('Tab');
      assert.equal(await activeId(page), 'name', 'Tab from the toolbar wraps instead of leaving the trap');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await activeId(page), 'bold', 'Shift+Tab wraps to the toolbar stop, not its last parked item');
      await page.evaluate(() => { trap.deactivate(); group.destroy(); });
    }
  },
  {
    name: 'a focus trap that holds focus itself wraps Shift+Tab once controls arrive',
    async run({ page }) {
      await page.evaluate(() => {
        window.boundary = zx.h('div', { id: 'boundary' });
        document.body.append(zx.h('button', { id: 'before' }, 'Before'), boundary);
        document.getElementById('before').focus();
        window.trap = zx.focusTrap(boundary);
        trap.activate();
        boundary.append(zx.h('button', { id: 'first' }, 'First'), zx.h('button', { id: 'last' }, 'Last'));
      });
      assert.equal(await activeId(page), 'boundary');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await activeId(page), 'last');
      await page.evaluate(() => boundary.focus());
      await page.keyboard.press('Tab');
      assert.equal(await activeId(page), 'first');
      await page.evaluate(() => trap.deactivate());
      assert.equal(await activeId(page), 'before');
    }
  },
  {
    name: 'a dialog opened from a focus-trapping sheet keeps Tab inside the dialog',
    async run({ page }) {
      await page.evaluate(() => {
        const { h } = window.zx;
        window.sheet = new zx.Sheet(null, {
          title: 'Filters', modal: 'trap-focus',
          content: h('div', {}, h('input', { id: 'sheet-field', ariaLabel: 'Filter' }), h('button', { id: 'sheet-action' }, 'Confirm'))
        });
        sheet.open();
        window.dialog = new zx.Dialog(null, {
          title: 'Discard filters?',
          content: h('div', {}, h('input', { id: 'reason', ariaLabel: 'Reason' }), h('input', { id: 'note', ariaLabel: 'Note' }))
        });
        dialog.open();
      });
      await settle(page);
      assert.equal(await page.evaluate(() => sheet.el.contains(dialog.el)), false, 'the dialog lives outside the sheet');
      await page.locator('#reason').focus();
      await page.keyboard.press('Tab');
      assert.equal(await activeId(page), 'note', 'Tab moves on inside the dialog');
      await page.evaluate(() => { dialog.destroy(); sheet.destroy(); });
    }
  },
  {
    name: 'roving groups skip items inside hidden, inert, or undisplayed holders and still initialize detached',
    async run({ page }) {
      await page.evaluate(() => {
        const { h } = window.zx;
        window.root = h('div', { id: 'group' },
          h('button', { id: 'one' }, 'One'),
          h('span', { hidden: true }, h('button', { id: 'two' }, 'Two')),
          h('span', { inert: true }, h('button', { id: 'three' }, 'Three')),
          h('span', { style: { display: 'none' } }, h('button', { id: 'four' }, 'Four')),
          h('button', { id: 'five' }, 'Five'));
        document.body.append(root);
        window.group = zx.rovingTabindex(root, 'button', { orientation: 'horizontal' });
      });
      await page.locator('#one').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await activeId(page), 'five');
      await page.keyboard.press('ArrowRight');
      assert.equal(await activeId(page), 'one', 'wrapping skips them too');
      await page.keyboard.press('End');
      assert.equal(await activeId(page), 'five');

      // Revealed by a style change, which nothing observes, an undisplayed item adds no tab stop.
      const stops = await page.evaluate(() => {
        root.children[3].style.display = '';
        return Array.from(root.querySelectorAll('button'), (button) => button.tabIndex)
          .filter((tabIndex, index) => index !== 1 && index !== 2 && tabIndex === 0).length;
      });
      assert.equal(stops, 1, 'one tab stop in the group');
      await page.evaluate(() => { root.children[3].style.display = 'none'; });

      // A holder that becomes visible again rejoins the group.
      await page.evaluate(() => { root.children[1].hidden = false; });
      await settle(page);
      await page.locator('#one').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await activeId(page), 'two');

      const detached = await page.evaluate(() => {
        const { h } = window.zx;
        const results = {};
        // Built before it is connected or shown, as a toolbar or a closed menu is.
        for (const [name, hidden] of [['detached', false], ['hidden', true]]) {
          const box = h('div', { hidden }, h('button', {}, 'A'), h('button', {}, 'B'), h('button', {}, 'C'));
          const roving = zx.rovingTabindex(box, 'button', { orientation: 'horizontal' });
          results[name] = Array.from(box.children, (button) => button.tabIndex);
          roving.destroy();
        }
        group.destroy();
        return results;
      });
      assert.deepEqual(detached, { detached: [0, -1, -1], hidden: [0, -1, -1] });
    }
  },
  {
    name: 'two positioned overlays on one anchor leave no empty style attribute behind',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const { h } = window.zx;
        const anchor = h('button', {}, 'Anchor');
        const tip = h('div', {}, 'Tip');
        const menu = h('div', {}, 'Menu');
        document.body.append(anchor, tip, menu);
        const orders = [];
        for (const reverse of [false, true]) {
          const first = zx.position(anchor, tip);
          const second = zx.position(anchor, menu, { placement: 'top' });
          const [a, b] = reverse ? [second, first] : [first, second];
          a.destroy();
          b.destroy();
          orders.push(anchor.getAttribute('style'));
        }
        anchor.setAttribute('style', 'color: red');
        const kept = zx.position(anchor, tip);
        const other = zx.position(anchor, menu);
        kept.destroy();
        other.destroy();
        return { orders, kept: anchor.getAttribute('style') };
      });
      assert.deepEqual(result, { orders: [null, null], kept: 'color: red;' });
    }
  },
  {
    name: 'a split divider follows the arrow keys and the pointer under right-to-left',
    async run({ page }) {
      for (const dir of ['ltr', 'rtl']) {
        await page.evaluate((dir) => {
          document.body.replaceChildren();
          const host = zx.h('div', { dir, style: { width: '800px', height: '300px' } });
          window.split = new zx.SplitView(null, { start: 'Start', end: 'End', size: 300, min: 50 });
          host.append(split.el);
          document.body.append(host);
        }, dir);
        await settle(page);
        const read = () => page.evaluate(() => ({
          x: Math.round(split.refs.divider.getBoundingClientRect().left), size: Math.round(split.getSize())
        }));
        const start = await read();
        await page.evaluate(() => split.refs.divider.focus());
        await page.keyboard.press('ArrowRight');
        const right = await read();
        assert.ok(right.x > start.x, `${dir}: ArrowRight moves the divider right (${start.x} → ${right.x})`);
        assert.equal(right.size, dir === 'rtl' ? start.size - 16 : start.size + 16,
          `${dir}: the start pane ${dir === 'rtl' ? 'shrinks' : 'grows'}`);
        await page.keyboard.press('ArrowLeft');
        assert.deepEqual(await read(), start, `${dir}: ArrowLeft moves it back`);

        const box = await page.evaluate(() => {
          const rect = split.refs.divider.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        });
        await page.mouse.move(box.x, box.y);
        await page.mouse.down();
        await page.mouse.move(box.x + 30, box.y);
        await page.mouse.move(box.x + 60, box.y);
        await settle(page);
        await page.mouse.up();
        await settle(page);
        const dragged = await read();
        assert.ok(Math.abs(dragged.x - (start.x + 60)) <= 2, `${dir}: the divider follows the pointer (${start.x} → ${dragged.x})`);
        await page.evaluate(() => split.destroy());
      }
    }
  },
  {
    name: 'custom form elements keep what the user chose across a rebuild and a move',
    async run({ page }) {
      const result = await page.evaluate(() => {
        zx.defineElements('zx-audit');
        const items = JSON.stringify([{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }]);
        document.body.innerHTML = `
          <div id="first">
            <zx-audit-select items='${items}' value="1"></zx-audit-select>
            <zx-audit-toggle></zx-audit-toggle>
            <zx-audit-datebox value="2026-01-05"></zx-audit-datebox>
            <zx-audit-timebox value="30"></zx-audit-timebox>
          </div>
          <div id="second"></div>`;
        const select = document.querySelector('zx-audit-select');
        const toggle = document.querySelector('zx-audit-toggle');
        const datebox = document.querySelector('zx-audit-datebox');
        const timebox = document.querySelector('zx-audit-timebox');
        // What a user does through the controls, without the elements' own properties.
        select.component.set(2);
        toggle.component.el.click();
        datebox.component.set(new Date(2026, 6, 19));
        timebox.component.set(90);
        // Attributes that need a new component.
        select.setAttribute('clearable', '');
        datebox.setAttribute('clearable', '');
        timebox.setAttribute('signed', '');
        const rebuilt = [select.value, toggle.checked, datebox.value, timebox.value];
        // Moving an element disconnects and reconnects it.
        document.getElementById('second').append(select, toggle, datebox, timebox);
        const moved = [select.value, toggle.checked, datebox.value, timebox.value];
        return { rebuilt, moved };
      });
      assert.deepEqual(result, {
        rebuilt: [2, true, '2026-07-19', 90],
        moved: [2, true, '2026-07-19', 90]
      });
    }
  },
  {
    name: 'a control inside a disabled fieldset stays disabled when its own disabled goes',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        zx.defineElements('zx-audit');
        document.body.innerHTML = `
          <form><fieldset disabled>
            <zx-audit-toggle disabled></zx-audit-toggle>
            <zx-audit-checklist disabled items='[{"ID":1,"name":"One"}]'></zx-audit-checklist>
          </fieldset></form>`;
        const fieldset = document.querySelector('fieldset');
        const toggle = document.querySelector('zx-audit-toggle');
        const checklist = document.querySelector('zx-audit-checklist');
        const state = () => [toggle.component.el.disabled, checklist.component.isDisabled()];
        await Promise.resolve();
        const initial = state();
        toggle.removeAttribute('disabled');
        checklist.removeAttribute('disabled');
        await Promise.resolve();
        const ownRemoved = state();
        fieldset.disabled = false;
        await Promise.resolve();
        const fieldsetEnabled = state();
        return { initial, ownRemoved, fieldsetEnabled };
      });
      assert.deepEqual(result, {
        initial: [true, true], ownRemoved: [true, true], fieldsetEnabled: [false, false]
      });
    }
  },
  {
    name: 'a disabled checklist element stays disabled when the checklist re-renders',
    async run({ page }) {
      const result = await page.evaluate(() => {
        zx.defineElements('zx-audit');
        document.body.innerHTML = `<zx-audit-checklist disabled items='[{"ID":1,"name":"One"},{"ID":2,"name":"Two"}]'></zx-audit-checklist>`;
        const checklist = document.querySelector('zx-audit-checklist');
        const boxes = () => Array.from(checklist.querySelectorAll('input[type="checkbox"]'), (input) => input.disabled);
        checklist.component.checkAll();
        const afterCheckAll = boxes();
        checklist.items = [{ ID: 3, name: 'Three' }];
        const afterItems = boxes();
        checklist.removeAttribute('disabled');
        return { afterCheckAll, afterItems, enabled: boxes(), aria: checklist.component.el.getAttribute('aria-disabled') };
      });
      assert.deepEqual(result, { afterCheckAll: [true, true], afterItems: [true], enabled: [false], aria: null });
    }
  },
  {
    name: 'resetting a form restores the checklist items that started checked',
    async run({ page }) {
      const result = await page.evaluate(() => {
        zx.defineElements('zx-audit');
        const items = JSON.stringify([{ ID: 1, name: 'One', on: true }, { ID: 2, name: 'Two' }, { ID: 3, name: 'Three', on: true }]);
        document.body.innerHTML = `<form>
          <zx-audit-checklist name="derived" items='${items}'></zx-audit-checklist>
          <zx-audit-checklist name="explicit" items='${items}' value="[2]"></zx-audit-checklist>
        </form>`;
        const form = document.querySelector('form');
        const [derived, explicit] = document.querySelectorAll('zx-audit-checklist');
        const initial = [derived.value, explicit.value];
        derived.component.setValues([2]);
        explicit.component.setValues([1, 3]);
        form.reset();
        return { initial, reset: [derived.value, explicit.value], submitted: new FormData(form).get('derived') };
      });
      assert.deepEqual(result, { initial: [[1, 3], [2]], reset: [[1, 3], [2]], submitted: '[1,3]' });
    }
  }
];
