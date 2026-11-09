import assert from 'node:assert/strict';

export const cases = [
  {
    name: 'country picker searches descriptions in ordinary and preferred results',
    async run({ page }) {
      await page.evaluate(() => { window.picker = zx.Select.country(null, { countries: [{ code: 'DE', description: 'ordinary unicorn' }], preferred: [{ code: 'AT', description: 'preferred unicorn' }], sort: false }); document.body.append(picker.el); });
      const input = page.locator('.zx-select__input'); await input.fill('unicorn');
      const options = await page.locator('[role=option]').allTextContents();
      assert(options.some(x => x.includes('ordinary unicorn'))); assert(options.some(x => x.includes('preferred unicorn')));
      await page.evaluate(() => picker.destroy());
    }
  },
  {
    name: 'datebox commits edited values once and preserves unseen precision',
    async run({ page }) {
      await page.evaluate(() => { window.date = new zx.Datebox(null, { value: new Date(2026, 0, 1, 15, 30, 25) }); window.changes = []; date.on('change', e => changes.push(e.detail.date?.getTime() ?? null)); document.body.append(date.el, zx.h('button', { id: 'outside' }, 'Outside')); });
      const input = page.locator('.zx-datebox__input'); const initial = await page.evaluate(() => date.get().getTime());
      await input.focus(); await input.press('Enter'); await page.locator('#outside').focus();
      assert.equal(await page.evaluate(() => date.get().getTime()), initial); assert.deepEqual(await page.evaluate(() => changes), []);
      await input.fill('02.01.2026'); await input.press('Enter'); await page.locator('#outside').focus();
      assert.equal(await page.evaluate(() => changes.length), 1);
      await page.evaluate(() => date.set(date.get())); assert.equal(await page.evaluate(() => changes.length), 2);
      await page.evaluate(() => date.destroy());
    }
  },
  {
    name: 'disabled sidebar branches do not expand from the keyboard',
    async run({ page }) {
      await page.evaluate(() => { window.sidebar = new zx.AppSidebar(null, { items: [{ id: 'disabled', label: 'Disabled', disabled: true, children: [{ id: 'd-child', label: 'Child' }] }, { id: 'enabled', label: 'Enabled', children: [{ id: 'e-child', label: 'Child' }] }] }); document.body.append(sidebar.el); });
      const disabled = page.locator('[data-app-nav-id="disabled"]'); await disabled.focus(); await page.keyboard.press('ArrowRight');
      assert.deepEqual(await page.evaluate(() => sidebar.getExpanded()), []);
      await page.locator('[data-app-nav-id="enabled"]').focus(); await page.keyboard.press('ArrowRight');
      assert.deepEqual(await page.evaluate(() => sidebar.getExpanded()), ['enabled']);
      await page.evaluate(() => sidebar.destroy());
    }
  },
  {
    name: 'empty focus traps contain Tab and restore the boundary and previous focus',
    async run({ page }) {
      await page.evaluate(() => { window.before = zx.h('button', { id: 'before' }, 'Before'); window.boundary = zx.h('div', { id: 'boundary' }); document.body.append(before, boundary); before.focus(); window.trap = zx.focusTrap(boundary); trap.activate(); });
      assert.equal(await page.evaluate(() => document.activeElement === boundary), true);
      assert.equal(await page.locator('#boundary').getAttribute('tabindex'), '-1');
      await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement === boundary), true);
      await page.evaluate(() => boundary.append(zx.h('button', { id: 'child' }, 'Child')));
      await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'child');
      await page.evaluate(() => trap.deactivate());
      assert.equal(await page.evaluate(() => document.activeElement === before), true); assert.equal(await page.locator('#boundary').getAttribute('tabindex'), null);
    }
  },
  {
    name: 'agent thread replaces scroll listeners when moved and removes them on destroy',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const a = zx.h('div', { style: { overflowY: 'auto' } }); const b = zx.h('div', { style: { overflowY: 'auto' } });
        document.body.append(a, b); const thread = new zx.AgentThread(null); a.append(thread.el);
        const counts = { a: 0, b: 0 }; const addA = a.addEventListener.bind(a), removeA = a.removeEventListener.bind(a); const addB = b.addEventListener.bind(b), removeB = b.removeEventListener.bind(b);
        a.addEventListener = (...args) => { if (args[0] === 'scroll') counts.a++; return addA(...args); }; a.removeEventListener = (...args) => { if (args[0] === 'scroll') counts.a--; return removeA(...args); };
        b.addEventListener = (...args) => { if (args[0] === 'scroll') counts.b++; return addB(...args); }; b.removeEventListener = (...args) => { if (args[0] === 'scroll') counts.b--; return removeB(...args); };
        thread.scrollToEnd(); const first = { ...counts }; b.append(thread.el); thread.scrollToEnd(); const moved = { ...counts };
        const latest = thread.el.querySelector('.zx-agent-thread__latest'); latest.hidden = false;
        a.dispatchEvent(new Event('scroll')); const oldInert = !latest.hidden;
        b.dispatchEvent(new Event('scroll')); const currentWorks = latest.hidden;
        thread.destroy(); const destroyed = { ...counts };
        const explicit = new zx.AgentThread(null, { scroller: a }); b.append(explicit.el); explicit.scrollToEnd(); const bound = { ...counts }; explicit.destroy(); const final = { ...counts };
        a.remove(); b.remove(); return { first, moved, destroyed, bound, final, oldInert, currentWorks };
      });
      assert.deepEqual(result, { first: { a: 1, b: 0 }, moved: { a: 0, b: 1 }, destroyed: { a: 0, b: 0 }, bound: { a: 1, b: 0 }, final: { a: 0, b: 0 }, oldInert: true, currentWorks: true });
    }
  },
  {
    name: 'composer migrates a known legacy draft only once',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const key = 'wp72:sample'; const legacy = `zx:composer:${key}`;
        localStorage.setItem(legacy, JSON.stringify('old draft'));
        const first = new zx.Composer(null, { draftKey: key }); document.body.append(first.el); const restored = first.getValue(); first.clear(); first.destroy();
        const second = new zx.Composer(null, { draftKey: key }); document.body.append(second.el); const afterClear = second.getValue(); second.destroy();
        const untouched = localStorage.getItem(legacy); localStorage.removeItem(legacy);
        return { restored, afterClear, untouched };
      });
      assert.deepEqual(result, { restored: 'old draft', afterClear: '', untouched: '"old draft"' });
    }
  }
];

cases.push({
  name: 'dock and split view restore only their selected legacy values',
  async run({ page }) {
    const result = await page.evaluate(() => {
      const dockLegacy = 'zx:dock:wp72'; const splitLegacy = 'zx:split-view:wp72';
      localStorage.setItem(dockLegacy, JSON.stringify({ sizes: {}, collapsed: ['panel'], active: {} }));
      localStorage.setItem(splitLegacy, JSON.stringify(220));
      const dock = new zx.Dock(null, { storageKey: 'wp72', panes: [{ name: 'panel', title: 'Panel', content: 'Content' }] }); document.body.append(dock.el);
      const target = zx.h('div', { style: { width: '600px', height: '200px' } }); document.body.append(target);
      const split = new zx.SplitView(target, { storageKey: 'wp72', min: 0 });
      const value = { collapsed: dock.isCollapsed('panel'), size: split.getSize(), dockLegacy: localStorage.getItem(dockLegacy), splitLegacy: localStorage.getItem(splitLegacy) };
      dock.destroy(); split.destroy(); target.remove(); localStorage.removeItem(dockLegacy); localStorage.removeItem(splitLegacy); return value;
    });
    assert.equal(result.collapsed, true); assert.equal(result.size, 220); assert(result.dockLegacy); assert.equal(result.splitLegacy, '220');
  }
});
