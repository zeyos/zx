import assert from 'node:assert/strict';

/** Wait for native dialog close tasks and their following focus/render work. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

/** Assert cleanup through the public component lifecycle, including repeated destruction. */
const clean = async (page, names) => {
  const surviving = await page.evaluate((keys) => {
    const owned = keys.flatMap((key) => [window[key]?.el, window[key]?.getPanel?.()])
      .filter((node) => node instanceof Element);
    for (const key of keys) {
      window[key]?.destroy();
      window[key]?.destroy();
    }
    return owned.filter((node) => node.isConnected).map((node) => node.outerHTML);
  }, names);
  assert.deepEqual(surviving, [], 'Destroy leaves no component-owned body nodes');
  await settle(page);
  assert.equal(await page.locator('dialog, [popover], .zx-message-region').count(), 0);
};

export const cases = [
  {
    name: 'O1 persistent and unfinished progress messages survive hover/focus; timed messages resume',
    async run({ page }) {
      await page.evaluate(() => {
        window.region = new zx.Message(null);
        const before = zx.h('button', { id: 'before' }, 'Before');
        const after = zx.h('button', { id: 'after' }, 'After');
        document.body.append(before, region.el, after);
        window.persistent = region.show('Persistent', { timeout: 0 });
        window.progress = zx.Message.progress('Working');
      });
      const persistent = page.locator('.zx-message__toast', { hasText: 'Persistent' });
      await persistent.hover();
      await page.locator('#after').hover();
      await persistent.locator('button').focus();
      await page.keyboard.press('Tab');
      const progress = page.locator('.zx-message__toast', { hasText: 'Working' });
      await progress.hover();
      await page.locator('#before').hover();
      assert.equal(await persistent.count(), 1);
      assert.equal(await progress.count(), 1);
      await page.evaluate(() => region.show('Timed', { timeout: 180 }));
      const timed = page.locator('.zx-message__toast', { hasText: 'Timed' });
      await timed.hover();
      await page.waitForTimeout(220); // Exceeds the timer while hover owns it.
      assert.equal(await timed.count(), 1);
      await timed.locator('button').focus();
      await page.locator('#after').hover();
      await page.waitForTimeout(220); // Focus independently holds the same timer.
      assert.equal(await timed.count(), 1);
      await page.locator('#after').focus();
      await timed.waitFor({ state: 'detached' });
      await page.evaluate(() => { persistent.close(); progress.done(); });
      await progress.waitFor({ state: 'detached' });
      await clean(page, ['region']);
    }
  },
  {
    name: 'O2 removing/disabling an inactive keyboard-focused tab preserves a roving stop and vetoes',
    async run({ page }) {
      await page.evaluate(() => {
        window.tabs = new zx.Tabbox(null, {
          tabs: ['a', 'b', 'c'].map((name) => ({ name, title: name, content: zx.h('p', {}, name) }))
        });
        document.body.append(tabs.el);
      });
      await page.locator('[role="tab"]').first().focus();
      await page.keyboard.press('ArrowRight');
      await page.evaluate(() => tabs.removeTab('b'));
      assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'c');
      assert.equal(await page.evaluate(() => tabs.getActive()), 'a');
      await page.evaluate(() => tabs.disableTab('c'));
      assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'a');
      await page.evaluate(() => {
        tabs.enableTab('c');
        window.veto = (event) => event.preventDefault();
        tabs.on('change', veto);
        tabs.disableTab('a');
        tabs.removeTab('a');
      });
      assert.equal(await page.evaluate(() => tabs.getActive()), 'a');
      assert.equal(await page.locator('[role="tab"]').count(), 2);
      assert.equal(await page.locator('[role="tab"]').first().getAttribute('aria-disabled'), null);
      await page.evaluate(() => { tabs.off('change', veto); tabs.removeTab('a'); tabs.removeTab('c'); });
      assert.equal(await page.locator('[role="tab"]').count(), 0);
      await page.evaluate(() => {
        tabs.addTab({ name: 'new', title: 'New', content: zx.h('p', {}, 'New') });
        tabs.disableTab('new');
        tabs.enableTab('new');
      });
      assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
      await clean(page, ['tabs']);
    }
  },
  {
    name: 'O3 keyboard-opened menu Tab exits relative to its trigger and callbacks retain focus',
    async run({ page }) {
      await page.evaluate(() => {
        window.menu = new zx.MenuButton(null, { label: 'Actions', items: [{ label: 'One' }] });
        document.body.append(zx.h('button', { id: 'before' }, 'Before'), menu.el,
          zx.h('button', { id: 'after' }, 'After'));
      });
      for (const [key, target] of [['Tab', 'after'], ['Shift+Tab', 'before']]) {
        await page.evaluate(() => menu.getTrigger().focus());
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press(key);
        assert.equal(await page.evaluate(() => document.activeElement.id), target);
        assert.equal(await page.evaluate(() => menu.isOpen()), false);
      }
      await page.evaluate(() => {
        window.cancel = (event) => event.preventDefault();
        menu.on('select', cancel);
        menu.focusFirst();
      });
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => menu.isOpen()), true);
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'menuitem');
      await page.evaluate(() => {
        menu.off('select', cancel);
        menu.on('select', () => document.querySelector('#after').focus());
      });
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'after');
      assert.equal(await page.evaluate(() => menu.isOpen()), false);
      await page.evaluate(() => {
        menu.on('close', () => document.querySelector('#after').focus());
        menu.focusFirst();
      });
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'after');
      await clean(page, ['menu']);
    }
  },
  {
    name: 'O4 breadcrumb overflow preserves native links and honors prevented selections',
    async run({ page }) {
      await page.evaluate(() => {
        window.crumbs = new zx.Breadcrumb(null, { maxVisible: 2, items: [
          { name: 'root', label: 'Root', href: '#root' },
          { name: 'ancestor', label: 'Ancestor', href: '#ancestor' },
          { name: 'current', label: 'Current' }
        ] });
        document.body.append(crumbs.el);
        window.selections = [];
        crumbs.on('select', (event) => selections.push(event.detail.name));
        window.cancel = (event) => event.preventDefault();
        crumbs.on('select', cancel);
      });
      await page.locator('.zx-breadcrumb__more').focus();
      await page.keyboard.press('ArrowDown');
      const item = page.locator('[role="menuitem"]');
      assert.equal(await item.evaluate((el) => el.tagName), 'A');
      assert.equal(await item.getAttribute('href'), '#ancestor');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => location.hash), '');
      assert.equal(await page.locator('[role="menu"]:popover-open').count(), 1);
      await page.evaluate(() => crumbs.off('select', cancel));
      await page.keyboard.press('Enter');
      await page.waitForURL((url) => url.hash === '#ancestor');
      assert.deepEqual(await page.evaluate(() => selections), ['ancestor', 'ancestor']);
      await page.evaluate(() => crumbs.on('select', cancel));
      await page.locator('[data-crumb="root"]').click();
      assert.equal(await page.evaluate(() => location.hash), '#ancestor');
      await clean(page, ['crumbs']);
    }
  },
  {
    name: 'O5 context-menu dialogs restore their invoker; canceled actions, links and focus moves survive',
    async run({ page }) {
      await page.evaluate(() => {
        const opener = zx.h('button', { id: 'opener' }, 'Open menu');
        document.body.append(opener, zx.h('button', { id: 'other' }, 'Other'));
        window.context = new zx.ContextMenu(opener, { items: [{ label: 'Dialog', onselect() {
          window.dialog = new zx.Dialog(null, { title: 'Dialog', content: 'Content' });
          dialog.open();
        } }] });
      });
      await page.locator('#opener').focus();
      await page.keyboard.press('Shift+F10');
      await page.keyboard.press('Enter');
      await settle(page);
      assert.equal(await page.evaluate(() => dialog.el.contains(document.activeElement)), true);
      await page.keyboard.press('Escape');
      await settle(page);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
      await page.evaluate(() => {
        dialog.destroy();
        window.cancel = (event) => event.preventDefault();
        context.on('select', cancel);
        context.setItems([{ label: 'Link', href: '#context-link' }]);
      });
      await page.keyboard.press('Shift+F10');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => context.isOpen()), true);
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'menuitem');
      assert.equal(await page.evaluate(() => location.hash), '');
      await page.evaluate(() => context.off('select', cancel));
      await page.keyboard.press('Enter');
      await page.waitForURL((url) => url.hash === '#context-link');
      await page.evaluate(() => {
        context.setItems([{ label: 'Move focus', onselect: () => document.querySelector('#other').focus() }]);
      });
      await page.locator('#opener').focus();
      await page.keyboard.press('Shift+F10');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'other');
      await clean(page, ['context']);
    }
  },
  {
    name: 'O6 launcher ignores queued close events after reopening and keeps the new request alive',
    async run({ page }) {
      await page.evaluate(() => {
        window.loads = [];
        window.closeCount = 0;
        window.launcher = new zx.Launcher(null, { shortcut: false, debounce: 0,
          items: [{ id: 'remote', label: 'Remote page', items(query, { signal }) {
            return new Promise((resolve) => loads.push({ signal, resolve }));
          } }], onclose: () => closeCount++ });
        launcher.open({ page: 'remote' });
        launcher.close();
        launcher.open({ page: 'remote' });
      });
      await settle(page);
      assert.deepEqual(await page.evaluate(() => ({ open: launcher.isOpen(), state: launcher.el.dataset.state,
        expanded: launcher.refs.input.getAttribute('aria-expanded'), closed: closeCount,
        aborted: loads.at(-1).signal.aborted, page: launcher.getPage()?.id })),
      { open: true, state: 'open', expanded: 'true', closed: 0, aborted: false, page: 'remote' });
      await page.evaluate(() => loads.at(-1).resolve([{ id: 'new', label: 'New result' }]));
      await page.locator('[role="option"]').waitFor();
      assert.equal(await page.locator('[role="option"]').textContent(), 'New result');
      await page.evaluate(() => { launcher.close(); launcher.open(); launcher.close(); });
      await settle(page);
      assert.equal(await page.evaluate(() => closeCount), 1);
      await page.evaluate(() => { launcher.open(); launcher.el.close(); launcher.open(); launcher.close(); });
      await settle(page);
      assert.equal(await page.evaluate(() => closeCount), 2, 'An earlier native close cannot consume the new close ticket');
      await clean(page, ['launcher']);
    }
  },
  {
    name: 'O7 restoring expanded lazy Dock panes materializes once, including persisted initial state',
    async run({ page }) {
      const data = await page.evaluate(() => {
        window.builds = { plain: 0, tab: 0, persisted: 0 };
        const state = { sizes: {}, collapsed: [], active: { tabs: 'second' } };
        window.dock = new zx.Dock(null, { panes: [
          { name: 'plain', collapsed: true, content: () => { builds.plain++; return zx.h('button', {}, 'Usable'); } },
          { name: 'tabs', collapsed: true, tabs: [
            { name: 'first', title: 'First', content: 'First' },
            { name: 'second', title: 'Second', content: () => { builds.tab++; return 'Second content'; } }
          ] }
        ] });
        document.body.append(dock.el);
        dock.setState(state);
        dock.setState(state);
        zx.storage('dock').set('regression-expanded', { sizes: {}, collapsed: [], active: {} });
        window.savedDock = new zx.Dock(null, { storageKey: 'regression-expanded', panes: [
          { name: 'saved', collapsed: true, content: () => { builds.persisted++; return 'Saved content'; } }
        ] });
        document.body.append(savedDock.el);
        return { builds, text: dock.el.textContent, saved: savedDock.el.textContent };
      });
      assert.deepEqual(data.builds, { plain: 1, tab: 1, persisted: 1 });
      assert.match(data.text, /Second content/);
      assert.match(data.saved, /Saved content/);
      await page.getByRole('button', { name: 'Usable' }).focus();
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Usable');
      await page.evaluate(() => zx.storage('dock').remove('regression-expanded'));
      await clean(page, ['dock', 'savedDock']);
    }
  },
  {
    name: 'O8 destroying/releasing Dock detaches subscriptions and restores surviving Sheet styles',
    async run({ page }) {
      await page.evaluate(() => {
        window.sheet = new zx.Sheet(null, { title: 'Survivor', content: 'Content' });
        sheet.el.style.setProperty('--zx-pane-size', '175px', 'important');
        sheet.el.style.setProperty('--caller-property', 'kept');
        sheet.el.setAttribute('data-grow', 'caller');
        window.dock = new zx.Dock(null);
        document.body.append(dock.el);
        dock.adopt(sheet, { size: 240 });
        window.resyncs = 0;
        dock._syncGrow = () => resyncs++;
        dock.destroy();
        resyncs = 0;
        sheet.open();
      });
      await settle(page);
      assert.deepEqual(await page.evaluate(() => ({ resyncs, docked: sheet.isDocked(), open: sheet.isOpen(),
        size: sheet.el.style.getPropertyValue('--zx-pane-size'),
        priority: sheet.el.style.getPropertyPriority('--zx-pane-size'),
        caller: sheet.el.style.getPropertyValue('--caller-property'), grow: sheet.el.getAttribute('data-grow') })),
      { resyncs: 0, docked: false, open: true, size: '175px', priority: 'important', caller: 'kept', grow: 'caller' });
      await page.keyboard.press('Escape');
      await settle(page);
      assert.equal(await page.evaluate(() => resyncs), 0);
      await page.evaluate(() => {
        window.secondDock = new zx.Dock(null);
        document.body.append(secondDock.el);
        secondDock.adopt(sheet, { size: 300 });
        secondDock.release(sheet);
        sheet.open();
      });
      await settle(page);
      assert.equal(await page.evaluate(() => sheet.el.style.getPropertyValue('--zx-pane-size')), '175px');
      assert.equal(await page.evaluate(() => sheet.isDocked()), false);
      await clean(page, ['sheet', 'secondDock', 'dock']);
    }
  },
  {
    name: 'O9 re-pushing an open Sheet aligns native top layer, stack depth, Escape and lifecycle events',
    async run({ page }) {
      for (const modal of [true, false]) {
        await page.evaluate((modal) => {
          window.lifecycle = [];
          window.pops = 0;
          window.stack = new zx.SheetStack({ onpop: () => pops++ });
          window.sheetA = new zx.Sheet(null, { title: 'A', modal,
            onopen: () => lifecycle.push('open-a'), onclose: () => lifecycle.push('close-a') });
          window.sheetB = new zx.Sheet(null, { title: 'B', modal,
            onopen: () => lifecycle.push('open-b'), onclose: () => lifecycle.push('close-b') });
          stack.push(sheetA);
          stack.push(sheetB);
          stack.push(sheetA);
        }, modal);
        await settle(page);
        assert.deepEqual(await page.evaluate(() => ({ top: stack.top() === sheetA, size: stack.size(),
          a: sheetA.el.dataset.depth, b: sheetB.el.dataset.depth, lifecycle, pops,
          focus: sheetA.el.contains(document.activeElement) })),
        { top: true, size: 2, a: '0', b: '1', lifecycle: ['open-a', 'open-b'], pops: 0, focus: true });
        // Hit testing observes the actual top layer rather than relying on the stack's attributes.
        assert.equal(await page.evaluate(() => {
          const box = sheetA.refs.close.getBoundingClientRect();
          return sheetA.el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }), true);
        await page.keyboard.press('Escape');
        await settle(page);
        assert.deepEqual(await page.evaluate(() => ({ a: sheetA.isOpen(), b: sheetB.isOpen(),
          top: stack.top() === sheetB, size: stack.size(), pops, lifecycle })),
        { a: false, b: true, top: true, size: 1, pops: 1, lifecycle: ['open-a', 'open-b', 'close-a'] });
        await page.evaluate(() => { stack.push(sheetA); stack.pop(); stack.push(sheetA); });
        await settle(page);
        assert.equal(await page.evaluate(() => stack.top() === sheetA && stack.size() === 2), true);
        assert.deepEqual(await page.evaluate(() => lifecycle),
          ['open-a', 'open-b', 'close-a', 'open-a', 'open-a']);
        await page.evaluate(() => {
          stack.once('pop', () => stack.push(sheetA));
          stack.pop();
        });
        await settle(page);
        assert.deepEqual(await page.evaluate(() => ({ size: stack.size(), top: stack.top() === sheetA,
          a: sheetA.isOpen(), b: sheetB.isOpen() })),
        { size: 2, top: true, a: true, b: true }, 'A pop listener can immediately re-push the sheet');
        await clean(page, ['stack', 'sheetA', 'sheetB']);
      }
    }
  },
  {
    name: 'O10 composing Enter never submits a prompt; ordinary Enter and cancellation settle once',
    async run({ page }) {
      await page.evaluate(() => {
        window.results = [];
        zx.Dialog.prompt({ title: 'Value' }).then((value) => results.push(value));
      });
      const input = page.locator('.zx-dialog__prompt-input');
      await input.fill('unfinished');
      await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true,
        bubbles: true, cancelable: true });
      await settle(page);
      assert.deepEqual(await page.evaluate(() => results), []);
      assert.equal(await page.locator('dialog:modal').count(), 1);
      await page.keyboard.press('Enter');
      await settle(page);
      assert.deepEqual(await page.evaluate(() => results), ['unfinished']);
      assert.equal(await page.locator('dialog').count(), 0);
      await page.evaluate(() => { zx.Dialog.prompt({ title: 'Cancel' }).then((value) => results.push(value)); });
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await page.evaluate(() => results), ['unfinished', null]);
      assert.equal(await page.locator('dialog').count(), 0);
    }
  },
  {
    name: 'O11 tooltips remain hoverable across anchor/bubble, respect focus and Escape, ignore touch',
    async run({ page, theme }) {
      await page.evaluate(() => {
        const scope = zx.h('section', { id: 'scope', 'data-zx-theme': document.documentElement.dataset.zxTheme });
        const anchor = zx.h('button', { id: 'anchor', style: { margin: '100px' }, 'aria-describedby': 'existing' }, 'Hover');
        scope.append(anchor, zx.h('button', { id: 'other' }, 'Other'));
        document.body.append(scope);
        window.tip = new zx.Tooltip(anchor, { content: 'Hoverable description', placement: 'bottom', delay: 0, hideDelay: 80 });
      });
      const anchor = page.locator('#anchor');
      await anchor.hover();
      const bubble = page.locator('[role="tooltip"]');
      await bubble.waitFor({ state: 'visible' });
      const box = await bubble.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
      await page.waitForTimeout(120); // Cross the physical anchor gap and exceed hideDelay over the bubble.
      assert.equal(await page.evaluate(() => tip.isOpen()), true);
      assert.equal(await bubble.evaluate((el) => el.closest('[data-zx-theme]').dataset.zxTheme), theme);
      await anchor.hover();
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => tip.isOpen()), true);
      await page.mouse.move(5, 5);
      await bubble.waitFor({ state: 'hidden' });
      assert.equal(await anchor.getAttribute('aria-describedby'), 'existing');
      await page.locator('#other').focus();
      await page.keyboard.press('Shift+Tab');
      await bubble.waitFor({ state: 'visible' });
      await anchor.hover();
      await page.mouse.move(5, 5);
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => tip.isOpen()), true); // Keyboard focus still holds it.
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => tip.isOpen()), false);
      await page.keyboard.press('Tab');
      await anchor.dispatchEvent('pointerenter', { pointerType: 'touch' });
      assert.equal(await page.evaluate(() => tip.isOpen()), false);
      await clean(page, ['tip']);
      await page.evaluate(() => {
        window.tip = new zx.Tooltip('#anchor', { content: 'Again', delay: 100 });
      });
      await anchor.hover();
      await clean(page, ['tip']);
      await page.waitForTimeout(120);
      assert.equal(await page.locator('[role="tooltip"]').count(), 0);
      assert.equal(await anchor.getAttribute('aria-describedby'), 'existing');
    }
  }
];
