import {
  Field, button, formatNumber, getLanguage, h, setLanguage, setTranslator,
  translate, translatePlural
} from '../../src/index.js';
import { en } from '../../src/locales/en.js';
import { catalogues, languages } from './locale-catalogues.js';

/**
 * Mounts an application with editable variables and a translated Select. This example runs in
 * its own document, so its global translator and language belong only to this preview.
 * @param {HTMLElement} container Application root.
 * @returns {() => void} Destroys the mounted controls.
 */
function mount(container) {
  const language = new Field(null, {
    type: 'zxselect', label: 'Language', value: 'en-GB',
    props: {
      preset: 'locale', locales: languages, displayLocale: 'en', flags: 'code',
      filter: false, lang: 'en', msg: en
    }
  });
  const person = new Field(null, { type: 'text', label: 'Name', value: 'Ada' });
  const record = new Field(null, { type: 'text', label: 'Record', value: 'INV-42' });
  let count = 1;
  const quantity = new Field(null, {
    type: 'number', label: 'Count', value: 1,
    props: {
      min: 0, max: 9999, step: 1, lang: 'en', msg: en,
      // NumberField's input event supplies the typed value before it is committed on blur.
      oninput: ({ detail }) => { count = detail.value; updateMessages(); }
    }
  });

  const welcome = h('p', { 'data-output': 'welcome' });
  const assigned = h('p', { 'data-output': 'assigned' });
  const results = h('p', { class: 'locale-example__results', 'data-output': 'results' });
  const heading = h('h2');
  const sample = h('div');
  const preview = h('section', { class: 'locale-example__preview' },
    heading,
    h('div', { role: 'status', ariaLive: 'polite', ariaAtomic: 'true' }, welcome, assigned, results),
    sample
  );
  const activeLocale = h('dd', { 'data-output': 'locale' });
  const category = h('dd', { 'data-output': 'category' });
  const fallback = h('dd', { 'data-output': 'fallback' });
  let project = null;

  /** Recompute messages without rebuilding inputs or disturbing the reader's typing. */
  function updateMessages() {
    welcome.textContent = translate('example.welcome', [person.getValue()]);
    assigned.textContent = translate('example.assigned', {
      person: person.getValue(), record: record.getValue()
    });
    results.textContent = count === null
      ? translate('example.emptyCount')
      : translatePlural('example.results', count, [formatNumber(count)]);
    category.textContent = count === null ? '—' : new Intl.PluralRules(getLanguage()).select(count);
  }

  /** @param {string} locale One of this application's supported language tags. */
  function applyLocale(locale) {
    const catalogue = catalogues[locale];
    setTranslator((key) => catalogue[key]);
    setLanguage(locale);
    preview.lang = locale;
    heading.textContent = translate('example.preview');
    activeLocale.textContent = locale;
    fallback.textContent = translate('table.empty');
    fallback.lang = locale === 'fr-FR' ? 'en' : locale;

    // Components do not automatically relabel. Recreate the affected Select with the new
    // translator; keep the language picker and editable application values in place.
    project?.destroy();
    project = new Field(null, {
      type: 'zxselect', label: translate('example.project'),
      props: { items: [], clearable: true, filter: false, placeholder: translate('select.none') }
    });
    sample.replaceChildren(project.toElement());
    updateMessages();
  }

  const quickCounts = h('div', { class: 'locale-example__counts', role: 'group', ariaLabel: 'Try a count' },
    h('span', {}, 'Try a count:'),
    ...[0, 1, 2, 1200].map((value) => button({
      label: String(value), size: 'sm',
      onclick: () => quantity.setValue(value)
    }))
  );
  container.append(
    h('h1', {}, 'Live preview'),
    h('div', { class: 'locale-example__controls' },
      language.toElement(), person.toElement(), record.toElement(), quantity.toElement()),
    quickCounts,
    preview,
    h('dl', { class: 'locale-example__details' },
      h('div', {}, h('dt', {}, 'Active locale'), activeLocale),
      h('div', {}, h('dt', {}, 'Plural category'), category),
      h('div', {}, h('dt', {}, 'Built-in message: ', h('code', {}, 'table.empty')), fallback)),
    h('p', { class: 'locale-example__note' },
      'Open Project to see Select’s empty-state message. The custom French catalogue leaves ',
      h('code', {}, 'table.empty'), ' untranslated, so that message uses English.')
  );

  for (const field of [person, record]) {
    field.listen(field.el, 'input', updateMessages);
    field.on('change', updateMessages);
  }
  quantity.on('change', ({ detail }) => { count = detail.value; updateMessages(); });
  language.on('change', ({ detail }) => applyLocale(detail.value));
  applyLocale('en-GB');

  return () => {
    project?.destroy();
    for (const field of [language, person, record, quantity]) field.destroy();
    container.replaceChildren();
    setTranslator(null);
    setLanguage('en');
  };
}

const destroy = mount(document.querySelector('#locale-example'));
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) destroy();
}, { once: true });
