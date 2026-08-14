import { h } from '../../src/index.js';
import { gx } from '../../src/compat/index.js';

/** The legacy namespaces, in the order a migrating application usually meets them. */
const NAMESPACES = [
  ['gx.zeyos', 'The ZeyOS widget set: Select, Table, Tabbox, Panel, MasterPanel, Datebox, Msgbox, Popup, Dialog, Client, Request, Factory.'],
  ['gx.bootstrap', 'The Bootstrap-era widgets: Form, Fieldset, Field, Select variants, Checklist, Table, Tabbox, NavigationBar, MenuButton, Message, DataFilter, ValueList, FieldUpload.'],
  ['gx.util', 'Formatting and type helpers: formatNum, formatTime, getMinutes, getNumber, printf, parseResult, isArray/isObject/isElement, Console.'],
  ['gx.ui', 'Container, SimpleTable, Timebox, and the visual-effect stubs (Blend, Collapse, Hud, Toggling, HGroup, Templates).'],
  ['gx.core', 'Settings — the legacy option-merging base.'],
  ['gx.compat', 'The compatibility utilities themselves: installGlobals, installElementStorage, parse, GxWrapper.']
];

export default {
  title: 'gx compatibility',
  group: 'Helpers',
  blurb: 'An opt-in layer that re-implements the legacy MooTools-era gx API on top of Zx, so '
    + 'existing ZeyOS applications keep running while their code is modernised file by file.',

  /**
   * Mounts the compatibility overview plus a legacy snippet running live against Zx.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    container.append(overview(), loading(), liveSnippet(), migrationNotes());
  }
};

/** @returns {HTMLElement} */
function overview() {
  return section('What the layer does',
    note('The legacy gx libraries were built on MooTools and depended on it for classes, element '
      + 'extensions, and requests. The compatibility layer keeps the old constructor names and '
      + 'option shapes but implements them with Zx components underneath — so a legacy screen '
      + 'gets the current look, keyboard behaviour, and theming without being rewritten first.'),
    note('It is entirely optional. It lives in its own bundle, is never imported by '
      + 'src/index.js, and adds nothing to an application that does not ask for it.'),
    h('dl', { class: 'summary-list' }, NAMESPACES.flatMap(([name, description]) => [
      h('dt', {}, h('code', {}, name)),
      h('dd', {}, description)
    ]))
  );
}

/** @returns {HTMLElement} */
function loading() {
  return section('Loading it',
    note('In a classic screen, load the compatibility bundle instead of (or alongside) the global '
      + 'one. It installs window.gx; installGlobals() additionally restores the legacy free '
      + 'functions such as __() that old code calls without a namespace.'),
    code([
      '<link rel="stylesheet" href="/assets/zx.css">',
      '<script src="/assets/zx-compat.global.js"></script>',
      '<script>',
      '  gx.compat.installGlobals();          // optional: __(), element storage',
      '  var toggle = new gx.zeyos.Toggle(null, { label: "Notifications", on: true });',
      '  document.body.append(toggle.toElement());',
      '</script>'
    ].join('\n')),
    note('In a module context, import the namespace directly — that is what this page does:'),
    code("import { gx } from '/assets/zx-compat.esm.js';")
  );
}

/** @returns {HTMLElement} */
function liveSnippet() {
  const out = output('Interact with the widgets below — the events are the legacy callbacks.');

  // Verbatim legacy option shapes: elementIndex/elementLabel, onSelect, cols/structure, onClick.
  const select = new gx.zeyos.Select(null, {
    data: [
      { ID: 1, name: 'Alpine Works GmbH' },
      { ID: 2, name: 'Northstar Systems' },
      { ID: 3, name: 'Danube Systems AG' }
    ],
    elementIndex: 'ID',
    elementLabel: 'name',
    elementSelect: 'name',
    allowEmpty: true,
    value: 2,
    onSelect: (item) => { out.textContent = `gx.zeyos.Select onSelect → ${item.name}`; },
    onNoselect: () => { out.textContent = 'gx.zeyos.Select onNoselect'; }
  });

  const toggle = new gx.zeyos.Toggle(null, {
    on: true,
    value: 'enabled',
    label: 'Runtime notifications',
    onCheck: () => { out.textContent = `gx.zeyos.Toggle onCheck → ${toggle.getValue()}`; },
    onUncheck: () => { out.textContent = 'gx.zeyos.Toggle onUncheck'; }
  });

  const tableHost = h('div', {});
  new gx.zeyos.Table(tableHost, {
    cols: [
      { label: 'Contact', id: 'name', width: '2fr', filter: 'asc' },
      { label: 'City', id: 'city', width: '1fr' },
      { label: 'Open tasks', id: 'tasks', width: '1fr', filterable: false }
    ],
    structure: (row) => [row.name, row.city, row.tasks],
    data: [
      { ID: 11, name: 'Nadine Roth', city: 'Innsbruck', tasks: 3 },
      { ID: 12, name: 'Piet Vermeer', city: 'Rotterdam', tasks: 1 },
      { ID: 13, name: 'Camille Fournier', city: 'Lyon', tasks: 4 }
    ],
    onClick: (data) => { out.textContent = `gx.zeyos.Table onClick → ${data.name}`; },
    onFilter: (column, mode) => { out.textContent = `gx.zeyos.Table onFilter → ${column.id} ${mode}`; }
  });

  const utils = output([
    `gx.util.formatNum(1234567.891, ',', '.', 2) → ${gx.util.formatNum(1234567.891, ',', '.', 2)}`,
    `gx.util.formatTime(455) → ${gx.util.formatTime(455)}`,
    `gx.util.getMinutes('7:35') → ${gx.util.getMinutes('7:35')}`,
    `gx.util.printf('%s of %s', [3, 12]) → ${gx.util.printf('%s of %s', [3, 12])}`
  ].join('\n'));

  return section('Legacy code, current components',
    note('Everything below is written against the legacy API and rendered by Zx components. No '
      + 'MooTools is loaded on this page.'),
    row(select.toElement(), toggle.toElement()),
    tableHost,
    out,
    note('The utility namespace is a straight re-implementation — same names, same output, no '
      + 'dependency:'),
    utils
  );
}

/** @returns {HTMLElement} */
function migrationNotes() {
  return section('Migrating off it',
    note('The layer is a bridge, not a destination. Legacy classes map one-to-one onto Zx '
      + 'components, so a file can be converted in isolation while the rest of the application '
      + 'keeps using gx.*:'),
    h('ul', { style: { margin: '0', paddingInlineStart: 'var(--zx-space-6)', lineHeight: '1.8' } },
      h('li', {}, h('code', {}, 'gx.zeyos.Select'), ', ', h('code', {}, 'SelectFilter'), ', ',
        h('code', {}, 'SelectDyn'), ', ', h('code', {}, 'SelectPrio'), ' → one ',
        h('code', {}, 'Select'), ' with a ', h('code', {}, 'filter'), ' option'),
      h('li', {}, h('code', {}, 'gx.ui.Table'), ' and ', h('code', {}, 'gx.ui.SimpleTable'),
        ' → one ', h('code', {}, 'Table')),
      h('li', {}, h('code', {}, 'gx.zeyos.Msgbox'), ', ', h('code', {}, 'gx.bootstrap.Message'),
        ' → ', h('code', {}, 'Message')),
      h('li', {}, h('code', {}, 'gx.zeyos.Popup'), ', ', h('code', {}, 'PopupAlert'), ', ',
        h('code', {}, 'PopupConfirm'), ' → ', h('code', {}, 'Modal'), ' / ',
        h('code', {}, 'Dialog'), ' with Promise-returning statics'),
      h('li', {}, h('code', {}, 'gx.zeyos.Client'), ' and ', h('code', {}, 'Request'), ' → the ',
        h('code', {}, '@zeyos/client'), ' library')
    ),
    note('Some legacy APIs are deliberately not carried over — visual-effect classes are inert '
      + 'stubs, and anything that depended on MooTools prototype extensions is gone. The full map, '
      + 'including the behaviour changes that are intentional, is in the migration guide.'),
    h('p', { style: { margin: '0' } },
      h('a', { href: '../MIGRATION.md' }, 'MIGRATION.md'),
      ' · ',
      h('a', { href: 'compat.html' }, 'Legacy snippet smoke page'))
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
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-4)'
  } }, children);
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
