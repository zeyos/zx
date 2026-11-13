import assert from 'node:assert/strict';

/** Wait for native dialog close tasks and their following focus/render work. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

/** Opens a fresh overlay and records every `cancel` reason and `close`. */
const present = (page, kind, options = {}) => page.evaluate(({ kind, options }) => {
  window.overlay?.destroy();
  window.reasons = [];
  window.closes = 0;
  window.overlay = new zx[kind](null, { title: 'Working', content: 'Please wait', ...options });
  window.overlay.on('cancel', (event) => window.reasons.push(event.detail.reason));
  window.overlay.on('close', () => { window.closes += 1; });
  window.overlay.open();
}, { kind, options });

const state = (page) => page.evaluate(() => ({ open: window.overlay.isOpen(), reasons: window.reasons }));

/** What a reader can do with the header close button: see it, reach it, and what a click does. */
const closeButton = (page) => page.evaluate(() => {
  const button = window.overlay.refs.close;
  const rect = button.getBoundingClientRect();
  button.focus();
  const focused = document.activeElement === button;
  button.click();
  return { display: getComputedStyle(button).display, width: rect.width, focused };
});

const PLACEMENTS = ['top-start', 'top', 'top-end', 'bottom-start', 'bottom', 'bottom-end'];

/** The rectangle of every floating region, by placement. */
const regions = (page) => page.evaluate(() => Object.fromEntries(
  Array.from(document.querySelectorAll('.zx-message-region'), (region) => {
    const rect = region.getBoundingClientRect();
    return [region.dataset.placement, {
      left: Math.round(rect.left), right: Math.round(rect.right),
      top: Math.round(rect.top), bottom: Math.round(rect.bottom),
      toasts: region.querySelectorAll('.zx-message__toast').length,
      shown: region.matches(':popover-open')
    }];
  })
));

export const cases = [
  {
    name: 'W1 an option passed as undefined keeps the declared default',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const search = new zx.Search(null, { value: undefined, placeholder: undefined });
        const shown = { value: search.el.querySelector('input').value, placeholder: search.el.querySelector('input').placeholder };
        search.destroy();

        const kept = {};
        for (const [name, option, extra] of [
          ['Toggle', 'label', {}],
          ['Table', 'rowId', { columns: [{ id: 'name', label: 'Name' }], data: [] }],
          ['Select', 'valueKey', { items: [] }],
          ['Dialog', 'closable', {}],
          ['Sheet', 'closeButton', {}],
          ['Chart', 'aspectRatio', {}]
        ]) {
          const plain = new zx[name](null, { ...extra });
          const forwarded = new zx[name](null, { ...extra, [option]: undefined });
          kept[`${name}.${option}`] = forwarded.options[option] === plain.options[option]
            && forwarded.options[option] !== undefined;
          plain.destroy();
          forwarded.destroy();
        }
        const passed = { closable: undefined, title: 'Kept' };
        const dialog = new zx.Dialog(null, passed);
        dialog.destroy();
        const nulled = new zx.Dialog(null, { title: null });
        const title = nulled.options.title;
        nulled.destroy();
        return { shown, kept, passed: Object.keys(passed), title, text: document.body.textContent.includes('undefined') };
      });
      assert.deepEqual(result.shown, { value: '', placeholder: '' }, 'Search shows no "undefined"');
      for (const [name, same] of Object.entries(result.kept)) assert.equal(same, true, `${name} keeps its default`);
      assert.deepEqual(result.passed, ['closable', 'title'], 'the passed object is untouched');
      assert.equal(result.title, null, 'null still overrides');

      // The reported symptom: a dialog given `closable: undefined` ignored Escape.
      await present(page, 'Dialog', { closable: undefined });
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await state(page), { open: false, reasons: ['escape'] });
      await page.evaluate(() => window.overlay.destroy());
    }
  },
  {
    name: 'W2 a switched-off close button is not displayed, not focusable and closes nothing',
    async run({ page }) {
      for (const [kind, options] of [
        ['Dialog', { closable: false }],
        ['Sheet', { closeButton: false }],
        ['Sheet', { closeButton: false, modal: false }],
        ['Sheet', { closeButton: false, modal: 'trap-focus' }],
        ['Sheet', { closeButton: false, side: 'bottom' }]
      ]) {
        const label = `${kind} ${JSON.stringify(options)}`;
        await present(page, kind, options);
        await settle(page);
        assert.deepEqual(await closeButton(page), { display: 'none', width: 0, focused: false }, label);
        await settle(page);
        assert.deepEqual(await state(page), { open: true, reasons: [] }, `${label}: a click closes nothing`);
        // Nothing a keyboard reaches is the close button either.
        for (let step = 0; step < 4; step += 1) {
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement === window.overlay.refs.close), false,
            `${label}: Tab does not reach it`);
        }
      }

      // The cancel contract is unchanged: a dialog that is not closable still reports the Escape
      // it refuses, and a programmatic close still closes it.
      await present(page, 'Dialog', { closable: false });
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await state(page), { open: true, reasons: ['escape'] });
      await page.evaluate(() => window.overlay.close());
      await settle(page);
      assert.equal((await state(page)).open, false);

      // Switched on, the button is there and dismisses with its reason — on a sheet whatever
      // `closable` says, because the ✕ is `closeButton`'s.
      for (const [kind, options] of [['Dialog', {}], ['Sheet', {}], ['Sheet', { closable: false }]]) {
        await present(page, kind, options);
        await settle(page);
        const button = await closeButton(page);
        assert.notEqual(button.display, 'none');
        assert.ok(button.width > 0);
        assert.equal(button.focused, true);
        await settle(page);
        assert.deepEqual(await state(page), { open: false, reasons: ['close-button'] }, `${kind} ${JSON.stringify(options)}`);
      }
      await page.evaluate(() => window.overlay.destroy());
    }
  },
  {
    name: 'W3 without showModal(), showPopover(), show() and close() the overlays open and close on the open attribute',
    async run({ page }) {
      for (const [kind, options] of [
        ['Modal', { content: 'Body' }],
        ['Dialog', { title: 'Title', content: 'Body' }],
        ['Sheet', { title: 'Title' }],
        ['Sheet', { title: 'Title', modal: false }],
        ['Sheet', { title: 'Title', modal: 'trap-focus' }],
        ['Launcher', { items: [{ id: 'a', label: 'Alpha' }], shortcut: false }]
      ]) {
        const label = `${kind} ${JSON.stringify(options)}`;
        const result = await page.evaluate(async ({ kind, options }) => {
          const overlay = new zx[kind](null, options);
          // What a DOM without these methods looks like: the element is there, the methods are not.
          for (const method of ['showModal', 'showPopover', 'hidePopover', 'show', 'close']) {
            overlay.el[method] = undefined;
          }
          const events = [];
          overlay.on('open', () => events.push('open'));
          overlay.on('close', () => events.push('close'));
          const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const steps = [];
          for (let cycle = 0; cycle < 2; cycle += 1) {
            overlay.open();
            await frames();
            const rect = overlay.el.getBoundingClientRect();
            steps.push({
              open: overlay.isOpen(), attribute: overlay.el.hasAttribute('open'),
              visible: rect.width > 0 && rect.height > 0, state: overlay.el.dataset.state
            });
            overlay.close();
            await frames();
            steps.push({
              open: overlay.isOpen(), attribute: overlay.el.hasAttribute('open'), state: overlay.el.dataset.state
            });
          }
          const lifecycle = events.slice();
          overlay.open();
          overlay.destroy();
          return { steps, events: lifecycle, left: document.querySelectorAll('dialog').length };
        }, { kind, options });
        const opened = { open: true, attribute: true, visible: true, state: 'open' };
        const closed = { open: false, attribute: false, state: 'closed' };
        assert.deepEqual(result.steps, [opened, closed, opened, closed], label);
        assert.deepEqual(result.events, ['open', 'close', 'open', 'close'], label);
        assert.equal(result.left, 0, `${label}: destroy while open removes the dialog`);
      }

      // Escape still asks to dismiss a modal presented by the attribute, and `closable: false`
      // still refuses it.
      for (const [closable, expected] of [[true, { open: false, reasons: ['escape'] }], [false, { open: true, reasons: ['escape'] }]]) {
        await page.evaluate((closable) => {
          window.overlay?.destroy();
          window.reasons = [];
          window.overlay = new zx.Dialog(null, { title: 'Title', closable });
          for (const method of ['showModal', 'show', 'close']) window.overlay.el[method] = undefined;
          window.overlay.on('cancel', (event) => window.reasons.push(event.detail.reason));
          window.overlay.open();
        }, closable);
        await settle(page);
        await page.keyboard.press('Escape');
        await settle(page);
        assert.deepEqual(await state(page), expected, `closable: ${closable}`);
      }
      await page.evaluate(() => window.overlay.destroy());
    }
  },
  {
    name: 'W4 a floating message is placed at one of six places, one region per placement',
    async run({ page }) {
      const width = 1280;
      const height = 900;
      await page.evaluate((placements) => {
        window.handles = placements.map((placement) => zx.Message.info(`At ${placement}`, { placement, timeout: 0 }));
        // A second message of a placement joins its region; one that names none uses the default.
        window.handles.push(zx.Message.success('Second at the foot', { placement: 'bottom-end', timeout: 0 }));
        window.handles.push(zx.Message.info('Default corner', { timeout: 0 }));
      }, PLACEMENTS);
      await settle(page);
      let found = await regions(page);
      assert.deepEqual(Object.keys(found).sort(), [...PLACEMENTS].sort(), 'one region per placement');
      for (const placement of PLACEMENTS) {
        const rect = found[placement];
        assert.equal(rect.shown, true, `${placement} is shown`);
        const expected = placement === 'bottom-end' || placement === 'top-end' ? 2 : 1;
        assert.equal(rect.toasts, expected, `${placement} holds its own messages`);
        if (placement.startsWith('top')) assert.equal(rect.top, 16, `${placement} block-start offset`);
        else assert.equal(rect.bottom, height - 16, `${placement} block-end offset`);
        if (placement.endsWith('-start')) assert.equal(rect.left, 16, `${placement} inline-start offset`);
        else if (placement.endsWith('-end')) assert.equal(rect.right, width - 16, `${placement} inline-end offset`);
        else assert.ok(Math.abs((rect.left + rect.right) / 2 - width / 2) <= 1, `${placement} is centred`);
        assert.equal(rect.right - rect.left, 420, `${placement} keeps the region width`);
      }

      // At the foot the newest message is the one nearest the edge, in document order.
      const order = await page.evaluate(() => Array.from(
        document.querySelectorAll('.zx-message-region[data-placement="bottom-end"] .zx-message__toast'),
        (toast) => [toast.textContent.trim(), Math.round(toast.getBoundingClientRect().bottom)]
      ));
      assert.equal(order[0][0], 'At bottom-end');
      assert.ok(order[1][1] > order[0][1], 'the later message sits below the earlier one');
      assert.equal(order[1][1], height - 16);

      // The offset is one custom property, read from the scope.
      await page.evaluate(() => document.documentElement.style.setProperty('--zx-message-offset', '40px'));
      found = await regions(page);
      assert.equal(found['top-start'].top, 40);
      assert.equal(found['top-start'].left, 40);
      assert.equal(found['bottom-end'].bottom, height - 40);
      assert.equal(found['bottom-end'].right, width - 40);
      assert.ok(Math.abs((found.bottom.left + found.bottom.right) / 2 - width / 2) <= 1);
      await page.evaluate(() => document.documentElement.style.removeProperty('--zx-message-offset'));

      // start and end follow the writing direction.
      await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
      found = await regions(page);
      assert.equal(found['top-start'].right, width - 16);
      assert.equal(found['bottom-end'].left, 16);
      await page.evaluate(() => { document.documentElement.dir = 'ltr'; });

      // On a phone there is one column: every placement spans the foot.
      await page.setViewportSize({ width: 390, height: 800 });
      found = await regions(page);
      for (const placement of PLACEMENTS) {
        assert.deepEqual([found[placement].left, found[placement].right, found[placement].bottom], [16, 374, 784], placement);
      }
      await page.setViewportSize({ width, height });

      // A region goes when its last message closes; the others stay.
      await page.evaluate(() => window.handles[0].close());
      await settle(page);
      found = await regions(page);
      assert.equal(found['top-start'], undefined);
      assert.equal(Object.keys(found).length, 5);

      // disposeRegion() removes every placement of the scope at once.
      assert.equal(await page.evaluate(() => zx.Message.disposeRegion(document.body)), true);
      assert.equal(await page.locator('.zx-message-region').count(), 0);
      assert.equal(await page.evaluate(() => zx.Message.disposeRegion(document.body)), false);
    }
  },
  {
    name: 'W5 the default placement is settable, per scope regions stay apart, and progress is placed too',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const placements = () => Array.from(document.querySelectorAll('.zx-message-region'),
          (region) => `${region.parentElement.id || 'body'}:${region.dataset.placement}`).sort();
        const steps = {};
        steps.initial = zx.Message.getPlacement();
        const first = zx.Message.info('Before', { timeout: 0 });
        steps.returned = zx.Message.setPlacement('bottom');
        const second = zx.Message.info('After', { timeout: 0 });
        const explicit = zx.Message.info('Explicit', { placement: 'top-end', timeout: 0 });
        const unknown = zx.Message.info('Unknown', { placement: 'sideways', timeout: 0 });
        await frames();
        steps.afterDefault = placements();
        steps.topEnd = document.querySelector('[data-placement="top-end"]').textContent;
        steps.bottom = document.querySelector('[data-placement="bottom"]').textContent;

        const scope = zx.h('div', { id: 'panel', class: 'zx-scope' });
        document.body.append(scope);
        const scoped = zx.Message.info('Scoped', { scope, placement: 'bottom', timeout: 0 });
        const progress = zx.Message.progress('Working', { scope, placement: 'top-start' });
        await frames();
        steps.withScope = placements();
        steps.disposedScope = zx.Message.disposeRegion(scope);
        steps.afterScope = placements();
        // Closing a handle whose region was disposed is safe.
        scoped.close();
        progress.done();

        steps.restored = zx.Message.setPlacement('nowhere');
        for (const handle of [first, second, explicit, unknown]) handle.close();
        await frames();
        steps.left = placements();
        scope.remove();
        return steps;
      });
      assert.equal(result.initial, 'top-end');
      assert.equal(result.returned, 'bottom');
      assert.deepEqual(result.afterDefault, ['body:bottom', 'body:top-end']);
      assert.ok(result.topEnd.includes('Before') && result.topEnd.includes('Explicit'));
      assert.ok(result.bottom.includes('After') && result.bottom.includes('Unknown'),
        'an unknown placement is the default one');
      assert.deepEqual(result.withScope, ['body:bottom', 'body:top-end', 'panel:bottom', 'panel:top-start']);
      assert.equal(result.disposedScope, true);
      assert.deepEqual(result.afterScope, ['body:bottom', 'body:top-end']);
      assert.equal(result.restored, 'top-end');
      assert.deepEqual(result.left, []);
    }
  },
  {
    name: 'W6 placed messages follow a modal dialog and stay usable inside it',
    async run({ page }) {
      await page.evaluate(() => {
        window.undone = [];
        window.dialog = new zx.Dialog(null, { title: 'Edit', content: 'Body' });
        window.dialog.open();
        for (const placement of ['top-start', 'bottom']) {
          zx.Message.info(`At ${placement}`, {
            placement, timeout: 0, action: { label: `Undo ${placement}`, onclick: () => window.undone.push(placement) }
          });
        }
      });
      await settle(page);
      assert.deepEqual(await page.evaluate(() => Array.from(document.querySelectorAll('.zx-message-region'),
        (region) => region.parentElement === window.dialog.el)), [true, true]);
      await page.getByRole('button', { name: 'Undo top-start' }).click();
      await page.getByRole('button', { name: 'Undo bottom' }).click();
      await settle(page);
      assert.deepEqual(await page.evaluate(() => window.undone), ['top-start', 'bottom']);
      assert.equal(await page.evaluate(() => window.dialog.isOpen()), true, 'a press on a toast dismisses nothing');
      assert.equal(await page.locator('.zx-message-region').count(), 0);
      await page.evaluate(() => window.dialog.destroy());
    }
  }
];
