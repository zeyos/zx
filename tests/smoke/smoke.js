import * as zx from '../../src/index.js';
import * as zeyos from '../../src/zeyos/index.js';
import { CATALOG as SURFACE_CATALOG, narrowCatalog } from '../../src/components/surface/catalog.js';

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
    component.setActivity('needs-you');
    assert(component.el.getAttribute('aria-label') === 'Grace Hopper, Needs you',
      'the activity word is not in the accessible name');
    assert(component.el.dataset.activity === 'needs-you' && !component.refs.activity.hidden
      && component.refs.status.hidden, 'the activity did not take the place of the presence dot');
    assert(component.refs.activity.title === 'Needs you', 'the activity dot has no tooltip');
    component.setActivity('blocked', 'Waiting on the bank');
    assert(component.el.getAttribute('aria-label') === 'Grace Hopper, Waiting on the bank', 'activityLabel ignored');
    component.setActivity(null);
    assert(component.el.getAttribute('aria-label') === 'Grace Hopper, Away' && !component.refs.status.hidden
      && !('activity' in component.el.dataset), 'clearing the activity did not bring the presence back');
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
  appSidebarRowActionsCase(),
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
  launcherLayeringCase(),
  sheetInDialogCase(),
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
  componentCase('Datebox (display format)', () => new zx.Datebox(null, {
    value: new Date(2026, 10, 2), displayFormat: '%e %b %Y'
  }), (component) => {
    const input = component.el.querySelector('input');
    let changes = 0;
    component.on('change', () => { changes += 1; });
    assert(input.value === '2 Nov 2026', `datebox did not rest in its display format: ${input.value}`);
    input.focus();
    assert(input.value === '02.11.2026', `datebox focus did not show the typing format: ${input.value}`);
    input.value = '05.11.2026';
    input.blur();
    assert(input.value === '5 Nov 2026' && component.get().getDate() === 5,
      `a typed date did not commit and redraw in the display format: ${input.value}`);
    assert(changes === 1, `typing a date and leaving emitted ${changes} change events`);
    input.focus();
    input.value = '31.02.2026';
    input.blur();
    assert(input.value === '31.02.2026' && component.el.dataset.state === 'invalid',
      'invalid text was replaced on blur');
    input.focus();
    assert(input.value === '31.02.2026', 'refocusing replaced the invalid text');
    input.blur();
    component.set(new Date(2026, 11, 24));
    assert(input.value === '24 Dec 2026' && component.el.dataset.state !== 'invalid',
      `set() at rest did not redraw in the display format: ${input.value}`);
  }),
  componentCase('DateRangeBox (display format)', () => new zx.DateRangeBox(null, {
    start: new Date(2026, 7, 3), end: new Date(2026, 7, 9), displayFormat: '%e %b %Y'
  }), (component) => {
    const input = component.el.querySelector('input');
    let changes = 0;
    component.on('change', () => { changes += 1; });
    assert(input.value === '3 Aug 2026 – 9 Aug 2026', `range did not rest in its display format: ${input.value}`);
    input.focus();
    assert(input.value === '03.08.2026 – 09.08.2026', `range focus did not show the typing format: ${input.value}`);
    input.value = '10.08.2026 – 14.08.2026';
    input.blur();
    assert(input.value === '10 Aug 2026 – 14 Aug 2026' && component.get().end.getDate() === 14,
      `a typed range did not commit and redraw in the display format: ${input.value}`);
    assert(changes === 1, `typing a range and leaving emitted ${changes} change events`);
    input.focus();
    component.open();
    assert(input.value === '10 Aug 2026 – 14 Aug 2026',
      `untouched text stayed in the typing format while the calendar held focus: ${input.value}`);
    component.close();
    input.focus();
    input.value = 'not a range';
    input.blur();
    assert(input.value === 'not a range' && component.el.dataset.state === 'invalid',
      'invalid range text was replaced on blur');
    input.focus();
    assert(input.value === 'not a range', 'refocusing replaced the invalid range text');
    input.blur();
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
  componentCase('CardView (roving keyboard)', () => new zx.CardView(null, {
    fields: [{ id: 'name', label: 'Name' }],
    data: ['One', 'Two', 'Three', 'Four', 'Five'].map((name, index) => ({ ID: index + 1, name })),
    titleField: 'name', selectable: 'multi', keyboard: 'roving', fieldControls: false, maxColumns: 1,
    link: () => '#record', actions: [{ id: 'open', label: 'Open' }]
  }), (component) => {
    const root = component.el;
    const content = root.querySelector('.zx-card-view__content');
    const grid = root.querySelector('[role="grid"]');
    assert(grid && grid.getAttribute('aria-multiselectable') === 'true', 'roving collection is not a multiselectable grid');
    const tabStops = [...content.querySelectorAll('a[href],button,input,[tabindex]')].filter((element) => element.tabIndex >= 0);
    assert(tabStops.length === 1, `roving collection has ${tabStops.length} Tab stops instead of one`);
    const cards = () => [...root.querySelectorAll('.zx-record-card')];
    assert(cards().every((card) => card.getAttribute('role') === 'row' && card.getAttribute('aria-selected') === 'false'),
      'cards are not unselected grid rows');
    const key = (name, extra = {}) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {
      key: name, bubbles: true, cancelable: true, ...extra
    }));
    cards()[0].focus();
    key('ArrowDown');
    assert(document.activeElement === cards()[1], 'ArrowDown did not move to the next card');
    assert(cards()[1].tabIndex === 0 && cards()[0].tabIndex === -1, 'the Tab stop did not follow focus');
    key('End');
    assert(document.activeElement === cards()[4], 'End did not reach the last card');
    key('Home');
    assert(document.activeElement === cards()[0], 'Home did not reach the first card');
    const clicks = observe(component, 'recordclick');
    key('Enter');
    clicks.expect();
    key(' ');
    assert(component.getSelectionIds().join() === '1' && cards()[0].getAttribute('aria-selected') === 'true',
      'Space did not select the focused card');
    key('ArrowDown', { shiftKey: true });
    assert(component.getSelectionIds().length === 2, 'Shift+ArrowDown did not extend the selection');
    key('a', { ctrlKey: true });
    assert(component.getSelectionIds().length === 5, 'Ctrl+A did not select every card');
    // The current card survives a re-render by record id.
    component.setData([...component.getData()].reverse());
    assert(document.activeElement?.textContent.includes('Two') && document.activeElement.getAttribute('role') === 'row',
      'focus did not stay on the same record after setData');
  }),
  componentCase('CardView (collapsible groups)', () => new zx.CardView(null, {
    fields: [{ id: 'name', label: 'Name' }, { id: 'status', label: 'Status' }],
    data: [{ ID: 1, name: 'Alpha', status: 'open' }, { ID: 2, name: 'Beta', status: 'open' }, { ID: 3, name: 'Gamma', status: 'won' }],
    titleField: 'name', groupBy: 'status', collapsibleGroups: true, collapsedGroups: ['won'], keyboard: 'roving',
    fieldControls: false, renderGroupHeading: ({ label, count }) => `${label} · ${count}`
  }), (component) => {
    const root = component.el;
    const toggles = () => [...root.querySelectorAll('[data-group-toggle]')];
    assert(toggles().length === 2, 'collapsible groups did not render toggles');
    const won = toggles()[1];
    const wonList = document.getElementById(won.getAttribute('aria-controls'));
    assert(won.getAttribute('aria-expanded') === 'false' && wonList?.hidden && !wonList.querySelector('.zx-record-card'),
      'an initially collapsed group shows its cards');
    assert(won.textContent.includes('won · 1'), 'renderGroupHeading content missing');
    const events = observe(component, 'groupcollapse');
    toggles()[0].click();
    events.expect();
    assert(component.getCollapsedGroups().includes('open') && !root.querySelector('.zx-record-card'),
      'clicking a toggle did not collapse its group');
    assert(component.getViewState().collapsedGroups.length === 2, 'collapsed groups are not in the view state');
    const key = (name) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    const headers = () => [...root.querySelectorAll('[data-card-item="group"]')];
    assert(headers().length === 2, 'collapsed headings left the roving order');
    headers()[0].focus();
    key('Enter');
    assert(!component.getCollapsedGroups().includes('open'), 'Enter on a heading did not expand it');
    assert(document.activeElement?.dataset.cardItem === 'group' && document.activeElement.textContent.includes('open'),
      'focus did not stay on the heading after toggling');
    key('ArrowDown');
    assert(document.activeElement?.textContent.includes('Alpha'), 'ArrowDown from a heading did not reach its first card');
    component.setGroupCollapsed('open', true);
    assert(document.activeElement?.dataset.cardItem === 'group' && document.activeElement.textContent.includes('open'),
      'collapsing the focused card\'s group did not move focus to its heading');
    component.setViewState({ collapsedGroups: [] });
    assert(root.querySelectorAll('.zx-record-card').length === 3, 'restoring an empty collapse state did not expand');
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
  artifactCase('kbd()', () => {
    const element = zx.kbd('Mod+Shift+K');
    return {element, exercise: () => {
      const keys = [...element.querySelectorAll(':scope > kbd.zx-kbd__key')];
      assert(element.matches('kbd.zx-kbd') && keys.length === 3, 'a chord is not one kbd of nested keycaps');
      assert(keys[2].textContent === 'K', 'the letter is not upper-cased');
      const square = keys[2].getBoundingClientRect();
      assert(Math.abs(square.width - square.height) < 1, 'a single-character keycap is not square');
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
  treeRowActionsCase(),
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
  proseAnchorsCase(),
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
  tableWindowedCase(),
  tableWindowedEditingCase(),
  tableWindowedStructureCase(),
  tableHierarchyCase(),
  tableKeyboardCase(),
  tableTreegridKeyboardCase(),
  tableInteractivityCase(),
  toolbarRovingInputCase(),
  toolbarFieldsetDisabledCase(),
  recordViewChooserFocusCase(),
  fileListFocusCase(),
  activityListFocusCase(),
  recordViewFieldTargetCase(),
  filterRelativeDateCase(),
  zeyosFormToastScopeCase(),
  truncateCase(),
  sizeContainerCase(),
  positionRtlCase(),
  customElementsCase(),
  ...kitElementSpecs().map(kitElementCase),
  kitElementsBeforeUpgradeCase(),
  kitElementsMarkupCase(),
  componentCase('BlockView', () => new zx.BlockView(null, {
    blocks: [
      { type: 'p', text: 'Paid **€4,860.00** <img src=x onerror="window.__zxInjected = 1"> [1].' },
      { type: 'figures', rows: [['Late', '3 invoices', '€19,375.50']] },
      { type: 'table', columns: ['Invoice', 'Amount'], rows: [['RE-1', '€1.00']] },
      { type: 'code', language: 'js', code: 'const a = 1;' },
      { type: 'artifact', id: 'draft', title: 'Reminder draft', kind: 'document' }
    ],
    sources: [{ id: 'inv', title: 'Invoices · September' }]
  }), (component) => {
    const root = component.toElement();
    assert(!root.querySelector('img') && !('__zxInjected' in window), 'model text reached the page as HTML');
    assert(root.querySelector('strong')?.textContent === '€4,860.00', 'bold run missing');
    const cites = observe(component, 'cite');
    const cite = /** @type {HTMLButtonElement} */ (root.querySelector('[data-cite="1"]'));
    assert(cite?.getAttribute('aria-label') === 'Source 1: Invoices · September', 'citation is not named by its source');
    cite.click();
    cites.expect();
    const artifacts = observe(component, 'artifact');
    /** @type {HTMLButtonElement} */ (root.querySelector('[data-artifact="draft"]')).click();
    artifacts.expect();
    // Streaming: finished paragraphs keep their nodes; a break split across chunks still splits.
    component.setBlocks([], { streaming: true });
    assert(root.getAttribute('aria-busy') === 'true', 'a streaming answer is not busy');
    for (const chunk of ['One **bo', 'ld**\n', '\nTwo']) component.appendText(chunk);
    const first = root.querySelector('p');
    component.appendText(' more');
    assert(root.querySelectorAll('p').length === 2, 'a paragraph break split across chunks was missed');
    assert(root.querySelector('p') === first, 'a finished paragraph was redrawn');
    const ends = observe(component, 'end');
    component.end();
    ends.expect();
    assert(root.dataset.state === 'done' && !root.hasAttribute('aria-busy'), 'end() left the answer busy');
    component.stop();
    assert(root.dataset.state === 'stopped' && root.querySelector('.zx-block-view__stopped'), 'stop() left no note');
    assert(component.toMarkdown() === 'One **bold**\n\nTwo more', 'Markdown export lost the stream');
  }),
  componentCase('RunStatus', () => new zx.RunStatus(null, {
    state: 'waiting',
    summary: 'Step 4 of 6 needs your approval.',
    steps: { done: 3, total: 6 },
    started: '2026-09-29T10:20:00',
    workMs: 74_000,
    waitingSince: '2026-09-29T10:22:00',
    tokens: [18420, 1236],
    cost: { amount: 0.14, budget: 2, currency: 'EUR' },
    actions: [{ label: 'Review the request', kind: 'primary' }]
  }), (component) => {
    const root = component.el;
    assert(root.dataset.state === 'waiting', 'RunStatus did not reflect its state');
    assert(root.querySelector('.zx-run-status__state .zx-status-icon')
      && root.querySelector('.zx-run-status__word')?.textContent === 'Waiting for you', 'state is not a glyph and a word');
    const bar = root.querySelector('[role="progressbar"]');
    assert(bar?.getAttribute('aria-valuenow') === '3' && bar.getAttribute('aria-valuemax') === '6'
      && bar.getAttribute('aria-valuetext') === '3 of 6 steps', 'steps progressbar semantics missing');
    const meter = root.querySelector('[role="meter"]');
    assert(meter?.getAttribute('aria-valuetext')?.includes('0.14') && meter.dataset.level === 'normal',
      'cost meter semantics missing');
    assert([...root.querySelectorAll('dt')].some((dt) => dt.textContent === 'Waiting since'),
      'a waiting run does not say since when');
    const actions = observe(component, 'action');
    root.querySelector('[data-run-action="0"]').click();
    actions.expect();
    // Focus survives update(): kept on the same button when the actions did not change, moved to
    // the same index when they did, and held by the panel when none is left.
    const review = root.querySelector('[data-run-action="0"]');
    review.focus();
    component.update({ summary: 'Still waiting.' });
    assert(document.activeElement === review && review.isConnected, 'update() took focus off an unchanged action');
    component.update({ actions: [{ label: 'Open the request', kind: 'primary' }, { label: 'Dismiss' }] });
    assert(document.activeElement?.getAttribute('data-run-action') === '0'
      && document.activeElement.textContent === 'Open the request', 'focus did not follow the action at its index');
    component.update({ actions: [] });
    assert(document.activeElement === root && root.getAttribute('tabindex') === '-1',
      'focus fell out of the panel when its last action went');
    component.update({ actions: [{ label: 'Review the request', kind: 'primary' }] });

    // Tokens: a total, and a meter against a budget.
    component.update({ tokens: 22840 });
    assert([...root.querySelectorAll('dd')].some((dd) => dd.textContent === '22,840')
      && root.querySelectorAll('[role="meter"]').length === 1, 'a token total without a budget is not plain text');
    component.update({ tokenBudget: 60000 });
    const tokenMeter = [...root.querySelectorAll('[role="meter"]')].find((meter) => meter.getAttribute('aria-label') === 'Tokens');
    assert(tokenMeter?.getAttribute('aria-valuetext') === '22.8K of 60K tokens' && tokenMeter.dataset.level === 'normal'
      && tokenMeter.getAttribute('aria-valuemax') === '60000', 'token budget meter semantics missing');
    component.update({ tokens: [40000, 8000] });
    assert([...root.querySelectorAll('[role="meter"]')].find((meter) => meter.getAttribute('aria-label') === 'Tokens')
      ?.dataset.level === 'warning', 'the token meter did not warn from 80%');
    component.update({ tokens: [18420, 1236], tokenBudget: null });

    // Blocked: a glyph and a word in the danger tone, "Blocked since", and no finished time.
    component.update({ state: 'blocked', finished: '2026-09-29T10:25:00' });
    assert(root.dataset.state === 'blocked' && root.querySelector('.zx-run-status__word')?.textContent === 'Blocked'
      && root.querySelector('.zx-run-status__state .zx-status-icon')?.dataset.tone === 'danger', 'blocked is not drawn');
    const blockedLabels = [...root.querySelectorAll('dt')].map((dt) => dt.textContent);
    assert(blockedLabels.includes('Blocked since') && !blockedLabels.some((label) => /Finished|Failed at|Stopped at/.test(label)),
      'a blocked run does not say since when, or says it is over');
    component.update({ state: 'waiting', finished: null });
    component.update({ cost: { amount: 1.7, budget: 2, currency: 'EUR' } });
    assert(root.querySelector('[role="meter"]').dataset.level === 'warning', 'the cost meter did not warn from 80%');
    component.update({ cost: { amount: 2, budget: 2, currency: 'EUR' } });
    assert(root.querySelector('[role="meter"]').dataset.level === 'danger', 'the cost meter did not turn to danger at 100%');
    component.update({ state: 'running', workMs: 5000 });
    assert(component.getState().workMs >= 5000 && root.querySelector('.zx-run-status__elapsed'),
      'a running run shows no working time');
    component.update({ state: 'done', finished: '2026-09-29T10:30:00' });
    const frozen = component.getState().workMs;
    assert(component.getState().workMs === frozen, 'the clock ran on after the run finished');
    component.update({ compact: true });
    assert(root.hasAttribute('data-compact') && !root.querySelector('dl, [role="progressbar"], button')
      && root.querySelector('.zx-run-status__pill .zx-status-icon'), 'compact drew more than the state pill');
    component.update({ compact: 'icon' });
    const pill = root.querySelector('.zx-run-status__pill');
    const word = pill?.querySelector('.zx-run-status__word');
    assert(root.getAttribute('data-compact') === 'icon' && pill.title === word?.textContent && word.textContent === 'Done'
      && word.getBoundingClientRect().width <= 1 && pill.querySelector('.zx-status-icon'),
      'compact icon does not hide the word visually while keeping it as text and tooltip');
  }),
  componentCase('Composer', () => new zx.Composer(null, {
    attachments: true,
    mentions: { items: [{ id: 'finance', label: 'Finance agent' }, { id: 'sales', label: 'Sales agent' }] },
    commands: [{ id: 'summarize', label: 'Summarize the conversation' }],
    context: [{ id: 'selection', label: '3 invoices' }],
    tools: [{ id: 'web', label: 'Web search', icon: 'search', pressed: false }]
  }), (component) => {
    const input = component.el.querySelector('textarea');
    assert(input && !input.hasAttribute('role'), 'Composer text area lost its textbox role');
    assert(component.el.getAttribute('role') === 'group', 'Composer root is not a group');
    const key = (name, init = {}) => {
      const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
      input.dispatchEvent(event);
      return event;
    };
    let sends = 0;
    let sent = null;
    component.on('send', (event) => { sends += 1; sent = event.detail; });
    const sendEvents = observe(component, 'send');
    key('Enter');
    assert(sends === 0, 'Composer sent an empty message');
    component.setValue('Draft the reminders');
    const composing = key('Enter', { isComposing: true });
    assert(sends === 0 && !composing.defaultPrevented, 'an IME composition Enter sent the message');
    key('Enter', { shiftKey: true });
    assert(sends === 0, 'Shift+Enter sent the message');
    key('Enter');
    assert(sends === 1, `Enter sent ${sends} times`);
    sendEvents.expect();
    assert(sent.text === 'Draft the reminders' && sent.context.length === 1, 'Composer send detail is wrong');
    assert(component.getValue() === '' && input.value === '', 'send did not clear the text');

    // Mentions: the text area points at the suggestions without becoming a combobox.
    input.focus();
    component.setValue('Ask @fin');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const list = component.el.querySelector('[role="listbox"]');
    assert(!list.hidden && input.getAttribute('aria-controls') === list.id
      && input.getAttribute('aria-autocomplete') === 'list', 'mention suggestions did not open');
    assert(input.getAttribute('aria-activedescendant') === list.querySelector('[aria-selected="true"]')?.id,
      'the active suggestion is not exposed');
    key('Enter');
    assert(input.value === 'Ask @Finance agent ' && list.hidden, 'Enter did not pick the suggestion');
    assert(!input.hasAttribute('aria-activedescendant'), 'a closed list left aria-activedescendant');
    assert(sends === 1, 'picking a suggestion sent the message');

    // Busy: Send becomes Stop, Enter does not send, Escape stops.
    const stops = observe(component, 'stop');
    component.setBusy(true);
    assert(component.el.querySelector('.zx-composer__send').getAttribute('aria-label') === 'Stop', 'busy Send is not Stop');
    key('Enter');
    assert(sends === 1, 'Enter sent while busy');
    key('Escape');
    stops.expect();
    component.setBusy(false);

    // Attachments are a list with a named remove button each.
    component.addFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    const remove = component.el.querySelector('ul [aria-label="Remove notes.txt"]');
    assert(remove, 'the attachment has no remove button');
    remove.click();
    assert(component.getFiles().length === 0, 'removing the attachment failed');

    // "/" on an empty text opens the commands in a launcher the composer owns.
    component.clear();
    const slash = key('/');
    const launcher = document.querySelector('dialog.zx-launcher[open]');
    assert(slash.defaultPrevented && launcher, '/ on an empty text did not open the commands');
    launcher.close();

    // Tools: an extra bar button named by its label; a boolean `pressed` makes it a toggle; a click
    // emits `tool` and leaves the pressed state to the application.
    const web = component.el.querySelector('.zx-composer__bar [data-tool="web"]');
    assert(web && web.getAttribute('aria-label') === 'Web search' && web.getAttribute('aria-pressed') === 'false',
      'the Web search tool is not a named toggle');
    let toolDetail = null;
    component.on('tool', (event) => { toolDetail = event.detail; });
    const toolEvents = observe(component, 'tool');
    web.click();
    toolEvents.expect();
    assert(toolDetail?.id === 'web' && toolDetail.tool.pressed === false, 'Composer tool detail is wrong');
    assert(web.getAttribute('aria-pressed') === 'false', 'the composer toggled a tool by itself');
    component.setToolPressed('web', true);
    assert(web.getAttribute('aria-pressed') === 'true', 'setToolPressed did not press the tool');
    web.focus();
    component.setTools([{ id: 'params', label: 'Parameters', icon: 'gear' }, { id: 'web', label: 'Web search', icon: 'search', pressed: true }]);
    assert(document.activeElement?.dataset.tool === 'web', 'setTools moved the focus off the same tool');

    // update() changes the composer in place: the text, its selection, the focus and the chips stay.
    component.setValue('Keep this text');
    input.focus();
    input.setSelectionRange(5, 9);
    component.update({ placeholder: 'Message Halden 3 Deep', note: 'Halden 3 Deep can make mistakes.', label: 'Ask Halden' });
    assert(component.getValue() === 'Keep this text' && document.activeElement === input
      && input.selectionStart === 5 && input.selectionEnd === 9, 'update() lost the text, the focus or the selection');
    assert(input.placeholder === 'Message Halden 3 Deep' && input.getAttribute('aria-label') === 'Ask Halden'
      && document.getElementById(input.getAttribute('aria-describedby'))?.textContent === 'Halden 3 Deep can make mistakes.',
      'update() did not change the placeholder, the label or the note');
    assert(component.getContext().length === 1, 'update() dropped the context chip');

    // sendLabel: a visible word that is also Send's name; busy, the button reads Stop.
    const sendButton = component.el.querySelector('.zx-composer__send');
    component.update({ sendLabel: 'Start task' });
    assert(sendButton.textContent === 'Start task' && sendButton.getAttribute('aria-label') === 'Start task',
      'sendLabel is not the visible text and the name of Send');
    component.update({ busy: true });
    assert(sendButton.textContent === 'Stop' && sendButton.getAttribute('aria-label') === 'Stop', 'a labelled busy Send is not Stop');
    component.update({ busy: false, sendLabel: null });
    assert(sendButton.textContent === '' && sendButton.getAttribute('aria-label') === 'Send', 'sendLabel: null kept the word');
  }),
  componentCase('Composer (queued messages)', () => new zx.Composer(null, {
    queue: true,
    queueLimit: 3,
    hint: 'Enter sends',
    context: [{ id: 'selection', label: '3 invoices' }],
    attachments: true
  }), async (component) => {
    const root = component.el;
    const input = root.querySelector('textarea');
    const box = root.querySelector('.zx-composer__queue');
    const send = root.querySelector('.zx-composer__send');
    const status = root.querySelector('[role="status"]');
    const hint = root.querySelector('.zx-composer__hint');
    const list = root.querySelector('.zx-composer__queue-list');
    const key = (target, name, init = {}) => {
      const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    const write = (text) => {
      input.focus();
      component.setValue(text);
      key(input, 'Enter');
    };
    const rows = () => [...list.children];
    const texts = () => rows().map((row) => row.querySelector('.zx-composer__queued-text').textContent);
    const queued = () => component.getQueue().map((item) => item.text);
    const named = (row, name) => [...row.querySelectorAll('button')].find((button) => button.textContent === name);
    const sent = [];
    const added = [];
    const left = [];
    component.on('send', (event) => sent.push(event.detail));
    component.on('queue', (event) => added.push(event.detail));
    component.on('dequeue', (event) => left.push(event.detail));
    const queueEvents = observe(component, 'queue');
    const dequeueEvents = observe(component, 'dequeue');

    assert(box.hidden && getComputedStyle(box).display === 'none', 'an empty queue is drawn');

    // Idle, the send key sends as it always did.
    write('First');
    assert(sent.length === 1 && sent[0].queued === undefined && added.length === 0, 'an idle send went through the queue');

    // Busy, it queues: the input clears, the button stays Stop, and the status speaks once per message.
    component.setBusy(true);
    key(input, 'Enter');
    assert(queued().length === 0 && added.length === 0, 'an empty text was queued');
    component.setValue('Second');
    component.insertText(' @');
    component.setValue('Second');
    key(input, 'Enter');
    assert(sent.length === 1 && input.value === '' && queued().join() === 'Second', 'the send key did not queue the message');
    assert(send.dataset.mode === 'stop' && send.getAttribute('aria-label') === 'Stop', 'queueing changed Stop');
    assert(added.length === 1 && added[0].item.text === 'Second' && added[0].items.length === 1, 'queue detail is wrong');
    queueEvents.expect();
    assert(status.textContent.trim() === 'Queued; sends when the agent finishes', 'queueing was not announced');
    const announced = status.textContent;
    write('Third');
    assert(status.textContent !== announced && status.textContent.trim() === announced.trim(),
      'the second message was not announced apart from the first');

    // The list: labelled "Queued (2)", above the text, each row with a toolbar of Edit and Remove.
    assert(!box.hidden && list.localName === 'ol'
      && document.getElementById(list.getAttribute('aria-labelledby'))?.textContent === 'Queued (2)', 'the queue is not labelled');
    assert(box.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING, 'the queue is not above the text');
    assert(texts().join() === 'Second,Third', 'the rows are not in order');
    const toolbar = rows()[0].querySelector('[role="toolbar"]');
    const edit = named(rows()[0], 'Edit');
    const remove = named(rows()[0], 'Remove');
    assert(document.getElementById(toolbar.getAttribute('aria-labelledby'))?.textContent === 'Second', 'the toolbar is not named by its row');
    assert(edit.tabIndex === 0 && remove.tabIndex === -1, 'a row is not one Tab stop');
    edit.focus();
    key(edit, 'ArrowRight');
    assert(document.activeElement === remove && remove.tabIndex === 0 && edit.tabIndex === -1, 'the toolbar arrows did not move');
    key(remove, 'ArrowRight');
    assert(document.activeElement === edit, 'the toolbar arrows did not wrap');
    key(edit, 'End');
    assert(document.activeElement === remove, 'End did not reach the last button');

    // At the limit the message is refused and stays; the hint says why, and goes with room again.
    write('Fourth');
    assert(queued().length === 3 && added.length === 3, 'the third message was not queued');
    write('Over');
    assert(queued().length === 3 && input.value === 'Over' && added.length === 3, 'the limit did not refuse the message');
    assert(hint.textContent === 'Queue full (limit 3)' && !hint.hidden, 'the hint did not say why');
    assert(status.textContent.trim() === 'Queue full (limit 3)', 'the refusal was not announced');
    component.setValue('');

    // Delete on a row removes it, and the focus stays in the list.
    named(rows()[1], 'Remove').focus();
    const deleted = key(document.activeElement, 'Delete');
    assert(deleted.defaultPrevented && queued().join() === 'Second,Fourth', 'Delete did not remove the row');
    assert(left.at(-1).reason === 'removed' && left.at(-1).item.text === 'Third' && left.at(-1).items.length === 2, 'dequeue detail is wrong');
    dequeueEvents.expect();
    assert(document.activeElement === named(rows()[1], 'Remove'), 'the focus did not go to the row now in that place');
    assert(hint.textContent === 'Enter sends', 'the application hint did not come back');

    // Remove, and removeQueued(), which ignores an id it does not know.
    write('Fifth');
    named(rows()[2], 'Remove').click();
    assert(queued().join() === 'Second,Fourth', 'Remove did not remove the row');
    component.removeQueued('nothing');
    assert(queued().length === 2, 'removeQueued took a message it does not know');

    // Edit with an empty input takes the text back, and the row goes.
    let written = '';
    component.once('input', (event) => { written = event.detail.text; });
    named(rows()[1], 'Edit').click();
    await Promise.resolve();
    assert(input.value === 'Fourth' && document.activeElement === input && queued().join() === 'Second', 'Edit did not take the text back');
    assert(left.at(-1).reason === 'edited' && left.at(-1).item.text === 'Fourth' && written === 'Fourth', 'Edit did not report the message');

    // With text in the input, Edit asks first: Cancel leaves both alone, confirming replaces.
    const editSecond = () => named(rows()[0], 'Edit').click();
    const answer = async (label) => {
      await nextFrame();
      const dialog = document.querySelector('dialog.zx-dialog[open]');
      assert(dialog, 'Edit did not ask before replacing the text');
      [...dialog.querySelectorAll('button')].find((button) => button.textContent.trim() === label).click();
      for (let wait = 0; wait < 40 && dialog.isConnected; wait += 1) await delay(25);
      assert(!dialog.isConnected, 'the question stayed on the page');
    };
    editSecond();
    await answer('Cancel');
    assert(input.value === 'Fourth' && queued().join() === 'Second', 'Cancel changed the text or the queue');
    editSecond();
    await answer('Replace');
    assert(input.value === 'Second' && queued().length === 0 && box.hidden, 'confirming did not replace the text');

    // A queued message keeps what it was written with, and Edit brings its files back.
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    component.clear();
    component.addFiles([file]);
    component.setValue('With a file');
    key(input, 'Enter');
    assert(component.getFiles().length === 0, 'queueing left the files in the composer');
    assert(rows()[0].querySelector('.zx-composer__queued-meta')?.textContent === '1 file', 'the row does not say a file goes with it');
    assert(component.getQueue()[0].context[0].id === 'selection' && component.getQueue()[0].files[0] === file, 'the queued message lost its files or context');
    named(rows()[0], 'Edit').click();
    await Promise.resolve();
    assert(input.value === 'With a file' && component.getFiles()[0] === file, 'Edit did not bring the files back');
    component.clear();

    // Stop keeps the queue, and clearQueue() does not.
    write('Kept');
    const stops = observe(component, 'stop');
    key(input, 'Escape');
    stops.expect();
    send.click();
    assert(queued().join() === 'Kept', 'Stop cleared the queue');
    component.clearQueue();
    assert(queued().length === 0 && left.at(-1).reason === 'cleared' && left.at(-1).item.text === 'Kept' && box.hidden, 'clearQueue did not report the message');

    // One message per end of busy, in order, as a normal send with `queued: true`.
    sent.length = 0;
    write('One');
    write('Two');
    component.setValue('Still writing');
    component.setBusy(false);
    assert(sent.length === 1 && sent[0].text === 'One' && sent[0].queued === true && sent[0].context.length === 1,
      'the end of busy did not send the first message');
    assert(left.at(-1).reason === 'sent' && left.at(-1).item.text === 'One' && left.at(-1).items.length === 1, 'the sent message was not reported');
    assert(input.value === 'Still writing', 'a queued send cleared what was being written');
    component.setBusy(false);
    assert(sent.length === 1, 'the next message went without busy ending');
    component.setBusy(true);
    assert(sent.length === 1, 'the next message went while busy');
    component.setBusy(false);
    assert(sent.length === 2 && sent[1].text === 'Two' && queued().length === 0, 'the second end of busy did not send the second message');
    component.setBusy(true);
    component.setBusy(false);
    assert(sent.length === 2, 'an empty queue sent something');
    component.clear();

    // A prevented send keeps the message first in line; a disabled composer sends nothing.
    component.setBusy(true);
    write('Held');
    write('After');
    const veto = (event) => event.preventDefault();
    component.on('send', veto);
    component.setBusy(false);
    component.off('send', veto);
    assert(queued().join() === 'Held,After' && texts().join() === 'Held,After', 'a prevented send lost its place');
    component.setDisabled(true);
    component.setBusy(true);
    component.setBusy(false);
    assert(queued().length === 2, 'a disabled composer sent a queued message');
    assert(named(rows()[0], 'Edit').disabled, 'a disabled composer left the queue active');
    component.setDisabled(false);

    // A listener that ends busy again gets the next message only when it is done.
    const order = [];
    const record = (event) => {
      order.push(event.detail.text);
      if (event.detail.text === 'Held') {
        component.setBusy(true);
        component.setBusy(false);
      }
    };
    component.on('send', record);
    component.setBusy(true);
    component.setBusy(false);
    component.off('send', record);
    assert(order.join() === 'Held,After', `the messages went out of order: ${order}`);

    // Sent from under the focus: it goes to the row now in that place, then to the text.
    component.setBusy(true);
    write('Focused');
    write('Next');
    component.setValue('');
    named(rows()[0], 'Remove').focus();
    component.setBusy(false);
    assert(document.activeElement === named(rows()[0], 'Remove'), 'a sent row took the focus with it');
    component.setBusy(true);
    component.setBusy(false);
    assert(document.activeElement === input, 'the last row took the focus with it');

    // A queue with a draft saved: the queue is not kept with it, and a destroyed composer drops it.
    const draftKey = 'smoke-queue';
    const drafted = new zx.Composer(null, { queue: true, busy: true, draftKey });
    root.parentElement.append(drafted.toElement());
    drafted.setValue('Queued, not a draft');
    drafted.el.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    drafted.destroy();
    assert(drafted.getQueue().length === 0, 'destroy() kept the queue');
    const again = new zx.Composer(null, { queue: true, draftKey });
    assert(again.getValue() === '' && again.getQueue().length === 0, 'the queue came back with the draft');
    again.destroy();

    // Without the option nothing changes: the send key does nothing while busy, and no list exists.
    const plain = new zx.Composer(null, { busy: true });
    assert(!plain.el.querySelector('.zx-composer__queue'), 'a composer without queue drew one');
    plain.setValue('Waits');
    plain.el.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert(plain.getValue() === 'Waits' && plain.getQueue().length === 0, 'a composer without queue queued');
    plain.destroy();
  }),
  componentCase('PromptStarters', () => new zx.PromptStarters(null, {
    items: [
      { id: 'reply', title: 'Draft a reply', text: 'Draft a friendly reply.', icon: 'mail', ref: 7 },
      { id: 'join', title: 'Explain a concept', text: 'Explain a LEFT JOIN.', description: 'With a short example' },
      { id: 'join', title: 'A repeated id', text: 'Left out' },
      { id: 'untitled', text: 'No title' }
    ]
  }), (component) => {
    const root = component.el;
    assert(root.getAttribute('role') === 'group' && root.getAttribute('aria-label') === 'Suggestions',
      'PromptStarters group has no accessible name');
    const [reply, join, ...rest] = root.querySelectorAll('button');
    assert(reply && join && rest.length === 0, 'PromptStarters kept an invalid or repeated item');
    assert(reply.type === 'button' && reply.tabIndex === 0 && join.tabIndex === 0, 'a starter is not a button in the Tab order');
    const linked = (button, attribute) => document.getElementById(button.getAttribute(attribute))?.textContent;
    assert(linked(reply, 'aria-labelledby') === 'Draft a reply' && linked(reply, 'aria-describedby') === 'Draft a friendly reply.',
      'a starter without a description is not named by its title and described by its text');
    assert(linked(join, 'aria-describedby') === 'With a short example', 'the description did not take the place of the text');
    assert(reply.querySelector('.zx-icon') && !join.querySelector('.zx-icon'), 'the icon did not follow the item');

    // A pick reports the item and does nothing else.
    const picks = [];
    component.on('pick', (event) => picks.push(event.detail.item));
    const events = observe(component, 'pick');
    join.click();
    reply.click();
    events.expect();
    assert(picks.length === 2 && picks[0].id === 'join' && picks[0].text === 'Explain a LEFT JOIN.' && picks[1].ref === 7,
      'pick did not carry the item as given');

    // 'auto' is two columns, and one in a narrow container.
    const list = root.querySelector('.zx-prompt-starters__list');
    const columns = () => getComputedStyle(list).gridTemplateColumns.split(' ').length;
    root.style.inlineSize = '640px';
    assert(columns() === 2, `auto drew ${columns()} columns in a wide container`);
    root.style.inlineSize = '320px';
    assert(columns() === 1, `auto drew ${columns()} columns in a narrow container`);
    root.dataset.columns = '2';
    assert(columns() === 2, 'columns: 2 gave way in a narrow container');
    root.dataset.columns = '1';
    root.style.inlineSize = '640px';
    assert(columns() === 1, 'columns: 1 gave way in a wide container');
    root.dataset.columns = 'auto';
    root.style.removeProperty('inline-size');

    // setItems keeps the focus on the same starter, and no items hide the group.
    join.focus();
    component.setItems([{ id: 'other', title: 'Other', text: 'Another' }, { id: 'join', title: 'Join', text: 'Joined' }]);
    assert(document.activeElement?.dataset.starter === 'join', 'setItems moved the focus off the same starter');
    component.setItems([]);
    assert(root.hidden && getComputedStyle(root).display === 'none', 'an empty PromptStarters is still drawn');
    component.setItems([{ id: 'reply', title: 'Draft a reply', text: 'Draft a friendly reply.' }]);
    assert(!root.hidden, 'PromptStarters did not come back with its items');

    // headingLevel draws the label as a heading that names the group, and a target is restored.
    const target = document.createElement('section');
    target.className = 'starters-target';
    target.append(document.createTextNode('Original'));
    const before = target.outerHTML;
    root.parentElement.append(target);
    const headed = new zx.PromptStarters(target, {
      label: 'Start here', headingLevel: 3, columns: 1, items: [{ id: 'a', title: 'A', text: 'First' }]
    });
    const heading = target.querySelector('h3');
    assert(heading?.textContent === 'Start here' && target.getAttribute('aria-labelledby') === heading.id
      && !target.hasAttribute('aria-label'), 'headingLevel did not draw the heading that names the group');
    assert(target.dataset.columns === '1', 'columns: 1 is not drawn');
    headed.destroy();
    headed.destroy();
    assert(target.outerHTML === before, `PromptStarters did not restore its target: ${target.outerHTML}`);
    target.remove();
  }),
  componentCase('ApprovalCard', () => new zx.ApprovalCard(null, {
    title: 'Send 3 payment reminders?',
    details: [{ type: 'p', text: 'Three reminders, **€4,515.50** in all.' }],
    preview: { label: 'Show the email', content: [{ type: 'p', text: 'Hello Mara,' }] },
    fields: { subject: { type: 'text', label: 'Subject' } },
    values: { subject: 'Invoice overdue' }
  }), (component) => {
    const root = component.el;
    assert(root.getAttribute('role') === 'group' && root.tabIndex === -1, 'ApprovalCard root is not a focusable group');
    assert(document.getElementById(root.getAttribute('aria-labelledby'))?.localName === 'h3',
      'ApprovalCard group is not labelled by its title');
    assert(root.dataset.state === 'pending', 'ApprovalCard did not start pending');

    // Approval keys act only with focus inside the card.
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    outside.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    outside.remove();
    assert(component.getStatus() === 'pending', 'an approval key acted with focus outside the card');

    // A key typed into a text control inside the card is typing, not an answer.
    const input = document.createElement('input');
    root.querySelector('.zx-approval-card__details').append(input);
    input.focus();
    const typed = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    input.dispatchEvent(typed);
    input.remove();
    assert(component.getStatus() === 'pending' && !typed.defaultPrevented, 'an approval key acted inside a text control');

    // A prevented approval leaves the card pending.
    const events = observe(component, 'approve');
    const veto = (event) => event.preventDefault();
    component.on('approve', veto);
    assert(component.handleKey(new KeyboardEvent('keydown', { key: 'a', cancelable: true })) === true,
      'handleKey did not use A');
    assert(component.getStatus() === 'pending', 'a prevented approve answered the card');
    component.off('approve', veto);
    // update() changes the request in place: focus stays on Approve, nothing is emitted, and
    // details equal to what is drawn are not redrawn.
    const approveButton = root.querySelector('[data-approval-action="approve"]');
    const detailsEl = root.querySelector('.zx-approval-card__details');
    let updateEvents = 0;
    const countEvent = () => { updateEvents += 1; };
    for (const type of ['approve', 'edit', 'reject']) component.on(type, countEvent);
    approveButton.focus();
    component.update({
      title: 'Send 4 payment reminders?',
      details: [{ type: 'p', text: 'Four reminders, **€5,055.50** in all.' }],
      values: { subject: 'Second notice' }
    });
    assert(document.activeElement === approveButton, 'ApprovalCard update() moved focus off Approve');
    assert(root.querySelector('.zx-approval-card__title').textContent === 'Send 4 payment reminders?',
      'ApprovalCard update() did not redraw the title');
    assert(root.querySelector('.zx-approval-card__details') === detailsEl && detailsEl.textContent.includes('Four reminders'),
      'ApprovalCard update() did not redraw the details in place');
    assert(component.getValues().subject === 'Second notice', 'ApprovalCard update() did not adopt the values');
    const drawnDetails = detailsEl.firstChild;
    component.update({ details: [{ type: 'p', text: 'Four reminders, **€5,055.50** in all.' }] });
    assert(detailsEl.firstChild === drawnDetails, 'ApprovalCard update() redrew details equal to what is drawn');
    for (const type of ['approve', 'edit', 'reject']) component.off(type, countEvent);
    assert(updateEvents === 0, 'ApprovalCard update() emitted an event');

    // A control update() takes away hands focus to the card rather than the page.
    root.querySelector('.zx-approval-card__disclosure').focus();
    component.update({ preview: null });
    assert(!root.querySelector('.zx-approval-card__preview') && document.activeElement === root,
      'ApprovalCard update() dropped focus with the preview toggle');

    // editedKeys lists only the named values; edited alone lists every field.
    const editedLabels = () => [...root.querySelectorAll('.zx-approval-card__value-label')].map((el) => el.textContent).join(',');
    component.update({
      fields: { subject: { type: 'text', label: 'Subject' }, body: { type: 'textarea', label: 'Message' } },
      values: { subject: 'Second notice', body: 'Hello' },
      editedKeys: ['body']
    });
    assert(editedLabels() === 'Message' && JSON.stringify(component.getEditedKeys()) === '["body"]',
      'ApprovalCard editedKeys did not narrow the edited values');
    component.update({ edited: false });
    assert(root.querySelector('.zx-approval-card__changes').hidden, 'ApprovalCard edited: false kept the edited values');
    component.update({ edited: true });
    assert(editedLabels() === 'Subject,Message' && component.getEditedKeys() === null,
      'ApprovalCard edited without editedKeys did not list every field');
    component.update({ edited: false, fields: { subject: { type: 'text', label: 'Subject' } }, values: { subject: 'Invoice overdue' } });

    // A with focus on the card approves it.
    component.focus();
    const key = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    root.dispatchEvent(key);
    assert(key.defaultPrevented, 'the card did not use A');
    events.expect();
    assert(component.getStatus() === 'approved' && root.dataset.state === 'approved', 'ApprovalCard did not move to approved');
    assert(root.querySelector('.zx-approval-card__actions').hidden, 'an answered card kept its actions');
    assert(/^Approved by you at /.test(root.querySelector('.zx-approval-card__note').textContent),
      'the answered card has no verdict line');
    assert(document.activeElement === root, 'answering dropped focus out of the card');
    assert(component.handleKey(new KeyboardEvent('keydown', { key: 'r', cancelable: true })) === false,
      'a key acted on an answered card');
    assert(component.getValues().subject === 'Invoice overdue', 'approve lost the values');

    component.setStatus('pending');
    assert(!root.querySelector('.zx-approval-card__actions').hidden, 'setStatus(pending) did not restore the actions');
  }),
  componentCase('RunTrace', () => new zx.RunTrace(null, {
    authors: { finance: { name: 'Finance agent' }, collections: { name: 'Collections agent' } },
    maxResult: 20,
    steps: [
      { id: 'q', kind: 'query', label: 'Queried invoices', status: 'failed', tool: 'invoices.query', args: '{"status":"overdue"}', error: 'Timed out', ms: 900 },
      { id: 'q2', kind: 'query', label: 'Queried invoices', retryOf: 'q', result: 'RE-0121, RE-0122, RE-0123, RE-0124', ms: 700 },
      { id: 'h', kind: 'handoff', label: 'Passed on the list', actor: 'finance', to: 'collections' },
      { id: 'w', kind: 'write', label: 'Drafted reminders', status: 'running', doing: 'Drafting reminders' }
    ]
  }), async (component) => {
    const root = component.el;
    const summary = root.querySelector('.zx-run-trace__summary');
    assert(summary.getAttribute('aria-expanded') === 'false', 'RunTrace summary did not start closed');
    assert(document.getElementById(summary.getAttribute('aria-controls')) === root.querySelector('.zx-run-trace__steps'),
      'RunTrace summary does not control its list');
    assert(root.querySelector('[aria-current="step"]')?.dataset.step === 'w', 'running step lacks aria-current');
    assert(root.querySelector('[data-step="q"] .zx-run-trace__retries [data-step="q2"]'), 'retry not nested under its step');
    assert(root.querySelectorAll('[data-step="h"] .zx-avatar').length === 2, 'hand-off lacks both avatars');
    const toggles = observe(component, 'toggle');
    summary.click();
    toggles.expect();
    assert(!root.querySelector('.zx-run-trace__steps').hidden, 'summary click did not open the list');
    component.expand('q2');
    const pre = root.querySelector('[data-step="q2"] [data-section="result"] pre');
    assert(pre.textContent.length === 21, 'long result was not cut at maxResult');
    root.querySelector('[data-step="q2"] [data-action="show-all"]').click();
    assert(root.querySelector('[data-step="q2"] [data-section="result"] pre').textContent.length > 21, 'Show all failed');
    const kept = root.querySelector('[data-step="h"]');
    component.upsert({ id: 'w', kind: 'write', label: 'Drafted reminders', ms: 1200 });
    assert(root.querySelector('[data-step="h"]') === kept && !root.querySelector('[aria-current]'), 'upsert redrew more than its step');
    const reveals = observe(component, 'reveal');
    component.reveal('h');
    reveals.expect();
    assert(root.querySelector('[data-step="h"]').dataset.state === 'revealed', 'reveal did not mark the step');
    assert(component.getSteps().length === 4, 'getSteps lost a step');
    // A plan: task, ask and hand-off steps under a label, selectable rows, links, a blocked step,
    // and the one clock — which must stop with the trace.
    let ticks = 0;
    const plan = new zx.RunTrace(null, {
      open: true,
      selectable: true,
      ticking: true,
      label: 'Close September · 1 of 3 done',
      authors: { hanna: { name: 'Hanna Weber', kind: 'person' }, finance: { name: 'Finance agent' } },
      now: () => { ticks += 1; return new Date('2026-10-14T10:00:05'); },
      steps: [
        { id: 'ask', kind: 'ask', label: 'Close September', actor: 'hanna', at: '2026-10-14T09:58:12' },
        { id: 't1', kind: 'task', label: 'Match the bank feed', actor: 'finance', at: '2026-10-14T09:59:00', ms: 4000, tokens: 912,
          refs: [{ id: 'OPS-01', label: 'Account OPS-01', icon: 'table', entity: 'account' }] },
        { id: 'h', kind: 'handoff', label: 'Asked for approval', actor: 'finance', to: 'hanna' },
        { id: 't2', kind: 'task', label: 'Collect invoices', status: 'running', at: '2026-10-14T10:00:00', detail: 'Overdue only.' },
        { id: 't3', kind: 'task', label: 'Send reminders', status: 'queued' }
      ]
    });
    root.after(plan.el);
    const planRoot = plan.el;
    const planText = () => planRoot.querySelector('.zx-run-trace__summary-text').textContent;
    assert(planText() === 'Close September · 1 of 3 done · Running', `RunTrace label lost its state word: ${planText()}`);
    assert(['ask', 't1', 'h', 't2', 't3'].map((id) => planRoot.querySelector(`[data-step="${id}"]`).dataset.kind).join() === 'ask,task,handoff,task,task',
      'RunTrace dropped a new step kind');
    assert(!planRoot.querySelector('button button, .zx-run-trace__row .zx-run-trace__ref'), 'RunTrace nests a control in a row');
    assert(planRoot.querySelector('[data-step="t1"] .zx-run-trace__meta').textContent === 'Finance agent · 09:59:00 · 912 tokens',
      'RunTrace meta line is not actor · time · tokens');
    assert(planRoot.querySelector('[data-step="t1"] time').dateTime === '2026-10-14T09:59:00', 'RunTrace start time lacks its datetime');
    assert([...planRoot.querySelectorAll('[data-step="h"] .zx-avatar')].map((avatar) => avatar.dataset.shape).join() === 'rounded,circle',
      'RunTrace hand-off avatars do not follow the author kind');
    assert(planRoot.querySelector('[data-step="t2"] [data-since]')?.textContent === '5 s', 'RunTrace running step lacks its clock');
    const opens = observe(plan, 'open');
    let opened = null;
    plan.once('open', (event) => { opened = event.detail; });
    planRoot.querySelector('[data-step="t1"] .zx-run-trace__ref').click();
    opens.expect();
    assert(opened?.ref.id === 'OPS-01' && opened.step.id === 't1', 'RunTrace open detail names the wrong link');
    const selects = observe(plan, 'select');
    const picked = [];
    plan.on('select', (event) => picked.push(event.detail.id));
    const t1Row = planRoot.querySelector('[data-step="t1"] > .zx-run-trace__row');
    assert(t1Row.localName === 'button' && !t1Row.hasAttribute('aria-expanded'), 'selectable row without a body is not a plain button');
    t1Row.click();
    planRoot.querySelector('[data-step="t2"] > .zx-run-trace__row').click(); // opens: selects
    planRoot.querySelector('[data-step="t2"] > .zx-run-trace__row').click(); // closes: does not
    selects.expect();
    assert(picked.join() === 't1,t2', `RunTrace select fired for ${picked.join()}`);
    plan.upsert({ id: 't2', kind: 'task', label: 'Collect invoices', status: 'blocked', at: '2026-10-14T10:00:00' });
    assert(planRoot.dataset.state === 'blocked' && planText() === 'Close September · 1 of 3 done · Blocked', 'RunTrace blocked summary is wrong');
    assert(planRoot.querySelector('[data-step="t2"] .zx-run-trace__word')?.textContent === 'Blocked', 'blocked step lacks its word');
    plan.setLabel(null);
    assert(planText() === 'Blocked after 4.0 s', `RunTrace blocked wording is wrong: ${planText()}`);
    plan.upsert({ id: 't2', kind: 'task', label: 'Collect invoices', status: 'running', at: '2026-10-14T10:00:00' });
    if (!document.hidden) {
      const before = ticks;
      await delay(1100);
      assert(ticks > before, 'RunTrace clock did not tick');
    }
    plan.destroy();
    const atDestroy = ticks;
    await delay(1100);
    assert(ticks === atDestroy, 'RunTrace clock kept ticking after destroy()');
    assert(!planRoot.isConnected, 'RunTrace left its root behind');
  }),
  componentCase('SourceList', () => new zx.SourceList(null, {
    sources: [
      { id: 'fees', kind: 'web', title: 'Late fees', site: 'bank.example', href: 'https://bank.example/fees', snippet: '€40 per invoice.' },
      { id: 'plain', kind: 'web', title: 'Plain', href: 'http://bank.example/plain' },
      { id: 'policy', kind: 'file', title: 'Dunning policy', site: 'policy.pdf' }
    ]
  }), (component) => {
    const root = component.el;
    const list = root.querySelector('ol');
    assert(list.getAttribute('aria-labelledby') === root.querySelector('.zx-source-list__label').id, 'SourceList list is not labelled');
    assert(!root.querySelector('img, [src]'), 'SourceList loaded a remote resource');
    const first = root.querySelector('[data-n="1"]');
    assert(first.localName === 'button' && first.textContent === 'Source 1: bank.example', 'source button name is wrong');
    const opened = [];
    const realOpen = window.open;
    window.open = (...args) => { opened.push(args); return null; };
    try {
      const selects = observe(component, 'select');
      first.click();
      selects.expect();
      assert(opened.length === 1 && opened[0][0] === 'https://bank.example/fees' && opened[0][2] === 'noopener,noreferrer',
        'web source did not open its https address safely');
      root.querySelector('[data-n="2"]').click();
      root.querySelector('[data-n="3"]').click();
      assert(opened.length === 1, 'an http or file source opened a window');
      component.once('select', (event) => event.preventDefault());
      first.click();
      assert(opened.length === 1, 'a prevented select still opened the source');
    } finally {
      window.open = realOpen;
    }
    component.highlight(3);
    assert(root.querySelector('[data-n="3"]').dataset.state === 'highlighted', 'highlight did not mark the source');
    component.setSources([{ id: 'only', title: 'Only' }]);
    assert(component.getSources().length === 1 && root.querySelectorAll('button').length === 1, 'setSources failed');
  }),
  presenceLoopCase(),
  componentCase('AgentThread', () => new zx.AgentThread(null, {
    authors: { me: { name: 'Hanna Weber', kind: 'person' }, finance: { name: 'Finance agent', tone: 'violet' } },
    answerActions: ['copy', 'regenerate', 'rate'],
    items: [
      { id: 'ask', type: 'user', text: 'Reconcile September.', files: [{ name: 'Policy.pdf', size: 1200 }] },
      { id: 'note', type: 'text', author: 'finance', text: 'Checking the bank feed first.' },
      { id: 'work', type: 'trace', author: 'finance', steps: [
        { id: 'q', kind: 'query', label: 'Queried invoices', tool: 'invoices.search', args: '{"month": 9}', result: '42 rows' }
      ] },
      { id: 'a1', type: 'answer', author: 'finance', blocks: [{ type: 'p', text: 'Three are late [1].' }],
        sources: [{ id: 'inv', title: 'Invoices · September', kind: 'call', call: 'q' }] },
      { id: 'ok', type: 'approval', author: 'finance', title: 'Send 3 reminder emails?', status: 'pending' }
    ]
  }), async (component) => {
    const root = component.toElement();
    const feed = root.querySelector('[role="feed"]');
    const articles = () => [...root.querySelectorAll('article')];
    assert(feed && articles().length === 5 && articles()[0].getAttribute('aria-setsize') === '5', 'feed semantics missing');
    assert(articles().every((article) => article.getAttribute('aria-labelledby')
      && document.getElementById(String(article.getAttribute('aria-labelledby')))), 'an article is not named by its byline');
    assert(articles()[0].dataset.mine === 'true' && articles()[2].dataset.continued === 'true', 'turns are not grouped by author');
    // A source that names a call reveals the step it came from.
    /** @type {HTMLButtonElement} */ (root.querySelector('.zx-source-list button')).click();
    assert(root.querySelector('[data-state="revealed"]'), 'a source did not reveal its tool call');
    const cites = observe(component, 'cite');
    /** @type {HTMLButtonElement} */ (root.querySelector('[data-cite="1"]')).click();
    cites.expect();
    // The approval answers from its own keys and the thread re-emits it.
    const approvals = observe(component, 'approve');
    let heard = 0;
    root.addEventListener('zx-approve', () => { heard += 1; });
    const card = /** @type {HTMLElement} */ (root.querySelector('.zx-approval-card'));
    card.focus();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    approvals.expect();
    assert(heard === 1, `the thread's root heard zx-approve ${heard} times`);
    assert(component.get('ok')?.status === 'approved', 'the thread did not record the approval');
    // Streaming: a new id becomes an answer; the feed is busy until it is finished.
    component.appendText('a2', 'Bruckner pays late **9 times');
    component.appendText('a2', '** out of 14.');
    assert(feed.getAttribute('aria-busy') === 'true', 'a streaming answer did not make the feed busy');
    assert(!root.querySelector('article[data-id="a2"] .zx-agent-thread__actions'), 'a streaming answer offered actions');
    component.patch('a2', { streaming: false });
    assert(feed.getAttribute('aria-busy') === 'false', 'the feed stayed busy after the answer ended');
    assert(root.querySelector('article[data-id="a2"] strong')?.textContent === '9 times', 'a marker split across chunks did not resolve');
    assert(root.querySelector('article[data-id="a2"] [data-thread-action="regenerate"]')
      && !root.querySelector('article[data-id="a1"] [data-thread-action="regenerate"]'), 'regenerate is not offered on the latest answer only');
    const actions = observe(component, 'action');
    /** @type {HTMLButtonElement} */ (root.querySelector('article[data-id="a2"] [data-thread-action="rate"]')).click();
    actions.expect();
    assert(component.get('a2')?.rating === 'up', 'rating was not recorded');
    // Feed keys move between articles.
    articles()[0].focus();
    articles()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
    assert(document.activeElement === articles()[1], 'PageDown did not move to the next article');
    // Replacing in place, registering a type, removing.
    component.upsert({ id: 'note', type: 'notice', text: 'The bank feed timed out.', tone: 'warning' });
    assert(articles().length === 6 && articles()[1].dataset.type === 'notice', 'upsert did not replace in place');
    if (!zx.AgentThread.has('smoke-card')) zx.AgentThread.register('smoke-card', (item) => zx.h('p', { class: 'smoke-card' }, String(item.text)));
    component.upsert({ id: 'custom', type: 'smoke-card', text: 'Custom' });
    assert(root.querySelector('.smoke-card')?.textContent === 'Custom', 'a registered item type was not drawn');
    component.remove('custom');
    assert(!root.querySelector('.smoke-card') && articles().length === 6, 'remove left the item behind');
    await delay(100);
    assert(root.querySelector('.zx-agent-thread__status')?.textContent, 'no milestone was announced');
    // Extras: mentions, links, notices with an action, message actions, version steps, writing.
    const extra = new zx.AgentThread(null, {
      authors: { finance: { name: 'Finance agent' } }, userActions: ['edit', 'copy'],
      items: [
        { id: 'u', type: 'user', text: 'Ask @Analyst about it', mentions: ['Analyst'], refs: [{ id: 't1', label: 'Task #214', icon: 'list' }] },
        { id: 'n', type: 'notice', text: 'Branched from the nightly export.', action: { id: 'back', label: 'Back to original' } },
        { id: 'v', type: 'answer', author: 'finance', blocks: [], version: 1, versions: [
          { blocks: [{ type: 'p', text: 'First' }], steps: [{ id: 's1', kind: 'read', label: 'Read the first draft' }] },
          { blocks: [{ type: 'artifact', id: 'doc', title: 'Draft' }], steps: [{ id: 's2', kind: 'read', label: 'Read the second draft' }] }
        ] },
        { id: 'w', type: 'answer', author: 'finance', blocks: [], streaming: true }
      ]
    });
    root.after(extra.toElement());
    const host = extra.toElement();
    try {
      assert(host.querySelector('.zx-agent-thread__mention')?.textContent === '@Analyst', 'a mention was not marked');
      const opens = observe(extra, 'open');
      /** @type {HTMLButtonElement} */ (host.querySelector('[data-thread-action="open"]')).click();
      opens.expect();
      const notice = /** @type {HTMLElement} */ (host.querySelector('article[data-id="n"]'));
      assert(document.getElementById(String(notice.getAttribute('aria-labelledby')))?.textContent === 'Branched from the nightly export.',
        'a notice is not named by its own text');
      /** @type {string[]} */
      const acted = [];
      extra.on('action', (event) => acted.push(String(/** @type {CustomEvent} */ (event).detail.action)));
      /** @type {HTMLButtonElement} */ (notice.querySelector('.zx-agent-thread__notice-action')).click();
      /** @type {HTMLButtonElement} */ (host.querySelector('article[data-id="u"] [data-thread-action="edit"]')).click();
      assert(acted.join() === 'back,edit', `notice and message actions reported ${acted.join()}`);
      assert(host.querySelector('article[data-id="v"] .zx-run-trace')?.textContent?.includes('second draft'), 'the version did not bring its steps');
      extra.setArtifactState('doc', { expanded: true, controls: 'inspector' });
      assert(host.querySelector('[data-artifact="doc"]')?.getAttribute('aria-expanded') === 'true', 'setArtifactState did not reach the card');
      /** @type {HTMLButtonElement} */ (host.querySelector('article[data-id="v"] [data-thread-dir="previous"]')).click();
      assert(host.querySelector('article[data-id="v"] .zx-run-trace')?.textContent?.includes('first draft'), 'paging did not swap the steps');
      assert(/** @type {HTMLElement} */ (document.activeElement)?.dataset.threadAction === 'version', 'paging lost the focus');
      const writing = /** @type {HTMLElement} */ (host.querySelector('article[data-id="w"] .zx-agent-thread__writing'));
      assert(!writing.hidden, 'an empty streaming answer did not say who is writing');
      extra.appendText('w', 'Here');
      assert(writing.hidden, 'the writing line stayed after the first words');
    } finally {
      extra.destroy();
    }
  }),
  ...surfaceCases(),
  ...surfaceSafetyCases(),
  ...agUiCases()
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
      // A preset hands its text to the constructor, and still reads the instance's `msg` option.
      const translated = zx.Select.entity(null, {
        items: [{ ID: 1, name: 'Account' }],
        recent: [{ ID: 2, name: 'Contact' }],
        create: true,
        msg: { 'select.recent': 'Kürzlich', 'select.create': 'Anlegen', 'select.createGroup': 'Aktion' }
      });
      const text = translated.el.textContent;
      translated.destroy();
      for (const expected of ['Kürzlich', 'Anlegen', 'Aktion']) {
        assert(text.includes(expected), `Select.entity() ignored its msg option: ${text}`);
      }
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
      /*
       * A page cannot press a real key: a dispatched keydown is untrusted, and the browser never
       * turns an untrusted Escape into the dialog's close request, so whether the dialog closes is
       * out of reach here. What the overlay stack controls is the keydown itself. It must route
       * the key to the menu and cancel it, because a cancelled keydown is what keeps a real Escape
       * from going on to fire the dialog's `cancel` — so assert exactly that.
       */
      let cancels = 0;
      dialog.on('cancel', () => { cancels += 1; });
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      items[1].dispatchEvent(escape);
      assert(escape.defaultPrevented, 'the overlay stack did not consume the Escape it gave the menu');
      assert(!menu.isOpen() && dialog.isOpen() && cancels === 0, 'Escape in the menu must close the menu only');
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

/**
 * A generic Dropdown panel follows its trigger in the Tab order — including a panel whose controls
 * are composites with `tabindex="-1"` parts (a Select's toggle) and a roving toolbar.
 * @returns {SmokeDefinition}
 */
function dropdownTabReachCase() {
  return {
    name: 'Dropdown (Tab reach)',
    create(fixture) {
      const anchor = zx.button({ label: 'Sort' });
      const after = zx.button({ label: 'After' });
      fixture.append(anchor, after);
      const field = document.createElement('input');
      field.setAttribute('aria-label', 'Search');
      const toolbar = new zx.Toolbar(null, {
        label: 'Direction', overflow: false,
        items: [{ name: 'asc', label: 'Ascending' }, { name: 'desc', label: 'Descending' }]
      });
      const select = new zx.Select(null, { items: sampleItems(), value: 1, label: 'Sort by' });
      const content = document.createElement('div');
      content.append(field, toolbar.el, select.el);
      const component = new zx.Dropdown(anchor, { content });
      return { component, anchor, after, field, toolbar, select };
    },
    exercise({ component, anchor, after, field, toolbar, select }) {
      const tab = (target, shiftKey = false) => {
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        return event;
      };
      anchor.click();
      assert(component.isOpen(), 'the trigger did not open the panel');
      anchor.focus();
      tab(anchor);
      assert(document.activeElement === field, 'Tab from the trigger did not enter the panel');
      tab(field, true);
      assert(document.activeElement === anchor, 'Shift+Tab from the first control did not return to the trigger');

      // The toolbar's roving stop has a real stop after it, the Select: Tab stays native there.
      const stop = [...toolbar.el.querySelectorAll('button')].find((button) => button.tabIndex >= 0);
      assert(stop, 'the toolbar exposes no roving Tab stop');
      stop.focus();
      assert(!tab(stop).defaultPrevented, 'Tab was taken from a control with a stop after it in the panel');

      // The Select's input is the last real stop; its tabindex="-1" toggle after it is not one.
      const input = select.el.querySelector('[role="combobox"]');
      const parts = [...select.el.querySelectorAll('button, [tabindex]')].filter((part) => part !== input);
      assert(parts.every((part) => part.tabIndex < 0), 'the Select gained a second Tab stop');
      input.focus();
      tab(input);
      assert(document.activeElement === after, `Tab from the last real stop went to ${document.activeElement?.outerHTML.slice(0, 60)}`);
      const toggle = parts[0];
      if (toggle) {
        toggle.focus();
        tab(toggle);
        assert(document.activeElement === after, 'Tab from a composite part after the last stop did not leave the panel');
      }
      field.focus();
      component.close();
      assert(document.activeElement === anchor, 'closing with focus inside did not return it to the trigger');
    },
    destroy({ component, anchor, after, toolbar, select }) {
      select.destroy();
      toolbar.destroy();
      component.destroy();
      anchor.remove();
      after.remove();
    }
  };
}

/**
 * The Launcher is a modal on the overlay stack: never nested in the dialog it was opened from,
 * Escape inside it reaches no popup behind it, and toasts move into it.
 * @returns {SmokeDefinition}
 */
function launcherLayeringCase() {
  return {
    name: 'Launcher (layering)',
    create(fixture) {
      const anchor = zx.button({ label: 'Behind' });
      fixture.append(anchor);
      const dropdown = new zx.Dropdown(anchor, { content: 'Panel text', openOn: 'manual' });
      const inside = zx.button({ label: 'Search' });
      const dialog = new zx.Dialog(null, { title: 'Records', content: inside });
      const launcher = new zx.Launcher(null, { debounce: 0, scope: inside, items: [{ id: 'one', label: 'One' }] });
      return { anchor, dropdown, inside, dialog, launcher };
    },
    async exercise({ dropdown, inside, dialog, launcher }) {
      dropdown.open();
      dialog.open();
      await nextFrame();
      inside.focus();
      launcher.open();
      await nextFrame();
      assert(!dialog.el.contains(launcher.el), 'the launcher was nested inside the dialog it was opened from');
      const handle = zx.Message.show('Indexed.', { timeout: 0 });
      const region = document.querySelector('.zx-message-region');
      assert(region?.parentElement === launcher.el, 'the toast region did not move into the open launcher');
      handle.close();
      zx.Message.disposeRegion(region);
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      launcher.refs.input.dispatchEvent(escape);
      assert(dropdown.isOpen(), 'Escape inside the launcher closed a dropdown behind it');
      const closed = new Promise((resolve) => launcher.once('close', resolve));
      launcher.close();
      await closed;
      const dialogClosed = new Promise((resolve) => dialog.once('close', resolve));
      dialog.close();
      await dialogClosed;
      dropdown.close();
    },
    destroy({ anchor, dropdown, dialog, launcher }) {
      launcher.destroy();
      dialog.destroy();
      dropdown.destroy();
      anchor.remove();
    }
  };
}

/** A non-modal Sheet opened from inside a modal Dialog is hosted by it and usable. @returns {SmokeDefinition} */
function sheetInDialogCase() {
  return {
    name: 'Sheet (non-modal inside a Dialog)',
    create() {
      const opener = zx.button({ label: 'Details' });
      const dialog = new zx.Dialog(null, { title: 'Order', content: opener });
      const field = document.createElement('input');
      field.setAttribute('aria-label', 'Note');
      const sheet = new zx.Sheet(null, { title: 'Details', content: field, modal: false, lightDismiss: false });
      return { opener, dialog, sheet, field };
    },
    async exercise({ opener, dialog, sheet, field }) {
      dialog.open();
      await nextFrame();
      opener.focus();
      sheet.open();
      // Let the slide-in settle: mid-transition the field can still be outside the viewport.
      await delay(500);
      assert(dialog.el.contains(sheet.el), 'the sheet was mounted outside the modal it was opened from');
      assert(field.contains(hitAt(field)), 'the sheet is not hit-testable above the dialog');
      field.focus();
      assert(document.activeElement === field, 'the sheet\'s field cannot take focus under the modal');
      sheet.close();
      await Promise.resolve();
      await nextFrame();
      assert(!dialog.el.contains(sheet.el), 'a closed sheet stayed inside the dialog');
      opener.focus();
      sheet.open();
      const closed = new Promise((resolve) => dialog.once('close', resolve));
      dialog.close();
      await closed;
      await Promise.resolve();
      assert(!sheet.isOpen(), 'closing the dialog left the sheet it hosted open and unseen');
    },
    destroy({ dialog, sheet }) {
      sheet.destroy();
      dialog.destroy();
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
 * Rows for a windowed table, numbered from 1 and named so they sort by that number.
 * @param {number} count Row count.
 * @returns {Array<{ID: number, name: string, city: string}>}
 */
function windowedRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    ID: index + 1, name: `Row ${String(index + 1).padStart(4, '0')}`, city: `City ${index % 7}`
  }));
}

/**
 * Waits until a windowed table has measured itself: the observer reports on one frame and the
 * measurement runs on the next.
 * @returns {Promise<void>}
 */
async function windowSettled() {
  await nextFrame();
  await nextFrame();
}

/** @param {Element|null|undefined} row @returns {number} The row's `aria-rowindex`, or 0. */
function rowIndexOf(row) {
  return Number(row?.getAttribute('aria-rowindex') ?? 0);
}

/**
 * Asserts what must hold of the body of a windowed table at any moment: its rows are in order, each
 * says where it is, and each stripe belongs to its row's place in the data rather than in the DOM.
 * @param {HTMLElement} root Table root.
 * @returns {void}
 */
function assertWindowIntact(root) {
  const rows = [...root.querySelectorAll('tbody tr[data-row]')];
  rows.forEach((row, position) => {
    const index = rowIndexOf(row);
    assert(index >= 2, 'a drawn row has no aria-rowindex');
    assert(position === 0 || index > rowIndexOf(rows[position - 1]), 'drawn rows are out of order');
    assert(row.hasAttribute('data-stripe') === ((index - 2) % 2 === 1), `row ${index} carries the wrong stripe`);
  });
  assert(root.querySelectorAll('tbody [tabindex="0"]').length === 1, 'the body is not exactly one Tab stop');
}

/** Windowed rendering: one grid over every row, whichever few of them are drawn. @returns {SmokeDefinition} */
function tableWindowedCase() {
  return {
    name: 'Table (windowed)',
    create(fixture) {
      const opened = [];
      const component = new zx.Table(null, {
        virtual: true,
        height: 240,
        selectable: 'multi',
        label: 'Orders',
        columns: [
          { id: 'name', label: 'Name', sortable: true },
          { id: 'city', label: 'City' },
          {
            id: 'open', label: '', ariaLabel: 'Open',
            render: (row) => zx.h('button', { type: 'button', class: 'qa-open', onclick: () => opened.push(row.ID) }, 'Open')
          }
        ],
        data: windowedRows(2000)
      });
      fixture.append(component.toElement());
      return { component, opened };
    },
    async exercise({ component, opened }) {
      await windowSettled();
      const root = component.el;
      const table = root.querySelector('table');
      const scroller = root.querySelector('.zx-table__scroll');
      const drawn = () => [...root.querySelectorAll('tbody tr[data-row]')];
      const focused = () => rowIndexOf(document.activeElement?.closest('tr'));
      const row = (index) => root.querySelector(`tbody tr[aria-rowindex="${index}"]`);
      const inView = (element) => {
        const box = element.getBoundingClientRect();
        const view = scroller.getBoundingClientRect();
        const head = root.querySelector('thead').getBoundingClientRect().height;
        return box.top >= view.top + head - 1 && box.bottom <= view.top + scroller.clientHeight + 1;
      };

      // One grid: the count of the whole table, and each drawn row saying where it is.
      assert(table.getAttribute('role') === 'grid', 'a windowed table is not a grid');
      assert(table.getAttribute('aria-rowcount') === '2001', `aria-rowcount is ${table.getAttribute('aria-rowcount')}`);
      assert(root.querySelector('thead tr').getAttribute('aria-rowindex') === '1', 'the header row has no aria-rowindex');
      const rowHeight = drawn()[0].getBoundingClientRect().height;
      const inRegion = Math.ceil(scroller.clientHeight / rowHeight);
      assert(drawn().length <= inRegion * 2 + 2, `drew ${drawn().length} rows for ${inRegion} in view`);
      assert(component.getRenderedCount() === drawn().length, 'getRenderedCount() is not what is drawn');
      assertWindowIntact(root);

      // The spacers carry the height of every row that is not drawn.
      const head = root.querySelector('thead').getBoundingClientRect().height;
      const height = scroller.scrollHeight;
      assert(Math.abs(height - head - 2000 * rowHeight) < 3, `scroll height ${height} for 2000 rows of ${rowHeight}`);
      const spacer = root.querySelector('.zx-table__spacer');
      assert(spacer.getAttribute('aria-hidden') === 'true' && !spacer.hasAttribute('data-row'), 'a spacer reads as a row');
      assert(getComputedStyle(spacer.firstElementChild).paddingBlockStart === '0px', 'a spacer took a cell\'s padding');

      // The keyboard map reaches the last row and comes back, drawing what it lands on.
      drawn()[0].focus();
      assert(pressKey('End').defaultPrevented && focused() === 2001, `End reached row ${focused()}`);
      assert(document.activeElement.textContent.includes('Row 2000') && inView(document.activeElement),
        'End did not bring the last row into view');
      assert(drawn().length <= inRegion * 2 + 3, 'End left the rows it passed drawn');
      pressKey('ArrowUp');
      assert(focused() === 2000, 'ArrowUp did not move from the last row');
      pressKey('PageUp');
      const page = 2000 - focused();
      assert(page >= 1 && inView(document.activeElement), 'PageUp did not move by a page');
      pressKey('PageDown');
      assert(focused() === 2000, 'PageDown did not come back');
      pressKey('Home');
      assert(focused() === 2 && inView(document.activeElement), `Home reached row ${focused()}`);
      pressKey('End', { ctrlKey: true });
      assert(focused() === 2001, 'Ctrl+End did not reach the last row');
      pressKey('Home', { ctrlKey: true });
      assert(focused() === 2 && scroller.scrollTop === 0, 'Ctrl+Home did not reach the first row');
      for (let step = 0; step < 40; step += 1) pressKey('ArrowDown');
      assert(focused() === 42 && inView(document.activeElement), `40 × ArrowDown reached row ${focused()}`);
      assertWindowIntact(root);

      // The focused row outlives scrolling away from it, in its place, and the keys carry on from it.
      pressKey('Home');
      const held = document.activeElement;
      scroller.scrollTop = height;
      await windowSettled();
      assert(document.activeElement === held && held.isConnected, 'scrolling away removed the focused row');
      assert(row(2001), 'the rows at the end were not drawn');
      assert(drawn().length <= inRegion * 2 + 3, `${drawn().length} rows drawn at the end`);
      assert(Math.abs(scroller.scrollHeight - height) < 3,
        `keeping the focused row moved the scroll height from ${height} to ${scroller.scrollHeight}, `
        + `rows ${[...new Set(drawn().map((tr) => tr.getBoundingClientRect().height))].join('/')}, `
        + `spacers ${[...root.querySelectorAll('.zx-table__spacer')].map((tr) => tr.getBoundingClientRect().height).join('/')}`);
      assertWindowIntact(root);
      pressKey('ArrowDown');
      assert(focused() === 3 && inView(document.activeElement), 'ArrowDown did not return to the row after the focused one');

      // Sticky header: still there, at the top of the region, far down the table.
      component.reveal(1000);
      await windowSettled();
      const header = root.querySelector('thead th');
      assert(getComputedStyle(header).position === 'sticky', 'the header stopped sticking');
      assert(Math.abs(header.getBoundingClientRect().top - scroller.getBoundingClientRect().top) < 3,
        'the header scrolled away');

      // A Shift range reaches rows that are not drawn, pointer and keyboard alike.
      assert(component.reveal(5), 'reveal() did not reach a row');
      await windowSettled();
      row(6).querySelector('.zx-table__row-checkbox').click();
      component.reveal(1500);
      await windowSettled();
      assert(!row(6) || row(6).matches('[tabindex="0"]'), 'the row the range began on should have left the window');
      row(1501).querySelector('.zx-table__row-checkbox')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
      const range = component.getSelection();
      assert(range.length === 1496 && range[0].ID === 5 && range.at(-1).ID === 1500,
        `Shift+click selected ${range.length} rows, ${range[0]?.ID}–${range.at(-1)?.ID}`);
      component.reveal(700);
      await windowSettled();
      assert(row(701).getAttribute('aria-selected') === 'true'
        && row(701).querySelector('.zx-table__row-checkbox').checked,
      'a row drawn after the selection does not show it');
      const selectAll = root.querySelector('thead .zx-table__select-all');
      assert(selectAll.indeterminate, 'select-all does not show a partial selection');

      component.clearSelection();
      drawn().at(-1).focus();
      const anchor = focused();
      pressKey(' ');
      pressKey('End', { shiftKey: true });
      assert(component.getSelection().length === 2001 - anchor + 1,
        `Shift+End selected ${component.getSelection().length} rows from row ${anchor}`);
      pressKey('a', { ctrlKey: true });
      assert(component.getSelection().length === 2000 && selectAll.checked, 'Ctrl+A did not take every row');
      component.clearSelection();

      // Row actions in a cell work on rows drawn later.
      component.reveal(1234);
      await windowSettled();
      row(1235).querySelector('.qa-open').click();
      assert(opened.join() === '1234', `the row's action ran for ${opened.join()}`);

      // A sort while scrolled leaves the scroll position and redraws what is there; focus goes with its row.
      row(1235).focus();
      const scrolled = scroller.scrollTop;
      component.setSort('name', 'desc');
      assert(scroller.scrollTop === scrolled, `the sort scrolled from ${scrolled} to ${scroller.scrollTop}`);
      await windowSettled();
      const data = component.getData();
      assert(data[0].ID === 2000, 'the sort did not reorder the data');
      for (const tr of drawn()) {
        const expected = data[rowIndexOf(tr) - 2].name;
        assert(tr.querySelector('[data-column="name"]').textContent === expected, `row ${rowIndexOf(tr)} shows the old order`);
      }
      assert(document.activeElement.textContent.includes('Row 1234') && focused() === 2000 - 1234 + 2,
        'the sort lost the focused row');
      assertWindowIntact(root);

      // reveal() draws a row by id, and says when there is no such row.
      assert(component.reveal(1) && inView(row(2001)), 'reveal() did not bring the row into view');
      assert(component.reveal('nobody') === false, 'reveal() claimed a row that does not exist');

      // Filtering shrinks the table under a scroll position past its new end.
      component.setSort('name', 'asc');
      component.setData(windowedRows(30));
      assert(table.getAttribute('aria-rowcount') === '31', 'aria-rowcount did not follow the data');
      await windowSettled();
      assert(drawn().at(-1) === row(31) && scroller.scrollTop <= scroller.scrollHeight - scroller.clientHeight,
        'the last rows were not drawn after filtering');
      assertWindowIntact(root);

      component.setData([]);
      assert(root.querySelector('.zx-table__empty') && !root.querySelector('.zx-table__spacer'), 'no empty state');
      assert(component.getRenderedCount() === 0, 'an empty table still counts rows');
      assert(root.contains(document.activeElement), 'emptying the table dropped focus');
      component.setData(windowedRows(2000));
      await windowSettled();
      assert(document.activeElement.closest?.('tr[data-row]'), 'new rows did not take focus back');
      assertWindowIntact(root);

      // Export reads the data, so it holds every row wherever the window is.
      const csv = zx.toCsv(component.getData(), ['ID', 'name']);
      assert(csv.split('\r\n').length === 2001, 'export did not hold every row');
    },
    destroy({ component }) { component.destroy(); }
  };
}

/** Editing in a windowed table: the row being edited is never removed. @returns {SmokeDefinition} */
function tableWindowedEditingCase() {
  return {
    name: 'Table (windowed editing)',
    create(fixture) {
      const component = new zx.Table(null, {
        virtual: true,
        height: 240,
        editMode: 'cell',
        label: 'Orders',
        columns: [{ id: 'name', label: 'Name', editable: true }, { id: 'city', label: 'City', editable: true }],
        data: windowedRows(500)
      });
      fixture.append(component.toElement());
      return { component };
    },
    async exercise({ component }) {
      await windowSettled();
      const root = component.el;
      const scroller = root.querySelector('.zx-table__scroll');
      const focused = () => document.activeElement?.closest('td');

      // Cell focus reaches the corners of the whole table.
      root.querySelector('tbody td[tabindex="0"]').focus();
      pressKey('End', { ctrlKey: true });
      assert(rowIndexOf(focused()?.parentElement) === 501 && focused().dataset.column === 'city',
        'Ctrl+End did not reach the last cell of the last row');
      pressKey('Home', { ctrlKey: true });
      assert(rowIndexOf(focused()?.parentElement) === 2 && focused().dataset.column === 'name',
        'Ctrl+Home did not reach the first cell of the first row');

      // startEdit() draws a row that is not drawn.
      component.startEdit(400, 'name');
      assert(component.isEditing(), 'startEdit() did not reach a row outside the window');
      const editing = root.querySelector('tbody tr[data-editing="true"]');
      const input = editing.querySelector('.zx-table__editor-input');
      assert(rowIndexOf(editing) === 401 && document.activeElement === input, 'the editor did not take focus');

      // The row being edited stays, editor and all, when the reader scrolls away and back.
      input.value = 'Edited';
      scroller.scrollTop = 0;
      await windowSettled();
      assert(editing.isConnected && input.isConnected && component.isEditing(), 'scrolling away removed the edited row');
      assert(document.activeElement === input, 'scrolling away took focus out of the editor');
      assert(root.querySelector('tbody tr[aria-rowindex="2"]'), 'the rows in view were not drawn');
      assertWindowIntact(root);
      component.commitEdit();
      assert(component.getRow(400).name === 'Edited' && !component.isEditing(), 'the edit did not commit');
      assert(document.activeElement?.closest('tr') && rowIndexOf(document.activeElement.closest('tr')) === 401,
        'focus did not return to the edited cell');

      // Tab walks from an open editor into a row that has to be drawn.
      component.startEdit(1, 'city');
      scroller.scrollTop = scroller.scrollHeight;
      await windowSettled();
      assert(!root.querySelector('tbody tr[aria-rowindex="3"]'), 'the next row should have left the window');
      pressKey('Tab');
      const moved = component.getEditing();
      assert(moved?.id === 2 && moved.columnId === 'name', `Tab moved the edit to ${JSON.stringify(moved)}`);
      assert(root.querySelector('tbody tr[aria-rowindex="3"][data-editing="true"]'), 'Tab did not draw the next row');
      component.cancelEdit();
    },
    destroy({ component }) { component.destroy(); }
  };
}

/** Section rows, a tree, stacking, and the options a window has to refuse. @returns {SmokeDefinition} */
function tableWindowedStructureCase() {
  return {
    name: 'Table (windowed structure)',
    create(fixture) {
      const sections = new zx.Table(null, {
        virtual: true,
        height: 240,
        rowKind: 'kind',
        rowKinds: { section: { span: true } },
        columns: [{ id: 'name', label: 'Name', sortable: true }, { id: 'city', label: 'City' }],
        data: windowedRows(1000).map((row, index) => (index % 10 === 0
          ? { ID: row.ID, kind: 'section', name: `Section ${index / 10 + 1}` } : row))
      });
      const tree = new zx.Table(null, {
        virtual: true,
        height: 240,
        hierarchy: { parentId: 'parent', expanded: true },
        columns: [{ id: 'name', label: 'Name' }],
        data: [{ ID: 0, parent: null, name: 'Root' },
          ...windowedRows(600).map((row) => ({ ...row, parent: 0 }))]
      });
      const host = zx.h('div', {}, sections.toElement(), tree.toElement());
      fixture.append(host);
      return { sections, tree, host };
    },
    async exercise({ sections, tree, host }) {
      await windowSettled();

      // Grouped: section rows draw as they scroll in, and the sort stays withheld.
      const scroller = sections.el.querySelector('.zx-table__scroll');
      assert(!sections.el.querySelector('.zx-table__sort-button'), 'a grouped table offered a sort');
      scroller.scrollTop = scroller.scrollHeight;
      await windowSettled();
      const section = [...sections.el.querySelectorAll('tbody tr[data-span]')].at(-1);
      assert(section && rowIndexOf(section) === 992 && section.querySelector('th[colspan="2"]'),
        'the section rows at the end were not drawn');
      assertWindowIntact(sections.el);

      // Treegrid: the parent of a row at the far end is not drawn until ArrowLeft asks for it.
      const rows = () => tree.el.querySelectorAll('tbody tr[data-row]');
      assert(tree.el.querySelector('table').getAttribute('role') === 'treegrid', 'hierarchy lost its treegrid');
      rows()[0].focus();
      pressKey('End');
      assert(rowIndexOf(document.activeElement) === 602, 'End did not reach the last child');
      pressKey('ArrowLeft');
      assert(rowIndexOf(document.activeElement) === 2, 'ArrowLeft did not draw and focus the parent');
      pressKey('ArrowRight');
      assert(rowIndexOf(document.activeElement) === 3, 'ArrowRight did not move into the first child');
      pressKey('ArrowUp');
      pressKey('ArrowLeft');
      assert(tree.getExpanded().length === 0 && rowIndexOf(document.activeElement) === 2, 'collapse lost the row');
      assert(tree.el.querySelector('table').getAttribute('aria-rowcount') === '2', 'aria-rowcount ignored the collapse');
      tree.expandAll();
      await windowSettled();

      // Collapsing hands focus to the ancestor even when that ancestor was not drawn.
      tree.el.querySelector('tbody tr[tabindex="0"]').focus();
      pressKey('End');
      assert(rowIndexOf(document.activeElement) === 602, 'End did not reach the last child again');
      tree.collapseRow(0);
      assert(rowIndexOf(document.activeElement) === 2, 'collapsing the branch lost focus');

      // `growing` gives way to `virtual`, and says so once.
      const warnings = [];
      const warn = console.warn;
      console.warn = (...args) => warnings.push(args.join(' '));
      const both = new zx.Table(null, {
        virtual: true, growing: 5, height: 240, columns: [{ id: 'name', label: 'Name' }], data: windowedRows(300)
      });
      host.append(both.toElement());
      await windowSettled();
      both.setData(windowedRows(400));
      console.warn = warn;
      const conflicts = warnings.filter((text) => text.includes('growing'));
      assert(conflicts.length === 1, `the conflict was reported ${conflicts.length} times`);
      assert(!both.el.querySelector('.zx-table__more'), 'virtual did not win over growing');
      assert(both.el.querySelectorAll('tbody tr[data-row]').length > 5, 'growing still held the rows back');
      both.destroy();

      // A table that does not ask for any of this is left alone.
      const plain = new zx.Table(null, { columns: [{ id: 'name', label: 'Name' }], data: windowedRows(50) });
      host.append(plain.toElement());
      assert(plain.el.querySelectorAll('tbody tr[data-row]').length === 50, 'a plain table stopped drawing every row');
      assert(!plain.el.querySelector('.zx-table__spacer, .zx-table__row-probe'), 'a plain table grew window parts');
      assert(!plain.el.querySelector('table').hasAttribute('aria-rowcount'), 'a plain table announces a row count');
      assert(!plain.el.hasAttribute('data-virtual'), 'a plain table is marked windowed');
      plain.destroy();
    },
    destroy({ sections, tree, host }) {
      sections.destroy();
      tree.destroy();
      host.remove();
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

      // A range anchored before a sort must not be applied to the new order.
      component.clearSelection();
      component.setSort('name', 'asc');
      body.querySelector('tr[data-row]').focus();
      pressKey(' ');
      pressKey('ArrowDown');
      // Acme is the anchor; after the sort, Borealis is focused with Acme below it. Extending must
      // start from the focused row, not from an anchor taken in the old order.
      component.setSort('name', 'desc');
      pressKey('ArrowDown', { shiftKey: true });
      const picked = component.getSelection().map((row) => row.name).sort().join();
      assert(picked === 'Acme GmbH,Borealis AB',
        `Shift+ArrowDown after a sort selected ${picked}`);

      // Emptied while focused: focus stays in the table instead of falling to <body>.
      component.setData([]);
      assert(component.el.contains(document.activeElement), 'emptying the table dropped focus to the document');
      component.setData([{ id: 9, name: 'Zephyr SA', city: 'Lyon' }]);
      assert(focusedName() === 'Zephyr SA', 'new rows did not take focus back from the empty table');
    },
    destroy({ component }) { component.destroy(); }
  };
}

/** Grid only when interactive, and re-renders that never scroll the page. @returns {SmokeDefinition} */
function tableInteractivityCase() {
  return {
    name: 'Table (interactive opt-in)',
    create(fixture) {
      const scroller = document.createElement('div');
      scroller.style.cssText = 'block-size: 200px; overflow: auto';
      const spacer = document.createElement('div');
      spacer.style.blockSize = '2000px';
      const rows = (count, offset = 0) => Array.from({ length: count }, (_, index) =>
        ({ ID: index + offset, name: `Row ${index + offset}` }));
      const plain = new zx.Table(null, { columns: [{ id: 'name', label: 'Name' }], data: rows(3) });
      const growing = new zx.Table(null, {
        selectable: 'multi', growing: 5, columns: [{ id: 'name', label: 'Name' }], data: rows(12)
      });
      scroller.append(plain.toElement(), growing.toElement(), spacer);
      fixture.append(scroller);
      return { plain, growing, scroller, rows };
    },
    exercise({ plain, growing, scroller, rows }) {
      const table = plain.el.querySelector('table');
      assert(!table.hasAttribute('role') && !table.hasAttribute('aria-label'),
        'a read-only display table became a named grid');
      assert(!plain.el.querySelector('tbody [tabindex]'), 'a read-only display table has row Tab stops');

      let clicks = 0;
      plain.on('rowclick', () => { clicks += 1; });
      assert(table.getAttribute('role') === 'grid' && plain.el.querySelector('tbody tr[tabindex="0"]'),
        'a rowclick listener did not make the table a grid');
      plain.el.querySelector('tbody tr').focus();
      pressKey('Enter');
      assert(clicks === 1, 'Enter did not reach the late rowclick listener');

      // A polling refresh must not scroll the page back to a table that still holds focus.
      scroller.scrollTop = 1500;
      plain.setData(rows(3, 10));
      assert(scroller.scrollTop === 1500, `re-rendering scrolled the container to ${scroller.scrollTop}`);
      assert(plain.el.contains(document.activeElement), 'the re-render lost focus');

      // Ctrl+A takes the rendered rows — what growing holds back stays unselected.
      growing.el.querySelector('tbody tr').focus();
      pressKey('a', { ctrlKey: true });
      assert(growing.getSelection().length === 5,
        `Ctrl+A selected ${growing.getSelection().length} rows with 5 rendered`);
    },
    destroy({ plain, growing, scroller }) {
      plain.destroy();
      growing.destroy();
      scroller.remove();
    }
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

      // Collapsing through the API while a child has focus hands focus to that child's parent,
      // not to whatever row now sits where the child was.
      tree.expandRow('a');
      tree.el.querySelectorAll('tbody tr')[1].focus();
      assert(focused() === 'Alpha one', 'could not focus the child row');
      tree.collapseRow('a');
      assert(focused() === 'Alpha', `collapsing the parent moved focus to ${focused()}`);

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

/** @returns {{create: Function, spec: object|null, destroyed: number}} An engine that records what it was given. */
function recordingChartAdapter() {
  const adapter = {
    spec: null,
    destroyed: 0,
    create(_canvas, spec) {
      adapter.spec = spec;
      return {
        instance: adapter,
        update(next) { adapter.spec = next; },
        resize() {},
        destroy() { adapter.destroyed += 1; }
      };
    }
  };
  return adapter;
}

/** @param {string} name @returns {string} `chartOptions` as `chart-options`. */
function kebabCase(name) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Counts what reaches a host and what passes it, for one event type.
 * @param {HTMLElement} element Host.
 * @param {string} type Plain event name.
 * @returns {{plain: number, zx: number, above: number, leaked: number, detail: unknown, stop: () => void}}
 */
function hostEvents(element, type) {
  const parent = /** @type {HTMLElement} */ (element.parentNode);
  const seen = {
    plain: 0,
    zx: 0,
    above: 0,
    leaked: 0,
    detail: null,
    stop() {
      element.removeEventListener(type, onPlain);
      element.removeEventListener(`zx-${type}`, onBridged);
      parent.removeEventListener(`zx-${type}`, onAbove);
      parent.removeEventListener(type, onLeak);
    }
  };
  function onPlain(event) { seen.plain += 1; seen.detail = event.detail; }
  function onBridged() { seen.zx += 1; }
  function onAbove() { seen.above += 1; }
  function onLeak() { seen.leaked += 1; }
  element.addEventListener(type, onPlain);
  element.addEventListener(`zx-${type}`, onBridged);
  parent.addEventListener(`zx-${type}`, onAbove);
  parent.addEventListener(type, onLeak);
  return seen;
}

/**
 * One entry per kit element. `properties` are set while the element is detached, and `rendered`
 * says they drew. `queue` calls a forwarded method before the component exists, and `queued` says
 * it ran. `change` sets properties and forwards calls on the live element, and `changed` says the
 * result still stands, both then and after the element is removed and put back. `interact` goes
 * through the component the way a person does.
 * @returns {object[]}
 */
function kitElementSpecs() {
  const blocks = [{ type: 'p', text: 'Three are late [1].' }];
  const records = () => [
    { id: 'a', title: 'Alpha', status: 'new' },
    { id: 'b', title: 'Beta', status: 'open' }
  ];
  const fields = () => [{ id: 'title', label: 'Title' }, { id: 'status', label: 'Status' }];
  const answer = () => ({
    id: 'a1', type: 'answer', author: 'finance', blocks,
    sources: [{ id: 'inv', title: 'Invoices · September' }]
  });

  return [
    {
      tag: 'agent-thread',
      component: zx.AgentThread,
      events: ['action', 'approve', 'edit', 'reject', 'cite', 'artifact', 'reveal', 'open'],
      data: ['items', 'authors', 'answerActions'],
      properties: () => ({
        authors: { finance: { name: 'Finance agent' } },
        answerActions: ['copy'],
        items: [{ id: 'ask', type: 'user', text: 'Reconcile September.' }, answer()]
      }),
      rendered: (element) => element.querySelectorAll('article').length >= 2
        && element.querySelector('[data-cite="1"]') !== null,
      queue: (element) => element.upsert({ id: 'queued', type: 'text', text: 'Queued' }),
      queued: (element) => element.get('queued')?.text === 'Queued',
      interact(element) {
        const heard = hostEvents(element, 'cite');
        element.querySelector('[data-cite="1"]').click();
        heard.stop();
        assert(heard.plain === 1 && heard.zx === 1, `a citation reached the host ${heard.plain}/${heard.zx} times`);
        assert(heard.detail.n === 1 && heard.detail.item.id === 'a1', 'the citation lost its detail');
      },
      change(element) {
        assert(element.remove('queued') === element, 'remove(id) did not answer with the element');
        assert(element.get('queued') === null && element.isConnected, 'remove(id) did not remove the item');
        element.items = [answer()];
        assert(element.querySelectorAll('article').length === 1, 'items set after connection did not draw');
        element.appendText('stream', 'Written ');
        element.appendText('stream', 'as it came.');
        element.patch('stream', { streaming: false });
        element.upsert({ id: 'note', type: 'text', text: 'Added' });
        assert(element.getItems().length === 3, 'getItems() missed what was streamed');
        assert(element.getItems()[1].blocks[0].text === 'Written as it came.', 'streamed text was lost');
        assert(element.scrollToEnd() === element, 'a chain left the element');
        assert(element.reveal('item:note') === true, 'reveal() lost its answer');
      },
      changed: (element) => element.querySelector('article[data-id="stream"]')?.textContent.includes('Written as it came.')
        && element.get('note')?.text === 'Added' && element.items.length === 3
    },
    {
      tag: 'composer',
      component: zx.Composer,
      events: ['send', 'stop', 'input', 'attach', 'remove', 'mention', 'command', 'tool', 'historyprevious'],
      data: ['context', 'tools', 'value'],
      properties: () => ({
        value: 'Draft',
        placeholder: 'Ask',
        context: [{ id: 'selection', label: '3 invoices' }],
        tools: [{ id: 'web', label: 'Web search', icon: 'search' }]
      }),
      rendered: (element) => element.querySelector('textarea')?.placeholder === 'Ask'
        && element.querySelector('textarea').value.startsWith('Draft')
        && element.context.length === 1,
      queue: (element) => element.setHint('Queued'),
      queued: (element) => element.component.refs.hint.textContent === 'Queued' && element.getAttribute('hint') === 'Queued',
      interact(element) {
        const input = element.querySelector('textarea');
        const key = () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

        // The textarea's own `input` stops at the component, so the host hears one event per keystroke.
        const typed = hostEvents(element, 'input');
        input.value = 'Draft the reminders';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        typed.stop();
        assert(typed.plain === 1 && typed.detail?.text === 'Draft the reminders', 'the host did not hear one input with its text');
        assert(typed.leaked === 0, 'the textarea\'s input passed through the host');

        // Either copy of a preventable event cancels it.
        for (const name of ['send', 'zx-send']) {
          const hold = (event) => event.preventDefault();
          element.addEventListener(name, hold, { once: true });
          key();
          assert(input.value === 'Draft the reminders', `preventing ${name} did not hold the message back`);
        }
        const sent = hostEvents(element, 'send');
        key();
        sent.stop();
        assert(sent.plain === 1 && sent.detail.text === 'Draft the reminders', 'send did not reach the host');
        assert(input.value === '', 'send did not clear the text');
      },
      change(element) {
        element.value = 'Set from script';
        assert(element.querySelector('textarea').value === 'Set from script', 'value did not reach the text');
        assert(element.setBusy(true) === element && element.hasAttribute('busy') && element.busy === true,
          'setBusy() left the property behind');
        element.setBusy(false);
        element.busy = true;
        assert(element.component.isBusy(), 'busy did not reach the component');
        element.busy = false;
        element.update({ note: 'Updated' });
        assert(element.note === 'Updated' && element.getAttribute('note') === 'Updated', 'update() left the property behind');
        element.setDisabled(true);
        element.hint = 'Later';
        assert(element.querySelector('textarea').disabled, 'a later property undid a forwarded setDisabled()');
        element.setDisabled(false);
        element.addContext({ id: 'second', label: 'Second' });
        element.focus();
        assert(document.activeElement === element.querySelector('textarea'), 'focus() did not reach the text');
      },
      changed: (element) => element.querySelector('textarea').value === 'Set from script'
        && element.component.refs.note.textContent === 'Updated' && element.context.length === 2
    },
    {
      tag: 'block-view',
      component: zx.BlockView,
      events: ['cite', 'artifact', 'end'],
      data: ['blocks', 'sources'],
      properties: () => ({ blocks, sources: [{ id: 'inv', title: 'Invoices · September' }], streaming: true }),
      rendered: (element) => element.querySelector('[data-cite="1"]')?.getAttribute('aria-label') === 'Source 1: Invoices · September',
      queue: (element) => element.appendText(' Queued'),
      queued: (element) => element.textContent.includes('Queued'),
      interact(element) {
        const heard = hostEvents(element, 'cite');
        element.querySelector('[data-cite="1"]').click();
        heard.stop();
        assert(heard.plain === 1 && heard.zx === 1 && heard.detail.n === 1, 'a citation did not reach the host');
      },
      change(element) {
        element.blocks = [{ type: 'p', text: 'Replaced' }];
        assert(element.textContent.includes('Replaced'), 'blocks set after connection did not draw');
        assert(element.append({ type: 'p', text: 'Block appended' }) === element, 'append(block) lost its answer');
        const child = document.createElement('span');
        assert(element.append(child) === undefined && child.parentNode === element, 'append(node) stopped being the DOM\'s');
        child.remove();
        element.appendText(' Streamed');
        const ended = hostEvents(element, 'end');
        element.end();
        ended.stop();
        assert(ended.plain === 1 && element.streaming === false, 'end() did not reach the host');
      },
      changed: (element) => element.textContent.includes('Block appended') && element.textContent.includes('Streamed')
        && element.blocks.length === 2
    },
    {
      tag: 'run-trace',
      component: zx.RunTrace,
      events: ['toggle', 'reveal', 'select', 'open'],
      data: ['steps', 'authors'],
      properties: () => ({
        authors: { finance: { name: 'Finance agent' } },
        steps: [{ id: 'q', kind: 'query', label: 'Queried invoices', status: 'done' }]
      }),
      rendered: (element) => element.querySelector('[data-step="q"]') !== null,
      queue: (element) => element.upsert({ id: 'queued', kind: 'read', label: 'Queued step' }),
      queued: (element) => element.steps.some((step) => step.id === 'queued'),
      interact(element) {
        const heard = hostEvents(element, 'toggle');
        element.querySelector('.zx-run-trace__summary').click();
        heard.stop();
        assert(heard.plain === 1 && heard.zx === 1 && element.open === true, 'the summary did not reach the host');
      },
      change(element) {
        element.steps = [{ id: 'w', kind: 'write', label: 'Wrote', status: 'done' }];
        assert(element.querySelector('[data-step="w"]'), 'steps set after connection did not draw');
        element.upsert({ id: 'x', kind: 'read', label: 'Read', status: 'done' });
        element.setLabel('Plan');
        assert(element.label === 'Plan' && element.getAttribute('label') === 'Plan', 'setLabel() left the property behind');
        element.open = false;
        assert(element.querySelector('.zx-run-trace__steps').hidden, 'open = false did not close the list');
        element.open = true;
      },
      changed: (element) => element.steps.length === 2 && element.open === true
        && element.querySelector('.zx-run-trace__summary').textContent.includes('Plan')
    },
    {
      tag: 'approval-card',
      component: zx.ApprovalCard,
      events: ['approve', 'edit', 'reject'],
      data: ['title', 'details', 'fields', 'values'],
      properties: () => ({
        title: 'Send 3 reminders?',
        details: [{ type: 'p', text: 'Three reminders.' }],
        fields: { subject: { type: 'text', label: 'Subject' } },
        values: { subject: 'Invoice overdue' }
      }),
      rendered: (element) => element.querySelector('h3')?.textContent === 'Send 3 reminders?'
        && element.textContent.includes('Three reminders.') && element.status === 'pending',
      queue: (element) => element.update({ description: 'Queued' }),
      queued: (element) => element.textContent.includes('Queued') && element.description === 'Queued',
      interact(element) {
        const heard = hostEvents(element, 'approve');
        const card = element.component.el;
        card.focus();
        card.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
        heard.stop();
        assert(heard.plain === 1 && heard.detail.values.subject === 'Invoice overdue', 'approve did not reach the host');
        assert(element.status === 'approved', 'status did not follow the card');
      },
      change(element) {
        element.title = 'Send 4 reminders?';
        assert(element.querySelector('h3').textContent === 'Send 4 reminders?', 'title did not reach the card');
        element.values = { subject: 'Changed' };
        assert(element.values.subject === 'Changed', 'values did not reach the card');
      },
      changed: (element) => element.querySelector('h3').textContent === 'Send 4 reminders?'
        && element.status === 'approved' && element.values.subject === 'Changed'
    },
    {
      tag: 'source-list',
      component: zx.SourceList,
      events: ['select'],
      data: ['sources'],
      properties: () => ({ sources: [{ id: 'inv', title: 'Invoices', kind: 'file' }, { id: 'pol', title: 'Policy', kind: 'file' }] }),
      rendered: (element) => element.querySelectorAll('.zx-source-list__source').length === 2,
      queue: (element) => element.highlight(1),
      queued: (element) => element.querySelector('[data-state="highlighted"]') !== null,
      interact(element) {
        const heard = hostEvents(element, 'select');
        element.querySelector('.zx-source-list__source').click();
        heard.stop();
        assert(heard.plain === 1 && heard.detail.n === 1, 'a source did not reach the host');
      },
      change(element) {
        element.sources = [{ id: 'new', title: 'Replaced', kind: 'file' }];
        assert(element.textContent.includes('Replaced'), 'sources set after connection did not draw');
        element.setSources([...element.sources, { id: 'more', title: 'Added', kind: 'file' }]);
      },
      changed: (element) => element.sources.length === 2 && element.textContent.includes('Added')
    },
    {
      tag: 'run-status',
      component: zx.RunStatus,
      events: ['action'],
      data: ['steps', 'tokens', 'cost', 'actions'],
      properties: () => ({
        state: 'waiting',
        summary: 'Step 4 of 6 needs your approval.',
        steps: { done: 3, total: 6 },
        tokens: [18420, 1236],
        cost: { amount: 0.14, budget: 2, currency: 'EUR' },
        actions: [{ label: 'Review the request', kind: 'primary' }]
      }),
      rendered: (element) => element.component.el.dataset.state === 'waiting'
        && element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === '3',
      queue: (element) => element.update({ model: 'Queued model' }),
      queued: (element) => element.textContent.includes('Queued model') && element.getAttribute('model') === 'Queued model',
      interact(element) {
        const heard = hostEvents(element, 'action');
        element.querySelector('[data-run-action="0"]').click();
        heard.stop();
        assert(heard.plain === 1 && heard.detail.index === 0, 'an action did not reach the host');
      },
      change(element) {
        element.state = 'running';
        assert(element.component.el.dataset.state === 'running', 'state did not reach the panel');
        element.steps = { done: 5, total: 6 };
        element.update({ state: 'done', summary: 'Finished.', workMs: 90_000 });
        assert(element.state === 'done' && element.getAttribute('state') === 'done', 'update() left the property behind');
      },
      changed: (element) => element.component.el.dataset.state === 'done'
        && element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === '5'
        && element.workMs === 90_000
    },
    {
      tag: 'card-view',
      component: zx.CardView,
      events: ['recordclick', 'recorddblclick', 'datachange', 'selectionchange', 'sortchange', 'fieldvisibilitychange',
        'fieldorderchange', 'statechange', 'recordaction', 'groupcollapse'],
      data: ['fields', 'data', 'actions'],
      properties: () => ({
        fields: fields(),
        data: records(),
        recordId: 'id',
        titleField: 'title',
        actions: [{ id: 'open', label: 'Open' }]
      }),
      rendered: (element) => element.textContent.includes('Alpha') && element.textContent.includes('Beta'),
      queue: (element) => element.addData([{ id: 'c', title: 'Gamma', status: 'new' }]),
      queued: (element) => element.textContent.includes('Gamma') && element.data.length === 3,
      interact(element) {
        const heard = hostEvents(element, 'recordaction');
        element.querySelector('[data-record-action="open"]').click();
        heard.stop();
        assert(heard.plain === 1 && heard.detail.id === 'a', 'a record action did not reach the host');
      },
      change(element) {
        element.data = [{ id: 'z', title: 'Zeta', status: 'new' }];
        assert(element.textContent.includes('Zeta') && !element.textContent.includes('Alpha'), 'data set after connection did not draw');
        element.hiddenFields = ['status'];
        assert(element.component.getHiddenFields().includes('status'), 'hiddenFields did not reach the view');
        const heard = hostEvents(element, 'datachange');
        element.updateRecord('z', { id: 'z', title: 'Zeta two', status: 'new' });
        heard.stop();
        assert(heard.plain === 1, 'a forwarded call stayed silent');
      },
      changed: (element) => element.textContent.includes('Zeta two') && element.hiddenFields.includes('status')
    },
    {
      tag: 'kanban-view',
      component: zx.KanbanView,
      events: ['recordclick', 'recorddblclick', 'datachange', 'selectionchange', 'sortchange', 'fieldvisibilitychange',
        'fieldorderchange', 'statechange', 'recordaction', 'recordmove', 'movereject', 'recordadd', 'searchchange',
        'historychange'],
      data: ['fields', 'data', 'columns', 'labels'],
      properties: () => ({
        fields: fields(),
        data: records(),
        recordId: 'id',
        titleField: 'title',
        labels: { board: 'Pipeline' },
        columns: [{ id: 'new', label: 'New' }, { id: 'open', label: 'Open' }]
      }),
      rendered: (element) => element.textContent.includes('Alpha') && element.component.getColumns().length === 2
        && element.labels.board === 'Pipeline',
      queue: (element) => element.addData([{ id: 'c', title: 'Gamma', status: 'new' }]),
      queued: (element) => element.textContent.includes('Gamma') && element.data.length === 3,
      interact(element) {
        const heard = hostEvents(element, 'recordmove');
        assert(element.moveRecord('a', { column: 'open' }) === element, 'moveRecord() left the element');
        heard.stop();
        assert(heard.plain === 1 && element.data.find((record) => record.id === 'a').status === 'open',
          'a move did not reach the host');
      },
      change(element) {
        element.setColumns([{ id: 'new', label: 'New' }, { id: 'open', label: 'Open' }, { id: 'won', label: 'Won' }]);
        assert(element.columns.length === 3 && element.component.getColumns().length === 3, 'setColumns() left the property behind');
        element.data = [{ id: 'z', title: 'Zeta', status: 'won' }];
        assert(element.textContent.includes('Zeta') && !element.textContent.includes('Alpha'), 'data set after connection did not draw');
        element.search = 'zeta';
        assert(element.component.getSearch() === 'zeta', 'search did not reach the board');
        element.search = '';
      },
      changed: (element) => element.textContent.includes('Zeta') && element.component.getColumns().length === 3
    },
    {
      tag: 'tree',
      component: zx.TreeView,
      events: ['select', 'expand', 'collapse', 'activate', 'check', 'error'],
      data: ['items', 'expanded', 'selected'],
      properties: () => ({
        items: [{ ID: 1, name: 'One', children: [{ ID: 2, name: 'Two' }] }, { ID: 3, name: 'Three' }],
        label: 'Folders'
      }),
      rendered: (element) => element.querySelector('[role="tree"]')?.getAttribute('aria-label') === 'Folders'
        && element.textContent.includes('One'),
      queue: (element) => element.expandAll(),
      queued: (element) => element.textContent.includes('Two'),
      interact(element) {
        const heard = hostEvents(element, 'select');
        element.querySelector('.zx-tree__row').click();
        heard.stop();
        assert(heard.plain === 1 && heard.detail.id === 1, 'a row did not reach the host');
        assert(element.selected.includes(1), 'selected did not follow the tree');
      },
      change(element) {
        element.items = [{ ID: 7, name: 'Seven' }, { ID: 8, name: 'Eight' }];
        assert(element.textContent.includes('Seven'), 'items set after connection did not draw');
        element.select(8);
        element.setFilter('e');
        assert(element.filter === 'e' && element.getAttribute('filter') === 'e', 'setFilter() left the property behind');
      },
      changed: (element) => element.textContent.includes('Seven') && element.selected.includes(8) && element.filter === 'e'
    },
    {
      tag: 'chart',
      component: zx.Chart,
      events: ['ready', 'update', 'select', 'error'],
      data: ['data', 'chartOptions'],
      properties: () => ({
        adapter: recordingChartAdapter(),
        data: { labels: ['Jan'], datasets: [{ label: 'Revenue', data: [42] }] },
        chartOptions: { indexAxis: 'y' }
      }),
      watch: (element) => hostEvents(element, 'ready'),
      watched: (ready) => assert(ready.plain === 1, 'ready fired during construction and was lost'),
      rendered: (element) => element.adapter.spec?.data.labels[0] === 'Jan' && element.adapter.spec.options.indexAxis === 'y',
      queue: (element) => element.setType('line'),
      queued: (element) => element.adapter.spec.type === 'line' && element.type === 'line',
      interact(element) {
        const heard = hostEvents(element, 'select');
        element.adapter.spec.onSelect({ datasetIndex: 0, index: 0, value: 42 });
        heard.stop();
        assert(heard.plain === 1 && heard.detail.value === 42, 'a point did not reach the host');
      },
      change(element) {
        element.data = { labels: ['Feb'], datasets: [{ label: 'Revenue', data: [84] }] };
        assert(element.adapter.spec.data.labels[0] === 'Feb', 'data set after connection did not reach the engine');
        // New data ends a load by itself, and the next component must not start out loading.
        element.loading = true;
        assert(element.component.el.dataset.state === 'loading', 'loading did not reach the chart');
        element.setData({ labels: ['Mar'], datasets: [{ label: 'Revenue', data: [21] }] });
        assert(element.loading === false, 'loading outlived the data it was waiting for');
        element.update({ indexAxis: 'x' });
      },
      changed: (element) => element.adapter.spec.data.labels[0] === 'Mar' && element.adapter.spec.options.indexAxis === 'x'
        && element.type === 'line' && element.component.el.dataset.state === 'ready'
    }
  ];
}

/**
 * The contract every kit element keeps, driven from its entry in `kitElementSpecs()`.
 * @param {object} spec Element entry.
 * @returns {SmokeDefinition}
 */
function kitElementCase(spec) {
  return {
    name: `defineElements() (zx-${spec.tag})`,
    create(fixture) {
      const element = document.createElement(`zx-smoke-${spec.tag}`);
      assert(element.component === null, 'a detached element has a component');
      Object.assign(element, spec.properties());
      assert(spec.queue(element) === undefined, 'a queued call answered as if it had run');
      fixture.append(element);
      assert(element.component instanceof spec.component, 'backing component missing');
      assert(spec.rendered(element), 'did not render from properties set before connection');
      assert(spec.queued(element), 'a forwarded call made before connection did not run after it');
      return { element, fixture };
    },
    async exercise({ element, fixture }) {
      assertNoDataAttributes(element, spec);

      for (const type of spec.events) {
        const heard = hostEvents(element, type);
        element.component.emit(type, { probe: type });
        heard.stop();
        assert(heard.plain === 1 && heard.detail?.probe === type, `${type} did not reach the host by its plain name`);
        assert(heard.zx === 1 && heard.above === 1, `zx-${type} stopped bubbling`);
        assert(heard.leaked === 0, `the plain ${type} left the host`);
      }

      spec.interact(element);
      spec.change(element);
      assert(spec.changed(element), 'changes on the live element did not stand');
      assertNoDataAttributes(element, spec);

      for (let round = 1; round <= 2; round += 1) {
        const root = element.component.el;
        element.remove();
        assert(element.component === null && zx.Component.from(root) === null, 'removal did not destroy the component');
        assert(element.childNodes.length === 0, 'removal left nodes in the element');
        assert(fixture.childNodes.length === 0, 'removal left nodes in the document');
        fixture.append(element);
        assert(element.component instanceof spec.component, `re-inserting (${round}) did not rebuild the component`);
        assert(spec.changed(element), `re-inserting (${round}) lost the current properties`);
      }
    },
    destroy({ element }) {
      const root = element.component?.el ?? null;
      element.remove();
      assert(element.component === null, 'removal did not destroy the component');
      if (root) assert(zx.Component.from(root) === null, 'removal did not unregister the component');
    }
  };
}

/**
 * @param {HTMLElement} element
 * @param {object} spec
 * @param {string[]} [properties=spec.data] Properties to check.
 * @returns {void}
 */
function assertNoDataAttributes(element, spec, properties = spec.data) {
  for (const property of properties) {
    assert(!element.hasAttribute(kebabCase(property)), `${property} was serialized into an attribute`);
  }
}

/**
 * Properties a framework assigned before `defineElements()` ran, on elements in the document and
 * on elements still detached when the definitions arrive. A chart mounts its engine while it is
 * being constructed, so its `ready` also proves an event fired that early reaches the host.
 * @returns {SmokeDefinition}
 */
function kitElementsBeforeUpgradeCase() {
  let runs = 0;
  return {
    name: 'defineElements() (before upgrade)',
    create(fixture) {
      runs += 1;
      const prefix = `zx-late${runs}`;
      const build = (spec) => {
        const element = document.createElement(`${prefix}-${spec.tag}`);
        const properties = spec.properties();
        Object.assign(element, properties);
        return { spec, element, properties };
      };
      const specs = kitElementSpecs();
      const connected = specs.map(build);
      const detached = specs.map(build);
      for (const { element } of connected) fixture.append(element);
      const ready = connected.flatMap(({ spec, element }) => (spec.watch ? [[spec, spec.watch(element)]] : []));
      zx.defineElements(prefix);
      for (const { element } of detached) fixture.append(element);
      return { entries: [...connected, ...detached], ready };
    },
    exercise({ entries, ready }) {
      for (const { spec, element, properties } of entries) {
        assert(element.component instanceof spec.component, `${spec.tag} did not upgrade`);
        assert(spec.rendered(element), `${spec.tag} did not render from properties set before upgrade`);
        // Before upgrade `title` is the browser's own property, and the browser writes the attribute.
        assertNoDataAttributes(element, spec, spec.data.filter((name) => !(name in HTMLElement.prototype)));
        for (const name of Object.keys(properties)) {
          assert(!Object.hasOwn(element, name), `${spec.tag} kept ${name} as a plain property`);
        }
      }
      for (const [spec, seen] of ready) {
        seen.stop();
        spec.watched(seen);
      }
    },
    destroy({ entries }) {
      for (const { element } of entries) element.remove();
    }
  };
}

/** Static markup: attributes with the options' names, JSON for data, and `="false"` for what is on by default. @returns {SmokeDefinition} */
function kitElementsMarkupCase() {
  return {
    name: 'defineElements() (static markup)',
    create(fixture) {
      const template = document.createElement('template');
      template.innerHTML = `
        <zx-smoke-source-list label="Evidence" layout="list" numbered="false"
          sources='[{"id":"a","title":"One","kind":"file"}]'></zx-smoke-source-list>
        <zx-smoke-run-status state="running" summary="Working" compact="icon" ticking="false"></zx-smoke-run-status>
        <zx-smoke-tree selection="multi" items='[{"ID":1,"name":"One"}]' height="120"></zx-smoke-tree>
        <zx-smoke-agent-thread label="Support" heading-level="4"
          items='[{"id":"a","type":"user","text":"Hello"}]'></zx-smoke-agent-thread>
        <zx-smoke-composer placeholder="Ask" submit-key="mod+enter" busy></zx-smoke-composer>
        <zx-smoke-card-view record-id="id" title-field="title" selectable="multi" variant="raised"
          field-controls="false" data='[{"id":"a","title":"One"}]'
          fields='[{"id":"title","label":"Title"}]'></zx-smoke-card-view>`;
      fixture.append(template.content);
      return { fixture };
    },
    exercise({ fixture }) {
      const pick = (name) => fixture.querySelector(`zx-smoke-${name}`);
      const sources = pick('source-list');
      assert(sources.numbered === false && sources.component.el.dataset.layout === 'list', 'the source list ignored its attributes');
      assert(sources.textContent.includes('Evidence') && sources.textContent.includes('One'), 'the source list did not render');
      assert(pick('run-status').component.el.dataset.state === 'running', 'the status ignored its attributes');
      assert(pick('run-status').component.options.ticking === false, 'ticking="false" stayed on');
      assert(pick('tree').querySelector('[aria-multiselectable="true"]'), 'the tree ignored selection="multi"');
      const thread = pick('agent-thread');
      assert(thread.querySelector('[role="feed"]').getAttribute('aria-label') === 'Support', 'the thread ignored its label');
      assert(thread.items.length === 1, 'the thread did not read its JSON attribute');
      const composer = pick('composer');
      assert(composer.busy === true && composer.querySelector('textarea').placeholder === 'Ask', 'the composer ignored its attributes');
      const view = pick('card-view');
      assert(view.textContent.includes('One') && view.selectable === 'multi' && view.component.getFieldControls() === null,
        'the card view ignored its attributes');

      // Setting an attribute later is the same route; setting the property leaves the attribute alone.
      composer.setAttribute('hint', 'From an attribute');
      assert(composer.component.refs.hint.textContent === 'From an attribute', 'a later attribute did not apply');
      const before = thread.getAttribute('items');
      thread.items = [{ id: 'b', type: 'user', text: 'Later' }];
      assert(thread.getAttribute('items') === before, 'a property was written over the attribute');
      thread.setAttribute('items', '[{"id":"c","type":"user","text":"Attribute"}]');
      assert(thread.items[0].id === 'c', 'a changed attribute did not replace the property');
      // A rebuild takes the live items along.
      thread.upsert({ id: 'd', type: 'user', text: 'Streamed' });
      thread.setAttribute('label', 'Renamed');
      assert(thread.querySelector('[role="feed"]').getAttribute('aria-label') === 'Renamed', 'a rebuild option did not rebuild');
      assert(thread.items.length === 2, 'a rebuild lost what was streamed');
    },
    destroy({ fixture }) {
      fixture.replaceChildren();
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

/**
 * The shared presence loop: kept on the document and gone with its last avatar, still inside a
 * reduced-motion region, and asleep while the page is hidden. @returns {SmokeDefinition}
 */
function presenceLoopCase() {
  return {
    name: 'Avatar (presence loop)',
    create(fixture) {
      const symbols = Object.getOwnPropertySymbols(document).length;
      const region = document.createElement('div');
      region.dataset.zxMotion = 'reduced';
      fixture.append(region);
      const still = new zx.Avatar(null, { name: 'Ledger agent', label: 'Ledger agent', activity: 'working', animate: true });
      const moving = new zx.Avatar(null, { name: 'Mail agent', label: 'Mail agent', activity: 'needs-you', animate: true });
      region.append(still.toElement());
      // The loop moves only avatars on screen, and the fixtures sit off screen: this one gets an
      // invisible stage inside the viewport.
      const stage = document.createElement('div');
      stage.style.cssText = 'position: fixed; inset-block-start: 0; inset-inline-start: 0; opacity: 0; pointer-events: none;';
      stage.className = 'zx-scope';
      document.body.append(stage);
      stage.append(moving.toElement());
      return { symbols, region, still, moving, stage };
    },
    async exercise({ symbols, still, moving }) {
      assert(Object.getOwnPropertySymbols(document).length === symbols + 1, 'the presence loop is not kept on the document');
      await delay(400);
      assert(still.el.style.transform === '', 'an avatar inside data-zx-motion="reduced" moved');
      // A backgrounded run, or a machine asking for reduced motion, never starts the loop at all.
      if (document.hidden || zx.prefersReducedMotion(moving.el)) return;
      assert(moving.el.style.transform !== '', 'an animated avatar on screen did not move');

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      const frozen = moving.el.style.transform;
      await delay(200);
      const asleep = moving.el.style.transform === frozen;
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
      assert(asleep, 'the presence loop ran on while the page was hidden');

      moving.el.dataset.zxMotion = 'reduced';
      await delay(50);
      assert(moving.el.style.transform === '', 'reduced motion did not put the avatar back at rest');
      delete moving.el.dataset.zxMotion;
      await delay(100);
      assert(moving.el.style.transform !== '', 'the avatar did not move again when motion returned');
    },
    destroy({ symbols, region, still, moving, stage }) {
      still.destroy();
      moving.destroy();
      region.remove();
      stage.remove();
      assert(Object.getOwnPropertySymbols(document).length === symbols, 'the presence loop outlived its last avatar');
    }
  };
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

/**
 * Row actions on a tree: revealed strips named after their rows, the focused row's actions as its
 * Tab stops, the overflow and the context menu running the action, keys on an action left to it,
 * and menus rebuilt with the rows.
 * @returns {SmokeDefinition}
 */
function treeRowActionsCase() {
  return {
    name: 'TreeView (row actions)',
    create(fixture) {
      const runs = [];
      const record = (name) => (node) => runs.push(`${name}:${node.name}`);
      const component = new zx.TreeView(null, {
        items: [{ ID: 1, name: 'Handbook', children: [{ ID: 2, name: 'Onboarding' }, { ID: 3, name: 'Leave' }] }],
        expanded: [1],
        selected: [2],
        icons: false,
        rowActions: (node) => (node.ID === 3
          ? [{ icon: 'plus', label: 'Add sub-page', onSelect: record('add') }]
          : [
            { icon: 'plus', label: 'Add sub-page', onSelect: record('add') },
            { icon: 'copy', label: 'Rename', onSelect: record('rename') },
            { icon: 'trash', label: 'Delete', danger: true, onSelect: record('delete') }
          ])
      });
      fixture.append(component.toElement());
      return { component, runs };
    },
    async exercise({ component, runs }) {
      const rows = () => [...component.el.querySelectorAll('.zx-tree__row')];
      const strip = (row) => row.querySelector(':scope > .zx-tree__actions');
      const [handbook, onboarding, leave] = rows();
      let selects = 0;
      component.el.addEventListener('zx-select', () => { selects += 1; });

      // Revealed, named after the row, and the row keeps its own name.
      assert(handbook.hasAttribute('data-zx-reveal-host') && strip(handbook)?.hasAttribute('data-zx-reveal'), 'reveal attributes missing');
      const controls = [...strip(handbook).children];
      assert(controls.length === 2, `three actions should show two controls, got ${controls.length}`);
      assert(controls[0].getAttribute('aria-label') === 'Add sub-page: Handbook', 'inline action is not named after its row');
      assert(controls[1].getAttribute('aria-label') === 'More actions: Handbook' && controls[1].getAttribute('aria-haspopup') === 'menu',
        'overflow trigger is not a named menu button');
      assert(strip(leave).children.length === 1, 'a single action should show alone');
      const nameIds = handbook.getAttribute('aria-labelledby')?.split(' ') ?? [];
      assert(nameIds.length === 1 && document.getElementById(nameIds[0])?.textContent === 'Handbook', 'row name includes its actions');

      // The focused row lends its tab stop to its actions; every other strip is out of the order.
      assert(onboarding.tabIndex === 0, 'the selected row should hold the tab stop');
      assert([...strip(onboarding).querySelectorAll('button')].every((button) => button.tabIndex === 0), 'focused row actions are not Tab stops');
      assert([...strip(handbook).querySelectorAll('button')].every((button) => button.tabIndex === -1), 'other rows\u2019 actions are Tab stops');

      // An inline action runs for its row and neither selects nor focuses it.
      strip(leave).querySelector('button').click();
      assert(runs.at(-1) === 'add:Leave', `inline action did not run: ${runs.join()}`);
      assert(component.getSelection().join() === '2' && selects === 0, 'an action click changed the selection');

      // Keys pressed on an action belong to it.
      const onboardingAdd = strip(onboarding).querySelector('button');
      onboardingAdd.focus();
      const arrow = pressKey('ArrowDown');
      assert(!arrow.defaultPrevented && document.activeElement === onboardingAdd, 'the tree moved on a key pressed on an action');

      // Focus arriving on another row's action makes that row the tab stop, without moving focus.
      const handbookAdd = strip(handbook).querySelector('button');
      handbookAdd.focus();
      assert(handbook.tabIndex === 0 && onboarding.tabIndex === -1, 'the tab stop did not follow the focused action');
      assert(handbookAdd.tabIndex === 0 && onboardingAdd.tabIndex === -1, 'the action stops did not follow the focused row');
      assert(document.activeElement === handbookAdd, 'focus moved off the action');

      // The overflow runs a folded action, and its events stay inside the row.
      const more = strip(handbook).querySelector('.zx-tree__more');
      more.click();
      const panel = document.getElementById(more.getAttribute('aria-controls'));
      const items = [...panel.querySelectorAll('[role="menuitem"]')];
      assert(items.map((item) => item.textContent.trim()).join() === 'Rename,Delete', 'overflow should list the folded actions');
      items[0].click();
      assert(runs.at(-1) === 'rename:Handbook' && selects === 0, 'overflow selection did not run, or leaked a select event');

      // The context menu lists every descriptor and returns focus to the row before running it.
      component.focusNode(2);
      const row = rows()[1];
      assert(document.activeElement === row, 'focusNode did not focus the row');
      pressKey('F10', { shiftKey: true });
      const menu = [...document.querySelectorAll('.zx-context-menu')].find((element) => element.dataset.state === 'open');
      assert(menu, 'Shift+F10 did not open the row menu');
      const entries = [...menu.querySelectorAll('[role="menuitem"]')];
      assert(entries.length === 3, `row menu should list three actions, got ${entries.length}`);
      entries[2].click();
      assert(runs.at(-1) === 'delete:Onboarding', `row menu did not run the action: ${runs.join()}`);
      assert(document.activeElement === row, 'focus did not return to the row');

      // Menus are rebuilt with the rows: collapsing drops the children's strips and their panels.
      const panels = document.querySelectorAll('.zx-menu-button__menu').length;
      component.collapse(1);
      await component.expand(1);
      assert(document.querySelectorAll('.zx-menu-button__menu').length === panels, 'row menus leaked across a re-render');
    },
    destroy: ({ component }) => component.destroy()
  };
}

/**
 * Actions on AppSidebar destinations: a reveal line only where there are actions, names, focus-led
 * Tab stops, the row menu, and arrow navigation unchanged.
 * @returns {SmokeDefinition}
 */
function appSidebarRowActionsCase() {
  return {
    name: 'AppSidebar (row actions)',
    create(fixture) {
      const runs = [];
      const record = (name) => (item) => runs.push(`${name}:${item.label}`);
      const actions = [
        { icon: 'check', label: 'Mark all as read', onSelect: record('read') },
        { icon: 'copy', label: 'Rename', onSelect: record('rename') },
        { icon: 'trash', label: 'Delete label', danger: true, onSelect: record('delete') }
      ];
      const component = new zx.AppSidebar(null, {
        collapsible: false,
        items: [
          { id: 'customers', label: 'Customers', href: '#customers', actions },
          { id: 'finance', label: 'Finance', href: '#finance', actions: actions.slice(0, 1) },
          { id: 'plain', label: 'Plain', href: '#plain' }
        ],
        active: 'customers'
      });
      fixture.append(component.toElement());
      return { component, runs };
    },
    exercise({ component, runs }) {
      const control = (id) => component.el.querySelector(`[data-app-nav-id="${id}"]`);
      const strip = (id) => control(id).parentElement.querySelector(':scope > .zx-app-sidebar__actions');
      let selects = 0;
      component.on('select', () => { selects += 1; });

      assert(control('customers').parentElement.matches('.zx-app-sidebar__line[data-zx-reveal-host]'), 'no reveal line around a row with actions');
      assert(control('plain').parentElement.matches('.zx-app-sidebar__row'), 'a row without actions changed its markup');
      assert(strip('customers').children.length === 2, 'three actions should show two controls');
      assert(strip('finance').querySelector('button').getAttribute('aria-label') === 'Mark all as read: Finance', 'action not named after its row');
      assert([...component.el.querySelectorAll('.zx-app-sidebar__actions button')].every((button) => button.tabIndex === -1),
        'actions are Tab stops before any row has focus');

      control('customers').focus();
      assert([...strip('customers').querySelectorAll('button')].every((button) => button.tabIndex === 0), 'focused row actions are not Tab stops');
      assert(strip('finance').querySelector('button').tabIndex === -1, 'another row\u2019s actions are Tab stops');

      pressKey('ArrowDown');
      assert(document.activeElement === control('finance'), 'arrow navigation broke on an action line');
      strip('finance').querySelector('button').click();
      assert(runs.at(-1) === 'read:Finance' && selects === 0, 'inline action did not run, or selected the row');

      control('customers').focus();
      pressKey('F10', { shiftKey: true });
      const menu = [...document.querySelectorAll('.zx-context-menu')].find((element) => element.dataset.state === 'open');
      assert(menu?.querySelectorAll('[role="menuitem"]').length === 3, 'row menu should list three actions');
      menu.querySelectorAll('[role="menuitem"]')[1].click();
      assert(runs.at(-1) === 'rename:Customers', 'row menu did not run the action');
      assert(document.activeElement === control('customers'), 'focus did not return to the destination');

      component.setItems([{ id: 'plain', label: 'Plain', href: '#plain' }]);
      assert(!component.el.querySelector('.zx-app-sidebar__line'), 'a stale action line survived setItems');
    },
    destroy: ({ component }) => component.destroy()
  };
}

/**
 * Section links: only headings with ids, named after the heading, copying without navigating, and
 * a refresh that follows re-rendered content.
 * @returns {SmokeDefinition}
 */
function proseAnchorsCase() {
  return {
    name: 'proseAnchors()',
    create(fixture) {
      const copies = [];
      const article = zx.h('article', { class: 'zx-prose' },
        zx.h('h1', { id: 'top' }, 'Runbook'),
        zx.h('h2', { id: 'freeze' }, 'Freeze posting'),
        zx.h('h3', {}, 'No id'),
        zx.h('h4', { id: 'sign-off' }, 'Sign-off'));
      fixture.append(article);
      const anchors = zx.proseAnchors(article, {
        href: (id) => `https://example.test/runbook#${id}`,
        oncopy: (url) => copies.push(url)
      });
      return { article, anchors, copies };
    },
    async exercise({ article, anchors, copies }) {
      const links = () => [...article.querySelectorAll('.zx-prose__anchor')];
      assert(links().length === 2, `expected links on h2 and h4 only, got ${links().length}`);
      const [freeze] = links();
      assert(freeze.getAttribute('href') === '#freeze' && freeze.getAttribute('aria-label') === 'Copy link to Freeze posting',
        'link href or name mismatch');
      assert(freeze.parentElement.hasAttribute('data-zx-reveal-host') && freeze.hasAttribute('data-zx-reveal'), 'reveal attributes missing');

      const hash = location.hash;
      freeze.click();
      for (let wait = 0; wait < 40 && copies.length === 0; wait += 1) await new Promise((resolve) => setTimeout(resolve, 25));
      assert(copies[0] === 'https://example.test/runbook#freeze', `copy did not run: ${copies.join()}`);
      assert(location.hash === hash, 'a section link changed the location');

      article.replaceChildren(zx.h('h2', { id: 'reconcile' }, 'Reconcile'));
      anchors.refresh();
      assert(links().length === 1 && links()[0].getAttribute('href') === '#reconcile', 'refresh did not follow new content');
      assert(article.querySelector('.zx-prose__status[role="status"]'), 'refresh did not restore the live region');
    },
    destroy({ article, anchors }) {
      anchors.destroy();
      assert(!article.querySelector('.zx-prose__anchor, .zx-prose__status, [data-zx-reveal-host]'), 'destroy left anchors behind');
      article.remove();
    }
  };
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

/**
 * zeyosForm's success toast belongs to the theme scope, not to the dialog the form sat in: an
 * `onSaved` that destroys the dialog must not leave the toast on an unstyled <body>.
 * @returns {SmokeDefinition}
 */
function zeyosFormToastScopeCase() {
  return {
    name: 'Dialog (zeyosForm toast after onSaved closes it)',
    create(fixture) {
      const scope = document.createElement('div');
      scope.className = 'zx-scope';
      scope.dataset.zxTheme = 'dark';
      fixture.append(scope);
      const client = {
        schema: {
          describe: () => ({ fields: { ID: { type: 'integer' }, name: { type: 'text' } } }),
          fields: () => ['ID', 'name'],
          operations: () => ['createTickets']
        },
        api: { createTickets: async (record) => ({ ID: 7, ...record }) }
      };
      const anchor = document.createElement('span');
      scope.append(anchor);
      const dialog = new zx.Dialog(null, { title: 'New ticket', scope: anchor });
      return { scope, client, dialog };
    },
    async exercise(state) {
      const { scope, client, dialog } = state;
      dialog.open();
      await nextFrame();
      assert(scope.contains(dialog.el), 'the dialog did not open in the theme scope it was given');
      const binding = zeyos.zeyosForm(client, 'tickets', {
        fields: ['name'], value: { name: 'Printer jam' },
        onSaved: () => { dialog.destroy(); state.dialog = null; }
      });
      dialog.setContent(binding.form.toElement());
      await binding.ready;
      await binding.save();
      await nextFrame();
      const region = [...document.querySelectorAll('.zx-message-region')]
        .find((candidate) => candidate.textContent.includes('saved successfully'));
      assert(region, 'no saved toast was shown');
      assert(scope.contains(region), 'the saved toast left the theme scope once its dialog was destroyed');
      binding.destroy();
      zx.Message.disposeRegion(region);
    },
    destroy({ scope, dialog }) {
      dialog?.destroy();
      scope.remove();
    }
  };
}

/**
 * A roving group notices an inherited disabled state: toggling a `<fieldset disabled>` around the
 * current tab stop hands the stop to a control that can still take focus.
 * @returns {SmokeDefinition}
 */
function toolbarFieldsetDisabledCase() {
  return {
    name: 'Toolbar (fieldset disabled)',
    create(fixture) {
      const group = document.createElement('fieldset');
      group.setAttribute('role', 'group');
      const first = zx.button({ label: 'Bold' });
      group.append(first);
      const component = new zx.Toolbar(null, { items: [group, { name: 'save', label: 'Save' }] });
      fixture.append(component.toElement());
      return { component, group, first };
    },
    async exercise({ component, group, first }) {
      await nextFrame();
      const save = component.getItem('save');
      assert(first.tabIndex === 0 && save.tabIndex === -1, 'the first control is not the initial tab stop');
      group.disabled = true;
      await Promise.resolve();
      assert(save.tabIndex === 0, 'the tab stop stayed on a control its fieldset disabled');
      group.disabled = false;
      await Promise.resolve();
      first.focus();
      assert(first.tabIndex === 0, 'the re-enabled control could not take the tab stop back');
    },
    destroy: ({ component }) => component.destroy()
  };
}

/* ------------------------------------------------------------------ surfaces -- */

/** A surface document with an `ask` form, overridable member by member. */
function surfaceDocument(overrides = {}) {
  return {
    zx: 'surface/1', surface: 's1', intent: 'ask', title: 'Who should get the reminder?', author: 'finance',
    root: ['why', 'form'],
    nodes: [
      { id: 'why', type: 'text', text: 'One invoice is **late**.' },
      { id: 'form', type: 'fields', schema: { type: 'object', required: ['name'], properties: { name: { type: 'string', title: 'Name' } } } }
    ],
    ...overrides
  };
}

/** Counts a surface's replies, through the component and through the bubbling DOM event. */
function countReplies(surface) {
  const replies = [];
  let dom = 0;
  surface.on('reply', (event) => replies.push(event.detail.reply));
  surface.el.addEventListener('zx-reply', () => { dom += 1; });
  return { replies, get dom() { return dom; } };
}

/** Writes a value into a schema field the way a person's edit lands: through its Field. */
function setSurfaceField(root, name, value) {
  const element = root.querySelector(`[data-field-id="${name}"]`);
  const field = element ? zx.Component.from(element) : null;
  assert(field, `no field "${name}"`);
  field.setValue(value);
  const input = field.getInput?.();
  input?.dispatchEvent(new Event('input', { bubbles: true }));
}

function surfaceButton(root, id) {
  return root.querySelector(`button[data-surface-action="${id}"]`);
}

/** A case whose create/destroy is a component of its own, with the exercise given. */
function surfaceCase(name, create, exercise) {
  return {
    name,
    create(fixture) {
      const state = create(fixture);
      if (state.component) fixture.append(state.component.toElement());
      return state;
    },
    exercise: (state) => exercise(state),
    destroy: (state) => {
      state.component?.destroy();
      state.cleanup?.();
    }
  };
}

/** @returns {Array<object>} */
function surfaceCases() {
  return [
    componentCase('Surface', () => new zx.Surface(null, { token: 'opaque-1', headingLevel: 2, authors: { finance: { name: 'Finance agent' } } }), async (component) => {
      const root = component.toElement();
      const log = countReplies(component);
      let ready = 0;
      let ended = 0;
      component.on('ready', () => { ready += 1; });
      component.on('end', () => { ended += 1; });
      // Streamed line by line: the begin names two children that have not arrived.
      component.write('{"zx":"surface/1","op":"begin","surface":"s1","intent":"ask","title":"Who?","author":"finance","root":["why","form"]}\n');
      assert(ready === 1, 'ready did not fire at the first renderable state');
      const frame = root.querySelector('.zx-surface__frame');
      assert(frame?.localName === 'form', 'an ask surface is not a form');
      const title = root.querySelector('h2.zx-surface__title');
      assert(title && frame.getAttribute('aria-labelledby') === title.id, 'the form is not labelled by its title at headingLevel');
      assert(root.querySelector('.zx-surface__byline')?.textContent === 'Composed by Finance agent', 'byline missing');
      assert(root.querySelectorAll('.zx-surface__placeholder').length === 2, 'missing children are not skeleton lines');
      component.write('{"op":"node","surface":"s1","id":"why","type":"text","text":"Late."}\n{"op":"node","surface":"s1","id":"form","type":"fields",');
      component.write('"schema":{"type":"object","required":["name"],"properties":{"name":{"type":"string","title":"Name"}}}}\n');
      assert(root.querySelectorAll('.zx-surface__placeholder').length === 0, 'arrived nodes are still placeholders');
      assert(surfaceButton(root, 'submit').disabled, 'Submit was enabled before end');
      assert(!surfaceButton(root, 'cancel').disabled, 'Cancel was disabled before end');
      assert(frame.getAttribute('aria-busy') === 'true', 'a streaming surface is not busy');
      component.write('{"op":"end","surface":"s1"}\n');
      assert(ended === 1 && !surfaceButton(root, 'submit').disabled, 'end did not enable Submit');
      // A failed submit focuses the first invalid field and does not reply.
      surfaceButton(root, 'submit').click();
      frame.requestSubmit(surfaceButton(root, 'submit'));
      assert(log.replies.length === 0, 'an invalid form replied');
      assert(root.querySelector('[data-field-id="name"]').contains(document.activeElement), 'focus did not move to the invalid field');
      setSurfaceField(root, 'name', 'Mara');
      const submit = surfaceButton(root, 'submit');
      frame.requestSubmit(submit);
      submit.click();
      assert(log.replies.length === 1 && log.dom === 1, `expected one reply, got ${log.replies.length}`);
      const reply = log.replies[0];
      assert(reply.zx === 'reply/1' && reply.action === 'submit' && reply.key === 's1#submit', 'reply shape');
      assert(reply.values.name === 'Mara' && reply.token === 'opaque-1' && reply.confirmation === null, 'reply values or token');
      assert(root.dataset.state === 'answered', 'the surface did not freeze into its receipt');
      assert(root.querySelector('.zx-surface__verdict') && !root.querySelector('.zx-surface__actions'), 'actions did not give way to the verdict');
      assert(root.querySelector('.zx-surface__answers')?.textContent.includes('Mara'), 'the receipt does not show the answer');
      component.cancel();
      component.supersede();
      assert(log.replies.length === 1, 'a second reply followed the first');
      // Enhancing a target restores it.
      const target = document.createElement('div');
      target.className = 'host';
      target.append('original');
      const before = target.outerHTML;
      fixtures.append(target);
      const enhanced = new zx.Surface(target, { document: surfaceDocument() });
      enhanced.destroy();
      assert(target.outerHTML === before, 'Surface did not restore its target');
      target.remove();
    }),
    surfaceCase('Surface (one reply each way)', () => ({}), async () => {
      const ways = [
        ['submit', (s) => { setSurfaceField(s.el, 'name', 'A'); surfaceButton(s.el, 'submit').click(); }, 'submit'],
        // An own action that is not primary replies without checking the (empty, required) inputs.
        ['action', (s) => surfaceButton(s.el, 'later').click(), 'later', { actions: [{ id: 'send', label: 'Send', kind: 'primary' }, { id: 'later', label: 'Not now' }] }],
        ['cancel', (s) => surfaceButton(s.el, 'cancel').click(), 'cancel'],
        ['Escape', (s) => s.el.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })), 'cancel'],
        ['supersede', (s) => s.supersede(), 'dismiss'],
        ['destroy', (s) => s.destroy(), 'dismiss']
      ];
      for (const [way, act, action, extra] of ways) {
        const surface = new zx.Surface(null, { document: surfaceDocument(extra ?? {}), token: 'tok' });
        fixtures.append(surface.toElement());
        const log = countReplies(surface);
        act(surface);
        await delay(5);
        try { act(surface); } catch { /* The controls are gone once it replied. */ }
        await delay(5);
        surface.destroy();
        assert(log.replies.length === 1, `${way}: ${log.replies.length} replies`);
        assert(log.replies[0].action === action, `${way}: replied ${log.replies[0].action}`);
        assert(log.replies[0].token === 'tok', `${way}: the token did not come back unchanged`);
        if (way === 'action') assert(Object.keys(log.replies[0].values).length === 0, 'a non-primary own action sent values');
      }
      // A surface that never began still replies once, with the id it was given when valid.
      for (const [given, id] of [[{ zx: 'surface/9', surface: 'bad' }, 'bad'], [{ surface: 5 }, null], ['nope', null]]) {
        const broken = new zx.Surface(null, { document: given, token: 'tok' });
        const brokenLog = countReplies(broken);
        broken.destroy();
        assert(brokenLog.replies.length === 1 && brokenLog.replies[0].action === 'dismiss' && brokenLog.replies[0].surface === id
          && brokenLog.replies[0].reason === 'destroyed' && brokenLog.replies[0].token === 'tok', `an unbegun surface replied ${JSON.stringify(brokenLog.replies)}`);
      }
      const streamed = new zx.Surface(null, {});
      const streamedLog = countReplies(streamed);
      streamed.apply({ op: 'node', surface: 'early', id: 'x', type: 'text', text: 'too soon' });
      streamed.cancel('stopped');
      streamed.destroy();
      assert(streamedLog.replies.length === 1 && streamedLog.replies[0].action === 'cancel' && streamedLog.replies[0].reason === 'stopped'
        && streamedLog.replies[0].surface === 'early', 'a stream without begin did not reply once');
      // openSurface settles: a document that cannot begin rejects before anything opens.
      const dialogs = document.querySelectorAll('dialog').length;
      let refused = null;
      try { await zx.openSurface({ zx: 'surface/2', surface: 's' }, { placement: 'dialog' }); } catch (error) { refused = error; }
      assert(refused instanceof TypeError && Array.isArray(refused.errors) && document.querySelectorAll('dialog').length === dialogs,
        'openSurface did not reject an unbeginnable document up front');
      const answered = { zx: 'reply/1', surface: 's1', action: 'submit', key: 's1#submit', values: { name: 'A' }, confirmation: null, at: '2026-11-04T10:00:00' };
      assert((await zx.openSurface(surfaceDocument(), { placement: 'dialog', reply: answered })).action === 'submit', 'a given reply did not resolve at once');
      const show = new zx.Surface(null, { document: surfaceDocument({ intent: 'show', root: ['why'], nodes: [{ id: 'why', type: 'text', text: 'Hi' }] }) });
      const shown = countReplies(show);
      assert(show.el.querySelector('.zx-surface__frame')?.getAttribute('role') === 'region', 'a show surface is not a region');
      show.destroy();
      assert(shown.replies.length === 1 && shown.replies[0].action === 'dismiss' && shown.replies[0].reason === 'destroyed', 'destroying a show surface did not dismiss it');
    }),
    surfaceCase('Surface (type-to-confirm)', () => ({}), async () => {
      const policy = () => ({ level: 'type-to-confirm', confirmText: 'DELETE' });
      const attempts = [
        [{ id: 'go', label: 'Delete', kind: 'danger', confirm: false, skipConfirmation: true, confirmText: '', policy: 'allow' }],
        [{ id: 'go', label: 'Delete', kind: 'primary', confirmation: 'typed', requiresConfirmation: false }],
        [{ id: 'go', label: 'Delete', tool: 'safe.read' }]
      ];
      for (const actions of attempts) {
        const doc = { ...surfaceDocument({ intent: 'confirm', root: ['why'], nodes: [{ id: 'why', type: 'text', text: 'Delete it?' }], actions }), token: 'model-token' };
        const surface = new zx.Surface(null, { document: doc, policy, token: 'app-token' });
        fixtures.append(surface.toElement());
        const log = countReplies(surface);
        assert(surface.getErrors().some((error) => error.code === 'token-refused'), 'a token in the document was not refused');
        surfaceButton(surface.el, 'go').click();
        await nextFrame();
        const input = document.querySelector('dialog.zx-dialog[open] .zx-dialog__confirm-input');
        assert(input, 'type-to-confirm did not ask for the text');
        assert(log.replies.length === 0, 'the action replied before the text was typed');
        const dialog = input.closest('dialog');
        const ok = () => [...dialog.querySelectorAll('.zx-dialog__footer button')].find((button) => button.textContent === 'Delete');
        assert(ok().disabled, 'confirm enabled before typing');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await delay(10);
        assert(log.replies.length === 0 && dialog.open, 'Enter confirmed without the text');
        input.value = 'DELETE';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        ok().click();
        await delay(10);
        assert(log.replies.length === 1 && log.replies[0].confirmation === 'typed', 'the typed confirmation did not reply "typed"');
        assert(log.replies[0].token === 'app-token', 'the reply token is not the application\'s');
        surface.destroy();
        await delay(10);
      }
      // Without the policy's text the phrase is a fixed word, never the model's label.
      const fallback = new zx.Surface(null, {
        document: surfaceDocument({ intent: 'confirm', root: ['why'], nodes: [{ id: 'why', type: 'text', text: 'x' }], actions: [{ id: 'go', label: 'y' }] }),
        policy: () => 'type-to-confirm'
      });
      fixtures.append(fallback.el);
      surfaceButton(fallback.el, 'go').click();
      await nextFrame();
      const phrase = document.querySelector('dialog.zx-dialog[open] .zx-dialog__confirm-label')?.textContent;
      assert(phrase === 'Type confirm to confirm', `type-to-confirm asked for "${phrase}"`);
      fallback.destroy();
      await delay(10);
      // A questionnaire's Submit is put to the policy up front; denied, it is reported and gone.
      const asked = [];
      const quiz = new zx.Surface(null, {
        policy: (action) => { asked.push(action.id); return 'deny'; },
        document: { zx: 'surface/1', surface: 'q', intent: 'questionnaire', title: 'Setup', author: 'a', root: ['q'],
          nodes: [{ id: 'q', type: 'questionnaire', steps: [{ name: 'region', prompt: 'Where?', required: true, choices: [{ value: 'eu', label: 'EU' }] }] }] }
      });
      fixtures.append(quiz.el);
      const quizLog = countReplies(quiz);
      assert(asked.includes('submit'), 'the questionnaire submit was not decided up front');
      quiz.el.querySelector('input[type="radio"]').click();
      await delay(10);
      const submitButton = quiz.el.querySelector('.zx-questionnaire__actions [data-role="submit"]');
      assert(submitButton && getComputedStyle(submitButton).display === 'none', 'a denied questionnaire still offers Submit');
      quiz.destroy();
      assert(quizLog.replies.length === 1 && quizLog.replies[0].removed?.includes('submit'), 'the denied submit is not reported as removed');
      // A denied action is not drawn, and the reply says it was removed.
      const denied = new zx.Surface(null, {
        document: surfaceDocument({ actions: [{ id: 'send', label: 'Send', kind: 'primary', tool: 'mail.send' }, { id: 'later', label: 'Later' }] }),
        policy: (action) => (action.tool === 'mail.send' ? 'deny' : 'allow')
      });
      const deniedLog = countReplies(denied);
      assert(!surfaceButton(denied.el, 'send'), 'a denied action was drawn');
      surfaceButton(denied.el, 'later').click();
      assert(deniedLog.replies.length === 1 && deniedLog.replies[0].removed?.includes('send'), 'the reply does not report the removed action');
      denied.destroy();
    }),
    surfaceCase('Surface (Escape in pickers)', () => ({}), async () => {
      const escape = (element) => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      const pickers = {
        plan: [{ type: 'string', title: 'Plan', enum: ['a', 'b'], 'x-zx': { field: 'zxselect' } }, '.zx-select__toggle'],
        start: [{ type: 'string', title: 'Start', format: 'date' }, '.zx-datebox__toggle'],
        tags: [{ type: 'array', title: 'Tags', items: { type: 'string', enum: ['x', 'y'] }, 'x-zx': { field: 'tagpicker' } }, '.zx-tag-picker__toggle']
      };
      for (const [name, [property, toggle]] of Object.entries(pickers)) {
        const surface = new zx.Surface(null, { document: surfaceDocument({ root: ['form'], nodes: [{ id: 'form', type: 'fields', schema: { type: 'object', properties: { [name]: property } } }] }) });
        fixtures.append(surface.el);
        const log = countReplies(surface);
        const opener = surface.el.querySelector(`[data-field-id="${name}"] ${toggle}`);
        opener.click();
        await delay(30);
        const open = surface.el.querySelector(':popover-open, [aria-expanded="true"]');
        assert(open, `${name}: the picker did not open`);
        escape(document.activeElement && surface.el.contains(document.activeElement) ? document.activeElement : opener);
        await delay(20);
        assert(log.replies.length === 0, `${name}: Escape in an open picker cancelled the surface`);
        surface.destroy();
      }
      // With nothing open, Escape is Cancel.
      const plain = new zx.Surface(null, { document: surfaceDocument() });
      fixtures.append(plain.el);
      const plainLog = countReplies(plain);
      escape(plain.el.querySelector('input'));
      await delay(20);
      assert(plainLog.replies.length === 1 && plainLog.replies[0].reason === 'escape', 'Escape did not cancel');
      plain.destroy();
    }),
    surfaceCase('Surface (names)', () => ({
      component: new zx.Surface(null, { document: surfaceDocument({ root: ['form'], nodes: [{ id: 'form', type: 'fields', schema: { type: 'object', required: ['must', 'kept'], properties: {
        text: { type: 'string', title: 'Text' },
        note: { type: 'string', title: 'Note', 'x-zx': { field: 'textarea' } },
        size: { type: 'string', title: 'Size', enum: ['S', 'M'] },
        must: { type: 'string', title: 'Must', enum: ['A', 'B'] },
        kept: { type: 'string', title: 'Kept', enum: ['A', 'B'], default: 'A' },
        method: { type: 'string', title: 'Method', enum: ['card', 'transfer'], 'x-zx': { field: 'optionlist' } },
        plan: { type: 'string', title: 'Plan', oneOf: [{ const: 'a', title: 'A' }], 'x-zx': { field: 'zxselect' } },
        start: { type: 'string', title: 'Start', format: 'date' },
        copy: { type: 'boolean', title: 'Copy' },
        on: { type: 'boolean', title: 'On', 'x-zx': { field: 'toggle' } },
        seats: { type: 'integer', title: 'Seats', minimum: 1, maximum: 9 },
        share: { type: 'number', title: 'Share', minimum: 0, maximum: 100, 'x-zx': { field: 'slider' } },
        stars: { type: 'integer', title: 'Stars', maximum: 5, 'x-zx': { field: 'rating' } },
        tags: { type: 'array', title: 'Tags', items: { enum: ['x', 'y'] }, 'x-zx': { field: 'tagpicker' } },
        list: { type: 'array', title: 'List', items: { enum: ['x', 'y'] }, 'x-zx': { field: 'checklist' } }
      } } }] }) })
    }), ({ component }) => {
      const root = component.el;
      const named = (element) => {
        if (element.getAttribute('aria-label')?.trim()) return true;
        const by = element.getAttribute('aria-labelledby');
        if (by && by.split(/\s+/).some((id) => document.getElementById(id)?.textContent.trim())) return true;
        return [...(element.labels ?? [])].some((label) => label.textContent.trim());
      };
      const controls = root.querySelectorAll('.zx-surface__fields :is(input:not([type="hidden"]), select, textarea, [role="radiogroup"], [role="combobox"], [role="slider"])');
      assert(controls.length >= 15, `only ${controls.length} controls drawn`);
      for (const control of controls) {
        if (control.closest('[hidden], [popover]:not(:popover-open)')) continue;
        assert(named(control), `an unnamed control: ${control.outerHTML.slice(0, 120)}`);
      }
      for (const option of root.querySelectorAll('.zx-surface__fields select option')) {
        assert(option.textContent.trim(), 'a select option without a name');
      }
      assert(!root.querySelector('[data-field-id="kept"] option[value=""]'), 'a required select with a default kept an empty option');
      // The byline reads the muted text token, which passes contrast in both themes.
      const probe = document.createElement('span');
      probe.style.color = 'var(--zx-color-text-muted)';
      root.append(probe);
      assert(getComputedStyle(root.querySelector('.zx-surface__byline')).color === getComputedStyle(probe).color, 'the byline is not muted text');
      probe.remove();
    }),
    surfaceCase('Surface (conditional field)', () => {
      const document = {
        zx: 'surface/1', surface: 'pay', intent: 'ask', title: 'How will the customer pay?', author: 'orders', root: ['form'],
        nodes: [{ id: 'form', type: 'fields', schema: { type: 'object', required: ['method'], properties: {
          method: { type: 'string', title: 'Payment', oneOf: [{ const: 'card', title: 'Card' }, { const: 'transfer', title: 'Bank transfer' }] },
          iban: { type: 'string', title: 'IBAN', 'x-zx': { visible: { field: 'method', op: 'eq', value: 'transfer' } } }
        } } }]
      };
      return { component: new zx.Surface(null, { document }), document };
    }, async ({ component, document }) => {
      const root = component.el;
      const log = countReplies(component);
      const changes = [];
      component.on('change', (event) => changes.push(event.detail));
      const iban = () => root.querySelector('[data-field-id="iban"]');
      assert(iban().hidden, 'the IBAN showed before transfer was chosen');
      setSurfaceField(root, 'method', 'transfer');
      assert(!iban().hidden, 'the IBAN did not appear for transfer');
      setSurfaceField(root, 'iban', 'DE89370400440532013000');
      assert(changes.some((change) => change.name === 'iban'), 'no change event for the IBAN');
      setSurfaceField(root, 'method', 'card');
      assert(iban().hidden, 'the IBAN did not disappear for card');
      assert(!('iban' in component.getValues()), 'a hidden field is in getValues()');
      setSurfaceField(root, 'method', 'transfer');
      assert(component.getValues().iban === 'DE89370400440532013000', 'the hidden IBAN lost its value');
      setSurfaceField(root, 'method', 'card');
      surfaceButton(root, 'submit').click();
      assert(log.replies.length === 1 && !('iban' in log.replies[0].values) && log.replies[0].values.method === 'card', 'the hidden IBAN was in the reply');
      const text = zx.surfaceText(document, log.replies[0]);
      assert(text.includes('Payment: Card') && !text.includes('IBAN'), `surfaceText: ${text}`);
      // Rule messages go through msg(), under the same keys as a questionnaire's.
      const ruled = new zx.Surface(null, {
        msg: { 'questionnaire.rule.minLength': 'Mindestens %1 Zeichen.' },
        document: surfaceDocument({ nodes: [{ id: 'why', type: 'text', text: 'x' }, { id: 'form', type: 'fields',
          schema: { type: 'object', properties: { name: { type: 'string', title: 'Name', minLength: 5 } } } }] })
      });
      fixtures.append(ruled.el);
      setSurfaceField(ruled.el, 'name', 'ab');
      surfaceButton(ruled.el, 'submit').click();
      assert(ruled.el.textContent.includes('Mindestens 5 Zeichen.'), 'a rule message did not go through msg()');
      ruled.destroy();
    }),
    surfaceCase('Surface (narrowed catalog)', () => ({
      component: new zx.Surface(null, {
        catalog: narrowCatalog(SURFACE_CATALOG, { intents: ['show'], nodes: ['text'] }),
        document: { zx: 'surface/1', surface: 'n', intent: 'show', title: 'Status', author: 'ops', root: ['a', 'b'],
          nodes: [{ id: 'a', type: 'text', text: 'Fine.' }, { id: 'b', type: 'badge', label: 'OK' }] }
      })
    }), ({ component }) => {
      const root = component.el;
      assert(root.querySelector('[data-surface-node="b"].zx-surface__fallback'), 'a node outside the catalog did not render the fallback');
      assert(!root.querySelector('.zx-badge'), 'a node outside the catalog was drawn');
      // A display table stays in the receipt, and headings sit below the title.
      const shown = new zx.Surface(null, {
        headingLevel: 5,
        document: { zx: 'surface/1', surface: 'sh', intent: 'confirm', title: 'Overdue', author: 'a', root: ['h', 'tbl'], nodes: [
          { id: 'h', type: 'heading', text: 'Detail', level: 2 },
          { id: 'tbl', type: 'table', columns: [{ id: 'inv', label: 'Invoice' }], rows: [{ inv: 'RE-1' }] }
        ] }
      });
      fixtures.append(shown.el);
      assert(shown.el.querySelector('h5.zx-surface__title') && shown.el.querySelector('[data-surface-node="h"] h6'), 'a node heading is not below the title');
      surfaceButton(shown.el, 'cancel').click();
      const kept = shown.el.querySelector('[data-surface-node="tbl"]');
      assert(kept && !kept.hidden && kept.querySelector('table'), 'a display table vanished from the receipt');
      assert(!shown.el.querySelector('[aria-readonly]'), 'the receipt carries aria-readonly');
      shown.destroy();
      assert(component.getErrors().some((error) => error.code === 'unknown-type' && error.id === 'b'), 'the node outside the catalog was not reported');
    }),
    surfaceCase('Surface (in a thread)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } }, items: [
        { id: 'q', type: 'surface', author: 'finance', token: 'thread-token' }
      ] })
    }), async ({ component }) => {
      const replies = [];
      let dom = 0;
      component.on('reply', (event) => replies.push(event.detail));
      component.el.addEventListener('zx-reply', () => { dom += 1; });
      const surface = component.surface('q');
      assert(surface instanceof zx.Surface, 'thread.surface(id) did not return the Surface');
      for (const op of [
        { zx: 'surface/1', op: 'begin', surface: 's9', intent: 'confirm', title: 'Archive?', author: 'finance', root: ['t'] },
        { op: 'node', surface: 's9', id: 't', type: 'text', text: 'Archive 3 drafts.' },
        { op: 'end', surface: 's9' }
      ]) surface.apply(op);
      await delay(120);
      assert(component.el.querySelector('[role="status"]')?.textContent === 'Finance agent needs your answer', 'a waiting surface was not announced');
      surfaceButton(component.el, 'confirm').click();
      assert(replies.length === 1 && dom === 1, `the thread re-emitted ${replies.length} replies (${dom} DOM)`);
      assert(replies[0].reply.token === 'thread-token' && replies[0].item.id === 'q' && replies[0].item.reply?.action === 'confirm', 'thread reply detail');
      component.patch('q', { author: 'finance' });
      assert(component.surface('q').getReply()?.action === 'confirm' && replies.length === 1, 'a redraw replied again or lost the answer');
      // upsert(get(id)) and setItems(getItems()) keep a live surface.
      component.upsert({ id: 'live', type: 'surface', author: 'finance', document: { zx: 'surface/1', surface: 'k', intent: 'confirm', title: 'Go?', author: 'finance', root: ['t'], nodes: [{ id: 't', type: 'text', text: 'x' }] } });
      const live = component.surface('live');
      component.upsert(component.get('live'));
      component.setItems(component.getItems());
      assert(component.surface('live') === live && replies.length === 1, 'a redraw replaced the live surface');
      component.el.querySelector('article[data-id="live"] button[data-surface-action="confirm"]').click();
      assert(replies.length === 2 && replies[1].reply.key === 'k#confirm', 'the kept surface did not reply once');
      // A surface item that never begins still replies when it goes.
      component.upsert({ id: 'never', type: 'surface' });
      component.remove('never');
      assert(replies.length === 3 && replies[2].reply.action === 'dismiss' && replies[2].reply.surface === null, 'an unbegun thread surface did not reply');
    }),
    surfaceCase('elicit()', (fixture) => {
      const host = document.createElement('div');
      fixture.append(host);
      return { host, cleanup: () => host.remove() };
    }, async ({ host }) => {
      const requestedSchema = {
        type: 'object', required: ['name', 'plan'],
        properties: {
          name: { type: 'string', title: 'Name', minLength: 2 },
          plan: { type: 'string', title: 'Plan', oneOf: [{ const: 'basic', title: 'Basic' }, { const: 'pro', title: 'Professional' }] },
          agree: { type: 'boolean', title: 'Send a copy' },
          seats: { type: 'integer', title: 'Seats', minimum: 1, maximum: 50 },
          start: { type: 'string', format: 'date', title: 'Start' }
        }
      };
      const answer = zx.elicit({ message: 'Set up the account', requestedSchema }, { target: host });
      await Promise.resolve();
      setSurfaceField(host, 'name', 'Mara');
      setSurfaceField(host, 'plan', 'pro');
      setSurfaceField(host, 'agree', true);
      setSurfaceField(host, 'seats', 12);
      setSurfaceField(host, 'start', new Date(2026, 10, 9));
      surfaceButton(host, 'submit').click();
      const result = await answer;
      assert(result.action === 'accept', `elicit resolved ${result.action}`);
      const content = result.content;
      assert(content.name === 'Mara' && content.plan === 'pro' && content.agree === true && content.seats === 12 && content.start === '2026-11-09',
        `elicit content ${JSON.stringify(content)}`);
      host.replaceChildren();
      const declined = zx.elicit({ message: 'Again', requestedSchema }, { target: host });
      surfaceButton(host, 'reject').click();
      assert((await declined).action === 'decline', 'Decline did not resolve decline');
      host.replaceChildren();
      const cancelled = zx.elicit({ message: 'Again', requestedSchema }, { target: host });
      host.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      assert((await cancelled).action === 'cancel', 'Escape did not resolve cancel');
      host.replaceChildren();
      let rejected = null;
      try {
        await zx.elicit({ message: 'Nested', requestedSchema: { type: 'object', properties: { address: { type: 'object', title: 'Address', properties: {} } } } }, { target: host });
      } catch (error) {
        rejected = error;
      }
      assert(rejected instanceof TypeError && /address/.test(rejected.message), 'a nested object was not rejected with a TypeError naming it');
      // In a dialog by default; closing it resolves cancel.
      const dialogAnswer = zx.elicit({ message: 'In a dialog', requestedSchema });
      await nextFrame();
      const dialog = document.querySelector('dialog.zx-surface-host[open]');
      assert(dialog, 'elicit did not open a dialog');
      const close = dialog.querySelector('.zx-dialog__close, [data-dialog-close], header button');
      assert(close, 'the elicit dialog has no close button');
      close.click();
      assert((await dialogAnswer).action === 'cancel', 'closing the dialog did not resolve cancel');
      await delay(10);
    }),
    surfaceCase('elicitationHandler()', (fixture) => {
      const host = document.createElement('div');
      fixture.append(host);
      return { host, cleanup: () => host.remove() };
    }, async ({ host }) => {
      const load = async (revision) => (await fetch(new URL(`../unit/fixtures/mcp-elicitation-${revision}.json`, import.meta.url))).json();
      const legacy = await load('2025-11-25');
      const current = await load('2026-07-28');
      const [legacyForm, legacyUrl] = legacy.requests.map((request) => request.params);
      const { delivery, bank } = current.result.inputRequests;
      const opened = [];
      const handler = zx.elicitationHandler({
        serverName: 'orders', authors: { orders: { name: 'Orders server' } }, target: host,
        open: (url) => { opened.push(url); }
      });
      const fresh = () => host.replaceChildren();
      const escape = () => host.querySelector('.zx-surface button').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

      // Form mode, 2025-11-25 shape: accept with the values; the byline says who asks.
      let answer = handler(legacyForm);
      await Promise.resolve();
      assert(host.querySelector('.zx-surface__byline')?.textContent === 'Asked by Orders server', `byline: ${host.querySelector('.zx-surface__byline')?.textContent}`);
      setSurfaceField(host, 'date', new Date(2026, 10, 9));
      setSurfaceField(host, 'dock', 'south');
      surfaceButton(host, 'submit').click();
      let result = await answer;
      assert(result.action === 'accept' && result.content.date === '2026-11-09' && result.content.dock === 'south' && result.content.pallets === 4,
        `form accept: ${JSON.stringify(result)}`);
      // Form mode, 2026-07-28 shape (an inputRequests entry, no mode): decline and cancel.
      fresh();
      answer = handler(delivery.params);
      surfaceButton(host, 'reject').click();
      assert((await answer).action === 'decline', 'Decline did not answer decline');
      fresh();
      answer = handler(delivery.params);
      escape();
      result = await answer;
      assert(result.action === 'cancel' && !('content' in result), 'Escape did not answer cancel');

      // URL mode: consent first, naming the host, emphasised, and the whole address; nothing opens.
      for (const params of [legacyUrl, bank.params]) {
        fresh();
        answer = handler(params);
        await Promise.resolve();
        const surface = host.querySelector('.zx-surface');
        assert(surface && opened.length === 0, 'the page opened before the person agreed');
        assert(surface.querySelector('[data-surface-node="host"] strong')?.textContent === 'billing.example.com', 'the host is not emphasised');
        assert(surface.querySelector('[data-surface-node="address"]')?.textContent.includes('https://billing.example.com/connect?session=7f3a'), 'the full address is not shown');
        assert(!surface.querySelector('a[href]') && !document.querySelector('link[rel~="prefetch"], link[rel~="preconnect"]'), 'the address is followable or prefetched');
        assert(surfaceButton(host, 'confirm')?.textContent.includes('Open page'), 'no Open page action');
        surfaceButton(host, 'reject').click();
        result = await answer;
        assert(result.action === 'decline' && opened.length === 0, `URL decline: ${JSON.stringify(result)}`);
      }
      fresh();
      answer = handler(bank.params);
      escape();
      assert((await answer).action === 'cancel' && opened.length === 0, 'Escape did not answer cancel in URL mode');
      fresh();
      answer = handler(legacyUrl);
      surfaceButton(host, 'confirm').click();
      result = await answer;
      assert(result.action === 'accept' && !('content' in result), `URL accept: ${JSON.stringify(result)}`);
      assert(opened.length === 1 && opened[0] === 'https://billing.example.com/connect?session=7f3a', `opened ${JSON.stringify(opened)}`);
      // An opener that reports failure answers cancel.
      fresh();
      answer = zx.elicitationHandler({ serverName: 'orders', target: host, open: () => false })(bank.params);
      surfaceButton(host, 'confirm').click();
      assert((await answer).action === 'cancel', 'a page that did not open answered accept');

      // The default opener: a new browsing context without opener or referrer, in the click.
      const realOpen = window.open;
      const calls = [];
      window.open = (...args) => { calls.push(args); return null; };
      try {
        fresh();
        answer = zx.elicitationHandler({ serverName: 'orders' })(bank.params);
        await nextFrame();
        const dialog = document.querySelector('dialog.zx-surface-host[open]');
        assert(dialog, 'URL mode did not ask in a dialog');
        assert(dialog.querySelector('.zx-surface__byline')?.textContent === 'Asked by orders', 'the dialog does not say who asks');
        surfaceButton(dialog, 'confirm').click();
        assert(calls.length === 1, 'the page did not open within the click');
        result = await answer;
        const [url, name, features] = calls[0];
        const flags = String(features).split(',').map((flag) => flag.trim());
        assert(result.action === 'accept' && url === 'https://billing.example.com/connect?session=7f3a' && name === '_blank'
          && flags.includes('noopener') && flags.includes('noreferrer'), `default opener: ${JSON.stringify(calls)}`);
        // Closing the dialog answers cancel.
        answer = zx.elicitationHandler({ serverName: 'orders' })(legacyUrl);
        await nextFrame();
        const close = document.querySelector('dialog.zx-surface-host[open]')?.querySelector('.zx-dialog__close, [data-dialog-close], header button');
        assert(close, 'the URL dialog has no close button');
        close.click();
        assert((await answer).action === 'cancel' && calls.length === 1, 'closing the dialog did not answer cancel');
        // Withdrawn by the client: a signal that aborts closes the dialog, opens nothing, answers cancel.
        let controller = new AbortController();
        answer = zx.elicitationHandler({ serverName: 'orders' })(bank.params, { signal: controller.signal });
        await nextFrame();
        assert(document.querySelector('dialog.zx-surface-host[open]'), 'the withdrawn request never asked');
        controller.abort();
        assert((await answer).action === 'cancel' && calls.length === 1, 'aborting did not answer cancel');
        await delay(20);
        assert(!document.querySelector('dialog.zx-surface-host'), 'an aborted dialog was left in the page');
        controller = new AbortController();
        answer = zx.elicitationHandler({ serverName: 'orders' })(legacyForm, { signal: controller.signal });
        await nextFrame();
        controller.abort();
        assert((await answer).action === 'cancel', 'aborting a form dialog did not answer cancel');
        await delay(20);
        assert(!document.querySelector('dialog.zx-surface-host'), 'an aborted form dialog was left in the page');
      } finally {
        window.open = realOpen;
      }
      // Aborted inline: the surface stays as its receipt, and the request answers cancel.
      fresh();
      const inline = new AbortController();
      answer = handler(delivery.params, { signal: inline.signal });
      await Promise.resolve();
      inline.abort();
      result = await answer;
      assert(result.action === 'cancel' && host.querySelector('.zx-surface[data-state="answered"]'), 'aborting inline did not cancel into a receipt');
      // Already aborted: nothing is drawn, nothing opens.
      fresh();
      const early = AbortSignal.abort();
      assert((await handler(bank.params, { signal: early })).action === 'cancel' && !host.firstChild && opened.length === 1, 'an aborted signal drew or opened');
      assert((await zx.elicit(delivery.params, { signal: early })).action === 'cancel' && !document.querySelector('dialog.zx-surface-host'), 'elicit() with an aborted signal drew');
      // An unsupported schema and a refused address reject before anything is drawn.
      fresh();
      let rejected = null;
      try {
        await handler(current.unsupported[0]);
      } catch (error) {
        rejected = error;
      }
      assert(rejected instanceof TypeError && /enumNames/.test(rejected.message) && !host.firstChild, 'an unsupported schema did not reject');
      rejected = null;
      try {
        await handler({ mode: 'url', message: 'x', url: 'http://billing.example.com/' });
      } catch (error) {
        rejected = error;
      }
      assert(rejected instanceof TypeError && !host.firstChild, 'an http address did not reject');
      await delay(10);
    })
  ];
}

/** @returns {Array<object>} What a surface must survive, whatever a model wrote. */
function surfaceSafetyCases() {
  return [
    // A type is only ever looked up as the catalog's own entry: these are unknown types, nothing more.
    surfaceCase('Surface (a node type naming an inherited member)', (fixture) => ({ fixture }), ({ fixture }) => {
      const begin = '{"zx":"surface/1","op":"begin","surface":"s1","intent":"ask","title":"T","author":"a","root":["odd","form"]}';
      const form = '{"op":"node","surface":"s1","id":"form","type":"fields","schema":{"type":"object","properties":{"a":{"type":"string","title":"A"}}}}';
      for (const type of ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__']) {
        const whole = new zx.Surface(null, { document: surfaceDocument({ root: ['odd', 'form'], nodes: [{ id: 'odd', type }, surfaceDocument().nodes[1]] }) });
        fixture.append(whole.toElement());
        assert(whole.el.querySelector('.zx-surface__fallback'), `${type}: no fallback`);
        assert(whole.getErrors().some((error) => error.code === 'unknown-type'), `${type}: not reported`);
        assert(surfaceButton(whole.el, 'submit') && whole.el.querySelector('input'), `${type}: took the rest of the surface with it`);
        whole.destroy();
        for (const close of ['cancel', 'supersede', 'destroy']) {
          const streamed = new zx.Surface(null);
          const count = countReplies(streamed);
          fixture.append(streamed.toElement());
          // One chunk: what follows the odd line in it must still arrive.
          streamed.write(`${begin}\n{"op":"node","surface":"s1","id":"odd","type":${JSON.stringify(type)}}\n${form}\n{"op":"end","surface":"s1"}\n`);
          assert(streamed.toDocument().nodes.length === 2 && !surfaceButton(streamed.el, 'submit').disabled, `${type}: the chunk was cut short`);
          streamed[close]();
          assert(count.replies.length === 1 && count.dom === 1, `${type}: ${close} replied ${count.replies.length} times`);
          streamed.destroy();
          assert(!streamed.el.isConnected, `${type}: ${close} left the surface in the page`);
        }
      }
    }),
    // The id of a row is what that row holds, never something every object inherits.
    surfaceCase('Surface (a rowId or column naming an inherited member)', (fixture) => ({ fixture }), ({ fixture }) => {
      const table = { id: 'list', type: 'table', name: 'pick', rowId: 'toString', selectable: 'multi',
        columns: [{ id: 'label', label: 'Label' }, { id: 'valueOf', label: 'Odd' }], rows: [{ label: 'One' }, { label: 'Two', toString: 'own' }] };
      const component = new zx.Surface(null, { document: surfaceDocument({ intent: 'review', root: ['list'], nodes: [table] }) });
      const count = countReplies(component);
      fixture.append(component.toElement());
      const rows = [...component.el.querySelectorAll('tbody tr')];
      assert(rows.length === 2, 'the table did not draw');
      assert(!component.el.textContent.includes('native code'), 'an inherited function was drawn as a cell');
      rows[0].querySelector('input[type="checkbox"]').click();
      assert(rows[0].getAttribute('aria-selected') === 'true' && rows[1].getAttribute('aria-selected') !== 'true', 'rows without an id of their own were one row');
      assert(JSON.stringify(component.getValues()) === '{"pick":[]}', 'a row without an id reported one');
      rows[1].querySelector('input[type="checkbox"]').click();
      assert(JSON.stringify(component.getValues()) === '{"pick":["own"]}', `the selection is ${JSON.stringify(component.getValues())}`);
      surfaceButton(component.el, 'approve').click();
      assert(count.replies.length === 1 && JSON.stringify(count.replies[0].values) === '{"pick":["own"]}', 'the selection did not reach the reply');
      assert(component.el.querySelectorAll('tbody tr[data-selected]').length === 1, 'the receipt marked the wrong rows');
      component.destroy();
      // The same with one row picked and the surface closed instead, for each way of closing it.
      for (const close of ['cancel', 'supersede', 'destroy']) {
        const single = new zx.Surface(null, { document: surfaceDocument({ intent: 'review', root: ['list'], nodes: [{ ...table, selectable: 'single' }] }) });
        const replies = countReplies(single);
        fixture.append(single.toElement());
        single.el.querySelector('tbody tr').click();
        single[close]();
        assert(replies.replies.length === 1, `${close} replied ${replies.replies.length} times`);
        single.destroy();
      }
    }),
    // Nothing that goes wrong while drawing may cost the reply, or anything but the part that failed.
    surfaceCase('Surface (a failure while drawing)', (fixture) => ({ fixture }), async ({ fixture }) => {
      const resolve = { entities: ['company'], ref: () => ({ get title() { throw new Error('drawing failed'); } }) };
      const node = new zx.Surface(null, { resolve, document: surfaceDocument({ intent: 'show', root: ['ref', 'text'], nodes: [
        { id: 'ref', type: 'ref', ref: { $ref: 'company', id: 'c1' } }, { id: 'text', type: 'text', text: 'Still here' }] }) });
      fixture.append(node.toElement());
      assert(node.el.querySelector('.zx-surface__fallback') && node.el.textContent.includes('Still here'), 'one failing node took the surface with it');
      assert(node.getErrors().some((error) => error.code === 'draw-failed'), 'the failure was not reported');
      node.destroy();
      for (const close of ['cancel', 'supersede', 'destroy']) {
        const component = new zx.Surface(null, { document: surfaceDocument() });
        const count = countReplies(component);
        fixture.append(component.toElement());
        component._freeze = () => { throw new Error('drawing failed'); };
        component[close]();
        assert(count.replies.length === 1 && count.dom === 1, `${close}: a failing receipt cost the reply`);
        assert(component.getErrors().some((error) => error.code === 'draw-failed'), `${close}: the failure was not reported`);
        component.destroy();
        assert(!component.el.isConnected, `${close}: the surface stayed in the page`);
      }
      // The closing reply itself cannot be built: a bare one still goes out.
      const bare = new zx.Surface(null, { document: surfaceDocument() });
      const bareCount = countReplies(bare);
      fixture.append(bare.toElement());
      bare._docLike = () => { throw new Error('drawing failed'); };
      bare.cancel();
      assert(bareCount.replies.length === 1 && bareCount.replies[0].surface === 's1' && bareCount.replies[0].action === 'cancel', 'a closing reply was lost');
      bare.destroy();
      // A surface that cannot be built opens nothing and leaves nothing behind.
      const dialogs = document.querySelectorAll('dialog').length;
      let refused = null;
      try {
        await zx.openSurface(surfaceDocument(), { placement: 'dialog', token: 5 });
      } catch (error) {
        refused = error;
      }
      assert(refused instanceof TypeError && document.querySelectorAll('dialog').length === dialogs, 'a refused surface left its dialog behind');
    }),
    // Several primary actions: the one pressed answers, under its own policy.
    surfaceCase('Surface (each primary action answers for itself)', (fixture) => ({ fixture }), async ({ fixture }) => {
      const actions = [{ id: 'erase', label: 'Erase', kind: 'primary', tool: 'data.erase' }, { id: 'keep', label: 'Keep', kind: 'primary', tool: 'data.keep' }];
      const open = (policy) => {
        const component = new zx.Surface(null, { document: surfaceDocument({ actions }), policy });
        fixture.append(component.toElement());
        setSurfaceField(component.el, 'name', 'Ada');
        return { component, count: countReplies(component) };
      };
      const clicked = open(null);
      surfaceButton(clicked.component.el, 'keep').click();
      await delay(0);
      assert(clicked.count.replies.length === 1 && clicked.count.replies[0].action === 'keep', `pressing Keep answered ${clicked.count.replies[0]?.action}`);
      clicked.component.destroy();
      // The confirmation the policy wants for the action pressed is the one asked.
      const guarded = open((action) => (action.id === 'keep' ? { level: 'type-to-confirm', confirmText: 'KEEP' } : 'allow'));
      surfaceButton(guarded.component.el, 'keep').click();
      await delay(0);
      assert(document.querySelector('dialog[open] .zx-dialog__confirm-input') && guarded.count.replies.length === 0, 'the action pressed skipped its type-to-confirm');
      guarded.component.destroy();
      await delay(20);
      assert(!document.querySelector('dialog[open]'), 'the confirmation stayed open');
      // Enter in a field presses the first of them.
      const entered = open(null);
      entered.component.el.querySelector('form').requestSubmit();
      await delay(0);
      assert(entered.count.replies[0]?.action === 'erase', 'Enter did not take the first primary action');
      entered.component.destroy();
    }),
    // The policy is synchronous: nothing waits for a promise, so a promise allows nothing.
    surfaceCase('Surface (a policy that returns a promise)', (fixture) => ({ fixture }), async ({ fixture }) => {
      const policies = {
        'resolved deny': async () => 'deny',
        'resolved allow': async () => 'allow',
        rejected: async () => { throw new Error('refused'); },
        pending: () => new Promise(() => {}),
        thenable: () => ({ then() {} })
      };
      for (const [name, policy] of Object.entries(policies)) {
        const component = new zx.Surface(null, { document: surfaceDocument(), policy });
        const count = countReplies(component);
        fixture.append(component.toElement());
        assert(!surfaceButton(component.el, 'submit'), `${name}: the action was drawn`);
        assert(surfaceButton(component.el, 'cancel'), `${name}: the way out went with it`);
        component.cancel();
        assert(count.replies[0]?.removed?.includes('submit'), `${name}: the reply does not say it was removed`);
        component.destroy();
      }
      // The object form of a decision stays: it is how a policy supplies the text to type.
      const typed = new zx.Surface(null, { document: surfaceDocument(), policy: () => ({ level: 'type-to-confirm', confirmText: 'SEND' }) });
      fixture.append(typed.toElement());
      setSurfaceField(typed.el, 'name', 'Ada');
      surfaceButton(typed.el, 'submit').click();
      await delay(0);
      assert(document.querySelector('dialog[open] .zx-dialog__confirm-label b')?.textContent === 'SEND', 'a decision object was not read');
      typed.destroy();
      await delay(20);
    }),
    // A form's members answer to its inputs' names, and those are the model's to choose.
    surfaceCase('Surface (an input named after a form member)', (fixture) => ({ fixture }), ({ fixture }) => {
      for (const name of ['removeAttribute', 'setAttribute', 'getAttribute', 'localName', 'querySelector', 'submit', 'contains', 'dataset', 'classList', 'addEventListener']) {
        const nodes = [{ id: 'form', type: 'fields', schema: { type: 'object', required: [name], properties: { [name]: { type: 'string', title: 'Field' } } } }];
        const whole = new zx.Surface(null, { document: surfaceDocument({ root: ['form'], nodes }) });
        const count = countReplies(whole);
        fixture.append(whole.toElement());
        assert(whole.getErrors().every((error) => error.code !== 'draw-failed'), `${name}: drawing failed`);
        assert(!whole.el.querySelector('.zx-surface__frame').hasAttribute('aria-busy'), `${name}: the finished surface is still busy`);
        assert(surfaceButton(whole.el, 'submit').type === 'submit', `${name}: Enter no longer submits`);
        setSurfaceField(whole.el, name, 'Ada');
        surfaceButton(whole.el, 'submit').click();
        assert(count.replies.length === 1 && count.replies[0].values[name] === 'Ada', `${name}: the value did not reach the reply`);
        whole.destroy();
        const streamed = new zx.Surface(null);
        fixture.append(streamed.toElement());
        streamed.apply({ zx: 'surface/1', op: 'begin', surface: 's1', intent: 'ask', title: 'T', author: 'a', root: ['form'] });
        streamed.apply({ op: 'node', surface: 's1', ...nodes[0] });
        assert(streamed.el.querySelector('.zx-surface__frame').hasAttribute('aria-busy'), `${name}: a streaming surface is not busy`);
        streamed.apply({ op: 'end', surface: 's1' });
        assert(streamed.getErrors().every((error) => error.code !== 'draw-failed'), `${name}: streaming failed`);
        streamed.destroy();
      }
    }),
    // One operation costs what it touches, whatever else the surface holds.
    surfaceCase('Surface (an operation costs what it touches)', (fixture) => ({ fixture }), ({ fixture }) => {
      const component = new zx.Surface(null);
      fixture.append(component.toElement());
      const rows = Array.from({ length: 50 }, (_, index) => ({ id: `r${index}`, note: 'x' }));
      component.apply({ zx: 'surface/1', op: 'begin', surface: 's1', intent: 'show', title: 'T', author: 'a', root: ['list', 'note', 'first'] });
      component.apply({ op: 'data', surface: 's1', path: '', value: { rows, note: 'one', items: [{ text: 'a' }, { text: 'b' }] } });
      component.apply({ op: 'node', surface: 's1', id: 'list', type: 'table', columns: [{ id: 'id', label: 'Id' }], rows: { $data: '/rows' } });
      component.apply({ op: 'node', surface: 's1', id: 'note', type: 'text', text: { $data: '/note' } });
      component.apply({ op: 'node', surface: 's1', id: 'first', type: 'text', text: { $data: '/items/1/text' } });
      const table = component.el.querySelector('table');
      const held = component._model.data.rows;
      const resolved = component._prop(component._model.nodes.get('list'), 'rows');
      component.apply({ op: 'data', surface: 's1', path: '/note', value: 'two' });
      assert(component.el.textContent.includes('two'), 'the node bound to the path was not redrawn');
      assert(component.el.querySelector('table') === table, 'a node bound elsewhere was redrawn');
      assert(component._model.data.rows === held, 'the data was copied to change one member');
      assert(component._prop(component._model.nodes.get('list'), 'rows') === resolved, 'a binding was resolved and checked again');
      // A list that changes moves what follows, and a bound row keeps up.
      component.apply({ op: 'data', surface: 's1', path: '/rows/0/note', value: 'y' });
      assert(component.el.querySelector('table') !== table, 'a change inside bound rows was not drawn');
      assert(component.el.textContent.includes('b'), 'the bound list entry is missing');
      component.apply({ op: 'data', surface: 's1', path: '/items/0', remove: true });
      assert(!component.el.querySelector('[data-surface-node="first"]').textContent.includes('b'), 'a removal did not reach what it moved');
      component.apply({ op: 'data', surface: 's1', path: '/items/-', value: { text: 'c' } });
      assert(component.el.querySelector('[data-surface-node="first"]').textContent.includes('c'), 'an append did not reach what it moved in');
      component.apply({ op: 'data', surface: 's1', path: '', value: { note: 'three' } });
      assert(component.el.querySelector('[data-surface-node="note"]').textContent.includes('three'), 'replacing the data did not redraw');
      component.destroy();
    }),
    // The budget holds while a surface streams, before anything has ended it.
    surfaceCase('Surface (the table cell budget)', (fixture) => ({ fixture }), ({ fixture }) => {
      const component = new zx.Surface(null);
      fixture.append(component.toElement());
      const columns = Array.from({ length: 50 }, (_, index) => ({ id: `c${index}`, label: 'C' }));
      component.apply({ zx: 'surface/1', op: 'begin', surface: 's1', intent: 'ask', title: 'T', author: 'a', root: ['a', 'b', 'c', 'form'] });
      component.apply({ op: 'data', surface: 's1', path: '/rows', value: Array.from({ length: 1000 }, () => ({ c0: 1 })) });
      for (const id of ['a', 'b', 'c']) component.apply({ op: 'node', surface: 's1', id, type: 'table', columns, rows: { $data: '/rows' } });
      assert(component.el.querySelectorAll('.zx-table, [data-surface-node] table').length > 0, 'no table drew');
      assert(component.el.querySelector('[data-surface-node="c"]').classList.contains('zx-surface__fallback'), 'the table past the budget drew');
      assert(component.getErrors().some((error) => error.code === 'limit' && error.id === 'c'), 'the budget was not reported');
      // It is what the surface holds now that counts.
      component.apply({ op: 'remove', surface: 's1', id: 'a' });
      assert(!component.el.querySelector('[data-surface-node="c"]').classList.contains('zx-surface__fallback'), 'a table that fits again stayed a fallback');
      component.destroy();
    }),
    // Every waiting surface has a way out, and Escape is one of them.
    surfaceCase('Surface (a way out of every waiting surface)', (fixture) => ({ fixture }), async ({ fixture }) => {
      const escape = async (component) => {
        (component.el.querySelector('input, button') ?? component.el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await delay(0);
      };
      const steps = [{ name: 'a', prompt: 'A?', required: true, choices: [{ value: 'x', label: 'X' }] }];
      const asking = surfaceDocument({ intent: 'questionnaire', root: ['q'], nodes: [{ id: 'q', type: 'questionnaire', steps }] });
      const diff = { id: 'd', type: 'diff', name: 'accepted', rows: [{ id: 'r1', field: 'name', label: 'Name', before: 'A', after: 'B' }] };
      const review = surfaceDocument({ intent: 'review', root: ['d'], nodes: [diff] });
      const open = (document, options = {}) => {
        const component = new zx.Surface(null, { document, ...options });
        fixture.append(component.toElement());
        return { component, count: countReplies(component) };
      };
      // A questionnaire has its Cancel, enabled while it streams and whatever the policy says of Submit.
      for (const policy of [null, () => 'deny']) {
        const { component, count } = open(asking, { policy });
        surfaceButton(component.el, 'cancel').click();
        await delay(0);
        assert(count.replies.length === 1 && count.replies[0].action === 'cancel', 'Cancel did not close a questionnaire');
        component.destroy();
      }
      const streaming = new zx.Surface(null);
      fixture.append(streaming.toElement());
      streaming.apply({ zx: 'surface/1', op: 'begin', surface: 's1', intent: 'questionnaire', title: 'T', author: 'a', root: [] });
      assert(surfaceButton(streaming.el, 'cancel') && !surfaceButton(streaming.el, 'cancel').disabled, 'Cancel waited for a questionnaire to end');
      streaming.destroy();
      // Escape closes whatever waits.
      for (const [name, document, action] of [
        ['questionnaire', asking, 'cancel'],
        ['review', review, 'cancel'],
        ['show with actions', surfaceDocument({ intent: 'show', root: ['why'], nodes: [surfaceDocument().nodes[0]], actions: [{ id: 'go', label: 'Go' }] }), 'dismiss']
      ]) {
        const { component, count } = open(document);
        await escape(component);
        assert(count.replies.length === 1 && count.replies[0].action === action && count.replies[0].reason === 'escape', `Escape did not close a ${name}`);
        component.destroy();
      }
      // A surface that asks nothing has nothing to close.
      const plain = open(surfaceDocument({ intent: 'show', root: ['why'], nodes: [surfaceDocument().nodes[0]] }));
      await escape(plain.component);
      assert(plain.count.replies.length === 0, 'Escape closed a surface that waits for nothing');
      plain.component.destroy();
      // A review keeps a visible way to refuse: its Reject, or Cancel where that is gone.
      const reject = open(review);
      assert(surfaceButton(reject.component.el, 'reject') && !surfaceButton(reject.component.el, 'cancel'), 'a review with Reject grew a Cancel');
      reject.component.destroy();
      for (const [name, document, options] of [
        ['its own actions', surfaceDocument({ intent: 'review', root: ['d'], nodes: [diff], actions: [{ id: 'send', label: 'Send', kind: 'primary' }] }), {}],
        ['Reject denied', review, { policy: (action) => (action.id === 'reject' ? 'deny' : 'allow') }]
      ]) {
        const { component, count } = open(document, options);
        assert(surfaceButton(component.el, 'cancel'), `a review with ${name} has no way out`);
        surfaceButton(component.el, 'cancel').click();
        await delay(0);
        assert(count.replies[0]?.action === 'cancel', `Cancel did not close a review with ${name}`);
        component.destroy();
      }
      // A step the validator dropped takes the `next` naming it along, so the questionnaire can end.
      const dropped = open(surfaceDocument({ intent: 'questionnaire', root: ['q'], nodes: [{ id: 'q', type: 'questionnaire', steps: [{ ...steps[0], next: 'gone' }, { name: 'gone' }] }] }));
      const questionnaire = zx.Component.from(dropped.component.el.querySelector('.zx-questionnaire'));
      dropped.component.el.querySelector('.zx-questionnaire__control').click();
      await questionnaire.submit();
      await delay(0);
      assert(dropped.count.replies[0]?.action === 'submit', 'a questionnaire with a dangling next could not be answered');
      dropped.component.destroy();
    }),
    // A receipt shows what the reply answered, restored or not.
    surfaceCase('Surface (a restored receipt)', (fixture) => ({ fixture }), ({ fixture }) => {
      const reply = { zx: 'reply/1', surface: 's1', action: 'submit', key: 's1#submit', values: { method: 'transfer', iban: 'DE123' }, confirmation: null, at: '2026-01-01T10:00:00' };
      const document = surfaceDocument({ root: ['form', 'bank', 'open'], nodes: [
        { id: 'form', type: 'fields', schema: { type: 'object', properties: { method: { type: 'string', title: 'Method', enum: ['card', 'transfer'] } } } },
        { id: 'bank', type: 'fields', visible: { field: 'method', op: 'eq', value: 'transfer' }, schema: { type: 'object', properties: { iban: { type: 'string', title: 'IBAN' } } } },
        { id: 'open', type: 'text', visible: { field: 'method', op: 'empty' }, text: 'Shown only while unanswered' }
      ] });
      const component = new zx.Surface(null, { document, reply });
      fixture.append(component.toElement());
      const shown = (id) => !component.el.querySelector(`[data-surface-node="${id}"]`).hidden;
      assert(shown('bank') && component.el.textContent.includes('DE123'), 'an answered section was hidden');
      assert(!shown('open'), 'a node hidden for the answer was shown');
      component.destroy();
      // A hidden step in a stored reply stays out of the receipt as well.
      const steps = [{ name: 'a', prompt: 'A?', input: {} }, { name: 'b', prompt: 'B?', input: {}, when: { field: 'a', op: 'eq', value: 'yes' } }];
      const stored = new zx.Surface(null, { document: surfaceDocument({ intent: 'questionnaire', root: ['q'], nodes: [{ id: 'q', type: 'questionnaire', steps }] }),
        reply: { ...reply, values: { answers: { a: 'no', b: 'HIDDEN' }, path: ['a', 'b'] } } });
      fixture.append(stored.toElement());
      assert(!stored.el.textContent.includes('HIDDEN'), 'a hidden step was drawn in the receipt');
      stored.destroy();
    }),
    // What an application registered is the application's: the surface fills in only what is missing.
    surfaceCase('Surface (an application\'s own Field adapters)', (fixture) => ({ fixture }), async ({ fixture }) => {
      const { registerRatingFieldAdapter } = await import('../../src/components/rating/field-adapter.js');
      const { registerDateboxFieldAdapters } = await import('../../src/components/datebox/field-adapter.js');
      const own = (name) => () => {
        const el = document.createElement('input');
        el.dataset.own = name;
        return { el, get: () => el.value, set: (value) => { el.value = value ?? ''; }, focus: () => el.focus(), setDisabled: (disabled) => { el.disabled = disabled; } };
      };
      zx.Field.register('rating', own('rating'));
      zx.Field.register('date', own('date'));
      try {
        const properties = {
          stars: { type: 'integer', title: 'Stars', 'x-zx': { field: 'rating' } },
          day: { type: 'string', title: 'Day', format: 'date' },
          at: { type: 'string', title: 'At', format: 'date-time' }
        };
        const component = new zx.Surface(null, { document: surfaceDocument({ root: ['form'], nodes: [{ id: 'form', type: 'fields', schema: { type: 'object', properties } }] }) });
        fixture.append(component.toElement());
        assert(component.el.querySelector('[data-own="rating"]'), 'the application\'s rating adapter was replaced');
        assert(component.el.querySelector('[data-own="date"]'), 'the application\'s date adapter was replaced');
        assert(component.el.querySelector('[data-field-id="at"] input') && !component.el.querySelector('[data-field-id="at"] [data-own]'), 'the adapter beside it was lost');
        component.destroy();
      } finally {
        registerRatingFieldAdapter();
        registerDateboxFieldAdapters();
      }
    }),
    /* -- end of the safety cases -- */
  ];
}

/** @returns {Array<object>} The AG-UI adapter, replaying a recorded sequence into a real thread. */
function agUiCases() {
  return [
    surfaceCase('connectAgUi()', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } })
    }), async ({ component: thread }) => {
      const { events } = await (await fetch(new URL('../unit/fixtures/ag-ui-surfaces.json', import.meta.url))).json();
      if (!zx.AgentThread.has('smoke-company')) {
        zx.AgentThread.register('smoke-company', (item) => zx.h('p', { class: 'smoke-company' }, String(item.name ?? '')));
      }
      const results = [];
      const problems = [];
      const adapter = zx.connectAgUi(thread, {
        agent: 'finance',
        inlineSurfaces: true,
        tools: { show_company: (call) => (call.args ? { type: 'smoke-company', name: call.status === 'done' ? JSON.parse(call.result).name : '…' } : null) },
        ontoolresult: (id, result) => results.push([id, result]),
        onerror: (problem) => problems.push(problem.code)
      });
      const ids = () => [...thread.el.querySelectorAll('.zx-agent-thread__item')].map((article) => article.dataset.id);
      const second = events.findIndex((event) => event.runId === 'run_c2');
      const skeletonAt = events.findIndex((event) => event.type === 'TOOL_CALL_ARGS' && event.toolCallId === 'call_c2');
      for (const event of events.slice(0, skeletonAt + 1)) adapter.handle(event);
      assert(thread.el.querySelector('article[data-id="tool:call_c2"] [aria-busy="true"]'), 'a surface tool did not stand as a skeleton while its arguments arrived');
      for (const event of events.slice(skeletonAt + 1, second)) adapter.handle(event);
      assert(JSON.stringify(ids()) === JSON.stringify(['trace:run_c1', 'tool:call_c1', 'trace:run_c1#2', 'surface:run_c1/s1']), `items after the first run: ${ids()}`);
      assert(thread.el.querySelector('article[data-id="tool:call_c1"] .smoke-company')?.textContent === 'Helios Energie', 'the tile was not patched with the result');
      const asked = thread.el.querySelector('article[data-id="surface:run_c1/s1"]');
      setSurfaceField(asked, 'template', 'reminder-2');
      surfaceButton(asked, 'submit').click();
      assert(results.length === 1 && results[0][0] === 'call_c2', 'the surface reply did not become the tool result');
      assert(results[0][1].token === 'call_c2' && results[0][1].values.template === 'reminder-2', `tool result ${JSON.stringify(results[0][1])}`);
      for (const event of events.slice(second)) adapter.handle(event);
      assert(JSON.stringify(ids().slice(4)) === JSON.stringify(['msg_c2', 'surface:run_c2/s1', 'msg_c2#2']), `items after the second run: ${ids()}`);
      assert(thread.el.querySelector('article[data-id="msg_c2#2"]')?.dataset.continued === 'true', 'the prose after a fence does not read as the same turn');
      const replies = [];
      thread.on('reply', (event) => replies.push(event.detail.reply));
      thread.surface('surface:run_c2/s1').cancel();
      assert(replies[0]?.token === 'run_c2', 'an inline surface does not carry the run id as its token');
      assert(problems.length === 0, `problems: ${problems}`);
      adapter.destroy();
    }),
    surfaceCase('Questionnaire (what the last release tolerated)', () => ({
      component: new zx.Questionnaire(null, { review: true, items: [
        { name: 'a', prompt: 'A', input: {}, next: '$review', validate: false, when: {} },
        { name: 'skipped', prompt: 'Skipped', input: {}, next: false },
        { name: '$review', prompt: 'An item of that name', input: {}, next: [] }
      ] })
    }), async ({ component }) => {
      const forward = /** @type {HTMLButtonElement} */ (component.el.querySelector('[data-role]'));
      assert(component.getActive() === 'a', 'the questionnaire did not start on its first item');
      assert(forward.dataset.role === 'next', `the item’s own name read as the review screen: ${forward.dataset.role}`);
      await component.next();
      assert(component.getActive() === '$review', `next left for ${component.getActive()} instead of the item named $review`);
      assert(forward.dataset.role === 'review', 'the last item did not lead to the review');
    }),
    surfaceCase('AgentThread (setItems draws anew, as it always has)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } })
    }), async ({ component: thread }) => {
      const log = { alive: new Map(), calls: [], seen: [] };
      /** @type {any} */ (thread).smokeLog = log;
      if (!zx.AgentThread.has('smoke-registry')) {
        zx.AgentThread.register('smoke-registry', (item, { thread: owner, own }) => {
          const { smokeLog } = /** @type {any} */ (owner);
          smokeLog.calls.push(`render ${item.id}`);
          smokeLog.seen.push(owner.get(item.id));
          const element = zx.h('p', {}, String(item.id));
          smokeLog.alive.set(item.id, element);
          own(/** @type {any} */ ({ destroy() {
            smokeLog.calls.push(`destroy ${item.id}`);
            smokeLog.alive.delete(item.id);
          } }));
          return element;
        });
      }
      const ids = () => [...thread.el.querySelectorAll('.zx-agent-thread__item')].map((article) => article.dataset.id);
      thread.setItems([{ id: 'a', type: 'smoke-registry' }, { id: 'b', type: 'smoke-registry' }]);
      log.calls.length = 0;
      log.seen.length = 0;
      thread.setItems([{ id: 'b', type: 'smoke-registry' }, { id: 'a', type: 'smoke-registry' }]);
      assert(log.calls.join() === 'destroy a,destroy b,render b,render a', `the old items must go before anything is drawn: ${log.calls}`);
      assert(log.alive.has('a') && log.alive.has('b'), 'a renderer’s cleanup took the item that replaced it');
      assert(log.seen.every((item) => item === null), 'a renderer saw the item it replaces');
      assert(ids().join() === 'b,a', `order: ${ids()}`);
      thread.setItems([{ id: 7, type: 'text', text: 'one' }]);
      thread.setItems([{ id: 7, type: 'text', text: 'two' }]);
      assert(thread.get(7).id === 7, `an id’s type changed: ${typeof thread.get(7).id}`);
      // A surface already drawn is the exception: it stays, and keeps what was typed.
      const surfaceItem = { id: 's', type: 'surface', document: surfaceDocument({ root: ['form'], nodes: [
        { id: 'form', type: 'fields', schema: { type: 'object', properties: { a: { type: 'string', title: 'A' } } } }
      ] }) };
      thread.setItems([{ id: 'n', type: 'text', text: 'before' }, surfaceItem]);
      const surface = thread.surface('s');
      thread.setItems([surfaceItem, { id: 'm', type: 'text', text: 'after' }, { id: 'n', type: 'text', text: 'again' }]);
      assert(thread.surface('s') === surface, 'a surface that still matches was drawn anew');
      assert(ids().join() === 's,m,n', `order around a kept surface: ${ids()}`);
      thread.setItems([{ id: 'm', type: 'text', text: 'then' }, surfaceItem]);
      assert(thread.surface('s') === surface && ids().join() === 'm,s', `moved surface: ${ids()}`);
      assert(thread.el.querySelector('article[data-id="m"]').getAttribute('aria-setsize') === '2', 'positions were not synced');
    }),
    surfaceCase('AgentThread (an item’s own catalog field is still copied)', () => ({
      component: new zx.AgentThread(null, {})
    }), ({ component: thread }) => {
      if (!zx.AgentThread.has('smoke-shop')) zx.AgentThread.register('smoke-shop', (item) => zx.h('p', {}, String(item.catalog.a)));
      const given = { id: 'x', type: 'smoke-shop', catalog: { a: 1 } };
      thread.upsert(given);
      given.catalog.a = 2;
      assert(thread.get('x').catalog.a === 1, 'an application’s later change reached the thread');
      thread.get('x').catalog.a = 3;
      assert(thread.get('x').catalog.a === 1, 'get() handed out the thread’s own object');
      thread.patch('x', { catalog: { a: 4 } });
      assert(thread.get('x').catalog.a === 4, 'a patched catalog was lost');
      const narrow = narrowCatalog(SURFACE_CATALOG, { intents: ['show'], nodes: ['text'] });
      thread.upsert({ id: 's', type: 'surface', catalog: narrow, document: { zx: 'surface/1', surface: 's', intent: 'show', title: 'T', author: 'a', root: [], nodes: [] } });
      assert(thread.surface('s'), 'a surface’s catalog must stay the library’s own object');
    }),
    surfaceCase('connectAgUi() (a closed message or call reopens)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } }, answerActions: ['copy'] })
    }), async ({ component: thread }) => {
      const results = [];
      const replies = [];
      const problems = [];
      thread.on('reply', (event) => replies.push(event.detail.reply));
      const adapter = zx.connectAgUi(thread, {
        agent: 'finance',
        ontoolresult: (id, result) => results.push([id, result]),
        onerror: (problem) => problems.push(problem.code)
      });
      const say = (id, delta) => {
        adapter.handle({ type: 'TEXT_MESSAGE_START', messageId: id });
        adapter.handle({ type: 'TEXT_MESSAGE_CONTENT', messageId: id, delta });
      };
      const view = () => thread.el.querySelector('article[data-id="m"] .zx-block-view');
      adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r1' });
      say('m', 'first ');
      adapter.handle({ type: 'TEXT_MESSAGE_END', messageId: 'm' });
      assert(view().dataset.state === 'done' && thread.el.querySelector('article[data-id="m"] .zx-agent-thread__actions'), 'the answer did not finish');
      say('m', 'second');
      assert(thread.get('m').streaming === true && view().dataset.state === 'streaming', 'a reopened answer does not stream');
      assert(!thread.el.querySelector('article[data-id="m"] .zx-agent-thread__actions'), 'a reopened answer offered actions');
      adapter.handle({ type: 'TEXT_MESSAGE_END', messageId: 'm' });
      assert(thread.getComponent('m').toText() === 'first second', `text: ${thread.getComponent('m').toText()}`);
      adapter.handle({ type: 'RUN_FINISHED', threadId: 't', runId: 'r1', outcome: { type: 'cancelled' } });
      // Stopped, then reopened by a later run: it reads as stopped no more.
      adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r2' });
      say('m', 'x');
      adapter.handle({ type: 'RUN_FINISHED', threadId: 't', runId: 'r2', outcome: { type: 'cancelled' } });
      assert(view().dataset.state === 'stopped', 'the message did not read as stopped');
      adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r3' });
      say('m', ' again');
      assert(view().dataset.state === 'streaming' && !view().querySelector('.zx-block-view__stopped'), 'a reopened answer still reads as stopped');
      adapter.handle({ type: 'TEXT_MESSAGE_END', messageId: 'm' });
      assert(thread.getComponent('m').toText().endsWith('again'), 'the text did not continue');
      // A surface goes when its call reopens: its one reply reaches the thread, but it is not the
      // call's answer, and the document drawn again is a surface of this run.
      const document = JSON.stringify(surfaceDocument());
      const call = (delta) => {
        adapter.handle({ type: 'TOOL_CALL_START', toolCallId: 'c', toolCallName: 'ask_user' });
        adapter.handle({ type: 'TOOL_CALL_ARGS', toolCallId: 'c', delta });
        adapter.handle({ type: 'TOOL_CALL_END', toolCallId: 'c' });
      };
      call(document);
      assert(thread.surface('surface:r3/s1'), 'the surface was not drawn');
      call(' ');
      assert(replies.length === 1 && replies[0].action === 'dismiss', 'the surface that went did not reply once');
      assert(thread.surface('surface:r3/s1') && thread.surface('surface:r3/s1').getReply() === null, 'the reopened call was not drawn again');
      assert(results.length === 0, `the call was answered for: ${JSON.stringify(results)}`);
      assert(problems.join() === 'unclosed', `only the message the stopped run left open is a problem: ${problems}`);
      adapter.destroy();
    }),
    surfaceCase('connectAgUi() (a surface whose end never came)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } })
    }), ({ component: thread }) => {
      const problems = [];
      const adapter = zx.connectAgUi(thread, { agent: 'finance', inlineSurfaces: true, onerror: (problem) => problems.push(problem.code) });
      adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r1' });
      adapter.handle({ type: 'TEXT_MESSAGE_START', messageId: 'm' });
      adapter.handle({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'Hello\n```zx-surface\n{"zx":"surface/1","op":"begin","surface":"s1","intent":"confirm","title":"Go?","author":"finance","root":[]}\n```\n' });
      adapter.handle({ type: 'TEXT_MESSAGE_END', messageId: 'm' });
      const surface = thread.surface('surface:r1/s1');
      assert(surfaceButton(thread.el, 'confirm').disabled && !surface.getReply(), 'the surface was closed before its run ended');
      adapter.handle({ type: 'RUN_FINISHED', threadId: 't', runId: 'r1' });
      assert(surface.getReply()?.action === 'cancel' && surface.getReply().reason === 'stopped', 'the surface was left waiting with its actions disabled');
      assert(!thread.el.querySelector('[data-id="surface:r1/s1"] [aria-busy="true"]'), 'the surface still reads as busy');
      assert(problems.join() === 'unterminated-surface', `problems: ${problems}`);
      adapter.destroy();
    }),
    surfaceCase('connectAgUi() (destroyed during a run)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } }),
      status: new zx.RunStatus(null, {}),
      cleanup() { this.status.destroy(); }
    }), ({ component: thread, status }) => {
      const adapter = zx.connectAgUi(thread, { agent: 'finance', runStatus: status });
      adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r1' });
      adapter.handle({ type: 'TEXT_MESSAGE_START', messageId: 'm' });
      adapter.handle({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'Half' });
      adapter.handle({ type: 'TOOL_CALL_START', toolCallId: 'c', toolCallName: 'ask_user' });
      const feed = thread.el.querySelector('[role="feed"]');
      assert(feed.getAttribute('aria-busy') === 'true', 'the run did not read as busy');
      adapter.destroy();
      assert(feed.getAttribute('aria-busy') === 'false', 'the feed reads as busy for ever');
      assert(!thread.el.querySelector('[data-type="zx-placeholder"]'), 'a Skeleton was left standing');
      assert(status.getState().state === 'stopped', `the run reads as ${status.getState().state}`);
    }),
    surfaceCase('AgentThread (a reply on the item)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } })
    }), ({ component: thread }) => {
      const replies = [];
      thread.on('reply', (event) => replies.push(event.detail.reply));
      const document = surfaceDocument();
      const reply = { zx: 'reply/1', surface: 's1', action: 'submit', key: 's1#submit', values: { name: 'Elsewhere' }, confirmation: null, at: '2026-11-04T10:00:00' };
      // Answered somewhere else: the form must not stay open to be answered twice.
      for (const write of [
        (item) => thread.setItems([item]),
        (item) => thread.upsert(item)
      ]) {
        thread.setItems([]);
        replies.length = 0;
        thread.setItems([{ id: 'x', type: 'surface', document }]);
        const open = thread.surface('x');
        replies.length = 0;
        write({ id: 'x', type: 'surface', document, reply });
        assert(thread.surface('x') !== open && thread.surface('x').getReply()?.action === 'submit', 'the reply on the item did not reach the surface');
        assert(!thread.el.querySelector('article[data-id="x"] input'), 'the answered surface kept its form');
        assert(thread.get('x').reply?.values.name === 'Elsewhere', 'get() lost the reply');
        assert(replies.length === 0, `an answer given elsewhere sent another reply: ${JSON.stringify(replies)}`);
      }
      // A surface streamed in has no document on its item.
      thread.setItems([{ id: 's', type: 'surface' }]);
      for (const op of [
        { zx: 'surface/1', op: 'begin', surface: 's1', intent: 'ask', title: 'T', author: 'finance', root: ['form'] },
        { op: 'node', surface: 's1', id: 'form', type: 'fields', schema: { type: 'object', properties: { name: { type: 'string', title: 'Name' } } } },
        { op: 'end', surface: 's1' }
      ]) thread.surface('s').apply(op);
      replies.length = 0;
      thread.upsert({ id: 's', type: 'surface', reply });
      assert(thread.surface('s').getReply()?.action === 'submit', 'a streamed surface lost the reply');
      assert(!thread.el.querySelector('article[data-id="s"] input') && thread.el.querySelector('article[data-id="s"] .zx-surface__verdict'), 'a streamed surface was not frozen');
      assert(replies.length === 0, 'a streamed surface sent another reply');
      // Answered here, a later reply on the item changes nothing: it replies once.
      thread.setItems([{ id: 'y', type: 'surface', document }]);
      const answered = thread.surface('y');
      answered.cancel('cancelled');
      thread.setItems([{ id: 'y', type: 'surface', document, reply }]);
      assert(thread.surface('y') === answered && answered.getReply().action === 'cancel', 'the surface’s own reply was replaced');
    }),
    surfaceCase('AgentThread (focus in a surface that stays)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } })
    }), ({ component: thread }) => {
      const item = { id: 's', type: 'surface', document: surfaceDocument() };
      const other = { id: 'o', type: 'text', text: 'Beside it' };
      thread.setItems([item, other]);
      const input = /** @type {HTMLInputElement} */ (thread.el.querySelector('article[data-id="s"] input'));
      const typing = () => {
        input.focus();
        input.value = 'Typing';
        input.setSelectionRange(3, 3);
      };
      const check = (what) => {
        assert(document.activeElement === input, `${what} took the focus from the field: ${document.activeElement?.localName}`);
        assert(input.value === 'Typing' && input.selectionStart === 3, `${what} lost what was typed, or the caret`);
      };
      typing();
      thread.upsert(item);
      check('upsert()');
      thread.patch('s', { at: '2026-11-04T10:00:00' });
      check('patch()');
      thread.setItems([item, other]);
      check('setItems() in the same order');
      thread.setItems([other, item]);
      check('setItems() moving the surface');
      // Focus on the item itself stays where it always went.
      thread.el.querySelector('article[data-id="s"]').focus();
      thread.upsert(item);
      assert(document.activeElement === thread.el.querySelector('article[data-id="s"]'), 'focus on the article was lost');
    }),
    surfaceCase('AgentThread (an item added while setItems runs)', () => ({
      component: new zx.AgentThread(null, { emptyState: { title: 'Nothing yet' } })
    }), ({ component: thread }) => {
      const stays = { id: 'a', type: 'surface', document: surfaceDocument({ surface: 'a' }) };
      thread.setItems([stays, { id: 'b', type: 'surface', document: surfaceDocument({ surface: 'b' }) }]);
      thread.on('reply', () => thread.upsert({ id: 'note', type: 'notice', tone: 'info', text: 'A question was closed' }));
      thread.setItems([stays]);
      const articles = () => [...thread.el.querySelectorAll('.zx-agent-thread__item')];
      assert(articles().map((article) => article.dataset.id).join() === 'a,note', `items: ${articles().map((article) => article.dataset.id)}`);
      assert(articles().every((article) => article.getAttribute('aria-setsize') === '2'), 'the added item is not counted');
      thread.setItems([]);
      assert(articles().length === 0 || articles().every((article) => article.dataset.id === 'note'), 'setItems left an item it knew of');
      thread.remove('note');
      assert(articles().length === 0 && !thread.el.querySelector('.zx-agent-thread__empty').hidden, 'the added item could not be removed');
    }),
    surfaceCase('AgentThread (feed keys inside a control)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } }, items: [
        { id: 's', type: 'surface', document: surfaceDocument({ root: ['form'], nodes: [{ id: 'form', type: 'fields', schema: { type: 'object', properties: {
          note: { type: 'string', title: 'Note', 'x-zx': { field: 'textarea' } },
          pick: { type: 'string', title: 'Pick', 'x-zx': { field: 'zxselect' }, oneOf: [{ const: 'a', title: 'A' }, { const: 'b', title: 'B' }] }
        } } }] }) },
        { id: 'after', type: 'text', text: 'After it' }
      ] }),
      after: () => {}
    }), ({ component: thread }) => {
      const press = (target, init) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
      const area = /** @type {HTMLElement} */ (thread.el.querySelector('article[data-id="s"] textarea'));
      const box = /** @type {HTMLElement} */ (thread.el.querySelector('article[data-id="s"] [role="combobox"]'));
      for (const [target, what] of [[area, 'a text area'], [box, 'a select']]) {
        target.focus();
        for (const init of [{ key: 'PageDown' }, { key: 'PageUp' }, { key: 'End', ctrlKey: true }, { key: 'Home', ctrlKey: true }]) {
          press(target, init);
          assert(document.activeElement === target, `${init.key} left ${what}`);
        }
      }
      // A control that handled the key itself keeps it too, editable or not.
      const handled = zx.h('button', { type: 'button' }, 'Handles keys');
      handled.addEventListener('keydown', (event) => event.preventDefault());
      thread.el.querySelector('article[data-id="s"]').append(handled);
      handled.focus();
      press(handled, { key: 'PageDown' });
      assert(document.activeElement === handled, 'a key the control handled moved the feed');
      handled.remove();
      // On the item itself the feed still moves.
      const article = /** @type {HTMLElement} */ (thread.el.querySelector('article[data-id="s"]'));
      article.focus();
      press(article, { key: 'PageDown' });
      assert(document.activeElement === thread.el.querySelector('article[data-id="after"]'), 'PageDown no longer moves between items');
    }),
    surfaceCase('AgentThread (a turn after an item goes)', () => ({
      component: new zx.AgentThread(null, { authors: { me: { name: 'Me', kind: 'person' }, finance: { name: 'Finance agent' } }, items: [
        { id: 'u', type: 'user', text: 'Hello' },
        { id: 'first', type: 'text', author: 'finance', text: 'One' },
        { id: 'second', type: 'text', author: 'finance', text: 'Two' },
        { id: 'third', type: 'text', author: 'finance', text: 'Three' }
      ] })
    }), ({ component: thread }) => {
      const continued = (id) => thread.el.querySelector(`article[data-id="${id}"]`).dataset.continued === 'true';
      assert(!continued('first') && continued('second') && continued('third'), 'the turn was not drawn as one');
      thread.remove('first');
      assert(!continued('second'), 'the item that now starts the turn kept hiding its byline');
      assert(continued('third'), 'the rest of the turn was broken up');
      // The adapter drops an empty answer once its surface took the whole message.
      const adapter = zx.connectAgUi(thread, { agent: 'finance', inlineSurfaces: true });
      thread.setItems([{ id: 'u', type: 'user', text: 'Hello' }]);
      adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r1' });
      adapter.handle({ type: 'TEXT_MESSAGE_START', messageId: 'm' });
      adapter.handle({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: '```zx-surface\n{"zx":"surface/1","op":"begin","surface":"s1","intent":"show","title":"T","author":"finance","root":[]}\n{"op":"end","surface":"s1"}\n```\n' });
      adapter.handle({ type: 'TEXT_MESSAGE_END', messageId: 'm' });
      adapter.handle({ type: 'RUN_FINISHED', threadId: 't', runId: 'r1' });
      assert(!continued('surface:r1/s1'), 'a surface that opens the turn lost its byline');
      adapter.destroy();
    }),
    surfaceCase('AgentThread (a question is not overtaken)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } })
    }), async ({ component: thread }) => {
      const status = () => thread.el.querySelector('.zx-agent-thread__status').textContent;
      const ask = '```zx-surface\n{"zx":"surface/1","op":"begin","surface":"s1","intent":"confirm","title":"T","author":"finance","root":[]}\n{"op":"end","surface":"s1"}\n```\n';
      const adapter = zx.connectAgUi(thread, { agent: 'finance', inlineSurfaces: true, requiresApproval: () => true });
      adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r1' });
      adapter.handle({ type: 'TEXT_MESSAGE_START', messageId: 'm' });
      adapter.handle({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: `One question:\n${ask}` });
      adapter.handle({ type: 'TEXT_MESSAGE_END', messageId: 'm' });
      adapter.handle({ type: 'RUN_FINISHED', threadId: 't', runId: 'r1' });
      await delay(120);
      assert(status() === 'Finance agent needs your answer', `a finished answer drowned the question: ${status()}`);
      // Nothing is said over an approval either, and the application still has the last word.
      thread.upsert({ id: 'a', type: 'approval', title: 'Send?' });
      thread.upsert({ id: 'b', type: 'answer', blocks: [{ type: 'p', text: 'Done' }] });
      await delay(120);
      assert(status() === 'Finance agent needs your approval', `an answer drowned the approval: ${status()}`);
      thread.upsert({ id: 'c', type: 'approval', title: 'Send more?' });
      thread.announce('Reminders sent');
      await delay(120);
      assert(status() === 'Reminders sent', 'an application’s own announcement was lost');
      thread.upsert({ id: 'd', type: 'answer', blocks: [{ type: 'p', text: 'Later' }] });
      await delay(120);
      assert(status() === 'Finance agent answered', `a question long since said silenced the thread: ${status()}`);
      adapter.destroy();
    }),
    surfaceCase('connectAgUi() (the thread destroyed first)', () => ({}), () => {
      const counts = { alive: 0, drawn: 0, asked: 0 };
      if (!zx.AgentThread.has('smoke-tile')) {
        zx.AgentThread.register('smoke-tile', (item, { own }) => {
          window.__smokeTiles.alive += 1;
          window.__smokeTiles.drawn += 1;
          own(/** @type {any} */ ({ destroy() { window.__smokeTiles.alive -= 1; } }));
          return zx.h('p', {}, 'Tile');
        });
      }
      window.__smokeTiles = counts;
      const thread = new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } });
      const adapter = zx.connectAgUi(thread, {
        agent: 'finance',
        requiresApproval: () => true,
        tools: { draw: () => { counts.asked += 1; return { type: 'smoke-tile' }; } }
      });
      adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r1' });
      adapter.handle({ type: 'TOOL_CALL_START', toolCallId: 'c', toolCallName: 'draw' });
      adapter.handle({ type: 'TOOL_CALL_END', toolCallId: 'c' });
      const { asked } = counts;
      thread.destroy();
      assert(counts.alive === 0, 'destroying the thread left a tile alive');
      adapter.handle({ type: 'TEXT_MESSAGE_START', messageId: 'late' });
      adapter.handle({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'late', delta: 'Too late' });
      adapter.destroy();
      assert(counts.alive === 0, 'the adapter drew a tile into a destroyed thread');
      assert(counts.asked === asked, 'the tile renderer was asked for a thread that is gone');
      assert(thread.el.querySelectorAll('.zx-agent-thread__item').length === 0, 'something was drawn into a destroyed thread');
      thread.upsert({ id: 'x', type: 'text', text: 'Too late' });
      thread.appendText('y', 'Too late');
      assert(thread.el.querySelectorAll('.zx-agent-thread__item').length === 0 && thread.get('x') === null, 'a destroyed thread took new items');
      delete window.__smokeTiles;
    }),
    surfaceCase('connectAgUi() (an application’s own surface renderer)', () => ({}), async () => {
      const { AgentThread } = await import('../../src/components/agent-thread/agent-thread.js?own-surface');
      if (!AgentThread.has('surface')) AgentThread.register('surface', (item) => zx.h('p', { class: 'smoke-own-surface' }, String(item.label)));
      const thread = new AgentThread(null, { authors: { finance: { name: 'Finance agent' } } });
      const results = [];
      const problems = [];
      const adapter = zx.connectAgUi(thread, {
        agent: 'finance',
        inlineSurfaces: true,
        ontoolresult: (id, result) => results.push([id, result]),
        onerror: (problem) => problems.push(problem.code)
      });
      try {
        adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r1' });
        adapter.handle({ type: 'TOOL_CALL_START', toolCallId: 'c', toolCallName: 'ask_user' });
        adapter.handle({ type: 'TOOL_CALL_ARGS', toolCallId: 'c', delta: JSON.stringify(surfaceDocument()) });
        adapter.handle({ type: 'TOOL_CALL_END', toolCallId: 'c' });
        assert(results.length === 1 && results[0][1].error === 'surface-unavailable', `the call hangs: ${JSON.stringify(results)}`);
        assert(problems.join() === 'surface-unavailable', `problems: ${problems}`);
        assert(!thread.el.querySelector('.smoke-own-surface, [data-type="zx-placeholder"]'), 'something stands for a call already answered');
        adapter.handle({ type: 'CUSTOM', name: 'zx.surface', value: { zx: 'surface/1', op: 'begin', surface: 'x', intent: 'confirm', title: 'T', author: 'finance', root: [] } });
        assert(problems.join() === 'surface-unavailable,surface-unavailable', `an operation was dropped silently: ${problems}`);
      } finally {
        adapter.destroy();
        thread.destroy();
      }
    }),
    surfaceCase('connectAgUi() (a settled call stays settled)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } })
    }), async ({ component: thread }) => {
      const results = [];
      const problems = [];
      const adapter = zx.connectAgUi(thread, {
        agent: 'finance',
        requiresApproval: (call) => call.name === 'send',
        ontoolresult: (id, result) => results.push([id, result]),
        onerror: (problem) => problems.push(problem.code)
      });
      const call = (id, name, delta) => {
        adapter.handle({ type: 'TOOL_CALL_START', toolCallId: id, toolCallName: name });
        adapter.handle({ type: 'TOOL_CALL_ARGS', toolCallId: id, delta });
        adapter.handle({ type: 'TOOL_CALL_END', toolCallId: id });
      };
      adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'r1' });
      call('s', 'ask_user', JSON.stringify(surfaceDocument()));
      const surface = thread.surface('surface:r1/s1');
      surface.cancel('cancelled');
      assert(results.length === 1, 'the surface did not answer its call');
      call('s', 'ask_user', ' ');
      assert(results.length === 1, 'the call was answered twice');
      assert(thread.surface('surface:r1/s1') === surface && thread.el.querySelector('article[data-id="surface:r1/s1"] .zx-surface__verdict'), 'the receipt left the thread');
      assert(!thread.el.querySelector('[data-type="zx-placeholder"]'), 'a Skeleton took the receipt’s place');
      call('g', 'send', '{"to":"a"}');
      /** @type {HTMLButtonElement} */ (thread.getComponent('approval:g').toElement().querySelector('[data-action="approve"], .zx-approval-card__approve')
        ?? [...thread.getComponent('approval:g').toElement().querySelectorAll('button')].find((button) => /approve/i.test(button.textContent))).click();
      await delay(0);
      assert(results.length === 2 && results[1][1].approved === true, 'the approval did not answer its call');
      call('g', 'send', ',"also":"b"}');
      assert(results.length === 2, 'a decided call was asked again');
      assert(thread.get('approval:g').status === 'approved', `the decision was undone: ${thread.get('approval:g').status}`);
      assert(problems.filter((code) => code === 'duplicate-start').length === 2, `problems: ${problems}`);
      adapter.destroy();
    }),
    surfaceCase('AgentThread (an application’s own surface and placeholder)', () => ({}), async () => {
      // `register()` has no undo, so this runs on a module instance of its own.
      const { AgentThread } = await import('../../src/components/agent-thread/agent-thread.js?own-surface');
      if (!AgentThread.has('surface')) AgentThread.register('surface', (item) => zx.h('p', { class: 'smoke-own-surface' }, String(item.label)));
      if (!AgentThread.has('placeholder')) AgentThread.register('placeholder', (item) => zx.h('p', { class: 'smoke-own-placeholder' }, String(item.label)));
      const thread = new AgentThread(null, { authors: { finance: { name: 'Finance agent' } }, items: [
        { id: 'p', type: 'placeholder', label: 'Mine too' }
      ] });
      try {
        thread.upsert({ id: 's', type: 'surface', label: 'Mine', document: { zx: 'surface/1', surface: 's', intent: 'confirm', title: 'Go?', root: [], nodes: [] } });
        assert(thread.el.querySelector('.smoke-own-surface')?.textContent === 'Mine', 'the application’s surface renderer lost to the built-in');
        assert(!thread.el.querySelector('.zx-surface') && thread.surface('s') === null, 'the library drew a surface over the application’s renderer');
        assert(thread.el.querySelector('.smoke-own-placeholder')?.textContent === 'Mine too', 'the application’s placeholder type was not drawn');
        await delay(100);
        assert(!thread.el.querySelector('[role="status"]').textContent, 'an application’s surface was announced as waiting');
      } finally {
        thread.destroy();
      }
      // The library’s stand-in has its own name now, and draws a Skeleton for anyone who asks.
      const library = new zx.AgentThread(null, { items: [{ id: 'q', type: 'zx-placeholder', lines: 3 }] });
      assert(library.el.querySelector('article[data-type="zx-placeholder"] .zx-agent-thread__body[aria-busy="true"]'), 'the stand-in did not draw');
      library.destroy();
    }),
    surfaceCase('AgentThread (items at a call’s place)', () => ({
      component: new zx.AgentThread(null, { authors: { finance: { name: 'Finance agent' } } })
    }), async ({ component: thread }) => {
      if (!zx.AgentThread.has('smoke-company')) {
        zx.AgentThread.register('smoke-company', (item) => zx.h('p', { class: 'smoke-company' }, String(item.name ?? '')));
      }
      const replies = [];
      thread.on('reply', (event) => replies.push(event.detail.reply));
      const results = [];
      const adapter = zx.connectAgUi(thread, {
        agent: 'finance',
        tools: { show_company: (call) => (call.status === 'done' ? { type: 'smoke-company', name: JSON.parse(call.result).name } : null) },
        requiresApproval: (call) => call.name === 'send',
        ontoolresult: (id, result) => results.push([id, result])
      });
      const article = (id) => thread.el.querySelector(`article[data-id="${CSS.escape(id)}"]`);
      const ids = () => [...thread.el.querySelectorAll('.zx-agent-thread__item')].map((item) => item.dataset.id);
      const send = (...events) => events.forEach((event) => adapter.handle(event));
      send({ type: 'RUN_STARTED', threadId: 't', runId: 'r1' },
        { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'show_company' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta: '{"id":"helios"}' },
        { type: 'TOOL_CALL_END', toolCallId: 'c1' },
        { type: 'TOOL_CALL_START', toolCallId: 'c2', toolCallName: 'ask_user' },
        { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Looking that up' });
      assert(article('tool:c2')?.dataset.type === 'zx-placeholder' && article('tool:c2').querySelector('[aria-busy="true"] .zx-skeleton, [aria-busy="true"]'),
        'the surface tool did not stand as a placeholder skeleton');
      const answer = article('m1');
      answer.focus();
      await delay(100);
      const status = thread.el.querySelector('.zx-agent-thread__status').textContent;
      assert(status, 'the answer was not announced');
      // The tile's first item arrives after text was drawn below the call's step.
      send({ type: 'TOOL_CALL_RESULT', toolCallId: 'c1', messageId: 'tm1', content: '{"name":"Helios Energie"}' });
      assert(JSON.stringify(ids()) === JSON.stringify(['trace:r1', 'tool:c1', 'tool:c2', 'm1']), `tile not at its call's place: ${ids()}`);
      assert(article('m1') === answer && document.activeElement === answer, 'the streaming answer was redrawn or lost focus');
      assert(thread.el.querySelector('.zx-agent-thread__status').textContent === status, 'inserting the tile re-announced something');
      send({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: ' for you.' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'c2', delta: JSON.stringify({ zx: 'surface/1', surface: 's1', intent: 'confirm', title: 'Go?', author: 'finance', root: [], nodes: [] }) },
        { type: 'TOOL_CALL_END', toolCallId: 'c2' },
        { type: 'TOOL_CALL_START', toolCallId: 'c3', toolCallName: 'send' },
        { type: 'TOOL_CALL_END', toolCallId: 'c3' });
      assert(JSON.stringify(ids()) === JSON.stringify(['trace:r1', 'tool:c1', 'surface:r1/s1', 'm1', 'trace:r1#2', 'approval:c3']), `items: ${ids()}`);
      assert(article('m1') === answer && document.activeElement === answer && answer.textContent.includes('Looking that up for you.'), 'the answer stopped streaming in place');
      assert(replies.length === 0, `the stand-in replied: ${JSON.stringify(replies)}`);
      surfaceButton(article('surface:r1/s1'), 'confirm').click();
      assert(replies.length === 1 && replies[0].token === 'c2', `replies: ${JSON.stringify(replies)}`);
      assert(results.length === 1 && results[0][0] === 'c2', 'the surface reply did not answer its call once');
      // The thread's own insertion: after a known id, or at the end.
      thread.upsert({ id: 'x', type: 'notice', text: 'Inserted' }, { after: 'trace:r1' });
      thread.upsert({ id: 'y', type: 'notice', text: 'End' }, { after: 'missing' });
      assert(ids()[1] === 'x' && ids().at(-1) === 'y', `upsert after: ${ids()}`);
      assert(article('x').getAttribute('aria-posinset') === '2', 'positions were not renumbered');
      adapter.destroy();
    })
  ];
}
