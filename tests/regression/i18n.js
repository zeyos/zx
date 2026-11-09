import assert from 'node:assert/strict';

export const cases = [
  {
    name: 'rendered count labels select singular and plural while retaining old overrides',
    async run({ page }) {
      for (const locale of ['en', 'de']) {
        const result = await page.evaluate(async (locale) => {
          const { locales } = await import('/src/locales/index.js');
          zx.setLanguage(locale);
          zx.setTranslator((key) => locales[locale][key]);
          const components = [
            new zx.Rating(null, { value: 3, count: 1 }),
            new zx.ListToolbar(null, { count: 1 }),
            new zx.RunStatus(null, { steps: { done: 1, total: 1 }, ticking: false }),
            new zx.KanbanView(null, {
              fields: [{ id: 'title', label: 'Title' }, { id: 'stage', label: 'Stage' }],
              data: [{ ID: 1, title: 'Record name', stage: 'a' }], recordId: 'ID', columnBy: 'stage',
              columns: [{ id: 'a', label: 'A' }], titleField: 'title'
            }),
            new zx.ListToolbar(null, { count: 1, msg: { 'listToolbar.results': 'Custom %1 items' } }),
            new zx.Rating(null, { count: 1, msg: { 'rating.count': 'Custom %1 ratings' } })
          ];
          document.body.append(...components.map((item) => item.el));
          const initial = {
            rating: components[0].el.querySelector('.zx-rating__readout').textContent,
            results: components[1].el.querySelector('.zx-list-toolbar__count').textContent,
            steps: components[2].el.querySelector('[role="progressbar"]').getAttribute('aria-valuetext'),
            board: components[3].el.querySelector('.zx-kanban-view__count').getAttribute('aria-label'),
            customResults: components[4].el.querySelector('.zx-list-toolbar__count').textContent,
            customRating: components[5].el.querySelector('.zx-rating__readout').textContent
          };
          components[1].setCount(1234);
          initial.many = components[1].el.querySelector('.zx-list-toolbar__count').textContent;
          components.forEach((item) => item.destroy());
          return initial;
        }, locale);
        const nbsp = '\u00a0';
        assert.ok(result.rating.includes(locale === 'en' ? '1 rating' : `1${nbsp}Bewertung`));
        assert.equal(result.results, locale === 'en' ? '1 result' : `1${nbsp}Ergebnis`);
        assert.equal(result.steps, locale === 'en' ? '1 of 1 step' : `1 von 1${nbsp}Schritt`);
        assert.equal(result.board, locale === 'en' ? '1 record' : `1${nbsp}Datensatz`);
        assert.equal(result.customResults, 'Custom 1 items');
        assert.ok(result.customRating.includes('Custom 1 ratings'));
        assert.equal(result.many, locale === 'en' ? '1,234 results' : `1.234${nbsp}Ergebnisse`);
      }
    }
  },
  {
    name: 'RunStatus English fallback ignores Russian singular categories while custom messages keep precedence',
    async run({ page }) {
      const labels = await page.evaluate(() => {
        zx.setLanguage('ru');
        zx.setTranslator(null);
        class CustomStatus extends zx.RunStatus {
          static defaults = { msg: { 'runStatus.steps.one': 'Inherited %1 / %2' } };
        }
        const components = [
          new zx.RunStatus(null, { steps: { done: 1, total: 21 }, ticking: false }),
          new zx.RunStatus(null, { steps: { done: 1, total: 1 }, ticking: false }),
          new CustomStatus(null, { steps: { done: 1, total: 21 }, ticking: false }),
          new CustomStatus(null, { steps: { done: 1, total: 21 }, ticking: false,
            msg: { 'runStatus.steps': 'Instance %1 / %2' } })
        ];
        document.body.append(...components.map((component) => component.el));
        const labels = components.map((component) => component.el.querySelector('[role="progressbar"]').getAttribute('aria-valuetext'));
        components.forEach((component) => component.destroy());
        return labels;
      });
      assert.deepEqual(labels, ['1 of 21 steps', '1 of 1 step', 'Inherited 1 / 21', 'Instance 1 / 21']);
    }
  },
  {
    name: 'NumberField parses the displayed locale across typing, stepping, and language changes',
    async run({ page }) {
      await page.evaluate(() => {
        zx.setLanguage('de');
        window.number = new zx.NumberField(null, { value: 1234.5, group: true, step: 0.01, precision: 2, label: 'Amount' });
        window.explicit = new zx.NumberField(null, { value: 1234.5, group: true, step: 0.01, precision: 2, locale: 'en-US', label: 'Explicit amount' });
        const outside = document.createElement('button'); outside.textContent = 'Outside';
        document.body.append(number.el, explicit.el, outside);
      });
      const input = page.getByRole('spinbutton', { name: 'Amount', exact: true });
      assert.equal(await input.inputValue(), '1.234,50');
      assert.equal(await page.getByRole('spinbutton', { name: 'Explicit amount' }).inputValue(), '1,234.50');
      await input.click();
      await input.fill('1234,56');
      assert.equal(await input.inputValue(), '1234,56');
      await page.evaluate(() => zx.setLanguage('en-US'));
      await input.press('ArrowUp');
      assert.equal(await input.inputValue(), '1234.57');
      assert.equal(await page.evaluate(() => number.get()), 1234.57);
      await page.evaluate(() => zx.setLanguage('de'));
      await page.getByRole('button', { name: 'Outside' }).click();
      assert.equal(await input.inputValue(), '1.234,57');
      assert.equal(await page.evaluate(() => number.get()), 1234.57);
      await input.click();
      await input.fill('4,25');
      await input.press('ArrowUp');
      await page.getByRole('button', { name: 'Outside' }).click();
      assert.equal(await input.inputValue(), '4,26');
      assert.equal(await page.evaluate(() => number.get()), 4.26);
      await page.evaluate(() => { zx.setLanguage('ar'); number.set(1234.5); });
      await input.click();
      await input.press('ArrowUp');
      await page.getByRole('button', { name: 'Outside' }).click();
      assert.equal(await page.evaluate(() => number.get()), 1234.51, 'localized digits survive stepping and blur');
      assert.equal(await input.inputValue(), await page.evaluate(() => new Intl.NumberFormat('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.51)));
    }
  },
  {
    name: 'CodeEditor selection and Questionnaire validation pass numeric counts to plural rules',
    async run({ page }) {
      await page.evaluate(() => {
        zx.setLanguage('ru');
        zx.setTranslator((key) => ({
          'codeEditor.selection.few': 'Selected %3 lines at %1:%2',
          'questionnaire.rule.minLength.few': 'Need %1 letters'
        })[key]);
        window.editor = new zx.CodeEditor(null, { value: 'one\ntwo\nthree' });
        window.questionnaire = new zx.Questionnaire(null, { items: [
          { name: 'a', prompt: 'Answer', input: {}, validate: [{ minLength: 2 }] }
        ] });
        document.body.append(editor.el, questionnaire.el);
      });
      await page.locator('.zx-code-editor textarea').focus();
      await page.evaluate(() => editor.el.querySelector('textarea').setSelectionRange(0, 0));
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForFunction(() => editor.el.textContent.includes('Selected'));
      assert.match(await page.locator('.zx-code-editor').textContent(), /Selected 2 lines/);
      await page.locator('.zx-questionnaire input').fill('x');
      await page.locator('.zx-questionnaire [data-action="next"]').click();
      assert.match(await page.locator('.zx-questionnaire').textContent(), /Need 2 letters/);
    }
  },
  {
    name: 'ZeyOS save confirmation translates around the unchanged server record label',
    async run({ page }) {
      const saved = await page.evaluate(async () => {
        const { zeyosForm } = await import('/src/zeyos/form.js');
        const { de } = await import('/src/locales/de.js');
        zx.setLanguage('de'); zx.setTranslator((key) => de[key]);
        const client = {
          schema: {
            fields: () => ['name'], describe: () => ({ fields: { name: { type: 'text' } } }),
            operations: () => ['createAccount']
          },
          api: { createAccount: async (values) => ({ ID: 1, name: values.name }) }
        };
        window.binding = zeyosForm(client, 'accounts', { value: { name: 'Server record name' } });
        document.body.append(binding.form.el);
        await binding.ready;
        return binding.save();
      });
      assert.equal(saved.name, 'Server record name');
      await page.getByText('Server record name wurde erfolgreich gespeichert.', { exact: true }).waitFor();
      await page.evaluate(() => binding.destroy());
    }
  },
  {
    name: 'explicit date locale bypasses host names and regional English remains effective',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const { dateLocale } = await import('/src/internal/date-locale.js');
        zx.setLanguage('de');
        zx.setTranslator((key) => ({ 'date.month.2': 'Long translated month', 'date.month.short.2': 'Custom short' })[key]);
        const date = new Date(2026, 2, 5);
        const explicit = zx.formatDate(date, '%B %b', { locale: 'en-GB' });
        const implicit = zx.formatDate(date, '%B %b');
        zx.setTranslator((key) => key === 'date.month.2' ? 'Long translated month' : null);
        const noShort = zx.formatDate(date, '%B %b');
        zx.setLanguage('en-GB'); zx.setTranslator(null);
        const field = new zx.DatePicker(null, { value: new Date(2026, 8, 6) });
        document.body.append(field.el);
        return { explicit, implicit, noShort, locale: dateLocale(), september: zx.formatDate(new Date(2026, 8, 6), '%b'), expected: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(2026, 8, 6)) };
      });
      assert.equal(result.explicit, 'March Mar');
      assert.equal(result.implicit, 'Long translated month Custom short');
      assert.match(result.noShort, /^Long translated month Mär/);
      assert.equal(result.locale, 'en-GB');
      assert.equal(result.september, result.expected);
    }
  }
];
