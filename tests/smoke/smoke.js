import * as zx from '../../src/index.js';

const runtimeErrors = window.__zxSmokeErrors;
const resultBody = document.querySelector('#results');
const summary = document.querySelector('#summary');
const fixtures = document.querySelector('#fixtures');

const cases = [
  artifactCase('button()', () => {
    let clicks = 0;
    const element = zx.button({ label: 'Save', kind: 'primary', onclick: () => { clicks += 1; } });
    return { element, exercise: () => { element.click(); assert(clicks === 1, 'native click path failed'); } };
  }),
  artifactCase('buttonGroup()', () => {
    const element = zx.buttonGroup([zx.button({ label: 'One' }), zx.button({ label: 'Two' })]);
    return { element, exercise: () => assert(element.querySelectorAll('button').length === 2, 'button group contents missing') };
  }),
  componentCase('CheckButton', () => new zx.CheckButton(null, { label: ['On', 'Off'] }), (component) => {
    const events = observe(component, 'change');
    component.set(true);
    assert(component.get() === true, 'set/get mismatch');
    events.expect();
  }),
  componentCase('Toggle', () => new zx.Toggle(null, { label: 'Enabled', value: 'yes' }), (component) => {
    const events = observe(component, 'change');
    component.set(true);
    assert(component.get() && component.getValue() === 'yes', 'set/getValue mismatch');
    events.expect();
  }),
  componentCase('Groupbox', () => new zx.Groupbox(null, { title: 'Details', open: true }), (component) => {
    component.close();
    assert(!component.isOpen(), 'close failed');
    component.open().setContent('Ready');
    assert(component.isOpen(), 'open failed');
  }),
  componentCase('Panel', () => new zx.Panel(null, { title: 'Panel', content: 'Body' }), (component) => {
    const events = observe(component, 'close');
    component.close();
    assert(!component.isOpen(), 'close failed');
    events.expect();
    component.open();
  }),
  componentCase('MasterPanel', () => new zx.MasterPanel(null, { title: 'Master', content: 'Body' }), (component) => {
    component.setTitle('Updated').setContent('Updated body').setButtons([{ label: 'Action' }]);
    assert(component.refs.title.textContent === 'Updated', 'title update failed');
  }),
  componentCase('Tabbox', () => new zx.Tabbox(null, { tabs: tabDefinitions() }), (component) => {
    const events = observe(component, 'change');
    component.openTab('two');
    assert(component.getActive() === 'two', 'active tab mismatch');
    events.expect();
  }),
  componentCase('NavigationBar', () => new zx.NavigationBar(null, {
    title: 'App',
    items: navigationItems()
  }), (component) => {
    const events = observe(component, 'change');
    component.setActive('two').setBadge('two', '2');
    events.expect();
  }),
  componentCase('Search', () => new zx.Search(null, { debounce: 0 }), async (component) => {
    const events = observe(component, 'input');
    component.set('needle');
    await delay(0);
    assert(component.get() === 'needle', 'set/get mismatch');
    events.expect();
  }),
  componentCase('Message', () => new zx.Message(null, { timeout: 0 }), (component) => {
    const handle = component.show('Ready', { timeout: 0 });
    assert(component.el.querySelector('.zx-message__item'), 'message was not rendered');
    handle.close();
  }),
  componentCase('Modal', () => new zx.Modal(null, { content: 'Modal body' }), (component) => {
    const events = observe(component, 'open');
    component.open();
    assert(component.isOpen(), 'open failed');
    events.expect();
    component.close('done');
  }),
  componentCase('Dialog', () => new zx.Dialog(null, { title: 'Dialog', content: 'Body' }), (component) => {
    component.addView('one', { content: 'One' });
    component.addView('two', { content: 'Two' });
    component.showView('two').content.dataset.exercised = 'true';
    component.open();
    assert(component.isOpen(), 'open failed');
    component.close();
  }),
  dropdownCase(),
  componentCase('MenuButton', () => new zx.MenuButton(null, {
    label: 'Actions', items: [{ label: 'Run', value: 'run' }]
  }), (component) => {
    const events = observe(component, 'open');
    component.open();
    assert(component.isOpen(), 'open failed');
    events.expect();
    component.close();
  }),
  componentCase('Select', () => new zx.Select(null, { items: sampleItems(), value: 1 }), (component) => {
    const events = observe(component, 'change');
    component.set(2).open().close();
    assert(component.value === 2 && component.selected.name === 'Two', 'selection mismatch');
    events.expect();
  }),
  componentCase('Checklist', () => new zx.Checklist(null, { items: sampleItems(), search: false }), (component) => {
    const events = observe(component, 'change');
    component.setValues([2]);
    assert(component.getValues()[0] === 2, 'checked values mismatch');
    events.expect();
  }),
  componentCase('Permission', () => new zx.Permission(null, { groups: sampleItems() }), (component) => {
    const events = observe(component, 'change');
    component.set(2);
    assert(component.get() === 2, 'permission value mismatch');
    events.expect();
  }),
  componentCase('DatePicker', () => new zx.DatePicker(null, { value: date(20) }), (component) => {
    const events = observe(component, 'change');
    component.set(date(21));
    assert(component.get().getDate() === 21, 'date value mismatch');
    events.expect();
  }),
  componentCase('MonthPicker', () => new zx.MonthPicker(null, { value: date(20) }), (component) => {
    component.set(new Date(2026, 8, 14));
    assert(component.get().getMonth() === 8 && component.get().getDate() === 1, 'month normalization failed');
  }),
  componentCase('TimePicker', () => new zx.TimePicker(null, { value: { h: 9, m: 15, s: 0 } }), (component) => {
    const events = observe(component, 'change');
    component.set({ h: 10, m: 30, s: 0 });
    assert(component.get().h === 10 && component.get().m === 30, 'time value mismatch');
    events.expect();
  }),
  componentCase('Datebox', () => new zx.Datebox(null, { value: date(20) }), (component) => {
    component.set(date(22)).open().close();
    assert(component.get().getDate() === 22, 'datebox value mismatch');
  }),
  componentCase('DateTimeBox', () => zx.DateTimeBox(null, { value: date(20) }), (component) => {
    component.set(new Date(2026, 6, 20, 13, 45));
    assert(component.get().getHours() === 13, 'datetime value mismatch');
  }),
  componentCase('Timebox', () => new zx.Timebox(null, { value: 60 }), (component) => {
    const events = observe(component, 'change');
    component.set(90);
    assert(component.get() === 90, 'duration value mismatch');
    events.expect();
  }),
  componentCase('Table', () => new zx.Table(null, {
    columns: [{ id: 'id', label: 'ID', sortable: true }, { id: 'name', label: 'Name' }],
    data: [{ id: 1, name: 'One' }], rowId: 'id', selectable: 'single'
  }), (component) => {
    const events = observe(component, 'datachange');
    component.setData([{ id: 2, name: 'Two' }]).setSelection([2]).setSort('id', 'desc');
    assert(component.getData()[0].id === 2 && component.getSelection()[0].id === 2, 'table data/selection mismatch');
    events.expect();
  }),
  componentCase('DataFilter', () => new zx.DataFilter(null, {
    filters: [{ type: 'text', id: 'query', label: 'Search', fields: ['name'] }],
    data: [{ name: 'Alpha' }, { name: 'Beta' }]
  }), (component) => {
    const events = observe(component, 'filter');
    component.setState({ query: 'alp' });
    assert(component.apply().length === 1, 'filter result mismatch');
    events.expect();
  }),
  componentCase('Field', () => new zx.Field(null, { id: 'name', type: 'text', label: 'Name' }), (component) => {
    const events = observe(component, 'change');
    component.setValue('Ada');
    assert(component.getValue() === 'Ada', 'field value mismatch');
    events.expect();
  }),
  componentCase('Fieldset', () => new zx.Fieldset(null, {
    fields: { name: { type: 'text', label: 'Name' } }
  }), (component) => {
    component.setValue('name', 'Ada');
    assert(component.getValue('name') === 'Ada', 'fieldset value mismatch');
  }),
  componentCase('Form', () => new zx.Form(null, {
    fieldsets: [{ fields: { name: { type: 'text', label: 'Name' } } }]
  }), (component) => {
    component.setValue('name', 'Ada');
    assert(component.getValues().name === 'Ada' && component.submit(), 'form value/submit mismatch');
  }),
  componentCase('ValueList', () => new zx.ValueList(null, { values: ['one'] }), (component) => {
    const events = observe(component, 'change');
    component.setValues(['two']);
    assert(component.getValues()[0] === 'two', 'value list mismatch');
    events.expect();
  }),
  componentCase('MultiValueEditor', () => new zx.MultiValueEditor(null, { values: ['one'] }), (component) => {
    const events = observe(component, 'change');
    component.setValues(['two', 'three']);
    assert(component.getValues().length === 2, 'multi-value editor mismatch');
    events.expect();
  }),
  componentCase('FieldUpload', () => new zx.FieldUpload(null, { autoUpload: false, preview: false }), (component) => {
    component.setDisabled(true).clear().setDisabled(false);
    assert(component.el.dataset.disabled === 'false', 'disabled state mismatch');
  }),
  customElementsCase()
];

auditCoverage(cases);
const results = [];
for (const definition of cases) results.push(await runCase(definition));
await nextFrame();
if (runtimeErrors.length) {
  results.push({
    component: 'Window errors', create: false, exercise: false, destroy: false, recreate: false,
    error: runtimeErrors.join('\n')
  });
}
render(results);

/** @param {string} name @param {() => zx.Component} create @param {(component: any) => unknown} exercise @returns {SmokeDefinition} */
function componentCase(name, create, exercise) {
  return {
    name,
    create(fixture) {
      const component = create();
      assert(component instanceof zx.Component, `${name} did not create a Component`);
      fixture.append(component.toElement());
      return { component };
    },
    exercise: ({ component }) => exercise(component),
    destroy: ({ component }) => component.destroy()
  };
}

/** @param {string} name @param {() => {element: Element, exercise: () => unknown}} create @returns {SmokeDefinition} */
function artifactCase(name, create) {
  return {
    name,
    create(fixture) {
      const artifact = create();
      fixture.append(artifact.element);
      return artifact;
    },
    exercise: (artifact) => artifact.exercise(),
    destroy: (artifact) => artifact.element.remove()
  };
}

/** @returns {SmokeDefinition} */
function dropdownCase() {
  return {
    name: 'Dropdown',
    create(fixture) {
      const anchor = zx.button({ label: 'Open' });
      fixture.append(anchor);
      const component = new zx.Dropdown(anchor, { content: 'Menu', openOn: 'manual' });
      fixture.append(component.toElement());
      return { component, anchor };
    },
    exercise({ component }) {
      const events = observe(component, 'open');
      component.open();
      assert(component.isOpen(), 'open failed');
      events.expect();
      component.close();
    },
    destroy({ component, anchor }) {
      component.destroy();
      anchor.remove();
    }
  };
}

/** @returns {SmokeDefinition} */
function customElementsCase() {
  zx.defineElements('zx-smoke');
  return {
    name: 'defineElements()',
    create(fixture) {
      const element = document.createElement('zx-smoke-toggle');
      element.setAttribute('label', 'Custom toggle');
      fixture.append(element);
      assert(element.component instanceof zx.Toggle, 'backing component missing');
      return { element };
    },
    exercise({ element }) {
      element.checked = true;
      assert(element.component.get() === true, 'property reflection failed');
    },
    destroy({ element }) {
      const root = element.component.el;
      element.remove();
      assert(element.component === null && zx.Component.from(root) === null, 'disconnect cleanup failed');
    }
  };
}

/** @param {SmokeDefinition} definition @returns {Promise<SmokeResult>} */
async function runCase(definition) {
  const result = { component: definition.name, create: false, exercise: false, destroy: false, recreate: false, error: '' };
  const errors = [];
  const firstFixture = fixture();
  let first = null;
  try {
    first = definition.create(firstFixture);
    result.create = true;
  } catch (error) {
    errors.push(`create: ${message(error)}`);
  }
  if (first) {
    try {
      await definition.exercise(first);
      result.exercise = true;
    } catch (error) {
      errors.push(`exercise: ${message(error)}`);
    }
    try {
      await definition.destroy(first);
      await Promise.resolve();
      assertEmpty(firstFixture);
      result.destroy = true;
    } catch (error) {
      errors.push(`destroy: ${message(error)}`);
    }
  }
  firstFixture.remove();

  const secondFixture = fixture();
  let second = null;
  try {
    second = definition.create(secondFixture);
    await definition.destroy(second);
    await Promise.resolve();
    assertEmpty(secondFixture);
    result.recreate = true;
  } catch (error) {
    errors.push(`re-create: ${message(error)}`);
    try { if (second) await definition.destroy(second); } catch { /* Original failure is reported. */ }
  }
  secondFixture.remove();
  result.error = errors.join('\n');
  return result;
}

/** @param {SmokeResult[]} results @returns {void} */
function render(results) {
  const passed = results.filter((result) => result.create && result.exercise && result.destroy && result.recreate).length;
  const failed = results.length - passed;
  const rows = results.map((result) => {
    const row = document.createElement('tr');
    row.append(cell(result.component));
    for (const phase of ['create', 'exercise', 'destroy', 'recreate']) row.append(statusCell(result[phase]));
    const details = cell(result.error || '—');
    details.className = 'smoke-error';
    row.append(details);
    return row;
  });
  resultBody.replaceChildren(...rows);
  summary.textContent = failed === 0 ? `PASS — ${passed} component surfaces passed` : `FAIL — ${passed} passed, ${failed} failed`;
  summary.dataset.state = failed === 0 ? 'pass' : 'fail';
  window.__zxSmoke = { passed, failed, results };
}

/** @param {zx.Component} component @param {string} type @returns {{expect: () => void}} */
function observe(component, type) {
  let componentCount = 0;
  let domCount = 0;
  component.on(type, () => { componentCount += 1; });
  component.el.addEventListener(`zx-${type}`, () => { domCount += 1; });
  return { expect: () => assert(componentCount > 0 && domCount > 0, `${type} emit path failed`) };
}

/** @param {SmokeDefinition[]} definitions @returns {void} */
function auditCoverage(definitions) {
  const names = new Set(definitions.map((definition) => definition.name.replace(/\(\)$/, '')));
  for (const [name, value] of Object.entries(zx)) {
    if (name === 'Component' || typeof value !== 'function') continue;
    if (value.prototype instanceof zx.Component) assert(names.has(name), `Missing smoke case for exported component ${name}`);
  }
  for (const name of ['button', 'buttonGroup', 'DateTimeBox', 'defineElements']) {
    assert(names.has(name), `Missing smoke case for exported component surface ${name}`);
  }
}

/** @returns {HTMLElement} */
function fixture() {
  const element = document.createElement('div');
  fixtures.append(element);
  return element;
}

/** @param {Element} element @returns {void} */
function assertEmpty(element) {
  assert(element.childNodes.length === 0, `container retained ${element.childNodes.length} child node(s)`);
}

/** @param {unknown} condition @param {string} reason @returns {asserts condition} */
function assert(condition, reason) {
  if (!condition) throw new Error(reason);
}

/** @param {unknown} value @returns {string} */
function message(value) {
  return value instanceof Error ? `${value.name}: ${value.message}` : String(value);
}

/** @param {unknown} value @returns {HTMLTableCellElement} */
function cell(value) {
  const element = document.createElement('td');
  element.textContent = String(value);
  return element;
}

/** @param {boolean} passed @returns {HTMLTableCellElement} */
function statusCell(passed) {
  const element = cell(passed ? 'PASS' : 'FAIL');
  element.dataset.state = passed ? 'pass' : 'fail';
  return element;
}

/** @param {number} milliseconds @returns {Promise<void>} */
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** @returns {Promise<void>} */
function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** @returns {Array<{ID: number, name: string}>} */
function sampleItems() {
  return [{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }];
}

/** @returns {Array<Record<string, unknown>>} */
function tabDefinitions() {
  return [
    { name: 'one', title: 'One', content: document.createTextNode('One') },
    { name: 'two', title: 'Two', content: document.createTextNode('Two') }
  ];
}

/** @returns {Array<Record<string, unknown>>} */
function navigationItems() {
  return [
    { name: 'one', title: 'One', content: document.createTextNode('One') },
    { name: 'two', title: 'Two', content: document.createTextNode('Two') }
  ];
}

/** @param {number} day @returns {Date} */
function date(day) {
  return new Date(2026, 6, day, 9, 30);
}

/**
 * @typedef {Object} SmokeDefinition
 * @property {string} name
 * @property {(fixture: HTMLElement) => any} create
 * @property {(context: any) => unknown} exercise
 * @property {(context: any) => unknown} destroy
 */

/**
 * @typedef {Object} SmokeResult
 * @property {string} component
 * @property {boolean} create
 * @property {boolean} exercise
 * @property {boolean} destroy
 * @property {boolean} recreate
 * @property {string} error
 */
