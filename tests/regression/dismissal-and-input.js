import assert from 'node:assert/strict';

/** Wait for native dialog close tasks and their following focus/render work. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

/** Opens a fresh overlay whose `cancel` is recorded and, when asked, prevented. */
const present = (page, kind, options = {}, prevent = true) => page.evaluate(({ kind, options, prevent }) => {
  window.overlay?.destroy();
  window.reasons = [];
  window.overlay = new zx[kind](null, { title: 'Edit', content: 'Unsaved changes', ...options });
  window.overlay.on('cancel', (event) => {
    window.reasons.push(event.detail.reason);
    if (prevent) event.preventDefault();
  });
  window.overlay.open();
}, { kind, options, prevent });

const state = (page) => page.evaluate(() => ({ open: window.overlay.isOpen(), reasons: window.reasons }));

/** WCAG relative-luminance contrast between two sRGB triples. */
function contrast(a, b) {
  const luminance = ([r, g, bl]) => {
    const channel = (value) => {
      const unit = value / 255;
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

export const cases = [
  {
    name: 'D1 every dismissal gesture raises one preventable cancel that names it',
    async run({ page }) {
      // Modal sheet: Escape (repeated, with no other interaction), the close button, the backdrop.
      await present(page, 'Sheet');
      for (let press = 0; press < 4; press += 1) await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: ['escape', 'escape', 'escape', 'escape'] },
        'a prevented Escape keeps a modal sheet open however often it is pressed');

      await present(page, 'Sheet');
      await page.locator('.zx-sheet .zx-dialog__close').click();
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: ['close-button'] });

      await present(page, 'Sheet');
      await page.mouse.click(20, 450);
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: ['backdrop'] });

      // Non-modal sheet: Escape, close button, a press outside.
      await present(page, 'Sheet', { modal: false });
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.overlay.refs.close.click());
      await page.mouse.click(20, 450);
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: ['escape', 'close-button', 'outside'] });

      // Dialog: the close button it shares with Sheet, and a footer button whose action is 'cancel'.
      await present(page, 'Dialog', { buttons: [{ label: 'Discard', action: 'cancel' }] });
      await page.locator('.zx-dialog__close').click();
      await page.getByRole('button', { name: 'Discard' }).click();
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: ['close-button', 'button', 'escape'] });

      // Modal with light dismiss.
      await present(page, 'Modal', { lightDismiss: true, width: 320 });
      await page.mouse.click(12, 12);
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: ['backdrop'] });
      await page.evaluate(() => window.overlay.destroy());
    }
  },
  {
    name: 'D2 an unprevented cancel closes once; close() and closable:false keep their meaning',
    async run({ page }) {
      for (const [gesture, reason] of [
        [() => page.keyboard.press('Escape'), 'escape'],
        [() => page.locator('.zx-sheet .zx-dialog__close').click(), 'close-button'],
        [() => page.mouse.click(20, 450), 'backdrop']
      ]) {
        await present(page, 'Sheet', {}, false);
        await page.evaluate(() => {
          window.closes = 0;
          window.overlay.on('close', () => { window.closes += 1; });
        });
        await gesture();
        await settle(page);
        assert.deepEqual(await state(page), { open: false, reasons: [reason] });
        assert.equal(await page.evaluate(() => window.closes), 1, `${reason} closed exactly once`);
      }

      // A programmatic close is the application's own decision: no cancel, not preventable.
      await present(page, 'Sheet');
      await page.evaluate(() => window.overlay.close('saved'));
      await settle(page);
      assert.deepEqual(await state(page), { open: false, reasons: [] });

      // closable:false still refuses Escape, and still reports that it was asked.
      await present(page, 'Modal', { closable: false }, false);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: ['escape', 'escape'] });

      // Escape belongs to a popup opened inside the dialog before it belongs to the dialog.
      await page.evaluate(() => {
        window.overlay.destroy();
        window.reasons = [];
        window.select = new zx.Select(null, { items: [{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }] });
        window.overlay = new zx.Dialog(null, { title: 'Pick', content: window.select.el });
        window.overlay.on('cancel', (event) => window.reasons.push(event.detail.reason));
        window.overlay.open();
      });
      await settle(page);
      await page.evaluate(() => { window.select.focus(); window.select.open(); });
      await settle(page);
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await page.evaluate(() => ({
        popup: window.select._open, dialog: window.overlay.isOpen(), reasons: window.reasons
      })), { popup: false, dialog: true, reasons: [] });
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await state(page), { open: false, reasons: ['escape'] });
      await page.evaluate(() => { window.select.destroy(); window.overlay.destroy(); });

      // A popup that answers Escape from a `document` listener registered after the dialog opened.
      await page.evaluate(() => {
        window.reasons = [];
        window.overlay = new zx.Dialog(null, { title: 'Due', content: 'Loading' });
        window.overlay.on('cancel', (event) => window.reasons.push(event.detail.reason));
        window.overlay.open();
        window.datebox = new zx.Datebox(null, { value: new Date(2026, 4, 20) });
        window.overlay.setContent(window.datebox.el);
      });
      await settle(page);
      await page.locator('.zx-datebox input').first().click();
      await page.evaluate(() => window.datebox.open?.());
      await settle(page);
      const popup = page.locator('.zx-datebox [popover]:popover-open, .zx-date-picker:visible').first();
      await popup.waitFor();
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: [] }, 'Escape closed the calendar, not the dialog');
      assert.equal(await popup.isVisible(), false);
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await state(page), { open: false, reasons: ['escape'] });
      await page.evaluate(() => { window.datebox.destroy(); window.overlay.destroy(); });

      // A non-modal sheet that is not closable reports the Escape it refuses.
      await present(page, 'Sheet', { modal: false, closable: false }, false);
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: ['escape'] });
      await page.evaluate(() => window.overlay.destroy());
    }
  },
  {
    name: 'D3 NumberField keeps exact values with snap:false and still snaps by default',
    async run({ page }) {
      const commit = (options, typed) => page.evaluate(({ options, typed }) => {
        const field = new zx.NumberField(null, { label: 'Value', ...options });
        document.body.append(field.el);
        const changes = [];
        field.on('change', (event) => changes.push(event.detail.value));
        const input = field.getInput();
        input.focus();
        input.value = typed;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.blur();
        const result = { value: field.get(), shown: input.value, changes };
        field.destroy();
        return result;
      }, { options, typed });

      assert.deepEqual(await commit({ step: 2 }, '123'), { value: 124, shown: '124', changes: [124] });
      assert.deepEqual(await commit({ step: 2, snap: false }, '123'), { value: 123, shown: '123', changes: [123] });
      assert.deepEqual(await commit({ step: 1, snap: false }, '2.5'), { value: 2.5, shown: '2.5', changes: [2.5] });
      assert.deepEqual(await commit({ step: 0.0001, snap: false }, '0.00002'),
        { value: 0.00002, shown: '0.00002', changes: [0.00002] });
      assert.deepEqual(await commit({ step: 0.1, snap: false }, '4'), { value: 4, shown: '4.0', changes: [4] });
      // An explicit precision still rounds, and the bounds still hold.
      assert.deepEqual(await commit({ snap: false, precision: 2 }, '1.239'), { value: 1.24, shown: '1.24', changes: [1.24] });
      assert.deepEqual(await commit({ snap: false, min: 0, max: 10 }, '12.5'), { value: 10, shown: '10', changes: [10] });

      const stepped = await page.evaluate(() => {
        const field = new zx.NumberField(null, { step: 2, snap: false, value: 123 });
        const drift = new zx.NumberField(null, { step: 0.1, snap: false, value: 0.25 });
        const result = [field.stepUp().get(), field.stepDown(2).get(), drift.stepUp().get(), drift.stepUp().get()];
        field.destroy(); drift.destroy();
        return result;
      });
      assert.deepEqual(stepped, [125, 121, 0.35, 0.45], 'stepping moves by step from the exact value, without drift');
      const tiny = await page.evaluate(() => {
        const field = new zx.NumberField(null, { snap: false, value: 1.5e-16 });
        const result = [field.get(), field.getInput().value];
        field.destroy();
        return result;
      });
      assert.deepEqual(tiny, [1.5e-16, '0.00000000000000015'], 'a value below the rounding limit is kept');
    }
  },
  {
    name: 'D4 Checklist takes a label and a disabled state that survives every re-render',
    async run({ page }) {
      await page.evaluate(() => {
        window.list = new zx.Checklist(null, {
          label: 'Permissions', disabled: true,
          items: [{ ID: 1, name: 'Read', on: true }, { ID: 2, name: 'Write' }, { ID: 3, name: 'Admin' }]
        });
        window.changes = 0;
        window.list.on('change', () => { window.changes += 1; });
        document.body.append(window.list.el);
      });
      const group = page.getByRole('group', { name: 'Permissions' });
      assert.equal(await group.count(), 1, 'the label option names the group');
      const controls = () => page.evaluate(() => ({
        aria: window.list.el.getAttribute('aria-disabled'),
        disabled: [...window.list.el.querySelectorAll('input')].map((input) => input.disabled),
        is: window.list.isDisabled()
      }));
      assert.deepEqual(await controls(), { aria: 'true', disabled: [true, true, true, true], is: true });
      await page.getByText('Write').click({ force: true });
      assert.equal(await page.evaluate(() => window.changes), 0, 'a disabled checklist ignores clicks');

      await page.evaluate(() => {
        window.list.search('a');
        window.list.setItems([{ ID: 4, name: 'Audit' }, { ID: 5, name: 'Approve' }]);
        window.list.setValues([4]);
      });
      assert.deepEqual(await controls(), { aria: 'true', disabled: [true, true, true], is: true },
        'search, setItems and setValues keep the disabled state');
      assert.deepEqual(await page.evaluate(() => window.list.getValues()), [4], 'values stay settable while disabled');

      await page.evaluate(() => { window.list.enable(); window.list.setLabel('Roles'); window.list.search(''); });
      assert.deepEqual(await controls(), { aria: null, disabled: [false, false, false], is: false });
      assert.equal(await page.getByRole('group', { name: 'Roles' }).count(), 1);
      await page.getByText('Approve').click();
      assert.deepEqual(await page.evaluate(() => window.list.getValues()), [4, 5]);

      // The `checklist` field type drives the same state, including for items loaded later.
      const viaField = await page.evaluate(() => {
        const field = new zx.Field(null, { type: 'checklist', label: 'Scopes', props: { items: [{ ID: 1, name: 'One' }] } });
        document.body.append(field.el);
        field.setDisabled(true);
        const inner = field.el.querySelector('.zx-checklist');
        const locked = inner.getAttribute('aria-disabled') === 'true'
          && [...inner.querySelectorAll('input')].every((input) => input.disabled);
        field.setDisabled(false);
        const open = !inner.hasAttribute('aria-disabled') && [...inner.querySelectorAll('input')].every((input) => !input.disabled);
        field.destroy();
        return { locked, open };
      });
      assert.deepEqual(viaField, { locked: true, open: true });

      const fallback = await page.evaluate(() => {
        window.list.destroy();
        const plain = new zx.Checklist(null, { items: [] });
        const name = plain.el.querySelector('.zx-checklist__label').textContent;
        plain.destroy();
        return name;
      });
      assert.equal(fallback, 'Checklist', 'without a label the message is used');
    }
  },
  {
    name: 'D5 anchored popups write no inline style attribute under a strict style-src policy',
    async run({ page, base, theme }) {
      await page.route(`${base}/__csp.html`, (route) => route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'"
        },
        body: `<!doctype html><html lang="en" data-zx-theme="${theme}"><head><meta charset="utf-8">`
          + '<link rel="stylesheet" href="/styles/zx.css"><script type="module" src="/__csp.js"></script>'
          + '</head><body><div id="styled"></div></body></html>'
      }));
      await page.route(`${base}/__csp.js`, (route) => route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/javascript; charset=utf-8' },
        body: "import * as zx from '/src/index.js'; window.violations = [];"
          + "document.addEventListener('securitypolicyviolation', (event) => window.violations.push(event.violatedDirective));"
          + 'window.zx = zx;'
      }));
      for (const anchors of [true, false]) {
        if (!anchors) {
          // The JS fallback every browser without CSS anchor positioning takes.
          await page.addInitScript(() => {
            const supports = CSS.supports.bind(CSS);
            CSS.supports = (...args) => (String(args[0]).includes('anchor') ? false : supports(...args));
          });
        }
        await page.goto(`${base}/__csp.html`);
        await page.waitForFunction(() => Boolean(window.zx));
        const baseline = 0;
        await page.evaluate(() => {
          window.picker = new zx.TagPicker(null, { label: 'Tags', items: [{ ID: 1, name: 'Alpha' }, { ID: 2, name: 'Beta' }] });
          window.select = new zx.Select(null, { items: [{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }] });
          document.body.append(window.picker.el, window.select.el);
        });
        // No attribute reads between the steps: a read is what used to hide the empty attribute.
        for (let round = 0; round < 3; round += 1) {
          await page.evaluate(() => { window.picker.open(); window.select.open(); });
          await page.locator('.zx-tag-picker input').pressSequentially('A');
          await settle(page);
          await page.evaluate(() => { window.picker.close(); window.select.close(); });
          await settle(page);
        }
        const result = await page.evaluate(() => {
          const panels = [window.picker.refs.panel, window.picker.refs.control,
            ...document.querySelectorAll('.zx-select [popover], .zx-select__panel')];
          return {
            styles: panels.map((element) => element.getAttribute('style')),
            violations: window.violations.length
          };
        });
        assert.deepEqual(result.styles.filter((value) => value !== null), [],
          `no style attribute is left behind (${anchors ? 'anchor positioning' : 'fallback'})`);
        assert.equal(result.violations, baseline, `no policy violation (${anchors ? 'anchor positioning' : 'fallback'})`);

        // An enhanced target with a style of its own gets it back without an attribute write.
        const restored = await page.evaluate(() => {
          const target = document.getElementById('styled');
          target.style.color = 'red';
          const field = new zx.NumberField(target, { value: 1 });
          target.style.inlineSize = '120px';
          field.destroy();
          window.picker.destroy(); window.select.destroy();
          return target.getAttribute('style');
        });
        assert.match(restored, /^color:\s*red;?$/);
        assert.equal(await page.evaluate(() => window.violations.length), baseline, 'destroy restores styles without a violation');
      }
    }
  },
  {
    name: 'D6 a pressed segment is told apart from its neighbours by fill and by a 3:1 frame',
    async run({ page }) {
      const boxes = await page.evaluate(() => {
        document.body.style.margin = '0';
        document.body.style.background = 'var(--zx-color-bg-surface)';
        const host = zx.h('div', {});
        host.style.padding = '40px';
        const segment = (label, pressed) => {
          const button = zx.button({ label });
          button.setAttribute('aria-pressed', String(pressed));
          return button;
        };
        const group = zx.buttonGroup([segment('Day', false), segment('Week', true), segment('Month', false)]);
        const ghost = zx.button({ label: 'Bold', kind: 'ghost' });
        ghost.setAttribute('aria-pressed', 'true');
        ghost.style.marginInlineStart = '40px';
        host.append(group, ghost);
        document.body.append(host);
        return [...group.children, ghost].map((button) => {
          const rect = button.getBoundingClientRect();
          return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
        });
      });
      await page.waitForTimeout(250); // Past the fill transition.
      const shot = (await page.screenshot()).toString('base64');
      const pixels = await page.evaluate(async ({ shot, boxes }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${shot}`;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const scale = image.width / window.innerWidth;
        const at = (x, y) => [...context.getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1).data].slice(0, 3);
        const [day, week, , ghost] = boxes;
        return {
          page: at(10, 10),
          unpressed: at(day.x + 5, day.y + day.h / 2),
          pressed: at(week.x + 5, week.y + week.h / 2),
          frame: at(week.x + week.w / 2, week.y + 0.5),
          ghostFrame: at(ghost.x + ghost.w / 2, ghost.y + 0.5),
          ghostFill: at(ghost.x + 4, ghost.y + ghost.h / 2)
        };
      }, { shot, boxes });
      assert.ok(contrast(pixels.frame, pixels.unpressed) >= 3,
        `pressed frame vs unpressed fill is ${contrast(pixels.frame, pixels.unpressed).toFixed(2)}:1`);
      assert.ok(contrast(pixels.frame, pixels.page) >= 3,
        `pressed frame vs page is ${contrast(pixels.frame, pixels.page).toFixed(2)}:1`);
      assert.ok(contrast(pixels.ghostFrame, pixels.page) >= 3,
        `ghost pressed frame vs page is ${contrast(pixels.ghostFrame, pixels.page).toFixed(2)}:1`);
      assert.ok(contrast(pixels.pressed, pixels.unpressed) >= 1.2,
        `pressed fill vs unpressed fill is ${contrast(pixels.pressed, pixels.unpressed).toFixed(2)}:1`);
      assert.ok(contrast(pixels.ghostFill, pixels.page) >= 1.2);
    }
  },
  {
    name: 'D7 archive, download, edit and pencil render bundled glyphs without a warning',
    async run({ page }) {
      const warnings = [];
      page.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });
      const rendered = await page.evaluate(() => ['archive', 'download', 'edit', 'pencil'].map((name) => {
        const element = zx.icon(name);
        return Boolean(element.querySelector('path')) && !element.hasAttribute('data-zx-icon-missing');
      }));
      assert.deepEqual(rendered, [true, true, true, true]);
      assert.deepEqual(warnings, []);
    }
  }
];
