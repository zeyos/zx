import assert from 'node:assert/strict';

export const cases = [
  {
    name: 'questionnaire validation is bound to the current answer and flow',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const runs = [];
        for (const mutation of ['answer', 'input', 'items', 'navigate', 'destroy']) {
          let resolve;
          const q = new zx.Questionnaire(null, { items: [
            { name: 'a', prompt: 'A', input: {}, validate: () => new Promise(r => { resolve = r; }) },
            { name: 'b', prompt: 'B', input: {} }
          ] });
          document.body.append(q.el); q.setAnswer('a', 'accepted');
          let submitted = 0; q.on('submit', () => submitted++);
          const pending = q.next();
          const reentered = await q.next();
          if (reentered) throw new Error('Validation reentered while pending');
          if (mutation === 'answer') q.setAnswer('a', 'changed');
          if (mutation === 'input') { const i = q.el.querySelector('.zx-questionnaire__freeform-input'); i.value = 'changed'; i.dispatchEvent(new Event('input', { bubbles: true })); }
          if (mutation === 'items') q.setItems([{ name: 'a', prompt: 'New', input: {} }]);
          if (mutation === 'navigate') q.goTo('b');
          if (mutation === 'destroy') q.destroy();
          resolve(null); const moved = await pending;
          runs.push({ mutation, moved, submitted, active: q.getActive() }); q.destroy();
        }
        let validations = 0, submits = 0;
        const q = new zx.Questionnaire(null, { items: [{ name: 'a', prompt: 'A', input: {}, skippable: true, validate: () => { validations++; return null; } }] });
        q.on('submit', () => submits++); q.setAnswer('a', 'yes'); await q.next();
        const once = { validations, submits }; q.reset(); await q.skip();
        const skipped = { validations, submits }; q.reset(); await q.submit();
        const direct = { validations, submits }; q.destroy();
        return { runs, once, skipped, direct };
      });
      for (const run of result.runs) { assert.equal(run.moved, false, run.mutation); assert.equal(run.submitted, 0); }
      assert.deepEqual(result.once, { validations: 1, submits: 1 });
      assert.deepEqual(result.skipped, { validations: 1, submits: 2 });
      assert.deepEqual(result.direct, { validations: 2, submits: 3 });
    }
  },
  {
    name: 'questionnaire replaces fields and submits all applicable answers',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const target = document.createElement('form'); target.append(document.createTextNode('original')); document.body.append(target);
        const q = new zx.Questionnaire(target, { items: [
          { name: 'a', prompt: 'A', choices: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
          { name: 'b', prompt: 'B', multiple: true, choices: [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }], when: answers => answers.a === 'yes' },
          { name: 'c', prompt: 'C', field: { type: 'text' } }
        ] });
        q.setAnswer('a', 'yes'); await q.next(); q.setAnswer('b', ['one', 'two']); await q.next(); q.setAnswer('c', '5');
        const all = [...new FormData(target)]; const expected = [...q.toFormData()];
        q.setItems([
          { name: 'a', prompt: 'A', choices: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
          { name: 'b', prompt: 'B', multiple: true, choices: [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }], when: answers => answers.a === 'yes' },
          { name: 'c', prompt: 'C', field: { type: 'int' }, required: true }
        ]);
        const type = q.el.querySelector('.zx-field')?.dataset.fieldType; const value = q.getAnswer('c');
        q.setAnswer('a', 'no'); const hidden = [...new FormData(target)]; const hiddenExpected = [...q.toFormData()];
        q.destroy(); return { all, expected, hidden, hiddenExpected, type, value, restored: target.textContent };
      });
      assert.deepEqual(result.all, result.expected); assert.deepEqual(result.all, [['a', 'yes'], ['b', 'one'], ['b', 'two'], ['c', '5']]);
      assert.deepEqual(result.hidden, result.hiddenExpected); assert.equal(result.hidden.some(([k]) => k === 'b'), false);
      assert.equal(result.type, 'int'); assert.equal(result.value, 5); assert.equal(result.restored, 'original');
    }
  },
  {
    name: 'slider commits, localized stepping, and filter normalization',
    async run({ page }) {
      const initial = await page.evaluate(() => {
        window.f = new zx.Field(null, { type: 'slider', value: 10, props: { showInput: true, min: 0, max: 100 } }); document.body.append(f.el);
        window.changes = []; f.on('change', e => changes.push(e.detail.value));
        window.n = new zx.NumberField(null, { group: true, locale: 'en-US', value: 1234 }); document.body.append(n.el);
        const fields = { amount: { type: 'float', min: 0, max: 10, step: 2 }, range: { type: 'int:range', min: 0, max: 10, step: 2 } };
        window.p = new zx.FilterPanel(null, { fields, value: { amount: 99, range: { from: -4, to: 7 } } }); document.body.append(p.el);
        const first = p.getValue(); p.setValue({ amount: -1, range: { from: 3, to: 50 } });
        return { first, second: p.getValue() };
      });
      assert.deepEqual(initial.first, { amount: 10, range: { from: 0, to: 8 } });
      assert.deepEqual(initial.second, { amount: 0, range: { from: 4, to: 10 } });
      const number = page.locator('.zx-slider__number'); await number.fill('25'); await number.press('Tab');
      assert.deepEqual(await page.evaluate(() => changes), [25]);
      await page.evaluate(() => n.stepUp()); assert.equal(await page.evaluate(() => n.get()), 1235);
      await page.evaluate(() => { f.destroy(); n.destroy(); p.destroy(); });
    }
  },
  {
    name: 'select retains typed text and ignores obsolete catalogue responses',
    async run({ page }) {
      await page.evaluate(() => {
        window.s = new zx.Select(null, { items: [{ ID: 'a', name: 'Alpha' }, { ID: 'b', name: 'Beta' }], value: 'a', filter: 'local' }); document.body.append(s.el);
      });
      const input = page.locator('.zx-select__input'); await input.focus(); await input.press('End'); await input.type('xy');
      assert.equal(await input.inputValue(), 'Alphaxy');
      const asyncResult = await page.evaluate(async () => {
        let resolve, started; const pending = new Promise(r => { resolve = r; }); const ready = new Promise(r => { started = r; });
        const s = new zx.Select(null, { items: [{ ID: 'a', name: 'Alpha' }], value: 'a', filter: () => { started(); return pending; }, debounce: 0 }); document.body.append(s.el); s.open();
        await ready; s.setItems([{ ID: 'a', name: 'New Alpha' }, { ID: 'b', name: 'Beta' }]);
        resolve([{ ID: 'stale', name: 'Stale' }]); await pending; await Promise.resolve();
        const result = { text: s.refs.input.value, loading: s.refs.input.getAttribute('aria-busy'), options: [...s.el.querySelectorAll('[role=option]')].map(e => e.textContent.trim()) }; s.destroy(); return result;
      });
      assert.equal(asyncResult.text, 'New Alpha'); assert.equal(asyncResult.loading, 'false'); assert(asyncResult.options.some(s => s.includes('Beta'))); assert(!asyncResult.options.some(s => s.includes('Stale')));
      await page.evaluate(() => s.destroy());
    }
  },
  {
    name: 'locale extension tags and nested date picker Escape',
    async run({ page }) {
      const locales = await page.evaluate(() => zx.LocalePicker.items(['en-US-u-ca-gregory', 'de-AT-x-private']).map(({ ID, name }) => ({ ID, name })));
      assert.deepEqual(locales.map(x => x.ID), ['en-US-u-ca-gregory', 'de-AT-x-private']); assert(locales.every(x => x.name));
      await page.evaluate(() => { window.d = new zx.Datebox(null, { value: new Date(2026, 0, 1) }); document.body.append(d.el); d.open(); d._picker.refs.heading.click(); });
      await page.keyboard.press('Escape');
      assert.deepEqual(await page.evaluate(() => [d.refs.input.getAttribute('aria-expanded'), d._picker.refs.heading.getAttribute('aria-expanded')]), ['true', 'false']);
      await page.keyboard.press('Escape');
      assert.deepEqual(await page.evaluate(() => [d.refs.input.getAttribute('aria-expanded'), document.activeElement === d.refs.input]), ['false', true]);
      await page.evaluate(() => d.destroy());
    }
  }
];

cases.push(
  {
    name: 'final questionnaire validation and skipped item',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        let count = 0, complete = 0;
        const q = new zx.Questionnaire(null, { items: [{ name: 'a', prompt: 'A', input: {}, skippable: true, validate: () => { count++; return null; } }] });
        q.on('complete', () => complete++); q.setAnswer('a', 'yes'); await q.next(); const afterNext = count;
        q.reset(); await q.skip(); const afterSkip = count;
        q.reset(); q.setAnswer('a', 'valid'); const p = q.next(); q.setAnswer('a', 'changed'); const stale = await p;
        q.destroy(); return { afterNext, afterSkip, stale, complete };
      });
      assert.deepEqual(result, { afterNext: 1, afterSkip: 1, stale: false, complete: 2 });
    }
  },
  {
    name: 'replacing a questionnaire field updates its definition',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const q = new zx.Questionnaire(null, { items: [{ name: 'a', prompt: 'A', field: { type: 'text' } }] }); document.body.append(q.el); q.setAnswer('a', '5');
        q.setItems([{ name: 'a', prompt: 'A', required: true, field: { type: 'int' } }]);
        const result = { type: q.el.querySelector('.zx-field').dataset.fieldType, value: q.getAnswer('a') }; q.destroy(); return result;
      });
      assert.deepEqual(result, { type: 'int', value: 5 });
    }
  },
  {
    name: 'slider number field emits a single committed Field change',
    async run({ page }) {
      await page.evaluate(() => { window.f = new zx.Field(null, { type: 'slider', value: 10, props: { showInput: true } }); document.body.append(f.el); window.changes = []; window.inputs = []; f.on('change', e => changes.push(e.detail.value)); f.on('input', e => inputs.push(e.detail.value)); });
      const input = page.locator('.zx-slider__number'); await input.fill('25'); await input.press('Tab');
      assert.deepEqual(await page.evaluate(() => changes), [25]); assert.deepEqual(await page.evaluate(() => inputs), [25]);
      await page.evaluate(() => f.destroy());
    }
  },
  {
    name: 'grouped number stepping respects locale separators',
    async run({ page }) {
      const values = await page.evaluate(() => {
        return ['en-US', 'de-DE'].map(locale => { const n = new zx.NumberField(null, { group: true, locale, value: 1234 }); document.body.append(n.el); n.stepUp(); const value = n.get(); n.destroy(); return value; });
      });
      assert.deepEqual(values, [1235, 1235]);
    }
  },
  {
    name: 'replaced select catalogue survives pending async query',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        let resolve; let started; const startedPromise = new Promise(r => { started = r; });
        const s = new zx.Select(null, { items: [{ ID: 'a', name: 'Alpha' }], value: 'a', debounce: 0, filter: () => { started(); return new Promise(r => { resolve = r; }); } });
        document.body.append(s.el); s.open(); await startedPromise; s.setItems([{ ID: 'a', name: 'New Alpha' }, { ID: 'b', name: 'Beta' }]); resolve([{ ID: 'bad', name: 'Stale' }]); await Promise.resolve(); await Promise.resolve();
        const out = { text: s.refs.input.value, loading: s.refs.input.getAttribute('aria-busy'), labels: [...s.el.querySelectorAll('[role=option]')].map(e => e.textContent.trim()) }; s.destroy(); return out;
      });
      assert.equal(result.text, 'New Alpha'); assert.equal(result.loading, 'false'); assert(result.labels.some(x => x.includes('Beta'))); assert(!result.labels.some(x => x.includes('Stale')));
    }
  },
  {
    name: 'Escape first closes the nested date picker',
    async run({ page }) {
      await page.evaluate(() => { window.d = new zx.Datebox(null, { value: new Date(2026, 0, 1) }); document.body.append(d.el); d.open(); d._picker.refs.heading.click(); });
      await page.keyboard.press('Escape'); assert.deepEqual(await page.evaluate(() => [d.refs.input.getAttribute('aria-expanded'), d._picker.refs.heading.getAttribute('aria-expanded')]), ['true', 'false']);
      await page.keyboard.press('Escape'); assert.deepEqual(await page.evaluate(() => [d.refs.input.getAttribute('aria-expanded'), document.activeElement === d.refs.input]), ['false', true]);
      await page.evaluate(() => d.destroy());
    }
  }
);

cases.push({
  name: 'skipping never submits an answer changed by a skip listener or branch callback',
  async run({ page }) {
    const result = await page.evaluate(async () => {
      const cases = [];
      for (const mutation of ['answer', 'items', 'navigate', 'destroy', 'branch', 'none']) {
        let q, armed = false, validated = 0, submits = 0, completions = 0;
        const items = [
          { name: 'a', prompt: 'A', input: {}, skippable: true,
            validate: () => { validated++; return 'Rejected'; },
            next: () => {
              if (mutation === 'branch' && armed) { armed = false; q.setAnswer('a', 'unchecked'); }
              return mutation === 'navigate' ? 'b' : '$submit';
            } },
          { name: 'b', prompt: 'B', input: {} }
        ];
        q = new zx.Questionnaire(null, { items }); document.body.append(q.el);
        q.on('skip', () => {
          if (mutation === 'answer') q.setAnswer('a', 'unchecked');
          if (mutation === 'items') q.setItems([{ name: 'a', prompt: 'Replacement', input: {} }]);
          if (mutation === 'navigate') q.goTo('b');
          if (mutation === 'destroy') q.destroy();
          if (mutation === 'branch') armed = true;
        });
        q.on('submit', () => submits++); q.on('complete', () => completions++);
        const advanced = await q.skip();
        cases.push({ mutation, advanced, validated, submits, completions }); q.destroy();
      }
      return cases;
    });
    for (const row of result) {
      const ordinary = row.mutation === 'none';
      assert.deepEqual(row, { mutation: row.mutation, advanced: ordinary, validated: 0,
        submits: ordinary ? 1 : 0, completions: ordinary ? 1 : 0 });
    }
  }
});
