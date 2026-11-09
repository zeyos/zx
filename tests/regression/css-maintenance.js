import assert from 'node:assert/strict';

export const cases = [
  {
    name: 'M16 Filter empty state and compact logic follow control geometry in LTR and RTL',
    async run({ page }) {
      await page.evaluate(() => document.body.classList.add('zx-scope'));
      for (const direction of ['ltr', 'rtl']) {
        for (const height of [30, 42]) {
          await page.evaluate(({ direction, height }) => {
            document.documentElement.dir = direction;
            document.documentElement.style.setProperty('--zx-control-height', `${height}px`);
            window.filter = new zx.Filter(null, { fields: [{ id: 'title', label: 'Title', type: 'text' }],
              value: { version: 1, root: { kind: 'group', id: 'root', logic: 'and', children: [
                { kind: 'condition', id: 'condition', field: 'title', operator: 'isEmpty', value: null }
              ] } } });
            document.body.append(filter.el);
          }, { direction, height });
          assert.equal(await page.locator('.zx-filter__value[data-empty]').count(), 1);
          assert.equal(await page.locator('[class*="--empty"]').count(), 0);
          const geometry = await page.evaluate(() => {
            const logic = filter.el.querySelector('.zx-filter__logic');
            const field = filter.el.querySelector('.zx-filter__field').getBoundingClientRect();
            const operator = filter.el.querySelector('.zx-filter__operator').getBoundingClientRect();
            return { logic: parseFloat(getComputedStyle(logic).minBlockSize), field: field.x, operator: operator.x };
          });
          assert.equal(geometry.logic, height - 2);
          assert.equal(geometry.field < geometry.operator, direction === 'ltr');
          await page.locator('.zx-filter__operator').selectOption('contains');
          await page.locator('.zx-filter__value input').fill('Vienna');
          assert.equal(await page.evaluate(() => filter.getValue().root.children[0].value), 'Vienna');
          await page.locator('.zx-filter__operator').selectOption('isEmpty');
          assert.equal(await page.locator('.zx-filter__value[data-empty]').count(), 1);
          await page.evaluate(() => { filter.destroy(); filter.destroy(); });
          assert.equal(await page.locator('.zx-filter').count(), 0);
        }
      }
    }
  },
  {
    name: 'M16 Select scoped styles preserve editable, read-only, disabled and adorned controls',
    async run({ page }) {
      await page.evaluate(() => document.body.classList.add('zx-scope'));
      for (const direction of ['ltr', 'rtl']) {
        for (const height of [30, 42]) {
          const states = await page.evaluate(({ direction, height }) => {
            document.documentElement.dir = direction;
            document.documentElement.style.setProperty('--zx-control-height', `${height}px`);
            document.documentElement.style.setProperty('--zx-control-disabled-opacity', '.4');
            window.selects = [];
            const output = [];
            for (const kind of ['readonly', 'editable', 'disabled', 'adorned']) {
              const select = new zx.Select(null, { label: kind, items: [{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }],
                value: 1, clearable: true, filter: kind === 'editable' ? 'local' : false,
                disabled: kind === 'disabled',
                renderValueAdornment: kind === 'adorned' ? () => zx.h('span', {}, 'Mark') : null });
              select.el.dataset.sample = kind;
              document.body.append(select.el);
              selects.push(select);
              const read = (element) => {
                const style = getComputedStyle(element);
                return { border: style.borderTopWidth, radius: style.borderTopLeftRadius,
                  background: style.backgroundColor, image: style.backgroundImage, shadow: style.boxShadow,
                  paddingStart: style.paddingInlineStart, paddingEnd: style.paddingInlineEnd,
                  min: parseFloat(style.minBlockSize) };
              };
              output.push({ kind, input: read(select.refs.input), toggle: read(select.refs.toggle),
                clear: read(select.refs.clear), opacity: getComputedStyle(select.el).opacity,
                readOnly: select.refs.input.readOnly });
            }
            return output;
          }, { direction, height });
          for (const state of states) {
            assert.equal(state.readOnly, state.kind !== 'editable');
            assert.equal(state.opacity, state.kind === 'disabled' ? '0.4' : '1');
            for (const name of ['input', 'toggle', 'clear']) {
              assert.equal(state[name].border, '0px', `${state.kind} ${name} border`);
              assert.equal(state[name].radius, '0px', `${state.kind} ${name} radius`);
              assert.equal(state[name].background, 'rgba(0, 0, 0, 0)', `${state.kind} ${name} background`);
              assert.equal(state[name].image, 'none');
              assert.equal(state[name].min, height - 2);
            }
            assert.equal(state.input.shadow, 'none');
            assert.equal(state.input.paddingStart, state.kind === 'adorned' ? '8px' : '10px');
            assert.equal(state.toggle.paddingStart, '0px');
            assert.equal(state.clear.paddingEnd, '0px');
          }
          const toggle = page.locator('[data-sample="readonly"] .zx-select__toggle');
          await toggle.hover();
          assert.equal(await toggle.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
          const hoverColor = await page.locator('[data-sample="readonly"]').evaluate((el) => getComputedStyle(el).color);
          for (const control of ['clear', 'toggle']) {
            const selector = `[data-sample="readonly"] .zx-select__${control}`;
            const target = page.locator(selector);
            await target.hover();
            await page.waitForFunction(({ selector, color }) => getComputedStyle(document.querySelector(selector)).color === color,
              { selector, color: hoverColor });
            assert.equal(await target.evaluate((el) => getComputedStyle(el).color), hoverColor,
              `${control} hover uses the text role`);
          }
          await page.locator('[data-sample="readonly"] input').focus();
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
          assert.equal(await page.evaluate(() => selects[0].get()), 2);
          await page.evaluate(() => { for (const select of selects) select.destroy(); });
          assert.equal(await page.locator('.zx-select, .zx-select__panel').count(), 0);
        }
      }
    }
  },
  {
    name: 'M16 Select spinner scales and its native top-layer panel remains above high-z-index content',
    async run({ page }) {
      await page.evaluate(() => {
        document.body.classList.add('zx-scope');
        window.select = new zx.Select(null, { label: 'Async', debounce: 0,
          filter: () => new Promise((resolve) => { window.resolveOptions = resolve; }) });
        document.body.append(select.el);
        select.open();
      });
      await page.waitForFunction(() => Boolean(window.resolveOptions));
      for (const height of [30, 42]) {
        await page.evaluate((height) => document.documentElement.style.setProperty('--zx-control-height', `${height}px`), height);
        await page.waitForFunction((height) => parseFloat(getComputedStyle(document.querySelector('.zx-select__loading')).inlineSize)
          === (height - 2) / 2, height);
        const size = await page.locator('.zx-select__loading').evaluate((el) => ({
          width: parseFloat(getComputedStyle(el).inlineSize), height: parseFloat(getComputedStyle(el).blockSize)
        }));
        assert.deepEqual(size, { width: (height - 2) / 2, height: (height - 2) / 2 });
      }
      await page.evaluate(() => {
        const cover = zx.h('div', { style: { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'auto' } });
        document.body.append(cover);
        resolveOptions([{ ID: 1, name: 'Loaded option' }]);
      });
      const option = page.locator('.zx-select__option', { hasText: 'Loaded option' });
      await option.waitFor();
      const panel = page.locator('.zx-select__panel');
      assert.equal(await panel.evaluate((el) => el.matches(':popover-open')), true);
      assert.equal(await panel.evaluate((el) => getComputedStyle(el).zIndex), 'auto');
      await option.click();
      assert.equal(await page.evaluate(() => select.get()), 1);
      await page.evaluate(() => select.destroy());
      assert.equal(await page.locator('.zx-select__panel').count(), 0);
    }
  },
  {
    name: 'M16 product palette is absent from generic core and restored by the optional source stylesheet',
    async run({ page, base }) {
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--zx-module-notes').trim()), '');
      await page.addStyleTag({ url: `${base}/styles/zeyos.css` });
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--zx-module-notes').trim()), '#008853');
    }
  }
];
