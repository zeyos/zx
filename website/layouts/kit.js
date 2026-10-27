/*
 * Shared scaffolding for the application layouts.
 *
 * Every layout composes Zx components; this module only holds the few pieces of markup and wiring
 * that all of them repeat, so that the nine applications share one shell, one header height, one
 * property list, and one keyboard convention instead of nine near-identical copies. Its classes
 * are styled by `kit.css`.
 *
 * A layout module is `{title, category, blurb, components, mount(container, context)}`, where
 * `context` is `{preview, signal, cleanup, open, id}` — see `layoutContext()`. Every layout with a
 * navigation column builds it with `suiteNav()`: the suite's modules (`SUITE_MODULES` in
 * `fixtures.js`) beside the layout's own menu.
 */
import './layout-icons.js';
import {
  AccountMenu, AppSidebar, Component, Dialog, Message, WorkspaceSwitcher, emptyState, formatDate, h, icon, prefersReducedMotion, storage
} from '../../src/index.js';
import { ME, NOW, ORGANISATION, SUITE_MODULES, person } from './fixtures.js';

/**
 * @typedef {Object} LayoutContext
 * @property {boolean} preview True when the layout is rendered as a gallery thumbnail: show the
 *   first state only — no timers, no global shortcuts, no launchers, no toasts.
 * @property {AbortSignal} signal Aborted when the layout is unmounted. Pass it to any listener
 *   added outside the layout's own root.
 * @property {(fn: () => void) => void} cleanup Registers teardown that runs on unmount.
 * @property {((id: string) => void)|null} open Opens another layout of the suite by its registry
 *   id, where the host can (the gallery swaps the open layout, the standalone page its hash).
 * @property {string|null} id The mounted layout's registry id, where the host knows it.
 */

/**
 * Fills in a context for a layout mounted without one, so a module can always rely on its shape.
 * @param {Partial<LayoutContext>} [context]
 * @returns {LayoutContext}
 */
function layoutContext(context = {}) {
  return {
    preview: Boolean(context.preview),
    signal: context.signal ?? new AbortController().signal,
    cleanup: typeof context.cleanup === 'function' ? context.cleanup : () => {},
    open: typeof context.open === 'function' ? context.open : null,
    id: typeof context.id === 'string' ? context.id : null
  };
}

/**
 * Returns a function that registers a component for destruction on unmount and hands it back, so
 * creation and teardown stay on one line: `const table = keep(new Table(null, {...}))`.
 * @param {LayoutContext} context
 * @returns {<T extends {destroy: () => void}>(component: T) => T}
 */
function disposer(context) {
  return (component) => {
    context.cleanup(() => component.destroy());
    return component;
  };
}

/**
 * Ownership for a region that is redrawn: components created for one rendering are destroyed by
 * the next `reset()`, and whatever is left when the layout unmounts.
 *
 *     const detail = renderScope(context);
 *     function showDetail(item) {
 *       detail.reset();
 *       pane.replaceChildren(detail.own(new Select(null, {...})).toElement());
 *     }
 * @param {LayoutContext} context
 * @returns {{own: <T extends {destroy: () => void}>(component: T) => T, reset: () => void}}
 */
function renderScope(context) {
  const owned = [];
  const reset = () => {
    for (const component of owned.splice(0)) component.destroy();
  };
  context.cleanup(reset);
  return {
    own(component) {
      owned.push(component);
      return component;
    },
    reset
  };
}

/**
 * Confirms a completed action with a toast — and stays silent in a gallery thumbnail.
 * @param {LayoutContext} context
 * @param {string|Node} message
 * @param {'success'|'info'|'warning'|'error'} [kind]
 * @param {Record<string, any>} [options] Passed to `Message.show()`, e.g. `{ scope: root }`.
 * @returns {unknown} The toast, or null in preview mode.
 */
function toast(context, message, kind = 'success', options = {}) {
  if (context.preview) return null;
  return Message.show(message, { ...options, kind });
}

/**
 * A layout's own toast function: `toast()` bound to the context and to the layout's root, so every
 * toast appears in the layout's theme scope.
 *
 *     const notify = toaster(context, root);
 *     notify('Saved.');
 * @param {LayoutContext} context
 * @param {HTMLElement} root The layout root.
 * @returns {(message: string|Node, kind?: 'success'|'info'|'warning'|'error',
 *   options?: Record<string, any>) => unknown}
 */
function toaster(context, root) {
  return (message, kind = 'success', options = {}) => toast(context, message, kind, { scope: root, ...options });
}

/**
 * Runs `fn` after a delay unless the layout unmounts first.
 * @param {LayoutContext} context
 * @param {() => void} fn
 * @param {number} ms
 * @returns {() => void} Cancels the call.
 */
function later(context, fn, ms) {
  const timer = setTimeout(fn, ms);
  const cancel = () => clearTimeout(timer);
  context.cleanup(cancel);
  return cancel;
}

/**
 * The one sentence every layout uses for a control whose screen is not built here.
 * @param {string} label What the control would open.
 * @returns {string}
 */
function unavailable(label) {
  return `${label} isn’t part of this example.`;
}

/**
 * The pane shown for a destination that is not built here.
 * @param {string} title The destination's name.
 * @param {{label: string, onclick: () => void}} [back] The way back to a built screen.
 * @returns {HTMLElement}
 */
function unavailablePane(title, back) {
  return emptyState({
    icon: 'layer-group',
    title,
    description: 'This screen isn’t part of this example.',
    actions: back ? [{ label: back.label, onclick: back.onclick }] : []
  });
}

/**
 * The standard header bar at the top of a pane: an optional leading slot, a title, and actions.
 * Every pane in every layout uses this, so their heights and paddings line up across columns.
 * `size: 'page'` sets the title of a whole page — a dashboard, a collection — a step larger than
 * the cards beneath it.
 * @param {{title?: string|Node, level?: 2|3, size?: 'pane'|'page', leading?: Node|Node[],
 *   actions?: Node|Node[], className?: string}} options
 * @returns {HTMLElement}
 */
function paneHeader({ title, level = 2, size = 'pane', leading, actions, className = '' } = {}) {
  const titleClass = size === 'page' ? 'shell__title shell__title--page' : 'shell__title';
  return h('header', { class: `shell__header ${className}`.trim() },
    leading ? h('div', { class: 'shell__header-leading' }, leading) : null,
    title !== undefined ? h(`h${level}`, { class: titleClass }, title) : null,
    h('div', { class: 'shell__header-actions' }, actions ?? null));
}

/**
 * A small tinted square holding an icon — the kind of thing a row or card is, readable before its
 * name. Tones are categorical (`blue`, `teal`, `green`, `amber`, `orange`, `red`, `pink`, `violet`,
 * `slate`), never status.
 * @param {string} name Icon name.
 * @param {string} [tone='slate']
 * @param {{size?: 'md'|'lg'}} [options]
 * @returns {HTMLElement}
 */
function iconTile(name, tone = 'slate', { size = 'md' } = {}) {
  return h('span', {
    class: 'icon-tile',
    'aria-hidden': 'true',
    dataset: { tone, size: size === 'lg' ? 'lg' : null }
  }, icon(name, { size: size === 'lg' ? 18 : 14 }));
}

/**
 * The header of every navigation column: the workspace's mark and name, and optional actions.
 * @param {{actions?: Node|Node[]}} [options]
 * @returns {HTMLElement}
 */
function workspaceHeader({ actions } = {}) {
  return paneHeader({
    leading: h('span', { class: 'workspace' },
      h('span', { class: 'workspace__mark', 'aria-hidden': 'true' }, ORGANISATION.name[0]),
      h('span', { class: 'workspace__name' }, ORGANISATION.name)),
    actions
  });
}

/**
 * @typedef {Object} SuiteNavOptions
 * @property {string} module This layout's module in `SUITE_MODULES`.
 * @property {Record<string, any>[]} [menu=[]] The module's menu: AppSidebar items, sections included.
 *   Ids share one tree with the suite's modules and their menus, so they must not reuse a
 *   `SUITE_MODULES` id (`billing`) or a catalogue entry id (`crm:companies`).
 * @property {string|number|null} [active=null] The current destination.
 * @property {Array<string|number>} [expanded=[]] Branches of the menu open from the start.
 * @property {Node|null} [header=null] Above the menu: the module's primary action.
 * @property {Node|null} [content=null] Under the menu: a tree, a history, anything the module lists.
 * @property {() => void} [onsearch] Shows a search button on the strip that calls it (the launcher).
 * @property {(event: CustomEvent) => void} [onselect] A choice in this layout's own menu.
 * @property {Record<string, any>} [account] AccountMenu options merged over the signed-in user's defaults.
 * @property {Record<string, any>|null} [workspace=null] WorkspaceSwitcher options. Given, the switcher
 *   takes the brand's place at the head of the strip: the current workspace's tile, name and plan
 *   while the modules are named, the tile alone on the icon strip. Its menu lists the workspaces
 *   the user belongs to and, after them, the workspace-level actions.
 * @property {'tint'|'solid'|'plain'} [appearance='tint'] The module tiles.
 */
/**
 * @typedef {Object} SuiteNav
 * @property {HTMLElement} column The `.shell__nav` column, for the layout's root.
 * @property {AppSidebar} sidebar The navigation itself.
 * @property {AccountMenu} account The signed-in user's menu at the foot of the strip.
 * @property {WorkspaceSwitcher|null} workspace The switcher at the head of the strip, when asked for.
 * @property {(menu: Record<string, any>[]) => void} setMenu Replaces this layout's menu.
 * @property {(id: string|number|null) => void} setActive Marks the current destination.
 * @property {(id: string|number, badge: string|number|null) => void} setBadge Updates a count in place.
 */

/**
 * The navigation column of every layout in the suite: one AppSidebar in the modules layout, the
 * ACME modules on a strip beside a panel with this layout's own menu. Choosing a destination
 * in another module opens that module's layout where the host can, and says it is not part of this
 * example where it cannot.
 * @param {LayoutContext} context
 * @param {SuiteNavOptions} options
 * @returns {SuiteNav}
 */
function suiteNav(context, {
  module, menu = [], active = null, expanded = [], header = null, content = null, onsearch, onselect,
  account = {}, workspace = null, appearance = 'tint'
}) {
  const keep = disposer(context);
  let own = menu;
  // One tree holds every module and menu: an id used twice would answer for the wrong row.
  const taken = new Set(SUITE_MODULES.flatMap((entry) => [entry.id, ...(entry.menu ?? []).map((item) => item.id)]));
  const clashes = [...menuIds(menu)].filter((id) => taken.has(id));
  if (clashes.length) console.warn(`suiteNav(): menu ids ${clashes.join(', ')} are already used by the suite's modules.`);
  const moduleItem = (entry) => {
    const base = { id: entry.id, label: entry.label, icon: entry.icon, tone: entry.tone ?? undefined, layout: entry.layout };
    if (entry.id === module) {
      // The module's other screens follow its own menu, so sibling layouts reach each other.
      const others = (entry.menu ?? []).filter((item) => item.layout !== context.id);
      const children = others.length
        ? [...own, { section: true, label: `More in ${entry.label}`, children: others.map((item) => ({ ...item })) }]
        : own;
      return { ...base, children, header, content };
    }
    return entry.menu ? { ...base, children: entry.menu.map((item) => ({ ...item })) } : base;
  };
  // Modules that share a heading become one section of the module menu.
  const items = () => SUITE_MODULES.reduce((tree, entry) => {
    const last = tree.at(-1);
    if (!entry.section) tree.push(moduleItem(entry));
    else if (last?.section && last.label === entry.section) last.children.push(moduleItem(entry));
    else tree.push({ section: true, label: entry.section, children: [moduleItem(entry)] });
    return tree;
  }, []);
  const me = person(ME);
  // The account shows the name and role while the module menu is expanded, the avatar alone
  // whenever the strip is icons.
  const accountMenu = keep(new AccountMenu(null, {
    compact: false,
    account: { name: me.name, secondary: me.role, status: 'online', statusLabel: 'Online' },
    items: [{ label: 'Profile', value: 'profile', icon: 'user' }, { label: 'Settings', value: 'settings', icon: 'gear' }, '-', { label: 'Sign out', value: 'signout' }],
    placement: 'top-start',
    onselect: ({ detail }) => toast(context, unavailable(detail.item.label), 'info', { scope: column }),
    ...account
  }));
  const accountItems = account.items ?? [{ label: 'Profile', value: 'profile', icon: 'user' },
    { label: 'Settings', value: 'settings', icon: 'gear' }, '-', { label: 'Sign out', value: 'signout' }];
  const searchButton = onsearch ? iconButton('magnifying-glass', 'Search', () => onsearch(),
    { shortcut: modShortcut('k') }) : null;
  // The head of the strip is the brand, or — in an application where the user belongs to several
  // workspaces — the switcher between them, which stands for the brand of the one that is open.
  const switcher = workspace ? keep(new WorkspaceSwitcher(null, {
    placement: 'bottom-start',
    // Cancelled, so the trigger keeps naming the workspace that is open: the example has one.
    onselect: (event) => {
      event.preventDefault();
      toast(context, unavailable(`Switching to ${event.detail.workspace.label}`), 'info', { scope: column });
    },
    onaction: ({ detail }) => toast(context, unavailable(detail.item.label), 'info', { scope: column }),
    ...workspace
  })) : null;
  const stripHeader = switcher
    ? h('div', { class: 'suite-strip', dataset: { workspace: '' } }, switcher.toElement(), searchButton)
    : suiteStrip(searchButton);
  const sidebar = keep(new AppSidebar(null, {
    layout: 'modules',
    label: ORGANISATION.name,
    items: items(),
    active,
    expanded,
    // The panel opens on this layout's module even before anything in its menu is current.
    module,
    moduleBar: { appearance, label: `${ORGANISATION.name} modules` },
    railHeader: stripHeader,
    railFooter: accountMenu,
    // The layout and the theme are chosen in the account menu, so the strip carries no switch.
    presentationSwitch: false,
    onselect: (event) => {
      const { item } = event.detail;
      // This layout's own menu is routed by the layout; everything else belongs to another module.
      if (menuIds(own).has(String(item.id))) {
        onselect?.(event);
        return;
      }
      const owner = SUITE_MODULES.find((entry) => entry.id === item.id)
        ?? SUITE_MODULES.find((entry) => entry.menu?.some((child) => child.id === item.id));
      if (!owner || (owner.id === module && !item.layout)) {
        onselect?.(event);
        return;
      }
      event.preventDefault();
      const target = item.layout ?? owner.layout;
      if (context.preview) return;
      if (context.open) context.open(target);
      else toast(context, unavailable(item.label), 'info', { scope: column });
    }
  }));
  const column = h('div', { class: 'shell__nav', dataset: { nav: 'modules' } }, sidebar.toElement());
  const syncAccount = () => {
    const compact = sidebar.getPresentation() !== 'expanded';
    accountMenu.setCompact(compact);
    switcher?.setCompact(compact);
  };
  sidebar.on('presentationchange', syncAccount);
  syncAccount();
  accountChoices(context, sidebar, accountMenu, accountItems);
  return {
    column,
    sidebar,
    account: accountMenu,
    workspace: switcher,
    setMenu(next) {
      own = next;
      sidebar.setItems(items());
    },
    setActive: (id) => sidebar.setActive(id),
    setBadge: (id, badge) => sidebar.setBadge(id, badge)
  };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The Zx mark: the two letters in the text colour and the bolt in the accent, so it reads on
 * either theme and under every accent preset. Decorative; the workspace name beside it is the text.
 * @returns {SVGSVGElement}
 */
function zxMark() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 426.76 331.91');
  svg.setAttribute('class', 'zx-mark');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const shape = (tag, attribute, value, className) => {
    const node = document.createElementNS(SVG_NS, tag);
    node.setAttribute(attribute, value);
    node.setAttribute('class', className);
    svg.append(node);
  };
  shape('path', 'd', 'M149.95,232.87l-149.95-.15,82.03-68.92,33.19-27.84-88.92-.11,35.67-28.19c5.91-3.79,11.94-6.03,19.27-5.45l137.05.2-116.69,96.68,67.7.36-19.35,33.42Z', 'zx-mark__letter');
  shape('polygon', 'points', '282.98 231.85 220.75 231.9 288.06 170.11 257.13 136.37 277.09 107.76 292.13 107.69 320.83 139.62 360.32 102.24 426.76 102.36 349.66 170.41 407.03 231.86 343.39 231.98 315.67 201.3 282.98 231.85', 'zx-mark__letter');
  shape('polygon', 'points', '110.11 331.91 138.48 282.05 192.53 187.41 147.47 187.01 246.06 91.71 340.22 0 223.79 161.57 263.51 164.04 154.14 282.69 110.11 331.91', 'zx-mark__bolt');
  return svg;
}

/**
 * The head of the module strip: the Zx mark, the workspace name — printed only while the strip
 * prints module names — and trailing controls such as the search button.
 * @param {...(Node|null)} actions
 * @returns {HTMLElement}
 */
function suiteStrip(...actions) {
  return h('div', { class: 'suite-strip' },
    h('span', { class: 'suite-strip__brand', title: ORGANISATION.name },
      zxMark(), h('span', { class: 'suite-strip__name' }, ORGANISATION.name)),
    actions.filter(Boolean));
}

/** The site's theme setting: what `site.js` keeps, or the document's own attribute without it. */
function themeSetting() {
  return globalThis.zxTheme?.get?.().theme ?? document.documentElement.dataset.zxTheme ?? 'auto';
}

/**
 * Puts the navigation layout and the theme at the top of an account menu, each a three-way choice,
 * ahead of the menu's own items, and keeps both in step with changes made elsewhere — Mod+B, the
 * site's theme toggle. Choosing a layout closes the menu, since the strip it sits on re-renders;
 * choosing a theme leaves it open, so the change shows.
 * @param {LayoutContext} context
 * @param {AppSidebar} sidebar A modules-layout sidebar.
 * @param {AccountMenu} accountMenu
 * @param {any[]} items The account's own items.
 * @returns {void}
 */
function accountChoices(context, sidebar, accountMenu, items) {
  const entries = () => [
    {
      ...sidebar.presentationChoice({ label: 'Layout' }),
      onselect: (value, entry, controller) => {
        controller.close();
        sidebar.setPresentation(value);
      }
    },
    {
      type: 'choice',
      label: 'Theme',
      value: themeSetting(),
      options: [
        { value: 'light', label: 'Light', icon: 'sun' },
        { value: 'dark', label: 'Dark', icon: 'moon' },
        { value: 'auto', label: 'System', icon: 'circle-half-stroke' }
      ],
      onselect: (value) => {
        if (globalThis.zxTheme?.set) globalThis.zxTheme.set({ theme: value });
        else document.documentElement.dataset.zxTheme = String(value);
      }
    },
    '-',
    ...items
  ];
  // An open menu has already drawn its own change; anything else redraws it.
  const refresh = () => {
    if (!accountMenu.isOpen()) accountMenu.setItems(entries());
  };
  refresh();
  sidebar.on('presentationchange', refresh);
  accountMenu.on('close', refresh);
  document.addEventListener('zx-theme-change', refresh, { signal: context.signal });
}

/**
 * Every id in a menu tree, sections' children included.
 * @param {Record<string, any>[]} items
 * @returns {Set<string>}
 */
function menuIds(items) {
  const ids = new Set();
  const walk = (list) => {
    for (const item of list ?? []) {
      if (item?.id != null) ids.add(String(item.id));
      walk(item?.children);
    }
  };
  walk(items);
  return ids;
}

/**
 * A titled block inside an inspector or a record body.
 * @param {string} title
 * @param {...(Node|string|null|undefined|Array<Node|string|null|undefined>)} children
 * @returns {HTMLElement}
 */
function panelBlock(title, ...children) {
  return h('section', { class: 'panel-block' }, h('h3', { class: 'panel-block__title' }, title), children);
}

/**
 * A small upper-case label above a group of navigation items, properties, or cards.
 * @param {string} text
 * @param {Node|Node[]} [actions] Trailing controls, such as an add button.
 * @returns {HTMLElement}
 */
function sectionLabel(text, actions) {
  return h('div', { class: 'section-label' },
    h('span', { class: 'section-label__text' }, text),
    actions ? h('span', { class: 'section-label__actions' }, actions) : null);
}

/**
 * A key or key chord as it appears in hints and tooltips.
 * @param {...string} keys `kbd('⌘', 'K')` renders two caps.
 * @returns {HTMLElement}
 */
function kbd(...keys) {
  return h('span', { class: 'kbd-group' }, keys.map((key) => h('kbd', { class: 'kbd' }, key)));
}

/**
 * A coloured status dot. Pair it with visible text; the dot alone carries no accessible meaning.
 * @param {'success'|'warning'|'danger'|'info'|'accent'|'neutral'} [tone]
 * @returns {HTMLElement}
 */
function dot(tone = 'neutral') {
  return h('span', { class: 'dot', 'data-tone': tone, 'aria-hidden': 'true' });
}

/**
 * A two-column list of labelled properties — the details column of a record.
 * @param {Array<[string, Node|string|number|null|undefined]>} rows Label and value pairs.
 * @returns {HTMLDListElement}
 */
function propList(rows) {
  // Editable values read as data until they are pointed at: the quiet field style shows a
  // control's frame only on hover and focus.
  return h('dl', { class: 'prop-list', 'data-zx-fields': 'quiet' }, rows.flatMap(([label, value]) => [
    h('dt', { class: 'prop-list__label' }, label),
    h('dd', { class: 'prop-list__value' }, value ?? h('span', { class: 'meta' }, '—'))
  ]));
}

/**
 * An icon-only ghost button with an accessible name, for pane headers and row actions. A shortcut
 * is shown in the native tooltip and exposed with `aria-keyshortcuts`, as Zx `button()` does; it
 * never becomes part of the accessible name.
 * @param {string} name Icon name.
 * @param {string} label Accessible name, also shown as the native tooltip.
 * @param {(event: MouseEvent) => void} [onclick]
 * @param {{shortcut?: {label: string, keys: string}}} [options]
 * @returns {HTMLButtonElement}
 */
function iconButton(name, label, onclick, { shortcut } = {}) {
  return h('button', {
    type: 'button',
    class: 'zx-icon-btn',
    'aria-label': label,
    'aria-keyshortcuts': shortcut?.keys,
    title: shortcut ? `${label} (${shortcut.label})` : label,
    onclick
  }, icon(name));
}

/** @returns {boolean} Whether the platform's command modifier is Cmd rather than Ctrl. */
function isMac() {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/**
 * The label of the `Mod+` modifier in key hints: `kbd(modifierLabel(), 'K')`.
 * @returns {string}
 */
function modifierLabel() {
  return isMac() ? '⌘' : 'Ctrl';
}

/**
 * A `Mod+` shortcut in the shape Zx `button({ shortcut })` and `iconButton()` take:
 * `modShortcut('Enter', '↵')` is `{ label: '⌘↵', keys: 'Meta+Enter' }` on macOS and
 * `{ label: 'Ctrl+↵', keys: 'Control+Enter' }` elsewhere.
 * @param {string} key The key as `aria-keyshortcuts` names it.
 * @param {string} [glyph] What the hint shows; the upper-cased key by default.
 * @returns {{label: string, keys: string}}
 */
function modShortcut(key, glyph = key.toUpperCase()) {
  const name = key.length === 1 ? key.toUpperCase() : key;
  return isMac()
    ? { label: `⌘${glyph}`, keys: `Meta+${name}` }
    : { label: `Ctrl+${glyph}`, keys: `Control+${name}` };
}

/**
 * Binds single-key and modifier shortcuts to a layout's root rather than to the document, so two
 * layouts on one page — a thumbnail and the open one — never answer the same key.
 *
 * Keys are matched on `event.key`; `Mod+` means Cmd on macOS and Ctrl elsewhere. Unmodified keys
 * are ignored while the focus is in a text field, so typing a "j" into a reply never moves the
 * selection. A handler that returns `false` declines the key — "Escape when there is nothing to go
 * back from" — and leaves it to whatever contains the layout. Does nothing in preview mode.
 *
 * A key with a space is a sequence: `'g h'` runs on G then H within a second and a half. The first
 * key of a sequence starts it and does nothing on its own, so a layout does not bind it alone.
 * @param {HTMLElement} root The layout's root element.
 * @param {Record<string, (event: KeyboardEvent) => boolean|void>} map
 *   `{ j: next, 'Mod+k': openLauncher, 'g h': goHome }`.
 * @param {LayoutContext} context
 * @returns {void}
 */
function shortcuts(root, map, context) {
  if (context.preview) return;
  // Clicking plain content moves focus to the nearest focusable ancestor — the root, once it can
  // take focus — instead of dropping it to <body>, where the keys would no longer reach it. A
  // natively focusable target (a text area) keeps its place in the tab order.
  if (!root.hasAttribute('tabindex') && root.tabIndex < 0) root.tabIndex = -1;
  const mac = isMac();
  const starts = new Set(Object.keys(map).filter((name) => name.includes(' ')).map((name) => name.split(' ')[0]));
  /** @type {string|null} The first key of a sequence in progress. */
  let pending = null;
  let expiry = 0;
  root.addEventListener('keydown', (event) => {
    const mod = mac ? event.metaKey : event.ctrlKey;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const plain = !mod && !event.altKey && !event.ctrlKey && !event.metaKey && key.length === 1
      && !isEditable(event.target)
      && !(event.target instanceof Element && event.target.closest('[role="tree"], [role="menu"], [role="menubar"]'));
    if (plain && pending && Date.now() < expiry) {
      const sequence = map[`${pending} ${key}`];
      pending = null;
      if (sequence && !event.defaultPrevented) {
        if (sequence(event) !== false) event.preventDefault();
        return;
      }
    } else if (plain && starts.has(key) && !event.defaultPrevented) {
      pending = key;
      expiry = Date.now() + 1500;
      event.preventDefault();
      return;
    }
    if (key !== 'Shift') pending = null;
    const chord = `${mod ? 'Mod+' : ''}${event.shiftKey && event.key.length > 1 ? 'Shift+' : ''}${key}`;
    const handler = map[chord] ?? (event.shiftKey && key.length === 1 ? map[event.key] : undefined);
    if (!handler || event.defaultPrevented) return;
    if (!mod && isEditable(event.target)) return;
    // Trees and menus search by typed letters; a single key there belongs to them.
    if (!mod && key.length === 1 && event.target instanceof Element
      && event.target.closest('[role="tree"], [role="menu"], [role="menubar"]')) return;
    if (event.altKey || (!mod && (event.metaKey || event.ctrlKey))) return;
    if (handler(event) === false) return;
    event.preventDefault();
  }, { signal: context.signal });
}

/**
 * The keyboard reference a layout opens with `?`: its shortcuts in groups, each key as a key cap.
 * In a key string `+` joins a chord and a space a sequence (`'Mod+K'`, `'G H'`); `Mod` reads ⌘ on
 * macOS and Ctrl elsewhere. Does nothing in preview mode.
 * @param {LayoutContext} context
 * @param {Array<[string, Array<[string, string]>]>} groups
 *   `[['Navigate', [['Go to home', 'G H'], ['Search', 'Mod+K']]]]`.
 * @param {{title?: string, onclose?: () => void}} [options]
 * @returns {() => void} Opens the reference.
 */
function shortcutSheet(context, groups, { title = 'Keyboard shortcuts', onclose } = {}) {
  /** @type {Dialog|null} */
  let dialog = null;
  const caps = (keys) => {
    const steps = keys.split(' ').map((step) => kbd(...step.split('+').map((name) => (name === 'Mod' ? modifierLabel() : name))));
    return steps.flatMap((step, index) => (index ? [h('span', { class: 'shortcut-sheet__then' }, 'then'), step] : [step]));
  };
  return () => {
    if (context.preview) return;
    dialog ??= disposer(context)(new Dialog(null, {
      title, size: 'lg',
      content: h('div', { class: 'shortcut-sheet' }, groups.map(([group, entries]) => h('section', {},
        h('h3', { class: 'shortcut-sheet__group' }, group),
        h('dl', { class: 'shortcut-sheet__list' }, entries.flatMap(([label, keys]) => [
          h('dt', {}, label),
          h('dd', {}, caps(keys))
        ]))))),
      buttons: [{ label: 'Close', action: 'close', autofocus: true }],
      onclose
    }));
    dialog.open();
  };
}

/**
 * @param {EventTarget|null} target
 * @returns {boolean} Whether keystrokes there are text input.
 */
function isEditable(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'].includes(target.type);
}

/** Where the Chart.js engine is loaded from; the site build maps it to its `vendor/` copy. */
const chartJs = { url: '', promise: /** @type {Promise<any> | null} */ (null) };
chartJs.url = new URL('../../node_modules/chart.js/dist/chart.umd.js', import.meta.url).href;

/**
 * Loads the Chart.js engine the Chart adapter needs, once per page. Zx itself never bundles it.
 * @returns {Promise<any>} The global Chart constructor.
 */
function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartJs.promise) return chartJs.promise;
  chartJs.promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chartJs.url;
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error('Chart.js could not be loaded.'));
    document.head.append(script);
  });
  return chartJs.promise;
}

/**
 * The date and time formats every layout uses, for `formatDate()`.
 * @type {Readonly<Record<'short'|'year'|'long'|'dateTime'|'time'|'day', string>>}
 */
const DATE = Object.freeze({
  short: '%e %b',
  year: '%e %b %Y',
  long: '%e %B %Y',
  dateTime: '%a %e %b, %H:%M',
  time: '%H:%M',
  day: '%A %e %B'
});

/**
 * When something happened, as a list row says it: the time today, "Yesterday", the weekday within
 * a week, then the date.
 * @param {Date|string|number} value
 * @returns {string}
 */
function listTime(value) {
  const date = new Date(value);
  const startOfToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  const days = Math.floor((startOfToday.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
  if (days <= 0) return formatDate(date, DATE.time);
  if (days === 1) return 'Yesterday';
  if (days < 7) return formatDate(date, '%a');
  return formatDate(date, date.getFullYear() === NOW.getFullYear() ? DATE.short : DATE.year);
}

/**
 * Whether the layout may animate: never in a thumbnail, never against a reduced-motion preference —
 * the system's, or the reader's own (`data-zx-motion="reduced"` on the layout or above it).
 * @param {LayoutContext} context
 * @param {Element} [element] The layout's root, or an element inside it.
 * @returns {boolean}
 */
function allowsMotion(context, element) {
  return !context.preview && !prefersReducedMotion(element);
}

/**
 * Reads the semantic colours a chart draws with. A canvas cannot resolve CSS custom properties, so
 * each token is resolved inside the layout (which carries the active theme) and normalised to an
 * `rgba()` string the chart engine can parse and fade.
 * @param {HTMLElement} root The layout root.
 * @returns {Record<'text'|'muted'|'border'|'subtle'|'surface'|'accent'|'success'|'info'|'warning'|'danger'|'neutral', string>
 *   & {series: string[], font: {family: string, size: number}}}
 */
function chartPalette(root) {
  const probe = root.appendChild(h('span', { hidden: true }));
  const canvas = h('canvas', { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const read = (token) => {
    probe.style.color = `var(--zx-color-${token})`;
    canvas.clearRect(0, 0, 1, 1);
    canvas.fillStyle = getComputedStyle(probe).color;
    canvas.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  };
  const style = getComputedStyle(root);
  const palette = {
    text: read('text'), muted: read('text-muted'), border: read('border'), surface: read('bg-raised'),
    subtle: read('border-subtle'),
    accent: read('accent'), success: read('success'), info: read('info'), warning: read('warning'),
    danger: read('danger'), neutral: read('border-strong'),
    // The categorical series, in order: the first is deliberately not the brand accent.
    series: Array.from({ length: 8 }, (_, index) => read(`chart-${index + 1}`)),
    font: {
      family: style.getPropertyValue('--zx-font-sans').trim(),
      size: parseFloat(style.getPropertyValue('--zx-text-xs')) || 12
    }
  };
  probe.remove();
  return palette;
}

/**
 * Chart.js options every layout chart shares: themed tooltips, no legend (the layouts draw their
 * own), and motion only where it is allowed.
 * @param {ReturnType<typeof chartPalette>} palette
 * @param {boolean} animate
 * @returns {Record<string, any>}
 */
function chartOptions(palette, animate) {
  const { font } = palette;
  return {
    animation: animate ? { duration: 280 } : false,
    // Thin lines, no resting points: the shape of the data, not the markers, carries the chart.
    elements: {
      line: { borderWidth: 1.5, tension: 0.3, cubicInterpolationMode: 'monotone' },
      point: { radius: 0, hoverRadius: 3, hitRadius: 8 },
      arc: { borderWidth: 0 },
      bar: { borderRadius: 2 }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: palette.text, titleColor: palette.surface, bodyColor: palette.surface,
        titleFont: { ...font, weight: '600' }, bodyFont: font, padding: 8, cornerRadius: 6, boxPadding: 4
      }
    }
  };
}

/**
 * Axes for a cartesian chart: no vertical gridlines, quiet horizontal ones, muted ticks, and the
 * unit said once in the axis title rather than on every tick.
 * @param {ReturnType<typeof chartPalette>} palette
 * @param {{unit?: string}} [options]
 * @returns {Record<string, any>}
 */
function chartScales(palette, { unit } = {}) {
  const ticks = { color: palette.muted, font: palette.font };
  return {
    x: { grid: { display: false }, border: { color: palette.subtle }, ticks },
    y: {
      grid: { color: palette.subtle },
      border: { display: false },
      ticks,
      title: unit ? { display: true, text: unit, color: palette.muted, font: palette.font } : { display: false }
    }
  };
}

/**
 * Calls `fn` whenever the theme, the accent preset, or the system colour scheme changes — a canvas
 * does not follow CSS, so charts repaint themselves from here.
 * @param {LayoutContext} context
 * @param {() => void} fn
 * @returns {void}
 */
function watchTheme(context, fn) {
  const observer = new MutationObserver(fn);
  observer.observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-zx-theme', 'data-zx-preset']
  });
  context.cleanup(() => observer.disconnect());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn, { signal: context.signal });
}

/**
 * The widths at which the shell gives a column up — `kit.css` repeats them in its container
 * queries — plus `named`, below which a modules sidebar drops its panel labels. That one is the
 * controller's alone: the sidebar draws the narrower presentation itself.
 */
const SHELL_BREAKPOINTS = Object.freeze({ named: 1440, aside: 1180, nav: 860, single: 640 });

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), '
  + 'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Where you are in a column: its current or chosen item. */
const CURRENT = '[aria-current="page"], [aria-current="true"], [aria-selected="true"]';
/** Focusable controls that do not raise a phone's keyboard. */
const NOT_TEXT_ENTRY = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]):not(input, textarea, [contenteditable="true"])';

/**
 * Focuses the first element in `scope` matching one of the selectors, in order, that actually takes
 * focus — a closed listbox's selected option matches `[aria-selected]` but is not rendered, and a
 * `<span aria-current>` is rendered but not focusable.
 * @param {Element|null|undefined} scope
 * @param {...string} selectors
 * @returns {boolean} Whether anything took focus.
 */
function focusFirst(scope, ...selectors) {
  if (!scope) return false;
  for (const selector of selectors) {
    for (const element of scope.querySelectorAll(selector)) {
      if (!(element instanceof HTMLElement) || !element.checkVisibility({ visibilityProperty: true })) continue;
      element.focus({ preventScroll: true });
      if (document.activeElement === element) return true;
    }
  }
  return false;
}

/**
 * Focuses the first rendered heading in `scope`, making it focusable from script only, so a screen
 * reader announces where a pane switch or a navigation choice went.
 * @param {Element|null|undefined} scope
 * @returns {boolean} Whether a heading took focus.
 */
function focusHeading(scope) {
  const heading = [...(scope?.querySelectorAll('h1, h2, h3') ?? [])]
    .find((element) => element instanceof HTMLElement && element.checkVisibility({ visibilityProperty: true }));
  if (!(heading instanceof HTMLElement)) return false;
  if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  return document.activeElement === heading;
}

/**
 * @typedef {Object} AdaptiveShell
 * @property {() => HTMLButtonElement} navToggle A button that opens the navigation column as a
 *   drawer, shown only once that column has given way (860px). Place one first in the header of
 *   every pane that can be the leftmost one showing — the list's, and the main pane's too when the
 *   list can step aside.
 * @property {() => HTMLButtonElement} backToggle A button that returns from the main pane to the
 *   list, shown only when one pane fits (640px) and the main pane is showing. Place it first in
 *   the main pane's header.
 * @property {() => HTMLButtonElement} asideToggle A button that opens the inspector as a drawer,
 *   shown only once that column has given way (1180px) and is not pinned. Place it among the main
 *   pane's header actions.
 * @property {(pane: 'list'|'main', options?: {focus?: boolean, target?: HTMLElement}) => void} show
 *   Picks the pane to show when only one fits. Call `show('main')` when a row is opened by pointer
 *   or Enter — not when J/K moves the selection — and `show('list')` where the layout closes its
 *   record. On a phone focus moves into the pane shown: to `target` when given, otherwise to the
 *   main pane's heading or back to the row that opened it.
 * @property {() => 'list'|'main'} pane The pane shown when only one fits.
 * @property {() => boolean} single Whether only one pane fits right now.
 * @property {() => HTMLButtonElement} panelToggle A button that opens and closes the bottom panel
 *   (`.shell__panel`); place it in the main pane's header or the status bar.
 * @property {() => void} openNav Opens the navigation drawer (narrow widths).
 * @property {() => void} closeNav
 * @property {(open?: boolean) => void} toggleAside Opens or closes the inspector drawer (narrow).
 * @property {() => void} toggleNav The navigation, the way the width allows: the drawer narrow, the
 *   column collapsed or back wide (Mod+B with `keys`).
 * @property {() => void} toggleInspector The inspector, the same way (Mod+I with `keys`).
 * @property {(name: 'nav'|'aside', collapsed?: boolean) => boolean} collapse Hides or brings back a
 *   column at full width.
 * @property {(open?: boolean) => boolean} togglePanel Opens or closes the bottom panel (Mod+J with
 *   `keys`).
 */

/**
 * Makes a shell work at any width. Wide, every column shows. A navigation column made by
 * `suiteNav()` is found whenever it is in the root, before or after this is called. Below 1180px the inspector gives way
 * (unless it carries `data-pinned`) and `asideToggle()` opens it as a drawer from the end; below
 * 860px the navigation column gives way and `navToggle()` opens it as a drawer from the start; below
 * 640px a shell with a list column shows the list or the main pane, never both, and `backToggle()`
 * returns to the list.
 *
 * A drawer is modal within the layout: the other columns are inert while it is open, Escape or the
 * scrim closes it, choosing a navigation item closes it, and focus returns to what opened it. The
 * toggles are made on demand — as many as the headers need, each kept in step with the drawer's
 * state; a layout that redraws a header can keep the one it made or make a new one. In preview mode
 * nothing is wired; the toggles stay hidden at thumbnail size anyway.
 * @param {HTMLElement} root The layout's `.shell` root.
 * @param {LayoutContext} context
 * A control in the navigation column that changes what the drawer itself shows (a folder, a
 * filter of the list inside it) carries `data-drawer-stay`, and choosing it leaves the drawer open.
 * At full width a column can also be collapsed (`collapse()`); its toggle then shows there too, to
 * bring it back. A bottom panel — `.shell__panel` inside the main pane, `hidden` while closed — is
 * opened and closed by `togglePanel()`. With `keys`, Mod+B, Mod+I, and Mod+J toggle the navigation,
 * the inspector, and the panel.
 * @param {{navLabel?: string, backLabel?: string, asideLabel?: string, panelLabel?: string,
 *   keys?: boolean, ondrawer?: (name: 'nav'|'aside', open: boolean) => void}} [options] Accessible
 *   names — `backLabel` names where the button goes ("Back to inbox"), `asideLabel` what the
 *   inspector holds ("Issue details"), `panelLabel` the bottom panel — `keys` for the panel
 *   shortcuts, and `ondrawer`, told whenever a drawer opens or closes, including the closes the
 *   shell makes itself (Escape, the scrim, a choice, the column fitting again).
 * @returns {AdaptiveShell}
 */
function adaptiveShell(root, context, {
  navLabel = 'Open navigation', backLabel = 'Back', asideLabel = 'Show details',
  panelLabel = 'Toggle panel', keys = false, ondrawer
} = {}) {
  // A layout may keep several panes of one kind and show one at a time (a page per view): the
  // rendered one is the column; when none is rendered (a closed drawer), the one not `hidden`.
  const column = (name) => {
    const all = /** @type {HTMLElement[]} */ ([...root.querySelectorAll(`:scope > .shell__${name}`)]);
    return all.find((element) => element.checkVisibility())
      ?? all.find((element) => !element.hidden) ?? all[0] ?? null;
  };
  /** @type {Record<'nav'|'aside'|'panel', Set<HTMLButtonElement>>} Every toggle made, to keep in step. */
  const toggles = { nav: new Set(), aside: new Set(), panel: new Set() };
  const control = (className, name, label, onclick, target) => {
    const button = /** @type {HTMLButtonElement} */ (h('button', {
      type: 'button', class: `zx-icon-btn ${className}`, 'aria-label': label, title: label,
      'aria-expanded': target ? String(shown(target)) : null, onclick
    }, icon(name)));
    if (target) toggles[target].add(button);
    return button;
  };
  // Narrow, a toggle opens its column as a drawer; wide, it brings back a column collapsed with
  // collapse() (and is shown only then).
  const navToggle = () => control('shell__nav-toggle', 'bars', navLabel, () => toggleNav(), 'nav');
  const backToggle = () => control('shell__back', 'arrow-left', backLabel, () => show('list'), null);
  const asideToggle = () => control('shell__aside-toggle', 'panel-right', asideLabel, () => toggleInspector(), 'aside');
  const panelToggle = () => control('shell__panel-toggle', 'panel-bottom', panelLabel, () => togglePanel(), 'panel');

  let width = Infinity;
  const fits = (name) => width > (name === 'nav' ? SHELL_BREAKPOINTS.nav : SHELL_BREAKPOINTS.aside);
  // A navigation column holding a modules-layout sidebar never hides at full width: it minimizes
  // to the module strip, as the reader last left it; between the inspector and navigation widths
  // it starts minimized, and in the drawer it is always expanded.
  const modulesSidebar = () => {
    const element = root.querySelector(':scope > .shell__nav > .zx-app-sidebar[data-layout="modules"]');
    return element ? /** @type {AppSidebar|null} */ (Component.from(element)) : null;
  };
  const preferences = storage('zx-layouts');
  /** @type {'full'|'wide'|'mid'|'narrow'|null} */
  let band = null;
  /** True while the shell itself changes the presentation, which is not the reader's choice. */
  let applying = false;
  const remembered = () => {
    const value = preferences.get('nav-presentation', null);
    return ['expanded', 'compact', 'collapsed'].includes(value) ? value : 'expanded';
  };
  /** @type {WeakSet<AppSidebar>} Sidebars whose presentation is being remembered. */
  const watched = new WeakSet();
  const applyBand = () => {
    const sidebar = modulesSidebar();
    if (!sidebar) return;
    // The reader's own choice at full width is remembered across the suite.
    if (!watched.has(sidebar)) {
      watched.add(sidebar);
      sidebar.on('presentationchange', ({ detail }) => {
        if (applying) return;
        // The drawer always shows the side menu beside the module icons: it is put away by
        // closing it, so a narrower or wider choice made inside it does not stick there.
        if (band === 'narrow') {
          if (detail.presentation !== 'compact') {
            applying = true;
            sidebar.setPresentation('compact');
            applying = false;
          }
          return;
        }
        if (band === 'full' || band === 'wide') preferences.set('nav-presentation', detail.presentation);
      });
    }
    const next = width >= SHELL_BREAKPOINTS.named ? 'full' : width > SHELL_BREAKPOINTS.aside ? 'wide'
      : width > SHELL_BREAKPOINTS.nav ? 'mid' : 'narrow';
    if (next === band) return;
    // The column is about to become a closed drawer: focus inside it moves to what opens it.
    const leaving = next === 'narrow' && band !== null && Boolean(column('nav')?.contains(document.activeElement));
    band = next;
    // From 1440 the reader's choice; below it module names would cost the work its room, so the
    // choice stops at the module icons beside the side menu; between the inspector and navigation
    // widths both menus collapse; in the drawer the side menu sits beside the module icons.
    const choice = remembered();
    applying = true;
    sidebar.setPresentation(next === 'full' ? choice
      : next === 'wide' ? (choice === 'expanded' ? 'compact' : choice)
        : next === 'mid' ? 'collapsed' : 'compact');
    applying = false;
    if (leaving) {
      const toggle = [...toggles.nav].find((button) => button.isConnected && button.checkVisibility());
      if (toggle) toggle.focus({ preventScroll: true });
      else if (!focusHeading(column('main'))) focusFirst(column('main'), FOCUSABLE);
    }
  };
  const bottomPanel = () => /** @type {HTMLElement|null} */ (root.querySelector('.shell__panel'));
  /** @param {'nav'|'aside'|'panel'} name @returns {boolean} Whether that part is showing now. */
  const shown = (name) => {
    if (name === 'panel') return Boolean(bottomPanel() && !bottomPanel()?.hidden);
    return fits(name) ? root.dataset[`${name}Collapsed`] !== 'true' : root.dataset[`${name}Open`] === 'true';
  };
  /** @param {'nav'|'aside'|'panel'} name @returns {HTMLButtonElement|null} The toggle on screen. */
  const sync = (name) => {
    let visible = null;
    for (const button of toggles[name]) {
      if (!button.isConnected) {
        toggles[name].delete(button);
        continue;
      }
      button.setAttribute('aria-expanded', String(shown(name)));
      if (button.offsetParent !== null) visible ??= button;
    }
    return visible;
  };
  /** @type {HTMLElement|null} What had focus in the list when the main pane was opened. */
  let listFocus = null;
  /** @type {HTMLElement|null} What had focus when a drawer opened. */
  let drawerFocus = null;
  /** @type {HTMLElement|null} */
  let scrim = null;
  if (!root.dataset.pane) root.dataset.pane = 'list';

  const single = () => width <= SHELL_BREAKPOINTS.single;
  const pane = () => (root.dataset.pane === 'main' ? 'main' : 'list');

  /** @param {'list'|'main'} next @param {{focus?: boolean}} [options] */
  function show(next, { focus = true, target } = {}) {
    const active = document.activeElement;
    if (next === 'main' && pane() === 'list' && active instanceof HTMLElement && column('list')?.contains(active)) {
      listFocus = active;
    }
    root.dataset.pane = next;
    if (!focus || context.preview || !single() || !column('list')) return;
    if (target?.isConnected) {
      if (!target.hasAttribute('tabindex') && !target.matches(FOCUSABLE)) target.tabIndex = -1;
      target.focus({ preventScroll: true });
      if (document.activeElement === target) return;
    }
    if (next === 'main') {
      if (!focusHeading(column('main'))) focusFirst(column('main'), '.shell__back', FOCUSABLE);
    } else {
      if (listFocus?.isConnected) listFocus.focus({ preventScroll: true });
      if (document.activeElement !== listFocus) focusFirst(column('list'), CURRENT, FOCUSABLE);
    }
  }

  /** @param {'nav'|'aside'} name @param {boolean} open @param {{restore?: boolean}} [options] */
  function drawer(name, open, { restore = true } = {}) {
    const key = name === 'nav' ? 'navOpen' : 'asideOpen';
    const panel = column(name);
    if (open === (root.dataset[key] === 'true')) return;
    if (open) {
      if (!panel || context.preview) return;
      drawer(name === 'nav' ? 'aside' : 'nav', false, { restore: false });
      // Focus on the page itself is no place to come back to: the toggle is, when the drawer closes.
      drawerFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement : null;
      root.dataset[key] = 'true';
      scrim = h('div', { class: 'shell__scrim', 'aria-hidden': 'true', onclick: () => closeAll() });
      root.append(scrim);
      for (const other of root.querySelectorAll(':scope > :is(.shell__nav, .shell__list, .shell__main, .shell__aside, .shell__statusbar)')) {
        if (other !== panel) /** @type {HTMLElement} */ (other).inert = true;
      }
      sync(name);
      // Not a text field first — on a phone that raises the keyboard over the drawer. A drawer with
      // nothing else focusable takes focus itself, so Escape still reaches the shell and focus is
      // never left on the inert opener behind the scrim.
      // The current page first: in a modules sidebar the current module's tile comes before it.
      if (!focusFirst(panel, '[aria-current="page"]', CURRENT, NOT_TEXT_ENTRY)) {
        if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1;
        panel.focus({ preventScroll: true });
      }
      ondrawer?.(name, true);
    } else {
      delete root.dataset[key];
      scrim?.remove();
      scrim = null;
      for (const other of root.querySelectorAll(':scope > [inert]')) /** @type {HTMLElement} */ (other).inert = false;
      const button = sync(name);
      const lost = !root.contains(document.activeElement) || panel?.contains(document.activeElement);
      if (restore && lost) (drawerFocus?.isConnected ? drawerFocus : button)?.focus({ preventScroll: true });
      drawerFocus = null;
      ondrawer?.(name, false);
    }
  }
  const openNav = () => drawer('nav', true);
  const closeNav = () => drawer('nav', false);
  /** @param {boolean} [open] */
  const toggleAside = (open = root.dataset.asideOpen !== 'true') => drawer('aside', open);
  const closeAll = () => { drawer('nav', false); drawer('aside', false); };

  /**
   * Hides or brings back a column at full width, where it is not a drawer. Focus inside a column
   * that goes moves to the main pane.
   * @param {'nav'|'aside'} name
   * @param {boolean} [collapsed] Toggles when left out.
   * @returns {boolean} Whether the column is collapsed now.
   */
  function collapse(name, collapsed = root.dataset[`${name}Collapsed`] !== 'true') {
    const key = `${name}Collapsed`;
    const panel = column(name);
    const hadFocus = Boolean(panel?.contains(document.activeElement));
    if (collapsed) root.dataset[key] = 'true';
    else delete root.dataset[key];
    const button = sync(name);
    if (context.preview) return collapsed;
    if (collapsed && hadFocus) {
      button?.focus({ preventScroll: true });
      if (document.activeElement !== button && !focusHeading(column('main'))) focusFirst(column('main'), FOCUSABLE);
    }
    // The toggle that brought the column back is about to be hidden with it: focus moves into it.
    if (!collapsed && document.activeElement instanceof Element
      && document.activeElement.matches('.shell__nav-toggle, .shell__aside-toggle')) {
      focusFirst(panel, CURRENT, NOT_TEXT_ENTRY);
    }
    return collapsed;
  }
  /**
   * Shows or hides the navigation the way the width allows: a drawer narrow, a column wide — and a
   * modules sidebar minimized to its strip rather than hidden.
   */
  const toggleNav = () => {
    if (!fits('nav')) return drawer('nav', root.dataset.navOpen !== 'true');
    const sidebar = modulesSidebar();
    if (sidebar) return sidebar.togglePresentation();
    return collapse('nav');
  };
  /** Shows or hides the inspector the way the width allows: a drawer narrow, a column wide. */
  const toggleInspector = () => (fits('aside') ? collapse('aside') : toggleAside());

  /**
   * Opens or closes the bottom panel (`.shell__panel`). Opening moves focus into it; closing with
   * focus inside returns it to the toggle or the main pane.
   * @param {boolean} [open] Toggles when left out.
   * @returns {boolean} Whether the panel is open now.
   */
  function togglePanel(open = !shown('panel')) {
    const panel = bottomPanel();
    if (!panel) return false;
    const hadFocus = panel.contains(document.activeElement);
    panel.hidden = !open;
    const button = sync('panel');
    if (context.preview) return open;
    if (open) focusFirst(panel, '[aria-selected="true"]', NOT_TEXT_ENTRY);
    else if (hadFocus) {
      if (button) button.focus({ preventScroll: true });
      else if (!focusHeading(column('main'))) focusFirst(column('main'), FOCUSABLE);
    }
    return open;
  }

  if (!context.preview) {
    // Escape closes an open drawer before the layout's own Escape handling sees it.
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (root.dataset.navOpen !== 'true' && root.dataset.asideOpen !== 'true') return;
      // An open Select, menu, or listbox inside the drawer closes first; the drawer on the next one.
      // A module tile beside its panel reports aria-expanded too, but that panel is not a popup.
      const target = event.composedPath()[0];
      if (target instanceof Element
        && target.closest('[aria-expanded="true"], [role="listbox"], [role="menu"], [role="dialog"]')
        && !target.closest('.zx-module-bar[data-menus="none"] .zx-module-bar__item[data-app-nav-value-id]')) return;
      event.preventDefault();
      event.stopPropagation();
      closeAll();
    }, { capture: true, signal: context.signal });
    // Choosing somewhere to go closes the navigation drawer; opening a group inside it does not.
    // The event's path is read rather than the target's ancestry: a sidebar that redraws while
    // handling the click has detached its target by the time the event reaches the root.
    const inNav = (event) => {
      const nav = column('nav');
      return Boolean(nav) && event.composedPath().includes(nav);
    };
    const chosen = (target) => target instanceof Element
      && target.closest('a[href], button, [role="treeitem"], [role="menuitem"], [role="option"], [role="link"]')
      && !target.closest('[aria-expanded], [aria-haspopup], [data-drawer-stay]');
    // After a choice, focus follows the view it opened: the main pane's heading, as for show(). The
    // view may render a frame later, so the focus waits for it.
    const closeAfterChoice = () => setTimeout(() => {
      const active = document.activeElement;
      const lost = !active || active === document.body || Boolean(column('nav')?.contains(active));
      drawer('nav', false, { restore: false });
      if (!lost) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (context.signal.aborted) return;
        const now = document.activeElement;
        if (now && now !== document.body && root.contains(now) && !column('nav')?.contains(now)) return;
        // On a phone showing the list, the list; otherwise the main pane.
        const showing = single() && pane() === 'list' && column('list') ? column('list') : column('main');
        if (!focusHeading(showing)) focusFirst(showing, CURRENT, FOCUSABLE);
      }));
    });
    root.addEventListener('click', (event) => {
      if (root.dataset.navOpen !== 'true' || !inNav(event)) return;
      if (chosen(event.composedPath()[0])) closeAfterChoice();
    }, { signal: context.signal });
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || root.dataset.navOpen !== 'true' || !inNav(event)) return;
      const target = event.composedPath()[0];
      if (target instanceof Element && target.closest('[role="treeitem"], [role="option"]')
        && !target.closest('[data-drawer-stay]')) closeAfterChoice();
    }, { signal: context.signal });
    // Mod+B the navigation, Mod+I the inspector, Mod+J the bottom panel — not while typing in rich
    // text, where B and I are bold and italic. A modules sidebar always takes Mod+B: minimizing it
    // is how the suite's navigation is put away.
    root.addEventListener('keydown', (event) => {
      const mod = isMac() ? event.metaKey : event.ctrlKey;
      if (!mod || event.altKey || event.shiftKey || event.defaultPrevented) return;
      const key = event.key.toLowerCase();
      const target = /** @type {HTMLElement} */ (event.target);
      const rich = target?.isContentEditable || target instanceof HTMLTextAreaElement;
      if (key === 'b' && !rich && column('nav') && (keys || modulesSidebar())) toggleNav();
      else if (keys && key === 'i' && !rich && column('aside')) toggleInspector();
      else if (keys && key === 'j' && bottomPanel()) togglePanel();
      else return;
      event.preventDefault();
    }, { signal: context.signal });
    applyBand();
    // A drawer for a column that fits again closes by itself.
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      applyBand();
      if (width > SHELL_BREAKPOINTS.nav) drawer('nav', false, { restore: false });
      if (width > SHELL_BREAKPOINTS.aside) drawer('aside', false, { restore: false });
      sync('nav');
      sync('aside');
    });
    observer.observe(root);
    context.cleanup(() => observer.disconnect());
  }

  return {
    navToggle, backToggle, asideToggle, panelToggle, show, pane, single, openNav, closeNav, toggleAside,
    toggleNav, toggleInspector, collapse, togglePanel
  };
}

export {
  DATE, SHELL_BREAKPOINTS, adaptiveShell, allowsMotion, chartOptions, chartPalette, chartScales, disposer, dot, iconButton, iconTile,
  isEditable, kbd, later, layoutContext, listTime, loadChartJs, modShortcut, modifierLabel,
  accountChoices, paneHeader, panelBlock, propList, renderScope, sectionLabel, shortcutSheet, shortcuts, suiteNav, suiteStrip, toast, toaster, unavailable,
  unavailablePane, watchTheme, workspaceHeader
};
