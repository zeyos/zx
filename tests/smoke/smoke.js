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
  componentCase('AppIcon', () => new zx.AppIcon(null, {
    icon: 'file', color: '#535494', label: 'Billing', badge: 3, glass: 'strong'
  }), (component) => {
    assert(component.el.getAttribute('role') === 'img', 'labelled AppIcon has no image role');
    assert(component.el.dataset.glass === 'strong', 'AppIcon material did not render');
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
    const element = zeyos.zeyosAppIcon('billing', { color: 'url(https://example.invalid/module)' });
    return { element, exercise: () => {
      const color = element.style.getPropertyValue('--zx-module-color');
      assert(/^#[\da-f]{6}$/i.test(color) && !color.includes('url('), 'ZeyOS AppIcon retained an unsafe color override');
      assert(element.style.getPropertyValue('--zx-app-icon-glyph') === 'var(--zx-color-app-icon-glyph)',
        'ZeyOS AppIcon did not use the stable white glyph token');
      const rootRect = element.getBoundingClientRect();
      const glyphRect = element.querySelector('.zx-app-icon__glyph').getBoundingClientRect();
      const deltaX = Math.abs((rootRect.left + rootRect.width / 2) - (glyphRect.left + glyphRect.width / 2));
      const deltaY = Math.abs((rootRect.top + rootRect.height / 2) - (glyphRect.top + glyphRect.height / 2));
      assert(deltaX < 0.6 && deltaY < 0.6, `ZeyOS AppIcon glyph is off-centre by ${deltaX}, ${deltaY}`);
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
    assert(!component.el.matches(':modal'), 'non-modal sheet entered the top layer');
    assert(component.el.dataset.modality === 'none', 'modality attribute missing');
    assert(!component.isModal(), 'isModal() disagreed with the option');
    component.close();
  }),
  sheetStackCase(),
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
    assert(indicator.children.length === 5, 'priority indicator does not contain five squares');
    assert(indicator.querySelectorAll('[data-filled="true"]').length === 3,
      'priority level did not fill the expected number of squares');
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
      views.expect();
      assert(component.el.querySelectorAll('.zx-calendar__view-button').length === 5,
        'Calendar omitted a configured view control');
      assert(component.el.querySelector('.zx-calendar__now:not([hidden])'),
        'Calendar did not render the deterministic now indicator');

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
      const sheet = new zx.Sheet(null, { title: 'Detail', content: 'Body', side: 'end', size: 200 });
      return { dock, sheet, stage };
    },
    exercise({ dock, sheet }) {
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
      assert(sheet.el.parentElement === document.body, 'released sheet did not return to the body');
      assert(sheet.isOpen(), 'release closed the sheet');
      assert(closes === 0, 'the re-hosting handoff emitted a close event');

      dock.adopt(sheet, { side: 'end', size: 200 });
      dock.destroy();
      assert(!sheet.isDocked(), 'destroying the dock did not release the sheet');
      assert(sheet.isOpen(), 'destroying the dock closed a sheet it did not own');
      sheet.close();
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
