import assert from 'node:assert/strict';

/** @param {object} page @param {string} base @returns {Promise<object>} */
async function openGuide(page, base) {
  await page.goto(`${base}/website/docs.html#getting-started/locales/try-language-switching`);
  const example = page.frameLocator('iframe[data-guide-example]');
  await example.getByRole('heading', { name: 'Live preview' }).waitFor();
  return example;
}

/** @param {object} example @param {string} language @returns {Promise<void>} */
async function chooseLanguage(example, language) {
  await example.getByRole('combobox', { name: 'Language', exact: true }).click();
  await example.getByRole('option').filter({ hasText: language }).click();
}

export const cases = [
  {
    name: 'Locales guide preserves variables while translating plurals and recreating Select',
    async run({ page, base }) {
      const example = await openGuide(page, base);
      await example.getByRole('textbox', { name: 'Name', exact: true }).fill('Mira');
      await example.getByRole('textbox', { name: 'Record', exact: true }).fill('ORDER-7');
      const results = example.locator('[data-output="results"]');
      for (const language of [
        { name: 'English · shipped', locale: 'en-GB', greeting: 'Welcome, Mira!', assigned: 'Mira is working on ORDER-7.',
          plural: ['0 results', '1 result', '2 results', '1,200 results'], project: 'Project', none: 'No selection', empty: 'No matches', fallback: 'No records' },
        { name: 'German · shipped', locale: 'de-DE', greeting: 'Willkommen, Mira!', assigned: 'Mira bearbeitet ORDER-7.',
          plural: ['0 Ergebnisse', '1 Ergebnis', '2 Ergebnisse', '1.200 Ergebnisse'], project: 'Projekt', none: 'Keine Auswahl', empty: 'Keine Treffer', fallback: 'Keine Datensätze' },
        { name: 'French · custom', locale: 'fr-FR', greeting: 'Bienvenue, Mira !', assigned: 'Mira travaille sur ORDER-7.',
          plural: ['0 résultat', '1 résultat', '2 résultats', '1\u202f200 résultats'], project: 'Projet', none: 'Aucune sélection', empty: 'Aucun résultat', fallback: 'No records' }
      ]) {
        const before = await example.getByRole('spinbutton', { name: 'Count', exact: true }).inputValue();
        await chooseLanguage(example, language.name);
        assert.equal(await example.getByRole('spinbutton', { name: 'Count', exact: true }).inputValue(), before);
        assert.equal(await example.locator('[data-output="welcome"]').textContent(), language.greeting);
        assert.equal(await example.locator('[data-output="assigned"]').textContent(), language.assigned);
        assert.equal(await example.locator('.locale-example__preview').getAttribute('lang'), language.locale);
        for (const [index, count] of [0, 1, 2, 1200].entries()) {
          await example.getByRole('button', { name: String(count), exact: true }).click();
          assert.equal(await results.textContent(), language.plural[index]);
          assert.equal(await example.locator('[data-output="category"]').textContent(),
            count === 1 || (count === 0 && language.locale === 'fr-FR') ? 'one' : 'other');
        }
        assert.equal(await example.locator('[data-output="fallback"]').textContent(), language.fallback);
        const project = example.getByRole('combobox', { name: language.project, exact: true });
        assert.equal(await project.getAttribute('placeholder'), language.none);
        await project.press('ArrowDown');
        assert.equal(await example.locator('.zx-select__empty:visible').textContent(), language.empty);
        await project.press('Escape');
        assert.equal(await example.locator('.locale-example__preview .zx-select').count(), 1);
      }

      // The same input keeps focus and user text; interpolation never treats it as markup.
      const name = example.getByRole('textbox', { name: 'Name', exact: true });
      await name.fill('<b>Mira</b>');
      assert.equal(await example.locator('[data-output="welcome"]').textContent(), 'Bienvenue, <b>Mira</b> !');
      assert.equal(await example.locator('[data-output="welcome"] b').count(), 0);
      const count = example.getByRole('spinbutton', { name: 'Count', exact: true });
      await count.fill('');
      assert.equal(await results.textContent(), 'Saisissez un nombre pour voir sa forme plurielle.');
      assert.equal(await example.locator('[data-output="category"]').textContent(), '—');
      await count.fill('2');
      assert.equal(await results.textContent(), '2 résultats');
      await count.press('ArrowUp');
      assert.equal(await results.textContent(), '3 résultats');

      const language = example.getByRole('combobox', { name: 'Language', exact: true });
      await language.focus();
      await language.press('ArrowDown');
      await language.press('Home');
      await language.press('Enter');
      assert.equal(await example.locator('[data-output="locale"]').textContent(), 'en-GB');
      assert.equal(await results.textContent(), '3 results');
      assert.equal(await name.inputValue(), '<b>Mira</b>');
    }
  },
  {
    name: 'Locales guide isolates translation state, follows themes, and remounts cleanly',
    async run({ page, base, theme }) {
      const example = await openGuide(page, base);
      await page.evaluate(async (theme) => {
        const zx = await import('/src/index.js');
        zx.setLanguage('it-IT');
        zx.setTranslator(key => key === 'example.marker' ? 'Parent translator' : null);
        document.documentElement.dataset.zxTheme = theme;
        document.documentElement.dataset.zxPreset = 'violet';
      }, theme);
      await example.locator(`html[data-zx-theme="${theme}"][data-zx-preset="violet"]`).waitFor();
      await chooseLanguage(example, 'French · custom');
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForFunction(() => {
          const frame = document.querySelector('iframe[data-guide-example]');
          return Math.abs(frame.clientHeight - frame.contentDocument.body.getBoundingClientRect().height) < 2;
        });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert.ok(await example.locator('html').evaluate(root => root.scrollWidth <= root.clientWidth + 1));
        assert.ok(await example.locator('body').evaluate(body =>
          body.getBoundingClientRect().height <= body.ownerDocument.defaultView.innerHeight + 1),
        'the embedded viewport must fit the complete example without clipping its final lines');
      }
      const otherTheme = theme === 'light' ? 'dark' : 'light';
      await page.evaluate(theme => { document.documentElement.dataset.zxTheme = theme; }, otherTheme);
      await example.locator(`html[data-zx-theme="${otherTheme}"]`).waitFor();
      const checkParent = () => page.evaluate(async () => {
        const zx = await import('/src/index.js');
        return [zx.getLanguage(), zx.translate('example.marker'), document.documentElement.lang];
      });
      assert.deepEqual(await checkParent(), ['it-IT', 'Parent translator', 'en']);
      await page.evaluate(() => { location.hash = 'getting-started/installation'; });
      await page.getByRole('heading', { name: 'Installation', exact: true }).waitFor();
      assert.equal(await page.locator('iframe[data-guide-example]').count(), 0);
      await page.evaluate(() => { location.hash = 'getting-started/locales'; });
      await example.getByRole('heading', { name: 'Live preview' }).waitFor();
      assert.equal(await example.locator('[data-output="locale"]').textContent(), 'en-GB');
      assert.equal(await example.locator('[data-output="results"]').textContent(), '1 result');
      assert.equal(await page.locator('iframe[data-guide-example]').count(), 1);
      assert.deepEqual(await checkParent(), ['it-IT', 'Parent translator', 'en']);

      await page.getByRole('button', { name: 'Code', exact: true }).click();
      await page.getByRole('tab', { name: 'locale-catalogues.js', exact: true }).click();
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true,
          value: { writeText: async value => { window.copiedExample = value; } } });
      });
      await page.locator('#section-try-language-switching .docs-disclosure__bar .docs-code__copy').click();
      await page.waitForFunction(() => window.copiedExample?.includes("'example.results.one': '%1 résultat'"));
    }
  }
];
