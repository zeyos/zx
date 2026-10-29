import * as zx from '../../src/index.js';
import * as zeyos from '../../src/zeyos/index.js';

const runtimeErrors = window.__zxSmokeErrors;
const resultBody = document.querySelector('#results');
const summary = document.querySelector('#summary');
const fixtures = document.querySelector('#fixtures');
const resourceAudit = installResourceAudit();

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
  componentCase('Card', () => new zx.Card(null, {
    title: 'Account',
    link: '#account',
    content: 'Account summary',
    footer: 'Updated today',
    actions: [{ label: 'Edit', size: 'sm' }]
  }), (component) => {
    assert(component.el.localName === 'article', 'owned Card root is not an article');
    const primary = component.el.querySelector('.zx-card__primary');
    const action = component.el.querySelector('.zx-card__actions button');
    assert(primary?.localName === 'a', 'Card primary action is not a native anchor');
    assert(action && !primary.contains(action), 'Card secondary action is nested in its link');
    component.setLink(null);
    assert(!component.el.querySelector('.zx-card__primary'), 'setLink(null) kept the link');
    component.setTitle('Updated account').setLink({ href: '#updated', target: '_blank' });
    assert(component.el.querySelector('.zx-card__primary').rel.includes('noopener'),
      'blank Card link omitted safe rel');
    let rejectedUnsafeLink = false;
    try { component.setLink('java\nscript:alert(1)'); } catch { rejectedUnsafeLink = true; }
    assert(rejectedUnsafeLink, 'Card accepted a control-obfuscated javascript URL');
    let staleLinkClicks = 0;
    component.setLink({ href: '#old', onclick: () => { staleLinkClicks += 1; } });
    const oldLink = component.el.querySelector('.zx-card__primary');
    oldLink.addEventListener('click', (event) => event.preventDefault());
    component.setLink('#new');
    oldLink.click();
    assert(staleLinkClicks === 0, 'a replaced Card link retained its old callback');
    let staleActionClicks = 0;
    component.setActions([{ label: 'Old action', onclick: () => { staleActionClicks += 1; } }]);
    const oldAction = component.el.querySelector('.zx-card__actions button');
    component.setActions([{ label: 'New action' }]);
    oldAction.click();
    assert(staleActionClicks === 0, 'a replaced Card action retained its old callback');
    const savedStyle = component.el.getAttribute('style');
    Object.assign(component.el.style, {
      position: 'fixed', inset: '8px auto auto 8px', width: '320px', zIndex: '2147483647',
      pointerEvents: 'auto'
    });
    const primaryLink = component.el.querySelector('.zx-card__primary');
    const contentRect = component.refs.content.getBoundingClientRect();
    const contentHit = document.elementFromPoint(contentRect.right - 4, contentRect.top + contentRect.height / 2);
    assert(contentHit === primaryLink, 'Card primary link did not cover empty body space');
    const actionRect = component.el.querySelector('.zx-card__actions button').getBoundingClientRect();
    const actionHit = document.elementFromPoint(actionRect.left + actionRect.width / 2,
      actionRect.top + actionRect.height / 2);
    assert(actionHit?.closest('.zx-card__actions button'), 'Card primary link covered a secondary action');
    if (savedStyle === null) component.el.removeAttribute('style');
    else component.el.setAttribute('style', savedStyle);
  }),
  componentCase('Aurora', () => new zx.Aurora(null, {
    preset: 'source',
    colors: ['#21cc75', '#2b7fff', '#9a67ff', '#ffb900'],
    intensity: 'balanced'
  }), (component) => {
    component.el.append(document.createTextNode('Application content'));
    component.setPreset('horizon').setColors(['#ff6f54', '#ffb900']).setIntensity('vivid');
    assert(component.el.dataset.preset === 'horizon', 'Aurora preset did not update');
    assert(component.el.dataset.intensity === 'vivid', 'Aurora intensity did not update');
    assert(component.el.textContent === 'Application content', 'Aurora replaced application content');
    assert(component.el.style.getPropertyValue('--zx-aurora-color-3') === '#ff6f54',
      'two-colour Aurora palette did not repeat across four fields');

    const target = document.createElement('section');
    target.className = 'existing-surface';
    target.style.padding = '7px';
    target.append(document.createTextNode('Preserved child'));
    const before = target.outerHTML;
    fixtures.append(target);
    const enhanced = new zx.Aurora(target, {
      preset: 'edge', colors: ['#21cc75', '#2b7fff', '#9a67ff'], intensity: 'subtle'
    });
    enhanced.setPreset('curtain').destroy();
    assert(target.outerHTML === before, `Aurora did not restore its target: ${target.outerHTML}`);
    target.remove();
  }),
  componentCase('AppIcon', () => new zx.AppIcon(null, {
    icon: 'file', color: '#535494', label: 'Billing', badge: 3, glass: 'strong', shape: 'circle'
  }), (component) => {
    assert(component.el.getAttribute('role') === 'img', 'labelled AppIcon has no image role');
    assert(component.el.dataset.glass === 'strong', 'AppIcon material did not render');
    assert(component.el.dataset.shape === 'circle', 'AppIcon circle shape did not render');
    assert(component.el.querySelector('.zx-app-icon__badge')?.textContent === '3', 'AppIcon badge missing');
    component.set({ selected: true, size: 40, badge: null });
    assert(component.el.hasAttribute('data-selected'), 'AppIcon selected state did not update');
    assert(component.el.style.getPropertyValue('--zx-app-icon-size') === '40px', 'AppIcon size did not update');
    component.set({ color: 'url(https://example.invalid/app-icon)' });
    assert(component.el.style.getPropertyValue('--zx-app-icon-color') === '', 'AppIcon accepted a non-colour image value');
    component.set({ label: null });
    assert(component.el.getAttribute('aria-hidden') === 'true' && !component.el.hasAttribute('role')
      && !component.el.hasAttribute('aria-label'), 'decorative AppIcon retained image semantics');
  }),
  artifactCase('AppIcon (ZeyOS preset)', () => {
    const element = zeyos.zeyosAppIcon('billing', {
      color: 'url(https://example.invalid/module)', badge: 3, selected: true
    });
    return { element, exercise: () => {
      const color = element.style.getPropertyValue('--zx-module-color');
      assert(/^#[\da-f]{6}$/i.test(color) && !color.includes('url('), 'ZeyOS AppIcon retained an unsafe color override');
      assert(element.style.getPropertyValue('--zx-app-icon-glyph') === 'var(--zx-color-app-icon-glyph)',
        'ZeyOS AppIcon did not use the stable white glyph token');
      assert(element.dataset.shape === 'circle', 'ZeyOS AppIcon did not use its application circle');
      assert(element.hasAttribute('data-selected')
        && element.querySelector('.zx-app-icon__badge')?.textContent === '3',
      'ZeyOS AppIcon did not forward state');
      const compact = zeyos.moduleChip('billing');
      assert(compact.dataset.shape === 'tile', 'compact module chip lost its tile default');
      const rootRect = element.getBoundingClientRect();
      const glyphRect = element.querySelector('.zx-app-icon__glyph').getBoundingClientRect();
      const deltaX = Math.abs((rootRect.left + rootRect.width / 2) - (glyphRect.left + glyphRect.width / 2));
      const deltaY = Math.abs((rootRect.top + rootRect.height / 2) - (glyphRect.top + glyphRect.height / 2));
      assert(deltaX < 0.6 && deltaY < 0.6, `ZeyOS AppIcon glyph is off-centre by ${deltaX}, ${deltaY}`);
    } };
  }),
  artifactCase('AppIcon (enhanced button semantics)', () => {
    const element = document.createElement('button');
    element.type = 'button';
    element.setAttribute('aria-label', 'Original action');
    const before = element.outerHTML;
    const component = new zx.AppIcon(element, { icon: 'file', label: 'Billing action' });
    return { element, exercise: () => {
      assert(element.localName === 'button' && !element.hasAttribute('role'),
        'enhanced AppIcon replaced native button semantics');
      assert(element.getAttribute('aria-label') === 'Billing action' && !element.hasAttribute('aria-hidden'),
        'enhanced AppIcon lost its accessible button name');
      component.set({ label: null });
      assert(element.getAttribute('aria-label') === 'Original action' && !element.hasAttribute('aria-hidden'),
        'enhanced AppIcon did not restore the original button label');
      component.destroy();
      assert(element.outerHTML === before, 'enhanced AppIcon did not restore its button');
    } };
  }),
  cardTargetCase(),
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
  dockCase(),
  adoptionCase(),
  componentCase('Search', () => new zx.Search(null, { debounce: 0 }), async (component) => {
    const events = observe(component, 'input');
    component.set('needle');
    await delay(0);
    assert(component.get() === 'needle', 'set/get mismatch');
    events.expect();
  }),
  componentCase('Launcher', () => new zx.Launcher(null, {
    debounce: 0,
    items: [{ id: 'invoices', label: 'Invoices', icon: 'search' }],
    sources: [{
      id: 'records',
      label: 'Records',
      load: (query, { signal }) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve([{ id: query, label: `Result ${query}` }]), query === 'old' ? 30 : 0);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      })
    }]
  }), async (component) => {
    component.open().setQuery('old');
    await delay(0);
    component.setQuery('current');
    await delay(40);
    assert(component.isOpen(), 'launcher did not open');
    assert(component.el.querySelectorAll('[role="option"]').length === 1, 'async launcher result missing');
    assert(component.el.querySelector('[role="option"]').textContent.includes('Result current'),
      'stale launcher source replaced the current query');
    component.refs.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    assert(component.isOpen(), 'Tab closed the native modal launcher');
    component.close();
  }),
  componentCase('Launcher (async selection stability)', () => new zx.Launcher(null, {
    debounce: 0,
    items: [
      { id: 'alpha', label: 'Alpha', kind: 'application' },
      { id: 'beta', label: 'Beta', kind: 'application' }
    ],
    sources: [{
      id: 'records',
      label: 'Records',
      load: () => new Promise((resolve) => setTimeout(() => resolve([
        { id: 'remote', label: 'Remote result', kind: 'record' }
      ]), 20))
    }]
  }), async (component) => {
    component.open();
    await delay(0);
    component.refs.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    assert(component._results[component._active]?.id === 'beta', 'launcher did not move to Beta');
    await delay(30);
    assert(component._results[component._active]?.id === 'beta',
      'late launcher results replaced the keyboard-selected item');
    component.setQuery('a');
    assert(component._results[component._active]?.id === 'alpha',
      'a new launcher query retained the previous query selection');
    component.close();
  }),
  componentCase('Launcher (safe destinations)', () => new zx.Launcher(null, {
    debounce: 0,
    items: [{
      id: 'unsafe-local',
      label: 'Unsafe local',
      href: 'java\nscript:globalThis.__zxUnsafeNavigationAudit=1'
    }],
    sources: [{
      id: 'unsafe-source',
      minQuery: 1,
      load: () => [{
        id: 'unsafe-remote',
        label: 'Unsafe remote',
        href: 'javascript:globalThis.__zxUnsafeNavigationAudit=2'
      }]
    }]
  }), async (component) => {
    globalThis.__zxUnsafeNavigationAudit = 0;
    component.open();
    const local = component.el.querySelector('[data-launcher-index="0"]');
    assert(local.localName === 'button' && local.getAttribute('aria-disabled') === 'true',
      'launcher rendered an unsafe local destination as an enabled anchor');
    local.click();
    component.setQuery('unsafe remote');
    await delay(10);
    const remote = component.el.querySelector('[data-launcher-index="0"]');
    assert(remote.localName === 'button' && remote.getAttribute('aria-disabled') === 'true',
      'launcher rendered an unsafe source destination as an enabled anchor');
    remote.click();
    assert(globalThis.__zxUnsafeNavigationAudit === 0, 'launcher executed an unsafe destination');
    delete globalThis.__zxUnsafeNavigationAudit;
    component.close();
  }),
  launcherTargetCase(),
  componentCase('Avatar', () => new zx.Avatar(null, {
    name: 'Ada Lovelace', label: 'Ada Lovelace', status: 'online', statusLabel: 'Online'
  }), (component) => {
    assert(component.refs.fallback.textContent === 'AL', 'avatar initials missing');
    assert(component.el.getAttribute('aria-label') === 'Ada Lovelace, Online', 'avatar presence text is not accessible');
    component.set({ name: 'Grace Hopper', label: 'Grace Hopper', src: null }).setStatus('away', 'Away');
    assert(component.refs.fallback.textContent === 'GH' && !component.hasImage(), 'avatar update failed');
    assert(component.el.getAttribute('aria-label') === 'Grace Hopper, Away', 'setStatus did not update the avatar name');
  }),
  componentCase('EntityRef', () => new zx.EntityRef(null, {
    id: 'customer-7',
    title: 'Northwind GmbH',
    subtitle: 'Customer',
    icon: 'folder',
    metadata: [{ label: 'Owner', value: 'Ada Lovelace' }],
    link: { href: '#northwind', target: '_blank' },
    actions: [{ id: 'more', title: 'More actions', icon: 'dots' }]
  }), (component) => {
    assert(component.el.querySelector('.zx-entity-ref__primary')?.rel.includes('noopener'),
      'EntityRef blank link omitted noopener');
    const actions = observe(component, 'action');
    component.el.querySelector('[data-entity-action]').click();
    actions.expect();
    component.set({ title: 'Northwind Europe', wrap: true, size: 'lg' })
      .setMetadata([{ label: 'Region', value: 'Europe', showLabel: false }]);
    assert(component.getEntity().title === 'Northwind Europe' && component.el.dataset.wrap === 'true',
      'EntityRef update did not synchronize');
  }),
  componentCase('FileItem', () => new zx.FileItem(null, {
    id: 'file-7',
    name: "contract.pdf",
    size: 245760,
    mime: 'application/pdf',
    status: 'uploading',
    progress: 25,
    link: { href: '#contract', download: 'contract.pdf' },
    actions: [{ id: 'remove', label: 'Remove', icon: 'trash', kind: 'danger' }]
  }), (component) => {
    const actions = observe(component, 'action');
    component.el.querySelector('[data-entity-action]').click();
    actions.expect();
    component.setProgress(60).setStatus('success');
    assert(component.getFile().progress === 60 && component.el.dataset.status === 'success',
      'FileItem state update failed');
    assert(component.el.querySelector('[role="progressbar"]').getAttribute('aria-valuenow') === '60',
      'FileItem progress semantics did not update');
  }),
  componentCase('FileList', () => new zx.FileList(null, {
    items: [
      { id: 'a', name: 'invoice.pdf', size: 4096, mime: 'application/pdf' },
      { id: 'b', name: 'scan.png', status: 'processing', indeterminate: true }
    ]
  }), (component) => {
    const changes = observe(component, 'datachange');
    component.updateItem('a', { status: 'success' })
      .addItem({ id: 'c', name: 'notes.txt', status: 'temporary' })
      .removeItem('b');
    changes.expect();
    assert(component.getItems().map((file) => file.id).join(',') === 'a,c',
      'FileList mutation order failed');
    component.setLoading(true).setLoading(false);
  }),
  componentCase('ActivityItem', () => new zx.ActivityItem(null, {
    id: 'activity-7',
    actor: 'Ada Lovelace',
    avatar: { name: 'Ada Lovelace', status: 'online' },
    title: 'uploaded a contract',
    content: 'The signed agreement is ready for review.',
    timestamp: '2026-08-31T09:30:00Z',
    metadata: ['Contracts', 'Customer'],
    attachments: ['contract.pdf'],
    actions: [{ id: 'like', label: 'Like', icon: 'heart' }]
  }), (component) => {
    const actions = observe(component, 'action');
    component.el.querySelector('[data-activity-action]').click();
    actions.expect();
    component.setActivity({ title: 'updated the contract', timeLabel: 'Just now' });
    assert(component.getActivity().title === 'updated the contract'
      && component.el.querySelector('time')?.textContent === 'Just now',
    'ActivityItem update did not synchronize');
  }),
  componentCase('ActivityList', () => new zx.ActivityList(null, {
    groupBy: 'day',
    groupLabel: (day) => `Day ${day}`,
    items: [
      { id: 'one', day: 'today', actor: 'Ada', title: 'created the record' },
      { id: 'two', day: 'today', actor: 'Grace', title: 'added a note' }
    ]
  }), (component) => {
    const changes = observe(component, 'datachange');
    component.prependItems({ id: 'zero', day: 'today', actor: 'Linus', title: 'opened the record' })
      .updateItem('two', { title: 'updated the note' })
      .removeItem('one');
    changes.expect();
    assert(component.getItems().map((item) => item.id).join(',') === 'zero,two',
      'ActivityList incremental order failed');
    component.setLoading(true).setLoading(false);
  }),
  componentCase('AccountMenu', () => new zx.AccountMenu(null, {
    account: { name: 'Ada Lovelace', secondary: 'ada@example.test', status: 'online', statusLabel: 'Online' },
    items: [{ label: 'Settings', value: 'settings', onselect: () => {
      throw new Error('canceled account selection invoked its item callback');
    } }, '-', { label: 'Sign out', value: 'logout', danger: true }],
    onselect: (event) => event.preventDefault()
  }), (component) => {
    let rootSelects = 0;
    let ancestorSelects = 0;
    component.el.addEventListener('zx-select', () => { rootSelects += 1; });
    component.el.parentElement.addEventListener('zx-select', () => { ancestorSelects += 1; });
    component.open();
    assert(component.isOpen(), 'account menu did not open');
    assert(component.getPanel().textContent.includes('ada@example.test'), 'account identity not repeated');
    assert(component.refs.trigger.getAttribute('aria-label').includes('Online'),
      'account trigger omitted presence text');
    component.getPanel().querySelector('[data-menu-item="0"]').click();
    assert(component.isOpen(), 'canceled account action closed the menu');
    assert(rootSelects === 1, `account menu emitted ${rootSelects} bubbling select events instead of one`);
    assert(ancestorSelects === 1,
      `account menu ancestor received ${ancestorSelects} bubbling select events instead of one`);
    component.close().setAccount({ name: 'Grace Hopper' });
  }),
  componentCase('WorkspaceSwitcher', () => new zx.WorkspaceSwitcher(null, {
    workspaces: [
      { id: 'north', label: 'Northwind', secondary: 'Business plan', tone: 'blue' },
      { id: 'acme', label: 'Acme Labs', secondary: 'Member', icon: 'star' },
      { id: 'old', label: 'Archive', disabled: true }
    ],
    items: [{ label: 'Workspace settings', value: 'settings', onselect: () => {
      throw new Error('canceled workspace action invoked its item callback');
    } }],
    onaction: (event) => event.preventDefault()
  }), (component) => {
    let rootSelects = 0;
    let ancestorSelects = 0;
    component.el.addEventListener('zx-select', () => { rootSelects += 1; });
    component.el.parentElement.addEventListener('zx-select', () => { ancestorSelects += 1; });
    assert(component.getActive()?.id === 'north', 'first workspace was not active by default');
    assert(component.refs.trigger.getAttribute('aria-haspopup') === 'menu', 'trigger is not a menu button');
    assert(component.refs.trigger.getAttribute('aria-label').includes('Northwind'),
      'trigger label omitted the workspace name');
    component.open();
    assert(component.isOpen(), 'workspace menu did not open');
    const panel = component.getPanel();
    assert(panel.querySelectorAll('[role="menuitemradio"]').length === 3, 'workspaces are not radio items');
    assert(panel.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent.includes('Northwind'),
      'current workspace not checked');
    assert(panel.querySelector('[role="separator"]'), 'no separator between workspaces and actions');
    const action = /** @type {HTMLElement} */ (panel.querySelector('[role="menuitem"]'));
    action.click();
    assert(component.isOpen(), 'canceled workspace action closed the menu');
    const acme = /** @type {HTMLElement} */ ([...panel.querySelectorAll('[role="menuitemradio"]')]
      .find((row) => row.textContent.includes('Acme')));
    acme.click();
    assert(!component.isOpen(), 'choosing a workspace left the menu open');
    assert(component.getActive()?.id === 'acme', 'choosing a workspace did not switch to it');
    assert(rootSelects === 1, `workspace switcher emitted ${rootSelects} bubbling select events instead of one`);
    assert(ancestorSelects === 1,
      `workspace switcher ancestor received ${ancestorSelects} bubbling select events instead of one`);
    component.on('select', (event) => event.preventDefault());
    component.setActive('north', { silent: false });
    assert(component.getActive()?.id === 'acme', 'a canceled select still switched workspace');
    component.setCompact(true);
    assert(component.refs.trigger.getAttribute('title') === 'Acme Labs', 'compact trigger has no tooltip');
    component.setWorkspaces([{ id: 'solo', label: 'Solo' }]);
    assert(component.getActive()?.id === 'solo', 'replaced workspaces did not fall back to the first');
  }),
  componentCase('AppSidebar (horizontal rail)', () => new zx.AppSidebar(null, {
    items: [{ id: 'sales', label: 'Sales', icon: 'search', children: [
      { id: 'blocked', label: 'Unavailable', disabled: true },
      { id: 'leads', label: 'Leads' },
      { id: 'reports', label: 'Reports', children: [{ id: 'pipeline', label: 'Pipeline' }] }
    ] }, { id: 'admin', label: 'Admin', disabled: true, children: [
      { id: 'settings', label: 'Settings', children: [{ id: 'profile', label: 'Profile' }] }
    ] }, { id: 'home', label: 'Home', icon: 'search' }],
    orientation: 'horizontal',
    side: 'top',
    openDelay: 0,
    closeDelay: 20
  }), async (component) => {
    const changes = [];
    component.on('flyoutchange', (event) => changes.push(event.detail.open));
    const trigger = component.el.querySelector('[data-app-nav-id="sales"]');
    trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await delay(0);
    assert(component.isFlyoutOpen('sales'), 'horizontal rail hover did not open its flyout');
    assert(!component.el.querySelector('.zx-app-sidebar__sublist'), 'rail rendered inline descendants');
    const panel = document.querySelector('.zx-app-rail__popover[aria-label="Sales sub-navigation"]');
    assert(!trigger.hasAttribute('aria-haspopup'), 'rail disclosure incorrectly claimed menu popup semantics');
    assert(trigger.getAttribute('aria-controls') === panel.id && panel.getAttribute('role') === 'region'
      && panel.getAttribute('aria-label') === 'Sales sub-navigation',
    'rail disclosure did not control a named popup region');
    trigger.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    panel.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await delay(30);
    assert(component.isFlyoutOpen('sales'), 'trigger-to-panel close grace lost the flyout');
    panel.querySelector('[data-app-nav-id="sales/blocked"]').click();
    assert(component.isFlyoutOpen('sales'), 'disabled rail child closed the flyout');
    assert(panel.querySelectorAll('.zx-app-rail__flyout-list').length === 1,
      'a deeper rail collection was rendered inline in its parent flyout');
    const reports = panel.querySelector('[data-app-nav-id="sales/reports"]');
    reports.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await delay(0);
    assert(component.isFlyoutOpen('sales/reports'), 'nested rail branch did not open an anchored flyout');
    const nestedPanel = [...document.querySelectorAll('.zx-app-rail__popover')]
      .find((candidate) => candidate.textContent.includes('Pipeline'));
    assert(nestedPanel && nestedPanel.querySelector('[data-app-nav-id="sales/reports/pipeline"]'),
      'nested rail descendant was not exposed in its own flyout');
    const pipeline = nestedPanel.querySelector('[data-app-nav-id="sales/reports/pipeline"]');
    pipeline.focus();
    pipeline.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(!component.isFlyoutOpen('sales/reports') && component.isFlyoutOpen('sales')
      && document.activeElement === reports, 'nested panel Escape did not restore its branch trigger');
    component.openFlyout('sales/reports');
    reports.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(!component.isFlyoutOpen('sales/reports') && component.isFlyoutOpen('sales')
      && document.activeElement === reports, 'nested trigger Escape closed the owning rail flyout');
    component.openFlyout('sales/reports');
    pipeline.focus();
    const outside = document.createElement('button');
    component.el.append(outside);
    outside.focus();
    await delay(30);
    assert(!component.isFlyoutOpen('sales/reports') && !component.isFlyoutOpen('sales'),
      'leaving the deepest flyout did not close its owning chain after the grace interval');
    outside.remove();
    component.openFlyout('sales');
    component.openFlyout('sales/reports');
    component.el.querySelector('[data-app-nav-id="home"]').click();
    assert(!component.isFlyoutOpen('sales/reports') && !component.isFlyoutOpen('sales'),
      'selecting another top-level rail item left the old flyout chain open');
    component.openFlyout('sales');
    component.openFlyout('sales/reports');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    assert(!component.isFlyoutOpen('sales/reports') && !component.isFlyoutOpen('sales'),
      'outside activation did not close the complete rail flyout chain');
    component.openFlyout('sales/reports');
    assert(component.isFlyoutOpen('sales/reports') && component.isFlyoutOpen('sales'),
      'opening a nested rail flyout directly did not open its owning chain');
    component.closeAllFlyouts();
    assert(!component.isFlyoutOpen('sales/reports') && !component.isFlyoutOpen('sales'),
      'closeAllFlyouts did not close the complete rail flyout chain');
    component.openFlyout('admin/settings');
    assert(!component.isFlyoutOpen('admin/settings') && !component.isFlyoutOpen('admin'),
      'opening a descendant bypassed its disabled owning rail branch');
    trigger.focus();
    assert(component.isFlyoutOpen('sales'), 'rail focus did not open its flyout');
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    assert(component.isFlyoutOpen('sales'), 'activating a focused rail branch closed its flyout');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    assert(!component.isFlyoutOpen('sales') && changes.at(-1) === false,
      'outside dismissal did not report the rail flyout close');
    component.setActive('leads');
    assert(trigger.dataset.activeDescendant === 'true', 'active rail child did not mark its parent');
    assert(panel.querySelector('[data-app-nav-id="sales/leads"]').getAttribute('aria-current') === 'page',
      'active rail child was not exposed in its flyout');
    component.setItems([{ id: 'billing', label: 'Billing', icon: 'search' }]);
    assert(!document.querySelector('.zx-app-rail__popover'), 'setItems left an old flyout in the document');
    assert(document.querySelectorAll('[data-zx-app-rail-listener-scope]').length === 1,
      'setItems retained a dynamic rail listener scope');
  }),
  componentCase('AppSidebar', () => new zx.AppSidebar(null, {
    items: [{ id: 'sales', label: 'Sales', icon: 'search', children: [{ id: 'overview', label: 'Overview' }] }],
    expanded: ['sales']
  }), (component) => {
    const root = component.el;
    let rootSelects = 0;
    let ancestorSelects = 0;
    component.el.addEventListener('zx-select', () => { rootSelects += 1; });
    component.el.parentElement.addEventListener('zx-select', () => { ancestorSelects += 1; });
    const detachedCollapse = component.refs.collapse;
    component.collapse().expand();
    detachedCollapse.click();
    assert(!component.isCollapsed(), 'a detached sidebar control retained a live mode listener');
    assert(!component.el.querySelector('.zx-app-sidebar__sublist').hidden, 'expanded branch missing');
    let salesDisclosure = component.el.querySelector('[data-app-nav-id="sales"]');
    salesDisclosure.focus();
    salesDisclosure.click();
    salesDisclosure = component.el.querySelector('[data-app-nav-id="sales"]');
    assert(document.activeElement === salesDisclosure && salesDisclosure.getAttribute('aria-expanded') === 'false',
      'collapsing a focused sidebar disclosure lost focus');
    salesDisclosure.click();
    salesDisclosure = component.el.querySelector('[data-app-nav-id="sales"]');
    assert(document.activeElement === salesDisclosure && salesDisclosure.getAttribute('aria-expanded') === 'true',
      'expanding a focused sidebar disclosure lost focus');
    component.el.querySelector('[data-app-nav-id="overview"]').focus();
    salesDisclosure.click();
    salesDisclosure = component.el.querySelector('[data-app-nav-id="sales"]');
    assert(document.activeElement === salesDisclosure,
      'collapsing a sidebar branch did not move descendant focus to its owning disclosure');
    salesDisclosure.click();
    component.setActive('overview');
    assert(component.el.querySelector('[data-app-nav-id="sales"]').dataset.activeDescendant === 'true',
      'active sidebar child did not mark its parent');
    component.el.querySelector('[data-app-nav-id="overview"]').focus();
    component.collapse();
    assert(component.isCollapsed(), 'sidebar did not minimize');
    const expand = component.el.querySelector('.zx-app-sidebar__rail-toggle');
    assert(document.activeElement === expand, 'programmatic minimization did not move focus to its rail toggle');
    component.openFlyout('sales', { focus: true });
    component.expand();
    assert(component.el === root && !component.el.querySelector('.zx-app-sidebar__rail')
      && !component.isFlyoutOpen('sales')
      && document.activeElement === component.refs.collapse,
    'programmatic expansion replaced the owner, left a flyout open, or lost focus');
    component.collapse();
    assert(document.activeElement === component.el.querySelector('.zx-app-sidebar__rail-toggle'),
      'programmatic minimization did not restore focus from the expanded presentation');
    component.openFlyout('sales');
    document.querySelector('.zx-app-rail__popover[aria-label="Sales sub-navigation"]')
      .querySelector('[data-app-nav-id="sales/overview"]').click();
    assert(rootSelects === 1, `collapsed sidebar emitted ${rootSelects} bubbling select events instead of one`);
    assert(ancestorSelects === 1,
      `collapsed sidebar ancestor received ${ancestorSelects} bubbling select events instead of one`);
    component.expand();
    assert(document.activeElement === component.refs.collapse,
      'programmatic expansion did not move focus to its expanded toggle');
    assert(component.getExpanded()[0] === 'sales', 'branch state did not survive minimization');
    const layoutChanges = [];
    component.on('collapsechange', (event) => layoutChanges.push(event.detail.collapsed));
    component.el.querySelector('[data-app-nav-id="overview"]').focus();
    component.setCollapsed(false).setLayout({ orientation: 'horizontal', side: 'top' });
    assert(component.isCollapsed() && !component.el.querySelector('.zx-app-sidebar__collapse')
      && !component.el.querySelector('.zx-app-sidebar__sublist'),
    'horizontal layout exposed expansion UI or inline descendants');
    assert(component.el.contains(document.activeElement),
      'horizontal layout change discarded focus from application navigation');
    component.setLayout({ orientation: 'vertical', side: 'left' });
    assert(!component.isCollapsed() && component.getExpanded()[0] === 'sales',
      'returning from horizontal layout lost the vertical state');
    assert(component.el.contains(document.activeElement),
      'vertical layout change discarded focus from application navigation');
    assert(layoutChanges.join(',') === 'true,false',
      `layout changes emitted the wrong collapsed states: ${layoutChanges}`);
  }),
  componentCase('ModuleBar', () => new zx.ModuleBar(null, {
    items: [
      { id: 'home', label: 'Home', icon: 'search', tone: 'slate', href: '#home' },
      { id: 'mail', label: 'Mail', icon: 'search', tone: 'blue', badge: 7, children: [
        { id: 'inbox', label: 'Inbox' }, { id: 'sent', label: 'Sent' }
      ] },
      { id: 'crm', label: 'Customers', icon: 'search', color: '#bc3885', children: [
        { section: true, label: 'Records', children: [{ id: 'companies', label: 'Companies' }] }
      ] },
      { id: 'billing', label: 'Billing', icon: 'search', tone: 'violet' },
      { id: 'off', label: 'Unavailable', icon: 'search', disabled: true }
    ],
    active: 'companies',
    openDelay: 0,
    closeDelay: 20
  }), async (component) => {
    const key = (target, name) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    const tile = (id) => component.el.querySelector(`.zx-module-bar__item[data-app-nav-value-id="${id}"]`);
    const stops = () => [...component.el.querySelectorAll('.zx-module-bar__item')].filter((control) => control.tabIndex === 0);
    assert(stops().length === 1 && stops()[0] === tile('crm'), 'the single Tab stop is not the current module');
    assert(tile('crm').getAttribute('aria-current') === 'true', 'the module holding the active route is not current');
    assert(tile('mail').getAttribute('aria-label') === 'Mail (7)', 'a badge is missing from the accessible name');
    assert(tile('crm').querySelector('.zx-module-bar__tile').dataset.color === ''
      && tile('mail').querySelector('.zx-module-bar__tile').dataset.tone === 'blue', 'module colour was not resolved');
    tile('crm').focus();
    key(tile('crm'), 'ArrowDown');
    assert(document.activeElement === tile('billing') && stops()[0] === tile('billing'),
      'ArrowDown did not move focus and the Tab stop together');
    key(document.activeElement, 'h');
    assert(document.activeElement === tile('home'), 'type-ahead did not reach Home');
    key(document.activeElement, 'End');
    assert(document.activeElement === tile('off'), 'End did not reach the last control');
    key(document.activeElement, 'ArrowDown');
    assert(document.activeElement === tile('home'), 'arrow movement did not wrap');
    tile('mail').focus();
    key(tile('mail'), 'ArrowRight');
    assert(component.isFlyoutOpen('mail') && document.activeElement.textContent.includes('Inbox'),
      'the arrow toward the workspace did not move into the module menu');
    key(document.activeElement, 'Escape');
    assert(!component.isFlyoutOpen('mail') && document.activeElement === tile('mail'),
      'Escape did not close the menu back onto its module');
    component.openFlyout('crm');
    const flyout = document.querySelector('.zx-app-rail__popover[aria-label="Customers sub-navigation"]');
    assert(flyout?.querySelector('.zx-app-rail__flyout-section')?.textContent === 'Records',
      'a section in a module menu lost its heading');
    component.closeAllFlyouts();
    component.setBadge('mail', 12);
    assert(tile('mail').getAttribute('aria-label') === 'Mail (12)'
      && tile('mail').querySelector('.zx-module-bar__badge').textContent === '12', 'setBadge did not update the tile');
    component.setBadge('mail', null);
    assert(tile('mail').getAttribute('aria-label') === 'Mail' && !tile('mail').querySelector('.zx-module-bar__badge'),
      'setBadge(null) did not remove the badge');
    const selected = [];
    component.on('select', (event) => { event.preventDefault(); selected.push(event.detail.id); });
    tile('billing').click();
    tile('off').click();
    assert(selected.join(',') === 'billing', `module activation emitted ${selected}`);
    component.setBadge('mail', 128);
    assert(tile('mail').querySelector('.zx-module-bar__badge').dataset.zxBadge === 'dot', 'a long count fitted a bare tile');
    component.setLabels('beside');
    assert(component.el.dataset.labels === 'beside'
      && tile('mail').querySelector('.zx-module-bar__label')?.textContent === 'Mail'
      && tile('mail').querySelector('.zx-module-bar__badge').dataset.zxBadge === 'count',
    'names beside the tiles, with the whole count, did not render');
    assert(component.el.getBoundingClientRect().width > tile('mail').querySelector('.zx-module-bar__tile').getBoundingClientRect().width * 3,
      'a bar with names beside its tiles did not widen');
    component.setLabels('hidden');
    assert(!tile('mail').querySelector('.zx-module-bar__label'), 'setLabels(hidden) kept the names');
    component.setItems([{ id: 'only', label: 'Only', children: [{ id: 'child', label: 'Child' }] }]);
    assert(document.querySelectorAll('.zx-app-rail__popover[aria-label="Customers sub-navigation"]').length === 0,
      'setItems left an old flyout in the document');
    assert(document.querySelectorAll('.zx-module-bar__popover').length === 1, 'setItems left an old catalogue behind');
  }),
  componentCase('ModuleBar (overflow and catalogue)', () => {
    const bar = new zx.ModuleBar(null, {
      label: 'Overflowing modules',
      items: Array.from({ length: 20 }, (_, index) => ({
        id: `m${index + 1}`, label: `Module ${index + 1}`, icon: 'search',
        tone: ['blue', 'teal', 'pink'][index % 3], group: index < 10 ? 'First' : 'Second', href: `#m${index + 1}`
      })),
      active: 'm18'
    });
    bar.el.style.blockSize = '260px';
    return bar;
  }, async (component) => {
    await nextFrame();
    const rows = [...component.el.querySelectorAll('.zx-module-bar__row[data-module-id]')];
    const visible = rows.filter((row) => !row.hidden).map((row) => row.dataset.moduleId);
    assert(visible.length > 1 && visible.length < 20, `a 260px bar showed ${visible.length} of 20 modules`);
    assert(visible.includes('m18'), 'the current module was pushed off the bar');
    const more = component.el.querySelector('.zx-module-bar__row[data-module-bar-more]');
    assert(!more.hidden, 'an overflowing bar has no All modules button');
    const openings = [];
    component.on('allmodules', (event) => openings.push(event.detail.open));
    component.openAllModules();
    const panel = document.querySelector('.zx-module-bar__popover[aria-label="All modules"]');
    assert(component.isAllModulesOpen() && panel.querySelectorAll('.zx-module-bar__entry').length === 20,
      'the catalogue does not list every module');
    assert(panel.querySelectorAll('.zx-module-bar__group-label').length === 2, 'catalogue groups missing');
    const filter = panel.querySelector('.zx-module-bar__filter');
    assert(document.activeElement === filter, 'the catalogue did not focus its filter');
    assert([...panel.querySelectorAll('.zx-module-bar__entry')].filter((entry) => entry.tabIndex === 0).length === 1,
      'the catalogue entries are not one Tab stop');
    filter.value = 'Module 7';
    filter.dispatchEvent(new Event('input', { bubbles: true }));
    const shown = [...panel.querySelectorAll('li[data-module-id]')].filter((row) => !row.hidden);
    assert(shown.length === 1 && shown[0].dataset.moduleId === 'm7', 'the filter did not narrow the catalogue');
    assert(shown[0].querySelector('.zx-module-bar__entry').tabIndex === 0, 'the filter hid the Tab stop without moving it');
    filter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert(document.activeElement?.dataset.moduleId === 'm7', 'ArrowDown did not move from the filter into the grid');
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert(!component.isAllModulesOpen() && document.activeElement === more.querySelector('button'),
      'Escape did not close the catalogue back onto its button');
    assert(filter.value === '', 'closing the catalogue kept the filter');
    const selected = [];
    component.on('select', (event) => { event.preventDefault(); selected.push(event.detail.id); });
    component.openAllModules();
    panel.querySelector('.zx-module-bar__entry[data-module-id="m3"]').click();
    assert(selected.join(',') === 'm3' && !component.isAllModulesOpen(), 'a catalogue choice did not select and close');
    assert(openings.join(',') === 'true,false,true,false', `catalogue events: ${openings}`);
  }),
  componentCase('AppSidebar (modules layout)', () => new zx.AppSidebar(null, {
    layout: 'modules',
    items: [
      { id: 'home', label: 'Home', icon: 'search', href: '#home' },
      { id: 'mail', label: 'Mail', icon: 'search', tone: 'blue', children: [
        { id: 'inbox', label: 'Inbox' },
        { section: true, label: 'Labels', children: [{ id: 'clients', label: 'Clients' }] }
      ] },
      { section: true, label: 'Sales', children: [
        { id: 'crm', label: 'Customers', icon: 'search', tone: 'pink', children: [{ id: 'companies', label: 'Companies' }] }
      ] }
    ],
    active: 'companies',
    openDelay: 0,
    closeDelay: 20
  }), (component) => {
    const key = (target, name) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    const tile = (id) => component.el.querySelector(`.zx-module-bar__item[data-app-nav-value-id="${id}"]`);
    assert(component.getModule() === 'crm', 'the panel did not open on the active module');
    const panel = component.el.querySelector('.zx-app-sidebar__panel');
    const nav = panel.querySelector('nav');
    assert(document.getElementById(nav.getAttribute('aria-labelledby'))?.textContent === 'Customers',
      'the panel navigation is not named by its module');
    assert(tile('mail').getAttribute('aria-expanded') === 'false' && tile('mail').getAttribute('aria-controls') === panel.id
      && tile('crm').getAttribute('aria-expanded') === 'true', 'module tiles do not control the panel');
    const changes = [];
    component.on('modulechange', (event) => changes.push(event.detail.id));
    tile('mail').click();
    assert(component.getModule() === 'mail' && changes.join(',') === 'mail' && tile('mail').getAttribute('aria-expanded') === 'true',
      'choosing a module did not show its menu');
    assert(panel.querySelector('.zx-app-sidebar__section-label')?.textContent === 'Labels', 'a section heading is missing');
    const veto = (event) => event.preventDefault();
    component.on('modulechange', veto);
    tile('crm').click();
    assert(component.getModule() === 'mail', 'a prevented modulechange still switched the panel');
    component.off('modulechange', veto);
    tile('mail').focus();
    key(tile('mail'), 'ArrowRight');
    assert(document.activeElement?.dataset.appNavId === 'inbox', 'the arrow toward the panel did not move into the menu');
    key(document.activeElement, 'ArrowLeft');
    assert(document.activeElement === tile('mail'), 'Left Arrow on a top-level row did not return to its module');
    const selected = [];
    component.on('select', (event) => { event.preventDefault(); selected.push(event.detail.id); });
    tile('home').click();
    assert(selected.join(',') === 'home' && component.getModule() === 'mail', 'a destination module did not select');
    component.setActive('companies');
    assert(component.getModule() === 'crm', 'the panel did not follow the active route');
    component.setBadge('mail', 5);
    assert(tile('mail').getAttribute('aria-label') === 'Mail (5)', 'setBadge did not reach the strip');
    const strip = () => component.el.querySelector('.zx-module-bar');
    assert(strip().dataset.labels === 'beside' && tile('mail').querySelector('.zx-module-bar__label')?.textContent === 'Mail',
      'the expanded strip does not name its modules');
    const heading = strip().querySelector('.zx-module-bar__heading');
    assert(heading?.textContent === 'Sales' && heading.nextElementSibling?.dataset.moduleId === 'crm',
      'a section of modules did not head its module on the strip');
    const option = (name) => component.el.querySelector(`.zx-module-bar__footer .zx-app-sidebar__presentation-option[data-presentation="${name}"]`);
    const group = component.el.querySelector('.zx-module-bar__footer [role="radiogroup"]');
    assert(group && group.querySelectorAll('[role="radio"]').length === 3
      && option('expanded').getAttribute('aria-checked') === 'true' && option('expanded') === component.refs.collapse
      && [...group.querySelectorAll('[role="radio"]')].filter((radio) => radio.tabIndex === 0).length === 1
      && !component.el.querySelector('.zx-app-sidebar__panel .zx-app-sidebar__collapse'),
    'the three-way switch is not at the foot of the strip, checked on the current presentation');
    assert(component.getPresentation() === 'expanded', 'the modules layout did not start expanded');
    const presentations = [];
    component.on('presentationchange', (event) => presentations.push(event.detail.presentation));
    option('compact').focus();
    option('compact').click();
    assert(component.getPresentation() === 'compact' && strip().dataset.labels === 'hidden'
      && component.el.querySelector('.zx-app-sidebar__panel') && option('compact').getAttribute('aria-checked') === 'true',
    'choosing the compact presentation did not collapse the module menu beside the side menu');
    option('compact').focus();
    key(option('compact'), 'ArrowDown');
    assert(component.isCollapsed() && strip() && strip().dataset.labels === 'hidden'
      && !component.el.querySelector('.zx-app-sidebar__panel'), 'ArrowDown on the switch did not collapse both menus');
    assert(document.activeElement === option('collapsed') && option('collapsed').getAttribute('aria-checked') === 'true',
      'collapsing from the switch lost focus');
    key(option('collapsed'), 'Home');
    assert(component.getPresentation() === 'expanded' && strip().dataset.labels === 'beside'
      && document.activeElement === option('expanded'), 'Home on the switch did not expand both menus');
    component.togglePresentation();
    assert(component.getPresentation() === 'compact', 'togglePresentation() did not step to the next presentation');
    assert(presentations.join(',') === 'compact,collapsed,expanded,compact', `presentations: ${presentations}`);
    component.setPresentation('collapsed');
    component.openFlyout('mail');
    document.querySelector('.zx-app-rail__popover[aria-label="Mail sub-navigation"] [data-app-nav-value-id="inbox"]').click();
    assert(selected.join(',') === 'home,inbox', 'a minimized module menu did not select');
    component.expand();
    assert(!component.isCollapsed() && document.activeElement === component.refs.collapse, 'expanding lost focus');
  }),
  componentCase('AppSidebar (layout in a menu)', () => new zx.AppSidebar(null, {
    layout: 'modules',
    presentationSwitch: false,
    items: [
      { id: 'mail', label: 'Mail', icon: 'search', children: [{ id: 'inbox', label: 'Inbox' }] },
      { id: 'crm', label: 'Customers', icon: 'search', children: [{ id: 'companies', label: 'Companies' }] }
    ],
    active: 'inbox'
  }), async (component) => {
    assert(!component.el.querySelector('.zx-app-sidebar__presentation'), 'presentationSwitch: false left a switch on the strip');
    const menu = new zx.MenuButton(null, { label: 'Account', items: [component.presentationChoice(), '-', { label: 'Sign out', value: 'out' }] });
    component.el.append(menu.toElement());
    try {
      const selected = [];
      menu.on('select', (event) => selected.push(event.detail.value));
      menu.focusFirst();
      const panel = menu.getPanel();
      const group = panel.querySelector('[role="group"]');
      const radios = [...group.querySelectorAll('[role="menuitemradio"]')];
      assert(radios.length === 3 && radios[0].getAttribute('aria-checked') === 'true'
        && document.getElementById(group.getAttribute('aria-labelledby'))?.textContent === 'Navigation layout'
        && radios[1].querySelector('.zx-app-sidebar__presentation-glyph'),
      'presentationChoice() did not render a labelled three-way row');
      radios[1].click();
      assert(menu.isOpen() && component.getPresentation() === 'compact' && radios[1].getAttribute('aria-checked') === 'true'
        && radios[0].getAttribute('aria-checked') === 'false' && selected.length === 0,
      'choosing an option did not apply it in place with the menu open');
      radios[1].focus();
      radios[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      assert(document.activeElement === radios[2], 'ArrowRight did not move within the choice row');
      radios[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      assert(document.activeElement?.textContent === 'Sign out', 'ArrowDown did not leave the choice row');
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
      assert(document.activeElement === radios[1], 'ArrowUp did not return to the checked option of the row');
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      assert(menu.isOpen() && component.getPresentation() === 'compact', 'Space on the checked option changed the layout');
      menu.close();
      component.el.querySelector('.zx-module-bar__item[data-app-nav-value-id="mail"]').focus();
      component.setPresentation('collapsed');
      assert(component.el.contains(document.activeElement) && document.activeElement !== document.body,
        'collapsing without a switch on the strip dropped focus to the page');
      component.setPresentation('expanded');
      assert(component.el.contains(document.activeElement), 'expanding without a switch on the strip dropped focus');
    } finally {
      menu.destroy();
    }
  }),
  componentCase('AppSidebar (sections)', () => new zx.AppSidebar(null, {
    items: [
      { id: 'home', label: 'Home', icon: 'search' },
      { section: true, label: 'Records', children: [
        { id: 'companies', label: 'Companies', icon: 'search' }, { id: 'people', label: 'People', icon: 'search' }
      ] }
    ],
    active: 'people'
  }), (component) => {
    const list = component.el.querySelector('.zx-app-sidebar__section-list');
    assert(document.getElementById(list?.getAttribute('aria-labelledby'))?.textContent === 'Records',
      'a section list is not named by its heading');
    assert(component.el.querySelectorAll('nav').length === 1, 'a section added a landmark');
    const home = component.el.querySelector('[data-app-nav-id="home"]');
    home.focus();
    home.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert(document.activeElement?.dataset.appNavId === 'companies', 'arrow keys stopped at a section boundary');
    component.collapse();
    assert(component.el.querySelectorAll('.zx-app-rail__separator').length === 1
      && component.el.querySelectorAll('.zx-app-rail__item').length === 3, 'a minimized section did not become a separator');
  }),
  componentCase('AppSidebar (safe destinations)', () => new zx.AppSidebar(null, {
    items: [
      {
        id: 'unsafe-root',
        label: 'Unsafe root',
        href: 'javascript:globalThis.__zxUnsafeNavigationAudit=1'
      },
      {
        id: 'records',
        label: 'Records',
        children: [{
          id: 'unsafe-child',
          label: 'Unsafe child',
          href: 'java\nscript:globalThis.__zxUnsafeNavigationAudit=2'
        }]
      }
    ],
    expanded: ['records'],
    openDelay: 0
  }), (component) => {
    globalThis.__zxUnsafeNavigationAudit = 0;
    for (const control of component.el.querySelectorAll('[data-app-nav-id*="unsafe"]')) {
      assert(control.localName === 'button' && control.getAttribute('aria-disabled') === 'true',
        'expanded sidebar rendered an unsafe destination as an enabled anchor');
      control.click();
    }
    component.collapse().openFlyout('records');
    const railRoot = component.el.querySelector('[data-app-nav-id="unsafe-root"]');
    const railChild = document.querySelector('[data-app-nav-id="records/unsafe-child"]');
    for (const control of [railRoot, railChild]) {
      assert(control.localName === 'button' && control.getAttribute('aria-disabled') === 'true',
        'minimized sidebar rendered an unsafe destination as an enabled anchor');
      control.click();
    }
    assert(globalThis.__zxUnsafeNavigationAudit === 0, 'sidebar executed an unsafe destination');
    delete globalThis.__zxUnsafeNavigationAudit;
  }),
  componentCase('Message', () => new zx.Message(null, { timeout: 0 }), (component) => {
    const handle = component.show('Ready', { timeout: 0 });
    assert(component.el.querySelector('.zx-message__toast'), 'message was not rendered');
    handle.close();
  }),
  componentCase('Message (action)', () => new zx.Message(null, { timeout: 0 }), (component) => {
    const ran = [];
    const avatar = new zx.Avatar(null, { name: 'Mara Lind', size: 'sm' });
    const handle = component.show('Mara Lind asks you to approve the release.', {
      leading: avatar,
      action: { label: 'Approve', kind: 'primary', onclick: () => ran.push('approve') }
    });
    const toast = component.el.querySelector('.zx-message__toast');
    const action = toast?.querySelector('.zx-message__action');
    assert(action?.matches('button.zx-btn[data-size="sm"][data-kind="primary"]'),
      'message action is not a small Zx button of the requested kind');
    assert(toast.querySelector('.zx-message__icon[aria-hidden="true"] > .zx-avatar'),
      'leading node did not take the kind icon\'s place');
    assert(!toast.querySelector('.zx-message__icon > .zx-icon'), 'kind icon still shown beside the leading node');
    action.click();
    assert(ran.length === 1 && ran[0] === 'approve', 'message action did not run onclick');
    assert(toast.dataset.state === 'closing' || !toast.isConnected, 'message action did not close the message');
    handle.close();
    const secondary = component.show('Saved.', { action: { label: 'Undo' } });
    assert(component.el.querySelector('.zx-message__action[data-kind="default"]'),
      'message action is not the secondary button by default');
    secondary.close();
    avatar.destroy();
  }),
  componentCase('Message (floating geometry)', () => {
    const component = new zx.Message(null, { timeout: 0 });
    component.el.classList.add('zx-message-region');
    return component;
  }, async (component) => {
    const handle = component.show('Invoice saved successfully.', { timeout: 0, kind: 'success' });
    await nextFrame();
    const region = component.el.getBoundingClientRect();
    const toast = component.el.querySelector('.zx-message__toast').getBoundingClientRect();
    assert(getComputedStyle(component.el).position === 'fixed' && region.top <= 24
      && Math.abs(region.right - innerWidth) <= 24, 'floating Message is not anchored in the upper right');
    assert(region.height < 160 && toast.height < 160 && region.width <= 420,
      'floating Message stretched beyond its content-sized region');
    handle.close();
  }),
  componentCase('Modal', () => new zx.Modal(null, { content: 'Modal body' }), async (component) => {
    const events = observe(component, 'open');
    const results = [];
    component.on('close', (event) => results.push(event.detail.result));
    component.open();
    assert(component.isOpen(), 'open failed');
    events.expect();
    const staleNativeClose = new Promise((resolve) => component.el.addEventListener('close', resolve, { once: true }));
    component.close('stale-result');
    component.open();
    await Promise.race([
      staleNativeClose,
      new Promise((_, reject) => setTimeout(() => reject(new Error('stale native close timed out')), 500))
    ]);
    assert(component.isOpen() && component.el.dataset.state === 'open',
      'a queued close invalidated a reopened Modal');
    assert(results.length === 0, 'a stale Modal close emitted a lifecycle event');
    const finalClose = new Promise((resolve) => component.once('close', resolve));
    component.el.close();
    await Promise.race([
      finalClose,
      new Promise((_, reject) => setTimeout(() => reject(new Error('native Modal dismissal timed out')), 500))
    ]);
    assert(results.length === 1 && results[0] === undefined,
      `a native dismissal inherited a stale result (${JSON.stringify(results)})`);
  }),
  componentCase('Dialog', () => new zx.Dialog(null, { title: 'Dialog', content: 'Body' }), (component) => {
    component.addView('one', { content: 'One' });
    component.addView('two', { content: 'Two' });
    component.showView('two').content.dataset.exercised = 'true';
    component.open();
    assert(component.isOpen(), 'open failed');
    component.close();
  }),
  artifactCase('Dialog (type to confirm)', () => {
    const element = document.createElement('span');
    return {
      element,
      async exercise() {
        const result = zx.Dialog.confirm({
          title: 'Delete project?', message: 'This cannot be undone.',
          confirmText: 'Website Redesign', okLabel: 'Delete project', danger: true
        });
        await nextFrame();
        const input = document.querySelector('dialog.zx-dialog[open] .zx-dialog__confirm-input');
        assert(input && document.activeElement === input, 'type-to-confirm did not start in its input');
        assert(input.labels?.[0]?.textContent === 'Type Website Redesign to confirm',
          'type-to-confirm input is not labelled "Type Website Redesign to confirm"');
        const dialog = input.closest('dialog');
        const accept = () => [...dialog.querySelectorAll('.zx-dialog__footer button')]
          .find((button) => button.textContent === 'Delete project');
        const type = (value) => {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const enter = () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        assert(accept().disabled, 'confirm button enabled before anything was typed');
        type('website redesign');
        assert(accept().disabled, 'confirm button enabled on a case mismatch');
        enter();
        assert(dialog.open, 'Enter confirmed without a match');
        type('  Website Redesign ');
        assert(!accept().disabled, 'confirm button stayed disabled on a match');
        enter();
        assert(await result === true, 'Enter on a match did not resolve true');
        await delay(30);
      }
    };
  }),
  componentCase('Sheet', () => new zx.Sheet(null, {
    title: 'Invoice', content: 'Body', side: 'end', backdrop: 'blur'
  }), (component) => {
    const events = observe(component, 'open');
    component.open();
    assert(component.isOpen(), 'open failed');
    assert(component.el.dataset.side === 'end', 'side attribute missing');
    assert(component.el.dataset.backdrop === 'blur', 'backdrop attribute missing');
    assert(component.el.matches(':modal'), 'modal sheet did not enter the top layer');
    events.expect();
    component.setSide('bottom').setSize(320);
    assert(component.getSide() === 'bottom', 'setSide failed');
    assert(component.el.style.getPropertyValue('--zx-sheet-size') === '320px', 'setSize failed');
    component.close('done');
  }),
  componentCase('Sheet (resizable)', () => new zx.Sheet(null, {
    title: 'Drawer', content: 'Body', side: 'bottom', snap: [0.3, 0.9], min: 100
  }), (component) => {
    component.open();
    const handle = component.refs.handle;
    assert(handle, 'a snapping sheet must render its handle');
    assert(handle.getAttribute('role') === 'separator', 'handle is not a separator');
    assert(handle.hasAttribute('aria-valuenow'), 'handle carries no live value');
    const events = observe(component, 'resize');
    component.snapTo(1);
    assert(component.getSize() > 0, 'snapTo produced no size');
    events.expect();
    component.close();
  }),
  componentCase('Sheet (non-modal)', () => new zx.Sheet(null, {
    content: 'Body', side: 'start', modal: false
  }), (component) => {
    component.open();
    assert(component.isOpen(), 'non-modal open failed');
    assert(!component.el.matches(':modal'), 'non-modal sheet became modal');
    assert(component.el.matches(':popover-open'), 'non-modal sheet did not enter the popover top layer');
    assert(component.el.dataset.modality === 'none', 'modality attribute missing');
    assert(!component.isModal(), 'isModal() disagreed with the option');
    component.close();
  }),
  sheetStackCase(),
  dropdownCase(),
  componentCase('MenuButton', () => new zx.MenuButton(null, {
    label: 'Actions',
    items: [
      { type: 'heading', label: 'Workspace' },
      { label: 'Run', value: 'run', description: 'Run the workflow', badge: 3, shortcut: 'Ctrl+R' },
      { label: 'Pinned', value: 'pinned', role: 'menuitemcheckbox', checked: true },
      '-',
      { label: 'Documentation', value: 'docs', href: '#menu-documentation' }
    ]
  }), (component) => {
    const events = observe(component, 'open');
    component.open();
    assert(component.isOpen(), 'open failed');
    const panel = component.getPanel();
    assert(panel.querySelector('.zx-menu-button__heading'), 'heading missing');
    assert(panel.querySelector('.zx-menu-button__description'), 'description missing');
    assert(panel.querySelector('.zx-menu-button__badge')?.textContent === '3', 'badge missing');
    assert(panel.querySelector('[role="menuitemcheckbox"]')?.getAttribute('aria-checked') === 'true',
      'checked state missing');
    assert(panel.querySelector('a[href="#menu-documentation"]'), 'native link missing');
    events.expect();
    component.close();
  }),
  tooltipCase(),
  contextMenuCase(),
  menuInDialogCase(),
  toastOverDialogCase(),
  sheetChildOverlaysCase(),
  dropdownTabReachCase(),
  componentCase('AccountMenu (toggle)', () => new zx.AccountMenu(null, {
    account: { name: 'Ada Lovelace' },
    items: [{ label: 'Sign out', value: 'logout' }]
  }), (component) => {
    assert(component.toggle() === component && component.isOpen(), 'AccountMenu.toggle() did not open the menu');
    component.toggle();
    assert(!component.isOpen(), 'AccountMenu.toggle() did not close the menu');
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
  componentCase('Select (fixed items)', () => zx.Select.permission(null, {
    groups: sampleItems(), value: false
  }), async (component) => {
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
    const previousTheme = document.documentElement.dataset.zxTheme;
    for (const [theme, height] of [['light', '32px'], ['dark', '44px']]) {
      document.documentElement.dataset.zxTheme = theme;
      component.el.style.setProperty('--zx-control-height', height);
      component.el.style.setProperty('--zx-control-radius', theme === 'light' ? '2px' : '14px');
      component.el.style.setProperty('--zx-control-font-size', theme === 'light' ? '13px' : '17px');
      await nextFrame();
      const control = component.el.querySelector('.zx-select__control').getBoundingClientRect();
      const toggle = component.refs.toggle.getBoundingClientRect();
      assert(Math.abs((control.top + control.height / 2) - (toggle.top + toggle.height / 2)) <= 1
        && Math.abs(control.right - toggle.right) <= 1,
      `Select chevron drifted under the ${theme} geometry`);
    }
    if (previousTheme === undefined) delete document.documentElement.dataset.zxTheme;
    else document.documentElement.dataset.zxTheme = previousTheme;
    events.expect();
  }),
  selectEntityTargetCase(),
  componentCase('Select (permission async groups)', () => {
    const select = zx.Select.permission(null, {
      groups: () => {
        select._permissionLoads = (select._permissionLoads ?? 0) + 1;
        return sampleItems();
      },
      filter: false,
      debounce: 0
    });
    return select;
  }, async (component) => {
    assert(typeof component.options.filter === 'function',
      'permission filter override disconnected its async group loader');
    component.open();
    await delay(5);
    assert(component._permissionLoads === 1, 'permission async group loader did not run');
    component.close();
  }),
  componentCase('Select (priority preset)', () => zx.Select.priority(null, { value: 2 }), (component) => {
    const indicator = component.refs.valueAdornment.querySelector('.zx-select__priority-icon');
    assert(indicator && !component.refs.valueAdornment.hidden, 'priority value adornment missing');
    assert(indicator.children.length === 4, 'priority indicator does not contain four bars');
    assert(indicator.querySelectorAll('[data-filled="true"]').length === 3,
      'priority level did not fill the expected number of bars');
  }),
  componentCase('Select (status preset)', () => zx.Select.status(null, { value: 'in-progress' }), (component) => {
    const events = observe(component, 'change');
    assert(!component.refs.valueAdornment.hidden, 'status value adornment missing');
    component.open();
    const options = [...component.refs.list.querySelectorAll('[role="option"]')];
    assert(options.length === 9, `status preset rendered ${options.length} options instead of nine`);
    assert(options[0].querySelector('kbd')?.textContent === '1', 'status keyboard hint missing');
    component.refs.input.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));
    assert(component.value === 'in-review', 'status option did not update the value');
    events.expect();
  }),
  artifactCase('statusIcon()', () => {
    const element = document.createElement('div');
    for (const id of ['backlog', 'todo', 'in-progress', 'review', 'done', 'cancelled']) {
      element.append(zx.statusIcon(id));
    }
    element.append(zx.statusIcon('done', { label: 'Done', tone: 'success' }));
    return {
      element,
      exercise() {
        const glyphs = [...element.querySelectorAll('.zx-status-icon')];
        assert(glyphs.map((glyph) => glyph.dataset.indicator).join() === 'dotted,ring,progress,review,done,canceled,done',
          'statusIcon drew the wrong shapes');
        assert(glyphs.slice(0, 6).every((glyph) => glyph.getAttribute('aria-hidden') === 'true'),
          'statusIcon is not decorative by default');
        assert(glyphs[6].getAttribute('role') === 'img' && glyphs[6].getAttribute('aria-label') === 'Done'
          && glyphs[6].dataset.tone === 'success', 'labelled statusIcon is not a named image');
        const select = zx.Select.status(null, { value: 'in-progress' });
        element.append(select.el);
        const picked = select.refs.valueAdornment.querySelector('.zx-select__status-indicator');
        const standalone = getComputedStyle(glyphs[2]);
        const inSelect = getComputedStyle(picked);
        assert(picked.classList.contains('zx-status-icon')
          && ['width', 'height', 'borderTopStyle', 'borderTopColor'].every((key) => standalone[key] === inSelect[key]),
          'standalone status glyph differs from the one Select.status() draws');
        select.destroy();
      }
    };
  }),
  artifactCase('priorityIcon()', () => {
    const element = document.createElement('div');
    for (const level of [null, 0, 2, 4]) element.append(zx.priorityIcon(level));
    return {
      element,
      exercise() {
        const glyphs = [...element.querySelectorAll('.zx-priority-icon')];
        assert(glyphs.map((glyph) => glyph.dataset.level).join() === 'none,0,2,4', 'priorityIcon levels wrong');
        assert(glyphs[2].querySelectorAll('[data-filled="true"]').length === 3, 'priority bars not filled to the level');
        assert(glyphs[3].children.length === 0, 'highest priority is not the square');
        assert(glyphs.every((glyph) => glyph.getAttribute('aria-hidden') === 'true'), 'priorityIcon is not decorative');
      }
    };
  }),
  componentCase('Select (action rows)', () => new zx.Select(null, {
    items: sampleItems(),
    value: 1,
    actions: [{ id: 'create', label: 'Create item…', icon: 'plus' }]
  }), (component) => {
    const actions = observe(component, 'action');
    component.open();
    component.refs.list.querySelector('[data-kind="action"]').click();
    assert(component.value === 1, 'command row changed the selected value');
    actions.expect();
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
  componentCase('TagPicker', () => new zx.TagPicker(null, {
    items: [
      { ID: 1, name: 'Urgent', icon: 'warning', color: '#d97706' },
      { ID: 2, name: 'Finance', icon: 'tag', color: '#535494' }
    ],
    values: [1]
  }), (component) => {
    const events = observe(component, 'change');
    assert(component.el.querySelector('.zx-tag-picker__tag .zx-tag-picker__visual'),
      'selected tag omitted its icon');
    assert(component.el.querySelector('.zx-tag-picker__tag').style.getPropertyValue('--zx-tag-color') === '#d97706',
      'selected tag omitted its color');
    component.addValue(2);
    assert(component.values.length === 2, 'addValue failed');
    events.expect();
    component.removeValue(2).clear();
    assert(component.values.length === 0, 'clear failed');
  }),
  componentCase('TagPicker (custom renderers)', () => new zx.TagPicker(null, {
    items: [{ ID: 1, name: 'Urgent', icon: 'warning', color: '#d97706' }],
    values: [1],
    renderItem: () => {
      const node = document.createElement('strong'); node.className = 'custom-tag-option'; node.textContent = 'Option'; return node;
    },
    renderTag: () => {
      const node = document.createElement('em'); node.className = 'custom-tag-value'; node.textContent = 'Value'; return node;
    }
  }), (component) => {
    component.open();
    assert(component.el.querySelector('.custom-tag-value') && component.el.querySelector('.custom-tag-option'),
      'TagPicker custom renderers did not win');
    assert(!component.el.querySelector('.zx-tag-picker__tag .zx-tag-picker__visual')
      && !component.el.querySelector('.zx-tag-picker__option .zx-tag-picker__visual'),
    'TagPicker added native icon content beside custom renderers');
    component.close();
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
  componentCase('RecordView', () => new zx.RecordView(null, {
    fields: recordViewFields(),
    data: recordViewData(),
    recordId: 'id',
    selectable: 'multi'
  }), (component) => {
    component.setFieldVisible('amount', false);
    component.moveField('owner', 'title', 'before');
    component.setSort('title', 'desc');
    component.setSelection(['opp-2']);
    const state = component.getViewState();
    assert(state.hiddenFields.includes('amount') && state.fieldOrder[0] === 'owner',
      'shared field state did not update');
    assert(component.getSelectionIds()[0] === 'opp-2' && component.getData()[0].id === 'opp-2',
      'shared sort or selection state did not update');
    component.setViewState({ ...state, hiddenFields: [], sort: null });
    assert(component.getHiddenFields().length === 0 && component.getSort() === null,
      'shared state restore did not reconcile');
  }),
  componentCase('TableView', () => new zx.TableView(null, {
    fields: recordViewFields(),
    data: recordViewData(),
    recordId: 'id',
    selectable: 'multi',
    table: { responsive: 'sm', growing: 2 }
  }), (component) => {
    const states = observe(component, 'statechange');
    component.setFieldVisible('amount', false);
    component.moveField('owner', 'title', 'before');
    component.setSort('title', 'asc');
    component.setSelection(['opp-1']);
    assert(component.getTable() instanceof zx.Table, 'TableView did not expose its composed Table');
    assert(component.getTable().getHiddenColumns().includes('amount'),
      'TableView did not synchronize hidden fields');
    assert(component.getTable().getColumnOrder()[0] === 'owner',
      'TableView did not synchronize field order');
    assert(component.getTable().getSort()?.id === 'title' && component.getSelectionIds()[0] === 'opp-1',
      'TableView did not synchronize sort or selection');
    states.expect();
  }),
  componentCase('CardView', () => new zx.CardView(null, {
    fields: recordViewFields(),
    data: recordViewData(),
    recordId: 'id',
    selectable: 'multi',
    titleField: 'title',
    subtitleField: 'owner',
    preview: (record) => record.preview,
    previewAlt: 'title',
    groupBy: 'status',
    groupOrder: ['new', 'open', 'won'],
    actions: [{ id: 'open', label: 'Open' }]
  }), (component) => {
    const actions = observe(component, 'recordaction');
    component.el.querySelector('[data-record-action="open"]').click();
    actions.expect();
    const selection = component.el.querySelector('input[data-record-selection]');
    selection.click();
    assert(component.getSelectionIds().length === 1, 'CardView checkbox did not update selection');
    component.setSort('title', 'desc');
    component.setFieldVisible('amount', false);
    const state = component.getViewState();
    component.setViewState({ ...state, hiddenFields: [], sort: null });
    assert(component.getHiddenFields().length === 0 && component.getSort() === null,
      'CardView state round-trip failed');
    assert(component.el.querySelectorAll('.zx-card-view__group').length === 3,
      'CardView did not retain explicit empty groups');
    const rejectedPreview = component.el.querySelector('.zx-record-card__preview[data-failed="true"]');
    assert(rejectedPreview, 'CardView did not render a safe fallback for an unsafe preview');
  }),
  componentCase('KanbanView', () => new zx.KanbanView(null, {
    fields: recordViewFields(),
    data: recordViewData(),
    recordId: 'id',
    selectable: 'multi',
    titleField: 'title',
    subtitleField: 'owner',
    columnBy: 'status',
    columns: [
      { id: 'new', label: 'New', limit: 1 },
      { id: 'open', label: 'Open', limit: 2 },
      { id: 'won', label: 'Won' }
    ],
    swimlaneBy: 'team',
    swimlanes: [{ id: 'north', label: 'North' }, { id: 'south', label: 'South' }],
    rules: [{ id: 'flagged', when: (record) => record.status === 'open', tone: 'success', label: 'In flight', description: 'Currently in flight' }],
    entityIcon: 'tag',
    identifier: 'id',
    priority: (record) => (record.amount > 30000 ? 'High' : 'Low'),
    priorityTones: { High: 'danger', Low: 'info' },
    status: 'status',
    progress: (record) => Math.min(100, Math.round(record.amount / 500)),
    assignees: 'owner',
    searchControl: true,
    historyControls: true,
    allowAdd: true,
    contextMenu: true
  }), async (component) => {
    const sourceRecord = component.options.data[0];
    const moves = observe(component, 'recordmove');
    component.setSort('title', 'asc');
    component.moveRecord('opp-1', { column: 'open', lane: 'south', index: 1 });
    assert(sourceRecord.status === 'new' && sourceRecord.team === 'north',
      'KanbanView mutated a host record during a local move');
    assert(component.getRecord('opp-1').status === 'open' && component.getRecord('opp-1').team === 'south',
      'KanbanView did not apply its accepted local move');
    assert(component.getSort() === null, 'KanbanView retained a local sort after a manual move');
    moves.expect();
    component.el.addEventListener('zx-recordmove', (event) => event.preventDefault(), { once: true });
    component.moveRecord('opp-1', { column: 'won', lane: 'south', index: 0 });
    assert(component.getRecord('opp-1').status === 'open',
      'KanbanView ignored cancellation of the bubbling recordmove event');
    await Promise.resolve();
    assert(component.el.querySelector('.zx-kanban-view__live').textContent.includes('canceled'),
      'KanbanView did not announce a DOM-canceled move');
    const handle = component.el.querySelector('.zx-kanban-view__move-handle');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert(handle.getAttribute('aria-pressed') === 'true'
      && component.el.querySelector('[data-keyboard-target]'),
    'KanbanView did not expose a keyboard move target');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    assert(handle.getAttribute('aria-pressed') === 'false', 'KanbanView did not cancel a keyboard move');
    component.setColumnCollapsed('won', true);
    const state = component.getViewState();
    assert(state.collapsedColumns.includes('won'), 'KanbanView did not persist collapsed columns');
    assert(state.search === undefined, 'KanbanView serialized transient search state');
    component.setColumnCollapsed('won', false);

    // Undo restores the exact record order the board had before the committed local move.
    assert(component.canUndo(), 'KanbanView did not record a local move in its history');
    const afterMove = component.getData().map((record) => record.id).join(',');
    component.undo();
    assert(component.getRecord('opp-1').status === 'new', 'KanbanView undo did not restore the record');
    component.redo();
    assert(component.getData().map((record) => record.id).join(',') === afterMove,
      'KanbanView redo did not reapply the move');
    component.setData(recordViewData());
    assert(!component.canUndo() && !component.canRedo(),
      'KanbanView kept history describing records the host replaced');

    // Search hides cards without removing the records behind them.
    const totalCards = component.el.querySelectorAll('.zx-record-card').length;
    component.setSearch('zzz-no-such-card');
    assert(component.el.querySelectorAll('.zx-record-card').length === 0
      && component.getData().length > 0, 'KanbanView search removed records rather than cards');
    component.setSearch('');
    assert(component.el.querySelectorAll('.zx-record-card').length === totalCards,
      'KanbanView did not restore every card when the search cleared');

    assert(component.el.querySelector('[data-rule-tone]'), 'KanbanView did not mark a matching rule');

    // The card is the pointer drag source, so the handle is present and reachable but not drawn.
    const keyboardHandle = component.el.querySelector('.zx-kanban-view__move-handle');
    assert(keyboardHandle?.dataset.reveal === 'keyboard',
      'KanbanView drew a move knob for pointer users by default');
    assert(getComputedStyle(keyboardHandle).clipPath === 'inset(50%)',
      'KanbanView did not clip the keyboard-only move handle');
    // Clipping alone is not enough: native button padding used to floor the box at 20px, so the
    // knob still occupied the card while claiming to be hidden.
    const clipped = keyboardHandle.getBoundingClientRect();
    assert(clipped.width <= 2 && clipped.height <= 2,
      'KanbanView left the clipped move handle occupying card space');
    // base.css floors native buttons through `:where()` — losing the cascade but still winning on
    // `padding-inline` and `min-block-size`. Both icon buttons must stay the square they declare.
    const collapseBox = component.el.querySelector('.zx-kanban-view__collapse').getBoundingClientRect();
    assert(Math.round(collapseBox.width) === Math.round(collapseBox.height),
      'KanbanView icon buttons were floored out of square by the base control styles');
    // Programmatic focus is the case that matters: a pointer drop focuses the handle, and
    // :focus-visible does not match after pointer input. Focus must make it visible anyway.
    keyboardHandle.focus();
    assert(document.activeElement === keyboardHandle,
      'KanbanView clipped its move handle out of reach of the keyboard');
    assert(getComputedStyle(keyboardHandle).clipPath === 'none'
      && keyboardHandle.getBoundingClientRect().width > 8,
    'KanbanView kept keyboard focus on an invisible move handle');
    keyboardHandle.blur();

    // A handle-only drag source must never be the clipped one.
    const handleDrag = new zx.KanbanView(null, {
      fields: recordViewFields(), data: recordViewData(), recordId: 'id', titleField: 'title',
      columnBy: 'status', dragFrom: 'handle',
      columns: [{ id: 'new', label: 'New' }, { id: 'open', label: 'Open' }]
    });
    try {
      component.el.append(handleDrag.el);
      const source = handleDrag.el.querySelector('.zx-kanban-view__move-handle');
      assert(source.dataset.reveal === 'always' && getComputedStyle(source).clipPath === 'none',
        'KanbanView clipped the only drag source a pointer user has');
    } finally {
      handleDrag.destroy();
    }

    // Card head and footer project the record without repeating it as metadata.
    const anatomy = component.el.querySelector('.zx-record-card');
    // The identifier now carries a clipped "Record" prefix, so the visible text is the tail.
    const identifier = anatomy.querySelector('.zx-kanban-view__identifier');
    assert(identifier?.lastChild?.textContent === 'opp-1',
      'KanbanView did not render the record identifier');
    assert(anatomy.querySelector('.zx-kanban-view__entity .zx-icon'),
      'KanbanView did not render the entity icon');
    assert(anatomy.querySelectorAll('.zx-kanban-view__card-flags .zx-badge').length === 2,
      'KanbanView did not render both the status and the priority indicator');
    // "High" alone does not say high what, and aria-label is prohibited on a generic span.
    const hints = [...anatomy.querySelectorAll('.zx-kanban-view__hint')].map((hint) => hint.textContent.trim());
    assert(hints.includes('Record') && hints.includes('Priority') && hints.includes('Status'),
      'KanbanView did not name its terse card values for assistive technology');
    assert(!anatomy.querySelector('.zx-kanban-view__identifier[aria-label]'),
      'KanbanView named a generic span with a prohibited aria-label');
    // A field the anatomy projects must not also appear as a labelled metadata row.
    assert(![...anatomy.querySelectorAll('.zx-record-card__label')]
      .some((label) => label.textContent.trim() === 'Status'),
    'KanbanView repeated an anatomy field in the metadata list');
    const meter = anatomy.querySelector('.zx-kanban-view__progress-track');
    assert(meter?.getAttribute('role') === 'progressbar' && meter.getAttribute('aria-valuenow')
      && meter.getAttribute('aria-label'), 'KanbanView progress meter is not an accessible progressbar');
    const avatars = anatomy.querySelector('.zx-kanban-view__avatars');
    assert(avatars?.getAttribute('aria-label')?.includes('Ada'),
      'KanbanView avatar group does not name who is responsible');
    assert([...avatars.children].every((face) => face.getAttribute('aria-hidden') === 'true'),
      'KanbanView announced each avatar separately instead of once as a group');
    assert(component.el.querySelector('[data-rule]').getAttribute('aria-description').includes('in flight'),
      'KanbanView did not carry the rule description into the accessible description');
    // A lane limit reports capacity the way a column limit does.
    component.setSwimlanes([{ id: 'north', label: 'North', limit: 1 }, { id: 'south', label: 'South' }]);
    assert(component.el.querySelector('.zx-kanban-view__lane[data-wip]'),
      'KanbanView did not report lane capacity');
    // The built-in search control coalesces keystrokes rather than rebuilding on every one.
    const searchInput = component.el.querySelector('.zx-kanban-view__search-input');
    searchInput.value = 'zzz-no-such-card';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    assert(component.getSearch() === '', 'KanbanView search control did not coalesce keystrokes');
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert(component.getSearch() === 'zzz-no-such-card', 'KanbanView search control never applied');
    component.setSearch('');
    assert(component.el.querySelector('.zx-kanban-view__add'), 'KanbanView did not render its add control');
    const adds = observe(component, 'recordadd');
    component.el.querySelector('.zx-kanban-view__add').click();
    adds.expect();

    // One selected card picked up carries the whole selection through one atomic move.
    const multi = new zx.KanbanView(null, {
      fields: recordViewFields(), recordId: 'id', titleField: 'title', selectable: 'multi',
      columnBy: 'status', columns: [{ id: 'new', label: 'New' }, { id: 'won', label: 'Won' }],
      data: [
        { id: 'm-1', title: 'One', status: 'new' },
        { id: 'm-2', title: 'Two', status: 'new' },
        { id: 'm-3', title: 'Three', status: 'new' }
      ]
    });
    try {
      component.el.append(multi.el);
      multi.setSelection(['m-1', 'm-3']);
      assert(multi._movingIds('m-1').join(',') === 'm-1,m-3',
        'KanbanView did not pick up the whole selection');
      assert(multi._movingIds('m-2').join(',') === 'm-2',
        'KanbanView dragged the selection along with an unselected card');
      const atomic = observe(multi, 'recordmove');
      multi.moveRecords(['m-3', 'm-1'], { column: 'won', index: 0 });
      atomic.expect();
      assert(multi.getData().filter((record) => record.status === 'won')
        .map((record) => record.id).join(',') === 'm-1,m-3',
      'KanbanView multi-card move lost the relative order of its cards');
      assert(multi.getRecord('m-1').status === 'won' && multi.getRecord('m-3').status === 'won',
        'KanbanView multi-card move was not atomic');
      multi.undo();
      assert(multi.getData().every((record) => record.status === 'new'),
        'KanbanView undo did not revert the whole multi-card move in one step');
    } finally {
      multi.destroy();
    }

    // A pointer drag must reach the same commit path as the keyboard and the public API.
    const dragCard = component.el.querySelector('.zx-record-card');
    const dragHandle = dragCard.querySelector('.zx-kanban-view__move-handle');
    const targetList = [...component.el.querySelectorAll('.zx-kanban-view__cards')]
      .find((list) => list !== dragCard.parentElement && !list.hidden);
    if (dragHandle && targetList) {
      const origin = dragHandle.getBoundingClientRect();
      const destination = targetList.getBoundingClientRect();
      const pointer = (type, x, y) => dragHandle.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0,
        clientX: x, clientY: y
      }));
      pointer('pointerdown', origin.left + 4, origin.top + 4);
      pointer('pointermove', origin.left + 40, origin.top + 40);
      assert(component.el.querySelector('.zx-kanban-view__drag-preview'),
        'KanbanView pointer drag did not show a drag preview');
      pointer('pointermove', destination.left + destination.width / 2, destination.bottom - 4);
      pointer('pointerup', destination.left + destination.width / 2, destination.bottom - 4);
      assert(!component.el.querySelector('.zx-kanban-view__drag-preview'),
        'KanbanView left its drag preview behind');
      assert(!component.el.querySelector('[data-dragging]'),
        'KanbanView left a card marked as dragging');
      assert(!component.el.querySelector('[data-drop]'),
        'KanbanView left a drop marker behind');
    }

    // renderCard replaces the shared middle; the anatomy and rule badges answer to their own
    // options and must survive it. The demo proves the opt-out, this proves the coexistence.
    const layered = new zx.KanbanView(null, {
      fields: recordViewFields(), data: recordViewData(), recordId: 'id', titleField: 'title',
      columnBy: 'status', columns: [{ id: 'new', label: 'New' }, { id: 'open', label: 'Open' }],
      identifier: 'id', status: 'status', progress: () => 40, assignees: 'owner',
      rules: [{ id: 'all', when: () => true, tone: 'accent', label: 'Rule' }],
      renderCard: ({ record }) => Object.assign(document.createElement('p'),
        { className: 'smoke-custom-card', textContent: record.title })
    });
    try {
      component.el.append(layered.el);
      const custom = layered.el.querySelector('.zx-record-card[data-custom-card="true"]');
      assert(custom?.querySelector('.smoke-custom-card'), 'renderCard content was not adopted');
      assert(custom.querySelector('.zx-kanban-view__card-head')
        && custom.querySelector('.zx-kanban-view__progress-track')
        && custom.querySelector('.zx-kanban-view__avatars')
        && custom.querySelector('.zx-kanban-view__rules'),
      'renderCard dropped anatomy and rules the host explicitly configured');
      assert(custom.getAttribute('aria-label') && !custom.getAttribute('aria-labelledby'),
        'a replaced card body lost its accessible name');
    } finally {
      layered.destroy();
    }

    // A blocked policy refuses the move outright instead of warning about it.
    const blocking = new zx.KanbanView(null, {
      fields: recordViewFields(), data: recordViewData(), recordId: 'id', titleField: 'title',
      columnBy: 'status', wipPolicy: 'block',
      columns: [{ id: 'new', label: 'New' }, { id: 'open', label: 'Open', limit: 0, from: ['new'] },
        { id: 'won', label: 'Won', from: ['open'] }]
    });
    try {
      component.el.append(blocking.el);
      const rejections = observe(blocking, 'movereject');
      const untouched = blocking.getRecord('opp-1').status;
      blocking.moveRecord('opp-1', { column: 'open', index: 0 });
      rejections.expect();
      assert(blocking.getRecord('opp-1').status === untouched,
        'A blocked KanbanView move mutated data anyway');
      await Promise.resolve();
      assert(blocking.el.querySelector('.zx-kanban-view__live').textContent.includes('rejected'),
        'A blocked KanbanView move was not announced');
    } finally {
      blocking.destroy();
    }

    const derived = new zx.KanbanView(null, {
      fields: recordViewFields(), data: [], recordId: 'id', titleField: 'title',
      columnBy: 'status', swimlaneBy: 'team'
    });
    const external = new zx.KanbanView(null, {
      fields: recordViewFields(), data: recordViewData(), recordId: 'id', titleField: 'title',
      columnBy: 'status', columns: [{ id: 'new', label: 'New' }, { id: 'open', label: 'Open' }],
      moveMode: 'external'
    });
    try {
      // Announcements intentionally update only connected live regions. Mount this secondary
      // fixture so the external-mode assertion exercises the same accessible behavior as a real view.
      component.el.append(external.el);
      derived.setViewState({
        version: 1,
        columnOrder: ['open', 'new'],
        swimlaneOrder: ['south', 'north'],
        collapsedColumns: ['open'],
        collapsedSwimlanes: ['south']
      });
      assert(derived.getViewState().columnOrder.join(',') === 'open,new',
        'KanbanView discarded saved derived columns while empty');
      derived.setData(recordViewData());
      assert(derived.getColumnOrder().join(',') === 'open,new'
        && derived.getSwimlaneOrder().join(',') === 'south,north'
        && derived.getCollapsedColumns().includes('open')
        && derived.getCollapsedSwimlanes().includes('south'),
      'KanbanView did not reconcile pending derived state after data arrived');

      external.el.addEventListener('zx-recordmove', (event) => event.preventDefault(), { once: true });
      external.moveRecord('opp-1', { column: 'open', index: 0 });
      await Promise.resolve();
      assert(external.el.querySelector('.zx-kanban-view__live').textContent.includes('canceled'),
        'External KanbanView did not honor mirrored DOM cancellation');
    } finally {
      derived.destroy();
      external.destroy();
    }
  }),
  recordViewsTargetCase(),
  componentCase('Table', () => new zx.Table(null, {
    columns: [{ id: 'id', label: 'ID', sortable: true }, { id: 'name', label: 'Name' }],
    data: [{ id: 1, name: 'One' }], rowId: 'id', selectable: 'single'
  }), (component) => {
    const events = observe(component, 'datachange');
    component.setData([{ id: 2, name: 'Two' }]).setSelection([2]).setSort('id', 'desc');
    assert(component.getData()[0].id === 2 && component.getSelection()[0].id === 2, 'table data/selection mismatch');
    events.expect();
  }),
  componentCase('Table (double-click edit compatibility)', () => new zx.Table(null, {
    rowId: 'id', editMode: 'cell', editTrigger: 'double',
    columns: [{ id: 'name', label: 'Name', editable: true }],
    data: [{ id: 1, name: 'One' }]
  }), (component) => {
    const cell = component.el.querySelector('td[data-column="name"]');
    cell.click();
    assert(!component.isEditing(), 'double-click Table began editing after one click');
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    assert(component.isEditing(), 'double-click Table compatibility did not open its editor');
    component.cancelEdit();
  }),
  tableInteractionGuardsCase(),
  componentCase('Grid', () => zx.Grid.BillingItems(null, {
    data: [
      { id: 'group', parent: null, kind: 'group', item: 'Services', total: 100, currency: 'EUR' },
      { id: 'line', parent: 'group', kind: 'line', item: 'Consulting', quantity: 2, unit: 'hours', unitPrice: 50, total: 100, currency: 'EUR' },
      { id: 'support', parent: 'group', kind: 'line', item: 'Support', quantity: 1, unit: 'hours', unitPrice: 25, total: 25, currency: 'EUR' }
    ],
    units: { hours: 'Hours' },
    currencies: { EUR: 'Euro' }
  }), async (component) => {
    assert(component instanceof zx.Table, 'Grid stopped inheriting Table');
    assert(component.el.dataset.preset === 'billing-items', 'billing preset marker missing');
    assert(component.getExpanded()[0] === 'group', 'billing hierarchy did not expand');
    assert(component.el.querySelector('.zx-table__column-controls'), 'billing column chooser missing');
    const editable = component.el.querySelector('td[data-editable="true"]');
    editable.click();
    assert(component.el.querySelector('td[data-editing="true"]'), 'billing cell did not edit on one click');
    component.cancelEdit();

    const moves = observe(component, 'rowmove');
    const handles = component.el.querySelectorAll('.zx-table__row-handle');
    handles[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    handles[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await Promise.resolve();
    assert(component.getData().findIndex((row) => row.id === 'line')
      > component.getData().findIndex((row) => row.id === 'support'), 'keyboard row move failed');
    assert(component.el.querySelector('.zx-table__reorder-status').textContent.includes('Moved row'),
      'keyboard row move was not announced');
    moves.expect();

    const visibility = observe(component, 'columnvisibilitychange');
    component.setColumnVisible('total', false);
    assert(component.getHiddenColumns().includes('total'), 'billing column did not hide');
    visibility.expect();
  }),
  billingGridTargetCase(),
  chartCase(),
  calendarCase(),
  calendarControlledCase(),
  calendarTargetCase(),
  componentCase('DataFilter', () => new zx.DataFilter(null, {
    filters: [{ type: 'text', id: 'query', label: 'Search', fields: ['name'] }],
    data: [{ name: 'Alpha' }, { name: 'Beta' }]
  }), (component) => {
    const events = observe(component, 'filter');
    component.setState({ query: 'alp' });
    assert(component.apply().length === 1, 'filter result mismatch');
    events.expect();
  }),
  componentCase('Filter', () => {
    const requests = [];
    const component = new zx.Filter(null, {
      fields: [{
        id: 'status', label: 'Status', type: 'status', defaultOperator: 'eq',
        choices: [{ value: 'paid', label: 'Paid' }, { value: 'open', label: 'Open' }]
      }, { id: 'archived', label: 'Archived', type: 'boolean', defaultOperator: 'eq' }, {
        id: 'owner', label: 'Owner', type: 'entity', defaultOperator: 'eq', debounce: 0,
        loadChoices: ({ query, signal }) => {
          requests.push({ query, signal });
          if (query !== 'first') return [{ value: 'ada', label: 'Ada Lovelace' }];
          return new Promise((resolve) => signal.addEventListener('abort', () => resolve([]), { once: true }));
        }
      }]
    });
    component._smokeRequests = requests;
    return component;
  }, async (component) => {
    const changes = observe(component, 'change');
    const applies = observe(component, 'apply');
    const id = component.addCondition(null, { field: 'status', operator: 'eq', value: 'paid' });
    assert(id && component.validate().valid, 'valid dynamic filter did not validate');
    changes.expect();
    const value = component.apply();
    assert(value?.version === 1 && value.root.children[0].value === 'paid', 'Filter did not return its AST');
    applies.expect();
    component.update(id, { field: 'archived', operator: 'eq', value: true });
    const booleanEditor = component.el.querySelector(`[data-node-id="${id}"] [data-filter-value]`);
    assert(booleanEditor?.localName === 'select' && booleanEditor.options.length === 3,
      'boolean Filter field did not render an explicit True/False editor');
    component.update(id, { field: 'owner', operator: 'eq', value: null });
    const asyncEditor = component.el.querySelector(`[data-node-id="${id}"] [data-filter-value]`);
    asyncEditor.value = 'first';
    asyncEditor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert(asyncEditor.getAttribute('aria-busy') === 'true', 'async Filter editor did not expose busy state');
    asyncEditor.value = 'second';
    asyncEditor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert(component._smokeRequests.length === 2 && component._smokeRequests[0].signal.aborted,
      'replaced Filter query did not abort its loader');
    assert(!asyncEditor.hasAttribute('aria-busy') && component.el.querySelector('datalist option')?.value === 'ada',
      'latest Filter query did not settle its choices and busy state');
    component.setReadonly(true);
    assert(component.addCondition() === null && component.el.querySelector('[data-filter-action="apply"]:not(:disabled)'),
      'readonly Filter did not preserve inspection/apply while blocking mutation');
    component.setReadonly(false);
    component.disable();
    assert(component.apply() === null && [...component.el.querySelectorAll('button')].every((button) => button.disabled),
      'disabled Filter retained actionable controls');
    component.enable();
    const groupId = component.addGroup();
    await Promise.resolve();
    assert(groupId && component.el.querySelector(`[data-node-id="${groupId}"]`)?.contains(document.activeElement),
      'adding a Filter group dropped keyboard focus');
    component.addCondition(groupId, { field: 'status', operator: 'eq', value: 'paid' });
    await Promise.resolve();
    component.remove(groupId);
    await Promise.resolve();
    assert(component.el.contains(document.activeElement) && document.activeElement !== document.body,
      'removing a Filter group dropped keyboard focus');
    component.clear();
    assert(component.getValue().root.children.length === 0, 'Filter clear failed');
  }),
  ...['CardView', 'KanbanView'].map((kind) => componentCase(`${kind} (card selection)`, () => new zx[kind](null, {
    fields: [{id: 'name', label: 'Name'}], data: [{ID: 1, name: 'One'}, {ID: 2, name: 'Two'}],
    titleField: 'name', selectable: 'multi', selectionTrigger: 'card', fieldControls: false,
    columnBy: () => 'all', columns: [{id: 'all', label: 'All'}], dragFrom: 'handle', history: false,
    link: () => '#record', actions: [{id: 'inspect', label: 'Inspect'}]
  }), (component) => {
    const cards = component.el.querySelectorAll('.zx-record-card');
    assert(!component.el.querySelector('[data-record-selection]'), 'card mode rendered a checkbox');
    cards[0].click();
    assert(component.getSelectionIds().length === 1, 'card click did not select');
    cards[1].dispatchEvent(new MouseEvent('click', {bubbles: true, shiftKey: true}));
    assert(component.getSelectionIds().length === 2, 'card range selection failed');
    cards[0].dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    assert(component.getSelectionIds().length === 1, 'Enter did not toggle the focused card');
    cards[0].dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true}));
    assert(component.getSelectionIds().length === 2, 'Space did not toggle selection');
    const link = cards[0].querySelector('a');
    component.listen(link, 'click', event => event.preventDefault());
    link.click(); cards[0].querySelector('[data-record-action]').click();
    assert(component.getSelectionIds().length === 2, 'interactive descendants toggled selection');
    assert(cards[0].getAttribute('aria-description')?.includes('Selected'), 'selection was not announced');
    component.setSelection([]);
    assert(cards[0].dataset.selected === 'false', 'clear selection did not update the card');
  })),
  artifactCase('button (shortcut hint)', () => {
    const element = zx.button({label: 'New', shortcut: {label: 'N', keys: 'N'}});
    return {element, exercise: () => {
      assert(element.getAttribute('aria-keyshortcuts') === 'N', 'shortcut is not exposed to assistive technology');
      assert(element.querySelector('kbd')?.textContent === 'N', 'visible shortcut missing');
      assert(element.title === 'New (N)', 'hover shortcut missing');
    }};
  }),
  componentCase('SortControl', () => new zx.SortControl(null, {
    fields: [{id: 'name', label: 'Name'}, {id: 'created', label: 'Created'}],
    value: {id: 'name', dir: 'asc'}, label: 'Sort records'
  }), (component) => {
    const changes = [], domChanges = [];
    component.on('change', ({detail}) => changes.push(detail.value));
    component.listen(component.el, 'zx-change', ({detail}) => domChanges.push(detail.value));
    const input = component.el.querySelector('[role="combobox"]');
    const direction = component.el.querySelector('.zx-sort-control__direction');
    assert(input.value === 'Name' && input.getAttribute('aria-label') === 'Sort records', 'field label must omit direction');
    assert(direction.getAttribute('aria-label') === 'Sort records: Ascending', 'current direction needs an accessible name');
    direction.focus(); direction.click();
    assert(document.activeElement === direction && component.getValue().dir === 'desc', 'direction toggle lost focus or state');
    assert(direction.title === 'Descending → Ascending', 'direction hover hint is stale');
    assert(changes.length === 1 && domChanges.length === 1, 'direction must emit exactly one atomic change');
    input.click();
    assert(component.el.querySelectorAll('[role="option"]').length === 2, 'fields should appear exactly once');
    input.value = 'Created'; input.dispatchEvent(new InputEvent('input', {bubbles: true}));
    assert(component.getValue().id === 'name' && changes.length === 1, 'uncommitted query changed sort');
    const choices = component.el.querySelectorAll('[role="option"]');
    assert(choices.length === 1, 'field search retained direction permutations');
    choices[0].click();
    assert(component.getValue().id === 'created' && component.getValue().dir === 'desc', 'field choice did not preserve direction');
    assert(input.value === 'Created' && changes.length === 2 && domChanges.length === 2, 'field change duplicated the DOM event');
    component.setValue({id: 'created', dir: 'desc'});
    component.setValue({id: 'name', dir: 'asc'}, {silent: true});
    assert(changes.length === 2 && domChanges.length === 2 && input.value === 'Name', 'silent or unchanged set emitted a change');
    assert(direction.dataset.direction === 'asc', 'silent set did not update direction');
    input.click(); component.disable();
    assert(input.disabled && direction.disabled && input.getAttribute('aria-expanded') === 'false', 'disable must affect both controls and close choices');
    direction.click(); assert(changes.length === 2, 'disabled toggle changed sort');
    component.enable(); assert(!input.disabled && !direction.disabled, 'enable must affect both controls');
    direction.click();
    component.setValue(null);
    assert(component.getValue().id === 'name' && component.getValue().dir === 'asc', 'reset failed');
    const copy = component.getValue(); copy.dir = 'desc';
    assert(component.getValue().dir === 'asc', 'getValue leaked state');
    component.focus(); assert(document.activeElement === input, 'focus should reach the field');
    input.click(); // generic lifecycle check disposes an open popover
  }),
  componentCase('SortControl (empty)', () => new zx.SortControl(null), (component) => {
    component.enable();
    assert(component.getValue() === null, 'empty catalogue should return null');
    assert(component.el.querySelector('[role="combobox"]').disabled, 'empty field must stay disabled');
    assert(component.el.querySelector('.zx-sort-control__direction').disabled, 'empty direction must stay disabled');
  }),
  {
    name: 'SortControl (enhanced target)',
    create(fixture) {
      const target = document.createElement('div');
      target.className = 'caller-sort'; target.dataset.keep = 'yes';
      target.append(document.createTextNode('Original sort content')); fixture.append(target);
      const before = target.outerHTML;
      const component = new zx.SortControl(target, {
        fields: [{id: 'name', label: 'Name'}], disabled: true,
        value: {id: 'name', dir: 'desc'}, label: 'Sortieren', labels: {asc: 'Aufsteigend', desc: 'Absteigend'}
      });
      return {component, target, before};
    },
    exercise({component}) {
      const direction = component.el.querySelector('.zx-sort-control__direction');
      assert(direction.disabled, 'initial disabled state was ignored');
      component.enable();
      assert(direction.getAttribute('aria-label') === 'Sortieren: Absteigend', 'initial direction localization failed');
      assert(direction.title === 'Absteigend → Aufsteigend', 'localized hover action is missing');
      direction.click();
    },
    destroy({component, target, before}) {
      const direction = component.el.querySelector('.zx-sort-control__direction');
      const selectRoot = component.el.querySelector('.zx-select');
      const value = JSON.stringify(component.getValue());
      component.destroy(); direction.click();
      assert(JSON.stringify(component.getValue()) === value, 'destroyed direction listener still runs');
      assert(!zx.Component.from(selectRoot), 'owned Select was not disposed');
      assert(target.outerHTML === before, 'SortControl did not restore its target');
      const again = new zx.SortControl(target, {fields: [{id: 'name', label: 'Name'}]});
      again.destroy();
      assert(target.outerHTML === before, 'SortControl second enhancement did not restore target');
      target.remove();
    }
  },
  componentCase('Filter (searchable compact)', () => new zx.Filter(null, {
    fields: [{id: 'name', label: 'Name', type: 'text'}, {id: 'type', label: 'Type', type: 'enum', choices: [{value: 0, label: 'Zero'}, {value: 1, label: 'One'}]}],
    searchable: true, layout: 'compact', rootLogic: 'and', showApply: false, showRootActions: false, allowGroups: false
  }), async (component) => {
    const id = component.addCondition(null, {field: 'name', operator: 'contains', value: 'Example'});
    assert(component.el.querySelectorAll('[data-filter-action="add"]').length === 1, 'embedded filter must have one Add control');
    assert(!component.el.querySelector('[data-filter-action="apply"]'), 'external Apply must not leave a duplicate button');
    const picker = component.el.querySelector('[data-filter-focus="field"]');
    picker.click(); picker.value = 'Type'; picker.dispatchEvent(new InputEvent('input', {bubbles: true}));
    const option = component.el.querySelector('[role="option"]');
    assert(option.textContent.includes('Type'), 'field search did not find Type');
    option.click(); await Promise.resolve(); await Promise.resolve();
    assert(component.getValue().root.children[0].field === 'type', 'field selection did not reach the AST');
    const value = component.el.querySelector('[data-filter-focus="value"]');
    value.click();
    component.el.querySelector('[data-filter-focus="value"]').closest('.zx-select').querySelector('[role="option"]').click();
    await Promise.resolve();
    assert(component.getValue().root.children[0].value === 0, 'searchable enum must preserve numeric zero');
    const old = component.el.querySelector('.zx-select');
    component.remove(id); await Promise.resolve();
    assert(!old.isConnected && !zx.Component.from(old), 'removed filter leaked a Select instance');
    assert(component.el.contains(document.activeElement), 'removal lost focus');
  }),
  componentCase('FilterPanel', () => new zx.FilterPanel(null, {
    fields: {
      status: {
        type: 'select',
        label: 'Status',
        options: [{ value: 1, label: 'Open' }, { value: 2, label: 'Closed' }]
      },
      created: { type: 'date:range', label: 'Created' },
      amount: { type: 'float:range', label: 'Amount', min: 0, max: 1000 }
    },
    value: { status: [1] }
  }), (component) => {
    const events = observe(component, 'apply');
    // `0` is a constraint; the empty string beside it is not. The panel's whole
    // contract is that it can tell those apart.
    component.setValue({ status: [1], amount: { from: 0, to: '' } });
    component.apply();
    events.expect();
    const value = component.getValue();
    assert(Array.isArray(value.status) && value.status.length === 1, 'select value mismatch');
    assert(value.amount && value.amount.from === 0, 'a zero range bound was pruned');
    assert(!('created' in value), 'an untouched filter reached the value');
    component.clear();
    assert(Object.keys(component.getValue()).length === 0, 'clear left a constraint behind');
  }),
  componentCase('ListToolbar', () => new zx.ListToolbar(null, {
    search: { placeholder: 'Search records' },
    views: ['auto', 'cards', 'table'],
    tools: [{ id: 'filters', icon: 'filter', label: 'Filters', badge: 2 }]
  }), (component) => {
    const events = observe(component, 'viewchange');
    component.setView('cards');
    assert(component.getView() === 'cards', 'view did not change');
    events.expect();

    // The badge is part of the button's NAME, not a second thing beside it — a tool
    // that reads "Filters" while showing a 2 is the bug this component exists to stop.
    const tool = component.getTool('filters');
    assert(tool && /\(2\)/.test(tool.getAttribute('aria-label') || ''), 'badge missing from the accessible name');
    component.setBadge('filters', null);
    assert(!/\(/.test(tool.getAttribute('aria-label') || ''), 'badge survived its own removal');

    component.setCount(20);
    component.setCount(null);
  }),
  componentCase('ViewSettings', () => new zx.ViewSettings(null, {
    fields: [
      { id: 'name', label: 'Name', type: 'text', locked: true },
      { id: 'stage', label: 'Stage', type: 'status' },
      { id: 'value', label: 'Value', type: 'money' },
      { id: 'owner', label: 'Owner', type: 'select' },
      { id: 'close', label: 'Close date', type: 'date', visible: false }
    ],
    board: { columnBy: 'stage', swimlaneBy: null }
  }), (component) => {
    const root = component.toElement();
    assert(root.getAttribute('role') === 'region' && root.getAttribute('aria-label'), 'region is unnamed');
    assert(root.querySelectorAll('.zx-view-settings__list > li').length === 4, 'shown list mismatch');
    assert(!root.querySelector('[data-field-id="name"] [data-action="handle"]'), 'a locked field has a handle');

    const order = observe(component, 'fieldorderchange');
    component.moveField('owner', 0);
    assert(component.getState().fieldOrder.indexOf('owner') === 1, 'owner did not move behind the locked title');
    order.expect();

    const visibility = observe(component, 'fieldvisibilitychange');
    component.showField('close');
    assert(!component.getState().hiddenFields.includes('close'), 'close was not shown');
    component.hideField('name');
    assert(!component.getState().hiddenFields.includes('name'), 'a locked field was hidden');
    visibility.expect();

    const group = observe(component, 'groupchange');
    component.setState({ groupBy: 'stage' });
    assert(component.getState().groupBy === 'stage', 'groupBy not applied');
    group.expect();

    // Bound to a record view, a column hidden here disappears there, and back.
    const view = new zx.TableView(null, {
      fields: [{ id: 'name', label: 'Name' }, { id: 'stage', label: 'Stage' }, { id: 'owner', label: 'Owner' }],
      data: [{ ID: 1, name: 'A', stage: 'won', owner: 'x' }],
      fieldControls: false
    });
    component.bind(view);
    component.hideField('stage');
    assert(view.getHiddenFields().includes('stage'), 'bound view did not follow a hide');
    view.setFieldVisible('stage', true);
    assert(!component.getState().hiddenFields.includes('stage'), 'settings did not follow the view');
    component.unbind();
    view.destroy();
  }),
  componentCase('StatTile', () => new zx.StatTile(null, {
    label: 'Awaiting acceptance', value: 3, delta: 2, deltaLabel: 'vs. last week', kind: 'warning'
  }), (component) => {
    const name = component.getAccessibleName();
    assert(name.includes('Awaiting acceptance') && name.includes('3'), 'accessible name is incomplete');
    // Spoken, not glyphed: a screen reader must not be read a bare arrow.
    assert(!name.includes('+') && !name.includes('\u2212'), 'the delta reached the name as a sign');
    component.update({ loading: true });
    assert(component.toElement().getAttribute('aria-busy') === 'true', 'loading did not set aria-busy');
    component.update({ loading: false });
    assert(component.toElement().getAttribute('aria-busy') !== 'true', 'aria-busy survived loading');
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
  fieldChangeCountCase(),
  fieldsetExternalCase(),
  componentCase('Form', () => new zx.Form(null, {
    fieldsets: [{ fields: { name: { type: 'text', label: 'Name' } } }]
  }), (component) => {
    component.setValue('name', 'Ada');
    assert(component.getValues().name === 'Ada' && component.submit(), 'form value/submit mismatch');
  }),
  componentCase('Questionnaire', () => new zx.Questionnaire(null, {
    review: true,
    items: questionnaireItems()
  }), async (component) => {
    const changes = observe(component, 'change');
    const navigations = observe(component, 'navigate');

    // A required question refuses to be left, and says so where a screen reader will hear it.
    assert(await component.next() === false, 'an unanswered required question advanced');
    assert(component.el.querySelector('.zx-questionnaire__error:not([hidden])'), 'no error was shown');

    // Answering by clicking the real radio, which is what a reader does.
    component.el.querySelector('.zx-questionnaire__control[data-index="0"]').click();
    changes.expect();
    assert(await component.next(), 'answering did not unblock the question');
    navigations.expect();
    assert(component.getActive() === 'vat', 'the company branch did not open');

    // Going back and switching branches must take the VAT question, and its answer, with it.
    component.setAnswer('vat', 'DE123');
    assert(component.previous(), 'previous() failed');
    component.el.querySelector('.zx-questionnaire__control[data-index="1"]').click();
    assert(await component.next(), 'next() failed after switching branches');
    assert(component.getActive() === 'contact', 'the branch did not close');
    assert(!('vat' in component.getAnswers()), 'an abandoned branch kept its answer');

    component.setAnswer('contact', 'ada@example.com');
    assert(await component.next(), 'entering review failed');
    assert(component.getActive() === null && component.el.dataset.state === 'review', 'review not entered');

    const submits = observe(component, 'submit');
    assert(await component.submit(), 'submit failed');
    submits.expect();
    assert([...component.toFormData().keys()].join(',') === 'type,contact', 'form data mismatch');
    component.reset();
    assert(component.getActive() === 'type', 'reset did not return to the first question');
  }),
  questionnaireTargetCase(),
  componentCase('ValueList', () => new zx.ValueList(null, { values: ['one'] }), (component) => {
    const events = observe(component, 'change');
    component.setValues(['two']);
    assert(component.getValues()[0] === 'two', 'value list mismatch');
    events.expect();
  }),
  componentCase('CodeEditor', () => new zx.CodeEditor(null, {
    value: 'one\ntwo', language: 'text', indent: '  ', rows: 4
  }), (component) => {
    const events = observe(component, 'change');
    component.setValue('alpha\nbeta').setLanguage('json').focus();
    assert(component.getValue() === 'alpha\nbeta', 'CodeEditor set/get mismatch');
    assert(component.el.dataset.language === 'json', 'CodeEditor language did not update');
    component.setReadOnly(true);
    assert(component.el.querySelector('textarea').readOnly, 'CodeEditor read-only state did not update');
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
  tableHierarchyCase(),
  tableKeyboardCase(),
  tableTreegridKeyboardCase(),
  toolbarRovingInputCase(),
  recordViewChooserFocusCase(),
  fileListFocusCase(),
  activityListFocusCase(),
  recordViewFieldTargetCase(),
  filterRelativeDateCase(),
  truncateCase(),
  sizeContainerCase(),
  positionRtlCase(),
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

/*
 * One user edit is one field `change`, whatever widget the field type wraps: the widgets that
 * report their own commits must not also let their inner control's native `change` reach the
 * Field. Each edit drives the control the way a person does (typing then leaving the input,
 * clicking an option), with the events a browser fires for it.
 */
/** @returns {SmokeDefinition} */
function fieldChangeCountCase() {
  /** @type {Record<string, {field: Record<string, unknown>, edit: (field: any) => unknown, value: unknown, inputs?: boolean}>} */
  const edits = {
    text: { field: { type: 'text' }, edit: (field) => typeAndLeave(field.getInput(), 'Ada'), value: 'Ada' },
    password: { field: { type: 'password' }, edit: (field) => typeAndLeave(field.getInput(), 'pw'), value: 'pw' },
    textarea: { field: { type: 'textarea' }, edit: (field) => typeAndLeave(field.getInput(), 'Notes'), value: 'Notes' },
    int: { field: { type: 'int' }, edit: (field) => typeAndLeave(field.getInput(), '42'), value: 42 },
    float: { field: { type: 'float' }, edit: (field) => typeAndLeave(field.getInput(), '1,5'), value: 1.5 },
    checkbox: { field: { type: 'checkbox' }, edit: (field) => field.getInput().click(), value: true },
    select: {
      field: { type: 'select', options: ['a', 'b'], value: 'a' },
      edit: (field) => { field.getInput().value = 'b'; fire(field.getInput(), 'input'); fire(field.getInput(), 'change'); },
      value: 'b'
    },
    optionlist: {
      field: { type: 'optionlist', options: ['a', 'b'], value: 'a' },
      edit: (field) => field.getInput().querySelectorAll('input')[1].click(),
      value: 'b'
    },
    number: {
      field: { type: 'number', value: 1 },
      edit: (field) => typeAndLeave(field.getInput().querySelector('input'), '7'),
      value: 7
    },
    slider: {
      field: { type: 'slider', value: 10 },
      edit: (field) => {
        const range = field.getInput().querySelector('input[type="range"]');
        for (const step of ['20', '30', '40']) { range.value = step; fire(range, 'input'); }
        fire(range, 'change');
      },
      value: 40,
      inputs: true
    },
    rating: {
      field: { type: 'rating', value: 2 },
      edit: (field) => field.getInput().querySelector('[role="radio"][data-value="4"]').click(),
      value: 4
    },
    code: {
      field: { type: 'code', value: '' },
      edit: (field) => {
        const textarea = field.getInput().querySelector('textarea');
        for (const text of ['a', 'ab', 'abc']) { textarea.value = text; fire(textarea, 'input'); }
        fire(textarea, 'change');
        textarea.dispatchEvent(new FocusEvent('blur'));
      },
      value: 'abc',
      inputs: true
    },
    toggle: { field: { type: 'toggle', props: { value: 'yes' } }, edit: (field) => field.getInput().click(), value: 'yes' },
    zxselect: {
      field: { type: 'zxselect', props: { items: sampleItems() }, value: 1 },
      edit: (field) => {
        const select = field.getInput();
        select.querySelector('input[role="combobox"], input').click();
        const option = [...document.querySelectorAll('[role="option"]')]
          .find((candidate) => candidate.textContent.trim() === 'Two' && select.contains(candidate));
        assert(option, 'zxselect option not found');
        option.click();
      },
      value: 2
    },
    time: {
      field: { type: 'time', value: 60 },
      edit: (field) => typeAndLeave(field.getInput().querySelector('input'), '2'),
      value: null
    },
    checklist: {
      field: { type: 'checklist', props: { items: sampleItems(), search: false } },
      edit: (field) => field.getInput().querySelector('input[type="checkbox"]').click(),
      value: [1]
    }
  };
  return {
    name: 'Field (one change per edit)',
    create(fixture) {
      const fields = Object.entries(edits).map(([type, { field }]) => {
        const instance = new zx.Field(null, { label: type, ...field });
        fixture.append(instance.toElement());
        return [type, instance];
      });
      return { fields };
    },
    exercise({ fields }) {
      const failures = [];
      for (const [type, field] of fields) {
        const definition = edits[type];
        let changes = 0;
        let domChanges = 0;
        let inputs = 0;
        const before = JSON.stringify(field.getValue());
        field.on('change', () => { changes += 1; });
        field.on('input', () => { inputs += 1; });
        field.el.addEventListener('zx-change', (event) => { if (event.target === field.el) domChanges += 1; });
        definition.edit(field);
        const value = field.getValue();
        if (changes !== 1 || domChanges !== 1) failures.push(`${type}: ${changes} change event(s)`);
        if (definition.value !== null && JSON.stringify(value) !== JSON.stringify(definition.value)) {
          failures.push(`${type}: value ${JSON.stringify(value)}, expected ${JSON.stringify(definition.value)}`);
        }
        if (definition.value === null && JSON.stringify(value) === before) failures.push(`${type}: value did not change`);
        if (definition.inputs && inputs < 1) failures.push(`${type}: no input event`);
      }
      assert(failures.length === 0, failures.join('; '));
    },
    destroy: ({ fields }) => { for (const [, field] of fields) field.destroy(); }
  };
}

/*
 * `Fieldset.addField(id, component)` adopts a component that is not a registered field type and
 * must drive it through the component's own API: value, disabled state, read-only state where it
 * has one, and one `change` per user edit.
 */
/** @returns {SmokeDefinition} */
function fieldsetExternalCase() {
  const sources = () => ({
    count: [new zx.NumberField(null, { value: 1, min: 0, max: 10 }), 4, 4],
    owner: [new zx.Select(null, { items: sampleItems(), value: 1 }), 2, 2],
    share: [new zx.Slider(null, { label: 'Share', value: 10 }), 30, 30],
    score: [new zx.Rating(null, { value: 1 }), 3, 3],
    active: [new zx.Toggle(null, { label: 'Active', value: 'yes' }), true, 'yes'],
    pinned: [new zx.CheckButton(null, { label: 'Pinned' }), true, true],
    due: [new zx.Datebox(null, { value: date(20) }), date(22), date(22)],
    spent: [new zx.Timebox(null, { value: 60 }), 90, 90],
    email: [Object.assign(document.createElement('input'), { value: 'a@example.com' }), 'b@example.com', 'b@example.com'],
    agree: [Object.assign(document.createElement('input'), { type: 'checkbox' }), true, true]
  });
  return {
    name: 'Fieldset (external components)',
    create(fixture) {
      const entries = sources();
      const fieldset = new zx.Fieldset(null, { columns: 2 });
      for (const [key, [source]] of Object.entries(entries)) fieldset.addField(key, source);
      fixture.append(fieldset.toElement());
      return { component: fieldset, entries };
    },
    exercise({ component, entries }) {
      const failures = [];
      const initial = component.getValues();
      const expected = { count: 1, owner: 1, share: 10, score: 1, active: false, pinned: false, spent: 60, email: 'a@example.com', agree: false };
      for (const [key, value] of Object.entries(expected)) {
        if (JSON.stringify(initial[key]) !== JSON.stringify(value)) failures.push(`${key} read ${JSON.stringify(initial[key])}`);
      }
      if (!(initial.due instanceof Date) || initial.due.getDate() !== 20) failures.push('due did not read its date');

      for (const [key, [, next, read]] of Object.entries(entries)) {
        component.setValue(key, next);
        const value = component.getValue(key);
        const same = read instanceof Date ? value instanceof Date && value.getTime() === read.getTime() : value === read;
        if (!same) failures.push(`${key} set ${JSON.stringify(next)} read ${JSON.stringify(value)}`);
      }

      for (const [key, [source]] of Object.entries(entries)) {
        const field = component.getField(key);
        field.setDisabled(true);
        const controls = [...(source instanceof Element ? [source] : source.el.querySelectorAll('input, button'))]
          .filter((control) => !(control.closest('[popover]')) && control.type !== 'hidden');
        const element = source instanceof Element ? source : source.el;
        const disabled = (element.matches('button, input') && element.disabled) || controls.some((control) => control.disabled)
          || element.getAttribute('aria-disabled') === 'true';
        if (!disabled) failures.push(`${key} was not disabled`);
        field.setDisabled(false);
        const enabled = !(element.matches('button, input') && element.disabled) && element.getAttribute('aria-disabled') !== 'true';
        if (!enabled) failures.push(`${key} was not enabled again`);
      }

      component.getField('count').setReadonly(true);
      if (!entries.count[0].el.querySelector('input').readOnly) failures.push('count was not made read-only');
      component.getField('count').setReadonly(false);

      // One user edit, one change: a component that reports the edit and whose input also fires.
      let changes = 0;
      component.getField('count').on('change', () => { changes += 1; });
      typeAndLeave(entries.count[0].el.querySelector('input'), '6');
      if (changes !== 1) failures.push(`NumberField edit emitted ${changes} change(s)`);
      changes = 0;
      component.getField('share').on('change', () => { changes += 1; });
      const range = entries.share[0].el.querySelector('input[type="range"]');
      range.value = '50';
      fire(range, 'input');
      fire(range, 'change');
      if (changes !== 1) failures.push(`Slider edit emitted ${changes} change(s)`);
      changes = 0;
      component.getField('active').on('change', () => { changes += 1; });
      entries.active[0].el.click();
      if (changes !== 1) failures.push(`Toggle click emitted ${changes} change(s)`);
      changes = 0;
      component.getField('email').on('change', () => { changes += 1; });
      typeAndLeave(entries.email[0], 'c@example.com');
      if (changes !== 1) failures.push(`input edit emitted ${changes} change(s)`);

      assert(failures.length === 0, failures.join('; '));
    },
    destroy({ component, entries }) {
      component.destroy();
      for (const [source] of Object.values(entries)) {
        if (source instanceof Element) source.remove();
        else source.destroy();
      }
    }
  };
}

/** Types into a text control and leaves it, firing what a browser fires. @param {HTMLInputElement|HTMLTextAreaElement} input @param {string} value @returns {void} */
function typeAndLeave(input, value) {
  input.value = value;
  fire(input, 'input');
  fire(input, 'change');
  input.dispatchEvent(new FocusEvent('blur'));
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

/** @param {EventTarget} target @param {string} type @returns {void} */
function fire(target, type) {
  target.dispatchEvent(new Event(type, { bubbles: true }));
}

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

/** Exercises exact teardown for the preset attribute added after Select construction. @returns {SmokeDefinition} */
function selectEntityTargetCase() {
  return {
    name: 'Select (entity preset target)',
    create(fixture) {
      const target = document.createElement('div');
      target.className = 'application-select';
      target.dataset.keep = 'yes';
      target.append(document.createTextNode('original entity target'));
      fixture.append(target);
      const before = target.outerHTML;
      const component = zx.Select.entity(target, {
        items: [{ ID: 1, name: 'Account' }], value: 1
      });
      return { component, target, before };
    },
    exercise({ component }) {
      assert(component.el.dataset.preset === 'entity', 'entity preset marker missing');
    },
    destroy({ component, target, before }) {
      component.destroy();
      assert(target.outerHTML === before, `Select.entity() did not restore its target: ${target.outerHTML}`);
      target.remove();
    }
  };
}

/** Covers edit/content/focus/privacy interactions that need a real browser event path. @returns {SmokeDefinition} */
function tableInteractionGuardsCase() {
  return {
    name: 'Table (interactive edit guards)',
    create(fixture) {
      let buttonClicks = 0;
      const component = new zx.Table(null, {
        rowId: 'id', editMode: 'row', editTrigger: 'single', rowReorder: true,
        columnVisibility: true, hiddenColumns: ['secret'],
        columns: [{
          id: 'name', label: 'Name', editable: true,
          render: (row) => {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = row.name;
            button.addEventListener('click', () => { buttonClicks += 1; });
            return button;
          }
        }, { id: 'secret', label: 'Secret', editable: true }],
        data: [{ id: 'record-42', name: 'Open record', secret: 'private' }]
      });
      fixture.append(component.toElement());
      return { component, clicks: () => buttonClicks };
    },
    async exercise({ component, clicks }) {
      component.el.querySelector('td[data-column="name"] button').click();
      assert(clicks() === 1 && !component.isEditing(), 'interactive cell content was replaced by single-click editing');

      component.startEdit('record-42', 'secret');
      const visibleEditor = component.el.querySelector('td[data-column="name"] .zx-table__editor');
      assert(component.getEditing()?.columnId === 'name'
        && visibleEditor?.contains(document.activeElement),
      'row editing did not fall back from a hidden column to the visible editor');
      component.cancelEdit();

      const hiddenToggle = [...component.el.querySelectorAll('.zx-table__column-toggle')]
        .find((input) => input.value === 'secret');
      hiddenToggle.closest('details').open = true;
      hiddenToggle.focus();
      hiddenToggle.click();
      await Promise.resolve();
      assert(document.activeElement?.classList.contains('zx-table__column-toggle')
        && document.activeElement.value === 'secret', 'column visibility rerender dropped checkbox focus');

      const transfer = new DataTransfer();
      component.el.querySelector('.zx-table__row-handle').dispatchEvent(new DragEvent('dragstart', {
        bubbles: true, cancelable: true, dataTransfer: transfer
      }));
      assert(transfer.getData('text/plain') === 'zx-table-row'
        && !transfer.getData('text/plain').includes('record-42'), 'row drag exported its application ID');
      component.el.querySelector('.zx-table__row-handle').dispatchEvent(new DragEvent('dragend', { bubbles: true }));
      await Promise.resolve();
    },
    destroy({ component }) { component.destroy(); }
  };
}

/** Exercises the explicit-target Launcher contract and exact target restoration. @returns {SmokeDefinition} */
function launcherTargetCase() {
  return {
    name: 'Launcher (existing target)',
    create(fixture) {
      const dialog = document.createElement('dialog');
      dialog.dataset.keep = 'yes';
      dialog.append(document.createTextNode('original launcher content'));
      fixture.append(dialog);
      const before = dialog.outerHTML;
      const component = new zx.Launcher(dialog, { items: [{ id: 'home', label: 'Home' }] });
      return { component, dialog, before };
    },
    exercise({ component }) {
      component.open();
      assert(component.isOpen(), 'enhanced launcher target did not open');
      component.close();
    },
    destroy({ component, dialog, before }) {
      component.destroy();
      assert(dialog.outerHTML === before, `Launcher did not restore its target: ${dialog.outerHTML}`);
      dialog.remove();
    }
  };
}

/** Exercises Card enhancement and exact target restoration. @returns {SmokeDefinition} */
function cardTargetCase() {
  return {
    name: 'Card (existing target)',
    create(fixture) {
      const rejected = document.createElement('section');
      rejected.dataset.keep = 'rejected';
      rejected.append(document.createTextNode('original rejected target'));
      fixture.append(rejected);
      const rejectedBefore = rejected.outerHTML;
      let threw = false;
      try {
        new zx.Card(rejected, { title: 'Unsafe', link: 'java\nscript:alert(1)' });
      } catch { threw = true; }
      assert(threw, 'unsafe Card construction did not throw');
      assert(rejected.outerHTML === rejectedBefore,
        `rejected Card construction corrupted its target: ${rejected.outerHTML}`);
      rejected.remove();
      const target = document.createElement('section');
      target.dataset.keep = 'yes';
      target.append(document.createTextNode('original card content'));
      fixture.append(target);
      const before = target.outerHTML;
      const component = new zx.Card(target, { title: 'Enhanced card' });
      return { component, target, before };
    },
    exercise({ component }) {
      assert(component.refs.content.textContent === 'original card content',
        'Card did not adopt enhanced children');
      component.setFooter('Footer').setActions([{ label: 'Action' }]);
    },
    destroy({ component, target, before }) {
      component.destroy();
      assert(target.outerHTML === before, `Card did not restore its target: ${target.outerHTML}`);
      target.remove();
    }
  };
}

/** Exercises BillingItems enhancement and exact target restoration. @returns {SmokeDefinition} */
function billingGridTargetCase() {
  return {
    name: 'Grid (existing billing target)',
    create(fixture) {
      const target = document.createElement('section');
      target.dataset.keep = 'yes';
      target.setAttribute('aria-busy', 'mixed');
      target.append(document.createTextNode('original grid content'));
      fixture.append(target);
      const before = target.outerHTML;
      const component = zx.Grid.BillingItems(target, { data: [] });
      return { component, target, before };
    },
    exercise({ component }) {
      component.setLoading(true);
      component._setStacked(true);
      assert(component.el.dataset.preset === 'billing-items', 'enhanced billing preset marker missing');
    },
    destroy({ component, target, before }) {
      component.destroy();
      assert(target.outerHTML === before, `Grid did not restore its target: ${target.outerHTML}`);
      target.remove();
    }
  };
}

/** Exercises Chart host lifecycle, semantic summary, and exact adapter destruction. @returns {SmokeDefinition} */
function chartCase() {
  return {
    name: 'Chart',
    create(fixture) {
      const instance = { data: null, destroyed: false };
      const component = new zx.Chart(null, {
        adapter: {
          create(_canvas, spec) {
            instance.data = spec.data;
            return {
              instance,
              update(next) { instance.data = next.data; },
              resize() {},
              destroy() { instance.destroyed = true; }
            };
          }
        },
        label: '   ',
        data: { labels: ['Jan'], datasets: [{ label: 'Revenue', data: [42] }] }
      });
      fixture.append(component.toElement());
      return { component, instance };
    },
    exercise({ component }) {
      assert(component.getInstance(), 'chart adapter was not mounted');
      assert(component.refs.canvas.getAttribute('aria-label') === 'Chart'
        && component.el.querySelector('.zx-chart__table caption').textContent === 'Chart',
      'blank chart label did not fall back to an accessible canvas and summary name');
      component.setData({ labels: ['Feb'], datasets: [{ label: 'Revenue', data: [84] }] }).resize();
      assert(component.el.querySelector('.zx-chart__table').textContent.includes('84'),
        'chart summary did not update');
      component.setError(false);
      assert(component.el.dataset.state === 'error' && component.refs.viewport.hidden
        && !component.refs.status.hidden && component.refs.status.textContent === component.options.errorText,
      'a falsy chart error left the component visually ready');
      component.clearError().setError(new Error(''));
      assert(component.el.dataset.state === 'error' && !component.refs.status.hidden
        && component.refs.status.textContent === component.options.errorText,
      'an empty chart error hid its fallback status');
      component.clearError();
    },
    destroy({ component, instance }) {
      component.destroy();
      assert(instance.destroyed, 'chart adapter handle was not destroyed');
    }
  };
}

/** Exercises every Calendar view plus keyboard move/resize and optimistic rollback. @returns {SmokeDefinition} */
function calendarCase() {
  return {
    name: 'Calendar',
    create(fixture) {
      const component = new zx.Calendar(null, {
        date: new Date(2026, 7, 25),
        now: new Date(2026, 7, 25, 10, 15),
        view: 'week',
        editable: true,
        selectable: true,
        slotMinTime: 480,
        slotMaxTime: 1080,
        events: [{
          id: 'work', title: 'Project kickoff', location: 'Room 2', color: '#13795b',
          start: new Date(2026, 7, 25, 9), end: new Date(2026, 7, 25, 10)
        }, {
          id: 'focus', title: 'Focus time', color: '#597087',
          start: new Date(2026, 7, 25, 10, 30), end: new Date(2026, 7, 25, 11)
        }, {
          id: 'span', title: 'Quarterly planning', allDay: true,
          start: new Date(2026, 7, 26), end: new Date(2026, 7, 28)
        }]
      });
      fixture.append(component.toElement());
      return { component };
    },
    exercise({ component }) {
      const views = observe(component, 'viewchange');
      for (const view of ['agenda', 'day', 'month', 'year', 'week']) {
        component.setView(view);
        assert(component.getView() === view && component.el.dataset.view === view,
          `Calendar did not render ${view}`);
      }
      component.setView('agenda');
      assert(component.el.querySelectorAll('.zx-calendar__agenda-day[data-date="2026-08-25"] .zx-calendar__agenda-events > .zx-calendar__event').length === 2,
        'Calendar agenda misplaced multiple events outside the agenda event column');
      component.setView('month');
      const monthWeek = component.el.querySelector('.zx-calendar__month-week');
      const monthDay = monthWeek.querySelector('.zx-calendar__month-day');
      const monthDays = monthWeek.querySelector('.zx-calendar__month-days');
      const monthEvents = monthWeek.querySelector('.zx-calendar__month-events');
      assert(getComputedStyle(monthDays).gridRowStart === getComputedStyle(monthEvents).gridRowStart,
        'Calendar month split date cells and events into stacked grid rows');
      assert(Math.abs(monthDay.getBoundingClientRect().height - monthWeek.getBoundingClientRect().height) <= 1,
        'Calendar month day boundaries did not span the full week row');
      assert(getComputedStyle(monthDay).borderRadius === '0px',
        'Calendar month retained rounded structural day cells');
      component.setView('week');
      views.expect();
      assert(component.el.querySelectorAll('.zx-calendar__view-button').length === 5,
        'Calendar omitted a configured view control');
      assert(getComputedStyle(component.el).borderRadius === '0px',
        'Calendar retained rounded outer grid corners');
      assert(getComputedStyle(component.el.querySelector('.zx-calendar__day-heading')).borderRadius === '0px',
        'Calendar retained rounded week column headers');
      assert(getComputedStyle(component.el.querySelector('.zx-calendar__slot')).borderRadius === '0px',
        'Calendar retained rounded week time-grid cells');
      assert(component.el.querySelector('.zx-calendar__now:not([hidden])'),
        'Calendar did not render the deterministic now indicator');

      component.setView('day');
      assert(getComputedStyle(component.el.querySelector('.zx-calendar__day-heading')).borderRadius === '0px',
        'Calendar retained rounded day-view column headers');
      assert(getComputedStyle(component.el.querySelector('.zx-calendar__slot')).borderRadius === '0px',
        'Calendar retained rounded day-view time-grid cells');
      component.setView('week');

      let change = null;
      component.on('eventchange', (event) => { change = event.detail; });
      const moves = observe(component, 'eventchange');
      const control = component.el.querySelector('[data-event-id="work"][data-event-action="activate"]');
      control.focus();
      control.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      control.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      assert(component.getEvents().find((event) => event.id === 'work').start.getDate() === 26,
        'optimistic keyboard move did not update local data');
      assert(change?.action === 'move' && change.revert(), 'Calendar move did not expose a working revert');
      assert(component.getEvents().find((event) => event.id === 'work').start.getDate() === 25,
        'Calendar revert did not restore the old event');
      assert(change.revert() === false, 'Calendar revert was not idempotent');
      moves.expect();

      const slots = component.el.querySelector('.zx-calendar__slots').getBoundingClientRect();
      const dayWidth = slots.width / 7;
      const slotHeight = slots.height / Number(component.el.querySelector('[role="grid"]').getAttribute('aria-rowcount'));
      const pointerMove = observe(component, 'eventchange');
      const dragControl = component.el.querySelector('[data-event-id="work"][data-event-action="activate"]');
      const dragRect = dragControl.getBoundingClientRect();
      const dragStart = { x: dragRect.left + dragRect.width / 2, y: dragRect.top + dragRect.height / 2 };
      dragControl.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, button: 0, pointerId: 41, clientX: dragStart.x, clientY: dragStart.y
      }));
      component.el.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, pointerId: 41, clientX: dragStart.x + dayWidth, clientY: dragStart.y + slotHeight * 2
      }));
      component.el.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, pointerId: 41, clientX: dragStart.x + dayWidth, clientY: dragStart.y + slotHeight * 2
      }));
      const dragged = component.getEvents().find((event) => event.id === 'work');
      assert(dragged.start.getDate() === 26 && dragged.start.getHours() === 10,
        `Calendar pointer move dropped at ${dragged.start}`);
      pointerMove.expect();

      component.updateEvent('work', {
        start: new Date(2026, 7, 25, 9),
        end: new Date(2026, 7, 25, 10)
      }, { silent: true });
      const pointerResize = observe(component, 'eventchange');
      const resizeHandle = component.el.querySelector('[data-event-id="work"][data-event-action="resize"]');
      const resizeWrapper = resizeHandle.closest('.zx-calendar__event');
      const resizeRect = resizeHandle.getBoundingClientRect();
      const resizeStart = { x: resizeRect.left + resizeRect.width / 2, y: resizeRect.top + resizeRect.height / 2 };
      resizeHandle.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, button: 0, pointerId: 42, clientX: resizeStart.x, clientY: resizeStart.y
      }));
      component.el.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, pointerId: 42, clientX: resizeStart.x + dayWidth, clientY: resizeStart.y + slotHeight * 2
      }));
      assert(resizeWrapper.style.transform === '' && resizeWrapper.style.blockSize,
        'Calendar pointer resize translated the event instead of stretching it');
      component.el.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, pointerId: 42, clientX: resizeStart.x + dayWidth, clientY: resizeStart.y + slotHeight * 2
      }));
      const resized = component.getEvents().find((event) => event.id === 'work');
      assert(resized.end.getTime() - resized.start.getTime() === 7_200_000,
        `Calendar pointer resize produced ${resized.start} to ${resized.end}`);
      pointerResize.expect();

      component.setLoading(true);
      assert(component.el.getAttribute('aria-busy') === 'true' && !component.refs.loading.hidden,
        'Calendar loading state was not exposed');
      component.setLoading(false);
      const changes = observe(component, 'eventschange');
      component.updateEvent('work', { title: 'Updated kickoff' });
      assert(component.getEvents().find((event) => event.id === 'work').title === 'Updated kickoff',
        'Calendar updateEvent did not update data');
      changes.expect();
    },
    destroy({ component }) { component.destroy(); }
  };
}

/** Proves that optimistic:false emits a proposal while leaving local data untouched. @returns {SmokeDefinition} */
function calendarControlledCase() {
  return {
    name: 'Calendar (controlled updates)',
    create(fixture) {
      const component = new zx.Calendar(null, {
        date: new Date(2026, 7, 25), view: 'day', views: ['day'], editable: true,
        optimistic: false, slotMinTime: 480, slotMaxTime: 1080,
        events: [{ id: 'controlled', title: 'Controlled event', start: new Date(2026, 7, 25, 9), end: new Date(2026, 7, 25, 10) }]
      });
      fixture.append(component.toElement());
      return { component };
    },
    exercise({ component }) {
      const original = component.getEvents()[0].start.getTime();
      let proposal = null;
      component.on('eventchange', (event) => { proposal = event.detail.event; });
      const control = component.el.querySelector('[data-event-action="activate"]');
      control.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      control.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      assert(proposal?.start.getTime() > original, 'controlled Calendar did not emit its proposal');
      assert(component.getEvents()[0].start.getTime() === original,
        'controlled Calendar mutated local data before acceptance');
      component.updateEvent('controlled', proposal, { silent: true });
      assert(component.getEvents()[0].start.getTime() === proposal.start.getTime(),
        'controlled Calendar could not apply the accepted event');
    },
    destroy({ component }) { component.destroy(); }
  };
}

/** Exercises exact restoration when Calendar enhances an existing target. @returns {SmokeDefinition} */
function calendarTargetCase() {
  return {
    name: 'Calendar (existing target)',
    create(fixture) {
      const target = document.createElement('section');
      target.dataset.keep = 'yes';
      target.setAttribute('aria-label', 'Original schedule');
      target.append(document.createTextNode('original calendar content'));
      fixture.append(target);
      const before = target.outerHTML;
      const component = new zx.Calendar(target, { date: new Date(2026, 7, 25), events: [] });
      return { component, target, before };
    },
    exercise({ component }) {
      component.setView('agenda').setLoading(true).setLoading(false);
    },
    destroy({ component, target, before }) {
      component.destroy();
      assert(target.outerHTML === before, `Calendar did not restore its target: ${target.outerHTML}`);
      target.remove();
    }
  };
}

/** A branching intake: answering "company" opens a VAT question that "private" leaves out. */
function questionnaireItems() {
  return [
    { name: 'type', prompt: 'Who is buying?', required: true, choices: [
      { value: 'company', label: 'A company' },
      { value: 'private', label: 'A private buyer' }
    ] },
    { name: 'vat', prompt: 'VAT id', input: {}, when: (answers) => answers.type === 'company' },
    { name: 'contact', prompt: 'How do we reach you?', input: {} }
  ];
}

/** Shared fields used to prove that all record views accept the same schema. */
function recordViewFields() {
  return [
    { id: 'title', label: 'Opportunity', sortable: true },
    { id: 'owner', label: 'Owner', sortable: true },
    { id: 'amount', label: 'Amount', type: 'currency', sortable: true },
    { id: 'status', label: 'Status' },
    { id: 'team', label: 'Team' }
  ];
}

/** Shared records used by TableView, CardView, and KanbanView smoke cases. */
function recordViewData() {
  return [
    {
      id: 'opp-1', title: 'Alpine rollout', owner: 'Ada', amount: 42000,
      status: 'new', team: 'north', preview: 'javascript:alert(1)'
    },
    {
      id: 'opp-2', title: 'Borealis renewal', owner: 'Grace', amount: 28000,
      status: 'open', team: 'south', preview: null
    }
  ];
}

/** Proves exact enhanced-target restoration for the shared base and every concrete record view. */
function recordViewsTargetCase() {
  return {
    name: 'RecordView (existing targets)',
    create(fixture) {
      const constructors = [
        (target) => new zx.RecordView(target, {
          fields: recordViewFields(), data: recordViewData(), recordId: 'id'
        }),
        (target) => new zx.TableView(target, {
          fields: recordViewFields(), data: recordViewData(), recordId: 'id'
        }),
        (target) => new zx.CardView(target, {
          fields: recordViewFields(), data: recordViewData(), recordId: 'id', titleField: 'title'
        }),
        (target) => new zx.KanbanView(target, {
          fields: recordViewFields(), data: recordViewData(), recordId: 'id', titleField: 'title',
          columnBy: 'status', columns: [{ id: 'new', label: 'New' }, { id: 'open', label: 'Open' }]
        })
      ];
      const targets = constructors.map((create, index) => {
        const target = document.createElement('section');
        target.dataset.keep = `view-${index}`;
        target.setAttribute('aria-label', `Original view ${index}`);
        target.append(document.createTextNode(`original view content ${index}`));
        fixture.append(target);
        const before = target.outerHTML;
        return { target, before, component: create(target) };
      });
      return { targets };
    },
    exercise({ targets }) {
      for (const { component } of targets) {
        component.setFieldVisible('amount', false);
        component.setSort('title', 'asc');
      }
    },
    destroy({ targets }) {
      for (const { component, target, before } of targets) {
        component.destroy();
        component.destroy();
        assert(target.outerHTML === before,
          `${component.constructor.name} did not restore its target: ${target.outerHTML}`);
        target.remove();
      }
    }
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
      const select = new zx.Select(null, { items: sampleItems(), value: 1, label: 'Nested choice' });
      const component = new zx.Dropdown(anchor, { content: select.el, openOn: 'manual' });
      fixture.append(component.toElement());
      return { component, anchor, select };
    },
    exercise({ component, anchor, select }) {
      const events = observe(component, 'open');
      component.open();
      assert(component.isOpen(), 'open failed');
      events.expect();
      select.focus();
      select.open();
      const input = select.el.querySelector('[role="combobox"]');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      assert(input.getAttribute('aria-expanded') === 'false', 'first Escape closes nested choices');
      assert(component.isOpen(), 'handled Escape must not close the parent panel');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      assert(!component.isOpen(), 'second Escape closes the parent panel');
      assert(document.activeElement === anchor, 'parent Escape restores trigger focus');
    },
    destroy({ component, anchor, select }) {
      select.destroy();
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

/**
 * The other Questionnaire case creates its own root. This one takes over an element that already
 * has content, which is a different code path: the component builds an inner `<form>` so its
 * radios group against a form owner rather than the whole document, and `destroy()` has to put the
 * target back exactly as it was found. The runner creates and destroys every case twice, so the
 * re-create half of the contract comes for free.
 * @returns {SmokeDefinition}
 */
function questionnaireTargetCase() {
  return {
    name: 'Questionnaire (existing target)',
    create(fixture) {
      const stage = document.createElement('div');
      stage.dataset.keep = 'yes';
      stage.append(document.createTextNode('original content'));
      fixture.append(stage);
      const before = stage.outerHTML;
      const component = new zx.Questionnaire(stage, {
        // `name` stays off the start of a line: smoke-coverage.test.js scrapes case names with a
        // `^\s*name: '...',$` regex and would read this item as a case naming a missing export.
        items: [{ name: 'a', prompt: 'Pick one',
          choices: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] }]
      });
      return { component, stage, before };
    },
    exercise({ component, stage }) {
      const form = stage.querySelector('form');
      assert(form, 'no inner form was created for a non-form target');
      const input = /** @type {HTMLInputElement} */ (stage.querySelector('input'));
      assert(input.form === form, 'the choices are not owned by the inner form');
      input.click();
      assert(component.getAnswer('a') === 'x', 'answering an enhanced target failed');
    },
    destroy({ component, stage, before }) {
      component.destroy();
      assert(stage.outerHTML === before, `destroy() did not restore the target: ${stage.outerHTML}`);
      stage.remove();
    }
  };
}

/** @returns {SmokeDefinition} */
function dockCase() {
  return {
    name: 'Dock',
    create(fixture) {
      // Panes are measured against a real box, so the target needs a height of its own.
      const stage = document.createElement('div');
      stage.style.blockSize = '320px';
      fixture.append(stage);
      const component = new zx.Dock(stage, {
        panes: [
          { name: 'summary', title: 'Summary', content: 'Totals', size: 120 },
          {
            name: 'files', size: 100, active: 'notes', tabs: [
              { name: 'docs', title: 'Documents', content: () => document.createTextNode('Docs') },
              { name: 'notes', title: 'Notes', content: 'Notes' }
            ]
          },
          { name: 'audit', title: 'Audit', content: 'Log', grow: true }
        ]
      });
      return { component, stage };
    },
    exercise({ component }) {
      const collapses = observe(component, 'collapse');
      component.collapse('summary');
      assert(component.isCollapsed('summary'), 'collapse failed');
      collapses.expect();

      const expands = observe(component, 'expand');
      component.expand('summary');
      assert(!component.isCollapsed('summary'), 'expand failed');
      expands.expect();

      assert(component.getActive('files') === 'notes', 'initial active tab ignored');
      const tabs = observe(component, 'tabchange');
      component.activate('files', 'docs');
      assert(component.getActive('files') === 'docs', 'activate failed');
      tabs.expect();

      const reveals = observe(component, 'reveal');
      component.reveal('notes');
      assert(component.getActive('files') === 'notes', 'reveal did not activate the tab');
      reveals.expect();

      component.setSize('summary', 160);
      assert(Math.round(component.getSize('summary')) === 160, 'setSize failed');

      const state = component.state();
      component.collapse('audit');
      component.setState(state);
      assert(!component.isCollapsed('audit'), 'setState did not restore the collapsed set');

      assert(component.el.querySelectorAll(':scope > .zx-dock__divider').length === 2,
        'divider count does not match the pane count');
      component.add({ name: 'extra', title: 'Extra', content: 'More' }, { index: 0 });
      assert(component.names()[0] === 'extra', 'add(index) ignored its position');
      component.remove('extra');
      assert(!component.pane('extra'), 'remove failed');
    },
    destroy({ component, stage }) {
      component.destroy();
      stage.remove();
    }
  };
}

/** @returns {SmokeDefinition} */
function adoptionCase() {
  return {
    name: 'Dock (adoption)',
    create(fixture) {
      const stage = document.createElement('div');
      stage.style.blockSize = '240px';
      stage.style.inlineSize = '600px';
      fixture.append(stage);
      const dock = new zx.Dock(null, { orientation: 'horizontal', content: 'Table' });
      stage.append(dock.toElement());
      const sheet = new zx.Sheet(null, {
        title: 'Detail', content: 'Body', side: 'end', size: 200, scope: fixture, modal: false
      });
      return { dock, sheet, stage };
    },
    async exercise({ dock, sheet, stage }) {
      const changes = observe(sheet, 'dockchange');
      dock.adopt(sheet, { side: 'end', size: 200 });
      assert(sheet.isDocked(), 'adopt did not dock the sheet');
      assert(sheet.el.parentElement === dock.el, 'adopted sheet is not in the dock');
      changes.expect();

      sheet.open();
      assert(sheet.isOpen(), 'docked open failed');
      assert(!sheet.el.matches(':modal'), 'a docked sheet must not enter the top layer');

      // The handoff round-trips through the native dialog; it must stay silent and lossless.
      let closes = 0;
      sheet.on('close', () => { closes += 1; });
      dock.release(sheet);
      assert(!sheet.isDocked(), 'release did not float the sheet');
      assert(sheet.el.parentElement === stage.closest('.zx-scope'),
        `released sheet did not return to its configured theme scope (${sheet.el.parentElement?.id
          || sheet.el.parentElement?.className || sheet.el.parentElement?.tagName})`);
      assert(sheet.isOpen(), 'release closed the sheet');
      assert(closes === 0, 'the re-hosting handoff emitted a close event');

      dock.adopt(sheet, { side: 'end', size: 200 });
      dock.release(sheet);
      dock.adopt(sheet, { side: 'end', size: 200 });
      dock.release(sheet);
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert(!sheet.isDocked(), 'repeated handoffs did not leave the sheet floating');
      assert(sheet.isOpen() && sheet.el.dataset.state === 'open',
        'a queued handoff close invalidated the live presentation');
      assert(closes === 0, `repeated handoffs emitted ${closes} close event(s)`);

      dock.adopt(sheet, { side: 'end', size: 200 });
      dock.destroy();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert(!sheet.isDocked(), 'destroying the dock did not release the sheet');
      assert(sheet.isOpen() && sheet.el.dataset.state === 'open',
        'destroying the dock closed a sheet it did not own');
      assert(closes === 0, 'destroying the dock emitted a sheet close event');

      sheet.close();
      sheet.open();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert(sheet.isOpen() && sheet.el.dataset.state === 'open',
        'a stale close event invalidated a reopened presentation');
      assert(closes === 0, 'close then reopen emitted a stale close event');

      sheet.close();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert(!sheet.isOpen() && sheet.el.dataset.state === 'closed',
        `final close did not settle (${JSON.stringify({
          open: sheet.isOpen(), state: sheet.el.dataset.state,
          popover: sheet.el.matches(':popover-open'), dialogOpen: sheet.el.open, closes
        })})`);
      assert(closes === 1, `final close emitted ${closes} close event(s)`);
    },
    destroy({ dock, sheet, stage }) {
      sheet.destroy();
      dock.destroy();
      stage.remove();
    }
  };
}

/** @returns {SmokeDefinition} */
function sheetStackCase() {
  return {
    name: 'SheetStack',
    create() {
      const stack = new zx.SheetStack({ layout: 'stack', max: 3 });
      const sheets = ['A', 'B', 'C'].map((title) =>
        new zx.Sheet(null, { title, content: title, side: 'end', size: 240 }));
      return { stack, sheets };
    },
    exercise({ stack, sheets }) {
      const [a, b, c] = sheets;
      const pushes = [];
      stack.on('push', (event) => pushes.push(event.detail.sheet));
      stack.push(a).push(b).push(c);
      assert(stack.size() === 3, 'push did not stack');
      assert(stack.top() === c, 'top is not the last pushed sheet');
      assert(pushes.length === 3, 'push event did not fire per sheet');
      assert(c.el.dataset.depth === '0' && a.el.dataset.depth === '2', 'depths are not numbered from the top');
      // A covered sheet in a drill-down must leave the tab order.
      assert(a.el.inert && b.el.inert && !c.el.inert, 'inertness does not follow depth');

      const pops = [];
      stack.on('pop', (event) => pops.push(event.detail.sheet));
      assert(stack.pop() === c, 'pop did not return the top sheet');
      assert(stack.size() === 2 && stack.top() === b, 'pop left the stack wrong');
      assert(pops.length === 1, 'pop event did not fire');

      stack.popTo(a);
      assert(stack.size() === 1 && stack.top() === a, 'popTo did not unwind to its target');
      stack.clear();
      assert(stack.size() === 0, 'clear left sheets behind');

      // The stack never owned the sheets, so destroying it must not take them down.
      stack.push(a);
      stack.destroy();
      assert(a.isOpen(), 'destroying the stack closed a sheet it did not own');
      assert(!a.el.dataset.depth, 'destroying the stack left depth styling behind');
      a.close();
    },
    destroy({ stack, sheets }) {
      stack.destroy();
      for (const sheet of sheets) sheet.destroy();
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
        items: [
          { type: 'heading', label: 'Record' },
          { label: 'Open', value: 'open', description: 'Open details', shortcut: 'Enter' },
          { label: 'Selected', value: 'selected', role: 'menuitemradio', checked: true },
          '-',
          { label: 'Delete', value: 'delete', danger: true }
        ]
      });
      return { component, region };
    },
    exercise({ component, region }) {
      const events = observe(component, 'open');
      component.openAt(20, 20, region);
      assert(component.isOpen(), 'openAt failed');
      assert(component.getContext() === region, 'context mismatch');
      const panel = document.querySelector('.zx-context-menu');
      assert(panel?.querySelector('.zx-context-menu__heading'), 'context heading missing');
      assert(panel?.querySelector('[role="menuitemradio"]')?.getAttribute('aria-checked') === 'true',
        'context checked state missing');
      events.expect();
      component.close();
      component.setItems([{ label: 'Only one', value: 'one' }]);
      component.openAtElement(region);
      assert(component.isOpen(), 'openAtElement failed');
      const cancel = (event) => event.preventDefault();
      component.on('select', cancel);
      document.querySelector('.zx-context-menu [role="menuitem"]')?.click();
      assert(component.isOpen(), 'cancelled context selection closed the menu');
      component.off('select', cancel);
      component.close();
    },
    destroy({ component, region }) {
      component.destroy();
      region.remove();
    }
  };
}

/**
 * The point under an element's centre, as the hit test sees it: inert content is skipped there, so
 * an item `showModal()` made inert reports the dialog behind it instead of itself.
 * @param {Element} element
 * @returns {Element|null}
 */
function hitAt(element) {
  const box = element.getBoundingClientRect();
  return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
}

/** A menu opened inside a modal Dialog is clickable and reachable from the keyboard. @returns {SmokeDefinition} */
function menuInDialogCase() {
  return {
    name: 'MenuButton (inside a Dialog)',
    create() {
      const body = document.createElement('div');
      const menu = new zx.MenuButton(null, {
        label: 'More',
        items: [{ label: 'Rename', value: 'rename' }, { label: 'Archive', value: 'archive' }]
      });
      body.append(menu.el);
      const dialog = new zx.Dialog(null, { title: 'Project', content: body });
      return { dialog, menu };
    },
    async exercise({ dialog, menu }) {
      const chosen = [];
      menu.on('select', (event) => chosen.push(event.detail.value));
      dialog.open();
      await nextFrame();
      menu.getTrigger().click();
      await nextFrame();
      const panel = menu.getPanel();
      const items = [...panel.querySelectorAll('[role="menuitem"]')];
      assert(panel.parentElement === dialog.el, 'the menu panel is not hosted inside the open dialog');
      assert(document.activeElement === items[0], 'opening the menu did not focus its first item');
      items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      assert(document.activeElement === items[1], 'ArrowDown did not reach the second item');
      assert(items[1].contains(hitAt(items[1])), 'the menu item is not hit-testable above the dialog');
      items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      assert(!menu.isOpen() && dialog.isOpen(), 'Escape in the menu must close the menu only');
      assert(document.activeElement === menu.getTrigger(), 'Escape did not return focus to the trigger');
      menu.focusFirst();
      [...panel.querySelectorAll('[role="menuitem"]')][1].click();
      assert(chosen.join() === 'archive' && !menu.isOpen(), 'choosing an item inside the dialog failed');
      assert(panel.parentElement !== dialog.el, 'a closed panel stayed inside the dialog');
      const closed = new Promise((resolve) => dialog.once('close', resolve));
      dialog.close();
      await closed;
    },
    destroy({ dialog, menu }) {
      menu.destroy();
      dialog.destroy();
    }
  };
}

/** A toast's action is clickable while a modal Dialog is open, and the region leaves with it. @returns {SmokeDefinition} */
function toastOverDialogCase() {
  return {
    name: 'Message (over a Dialog)',
    create() {
      return { dialog: new zx.Dialog(null, { title: 'Editing', content: 'Body' }) };
    },
    async exercise({ dialog }) {
      const ran = [];
      dialog.open();
      await nextFrame();
      const handle = zx.Message.show('Row deleted.', { timeout: 0, action: { label: 'Undo', onclick: () => ran.push('undo') } });
      await nextFrame();
      const region = document.querySelector('.zx-message-region');
      const action = region?.querySelector('.zx-message__action');
      assert(region?.parentElement === dialog.el, 'the toast region did not move into the open dialog');
      assert(action && action.contains(hitAt(action)), 'the toast action is not hit-testable over the dialog');
      action.click();
      assert(ran.join() === 'undo', 'the toast action did not run');
      handle.close();
      const kept = zx.Message.show('Still here.', { timeout: 0 });
      const closed = new Promise((resolve) => dialog.once('close', resolve));
      dialog.close();
      await closed;
      const after = document.querySelector('.zx-message-region');
      assert(after && !dialog.el.contains(after) && after.matches(':popover-open'),
        'the toast region did not return to its scope when the dialog closed');
      kept.close();
      zx.Message.disposeRegion(after);
    },
    destroy({ dialog }) {
      dialog.destroy();
    }
  };
}

/** A non-modal Sheet knows the popups it opened: they neither dismiss it nor outlive its Escape. @returns {SmokeDefinition} */
function sheetChildOverlaysCase() {
  return {
    name: 'Sheet (child overlays)',
    create() {
      const body = document.createElement('div');
      const menu = new zx.MenuButton(null, { label: 'Actions', items: [{ label: 'Duplicate', value: 'duplicate' }] });
      const anchor = zx.button({ label: 'Details' });
      body.append(menu.el, anchor);
      const dropdown = new zx.Dropdown(anchor, { content: 'Panel text', openOn: 'manual' });
      const sheet = new zx.Sheet(null, { title: 'Filters', content: body, modal: false });
      return { sheet, menu, dropdown, anchor, body };
    },
    async exercise({ sheet, menu, dropdown, anchor, body }) {
      const events = [];
      menu.on('select', (event) => events.push(`select:${event.detail.value}`));
      sheet.on('close', () => events.push('sheet-close'));
      sheet.open();
      await nextFrame();
      menu.getTrigger().click();
      const item = menu.getPanel().querySelector('[role="menuitem"]');
      item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      item.click();
      await Promise.resolve();
      assert(sheet.isOpen(), `choosing a menu item closed the sheet (${events.join()})`);
      assert(events.join() === 'select:duplicate', `unexpected events: ${events.join()}`);

      dropdown.open();
      anchor.focus();
      anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      assert(!dropdown.isOpen() && sheet.isOpen(), 'Escape closed the sheet instead of its dropdown');
      const spend = (event) => event.preventDefault();
      body.addEventListener('keydown', spend, { once: true });
      anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      assert(sheet.isOpen(), 'an Escape already handled inside the sheet still closed it');
      dropdown.open();
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      assert(!dropdown.isOpen() && !sheet.isOpen(), 'a press outside left the sheet or its dropdown open');
      sheet.open();
      dropdown.open();
      sheet.close();
      await Promise.resolve();
      assert(!dropdown.isOpen(), 'closing the sheet stranded its dropdown');
    },
    destroy({ sheet, menu, dropdown }) {
      dropdown.destroy();
      menu.destroy();
      sheet.destroy();
    }
  };
}

/** A generic Dropdown panel follows its trigger in the Tab order. @returns {SmokeDefinition} */
function dropdownTabReachCase() {
  return {
    name: 'Dropdown (Tab reach)',
    create(fixture) {
      const anchor = zx.button({ label: 'Filter' });
      const after = zx.button({ label: 'After' });
      fixture.append(anchor, after);
      const field = document.createElement('input');
      field.setAttribute('aria-label', 'Search');
      const apply = zx.button({ label: 'Apply' });
      const content = document.createElement('div');
      content.append(field, apply);
      const component = new zx.Dropdown(anchor, { content });
      return { component, anchor, after, field, apply };
    },
    exercise({ component, anchor, after, field, apply }) {
      const tab = (target, shiftKey = false) => target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab', shiftKey, bubbles: true, cancelable: true
      }));
      anchor.click();
      assert(component.isOpen(), 'the trigger did not open the panel');
      anchor.focus();
      tab(anchor);
      assert(document.activeElement === field, 'Tab from the trigger did not enter the panel');
      tab(field, true);
      assert(document.activeElement === anchor, 'Shift+Tab from the first control did not return to the trigger');
      apply.focus();
      tab(apply);
      assert(document.activeElement === after, 'Tab past the panel did not continue after the trigger');
      field.focus();
      component.close();
      assert(document.activeElement === anchor, 'closing with focus inside did not return it to the trigger');
    },
    destroy({ component, anchor, after }) {
      component.destroy();
      anchor.remove();
      after.remove();
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
      assert(cell.getAttribute('role') === 'gridcell', 'stacked cells lost their grid role');
      assert(component.el.querySelector('table').getAttribute('role') === 'grid', 'stacked table lost its role');

      host.style.inlineSize = '900px';
      await settle();
      assert(!component.isStacked(), 'did not unstack when the room came back');
      assert(!component.el.querySelector('tbody td').hasAttribute('role')
        && !component.el.querySelector('tbody').hasAttribute('role'), 'roles outlived stacked mode');
      assert(component.el.querySelector('table').getAttribute('role') === 'grid',
        'unstacking took the grid role off the table');
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

/** @returns {SmokeDefinition} */
function tableHierarchyCase() {
  return {
    name: 'Table (transaction hierarchy)',
    create(fixture) {
      const component = new zx.Table(null, {
        rowId: 'id',
        selectable: 'single',
        hierarchy: { parentId: 'parent', column: 'item', expanded: true },
        columns: [
          { id: 'item', label: 'Item' },
          { id: 'amount', label: 'Amount', type: 'currency', currency: 'EUR', locale: 'en-US' }
        ],
        data: [
          { id: 'invoice', parent: null, item: 'Invoice', amount: 1200 },
          { id: 'line', parent: 'invoice', item: 'Consulting', amount: 1200 }
        ]
      });
      fixture.append(component.toElement());
      return { component };
    },
    exercise({ component }) {
      const table = component.el.querySelector('table');
      const root = component.el.querySelector('tbody tr');
      const toggle = component.el.querySelector('.zx-table__tree-toggle');
      let rowClicks = 0;
      component.on('rowclick', () => { rowClicks += 1; });

      assert(table.getAttribute('role') === 'treegrid', 'hierarchy did not expose a treegrid');
      assert(root.getAttribute('aria-level') === '1', 'root row has the wrong aria-level');
      assert(root.getAttribute('aria-expanded') === 'true', 'root row does not expose expansion');
      assert(component.el.querySelectorAll('tbody tr[data-row]').length === 2, 'expanded child is missing');
      assert(component.el.querySelector('tbody tr:nth-child(2)').getAttribute('aria-level') === '2',
        'child row has the wrong aria-level');
      assert(component.el.querySelector('tbody tr:first-child td:last-child').textContent.includes('€'),
        'typed currency cell was not formatted');

      toggle.click();
      assert(component.getExpanded().length === 0, 'disclosure did not collapse the branch');
      assert(component.getSelection().length === 0, 'disclosure selected its row');
      assert(rowClicks === 0, 'disclosure emitted rowclick');
      assert(component.el.querySelectorAll('tbody tr[data-row]').length === 1, 'collapsed child stayed visible');

      component.updateRow('invoice', { ...component.getRow('invoice'), amount: 1250 });
      assert(component.getExpanded().length === 0, 'editing data reapplied the initial expanded state');
      assert(component.el.querySelectorAll('tbody tr[data-row]').length === 1,
        'editing data reopened a reader-collapsed branch');
    },
    destroy({ component }) {
      component.destroy();
    }
  };
}

/**
 * Sends one keydown to whatever has focus, the way the browser would.
 * @param {string} key `KeyboardEvent.key`.
 * @param {KeyboardEventInit} [init] Modifiers.
 * @returns {KeyboardEvent}
 */
function pressKey(key, init = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

/** The APG grid keyboard model on a flat table: one Tab stop, activation, selection, focus kept. @returns {SmokeDefinition} */
function tableKeyboardCase() {
  return {
    name: 'Table (grid keyboard)',
    create(fixture) {
      const component = new zx.Table(null, {
        rowId: 'id',
        selectable: 'multi',
        columns: [{ id: 'name', label: 'Name', sortable: true }, { id: 'city', label: 'City' }],
        data: [
          { id: 1, name: 'Acme GmbH', city: 'Berlin' },
          { id: 2, name: 'Borealis AB', city: 'Malmö' },
          { id: 3, name: 'Kestrel Ltd', city: 'Leeds' },
          { id: 4, name: 'Nordwind AG', city: 'Basel' }
        ]
      });
      fixture.append(component.toElement());
      return { component };
    },
    exercise({ component }) {
      const body = component.el.querySelector('tbody');
      const stops = () => [...body.querySelectorAll('[tabindex="0"]')];
      const focusedName = () => document.activeElement?.closest('tr')?.querySelector('[data-column="name"]')?.textContent;
      const clicks = [];
      component.on('rowclick', (event) => clicks.push(event.detail.id));

      assert(component.el.querySelector('table').getAttribute('role') === 'grid', 'table is not a grid');
      assert(component.el.querySelector('table').getAttribute('aria-multiselectable') === 'true',
        'multi-select grid did not say so');
      assert(component.el.dataset.focus === 'row', 'a read-only table should move focus by row');
      assert(stops().length === 1 && stops()[0].localName === 'tr', 'the body is not exactly one row Tab stop');
      assert([...body.querySelectorAll('.zx-table__row-checkbox')].every((box) => box.tabIndex === -1),
        'row checkboxes are still Tab stops');
      const checkbox = body.querySelector('.zx-table__row-checkbox');
      assert(checkbox.getAttribute('aria-label') === 'Select Acme GmbH',
        `row checkbox is named "${checkbox.getAttribute('aria-label')}"`);

      stops()[0].focus();
      assert(pressKey('ArrowDown').defaultPrevented && focusedName() === 'Borealis AB', 'ArrowDown did not move to the next row');
      pressKey('Enter');
      assert(clicks.length === 1 && clicks[0] === 2, 'Enter did not fire rowclick for the focused row');
      pressKey(' ');
      assert(component.getSelection().map((row) => row.id).join() === '2', 'Space did not select the focused row');
      assert(clicks.length === 1, 'Space fired rowclick in a selectable table');
      pressKey('ArrowDown', { shiftKey: true });
      assert(component.getSelection().map((row) => row.id).join() === '2,3', 'Shift+ArrowDown did not extend the selection');
      pressKey('ArrowUp', { shiftKey: true });
      assert(component.getSelection().map((row) => row.id).join() === '2', 'Shift+ArrowUp did not shrink the extension');
      pressKey('End');
      assert(focusedName() === 'Nordwind AG', 'End did not reach the last row');
      pressKey('Home');
      assert(focusedName() === 'Acme GmbH', 'Home did not reach the first row');
      pressKey('PageDown');
      assert(focusedName() === 'Nordwind AG', 'PageDown did not move by a page');
      pressKey('a', { ctrlKey: true });
      assert(component.getSelection().length === 4, 'Ctrl+A did not select every row');
      pressKey(' ');
      assert(component.getSelection().length === 3, 'Space did not toggle a selected row off');

      // Focus and the Tab stop follow the row through a sort, a row update, and new data.
      pressKey('ArrowUp');
      assert(focusedName() === 'Kestrel Ltd', 'ArrowUp did not move to the previous row');
      component.setSort('name', 'desc');
      assert(focusedName() === 'Kestrel Ltd' && stops().length === 1, 'sorting lost the focused row');
      component.updateRow(3, { id: 3, name: 'Kestrel plc', city: 'Leeds' });
      assert(focusedName() === 'Kestrel plc', 'updateRow lost the focused row');
      component.setData(component.getData().filter((row) => row.id !== 3));
      assert(document.activeElement?.closest('tbody') === body && stops().length === 1,
        'removing the focused row did not move focus to its neighbour');
    },
    destroy({ component }) { component.destroy(); }
  };
}

/** The APG treegrid keys, and cell focus in an editable table. @returns {SmokeDefinition} */
function tableTreegridKeyboardCase() {
  return {
    name: 'Table (treegrid keyboard)',
    create(fixture) {
      const data = [
        { id: 'a', parent: null, item: 'Alpha', amount: 1 },
        { id: 'a1', parent: 'a', item: 'Alpha one', amount: 2 },
        { id: 'b', parent: null, item: 'Beta', amount: 3 }
      ];
      const tree = new zx.Table(null, {
        rowId: 'id', hierarchy: { parentId: 'parent', column: 'item' },
        columns: [{ id: 'item', label: 'Item' }, { id: 'amount', label: 'Amount' }], data
      });
      const cells = new zx.Table(null, {
        rowId: 'id', editMode: 'cell',
        columns: [{ id: 'item', label: 'Item' }, { id: 'amount', label: 'Amount', editable: 'number' }],
        data: data.map((row) => ({ ...row, parent: null }))
      });
      fixture.append(tree.toElement(), cells.toElement());
      return { tree, cells };
    },
    exercise({ tree, cells }) {
      const focused = () => document.activeElement?.closest('tr')?.querySelector('[data-column="item"]')?.textContent;
      const toggles = [];
      tree.on('rowtoggle', (event) => toggles.push(`${event.detail.id}:${event.detail.expanded}`));
      const toggle = tree.el.querySelector('.zx-table__tree-toggle');
      assert(toggle.tabIndex === -1 && toggle.getAttribute('aria-label') === 'Expand Alpha',
        `disclosure is "${toggle.getAttribute('aria-label')}" with tabindex ${toggle.tabIndex}`);

      tree.el.querySelector('tbody tr').focus();
      pressKey('ArrowRight');
      assert(toggles.join() === 'a:true' && focused() === 'Alpha', 'ArrowRight did not expand in place');
      assert(tree.el.querySelector('tbody tr').getAttribute('aria-expanded') === 'true', 'aria-expanded did not follow');
      pressKey('ArrowRight');
      assert(focused() === 'Alpha one', 'ArrowRight on an expanded row did not move to its first child');
      assert(document.activeElement.getAttribute('aria-level') === '2', 'child row lost aria-level');
      pressKey('ArrowLeft');
      assert(focused() === 'Alpha', 'ArrowLeft on a leaf did not move to its parent');
      pressKey('ArrowLeft');
      assert(toggles.join() === 'a:true,a:false' && focused() === 'Alpha', 'ArrowLeft did not collapse in place');

      // Cell focus: editable tables move between cells, and Enter still opens the editor.
      assert(cells.el.dataset.focus === 'cell', 'an editable table should move focus by cell');
      const first = cells.el.querySelector('tbody td[tabindex="0"]');
      assert(first?.dataset.column === 'item', 'the cell Tab stop is not on the first cell');
      first.focus();
      pressKey('ArrowRight');
      assert(document.activeElement.dataset.column === 'amount', 'ArrowRight did not move to the next cell');
      pressKey('ArrowDown');
      assert(focused() === 'Alpha one' && document.activeElement.dataset.column === 'amount',
        'ArrowDown did not keep the column');
      pressKey('Enter');
      assert(cells.isEditing(), 'Enter on an editable cell did not open its editor');
      cells.cancelEdit();
      assert(document.activeElement.dataset.column === 'amount', 'cancelling did not return focus to the cell');
      pressKey('Home', { ctrlKey: true });
      assert(focused() === 'Alpha' && document.activeElement.dataset.column === 'item', 'Ctrl+Home did not reach the first cell');
    },
    destroy({ tree, cells }) {
      tree.destroy();
      cells.destroy();
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

/**
 * CSS-anchor and coordinate fallback modes share one contract in RTL: sides are physical,
 * inline start/end alignment is logical, and the offset always separates anchor and popup.
 * @returns {SmokeDefinition}
 */
function positionRtlCase() {
  return {
    name: 'position() (RTL parity)',
    create(fixture) {
      fixture.dir = 'rtl';
      const anchor = document.createElement('button');
      anchor.style.cssText = 'position: fixed; left: 280px; top: 220px; width: 72px; height: 48px';
      const floating = document.createElement('div');
      floating.style.cssText = 'box-sizing: border-box; width: 96px; height: 56px';
      fixture.append(anchor, floating);
      return { anchor, floating };
    },
    async exercise({ anchor, floating }) {
      assert(CSS.supports('anchor-name: --zx-a'), 'browser cannot compare CSS-anchor and fallback positioning');
      const supportsDescriptor = Object.getOwnPropertyDescriptor(CSS, 'supports');
      assert(supportsDescriptor?.configurable, 'CSS.supports cannot be overridden for fallback parity testing');
      const offset = 7;
      const placements = [
        'bottom-start', 'bottom-end', 'top-start', 'top-end', 'bottom', 'top',
        'right-start', 'right-end', 'left-start', 'left-end', 'right', 'left'
      ];

      for (const placement of placements) {
        const cssPosition = zx.position(anchor, floating, { placement, offset, flip: false });
        await nextFrame();
        const cssRect = rectSnapshot(floating);
        cssPosition.destroy();

        Object.defineProperty(CSS, 'supports', { ...supportsDescriptor, value: () => false });
        let fallbackPosition;
        let fallbackRect;
        try {
          fallbackPosition = zx.position(anchor, floating, { placement, offset, flip: false });
          await nextFrame();
          fallbackRect = rectSnapshot(floating);
        } finally {
          fallbackPosition?.destroy();
          Object.defineProperty(CSS, 'supports', supportsDescriptor);
        }

        for (const edge of ['left', 'right', 'top', 'bottom']) {
          assert(Math.abs(cssRect[edge] - fallbackRect[edge]) <= 1,
            `${placement} RTL CSS/fallback ${edge} differed (${cssRect[edge]} vs ${fallbackRect[edge]})`);
        }
        const anchorRect = anchor.getBoundingClientRect();
        const side = placement.split('-')[0];
        const gap = side === 'right' ? cssRect.left - anchorRect.right
          : side === 'left' ? anchorRect.left - cssRect.right
            : side === 'bottom' ? cssRect.top - anchorRect.bottom
              : anchorRect.top - cssRect.bottom;
        assert(Math.abs(gap - offset) <= 1, `${placement} RTL gap was ${gap} instead of ${offset}`);
      }
    },
    destroy({ anchor, floating }) {
      anchor.remove();
      floating.remove();
    }
  };
}

/** @param {Element} element @returns {{left: number, right: number, top: number, bottom: number}} */
function rectSnapshot(element) {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
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
  const firstResources = resourceAudit.snapshot();
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
      resourceAudit.assertRestored(firstResources);
      result.destroy = true;
    } catch (error) {
      errors.push(`destroy: ${message(error)}`);
    }
  }
  firstFixture.remove();

  const secondFixture = fixture();
  const secondResources = resourceAudit.snapshot();
  let second = null;
  try {
    second = definition.create(secondFixture);
    await definition.destroy(second);
    await Promise.resolve();
    assertEmpty(secondFixture);
    resourceAudit.assertRestored(secondResources);
    result.recreate = true;
  } catch (error) {
    errors.push(`re-create: ${message(error)}`);
    try { if (second) await definition.destroy(second); } catch { /* Original failure is reported. */ }
  }
  secondFixture.remove();
  result.error = errors.join('\n');
  return result;
}

/** Tracks body-level nodes, document listeners, and ResizeObservers created by each smoke case. */
function installResourceAudit() {
  const documentListeners = new Set();
  const nativeAdd = document.addEventListener.bind(document);
  const nativeRemove = document.removeEventListener.bind(document);
  document.addEventListener = (type, listener, options) => {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    const signal = typeof options === 'object' ? options?.signal : null;
    if (!signal?.aborted) {
      const existing = [...documentListeners].find((entry) =>
        entry.type === type && entry.listener === listener && entry.capture === capture);
      if (!existing) {
        const entry = { type, listener, capture };
        documentListeners.add(entry);
        signal?.addEventListener('abort', () => documentListeners.delete(entry), { once: true });
      }
    }
    return nativeAdd(type, listener, options);
  };
  document.removeEventListener = (type, listener, options) => {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    for (const entry of documentListeners) {
      if (entry.type === type && entry.listener === listener && entry.capture === capture) {
        documentListeners.delete(entry);
      }
    }
    return nativeRemove(type, listener, options);
  };

  const resizeObservers = new Set();
  const NativeResizeObserver = window.ResizeObserver;
  if (typeof NativeResizeObserver === 'function') {
    window.ResizeObserver = class AuditedResizeObserver extends NativeResizeObserver {
      constructor(callback) {
        super(callback);
        resizeObservers.add(this);
      }
      disconnect() {
        resizeObservers.delete(this);
        return super.disconnect();
      }
    };
  }

  const snapshot = () => ({
    bodyNodes: new Set(document.body.querySelectorAll('*')),
    documentListeners: new Set(documentListeners),
    resizeObservers: new Set(resizeObservers)
  });
  return {
    snapshot,
    assertRestored(before) {
      const after = snapshot();
      const addedNodes = [...after.bodyNodes].filter((node) => !before.bodyNodes.has(node));
      const removedNodes = [...before.bodyNodes].filter((node) => !after.bodyNodes.has(node));
      const addedListeners = [...after.documentListeners].filter((entry) => !before.documentListeners.has(entry));
      const removedListeners = [...before.documentListeners].filter((entry) => !after.documentListeners.has(entry));
      const addedObservers = [...after.resizeObservers].filter((observer) => !before.resizeObservers.has(observer));
      const removedObservers = [...before.resizeObservers].filter((observer) => !after.resizeObservers.has(observer));
      assert(addedNodes.length === 0 && removedNodes.length === 0,
        `body resource delta: +${addedNodes.length}/-${removedNodes.length} node(s)`);
      assert(addedListeners.length === 0 && removedListeners.length === 0,
        `document listener delta: +${addedListeners.length}/-${removedListeners.length}`);
      assert(addedObservers.length === 0 && removedObservers.length === 0,
        `ResizeObserver delta: +${addedObservers.length}/-${removedObservers.length}`);
    }
  };
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

/* ------------------------------------------------ audit 2026-10, defects 10–13 -- */

/** Dispatches a cancelable keydown and reports whether a handler claimed it. */
function pressOn(target, key, init = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

/**
 * A text field inside a Toolbar keeps its caret keys (defect 13): the roving tabindex only takes
 * an arrow once the caret sits at the edge, never Home/End, and follows `dir="rtl"`.
 * @returns {SmokeDefinition}
 */
function toolbarRovingInputCase() {
  return {
    name: 'Toolbar (text field and RTL)',
    create(fixture) {
      const host = document.createElement('div');
      fixture.append(host);
      const field = document.createElement('input');
      field.setAttribute('aria-label', 'Quick find');
      field.value = 'invoice';
      const component = new zx.Toolbar(null, {
        items: [{ name: 'first', label: 'First' }, field, { name: 'last', label: 'Last' }]
      });
      host.append(component.toElement());
      return { component, host, field };
    },
    async exercise({ component, host, field }) {
      const first = component.getItem('first');
      const last = component.getItem('last');
      field.focus();
      field.setSelectionRange(3, 3);
      assert(!pressOn(field, 'ArrowLeft'), 'ArrowLeft inside the text was taken from the caret');
      assert(!pressOn(field, 'ArrowRight'), 'ArrowRight inside the text was taken from the caret');
      assert(!pressOn(field, 'Home') && !pressOn(field, 'End'), 'Home/End were taken from the text field');
      assert(document.activeElement === field, 'focus left the text field mid-text');
      field.setSelectionRange(0, 0);
      assert(pressOn(field, 'ArrowLeft') && document.activeElement === first,
        'ArrowLeft at the start of the text did not move on to the previous item');
      assert(pressOn(first, 'ArrowRight') && document.activeElement === field, 'ArrowRight did not reach the field');
      field.setSelectionRange(field.value.length, field.value.length);
      assert(pressOn(field, 'ArrowRight') && document.activeElement === last,
        'ArrowRight at the end of the text did not move on');

      host.dir = 'rtl';
      first.focus();
      assert(pressOn(first, 'ArrowLeft') && document.activeElement === field,
        'under dir="rtl" ArrowLeft did not move to the visually next item');
      field.setSelectionRange(0, 0);
      assert(pressOn(field, 'ArrowRight') && document.activeElement === first,
        'under dir="rtl" ArrowRight at the start of the text did not move back');
      host.dir = '';

      // Availability changes still reach the group; content churn does not need to.
      last.hidden = true;
      await Promise.resolve();
      field.setSelectionRange(field.value.length, field.value.length);
      pressOn(field, 'ArrowRight');
      assert(document.activeElement === first, 'a hidden item was not skipped (the group missed the change)');
      last.hidden = false;
    },
    destroy({ component, host }) {
      component.destroy();
      host.remove();
    }
  };
}

/**
 * Moving a field in the RecordView chooser keeps focus on that field's control, announces the
 * move, and Escape closes the disclosure (defect 11).
 * @returns {SmokeDefinition}
 */
function recordViewChooserFocusCase() {
  return {
    name: 'CardView (field chooser focus)',
    create(fixture) {
      const component = new zx.CardView(null, {
        fields: recordViewFields(), data: recordViewData(), recordId: 'id', titleField: 'title'
      });
      fixture.append(component.toElement());
      return { component };
    },
    async exercise({ component }) {
      const controls = component.getFieldControls();
      controls.open = true;
      const button = (id, action) => controls.querySelector(
        `[data-field-id="${id}"][data-view-field-action="${action}"]`);
      const order = component.getFieldOrder();
      const id = order[1];
      button(id, 'down').focus();
      button(id, 'down').click();
      await Promise.resolve();
      assert(component.getFieldOrder()[2] === id, 'the field did not move');
      const active = document.activeElement;
      assert(active?.dataset.fieldId === id && active.dataset.viewFieldAction === 'down',
        `focus did not stay on the moved field's button (it is on ${active?.outerHTML.slice(0, 80)})`);
      const status = controls.querySelector('.zx-record-view__field-status');
      assert(status?.getAttribute('role') === 'status' && /position 3 of/.test(status.textContent),
        'the move was not announced');
      // Moved to the end, the down button disables and focus moves to the same field's up button.
      const last = order.length - 1;
      for (let index = 2; index < last; index += 1) button(id, 'down').click();
      await Promise.resolve();
      assert(document.activeElement === button(id, 'up'), 'focus was lost when the down button disabled');
      assert(pressOn(document.activeElement, 'Escape'), 'Escape was not handled by the chooser');
      assert(controls.open === false, 'Escape did not close the chooser');
      assert(document.activeElement === controls.querySelector('summary'), 'focus did not return to the trigger');
    },
    destroy: ({ component }) => component.destroy()
  };
}

/**
 * Upload progress ticks through updateItem() without moving focus or scroll (defect 11), and
 * unchanged rows are left untouched.
 * @returns {SmokeDefinition}
 */
function fileListFocusCase() {
  return {
    name: 'FileList (progress keeps focus)',
    create(fixture) {
      const files = Array.from({ length: 12 }, (_, index) => ({
        id: `f${index}`, name: `scan-${index}.pdf`, status: 'uploading', progress: 10,
        actions: [{ id: 'cancel', label: 'Cancel' }]
      }));
      const component = new zx.FileList(null, { items: files });
      const scroller = document.createElement('div');
      scroller.style.cssText = 'block-size: 160px; overflow: auto';
      scroller.append(component.toElement());
      fixture.append(scroller);
      return { component, scroller };
    },
    async exercise({ component, scroller }) {
      const row = (id) => [...component.el.querySelectorAll('.zx-file-list__item')]
        .find((item) => item.textContent.includes(`scan-${id.slice(1)}.pdf`));
      const cancel = row('f8').querySelector('button');
      cancel.focus();
      scroller.scrollTop = scroller.scrollHeight;
      const scrollTop = scroller.scrollTop;
      const untouched = row('f2');
      for (const progress of [25, 50, 75]) {
        component.updateItem('f8', { progress });
        assert(document.activeElement !== document.body && row('f8').contains(document.activeElement),
          `focus dropped out of the file at ${progress}%`);
      }
      assert(document.activeElement.textContent.includes('Cancel'), 'focus is not on the Cancel action');
      assert(scroller.scrollTop === scrollTop, 'the list scrolled while progress ticked');
      assert(row('f2') === untouched, 'an unchanged file row was rebuilt');
      assert(component.getItem('f8').progress === 75, 'the update did not apply');
      component.removeItem('f8');
      await Promise.resolve();
      assert(component.el.contains(document.activeElement), 'removing the focused file dropped focus to <body>');
    },
    destroy: ({ component, scroller }) => {
      component.destroy();
      scroller.remove();
    }
  };
}

/** A live feed prepending entries keeps focus on the entry's action. @returns {SmokeDefinition} */
function activityListFocusCase() {
  return {
    name: 'ActivityList (prepend keeps focus)',
    create(fixture) {
      const component = new zx.ActivityList(null, {
        items: [
          { id: 'one', actor: 'Ada', title: 'created the record', actions: [{ id: 'like', label: 'Like' }] },
          { id: 'two', actor: 'Grace', title: 'added a note', actions: [{ id: 'like', label: 'Like' }] }
        ]
      });
      fixture.append(component.toElement());
      return { component };
    },
    exercise({ component }) {
      const action = () => [...component.el.querySelectorAll('[data-activity-action]')]
        .find((button) => button.closest('li, article')?.textContent.includes('added a note'));
      action().focus();
      component.prependItems({ id: 'zero', actor: 'Linus', title: 'opened the record' });
      assert(document.activeElement === action(), 'prepending an entry moved focus off the focused action');
    },
    destroy: ({ component }) => component.destroy()
  };
}

/**
 * KanbanView honours `fieldControls.target`, and ListToolbar.bind() mounts the field chooser of
 * every record view through its public API (defect 10).
 * @returns {SmokeDefinition}
 */
function recordViewFieldTargetCase() {
  return {
    name: 'ListToolbar (field chooser mount)',
    create(fixture) {
      const host = document.createElement('div');
      fixture.append(host);
      const kanban = new zx.KanbanView(null, {
        fields: recordViewFields(), data: recordViewData(), recordId: 'id', titleField: 'title',
        columnBy: 'status', fieldControls: { target: host }
      });
      const table = new zx.TableView(null, { fields: recordViewFields(), data: recordViewData(), recordId: 'id' });
      const toolbar = new zx.ListToolbar(null, { views: ['table', 'cards'] });
      fixture.append(kanban.toElement(), toolbar.toElement(), table.toElement());
      return { host, kanban, table, toolbar };
    },
    exercise({ host, kanban, table, toolbar }) {
      const chooser = host.querySelector('.zx-record-view__field-controls');
      assert(chooser && chooser === kanban.getFieldControls(), 'Kanban ignored fieldControls.target');
      assert(!kanban.el.querySelector('.zx-record-view__field-controls'), 'Kanban also kept one in its toolbar');

      const columns = table.getFieldControls();
      assert(columns?.classList.contains('zx-table__column-controls'), 'TableView offers no field chooser');
      toolbar.bind(table);
      assert(toolbar.getToolsElement().contains(columns), 'bind() did not mount the TableView chooser');
      columns.querySelector('input[type="checkbox"]').click();
      assert(table.getHiddenFields().length === 1, 'the mounted chooser no longer drives its view');
      toolbar.unbind();
      assert(table.el.contains(columns), 'unbind() did not hand the chooser back');
      toolbar.bind(table);
      kanban.destroy();
      assert(!host.querySelector('.zx-record-view__field-controls'), 'Kanban left its chooser in the host');
    },
    destroy({ host, kanban, table, toolbar }) {
      kanban.destroy();
      table.destroy();
      assert(!toolbar.el.querySelector('.zx-table__column-controls'), 'a destroyed view left its chooser in the bar');
      toolbar.destroy();
      host.remove();
    }
  };
}

/** withinLast is an amount and a unit, not two dates (defect 12). @returns {SmokeDefinition} */
function filterRelativeDateCase() {
  return {
    name: 'Filter (relative date)',
    create(fixture) {
      const component = new zx.Filter(null, {
        fields: [{ id: 'due', label: 'Due date', type: 'date' }],
        value: { version: 1, root: { kind: 'group', id: 'root', logic: 'and', children: [
          { kind: 'condition', id: 'c1', field: 'due', operator: 'withinLast', value: null }
        ] } }
      });
      fixture.append(component.toElement());
      return { component };
    },
    async exercise({ component }) {
      await Promise.resolve();
      const row = component.el.querySelector('[data-node-id="c1"]');
      assert(!row.querySelector('input[type="date"]'), 'the relative operator still renders date pickers');
      const amount = row.querySelector('input[type="number"][data-filter-relative="amount"]');
      const unit = row.querySelector('select[data-filter-relative="unit"]');
      assert(amount && unit && amount.getAttribute('aria-label') && unit.getAttribute('aria-label'),
        'amount and unit controls are missing or unnamed');
      assert(!component.validate().valid, 'an empty span validated');
      amount.value = '7';
      amount.dispatchEvent(new Event('input', { bubbles: true }));
      const condition = () => component.getValue().root.children[0];
      assert(JSON.stringify(condition().value) === '[7,"days"]', `amount wrote ${JSON.stringify(condition().value)}`);
      unit.value = 'weeks';
      unit.dispatchEvent(new Event('change', { bubbles: true }));
      assert(JSON.stringify(condition().value) === '[7,"weeks"]', 'the unit did not write');
      assert(component.validate().valid, 'a complete span did not validate');
      amount.value = '0';
      amount.dispatchEvent(new Event('input', { bubbles: true }));
      assert(!component.validate().valid, 'a zero span validated');
    },
    destroy: ({ component }) => component.destroy()
  };
}
