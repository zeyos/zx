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
  componentCase('Tabbox', () => new zx.Tabbox(null, {
    tabs: [...tabDefinitions(), { name: 'three', title: 'Three', closable: true, content: document.createTextNode('Three') }]
  }), (component) => {
    const events = observe(component, 'change');
    component.openTab('two');
    assert(component.getActive() === 'two', 'active tab mismatch');
    events.expect();
    const closes = observe(component, 'close');
    component.el.querySelector('[data-closable] .zx-tabbox__close').click();
    assert(!component.el.querySelector('[data-closable]'), 'close control did not remove the tab');
    closes.expect();
  }),
  componentCase('NavigationBar', () => new zx.NavigationBar(null, {
    title: 'App',
    items: navigationItems()
  }), (component) => {
    const events = observe(component, 'change');
    component.setActive('two').setBadge('two', '2');
    events.expect();
  }),
  componentCase('Toolbar', () => new zx.Toolbar(null, {
    items: [{ name: 'save', label: 'Save' }, { name: 'remove', label: 'Delete' }]
  }), (component) => {
    const events = observe(component, 'action');
    component.el.querySelector('button').click();
    events.expect();
    component.disable('save').enable('save').setActive('remove', true);
  }),
  componentCase('Stepper', () => new zx.Stepper(null, {
    steps: [{ name: 'one', title: 'One' }, { name: 'two', title: 'Two' }]
  }), (component) => {
    const events = observe(component, 'change');
    component.next();
    assert(component.getActive() === 'two', 'step advance failed');
    events.expect();
    component.previous();
  }),
  componentCase('Breadcrumb', () => new zx.Breadcrumb(null, {
    items: [{ name: 'root', label: 'Root' }, { name: 'child', label: 'Child' }]
  }), (component) => {
    component.push({ name: 'leaf', label: 'Leaf' });
    assert(component.getItems().length === 3, 'push failed');
    component.pop();
    component.truncateTo('root');
    assert(component.getItems().length === 1, 'truncateTo failed');
  }),
  splitViewCase(),
  componentCase('Search', () => new zx.Search(null, { debounce: 0 }), async (component) => {
    const events = observe(component, 'input');
    component.set('needle');
    await delay(0);
    assert(component.get() === 'needle', 'set/get mismatch');
    events.expect();
  }),
  componentCase('Message', () => new zx.Message(null, { timeout: 0 }), (component) => {
    const handle = component.show('Ready', { timeout: 0 });
    assert(component.el.querySelector('.zx-message__toast'), 'message was not rendered');
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
  tooltipCase(),
  contextMenuCase(),
  componentCase('Select', () => new zx.Select(null, { items: sampleItems(), value: 1 }), (component) => {
    const events = observe(component, 'change');
    component.set(2).open().close();
    assert(component.value === 2 && component.selected.name === 'Two', 'selection mismatch');
    events.expect();
  }),
  componentCase('Select (fixed items)', () => zx.Select.permission(null, {
    groups: sampleItems(), value: false
  }), (component) => {
    const events = observe(component, 'change');
    assert(component.value === false, 'permission preset did not start private');
    component.open();
    const labels = [...component.refs.list.querySelectorAll('.zx-select__option')]
      .map((option) => option.textContent.trim());
    assert(labels[0] === 'Private' && labels[1] === 'Public', `pinned choices missing: ${labels}`);
    assert(component.refs.list.querySelector('.zx-select__separator'), 'section rule missing');
    component.close();
    component.set(2);
    assert(component.value === 2, 'group selection mismatch');
    // What an async filter does on every query: the item list is replaced under the selection.
    component.setItems([]);
    component.set(true);
    assert(component.value === true, 'a pinned value stopped resolving after setItems');
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
  componentCase('NumberField', () => new zx.NumberField(null, { value: 5, min: 0, max: 10 }), (component) => {
    const events = observe(component, 'change');
    component.stepUp();
    assert(component.get() === 6, 'stepUp mismatch');
    events.expect();
    component.setRange(0, 20).set(15);
    assert(component.get() === 15, 'setRange mismatch');
  }),
  componentCase('Rating', () => new zx.Rating(null, { value: 3 }), (component) => {
    const events = observe(component, 'change');
    component.set(4);
    assert(component.get() === 4, 'rating value mismatch');
    events.expect();
    component.clear();
    assert(component.get() === 0, 'clear failed');
  }),
  componentCase('Slider', () => new zx.Slider(null, { label: 'Share', value: 20, step: 5 }), (component) => {
    const events = observe(component, 'change');
    component.set(45);
    assert(component.get() === 45, 'slider value mismatch');
    events.expect();
    component.setRange(0, 200, 10).set(123);
    assert(component.get() === 120, 'setRange snap mismatch');
    component.setReadonly(true);
    component.setReadonly(false);
  }),
  componentCase('TagPicker', () => new zx.TagPicker(null, { items: sampleItems(), values: [1] }), (component) => {
    const events = observe(component, 'change');
    component.addValue(2);
    assert(component.values.length === 2, 'addValue failed');
    events.expect();
    component.removeValue(2).clear();
    assert(component.values.length === 0, 'clear failed');
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
  componentCase('DateRangePicker', () => new zx.DateRangePicker(null, {
    start: date(10), end: date(14)
  }), (component) => {
    const events = observe(component, 'change');
    component.set({ start: date(11), end: date(15) });
    assert(component.get().start.getDate() === 11, 'range start mismatch');
    events.expect();
    component.clear();
    assert(component.get().start === null, 'clear failed');
  }),
  componentCase('DateRangeBox', () => new zx.DateRangeBox(null, {
    start: date(10), end: date(14)
  }), (component) => {
    const events = observe(component, 'change');
    component.set({ start: date(11), end: date(15) });
    assert(component.get().end.getDate() === 15, 'range end mismatch');
    events.expect();
    component.open();
    component.close();
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
  componentCase('Pagination', () => new zx.Pagination(null, { total: 100, page: 1, pageSize: 25 }), (component) => {
    const events = observe(component, 'change');
    component.setState({ page: 3 });
    assert(component.getState().page === 3, 'page state mismatch');
    events.expect();
    component.setTotal(10);
    assert(component.getState().page === 1, 'total change did not re-clamp the page');
  }),
  componentCase('TreeView', () => new zx.TreeView(null, {
    items: [{ ID: 1, name: 'One', children: [{ ID: 2, name: 'Two' }] }]
  }), async (component) => {
    const events = observe(component, 'select');
    await component.expand(1);
    component.select(2);
    assert(component.getSelection().length === 1, 'selection mismatch');
    events.expect();
    component.collapse(1);
  }),
  componentCase('Finder', () => new zx.Finder(null, {
    items: [{ ID: 1, name: 'One', children: [{ ID: 2, name: 'Two' }] }]
  }), async (component) => {
    await component.setPath([1, 2]);
    assert(component.getSelection()?.ID === 2, 'path selection mismatch');
    assert(component.getNodes().length === 2, 'node chain mismatch');
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
  componentCase('ProgressBar', () => new zx.ProgressBar(null, { label: 'Upload', value: 10 }), (component) => {
    const events = observe(component, 'change');
    component.set(50);
    assert(component.get() === 50 && component.percent() === 50, 'progress value mismatch');
    events.expect();
    component.setStatus('error', 'Failed').setIndeterminate(true).setIndeterminate(false);
    component.set(999);
    assert(component.get() === 100, 'clamp to max failed');
  }),
  componentCase('InlineLoading', () => new zx.InlineLoading(null, {
    status: 'active', description: 'Saving…'
  }), (component) => {
    const events = observe(component, 'statuschange');
    component.set('success', 'Saved');
    assert(component.get() === 'success' && component.getDescription() === 'Saved', 'status mismatch');
    events.expect();
    component.setDescription('Saved just now');
  }),
  componentCase('CopyInput', () => new zx.CopyInput(null, {
    label: 'Endpoint', value: 'https://example.com/x'
  }), (component) => {
    component.set('https://example.com/y');
    assert(component.get() === 'https://example.com/y', 'value mismatch');
    component.focus();
  }),
  artifactCase('spinner()', () => {
    const element = zx.spinner({ label: 'Loading' });
    return { element, exercise: () => assert(element.getAttribute('role') === 'status', 'spinner is not announced') };
  }),
  artifactCase('skeleton()', () => {
    const element = document.createElement('div');
    element.append(zx.skeleton({ width: 80 }), zx.skeletonText({ lines: 2 }), zx.skeletonTable({ rows: 2, columns: 3 }));
    return {
      element,
      // Only the three roots are checked: `querySelectorAll` would also count the blocks inside them.
      exercise: () => assert([...element.children].every((child) => child.getAttribute('aria-hidden') === 'true'),
        'skeletons are not hidden from assistive technology')
    };
  }),
  artifactCase('stack()', () => {
    const element = zx.stack({ direction: 'row', gap: 2 },
      zx.grid({ columns: 2, min: 40 }, document.createElement('span')),
      zx.aspect({ ratio: '4 / 3' }, document.createElement('span')));
    return {
      element,
      exercise: () => assert(element.querySelector('.zx-grid') && element.querySelector('.zx-aspect'), 'layout children missing')
    };
  }),
  artifactCase('copyButton()', () => {
    const element = zx.copyButton({ text: 'INV-1042' });
    return { element, exercise: () => assert(element.getAttribute('aria-label') === 'Copy', 'copy button is unnamed') };
  }),
  artifactCase('badge()', () => {
    const element = zx.badgeGroup([zx.badge({ label: 'Draft' }), zx.badge({ label: 'Posted', kind: 'success' })]);
    return { element, exercise: () => assert(element.children.length === 2, 'badge group contents missing') };
  }),
  artifactCase('emptyState()', () => {
    const element = zx.emptyState({ title: 'Nothing here', actions: [{ label: 'Add' }] });
    return { element, exercise: () => assert(element.querySelector('button'), 'empty-state action missing') };
  }),
  tableStackingCase(),
  tableGrowingCase(),
  truncateCase(),
  sizeContainerCase(),
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
function splitViewCase() {
  return {
    name: 'SplitView',
    create(fixture) {
      // The divider is positioned against a real box, so the target needs a height of its own.
      const stage = document.createElement('div');
      stage.style.blockSize = '160px';
      fixture.append(stage);
      const component = new zx.SplitView(stage, {
        start: document.createElement('div'),
        end: document.createElement('div'),
        size: '40%',
        collapsible: 'start'
      });
      return { component, stage };
    },
    exercise({ component }) {
      const events = observe(component, 'collapse');
      component.collapse('start');
      events.expect();
      component.expand();
      assert(component.getRatio() > 0, 'ratio unavailable after expand');
      component.disable();
      assert(component.isDisabled(), 'disable failed');
      component.enable();
    },
    destroy({ component, stage }) {
      component.destroy();
      stage.remove();
    }
  };
}

/** @returns {SmokeDefinition} */
function tooltipCase() {
  return {
    name: 'Tooltip',
    create(fixture) {
      const anchor = zx.button({ label: 'Hover me' });
      fixture.append(anchor);
      const component = new zx.Tooltip(anchor, { content: 'Explains the button', delay: 0 });
      return { component, anchor };
    },
    exercise({ component, anchor }) {
      const events = observe(component, 'open');
      component.show();
      assert(component.isOpen(), 'show failed');
      events.expect();
      component.setContent('Updated');
      component.hide();
      assert(!component.isOpen(), 'hide failed');
      component.disable();
      assert(component.isDisabled(), 'disable failed');
      component.enable();
      assert(component.getAnchor() === anchor, 'anchor mismatch');
    },
    destroy({ component, anchor }) {
      component.destroy();
      anchor.remove();
    }
  };
}

/** @returns {SmokeDefinition} */
function contextMenuCase() {
  return {
    name: 'ContextMenu',
    create(fixture) {
      const region = document.createElement('div');
      region.tabIndex = 0;
      region.textContent = 'Right-click target';
      fixture.append(region);
      const component = new zx.ContextMenu(region, {
        items: [{ label: 'Open', value: 'open' }, '-', { label: 'Delete', value: 'delete', danger: true }]
      });
      return { component, region };
    },
    exercise({ component, region }) {
      const events = observe(component, 'open');
      component.openAt(20, 20, region);
      assert(component.isOpen(), 'openAt failed');
      assert(component.getContext() === region, 'context mismatch');
      events.expect();
      component.close();
      component.setItems([{ label: 'Only one', value: 'one' }]);
      component.openAtElement(region);
      assert(component.isOpen(), 'openAtElement failed');
      component.close();
    },
    destroy({ component, region }) {
      component.destroy();
      region.remove();
    }
  };
}

/**
 * Responsive stacking, which only a laid-out browser can prove: it is driven by a ResizeObserver,
 * and RO delivers during rendering steps — so this reports nothing at all in a hidden tab and has
 * to be verified here rather than in a devtools console.
 * @returns {SmokeDefinition}
 */
function tableStackingCase() {
  return {
    name: 'Table (responsive)',
    create(fixture) {
      const host = document.createElement('div');
      host.style.inlineSize = '900px';
      fixture.append(host);
      const component = new zx.Table(null, {
        responsive: 'md',
        columns: [
          { id: 'number', label: 'Invoice', popin: false },
          { id: 'customer', label: 'Customer' }
        ],
        data: [{ ID: 1, number: 'INV-1', customer: 'Nordwind' }]
      });
      host.append(component.toElement());
      return { component, host };
    },
    async exercise({ component, host }) {
      const settle = () => new Promise((done) => setTimeout(done, 120));
      await settle();
      assert(!component.isStacked(), 'stacked while there was room for the table');

      const events = observe(component, 'stackedchange');
      host.style.inlineSize = '420px';
      await settle();
      assert(component.isStacked(), 'did not stack in a narrow container');
      events.expect();

      const cell = component.el.querySelector('tbody td[data-label="Customer"]');
      assert(cell.getAttribute('role') === 'cell', 'stacked cells lost their table role');
      assert(component.el.querySelector('table').getAttribute('role') === 'table', 'stacked table lost its role');

      host.style.inlineSize = '900px';
      await settle();
      assert(!component.isStacked(), 'did not unstack when the room came back');
      assert(!component.el.querySelector('table').hasAttribute('role'), 'roles outlived stacked mode');
    },
    destroy({ component, host }) {
      component.destroy();
      host.remove();
    }
  };
}

/** @returns {SmokeDefinition} */
function tableGrowingCase() {
  return {
    name: 'Table (growing)',
    create(fixture) {
      const component = new zx.Table(null, {
        growing: 5,
        selectable: 'multi',
        columns: [{ id: 'a', label: 'A' }],
        data: Array.from({ length: 40 }, (_, index) => ({ ID: index, a: `row ${index}` }))
      });
      fixture.append(component.toElement());
      return { component };
    },
    exercise({ component }) {
      const rows = () => component.el.querySelectorAll('tbody tr[data-row]').length;
      const more = () => component.el.querySelector('.zx-table__more');
      assert(rows() === 5, `rendered ${rows()} rows instead of the first batch`);
      assert(more(), 'no control offering the remaining rows');

      const events = observe(component, 'grow');
      more().click();
      assert(rows() === 10, `growing rendered ${rows()} rows`);
      events.expect();

      component.showAll();
      assert(rows() === 40 && !more(), 'showAll did not render everything and retire the control');

      // A new result set is not the old one grown; the batch has to start over.
      component.setData(Array.from({ length: 12 }, (_, index) => ({ ID: index, a: 'x' })));
      assert(rows() === 5, `setData left ${rows()} rows rendered instead of resetting the batch`);

      // Select-all means the rows on screen. Selecting the seven behind the control because
      // someone ticked a box above the five they can see is how bulk actions go wrong.
      const selectAll = component.el.querySelector('thead input[type="checkbox"]');
      selectAll.click();
      assert(component.getSelection().length === 5,
        `select-all took ${component.getSelection().length} rows for 5 rendered`);
      selectAll.click();
      assert(component.getSelection().length === 0, 'clearing select-all left rows selected');

      // Only a prefix of the data is in the DOM, so the row numbers have to say so.
      const table = component.el.querySelector('table');
      assert(table.getAttribute('aria-rowcount') === '13',
        `aria-rowcount is ${table.getAttribute('aria-rowcount')} for 12 rows plus a header`);
      assert(component.el.querySelector('tbody tr[data-row]').getAttribute('aria-rowindex') === '2',
        'the first body row does not follow the header row');
    },
    destroy({ component }) {
      component.destroy();
    }
  };
}

/**
 * A form in a host that sizes to its contents.
 *
 * `tests/unit/size-containers.test.js` keeps every `container-type` rule honest about its own
 * width, but containment travels: a size container contributes nothing to its *ancestors*'
 * intrinsic width either, so a form shrink-wrapped to its action buttons while the fieldset inside
 * it spilled out sideways. Only a real layout can show that, so it is checked here.
 *
 * @returns {SmokeDefinition}
 */
function sizeContainerCase() {
  return {
    name: 'Form (in a flex row)',
    create(fixture) {
      const host = document.createElement('div');
      host.style.cssText = 'display: flex; align-items: center; inline-size: 640px';
      fixture.append(host);
      const component = new zx.Form(null, {
        fieldsets: [{ title: 'Details', columns: 2, fields: { name: { type: 'text', label: 'Name' } } }],
        actions: [{ label: 'Save', type: 'submit' }]
      });
      host.append(component.toElement());
      return { component, host };
    },
    exercise({ component, host }) {
      const width = (selector) => component.el.querySelector(selector)?.getBoundingClientRect().width ?? 0;
      assert(component.el.getBoundingClientRect().width > 600, 'the form shrank away from its host');
      assert(width('.zx-fieldset') > 600, 'the fieldset collapsed instead of filling the form');
      assert(width('.zx-field') > 0 && host.scrollWidth <= host.clientWidth + 1, 'the form spilled out of its host');
    },
    destroy({ component, host }) {
      component.destroy();
      host.remove();
    }
  };
}

/** @returns {SmokeDefinition} */
function truncateCase() {
  return {
    name: 'truncate()',
    create(fixture) {
      const element = document.createElement('div');
      element.style.inlineSize = '60px';
      element.textContent = 'A value far too long for sixty pixels of column';
      fixture.append(element);
      return { element, controller: zx.truncate(element, { lines: 2 }) };
    },
    exercise({ element, controller }) {
      assert(element.classList.contains('zx-truncate'), 'class not applied');
      // Asserting agreement rather than a fixed outcome: the page may be laid out at any width.
      assert(controller.update() === zx.isTruncated(element), 'state disagrees with the measurement');
    },
    destroy({ element, controller }) {
      controller.destroy();
      assert(!element.classList.contains('zx-truncate'), 'class not removed');
      assert(!element.hasAttribute('title'), 'title not removed');
      element.remove();
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
  for (const name of [
    'button', 'buttonGroup', 'badge', 'emptyState', 'DateTimeBox', 'defineElements',
    'spinner', 'skeleton', 'stack', 'copyButton', 'truncate'
  ]) {
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
  // rAF is throttled to a standstill in hidden/backgrounded tabs — race a timeout
  // so headless/automated runs always finish rendering the report.
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    setTimeout(resolve, 200);
  });
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
