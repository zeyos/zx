import assert from 'node:assert/strict';

/** Waits for queued native close tasks and the focus and render work that follows them. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

export const cases = [
  {
    name: 'Escape in a Launcher opened from a Dialog closes the Launcher only',
    async run({ page }) {
      // Both construction orders: document order must not decide which overlay hears the key.
      for (const launcherFirst of [true, false]) {
        await page.evaluate(async (launcherFirst) => {
          document.body.replaceChildren();
          const inside = zx.button({ label: 'Search' });
          const make = {
            launcher: () => { window.launcher = new zx.Launcher(null, { items: [{ id: 'one', label: 'One' }] }); },
            dialog: () => { window.dialog = new zx.Dialog(null, { title: 'Records', content: inside }); }
          };
          if (launcherFirst) { make.launcher(); make.dialog(); } else { make.dialog(); make.launcher(); }
          window.dialog.open();
          await new Promise((resolve) => requestAnimationFrame(resolve));
          inside.focus();
          window.launcher.open();
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }, launcherFirst);
        await page.keyboard.press('Escape');
        await settle(page);
        assert.deepEqual(await page.evaluate(() => ({
          launcher: window.launcher.isOpen(), dialog: window.dialog.isOpen()
        })), { launcher: false, dialog: true }, `launcher constructed ${launcherFirst ? 'first' : 'second'}`);
        await page.keyboard.press('Escape');
        await settle(page);
        assert.equal(await page.evaluate(() => window.dialog.isOpen()), false, 'the next Escape closes the dialog');
        await page.evaluate(() => { window.launcher.destroy(); window.dialog.destroy(); });
      }
    }
  },
  {
    name: 'Escape closes the modal opened last, whatever the document order',
    async run({ page }) {
      await page.evaluate(async () => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const opener = zx.button({ label: 'More' });
        // B is constructed (and appended) first, so A comes after it in the document.
        window.b = new zx.Modal(null, { content: 'B' });
        window.a = new zx.Modal(null, { content: opener });
        window.a.open();
        await frame();
        opener.focus();
        window.b.open();
        await frame();
      });
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await page.evaluate(() => ({ a: window.a.isOpen(), b: window.b.isOpen() })),
        { a: true, b: false }, 'the first Escape closes the modal on top');
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await page.evaluate(() => ({ a: window.a.isOpen(), b: window.b.isOpen() })),
        { a: false, b: false });
      await page.evaluate(() => { window.a.destroy(); window.b.destroy(); });
    }
  },
  {
    name: 'A press that starts inside a light-dismiss overlay and ends on the backdrop does not close it',
    async run({ page }) {
      for (const kind of ['Modal', 'Sheet']) {
        await page.evaluate((kind) => {
          window.reasons = [];
          const input = document.createElement('input');
          input.value = 'select this text';
          input.setAttribute('aria-label', 'Text');
          window.overlay = new zx[kind](null, { title: 'Edit', content: input, lightDismiss: true, width: 320 });
          window.overlay.on('cancel', (event) => window.reasons.push(event.detail.reason));
          window.overlay.open();
        }, kind);
        await settle(page);
        const box = await page.locator(`.zx-${kind.toLowerCase()} input`).boundingBox();
        await page.mouse.move(box.x + 4, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(6, 6, { steps: 6 });
        await page.mouse.up();
        await settle(page);
        assert.deepEqual(await page.evaluate(() => ({ open: window.overlay.isOpen(), reasons: window.reasons })),
          { open: true, reasons: [] }, `${kind}: a drag out of the panel is not a backdrop click`);

        // A press and release on the backdrop still dismisses.
        await page.mouse.click(6, 6);
        await settle(page);
        assert.deepEqual(await page.evaluate(() => ({ open: window.overlay.isOpen(), reasons: window.reasons })),
          { open: false, reasons: ['backdrop'] }, `${kind}: a backdrop click still dismisses`);
        await page.evaluate(() => window.overlay.destroy());
      }
    }
  },
  {
    name: 'Destroying an open overlay emits close once',
    async run({ page }) {
      const counts = await page.evaluate(async () => {
        const result = {};
        for (const kind of ['Modal', 'Dialog', 'Sheet']) {
          const overlay = new zx[kind](null, { title: 'Edit', content: 'Body' });
          let closes = 0;
          overlay.on('close', () => { closes += 1; });
          overlay.open();
          await new Promise((resolve) => requestAnimationFrame(resolve));
          overlay.destroy();
          await new Promise((resolve) => setTimeout(resolve, 50));
          result[kind] = { closes, attached: overlay.el.isConnected };
        }
        return result;
      });
      for (const kind of ['Modal', 'Dialog', 'Sheet']) {
        assert.deepEqual(counts[kind], { closes: 1, attached: false }, kind);
      }
    }
  },
  {
    name: 'A Tooltip adds and removes only its own id in aria-describedby',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const input = document.createElement('input');
        input.setAttribute('aria-label', 'Amount');
        document.body.append(input);
        const tip = new zx.Tooltip(input, { content: 'Hint', trigger: 'manual' });
        const id = tip.el.id;
        const steps = {};
        tip.show();
        steps.bareShown = input.getAttribute('aria-describedby') === id;
        tip.hide();
        steps.bareHidden = input.getAttribute('aria-describedby');
        // A field error described after the tooltip was attached.
        input.setAttribute('aria-describedby', 'error-1');
        tip.show();
        steps.shown = input.getAttribute('aria-describedby');
        tip.hide();
        steps.hidden = input.getAttribute('aria-describedby');
        input.setAttribute('aria-describedby', 'error-2');
        tip.show();
        input.setAttribute('aria-describedby', `${input.getAttribute('aria-describedby')} help-1`);
        tip.destroy();
        steps.destroyed = input.getAttribute('aria-describedby');
        input.remove();
        return { id, steps };
      });
      assert.deepEqual(result.steps, {
        bareShown: true,
        bareHidden: null,
        shown: `error-1 ${result.id}`,
        hidden: 'error-1',
        destroyed: 'error-2 help-1'
      });
    }
  },
  {
    name: 'Tabbox and NavigationBar arrow keys follow the visual order under dir="rtl"',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const panel = (text) => () => { const node = document.createElement('p'); node.textContent = text; return node; };
        const measure = (dir) => {
          const host = document.createElement('div');
          host.dir = dir;
          host.style.inlineSize = '960px';
          document.body.append(host);
          const tabbox = new zx.Tabbox(null, {
            label: 'Sections',
            tabs: ['One', 'Two', 'Three'].map((title) => ({ name: title.toLowerCase(), title, content: panel(title) }))
          });
          const bar = new zx.NavigationBar(null, {
            overflow: false,
            items: ['Alpha', 'Beta', 'Gamma'].map((title) => ({ name: title.toLowerCase(), title, content: panel(title) }))
          });
          host.append(tabbox.el, bar.el);
          const press = (key) => {
            const active = /** @type {HTMLElement} */ (document.activeElement);
            const before = active.getBoundingClientRect().left;
            active.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
            const after = /** @type {HTMLElement} */ (document.activeElement);
            return { moved: after !== active, direction: Math.sign(after.getBoundingClientRect().left - before), text: after.textContent.trim() };
          };
          const out = {};
          for (const [name, root] of [['tabbox', tabbox.el], ['bar', bar.el]]) {
            const tabs = [...root.querySelectorAll('[role="tab"]')];
            // From the middle tab, so neither arrow wraps.
            tabs[1].focus();
            const right = press('ArrowRight');
            tabs[1].focus();
            out[name] = { right, left: press('ArrowLeft') };
            tabs[0].focus();
            out[name].end = press('End').text;
            out[name].home = press('Home').text;
            out[name].selected = root.querySelector('[role="tab"][aria-selected="true"]').textContent.trim();
          }
          tabbox.destroy();
          bar.destroy();
          host.remove();
          return out;
        };
        return { ltr: measure('ltr'), rtl: measure('rtl') };
      });
      for (const name of ['tabbox', 'bar']) {
        // ArrowRight always moves to the tab visually on the right, ArrowLeft to the one on the left.
        assert.equal(result.ltr[name].right.direction, 1, `${name} ltr ArrowRight`);
        assert.equal(result.ltr[name].left.direction, -1, `${name} ltr ArrowLeft`);
        assert.equal(result.rtl[name].right.direction, 1, `${name} rtl ArrowRight`);
        assert.equal(result.rtl[name].left.direction, -1, `${name} rtl ArrowLeft`);
      }
      assert.deepEqual(
        { end: result.rtl.tabbox.end, home: result.rtl.tabbox.home, selected: result.rtl.tabbox.selected },
        { end: 'Three', home: 'One', selected: 'One' }, 'Home/End keep DOM order; arrows only move focus');
      assert.deepEqual(
        { end: result.rtl.bar.end, home: result.rtl.bar.home, selected: result.rtl.bar.selected },
        { end: 'Gamma', home: 'Alpha', selected: 'Alpha' });
    }
  },
  {
    name: 'Choosing a checkbox or radio menu item updates its checked state',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const items = [
          { label: 'Pinned', value: 'pinned', role: 'menuitemcheckbox', checked: true },
          '-',
          { type: 'heading', label: 'Sort' },
          { label: 'Name', value: 'name', role: 'menuitemradio', checked: true },
          { label: 'Date', value: 'date', role: 'menuitemradio' },
          '-',
          { label: 'Size', value: 'size', role: 'menuitemradio', checked: true }
        ];
        const menu = new zx.MenuButton(null, { label: 'Actions', items });
        document.body.append(menu.el);
        const details = [];
        let prevent = false;
        menu.on('select', (event) => {
          details.push({ value: event.detail.value, checked: event.detail.checked, same: items.includes(event.detail.item) });
          if (prevent) event.preventDefault();
        });
        const state = () => Object.fromEntries([...menu.getPanel().querySelectorAll('[aria-checked]')]
          .map((element) => [element.textContent.trim(), element.getAttribute('aria-checked')]));
        const choose = async (label) => {
          menu.open();
          await frame();
          [...menu.getPanel().querySelectorAll('[role^="menuitem"]')].find((element) => element.textContent.trim() === label).click();
          await frame();
        };
        await choose('Pinned');
        const afterUncheck = state();
        await choose('Pinned');
        const afterCheck = state();
        await choose('Date');
        const afterRadio = state();
        prevent = true;
        await choose('Pinned');
        const afterPrevented = state();
        const stillOpen = menu.isOpen();
        menu.close();
        menu.destroy();

        // ContextMenu, through the same model.
        const region = document.createElement('div');
        region.tabIndex = 0;
        region.style.cssText = 'inline-size: 200px; block-size: 100px';
        document.body.append(region);
        const context = new zx.ContextMenu(region, { items: [{ label: 'Pinned', value: 'pinned', role: 'menuitemcheckbox', checked: true }] });
        const contextDetails = [];
        context.on('select', (event) => contextDetails.push(event.detail.checked));
        region.focus();
        region.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
        await frame();
        document.querySelector('.zx-context-menu [role="menuitemcheckbox"]').click();
        await frame();
        region.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
        await frame();
        const contextState = document.querySelector('.zx-context-menu [role="menuitemcheckbox"]').getAttribute('aria-checked');
        context.close();
        context.destroy();
        region.remove();
        const untouched = items.map((item) => (typeof item === 'object' ? item.checked : undefined));
        return { details, afterUncheck, afterCheck, afterRadio, afterPrevented, stillOpen, contextDetails, contextState, untouched };
      });
      assert.deepEqual(result.afterUncheck, { Pinned: 'false', Name: 'true', Date: 'false', Size: 'true' });
      assert.deepEqual(result.afterCheck, { Pinned: 'true', Name: 'true', Date: 'false', Size: 'true' });
      assert.deepEqual(result.afterRadio, { Pinned: 'true', Name: 'false', Date: 'true', Size: 'true' },
        'a radio item unchecks the other radio items of its section only');
      assert.deepEqual(result.afterPrevented, result.afterRadio, 'a prevented select changes nothing');
      assert.equal(result.stillOpen, true);
      assert.deepEqual(result.details, [
        { value: 'pinned', checked: false, same: true },
        { value: 'pinned', checked: true, same: true },
        { value: 'date', checked: true, same: true },
        { value: 'pinned', checked: false, same: true }
      ]);
      assert.deepEqual(result.untouched, [true, undefined, undefined, true, undefined, undefined, true],
        'the application\'s item objects are not mutated');
      assert.deepEqual(result.contextDetails, [false]);
      assert.equal(result.contextState, 'false');
    }
  },
  {
    name: 'A ContextMenu on a themed target ignores context requests from inside its own panel',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const region = document.createElement('div');
        region.setAttribute('data-zx-theme', 'light');
        region.style.cssText = 'inline-size: 300px; block-size: 200px';
        region.tabIndex = 0;
        document.body.append(region);
        const menu = new zx.ContextMenu(region, { items: [{ label: 'Rename', value: 'r' }, { label: 'Delete', value: 'd' }] });
        let opens = 0;
        menu.on('open', () => { opens += 1; });
        region.focus();
        region.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
        await frame();
        const panel = document.querySelector('.zx-context-menu');
        const insideTarget = region.contains(panel);
        const item = panel.querySelector('[role="menuitem"]');
        item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
        await frame();
        const openAfter = menu.isOpen();
        menu.close();
        await frame();
        const focus = document.activeElement === region;
        menu.destroy();
        region.remove();
        return { insideTarget, opens, openAfter, focus };
      });
      assert.deepEqual(result, { insideTarget: true, opens: 1, openAfter: true, focus: true });
    }
  }
];
