import assert from 'node:assert/strict';

export const cases = [
  {
    name: 'locale and country factories return ordinary Selects and normalize only their own string values',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const localeOptions = Object.freeze({ locales: Object.freeze(['de-AT', 'fr', 'en-US-u-ca-gregory', 'de-AT-x-private']), value: 'DE_at', flags: 'code', clearable: true });
        const countryOptions = Object.freeze({ countries: Object.freeze(['AT', 'DE', 'FR']), value: ' at ', flags: 'none', clearable: true });
        const locale = zx.Select.locale(null, localeOptions); const country = zx.Select.country(null, countryOptions);
        const ordinary = new zx.Select(null, { items: [{ ID: 'de_at', name: 'Raw' }, { ID: 'DE', name: 'Upper' }], value: 'de_at' });
        document.body.append(locale.el, country.el, ordinary.el);
        const identity = [locale, country].every(select => select.constructor === zx.Select && Object.getPrototypeOf(select) === zx.Select.prototype && select.set === zx.Select.prototype.set);
        const initial = [locale.value, country.value, ordinary.value];
        const changes = []; locale.on('change', event => changes.push(event.detail.value));
        locale.set('de_AT'); locale.set('EN_us_u_ca_gregory'); locale.set('DE_at_x_PRIVATE');
        const extensions = locale.value; locale.set(locale.options.items[1]);
        country.set('de'); ordinary.set('de');
        const later = [locale.value, country.value, ordinary.value];
        locale.set(null); locale.reset(); country.value = 'fr';
        const reset = [locale.value, country.value];
        const result = { identity, initial, extensions, later, reset, changes, presets: [locale.el.dataset.preset, country.el.dataset.preset], untouched: [localeOptions.value, countryOptions.value] };
        locale.destroy(); country.destroy(); ordinary.destroy(); return result;
      });
      assert.deepEqual(result, {
        identity: true, initial: ['de-AT', 'AT', 'de_at'], extensions: 'de-AT-x-private',
        later: ['fr', 'DE', null], reset: ['de-AT', 'FR'],
        changes: ['en-US-u-ca-gregory', 'de-AT-x-private', 'fr', null, 'de-AT'],
        presets: ['locale', 'country'], untouched: ['DE_at', ' at ']
      });
    }
  },
  {
    name: 'Select presets retain keyboard navigation, clearability, filtering, and pinned choices',
    async run({ page }) {
      await page.evaluate(() => {
        window.locale = zx.Select.locale(null, { locales: ['de-AT', 'fr', 'ja'], preferred: ['en'], preferredLabel: 'Pinned languages', flags: 'code', clearable: true, filter: 'local', value: 'fr' });
        window.country = zx.Select.country(null, { countries: [{ code: 'DE', description: 'ordinary unicorn' }, 'FR'], preferred: [{ code: 'AT', description: 'preferred unicorn' }], preferredLabel: 'Markets', displayLocale: 'de', flags: 'none', clearable: true });
        document.body.append(locale.el, country.el);
        window.events = []; locale.on('change', event => events.push(event.detail.value));
      });
      const localeInput = page.locator('[data-preset=locale] input');
      await localeInput.focus(); await localeInput.press('ArrowDown');
      assert.equal(await localeInput.getAttribute('aria-expanded'), 'true');
      await localeInput.press('End'); await localeInput.press('Enter');
      assert.equal(await page.evaluate(() => locale.value), 'ja');
      await localeInput.press('ArrowUp'); await localeInput.press('Home'); await localeInput.press('ArrowDown'); await localeInput.press('Enter');
      assert.equal(await page.evaluate(() => locale.value), 'en');
      await localeInput.press('ArrowDown'); await localeInput.press('Escape');
      assert.equal(await localeInput.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.evaluate(() => document.activeElement === locale.refs.input), true);
      await page.locator('[data-preset=locale] .zx-select__clear').click();
      assert.deepEqual(await page.evaluate(() => events), ['ja', 'en', null]);
      await localeInput.fill('japan');
      assert((await page.locator('[data-preset=locale] [role=option]').allTextContents()).some(text => text.includes('日本語')));
      await localeInput.fill('english');
      assert((await page.locator('[data-preset=locale] [role=option]').allTextContents()).some(text => text.includes('English')));
      await localeInput.press('Tab');
      assert.equal(await localeInput.getAttribute('aria-expanded'), 'false');
      const countryInput = page.locator('[data-preset=country] input');
      await countryInput.fill('germany');
      let texts = await page.locator('[data-preset=country] [role=option]').allTextContents();
      assert(texts.some(text => text.includes('Deutschland')));
      await countryInput.fill('unicorn'); texts = await page.locator('[data-preset=country] [role=option]').allTextContents();
      assert(texts.some(text => text.includes('ordinary unicorn'))); assert(texts.some(text => text.includes('preferred unicorn')));
      await page.evaluate(() => { locale.destroy(); country.destroy(); });
    }
  },
  {
    name: 'preset Field adapters retain normalizing values, events, focus, and disabled state',
    async run({ page }) {
      await page.evaluate(() => {
        window.localeField = new zx.Field(null, { type: 'zxselect', label: 'Language', value: 'DE_at', props: { preset: 'locale', locales: ['de-AT', 'fr'], clearable: true } });
        window.countryField = new zx.Field(null, { type: 'zxselect', label: 'Country', value: 'at', props: { preset: 'country', countries: ['AT', 'DE'], clearable: true } });
        document.body.append(localeField.el, countryField.el);
        window.changes = []; localeField.on('change', event => changes.push(event.detail.value));
      });
      assert.deepEqual(await page.evaluate(() => [localeField.getValue(), countryField.getValue()]), ['de-AT', 'AT']);
      await page.evaluate(() => { localeField.setValue('FR', { silent: true }); countryField.setValue('de', { silent: true }); });
      assert.deepEqual(await page.evaluate(() => [localeField.getValue(), countryField.getValue(), changes]), ['fr', 'DE', []]);
      await page.locator('[data-preset=locale] .zx-select__clear').click();
      assert.deepEqual(await page.evaluate(() => changes), [null]);
      await page.evaluate(() => countryField.setDisabled(true));
      assert.equal(await page.locator('[data-preset=country] input').isDisabled(), true);
      await page.evaluate(() => { countryField.setDisabled(false); countryField.focus(); });
      assert.equal(await page.evaluate(() => document.activeElement === countryField.el.querySelector('input')), true);
      assert.equal(await page.evaluate(() => [localeField, countryField].every(field => zx.Component.from(field.el.querySelector('.zx-select')).constructor === zx.Select)), true);
      await page.evaluate(() => { localeField.destroy(); countryField.destroy(); });
    }
  },
  {
    name: 'preset rendering keeps flags, label languages, custom descriptions, and message overrides',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const locale = zx.Select.locale(null, { locales: ['de', { code: 'en', description: 'Custom copy', region: null }], value: 'de', flags: 'code', displayLocale: 'en', msg: { 'localePicker.label': 'Own language', 'localePicker.placeholder': 'Own placeholder' } });
        const country = zx.Select.country(null, { countries: ['DE'], value: 'de', flags: 'none', displayLocale: 'de', msg: { 'countryPicker.label': 'Own country' } });
        const image = zx.Select.country(null, { countries: ['AT'], value: 'at', flagUrl: '/flags/{code}-{CODE}.svg' });
        const custom = zx.Select.country(null, { countries: ['AT'], value: 'at', flags: (region, item) => zx.h('b', {}, `${region}:${item.ID}`) });
        const result = {
          localeLabel: locale.refs.input.getAttribute('aria-label'), placeholder: locale.refs.input.placeholder,
          language: locale.el.querySelector('.zx-select__entity-label').lang,
          description: locale.el.textContent.includes('Custom copy'),
          code: locale.refs.valueAdornment.textContent, countryLabel: country.refs.input.getAttribute('aria-label'),
          noFlag: country.refs.valueAdornment.hidden, image: image.refs.valueAdornment.querySelector('img').getAttribute('src'), custom: custom.refs.valueAdornment.textContent
        };
        for (const select of [locale, country, image, custom]) select.destroy(); return result;
      });
      assert.deepEqual(result, { localeLabel: 'Own language', placeholder: 'Own placeholder', language: 'de', description: true, code: 'DE', countryLabel: 'Own country', noFlag: true, image: '/flags/at-AT.svg', custom: 'AT:AT' });
    }
  },
  {
    name: 'both presets restore the same target and remove listeners and outside panels after repeated destruction',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const target = zx.h('div', { class: 'original', 'data-preset': 'host', title: 'Existing' }, zx.h('button', {}, 'Original content'));
        document.body.append(target); const child = target.firstChild; const original = target.outerHTML;
        const checks = [];
        for (const preset of ['locale', 'country', 'locale', 'country']) {
          const select = zx.Select[preset](target, { clearable: true }); select.open();
          const input = select.refs.input; let changed = 0; select.on('change', () => changed++);
          select.destroy(); select.destroy();
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          checks.push(target.outerHTML === original && target.firstChild === child && zx.Component.from(target) === null && changed === 0 && document.querySelectorAll('.zx-select__panel').length === 0);
        }
        target.remove(); return checks;
      });
      assert.deepEqual(result, [true, true, true, true]);
    }
  }
];
