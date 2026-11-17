import assert from 'node:assert/strict';

/*
 * Date and time pickers and the small enhancers: keyboard focus that survives a redraw, grid
 * structure, week numbers, day bounds, combobox semantics, exact target restoration, and copy
 * helpers that stop reporting once their owner is gone.
 */

const activeData = (page) => page.evaluate(() => ({ ...document.activeElement?.dataset }));

export const cases = [
  {
    name: 'P1 arrow keys move within the hour dial; explicit activation opens the minutes',
    async run({ page }) {
      await page.evaluate(() => {
        window.tp = new zx.TimePicker(null, { value: { h: 9, m: 30, s: 0 } });
        document.body.append(tp.el);
        tp.openClock('h');
        tp.refs.dial.querySelector('[data-value="9"]').focus();
      });
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => tp.refs.dial.dataset.unit), 'h', 'an arrow key left the hour dial');
      assert.equal((await activeData(page)).value, '10', 'focus did not follow to the next hour');
      assert.equal(await page.evaluate(() => tp.get().h), 10);
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      assert.equal((await activeData(page)).value, '8');
      assert.equal(await page.evaluate(() => tp.refs.dial.dataset.unit), 'h');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => tp.refs.dial.dataset.unit), 'm', 'Enter no longer moves on to the minutes');
      assert.deepEqual(await page.evaluate(() => tp.get()), { h: 8, m: 30, s: 0 });
      await page.evaluate(() => tp.destroy());
    }
  },
  {
    name: 'P2 a minute between dial marks still leaves the dial one Tab stop',
    async run({ page }) {
      const state = await page.evaluate(() => {
        window.tp = new zx.TimePicker(null, { value: { h: 12, m: 7, s: 0 } });
        document.body.append(tp.el);
        tp.openClock('m');
        const marks = [...tp.refs.dial.querySelectorAll('.zx-time-picker__mark')];
        return {
          stops: marks.filter((mark) => mark.tabIndex === 0).map((mark) => mark.dataset.value),
          checked: marks.filter((mark) => mark.getAttribute('aria-checked') === 'true').length,
          value: tp.get()
        };
      });
      assert.deepEqual(state, { stops: ['5'], checked: 0, value: { h: 12, m: 7, s: 0 } });
      await page.evaluate(() => tp.destroy());
    }
  },
  {
    name: 'P3 leaving an unedited time field keeps hidden seconds and emits nothing',
    async run({ page }) {
      await page.evaluate(() => {
        window.changes = [];
        window.tp = new zx.TimePicker(null, { value: { h: 12, m: 34, s: 56 } });
        window.empty = new zx.TimePicker(null, {});
        tp.on('change', (event) => changes.push(event.detail.time));
        empty.on('change', (event) => changes.push(event.detail.time));
        document.body.append(tp.el, empty.el, zx.h('button', { id: 'outside' }, 'Outside'));
      });
      const hour = page.locator('.zx-time-picker__spin[data-segment="h"]').first();
      await hour.focus();
      await page.keyboard.press('Tab');
      await page.locator('#outside').focus();
      await page.locator('.zx-time-picker__spin[data-segment="h"]').nth(1).focus();
      await page.locator('#outside').focus();
      assert.deepEqual(await page.evaluate(() => [tp.get(), empty.get(), changes]),
        [{ h: 12, m: 34, s: 56 }, null, []]);
      // Editing still commits, and keeps the seconds it does not show.
      await hour.fill('3');
      await page.locator('#outside').focus();
      assert.deepEqual(await page.evaluate(() => [tp.get(), changes]),
        [{ h: 3, m: 34, s: 56 }, [{ h: 3, m: 34, s: 56 }]]);
      await page.evaluate(() => { tp.destroy(); empty.destroy(); });
    }
  },
  {
    name: 'P4 selecting a day or month keeps keyboard focus in the grid',
    async run({ page }) {
      await page.evaluate(() => {
        window.changes = [];
        window.dp = new zx.DatePicker(null, { value: new Date(2026, 4, 12) });
        dp.on('change', (event) => changes.push(event.detail.date.getDate()));
        document.body.append(dp.el);
        dp.focus();
      });
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      assert.equal((await activeData(page)).date, '2026-05-13', 'focus was lost after Space');
      await page.keyboard.press('ArrowRight');
      assert.equal((await activeData(page)).date, '2026-05-14', 'arrow keys no longer reach the calendar');
      await page.keyboard.press('Enter');
      assert.equal((await activeData(page)).date, '2026-05-14');
      assert.deepEqual(await page.evaluate(() => changes), [13, 14]);
      await page.evaluate(() => dp.destroy());

      await page.evaluate(() => {
        window.mp = new zx.MonthPicker(null, { value: new Date(2026, 4, 1) });
        document.body.append(mp.el);
        mp.focus();
      });
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      assert.equal((await activeData(page)).month, '5', 'month focus was lost after Space');
      await page.keyboard.press('ArrowDown');
      assert.equal((await activeData(page)).month, '8');
      assert.equal(await page.evaluate(() => mp.get().getMonth()), 5);
      await page.evaluate(() => mp.destroy());

      // A popup host still moves focus after the change: the Datebox returns it to its input.
      await page.evaluate(() => {
        window.box = new zx.Datebox(null, { value: new Date(2026, 4, 12) });
        document.body.append(box.el);
        box.open();
      });
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement === box.refs.input), true);
      assert.equal(await page.evaluate(() => box.get().getDate()), 13);
      await page.evaluate(() => box.destroy());
    }
  },
  {
    name: 'P5 month grids put their cells in rows and keep three columns',
    async run({ page }) {
      const shapes = await page.evaluate(() => {
        const dp = new zx.DatePicker(null, { value: new Date(2026, 4, 12) });
        const mp = new zx.MonthPicker(null, { value: new Date(2026, 4, 1) });
        document.body.append(dp.el, mp.el);
        dp.refs.heading.click();
        const shape = (grid) => {
          const cells = [...grid.querySelectorAll('[role="gridcell"]')];
          const rects = cells.map((cell) => cell.getBoundingClientRect());
          return {
            rows: grid.querySelectorAll(':scope > [role="row"]').length,
            inRows: cells.every((cell) => cell.parentElement.getAttribute('role') === 'row'
              && cell.parentElement.parentElement === grid),
            perRow: [...grid.querySelectorAll(':scope > [role="row"]')].map((row) => row.children.length),
            tops: new Set(rects.map((rect) => Math.round(rect.top))).size,
            lefts: new Set(rects.map((rect) => Math.round(rect.left))).size,
            widths: new Set(rects.map((rect) => Math.round(rect.width))).size
          };
        };
        const result = [shape(dp.refs.quickGrid), shape(mp.refs.grid)];
        dp.destroy();
        mp.destroy();
        return result;
      });
      for (const shape of shapes) {
        assert.deepEqual(shape, { rows: 4, inRows: true, perRow: [3, 3, 3, 3], tops: 4, lefts: 3, widths: 1 });
      }
    }
  },
  {
    name: 'P6 week numbers follow the ISO week of each row when weeks start on Sunday',
    async run({ page }) {
      const weeks = await page.evaluate(() => {
        const dp = new zx.DatePicker(null, { value: new Date(2026, 0, 6), weekStart: 0, showWeekNumbers: true });
        document.body.append(dp.el);
        const rows = [...dp.refs.days.querySelectorAll('tr')].slice(0, 2).map((row) => [
          row.querySelector('[data-date]').dataset.date, row.querySelector('.zx-date-picker__week').textContent
        ]);
        dp.destroy();
        return rows;
      });
      assert.deepEqual(weeks, [['2025-12-28', '1'], ['2026-01-04', '2']]);
    }
  },
  {
    name: 'P7 closing the month and year panel shows the year stepped to',
    async run({ page }) {
      await page.evaluate(() => {
        window.months = [];
        window.dp = new zx.DatePicker(null, { value: new Date(2026, 4, 12) });
        dp.on('monthchange', (event) => months.push(`${event.detail.year}-${event.detail.month}`));
        document.body.append(dp.el);
        dp.refs.heading.click();
        dp.refs.quickNext.click();
      });
      await page.keyboard.press('Escape');
      const state = await page.evaluate(() => ({
        heading: dp.refs.heading.textContent,
        months,
        stop: dp.refs.days.querySelector('[tabindex="0"]')?.dataset.date ?? null,
        focused: document.activeElement === dp.refs.heading
      }));
      assert.deepEqual(state, { heading: 'May 2027', months: ['2027-4'], stop: '2027-05-12', focused: true });
      // The heading button closes it the same way.
      await page.evaluate(() => { dp.refs.heading.click(); dp.refs.quickPrevious.click(); dp.refs.quickPrevious.click(); dp.refs.heading.click(); });
      assert.equal(await page.evaluate(() => dp.refs.heading.textContent), 'May 2025');
      await page.evaluate(() => { dp.focus(); });
      assert.equal((await activeData(page)).date, '2025-05-12');
      await page.evaluate(() => dp.destroy());
    }
  },
  {
    name: 'P8 a date-time box allows any time on its max and min days',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const box = zx.DateTimeBox(null, { min: new Date(2024, 0, 10), max: new Date(2024, 0, 31) });
        document.body.append(box.el);
        const stamp = (date) => date && `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
        const out = [];
        box.set(new Date(2024, 0, 31, 15, 0));
        out.push(stamp(box.get()), box._picker._timePicker.get().h);
        box.set(new Date(2024, 1, 5, 10, 30));
        out.push(stamp(box.get()));
        box.set(new Date(2024, 0, 2, 8, 15));
        out.push(stamp(box.get()));
        box.destroy();
        return out;
      });
      assert.deepEqual(result, ['2024-1-31 15:0', 15, '2024-1-31 10:30', '2024-1-10 8:15']);
    }
  },
  {
    name: 'P9 date fields expose the calendar as a combobox dialog',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const read = (component) => {
          const input = component.refs.input;
          const popup = document.getElementById(input.getAttribute('aria-controls'));
          component.open();
          const open = input.getAttribute('aria-expanded');
          component.close();
          return {
            role: input.getAttribute('role'),
            popup: input.getAttribute('aria-haspopup'),
            toggle: component.refs.toggle.getAttribute('aria-haspopup'),
            dialog: popup?.getAttribute('role'),
            named: Boolean(popup?.getAttribute('aria-label')),
            open,
            closed: input.getAttribute('aria-expanded')
          };
        };
        const box = new zx.Datebox(null, {});
        const range = new zx.DateRangeBox(null, {});
        document.body.append(box.el, range.el);
        const out = [read(box), read(range)];
        box.destroy();
        range.destroy();
        return out;
      });
      for (const entry of result) {
        assert.deepEqual(entry, { role: 'combobox', popup: 'dialog', toggle: 'dialog', dialog: 'dialog', named: true, open: 'true', closed: 'false' });
      }
    }
  },
  {
    name: 'P10 Toggle, CheckButton, and Search restore their target without writing a style attribute',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const writes = [];
        const setAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function record(name, value) {
          if (String(name).toLowerCase() === 'style') writes.push(this.localName);
          return setAttribute.call(this, name, value);
        };
        const out = [];
        try {
          for (const [Kind, tag] of [[zx.Toggle, 'button'], [zx.CheckButton, 'button'], [zx.Search, 'form']]) {
            const target = document.createElement(tag);
            target.id = 'target';
            target.className = 'app-control';
            target.setAttribute('data-app', 'x');
            target.style.cssText = 'margin: 3px; color: var(--zx-color-text)';
            target.append('Original', document.createElement('span'));
            document.body.append(target);
            const before = target.outerHTML;
            const style = target.getAttribute('style');
            const children = [...target.childNodes];
            for (let round = 0; round < 2; round += 1) {
              const component = new Kind(target, {});
              component.el.style.setProperty('outline', '1px solid');
              component.destroy();
            }
            out.push({
              same: target.outerHTML === before,
              nodes: [...target.childNodes].every((node, index) => node === children[index]),
              style: target.getAttribute('style') === style
            });
            target.remove();
          }
        } finally {
          Element.prototype.setAttribute = setAttribute;
        }
        return { out, writes };
      });
      assert.deepEqual(result.writes, [], 'a style attribute was written');
      for (const entry of result.out) {
        assert.deepEqual(entry, { same: true, nodes: true, style: true });
      }
    }
  },
  {
    name: 'P11 truncate hands back the line count an element came with',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const element = zx.h('p', { 'data-lines': '3' }, 'Text');
        element.style.setProperty('--zx-truncate-lines', '3');
        document.body.append(element);
        const controller = zx.truncate(element, { lines: 2 });
        const during = [element.dataset.lines, element.style.getPropertyValue('--zx-truncate-lines')];
        controller.destroy();
        const after = [element.dataset.lines, element.style.getPropertyValue('--zx-truncate-lines')];
        element.remove();
        const bare = zx.h('p', {}, 'Text');
        document.body.append(bare);
        zx.truncate(bare, { lines: 3 }).destroy();
        const left = bare.outerHTML;
        bare.remove();
        return { during, after, left };
      });
      assert.deepEqual(result, { during: ['2', '2'], after: ['3', '3'], left: '<p>Text</p>' });
    }
  },
  {
    name: 'P12 a CopyInput destroyed while the clipboard is busy reports nothing',
    async run({ page }) {
      await page.evaluate(() => {
        window.copies = [];
        window.settle = null;
        Object.defineProperty(navigator, 'clipboard', { configurable: true,
          value: { writeText: () => new Promise((resolve) => { window.settle = resolve; }) } });
        window.input = new zx.CopyInput(null, { value: 'INV-1042' });
        input.on('copy', (event) => copies.push(event.detail));
        input.el.addEventListener('zx-copy', (event) => copies.push(['dom', event.detail]));
        document.body.append(input.el);
        window.button = input.el.querySelector('.zx-copy-button');
        button.click();
      });
      await page.waitForFunction(() => typeof window.settle === 'function');
      await page.evaluate(async () => {
        input.destroy();
        window.settle();
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      assert.deepEqual(await page.evaluate(() => [copies, button.hasAttribute('data-copied')]), [[], false]);

      // A live CopyInput still copies and reports.
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
        window.input = new zx.CopyInput(null, { value: 'INV-1043' });
        input.on('copy', (event) => copies.push(event.detail));
        document.body.append(input.el);
        input.el.querySelector('.zx-copy-button').click();
      });
      await page.waitForFunction(() => copies.length === 1);
      assert.deepEqual(await page.evaluate(() => copies), [{ value: 'INV-1043', copied: true }]);
      await page.evaluate(() => input.destroy());
    }
  },
  {
    name: 'P13 copying a second section link restores the first link\'s glyph',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
        const copies = [];
        const article = zx.h('article', { class: 'zx-prose' },
          zx.h('h2', { id: 'one' }, 'One'), zx.h('h2', { id: 'two' }, 'Two'));
        document.body.append(article);
        const anchors = zx.proseAnchors(article, { href: (id) => `https://example.test/#${id}`, oncopy: (url) => copies.push(url) });
        const [first, second] = article.querySelectorAll('.zx-prose__anchor');
        const link = zx.icon('link-2').outerHTML;
        const check = zx.icon('check').outerHTML;
        const wait = async (count) => {
          for (let tick = 0; tick < 40 && copies.length < count; tick += 1) await new Promise((resolve) => setTimeout(resolve, 10));
        };
        first.click();
        await wait(1);
        const afterFirst = [first.innerHTML === check, first.dataset.copied];
        second.click();
        await wait(2);
        const out = {
          afterFirst,
          first: [first.innerHTML === link, first.dataset.copied ?? null],
          second: [second.innerHTML === check, second.dataset.copied]
        };
        anchors.destroy();
        out.cleaned = !article.querySelector('.zx-prose__anchor, .zx-prose__status');
        article.remove();
        return out;
      });
      assert.deepEqual(result, {
        afterFirst: [true, 'true'], first: [true, null], second: [true, 'true'], cleaned: true
      });
    }
  }
];
