import assert from 'node:assert/strict';

/** Two frames: long enough for a ResizeObserver delivery and the layout that follows it. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

const CHECKOUT = [
  { name: 'cart', title: 'Cart', description: 'Article and quantity' },
  { name: 'address', title: 'Address', description: 'Where it ships' },
  { name: 'payment', title: 'Payment', description: 'How you pay', optional: true },
  { name: 'confirm', title: 'Confirm', description: 'Review and place' }
];

/**
 * Reads a rail's geometry: per step, the row it sits on, whether it is marked as a row's end,
 * whether its connector is painted, and how far that connector reaches.
 */
const rail = (page) => page.evaluate(() => {
  const list = window.stepper.el.querySelector('.zx-stepper__list');
  const listBox = list.getBoundingClientRect();
  const items = [...list.children];
  const boxes = items.map((item) => item.getBoundingClientRect());
  let row = 0;
  return items.map((item, index) => {
    if (index > 0 && boxes[index].top >= boxes[index - 1].bottom - 1) row += 1;
    const after = getComputedStyle(item, '::after');
    return {
      row,
      rowEnd: item.hasAttribute('data-row-end'),
      connector: after.content !== 'none' && after.visibility !== 'hidden',
      // The connector is the step's last flex child, so it ends where the step does.
      reach: Math.round(listBox.right - boxes[index].right),
      textLines: Math.round(item.querySelector('.zx-stepper__title').getBoundingClientRect().height
        / parseFloat(getComputedStyle(item.querySelector('.zx-stepper__title')).lineHeight) || 1)
    };
  });
});

/** Asserts that connectors are drawn exactly between two steps of the same row. */
function assertConnectors(steps, label) {
  steps.forEach((step, index) => {
    const next = steps[index + 1];
    const sameRow = Boolean(next) && next.row === step.row;
    assert.equal(step.connector, sameRow,
      `${label}: step ${index + 1} ${sameRow ? 'lost its connector' : 'draws a connector past the end of its row'}`);
    assert.equal(step.rowEnd, Boolean(next) && !sameRow, `${label}: data-row-end on step ${index + 1}`);
  });
}

export const cases = [
  {
    name: 'F13 a switch without visible text takes its accessible name from hideLabel and setLabel',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const read = (toggle) => ({
          aria: toggle.el.getAttribute('aria-label'),
          text: toggle.el.querySelector('.zx-toggle__label')?.textContent ?? null
        });
        const bare = new zx.Toggle(null, { checked: true });
        const hidden = new zx.Toggle(null, { label: 'Dark mode', hideLabel: true });
        const visible = new zx.Toggle(null, { label: 'Notifications' });
        document.body.append(bare.el, hidden.el, visible.el);
        const out = { bare: read(bare), hidden: read(hidden), visible: read(visible) };

        hidden.setLabel('High contrast');
        visible.setLabel('Email notifications');
        out.renamed = { hidden: read(hidden), visible: read(visible) };
        bare.setLabel('Now named');
        out.bareNamed = read(bare);
        visible.setLabel(null);
        out.cleared = read(visible);

        // An adopted button keeps the name it came with, and gets it back on destroy.
        const button = document.createElement('button');
        button.setAttribute('aria-label', 'Own name');
        document.body.append(button);
        const adopted = new zx.Toggle(button, { label: 'Sync', hideLabel: true });
        out.adopted = button.getAttribute('aria-label');
        adopted.setLabel(null);
        out.adoptedCleared = button.getAttribute('aria-label');
        adopted.destroy();
        out.adoptedDestroyed = button.getAttribute('aria-label');
        window.toggles = { bare, hidden, visible };
        return out;
      });
      assert.deepEqual(result.bare, { aria: null, text: null }, 'no label writes no name');
      assert.deepEqual(result.hidden, { aria: 'Dark mode', text: null });
      assert.deepEqual(result.visible, { aria: null, text: 'Notifications' }, 'a visible label keeps naming the switch');
      assert.deepEqual(result.renamed, {
        hidden: { aria: 'High contrast', text: null },
        visible: { aria: null, text: 'Email notifications' }
      });
      assert.deepEqual(result.bareNamed, { aria: null, text: 'Now named' });
      assert.deepEqual(result.cleared, { aria: null, text: null });
      assert.equal(result.adopted, 'Sync');
      assert.equal(result.adoptedCleared, 'Own name');
      assert.equal(result.adoptedDestroyed, 'Own name');

      // What assistive technology computes, not only what was written.
      await page.getByRole('switch', { name: 'High contrast', exact: true }).click();
      assert.equal(await page.evaluate(() => window.toggles.hidden.get()), true);
      assert.equal(await page.getByRole('switch', { name: 'Now named', exact: true }).count(), 1);
      // A hidden label leaves the switch exactly as wide as a bare one.
      const widths = await page.evaluate(() => {
        window.toggles.bare.setLabel(null);
        return [window.toggles.bare.el.offsetWidth, window.toggles.hidden.el.offsetWidth];
      });
      assert.equal(widths[0], widths[1]);
      await page.evaluate(() => Object.values(window.toggles).forEach((toggle) => toggle.destroy()));
    }
  },
  {
    name: 'F12 iconNames() and icon() agree, aliases included',
    async run({ page }) {
      const warnings = [];
      page.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });
      const result = await page.evaluate(async () => {
        const icons = await import('/src/core/icons.js');
        const drawn = (name) => {
          const element = icons.icon(name);
          return Boolean(element.querySelector('path')) && !element.hasAttribute('data-zx-icon-missing');
        };
        const names = icons.iconNames();
        return {
          aliases: { ...icons.iconAliases },
          frozen: Object.isFrozen(icons.iconAliases),
          undrawn: names.filter((name) => !drawn(name)),
          unlisted: Object.keys(icons.iconAliases).filter((name) => !names.includes(name)),
          sameAsTarget: Object.entries(icons.iconAliases).filter(([alias, target]) => icons.icon(alias)
            .querySelector('path').getAttribute('d') !== icons.icon(target).querySelector('path').getAttribute('d'))
            .map(([alias]) => alias),
          withoutAliases: names.filter((name) => !Object.hasOwn(icons.iconAliases, name)).length,
          total: names.length
        };
      });
      assert.deepEqual(result.aliases, {
        archive: 'box-archive', edit: 'pen-to-square', settings: 'gear', clear: 'x', checked: 'check',
        question: 'info', range: 'filter', fields: 'list', grid: 'table-cells-large'
      });
      assert.equal(result.frozen, true);
      assert.deepEqual(result.undrawn, [], 'names iconNames() lists but icon() does not draw');
      assert.deepEqual(result.unlisted, [], 'aliases icon() draws but iconNames() does not list');
      assert.deepEqual(result.sameAsTarget, [], 'aliases that do not draw their target glyph');
      assert.equal(result.total - result.withoutAliases, 9);
      assert.deepEqual(warnings, [], 'no listed name warns');

      const unknown = await page.evaluate(async () => {
        const icons = await import('/src/core/icons.js');
        return ['constructor', 'toString', 'no-such-glyph'].map((name) => [
          icons.iconNames().includes(name), icons.icon(name).getAttribute('data-zx-icon-missing')
        ]);
      });
      assert.deepEqual(unknown, [[false, 'constructor'], [false, 'toString'], [false, 'no-such-glyph']]);
    }
  },
  {
    name: 'N6 a stat tile is a button only when it is clickable, and clickable:false wins',
    async run({ page }) {
      const result = await page.evaluate(() => {
        window.clicks = [];
        const handler = (name) => () => window.clicks.push(name);
        const tiles = {
          plain: new zx.StatTile(null, { label: 'Plain', value: 1 }),
          handler: new zx.StatTile(null, { label: 'Handler', value: 2, onclick: handler('handler') }),
          flag: new zx.StatTile(null, { label: 'Flag', value: 3, clickable: true }),
          off: new zx.StatTile(null, { label: 'Off', value: 4, clickable: false, onclick: handler('off') }),
          unset: new zx.StatTile(null, { label: 'Unset', value: 5, clickable: undefined, onclick: handler('unset') }),
          noHandler: new zx.StatTile(null, { label: 'No handler', value: 6, onclick: undefined }),
          link: new zx.StatTile(null, { label: 'Link', value: 7, href: '#x', clickable: false })
        };
        tiles.flag.on('click', handler('flag'));
        const tags = {};
        for (const [name, tile] of Object.entries(tiles)) {
          document.body.append(tile.el);
          tags[name] = tile.el.tagName;
          if (name !== 'link') tile.el.click();
        }
        const focusable = tiles.off.el.tabIndex;
        let refused = false;
        try { tiles.off.update({ clickable: true }); } catch { refused = true; }
        tiles.off.update({ value: 40 });
        const offStill = tiles.off.el.tagName;
        Object.values(tiles).forEach((tile) => tile.destroy());
        return { tags, clicks: window.clicks, focusable, refused, offStill };
      });
      assert.deepEqual(result.tags, {
        plain: 'DIV', handler: 'BUTTON', flag: 'BUTTON', off: 'DIV', unset: 'BUTTON', noHandler: 'DIV', link: 'A'
      });
      assert.deepEqual(result.clicks, ['handler', 'flag', 'unset'], 'a tile that is not a button calls no handler');
      assert.equal(result.focusable, -1, 'a tile switched off is not in the tab order');
      assert.equal(result.refused, true, 'the element cannot change shape in place');
      assert.equal(result.offStill, 'DIV');
    }
  },
  {
    name: 'N7 a wrapped horizontal stepper draws no connector past the last step of a row',
    async run({ page }) {
      const loops = [];
      page.on('console', (message) => { if (/ResizeObserver loop/.test(message.text())) loops.push(message.text()); });
      await page.evaluate((steps) => {
        window.addEventListener('error', (event) => {
          if (/ResizeObserver loop/.test(event.message)) console.warn(event.message);
        });
        window.host = document.createElement('div');
        window.host.style.inlineSize = '358px';
        document.body.append(window.host);
        window.stepper = new zx.Stepper(window.host.appendChild(document.createElement('div')), { steps });
      }, CHECKOUT);
      await settle(page);

      // 358px is the content width of a 390px phone with 16px gutters: the four steps take two rows.
      const narrow = await rail(page);
      assert.ok(new Set(narrow.map((step) => step.row)).size > 1, 'the rail is expected to wrap at 358px');
      assertConnectors(narrow, 'wrapped');
      assert.deepEqual(narrow.map((step) => step.textLines), narrow.map(() => 1),
        'hiding a connector must not squeeze the step it belongs to');

      // Marking a row's end does not move the row breaks it was measured from.
      const rows = narrow.map((step) => step.row);
      await page.evaluate(() => { window.host.style.inlineSize = '359px'; });
      await settle(page);
      await page.evaluate(() => { window.host.style.inlineSize = '358px'; });
      await settle(page);
      assert.deepEqual((await rail(page)).map((step) => step.row), rows);

      // Widening it back to one row restores every connector.
      await page.evaluate(() => { window.host.style.inlineSize = '1200px'; });
      await settle(page);
      const wide = await rail(page);
      assert.deepEqual(wide.map((step) => step.row), [0, 0, 0, 0]);
      assertConnectors(wide, 'one row');
      assert.equal(wide.at(-1).reach, 0, 'the rail still spans its container');

      // A different step count wraps differently and is measured again, without a resize.
      await page.evaluate(() => {
        window.host.style.inlineSize = '358px';
        window.stepper.setSteps('Account,Company profile,Billing,Team,Integrations,Review,Done'.split(',')
          .map((title) => ({ name: title, title })));
      });
      await settle(page);
      const seven = await rail(page);
      assert.ok(new Set(seven.map((step) => step.row)).size > 2);
      assertConnectors(seven, 'seven steps');

      // The viewport the report came from: 390px wide, the rail filling the page.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => { window.host.style.inlineSize = 'auto'; });
      await settle(page);
      assertConnectors(await rail(page), '390px viewport');

      // A vertical rail has a spine, not rows, and is left alone.
      await page.evaluate((steps) => {
        window.stepper.destroy();
        window.stepper = new zx.Stepper(null, { steps, orientation: 'vertical' });
        window.host.append(window.stepper.el);
      }, CHECKOUT);
      await settle(page);
      const vertical = await rail(page);
      assert.deepEqual(vertical.map((step) => step.rowEnd), [false, false, false, false]);
      assert.deepEqual(vertical.map((step) => step.connector), [true, true, true, false]);

      // An enhanced target is handed back without the marks.
      await page.evaluate(() => window.stepper.destroy());
      assert.equal(await page.locator('[data-row-end]').count(), 0);
      assert.deepEqual(loops, [], 'row marking must settle in one pass');
    }
  },
  {
    name: 'N8 a code editor reports an error the way a Field does, inside and outside one',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const colour = (token) => {
          const probe = document.body.appendChild(document.createElement('span'));
          probe.style.color = `var(${token})`;
          const value = getComputedStyle(probe).color;
          probe.remove();
          return value;
        };
        const read = (root) => {
          const input = root.querySelector('textarea');
          const message = root.querySelector('.zx-code-editor__highlight');
          return {
            state: root.dataset.state ?? null,
            invalid: input.getAttribute('aria-invalid'),
            describedBy: input.getAttribute('aria-describedby'),
            messageId: message.id,
            hidden: message.hidden,
            displayed: getComputedStyle(message).display !== 'none',
            role: message.getAttribute('role'),
            text: message.textContent,
            border: getComputedStyle(root).borderBlockStartColor,
            messageColour: getComputedStyle(message).color
          };
        };
        window.invalid = [];
        const editor = new zx.CodeEditor(null, {
          label: 'Settings', language: 'json', value: '{', oninvalid: (event) => window.invalid.push(event.detail.message)
        });
        document.body.append(editor.el);
        const out = { tokens: { danger: colour('--zx-color-danger'), warning: colour('--zx-color-warning'),
          success: colour('--zx-color-success'), border: colour('--zx-color-border-control') } };
        out.initial = read(editor.el);
        editor.setHighlight('Unexpected end of input');
        out.danger = read(editor.el);
        editor.setHighlight('Tabs and spaces are mixed', 'warning');
        out.warning = read(editor.el);
        editor.setHighlight('Valid JSON', 'success');
        out.success = read(editor.el);
        editor.clearHighlight();
        out.cleared = read(editor.el);
        out.sameInput = editor.getInput() === editor.el.querySelector('textarea');

        // Inside a Field the Field's message is the one shown; the editor only follows it.
        const field = new zx.Field(null, { type: 'code', label: 'Payload', description: 'JSON only' });
        document.body.append(field.el);
        const root = field.el.querySelector('.zx-code-editor');
        field.setHighlight('Payload is not valid JSON');
        const fieldMessage = field.el.querySelector('.zx-field__highlight');
        out.field = {
          ...read(root),
          labelFor: field.el.querySelector('label').htmlFor,
          inputId: root.querySelector('textarea').id,
          fieldMessageId: fieldMessage.id,
          fieldMessageColour: getComputedStyle(fieldMessage).color,
          wrapperInvalid: root.hasAttribute('aria-invalid'),
          alerts: [...field.el.querySelectorAll('[role="alert"]')].map((node) => node.textContent)
        };
        field.clearHighlight();
        out.fieldCleared = read(root);
        window.cleanup = () => { editor.destroy(); field.destroy(); };
        return out;
      });
      const { tokens } = result;
      assert.notEqual(tokens.danger, tokens.border);

      assert.deepEqual(
        { state: result.initial.state, invalid: result.initial.invalid, describedBy: result.initial.describedBy,
          displayed: result.initial.displayed, border: result.initial.border },
        { state: null, invalid: null, describedBy: null, displayed: false, border: tokens.border });

      assert.equal(result.danger.state, 'danger');
      assert.equal(result.danger.invalid, 'true');
      assert.equal(result.danger.describedBy, result.danger.messageId);
      assert.equal(result.danger.role, 'alert');
      assert.equal(result.danger.displayed, true);
      assert.equal(result.danger.text, 'Unexpected end of input');
      assert.equal(result.danger.border, tokens.danger, 'the frame takes the danger colour');
      assert.equal(result.danger.messageColour, tokens.danger);

      for (const kind of ['warning', 'success']) {
        assert.equal(result[kind].state, kind);
        assert.equal(result[kind].invalid, null, `${kind} is a status, not an error`);
        assert.equal(result[kind].role, null);
        assert.equal(result[kind].border, tokens.border);
        assert.equal(result[kind].messageColour, tokens[kind]);
      }
      assert.deepEqual(
        { state: result.cleared.state, invalid: result.cleared.invalid, describedBy: result.cleared.describedBy,
          displayed: result.cleared.displayed, text: result.cleared.text, border: result.cleared.border },
        { state: null, invalid: null, describedBy: null, displayed: false, text: '', border: tokens.border });
      assert.equal(result.sameInput, true);
      assert.deepEqual(await page.evaluate(() => window.invalid), ['Unexpected end of input'],
        'invalid fires for danger only');

      // In a Field: one message (the Field's), on the textarea, with the same frame and colour.
      assert.equal(result.field.invalid, 'true');
      assert.equal(result.field.wrapperInvalid, false, 'validity belongs to the textarea, not the frame');
      assert.equal(result.field.labelFor, result.field.inputId, 'the Field label names the textarea');
      assert.ok(result.field.describedBy.split(' ').includes(result.field.fieldMessageId));
      assert.equal(result.field.describedBy.split(' ').includes(result.field.messageId), false);
      assert.equal(result.field.displayed, false, 'the editor does not repeat the Field message');
      assert.deepEqual(result.field.alerts, ['Payload is not valid JSON']);
      assert.equal(result.field.border, tokens.danger, 'the frame follows the Field error');
      assert.equal(result.field.fieldMessageColour, result.danger.messageColour,
        'the message reads in the same colour inside and outside a Field');
      assert.equal(result.fieldCleared.invalid, null);
      assert.equal(result.fieldCleared.border, tokens.border);

      // What assistive technology computes.
      assert.equal(await page.getByRole('textbox', { name: 'Payload' }).count(), 1);
      await page.evaluate(() => window.cleanup());
    }
  },
  {
    name: 'N1 Tab indents and stays in the editor until Escape; indent:\'\' leaves Tab to the browser',
    async run({ page }) {
      await page.evaluate(() => {
        const editor = new zx.CodeEditor(null, { label: 'Source', indent: '  ', value: 'one\ntwo' });
        const plain = new zx.CodeEditor(null, { label: 'Plain', indent: '', value: 'text' });
        const button = (id) => Object.assign(document.createElement('button'), { id, textContent: id });
        document.body.append(button('before'), editor.el, button('between'), plain.el, button('after'));
        window.editors = { editor, plain };
      });
      const focused = () => page.evaluate(() => document.activeElement.id
        || document.activeElement.getAttribute('aria-label'));
      const value = (name) => page.evaluate((key) => window.editors[key].getValue(), name);

      await page.getByRole('textbox', { name: 'Source' }).focus();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Tab');
      assert.equal(await value('editor'), '  one\n  two', 'Tab indents every selected line');
      assert.equal(await focused(), 'Source', 'Tab keeps focus in the editor');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await value('editor'), 'one\ntwo', 'Shift+Tab outdents');
      assert.equal(await focused(), 'Source');

      await page.keyboard.press('Escape');
      await page.keyboard.press('Tab');
      assert.equal(await focused(), 'between', 'Escape then Tab leaves the editor');
      assert.equal(await value('editor'), 'one\ntwo');

      await page.keyboard.press('Shift+Tab');
      assert.equal(await focused(), 'Source');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await focused(), 'before', 'Escape then Shift+Tab leaves it backwards');

      // The release is spent by leaving: back in the editor, Tab indents again.
      await page.getByRole('textbox', { name: 'Source' }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await focused(), 'Source');

      await page.getByRole('textbox', { name: 'Plain' }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await focused(), 'after', 'with indent: \'\' Tab moves focus');
      assert.equal(await value('plain'), 'text');
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await focused(), 'between', 'and Shift+Tab moves it back');
      await page.evaluate(() => Object.values(window.editors).forEach((editor) => editor.destroy()));
    }
  }
];
