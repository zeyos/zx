import assert from 'node:assert/strict';

/*
 * Input components and the Field/Form plumbing around them: labelling inside a Field, values set
 * before their items exist, keyboard and IME handling in the comboboxes, one change per edit in
 * the Filter, disabled fields in a Form, and the value list's single tab stop.
 */

/** Wait for queued renders, microtasks, and the next frames. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

const ITEMS = [{ ID: 1, name: 'Alpha' }, { ID: 2, name: 'Beta' }, { ID: 3, name: 'Gamma' }];

export const cases = [
  {
    name: 'a Field names the input inside a composite control and marks it invalid',
    async run({ page }) {
      await page.evaluate(() => {
        window.form = new zx.Form(null, { fieldsets: [{ fields: {
          amount: { type: 'number', label: 'Amount', description: 'Net amount', required: true },
          owner: {
            type: 'zxselect', label: 'Owner', description: 'Who owns it', required: true,
            props: { items: [{ ID: 1, name: 'Ada' }, { ID: 2, name: 'Lin' }], placeholder: 'Pick one' }
          },
          tags: { type: 'tagpicker', label: 'Tags', description: 'Labels', required: true, props: { items: [{ ID: 'a', name: 'Alpha' }] } },
          share: { type: 'slider', label: 'Share', description: 'Percent' },
          score: { type: 'rating', label: 'Score', description: 'Stars', required: true },
          spent: { type: 'time', label: 'Spent', description: 'Hours and minutes' }
        } }] });
        document.body.append(window.form.el);
      });
      // The accessible name is the field's label, not the control's built-in one.
      const named = {
        amount: page.getByRole('spinbutton', { name: 'Amount', exact: true }),
        owner: page.getByRole('combobox', { name: 'Owner', exact: true }),
        tags: page.getByRole('combobox', { name: 'Tags', exact: true }),
        share: page.getByRole('slider', { name: 'Share', exact: true }),
        score: page.getByRole('radiogroup', { name: 'Score', exact: true }),
        spent: page.getByRole('group', { name: 'Spent', exact: true })
      };
      for (const [key, locator] of Object.entries(named)) {
        assert.equal(await locator.count(), 1, `${key} is not named by its field label`);
      }

      // The description belongs to that element too, and after a failed submit so does validity.
      const state = () => page.evaluate(() => {
        const selectors = {
          amount: '[role=spinbutton]', owner: '[role=combobox]', tags: '[role=combobox]',
          share: 'input[type=range]', score: '[role=radiogroup]', spent: '[role=group]'
        };
        return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
          const target = document.querySelector(`[data-field-id="${key}"] .zx-field__control ${selector}`);
          const described = (target?.getAttribute('aria-describedby') ?? '').split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '').join('|');
          return [key, { described, invalid: target?.getAttribute('aria-invalid') ?? null }];
        }));
      });
      let result = await state();
      assert.equal(result.amount.described, 'Net amount');
      assert.equal(result.owner.described, 'Who owns it');
      assert.equal(result.tags.described, 'Labels');
      assert.equal(result.share.described, 'Percent');
      assert.equal(result.score.described, 'Stars');
      assert.equal(result.spent.described, 'Hours and minutes');

      assert.equal(await page.evaluate(() => window.form.submit()), false);
      result = await state();
      for (const key of ['amount', 'owner', 'tags', 'score']) {
        assert.equal(result[key].invalid, 'true', `${key}: aria-invalid is not on the named element`);
        assert.match(result[key].described, /required/, `${key}: the error message does not describe it`);
      }

      // A click on the label reaches the control; the Select's list stays closed.
      const focused = () => page.evaluate(() => document.activeElement?.closest('[data-field-id]')?.dataset.fieldId
        + ':' + (document.activeElement?.getAttribute('role') ?? document.activeElement?.type));
      await page.locator('[data-field-id=amount] .zx-field__label').click();
      assert.equal(await focused(), 'amount:spinbutton');
      await page.locator('[data-field-id=tags] .zx-field__label').click();
      assert.equal(await focused(), 'tags:combobox');
      await page.locator('[data-field-id=owner] .zx-field__label').click();
      assert.equal(await focused(), 'owner:combobox');
      assert.equal(await named.owner.getAttribute('aria-expanded'), 'false');
      await page.locator('[data-field-id=share] .zx-field__label').click();
      assert.equal(await focused(), 'share:range');
      // Groups take no <label for>: the click is turned into the field's own focus.
      await page.locator('[data-field-id=score] .zx-field__label').click();
      assert.match(await focused(), /^score:/, 'a click on the rating label did not focus it');
      await page.locator('[data-field-id=spent] .zx-field__label').click();
      assert.match(await focused(), /^spent:/, 'a click on the duration label did not focus it');
      await page.evaluate(() => window.form.destroy());
    }
  },
  {
    name: 'a checklist value set before its items load is checked once they arrive',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const items = [{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }, { ID: 3, name: 'Three' }];
        const field = new zx.Field(null, {
          type: 'checklist', label: 'Roles', value: [1, 3],
          props: { load: () => new Promise((done) => setTimeout(() => done(items), 30)) }
        });
        document.body.append(field.el);
        const before = field.getValue();
        await new Promise((done) => setTimeout(done, 120));
        const after = field.getValue();
        const checked = [...field.el.querySelectorAll('input[type=checkbox]')]
          .filter((input) => input.checked).map((input) => input.closest('label').textContent);
        field.destroy();

        // Requested IDs decide over checkedKey while they wait; a later reload derives as before.
        const list = new zx.Checklist(null, { items: [] });
        list.setValues(['b']);
        const waiting = list.getValues();
        list.setItems([{ ID: 'a', name: 'A', on: true }, { ID: 'b', name: 'B' }]);
        const applied = list.getValues();
        list.setItems([{ ID: 'a', name: 'A', on: true }, { ID: 'b', name: 'B' }]);
        const derived = list.getValues();
        list.uncheckAll();
        const cleared = list.getValues();
        const api = [typeof list.disable, typeof list.enable, typeof list.isDisabled];
        list.disable();
        const disabled = list.isDisabled();
        list.destroy();

        // An empty value set before the items exist clears them too, over their own flags.
        const empty = new zx.Checklist(null, { items: [] });
        empty.setValues([]);
        empty.setItems([{ ID: 1, name: 'One', on: true }]);
        const emptied = empty.getValues();
        empty.destroy();
        return { before, after, checked, waiting, applied, derived, cleared, api, disabled, emptied };
      });
      assert.deepEqual(result.before, [1, 3], 'the value is kept while the items load');
      assert.deepEqual(result.after, [1, 3]);
      assert.deepEqual(result.checked, ['One', 'Three']);
      assert.deepEqual(result.emptied, [], 'an empty early value stands for the items still to come');
      assert.deepEqual(result.waiting, ['b']);
      assert.deepEqual(result.applied, ['b']);
      assert.deepEqual(result.derived, ['a']);
      assert.deepEqual(result.cleared, []);
      assert.deepEqual(result.api, ['function', 'function', 'function']);
      assert.equal(result.disabled, true);
    }
  },
  {
    name: 'Select adopts a whole item it does not list, and presets reset to their initial value',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const select = new zx.Select(null, { filter: async () => [], placeholder: 'Account' });
        document.body.append(select.el);
        select.set({ ID: 5, name: 'Acme' }, { silent: true });
        const adopted = [select.value, select.refs.input.value, select.selected?.name];
        select.set(7);
        const unknownId = select.value;
        select.destroy();

        const priority = zx.Select.priority(null, { value: 3 });
        priority.set(0); priority.reset({ silent: true });
        const status = zx.Select.status(null, { value: 'done' });
        status.set('todo'); status.reset({ silent: true });
        const permission = zx.Select.permission(null, { value: 9, groups: [{ ID: 9, name: 'Sales' }] });
        permission.set(true); permission.reset({ silent: true });
        const privateByDefault = zx.Select.permission(null, { value: false });
        privateByDefault.set(true); privateByDefault.reset({ silent: true });
        const resets = [priority.value, status.value, permission.value, privateByDefault.value];
        for (const preset of [priority, status, permission, privateByDefault]) preset.destroy();
        return { adopted, unknownId, resets };
      });
      assert.deepEqual(result.adopted, [5, 'Acme', 'Acme']);
      assert.equal(result.unknownId, null, 'a bare unknown ID still selects nothing');
      assert.deepEqual(result.resets, [3, 'done', 9, false]);
    }
  },
  {
    name: 'Select leaves Home and End to an editable input that holds text',
    async run({ page }) {
      await page.evaluate((items) => {
        window.editable = new zx.Select(null, { filter: 'local', items, label: 'Editable' });
        window.fixed = new zx.Select(null, { items, label: 'Fixed' });
        document.body.append(window.editable.el, window.fixed.el);
      }, ITEMS);
      const editable = page.getByRole('combobox', { name: 'Editable', exact: true });
      await editable.click();
      await page.keyboard.type('al');
      const active = await editable.getAttribute('aria-activedescendant');
      await page.keyboard.press('Home');
      assert.equal(await editable.evaluate((input) => input.selectionStart), 0, 'Home moves the caret');
      await page.keyboard.press('End');
      assert.equal(await editable.evaluate((input) => input.selectionStart), 2, 'End moves the caret');
      assert.equal(await editable.getAttribute('aria-activedescendant'), active);
      // Picked, and opened again without typing, the input just shows the selection.
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('End');
      assert.equal(await page.evaluate(() => window.editable.refs.list.querySelector('[data-active]')?.textContent), 'Gamma');
      await page.keyboard.press('Escape');

      const fixed = page.getByRole('combobox', { name: 'Fixed', exact: true });
      await fixed.focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('End');
      const last = await page.evaluate(() => window.fixed.refs.list.querySelector('[data-active]')?.textContent);
      assert.equal(last, 'Gamma', 'a read-only Select keeps Home and End for its options');
      await page.evaluate(() => { window.editable.destroy(); window.fixed.destroy(); });
    }
  },
  {
    name: 'Select keeps the typed query when its items are replaced while open',
    async run({ page }) {
      await page.evaluate((items) => {
        window.select = new zx.Select(null, {
          filter: 'local', items, label: 'Name', fixedItems: [{ ID: 'b0', name: 'Bravo' }, { ID: 'z0', name: 'Zulu' }]
        });
        document.body.append(window.select.el);
      }, ITEMS);
      const input = page.getByRole('combobox', { name: 'Name', exact: true });
      await input.click();
      await page.keyboard.type('b');
      const options = () => page.evaluate(() => [...window.select.refs.list.querySelectorAll('[role=option]')]
        .map((option) => option.textContent));
      assert.deepEqual(await options(), ['Bravo', 'Beta']);
      await page.evaluate((items) => window.select.setItems([...items, { ID: 4, name: 'Bert' }]), ITEMS);
      assert.deepEqual(await options(), ['Bravo', 'Beta', 'Bert']);
      assert.equal(await input.inputValue(), 'b');
      await page.evaluate(() => window.select.setFixedItems([{ ID: 'z0', name: 'Zulu' }]));
      assert.deepEqual(await options(), ['Beta', 'Bert']);
      assert.equal(await input.inputValue(), 'b');
      await page.keyboard.press('Escape');
      // Closed, a replacement shows everything again.
      await page.evaluate((items) => window.select.setItems(items), ITEMS);
      await input.click();
      assert.deepEqual(await options(), ['Zulu', 'Alpha', 'Beta', 'Gamma']);
      await page.evaluate(() => window.select.destroy());
    }
  },
  {
    name: 'Enter that confirms an IME composition does not pick an option',
    async run({ page }) {
      const result = await page.evaluate(async (items) => {
        const select = new zx.Select(null, { filter: 'local', items, label: 'Name' });
        const picker = new zx.TagPicker(null, { items, placeholder: 'Tags' });
        document.body.append(select.el, picker.el);
        const composingEnter = () => new KeyboardEvent('keydown', {
          key: 'Enter', isComposing: true, bubbles: true, cancelable: true
        });
        select.focus(); select.open();
        select.refs.input.dispatchEvent(composingEnter());
        const selectState = { value: select.value, open: select.el.dataset.state };
        picker.focus(); picker.open();
        picker.refs.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        picker.refs.input.dispatchEvent(composingEnter());
        const pickerValues = picker.getValues();
        // Outside a composition Enter still commits.
        picker.refs.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        const committed = picker.getValues().length;
        select.destroy(); picker.destroy();
        return { selectState, pickerValues, committed };
      }, ITEMS);
      assert.deepEqual(result.selectState, { value: null, open: 'open' });
      assert.deepEqual(result.pickerValues, []);
      assert.equal(result.committed, 1);
    }
  },
  {
    name: 'one edit in a Filter value control reports one change',
    async run({ page }) {
      await page.evaluate(() => {
        window.filter = new zx.Filter(null, {
          autoApply: true,
          fields: [
            { id: 'status', label: 'Status', type: 'status', choices: [{ value: 'open', label: 'Open' }, { value: 'paid', label: 'Paid' }] },
            { id: 'name', label: 'Name', type: 'text' }
          ],
          value: { version: 1, root: { kind: 'group', id: 'root', logic: 'and', children: [
            { kind: 'condition', id: 'c1', field: 'status', operator: 'eq', value: 'open' },
            { kind: 'condition', id: 'c2', field: 'name', operator: 'contains', value: 'x' }
          ] } }
        });
        window.changes = 0;
        window.applies = 0;
        window.filter.on('change', () => { window.changes += 1; });
        window.filter.on('apply', () => { window.applies += 1; });
        document.body.append(window.filter.el);
      });
      const counts = () => page.evaluate(() => [window.changes, window.applies]);
      await page.selectOption('[data-node-id=c1] select[data-filter-value]', 'paid');
      assert.deepEqual(await counts(), [1, 1], 'a pick in a value select');
      const text = page.locator('[data-node-id=c2] input[data-filter-value]');
      await text.click();
      await page.keyboard.press('End');
      await page.keyboard.type('yz');
      assert.deepEqual(await counts(), [3, 3], 'one per keystroke');
      await text.evaluate((input) => input.blur());
      assert.deepEqual(await counts(), [3, 3], 'none for the blur that commits the same text');
      assert.equal(await page.evaluate(() => window.filter.getValue().root.children[1].value), 'xyz');
      await page.evaluate(() => window.filter.destroy());
    }
  },
  {
    name: 'Form skips the fields of a disabled fieldset',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const form = new zx.Form(null, { fieldsets: [{ fields: { name: { label: 'Name', required: true } } }] });
        document.body.append(form.el);
        form.el.querySelector('fieldset').disabled = true;
        const disabled = form.submit();
        const state = form.getField('name').el.dataset.state ?? null;
        form.el.querySelector('fieldset').disabled = false;
        const enabled = form.submit();
        form.destroy();
        return { disabled, state, enabled };
      });
      assert.deepEqual(result, { disabled: true, state: null, enabled: false });
    }
  },
  {
    name: 'a value list is one tab stop, keeping its arrow, reorder, and delete keys',
    async run({ page }) {
      await page.evaluate(() => {
        window.list = new zx.ValueList(null, { values: ['a', 'b', 'c'] });
        document.body.append(window.list.el);
      });
      const stops = () => page.evaluate(() => [...window.list.el.querySelectorAll('[role=option]')]
        .map((chip) => chip.tabIndex));
      const focused = () => page.evaluate(() => document.activeElement?.classList.contains('zx-value-list__chip')
        ? document.activeElement.querySelector('.zx-value-list__value').textContent
        : document.activeElement?.className);
      assert.deepEqual(await stops(), [0, -1, -1]);
      await page.locator('.zx-value-list__chip').first().focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await focused(), 'b');
      await settle(page);
      assert.deepEqual(await stops(), [-1, 0, -1]);
      await page.keyboard.press('Tab');
      assert.equal(await focused(), 'zx-value-list__input', 'Tab leaves the list');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await focused(), 'b', 'and comes back to the chip it left');
      await page.keyboard.press('ArrowDown');
      assert.equal(await focused(), 'c');
      await page.keyboard.press('ArrowRight');
      assert.equal(await focused(), 'c', 'no wrap past the end');
      await page.keyboard.press('Home');
      assert.equal(await focused(), 'a');
      await page.keyboard.press('Control+ArrowRight');
      assert.deepEqual(await page.evaluate(() => window.list.getValues()), ['b', 'a', 'c']);
      assert.equal(await focused(), 'a');
      await settle(page);
      assert.deepEqual(await stops(), [-1, 0, -1]);
      await page.keyboard.press('Delete');
      assert.deepEqual(await page.evaluate(() => window.list.getValues()), ['b', 'c']);
      await settle(page);
      assert.equal((await stops()).filter((stop) => stop === 0).length, 1);
      await page.evaluate(() => window.list.disable());
      await settle(page);
      assert.deepEqual(await stops(), [-1, -1]);
      await page.evaluate(() => window.list.enable());
      await settle(page);
      assert.equal((await stops()).filter((stop) => stop === 0).length, 1);
      await page.evaluate(() => window.list.destroy());
    }
  },
  {
    name: 'the code editor position is a quiet readout, and the editor handle honours reduced motion',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const editor = new zx.CodeEditor(null, { value: 'one\ntwo' });
        const values = new zx.MultiValueEditor(null, { values: ['a', 'b'] });
        document.body.append(editor.el, values.el);
        const position = editor.el.querySelector('.zx-code-editor__position');
        const handle = values.el.querySelector('.zx-multi-value-editor__handle');
        const out = {
          role: position.getAttribute('role'),
          live: position.getAttribute('aria-live'),
          text: position.textContent,
          visible: position.getBoundingClientRect().width > 0,
          transition: handle ? getComputedStyle(handle).transitionDuration : 'no handle'
        };
        editor.destroy(); values.destroy();
        return out;
      });
      assert.equal(result.role, null);
      assert.notEqual(result.live, 'polite');
      assert.notEqual(result.live, 'assertive');
      assert.ok(result.text.length > 0);
      assert.equal(result.visible, true);
      assert.equal(result.transition, '0s');
    }
  }
];
