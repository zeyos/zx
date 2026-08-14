import {
  addDays, addMonths, clamp, clampDate, debounce, deepMerge, formatDate, getLanguage, getWeekStart,
  h, htmlEscape, isElement, isSameDay, parseDate, printf, rovingTabindex, toArray, typeahead, uid
} from '../../src/index.js';

/** Fixed reference date so the date examples read the same on every visit. */
const REFERENCE = new Date(2026, 7, 14, 9, 30, 0);

export default {
  title: 'Helper functions',
  group: 'Helpers',
  blurb: 'The standalone function library that ships alongside the components: dates, formatting, '
    + 'escaping, small utilities, translation, and keyboard behaviours. Every one is a plain '
    + 'export — importable on its own, usable without instantiating anything.',

  /**
   * Mounts live examples for the non-component helper exports.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    container.append(
      intro(),
      dateHelpers(),
      utilityHelpers(),
      escapingHelpers(),
      translationHelpers(),
      keyboardHelpers()
    );
  }
};

/** @returns {HTMLElement} */
function intro() {
  return section('What counts as a helper',
    note('Components cover the interactive surface. Everything below is the layer underneath: '
      + 'pure functions with no DOM ownership, no lifecycle, and no teardown. They are exported '
      + 'from the same entry point as the components:'),
    code("import { formatDate, debounce, printf } from '/assets/zx.esm.js';"),
    note('For the element factory h(), the icon set, the anchored-positioning helper, and the '
      + 'Component base class, see the Kernel entry — those are the building blocks components '
      + 'themselves are made of.')
  );
}

/** @returns {HTMLElement} */
function dateHelpers() {
  const format = h('input', { type: 'text', value: '%d.%m.%Y %H:%M', size: 18 });
  const input = h('input', { type: 'text', value: '14.08.2026 09:30', size: 18 });
  const out = output();

  const update = () => {
    const parsed = parseDate(input.value, format.value);
    const lines = [
      `formatDate(reference, '${format.value}') → ${formatDate(REFERENCE, format.value)}`,
      `parseDate('${input.value}', '${format.value}') → ${parsed ? parsed.toISOString() : 'null'}`,
      `addDays(reference, 30) → ${formatDate(addDays(REFERENCE, 30), '%Y-%m-%d')}`,
      `addMonths(reference, -2) → ${formatDate(addMonths(REFERENCE, -2), '%Y-%m-%d')}`,
      `isSameDay(reference, parsed) → ${parsed ? isSameDay(REFERENCE, parsed) : 'n/a'}`,
      `clampDate(reference, 2026-01-01, 2026-06-30) → `
        + formatDate(clampDate(REFERENCE, new Date(2026, 0, 1), new Date(2026, 5, 30)), '%Y-%m-%d'),
      `getWeekStart('${getLanguage()}') → ${getWeekStart()} (0 = Sunday, 1 = Monday)`
    ];
    out.textContent = lines.join('\n');
  };
  format.addEventListener('input', update);
  input.addEventListener('input', update);
  update();

  return section('Dates',
    note('Formatting and parsing use strftime-style tokens: %d %m %Y %y %H %M %S %a %A %b %B %s. '
      + 'parseDate() returns null when the string does not match, so it doubles as a validator.'),
    row(
      field('Format', format),
      field('Parse', input)
    ),
    out
  );
}

/** @returns {HTMLElement} */
function utilityHelpers() {
  const out = output();
  const debounceOut = output('Type below — the handler fires 400 ms after you stop.');
  let calls = 0;

  const typing = h('input', { type: 'text', placeholder: 'Search…', size: 24 });
  const onSettled = debounce((value) => {
    calls += 1;
    debounceOut.textContent = `debounce fired ${calls}× — latest value: "${value}"`;
  }, 400);
  typing.addEventListener('input', () => onSettled(typing.value));

  const defaults = { page: 1, sort: { id: 'name', dir: 'asc' }, columns: ['name', 'city'] };
  const overrides = { sort: { dir: 'desc' }, columns: ['name'] };
  out.textContent = [
    `uid() → ${uid()}`,
    `uid('row') → ${uid('row')}`,
    `clamp(42, 0, 10) → ${clamp(42, 0, 10)}`,
    `toArray(null) → ${JSON.stringify(toArray(null))}`,
    `toArray('one') → ${JSON.stringify(toArray('one'))}`,
    `toArray(document.querySelectorAll('input')).length → ${toArray(document.querySelectorAll('input')).length}`,
    `isElement(document.body) → ${isElement(document.body)}`,
    `isElement({ nodeType: 1 }) → ${isElement({ nodeType: 1 })}  // cross-realm safe`,
    '',
    'deepMerge(defaults, overrides) →',
    JSON.stringify(deepMerge(defaults, overrides), null, 2)
  ].join('\n');

  return section('Utilities',
    note('deepMerge() never mutates either input and replaces arrays rather than concatenating '
      + 'them, which is what option objects want. uid() is unique per page load and safe as a DOM '
      + 'id or CSS name.'),
    out,
    row(field('Debounced input', typing)),
    debounceOut
  );
}

/** @returns {HTMLElement} */
function escapingHelpers() {
  const input = h('input', {
    type: 'text',
    size: 34,
    value: '<img src=x onerror="alert(1)"> & "quoted"'
  });
  const escaped = output();
  const rendered = h('p', { style: { margin: '0' } });

  const update = () => {
    escaped.textContent = `htmlEscape(value) → ${htmlEscape(input.value)}`;
    rendered.textContent = input.value;
  };
  input.addEventListener('input', update);
  update();

  return section('Escaping',
    note('Zx never assigns innerHTML except through h.raw(), and only for markup a component '
      + 'generated itself. Anything from a user or a server goes through a text node or '
      + 'htmlEscape().'),
    row(field('Untrusted value', input)),
    escaped,
    h('div', { style: {
      padding: 'var(--zx-space-3)',
      border: '1px solid var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-md)'
    } },
    h('small', { style: { color: 'var(--zx-color-text-muted)' } }, 'Rendered as a text node:'),
    rendered)
  );
}

/** @returns {HTMLElement} */
function translationHelpers() {
  const template = h('input', {
    type: 'text',
    size: 40,
    value: '%s has %s open item(s) — due %s'
  });
  const out = output();

  const update = () => {
    out.textContent = [
      `getLanguage() → '${getLanguage()}'`,
      `printf(template, ['Nadine', 3, formatDate(reference, '%d.%m.%Y')])`,
      `  → ${printf(template.value, ['Nadine', 3, formatDate(REFERENCE, '%d.%m.%Y')])}`
    ].join('\n');
  };
  template.addEventListener('input', update);
  update();

  return section('Translation',
    note('Every component routes its built-in strings through translate(), so one translator '
      + 'covers the whole library. Install it once at application start-up; setLanguage() also '
      + 'drives locale-dependent behaviour such as the first day of the week.'),
    code([
      "import { setTranslator, setLanguage } from '/assets/zx.esm.js';",
      '',
      'setLanguage(document.documentElement.lang);',
      'setTranslator((key, args) => printf(myCatalogue[key] ?? key, args));'
    ].join('\n')),
    row(field('printf template', template)),
    out
  );
}

/** @returns {HTMLElement} */
function keyboardHelpers() {
  const items = ['Accounts', 'Billing', 'Calendar', 'Contacts', 'Projects', 'Tickets'];
  const list = h('div', {
    role: 'listbox',
    tabIndex: -1,
    'aria-label': 'Modules',
    style: {
      display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-2)',
      padding: 'var(--zx-space-3)',
      border: '1px solid var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-md)'
    }
  }, items.map((label) => h('button', {
    type: 'button',
    class: 'zx-btn',
    dataset: { size: 'sm' },
    role: 'option'
  }, label)));

  const out = output('Click an item, then use the arrow keys — or just type a module name.');
  const roving = rovingTabindex(list, '[role="option"]', { orientation: 'horizontal' });
  const search = typeahead(
    () => [...list.querySelectorAll('[role="option"]')],
    (item) => {
      item.focus();
      out.textContent = `typeahead matched "${item.textContent}"`;
    }
  );
  list.addEventListener('keydown', (event) => search(event));
  list.addEventListener('focusin', (event) => {
    out.textContent = `rovingTabindex focus → ${event.target.textContent}`;
  });

  // The demo stage is replaced when another entry is opened; drop the listeners with it.
  new MutationObserver((records, observer) => {
    if (list.isConnected) return;
    roving.destroy();
    observer.disconnect();
  }).observe(document.body, { childList: true, subtree: true });

  return section('Keyboard',
    note('These are the primitives the components use for APG conformance. focusTrap(container) '
      + 'confines Tab to a container and returns a release function; rovingTabindex() keeps one '
      + 'tab stop in a group and moves focus with the arrow keys; typeahead() resolves printable '
      + 'keystrokes to an item index.'),
    list,
    out
  );
}

/* --------------------------------------------------------------- small helpers -- */

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: {
    display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
    border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
    background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-5)'
  } }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 'var(--zx-space-4)'
  } }, children);
}

/** @param {string} label @param {HTMLElement} control @returns {HTMLElement} */
function field(label, control) {
  return h('label', { style: { display: 'grid', gap: 'var(--zx-space-1)' } },
    h('span', { style: { color: 'var(--zx-color-text-muted)', fontSize: 'var(--zx-text-sm)' } }, label),
    control);
}

/** @param {string} [text=''] @returns {HTMLElement} */
function output(text = '') {
  return h('pre', { style: {
    margin: '0', padding: 'var(--zx-space-4)', overflowX: 'auto',
    borderRadius: 'var(--zx-radius-md)', background: 'var(--zx-color-bg-muted)',
    fontFamily: 'var(--zx-font-mono)', fontSize: 'var(--zx-text-sm)', lineHeight: '1.7',
    whiteSpace: 'pre-wrap'
  } }, text);
}

/** @param {string} text @returns {HTMLElement} */
function code(text) {
  return output(text);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', { style: {
    margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
  } }, text);
}
