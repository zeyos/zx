import assert from 'node:assert/strict';

/*
 * Sibling inputs answer to the same small API: Timebox focus(), CodeEditor `readonly` and
 * setReadonly(), the MultiValueEditor and FieldUpload disabled methods, silent Checklist setters,
 * and the AbortSignal an async Select or TagPicker filter receives.
 */

const ITEMS = [{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }, { ID: 3, name: 'Three' }];

export const cases = [
  {
    name: 'Timebox.focus() focuses the hours segment with its digits selected',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const timebox = new zx.Timebox(null, { value: 135, signed: true, seconds: true });
        document.body.append(timebox.el);
        const chained = timebox.focus() === timebox;
        const active = /** @type {HTMLInputElement} */ (document.activeElement);
        const focused = active?.dataset.segment ?? null;
        const selected = [active.selectionStart, active.selectionEnd, active.value.length];
        active.blur();
        timebox.disable();
        timebox.focus();
        const whileDisabled = document.activeElement?.dataset?.segment ?? null;
        timebox.enable().focus();
        const again = document.activeElement?.dataset?.segment ?? null;
        timebox.destroy();
        timebox.el.remove();
        return { chained, focused, selected, whileDisabled, again };
      });
      assert.equal(result.chained, true, 'focus() returns the timebox');
      assert.equal(result.focused, 'hours', 'the hours segment takes focus, not the sign toggle');
      assert.deepEqual(result.selected, [0, 1, 1], 'focusing selects the segment, as a click does');
      assert.equal(result.whileDisabled, null, 'a disabled timebox does not take focus');
      assert.equal(result.again, 'hours');
    }
  },
  {
    name: 'CodeEditor takes readonly and setReadonly() beside readOnly and setReadOnly()',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const state = (editor) => [editor.getInput().readOnly, editor.el.dataset.readonly];
        const make = (options) => {
          const editor = new zx.CodeEditor(null, options);
          const read = state(editor);
          editor.destroy();
          return read;
        };
        const options = {
          none: make({}),
          readonly: make({ readonly: true }),
          readOnly: make({ readOnly: true }),
          either: make({ readOnly: false, readonly: true }),
          other: make({ readOnly: true, readonly: false })
        };
        const editor = new zx.CodeEditor(null, { value: 'select 1' });
        document.body.append(editor.el);
        const chained = editor.setReadonly(true) === editor;
        const locked = state(editor);
        editor.setReadonly(false);
        const unlocked = state(editor);
        editor.setReadonly(true);
        editor.destroy();
        editor.el.remove();

        // The `code` field type: the Field's readonly option and setReadonly(), and props.readonly.
        const field = new zx.Field(null, { type: 'code', label: 'Query', readonly: true, value: 'a' });
        document.body.append(field.el);
        const textarea = /** @type {HTMLTextAreaElement} */ (field.el.querySelector('textarea'));
        const fieldLocked = textarea.readOnly;
        field.setReadonly(false);
        const fieldUnlocked = textarea.readOnly;
        field.destroy();
        field.el.remove();
        const viaProps = new zx.Field(null, { type: 'code', label: 'Query', props: { readonly: true } });
        const propsLocked = viaProps.el.querySelector('textarea').readOnly;
        viaProps.destroy();
        return { options, chained, locked, unlocked, fieldLocked, fieldUnlocked, propsLocked };
      });
      assert.deepEqual(result.options.none, [false, 'false']);
      assert.deepEqual(result.options.readonly, [true, 'true'], 'readonly is accepted');
      assert.deepEqual(result.options.readOnly, [true, 'true'], 'readOnly keeps working');
      assert.deepEqual(result.options.either, [true, 'true'], 'either spelling turns read-only on');
      assert.deepEqual(result.options.other, [true, 'true']);
      assert.equal(result.chained, true);
      assert.deepEqual(result.locked, [true, 'true']);
      assert.deepEqual(result.unlocked, [false, 'false']);
      assert.equal(result.fieldLocked, true);
      assert.equal(result.fieldUnlocked, false);
      assert.equal(result.propsLocked, true);

      // A read-only editor keeps its text against typing.
      await page.evaluate(() => {
        window.editor = new zx.CodeEditor(null, { value: 'fixed', readonly: true, label: 'Locked' });
        document.body.append(window.editor.el);
      });
      await page.getByRole('textbox', { name: 'Locked' }).focus();
      await page.keyboard.type('xyz');
      assert.equal(await page.evaluate(() => window.editor.getValue()), 'fixed');
      await page.evaluate(() => window.editor.destroy());
    }
  },
  {
    name: 'MultiValueEditor disables every control, keeps rows it renders disabled, and refuses to reorder',
    async run({ page }) {
      await page.evaluate(() => {
        window.changes = [];
        window.editor = new zx.MultiValueEditor(null, {
          values: ['a', 'b'], disabled: true, onchange: ({ detail }) => window.changes.push(detail.values)
        });
        document.body.append(window.editor.el);
      });
      const controls = () => page.evaluate(() => {
        const all = [...window.editor.el.querySelectorAll('input, select, button')];
        return {
          count: all.length,
          disabled: all.filter((control) => control.disabled).length,
          aria: window.editor.el.getAttribute('aria-disabled'),
          state: window.editor.isDisabled()
        };
      });
      let state = await controls();
      assert.ok(state.count > 2);
      assert.equal(state.disabled, state.count, 'the disabled option disables values, handles, buttons and add');
      assert.equal(state.aria, 'true');
      assert.equal(state.state, true);

      await page.evaluate(() => window.editor.setValues(['x', 'y', 'z'], { silent: true }));
      state = await controls();
      assert.equal(state.disabled, state.count, 'rows rendered while disabled are disabled');

      // Nothing reorders, adds or removes while disabled — not the handle's keys, not the buttons.
      const refused = await page.evaluate(() => {
        const handle = window.editor.el.querySelector('.zx-multi-value-editor__handle');
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        for (const action of ['down', 'remove', 'add']) {
          window.editor.el.querySelector(`[data-action="${action}"]`)
            .dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        return window.editor.getValues();
      });
      assert.deepEqual(refused, ['x', 'y', 'z']);

      assert.equal(await page.evaluate(() => window.editor.enable() === window.editor), true);
      state = await controls();
      assert.equal(state.disabled, 0);
      assert.equal(state.aria, null);
      assert.equal(state.state, false);

      // Enabled, the handle reorders from the keyboard again.
      await page.locator('.zx-multi-value-editor__handle').first().focus();
      await page.keyboard.press('ArrowDown');
      assert.deepEqual(await page.evaluate(() => window.editor.getValues()), ['y', 'x', 'z']);

      // A value typed and not yet committed survives being disabled and enabled again.
      const input = page.locator('.zx-multi-value-editor__value').first();
      await input.fill('typed');
      await page.evaluate(() => window.editor.setDisabled(true));
      assert.equal(await input.inputValue(), 'typed');
      await page.evaluate(() => window.editor.setDisabled(false));
      assert.equal(await input.inputValue(), 'typed');

      // An enhanced target is left as found.
      const restored = await page.evaluate(() => {
        window.editor.destroy();
        const target = document.createElement('div');
        document.body.append(target);
        const editor = new zx.MultiValueEditor(target, { values: ['a'], disabled: true });
        const during = target.getAttribute('aria-disabled');
        editor.destroy();
        return { during, after: target.getAttribute('aria-disabled'), children: target.childElementCount };
      });
      assert.deepEqual(restored, { during: 'true', after: null, children: 0 });
    }
  },
  {
    name: 'the multivalueeditor field type disables through the editor',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const field = new zx.Field(null, { type: 'multivalueeditor', label: 'Emails', value: ['a'], disabled: true });
        document.body.append(field.el);
        const editor = zx.Component.from(field.el.querySelector('.zx-multi-value-editor'));
        const disabledCount = () => [...field.el.querySelectorAll('.zx-multi-value-editor input, .zx-multi-value-editor button')]
          .filter((control) => !control.disabled).length;
        const start = { enabled: disabledCount(), state: editor.isDisabled() };
        field.setValue(['b', 'c'], { silent: true });
        const afterSet = disabledCount();
        field.setDisabled(false);
        const enabled = { enabled: disabledCount() > 0, state: editor.isDisabled() };
        field.focus();
        // Enabled again, the field's focus() reaches a control inside the editor.
        const focused = Boolean(document.activeElement?.closest('.zx-multi-value-editor'));
        const value = field.getValue();
        field.destroy();
        field.el.remove();
        return { start, afterSet, enabled, focused, value };
      });
      assert.deepEqual(result.start, { enabled: 0, state: true });
      assert.equal(result.afterSet, 0, 'a value set on a disabled field renders disabled rows');
      assert.deepEqual(result.enabled, { enabled: true, state: false });
      assert.equal(result.focused, true);
      assert.deepEqual(result.value, ['b', 'c']);
    }
  },
  {
    name: 'FieldUpload has disable(), enable() and isDisabled()',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const upload = new zx.FieldUpload(null, {});
        document.body.append(upload.el);
        const zone = upload.el.querySelector('.zx-field-upload__dropzone');
        const start = upload.isDisabled();
        const chained = upload.disable() === upload;
        const off = [upload.isDisabled(), zone.disabled, upload.el.dataset.disabled];
        upload.enable();
        const on = [upload.isDisabled(), zone.disabled, upload.el.dataset.disabled];
        upload.destroy();
        return { start, chained, off, on };
      });
      assert.equal(result.start, false);
      assert.equal(result.chained, true);
      assert.deepEqual(result.off, [true, true, 'true']);
      assert.deepEqual(result.on, [false, false, 'false']);
    }
  },
  {
    name: 'Checklist setters take silent, and the checklist field type writes without an inner change',
    async run({ page }) {
      const result = await page.evaluate((items) => {
        const list = new zx.Checklist(null, { items });
        document.body.append(list.el);
        const heard = [];
        list.on('change', ({ detail }) => heard.push(detail.values));
        list.setValues([2], { silent: true });
        list.checkAll({ silent: true });
        list.uncheckAll({ silent: true });
        list.setValues([1, 3], { silent: true });
        const shown = [...list.el.querySelectorAll('input[type=checkbox]')].map((box) => box.checked);
        const quiet = heard.length;
        list.checkAll();
        list.destroy();
        list.el.remove();

        // Field#setValue() reports the field's change once; nothing from inside the field bubbles.
        const wrapper = document.createElement('div');
        document.body.append(wrapper);
        const bubbled = [];
        wrapper.addEventListener('zx-change', (event) => bubbled.push(event.target.className.split(' ')[0]));
        const field = new zx.Field(null, { type: 'checklist', label: 'Roles', props: { items } });
        wrapper.append(field.el);
        const fieldChanges = [];
        field.on('change', ({ detail }) => fieldChanges.push(detail.value));
        field.setValue([1, 3]);
        field.setValue([2], { silent: true });
        field.setValue('', { silent: true });
        const cleared = field.getValue();
        field.setValue([3], { silent: true });
        const written = bubbled.slice();
        field.el.querySelectorAll('input[type=checkbox]')[0].click();
        const edited = field.getValue();
        field.destroy();
        wrapper.remove();
        return { shown, quiet, loud: heard, written, fieldChanges, cleared, edited };
      }, ITEMS);
      assert.deepEqual(result.shown, [true, false, true], 'silent setters still update the boxes');
      assert.equal(result.quiet, 0, 'silent setters emit nothing');
      assert.deepEqual(result.loud, [[1, 2, 3]], 'without silent, change is emitted as before');
      assert.deepEqual(result.fieldChanges, [[1, 3], [1, 3]], 'one change per setValue(), one per click');
      assert.deepEqual(result.written, ['zx-field'], 'only the field announces a value set from code');
      assert.deepEqual(result.cleared, [], 'a non-array value clears the checklist');
      assert.deepEqual(result.edited, [1, 3]);
    }
  },
  {
    name: 'an async Select filter receives a signal that closing, a newer query and destroy abort',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const calls = [];
        const select = new zx.Select(null, {
          label: 'Remote', debounce: 0,
          filter: (query, context) => {
            calls.push({ query, signal: context.signal });
            return new Promise((resolve) => setTimeout(() => resolve([{ ID: 1, name: `Match ${query}` }]), 60));
          }
        });
        document.body.append(select.el);
        const aborted = () => calls.map((call) => call.signal.aborted);

        select.open();
        await wait(10);
        const opened = aborted();
        select.close();
        const closed = aborted();

        select.open();
        await wait(10);
        const input = /** @type {HTMLInputElement} */ (select.el.querySelector('input'));
        input.value = 'ab';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const typed = aborted();
        await wait(120);
        const settled = aborted();
        const options = [...document.querySelectorAll('[role=option]')].map((option) => option.textContent);

        input.value = 'abc';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(10);
        select.destroy();
        const destroyed = aborted();
        select.el.remove();
        return { queries: calls.map((call) => call.query), opened, closed, typed, settled, options, destroyed };
      });
      assert.deepEqual(result.queries, ['', '', 'ab', 'abc']);
      assert.deepEqual(result.opened, [false]);
      assert.deepEqual(result.closed, [true], 'closing aborts the request in flight');
      assert.deepEqual(result.typed, [true, true], 'a newer query aborts the one before it');
      assert.deepEqual(result.settled, [true, true, false], 'a request that settles is not aborted');
      assert.ok(result.options.some((text) => text.includes('Match ab')), 'the current answer is shown');
      assert.deepEqual(result.destroyed, [true, true, false, true], 'destroying aborts the request in flight');
    }
  },
  {
    name: 'an async TagPicker filter receives a signal that closing, setItems and destroy abort',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const calls = [];
        const errors = [];
        const picker = new zx.TagPicker(null, {
          debounce: 0,
          filter: (query, context) => {
            calls.push({ query, signal: context.signal });
            return new Promise((resolve, reject) => {
              const timer = setTimeout(() => resolve([{ ID: 'm', name: `Match ${query}` }]), 60);
              context.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              }, { once: true });
            });
          },
          onerror: ({ detail }) => errors.push(detail.error.message)
        });
        document.body.append(picker.el);
        const aborted = () => calls.map((call) => call.signal.aborted);

        picker.open();
        await wait(10);
        picker.close();
        const closed = aborted();
        picker.open();
        await wait(10);
        picker.setItems([]);
        const replaced = aborted();
        picker.close();
        picker.open();
        await wait(120);
        const settled = aborted();
        picker.close();
        picker.open();
        await wait(10);
        picker.destroy();
        const destroyed = aborted();
        await wait(10);
        picker.el.remove();
        return { count: calls.length, closed, replaced, settled, destroyed, errors };
      });
      assert.equal(result.count, 4);
      assert.deepEqual(result.closed, [true], 'closing aborts the request in flight');
      assert.deepEqual(result.replaced, [true, true], 'replacing the catalogue aborts it');
      assert.deepEqual(result.settled, [true, true, false]);
      assert.deepEqual(result.destroyed, [true, true, false, true], 'destroying aborts it');
      assert.deepEqual(result.errors, [], 'an aborted request is not reported as an error');
    }
  },
  {
    name: 'Timebox reports one change per edit, and none for a commit that changed nothing',
    async run({ page }) {
      await page.evaluate(() => {
        window.timebox = new zx.Timebox(null, { value: 90 });
        window.changes = [];
        window.timebox.on('change', (event) => window.changes.push(event.detail.value));
        document.body.append(window.timebox.el);
      });
      const hours = page.locator('.zx-timebox [data-segment="hours"]');
      await hours.click();
      await page.keyboard.press('Enter');
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      assert.deepEqual(await page.evaluate(() => window.changes), [], 'Enter and blur without an edit reported a change');
      await hours.fill('3');
      await page.keyboard.press('Enter');
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      assert.deepEqual(await page.evaluate(() => window.changes), [210], 'one edit committed by Enter and then blur');
      await page.evaluate(() => { window.timebox.destroy(); window.timebox.el.remove(); });
    }
  },
  {
    name: 'a click on a multivalueeditor field label focuses its first value, not the drag handle',
    async run({ page }) {
      await page.evaluate(() => {
        window.field = new zx.Field(null, { type: 'multivalueeditor', label: 'Emails', value: ['a@example.com', 'b@example.com'] });
        document.body.append(window.field.el);
      });
      await page.locator('.zx-field__label').click();
      const focused = await page.evaluate(() => document.activeElement?.className ?? '');
      assert.match(focused, /zx-multi-value-editor__value/);
      await page.evaluate(() => { window.field.destroy(); window.field.el.remove(); });
    }
  }
];
