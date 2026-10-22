/*
 * The Theme studio's canvas: one dense card per family, covering a representative cross-section.
 *
 * The point of putting them on one page is comparison. A component looks fine on its own page
 * under any theme; what a theme has to survive is a table beside a form beside a toolbar, where
 * one accent that is a shade too loud, or a radius that suits buttons but not panels, shows up
 * immediately. So the cards are deliberately dense and deliberately adjacent.
 *
 * Each card is a plain factory returning an element. `mountShowcase` collects the teardown for
 * the few that own something outside their own subtree — toasts, overlays — and returns it, so
 * the canvas can be rebuilt from scratch whenever a token that components read at build time
 * changes.
 */

import {
  AppIcon, AppSidebar, Aurora, Breadcrumb, Calendar, Card, Checklist, Component, ContextMenu, CopyInput, DataFilter, DateRangeBox, Datebox, DatePicker,
  Dialog, Dropdown, Finder, Form, Groupbox, InlineLoading, MasterPanel, MenuButton, Message,
  Modal, ModuleBar, MultiValueEditor, NavigationBar, NumberField, Pagination, Panel, ProgressBar,
  Rating, Search, Select, Sheet, Slider, Stepper, Table, Tabbox, TagPicker, Timebox, Toggle, Toolbar,
  TreeView, ValueList, badge, button, buttonGroup, CheckButton, emptyState, h, icon, iconNames,
  skeletonText, spinner, tooltip
} from '../src/index.js';

/** Semantic colours the palette card shows, in the order the theming guide lists them. */
const PALETTE = [
  ['Accent', '--zx-color-accent'],
  ['Accent hover', '--zx-color-accent-hover'],
  ['Accent subtle', '--zx-color-accent-subtle'],
  ['Solid accent', '--zx-color-accent-solid'],
  ['Selected', '--zx-color-bg-selected'],
  ['Current', '--zx-color-bg-current'],
  ['Page', '--zx-color-bg-page'],
  ['Chrome', '--zx-color-bg-chrome'],
  ['Surface', '--zx-color-bg-surface'],
  ['Raised', '--zx-color-bg-raised'],
  ['Glass chrome', '--zx-color-glass-chrome'],
  ['Floating overlay', '--zx-color-overlay-surface'],
  ['Reading overlay', '--zx-color-overlay-panel'],
  ['Muted', '--zx-color-bg-muted'],
  ['Border', '--zx-color-border'],
  ['Subtle border', '--zx-color-border-subtle'],
  ['Text', '--zx-color-text'],
  ['Muted text', '--zx-color-text-muted'],
  ['Subtle text', '--zx-color-text-subtle'],
  ['Success', '--zx-color-success'],
  ['Warning', '--zx-color-warning'],
  ['Danger', '--zx-color-danger'],
  ['Info', '--zx-color-info']
];

/** The categorical tones, in the order the theming guide lists them. */
const TONES = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate'];

/** How many chart series the palette defines (`--zx-color-chart-1` …). */
const CHART_SERIES = 8;

const BADGE_KINDS = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'];

/** The rows of the state matrix: every Button kind, the icon-only button among them. */
const BUTTON_KINDS = [
  { label: 'Primary', options: { label: 'Save', kind: 'primary' } },
  { label: 'Secondary', options: { label: 'Cancel' } },
  { label: 'Ghost', options: { label: 'Filter', icon: 'filter', kind: 'ghost' } },
  { label: 'Danger', options: { label: 'Delete', kind: 'danger' } },
  { label: 'Icon', options: { icon: 'reload', title: 'Reload' } }
];

/** The columns of the state matrix, in the order a button moves through them. */
const BUTTON_STATES = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'active', label: 'Active' },
  { id: 'focus', label: 'Focus' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'loading', label: 'Loading' }
];

/** The pseudo-classes the matrix mirrors; `:focus-within` and the like are left alone. */
const STATE_PSEUDOS = /:(?:hover|active|focus(?:-visible)?)(?![\w-])/g;
const STATE_PSEUDO = new RegExp(STATE_PSEUDOS.source);
/** The matrix column each mirrored pseudo-class draws. */
const STATE_OF = { ':hover': 'hover', ':active': 'active', ':focus': 'focus', ':focus-visible': 'focus' };

const PEOPLE = [
  { ID: 1, name: 'Nadine Roth' },
  { ID: 2, name: 'Tobias Kern' },
  { ID: 3, name: 'Camille Fournier' },
  { ID: 4, name: 'Owen Blythe' }
];

const INVOICES = [
  { ID: 1, number: 'INV-26041', customer: 'Alpine Works GmbH', state: 'Paid', amount: 12_400 },
  { ID: 2, number: 'INV-26042', customer: 'Danube Systems AG', state: 'Open', amount: 4_950 },
  { ID: 3, number: 'INV-26043', customer: 'Kestrel Analytics', state: 'Overdue', amount: 18_200 },
  { ID: 4, number: 'INV-26044', customer: 'Atelier West', state: 'Draft', amount: 2_180 }
];

const STATE_KIND = { Paid: 'success', Open: 'info', Overdue: 'danger', Draft: 'neutral' };

const TREE = [
  {
    ID: 'accounts',
    name: 'Accounts',
    children: [
      { ID: 'alpine', name: 'Alpine Works GmbH' },
      { ID: 'danube', name: 'Danube Systems AG' }
    ]
  },
  { ID: 'products', name: 'Products', children: [{ ID: 'seats', name: 'Seat licences' }] }
];

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0
});

/**
 * Every card on the canvas, in reading order. Column-major flow puts roughly the first third in
 * the left column, so the loudest families come first.
 * A `wide` card spans every column: a matrix needs the whole width of the canvas.
 * @type {{id: string, title: string, hint: string, wide?: boolean,
 *   render: (teardown: (fn: () => void) => void) => Node}[]}
 */
export const CARDS = [
  { id: 'palette', title: 'Semantic palette', hint: 'What every component resolves its colour through', render: paletteCard },
  { id: 'tones', title: 'Tones and series', hint: 'Categorical colour, apart from the accent and status', render: tonesCard },
  { id: 'type', title: 'Type scale', hint: '--zx-font-sans and the text steps', render: typeCard },
  { id: 'material', title: 'Material', hint: 'Identity, controls, raised surfaces, and overlay tiers', render: materialCard },
  { id: 'buttons', title: 'Buttons', hint: 'Four kinds, two sizes, joined groups', render: buttonsCard },
  {
    id: 'button-states',
    title: 'Button states',
    hint: 'Every kind in every state, drawn by the library’s own state rules',
    wide: true,
    render: buttonStatesCard
  },
  { id: 'badges', title: 'Badges', hint: 'Six intents in three weights', render: badgesCard },
  { id: 'inputs', title: 'Text input', hint: 'Search, copy, numbers, native controls', render: inputsCard },
  { id: 'selection', title: 'Selection', hint: 'Select, tags, checklist, permission', render: selectionCard },
  { id: 'ranges', title: 'Ranges and progress', hint: 'Slider, rating, progress, loading', render: rangesCard },
  { id: 'dates', title: 'Dates and time', hint: 'Boxes, ranges, durations', render: datesCard },
  { id: 'calendar', title: 'Calendar', hint: 'The inline picker — the densest accent surface', render: calendarCard },
  { id: 'schedule', title: 'Schedule', hint: 'Agenda events and Calendar controls', render: scheduleCard },
  { id: 'form', title: 'Form', hint: 'A fieldset of typed fields with actions', render: formCard },
  { id: 'table', title: 'Table', hint: 'Sorting, zebra rows, selection, pagination', render: tableCard },
  { id: 'filter', title: 'Data filter', hint: 'The filter bar above a table', render: filterCard },
  { id: 'tabs', title: 'Tabs', hint: 'All four Tabbox variants', render: tabsCard },
  { id: 'navigation', title: 'Navigation', hint: 'App bar, breadcrumb, steps, toolbar', render: navigationCard },
  {
    id: 'modules',
    title: 'Modules',
    hint: 'Module bar in three appearances, and the modules layout of AppSidebar',
    wide: true,
    render: modulesCard
  },
  { id: 'containers', title: 'Containers', hint: 'Card, panel, groupbox, master panel', render: containersCard },
  { id: 'overlays', title: 'Overlays', hint: 'Modal, dialog, Sheet, menus, tooltips, and toasts', render: overlaysCard },
  { id: 'hierarchy', title: 'Hierarchy', hint: 'Tree and finder', render: hierarchyCard },
  { id: 'lists', title: 'Value editors', hint: 'Chips and multi-value rows', render: listsCard },
  { id: 'states', title: 'Empty and loading', hint: 'What a screen shows before it has data', render: statesCard },
  { id: 'icons', title: 'Icons', hint: 'The bundled set, at control size', render: iconsCard }
];

/**
 * Builds the whole canvas.
 * @param {HTMLElement} container Element to fill.
 * @returns {() => void} Teardown for everything the cards created outside their own subtree.
 */
export function mountShowcase(container) {
  /** @type {(() => void)[]} */
  const teardowns = [];
  const collect = (fn) => teardowns.push(fn);
  /** @type {Set<Component>} */
  const components = new Set();
  const collectComponents = (node) => {
    const elements = node instanceof Element
      ? [node, ...node.querySelectorAll('*')]
      : node instanceof DocumentFragment ? [...node.querySelectorAll('*')] : [];
    for (const element of elements) {
      const component = Component.from(element);
      if (component) components.add(component);
    }
  };

  container.replaceChildren(...CARDS.map((card) => h('section', {
    class: card.wide ? 'studio-card studio-card--wide' : 'studio-card', id: `card-${card.id}`
  },
    h('header', { class: 'studio-card__head' },
      h('h2', { class: 'studio-card__title' }, card.title),
      h('p', { class: 'studio-card__hint' }, card.hint)),
    h('div', { class: 'studio-card__body' }, body(card, collect, collectComponents)))));

  return () => {
    for (const component of [...components].reverse()) {
      try { component.destroy(); } catch { /* one component must not block the rebuild */ }
    }
    for (const teardown of [...teardowns].reverse()) {
      try { teardown(); } catch { /* a failed teardown must not block the rebuild */ }
    }
  };
}

/**
 * Renders one card, reporting a failure in place rather than taking the page with it.
 *
 * The canvas is twenty cards deep and its whole value is comparison; a single component throwing
 * during construction should cost that card, not the other nineteen.
 * @param {{title: string, render: (teardown: (fn: () => void) => void) => Node}} card
 * @param {(fn: () => void) => void} collect
 * @param {(node: Node) => void} collectComponents
 * @returns {Node}
 */
function body(card, collect, collectComponents) {
  try {
    const rendered = card.render(collect);
    collectComponents(rendered);
    return rendered;
  } catch (error) {
    console.error(`Theme studio: the ${card.title} card failed to render.`, error);
    return h('p', { class: 'studio-prose' }, `This card failed to render: ${error.message}`);
  }
}

/* ---------------------------------------------------------------------- cards -- */

/** @returns {Node} */
function paletteCard() {
  return h('div', { class: 'studio-swatches' }, PALETTE.map(([label, token]) =>
    h('div', { class: 'studio-swatch' },
      h('span', { class: 'studio-swatch__chip', style: { background: `var(${token})` } }),
      h('span', { class: 'studio-swatch__label' }, label))));
}

/**
 * The tone palette as tag-sized chips (fill and ink together, since a tone is the pair), then the
 * chart series in assignment order.
 * @returns {Node}
 */
function tonesCard() {
  return h('div', { class: 'studio-stack' },
    h('div', { class: 'studio-swatches' }, TONES.map((tone) =>
      h('div', { class: 'studio-swatch' },
        h('span', {
          class: 'studio-swatch__chip',
          style: {
            display: 'grid', placeItems: 'center', borderColor: 'transparent',
            background: `var(--zx-color-tone-${tone}-bg)`, color: `var(--zx-color-tone-${tone}-fg)`
          }
        }, 'Aa'),
        h('span', { class: 'studio-swatch__label' }, tone)))),
    h('div', { class: 'studio-swatches' }, Array.from({ length: CHART_SERIES }, (_, index) =>
      h('div', { class: 'studio-swatch' },
        h('span', { class: 'studio-swatch__chip', style: { background: `var(--zx-color-chart-${index + 1})` } }),
        h('span', { class: 'studio-swatch__label' }, `Series ${index + 1}`)))));
}

/** @returns {Node} */
function typeCard() {
  return h('div', { class: 'studio-type' },
    h('p', { class: 'studio-type__display' }, 'Invoices'),
    h('p', { class: 'studio-type__lead' },
      'A theme is a ramp and a handful of measurements, not a stylesheet per component.'),
    h('p', { class: 'studio-type__body' },
      'Body copy at --zx-text-md, the size every control inherits. Numerals matter in business '
      + 'software: 1 234,56 · 0 987 · 2026-08-21.'),
    h('p', { class: 'studio-type__muted' }, 'Secondary text at --zx-color-text-muted.'));
}

/** @returns {Node} */
function materialCard() {
  const canvas = h('div', { class: 'studio-material-canvas studio-stack' },
    row(
      new AppIcon(null, { icon: 'folder', color: '#bc3885', size: 52, label: 'Accounts', shape: 'circle' }).toElement(),
      new AppIcon(null, { icon: 'file', color: '#535494', size: 52, label: 'Billing', glass: 'strong', shape: 'circle' }).toElement(),
      new AppIcon(null, { icon: 'check', color: '#e2b301', size: 52, label: 'Tasks' }).toElement()),
    new Card(null, {
      variant: 'raised',
      title: 'Raised material surface',
      content: 'Menus, pickers, tooltips, column menus, and toasts use responsive compact glass. Launcher, dialogs, and overlay Sheets use a calmer reading panel. Both refract Aurora and page content; docked Sheets and dense data surfaces stay opaque.',
      actions: [{ label: 'Review', kind: 'primary', size: 'sm' }]
    }).toElement());
  new Aurora(canvas, {
    preset: 'source',
    colors: ['#21cc75', '#2b7fff', '#9a67ff'],
    intensity: 'balanced'
  });
  return canvas;
}

/** @returns {Node} */
function buttonsCard() {
  // A segmented choice marks the current option as pressed, not as a primary action.
  const grid = button({ label: 'Grid', size: 'sm' });
  grid.setAttribute('aria-pressed', 'true');
  const canvas = h('div', { class: 'studio-overlay-canvas studio-stack' },
    row(
      button({ label: 'Default' }),
      button({ label: 'Primary', kind: 'primary', icon: 'plus' }),
      button({ label: 'Danger', kind: 'danger' }),
      button({ label: 'Ghost', kind: 'ghost' })),
    row(
      button({ label: 'Small', size: 'sm', icon: 'filter' }),
      button({ icon: 'reload', title: 'Reload' }),
      button({ label: 'Disabled', disabled: true }),
      buttonGroup([
        button({ label: 'List', size: 'sm' }),
        grid,
        button({ label: 'Map', size: 'sm' })
      ])),
    row(
      new CheckButton(null, { label: ['Watching', 'Watch'], value: true }).toElement(),
      new Toggle(null, { label: 'Send receipts', value: true }).toElement(),
      new MenuButton(null, {
        label: 'Actions',
        items: [{ label: 'Duplicate', value: 'copy' }, { label: 'Archive', value: 'archive' }]
      }).toElement()));
  return canvas;
}

/**
 * The state matrix: every Button kind in every state, side by side.
 *
 * Hover, active, and focus are pseudo-classes, which nothing can switch on for a specimen that is
 * not really being pointed at. Rather than restyle them here — a second copy of the button's
 * states that would drift from the first — the card copies the library's own rules at run time:
 * every rule that uses `:hover`, `:active`, `:focus`, or `:focus-visible` and that, with the
 * pseudo-class swapped for a studio-only `data-studio-state` attribute, matches one of the
 * specimens, is inserted straight after its original in the same stylesheet and media block. The
 * cascade order and the specificity are the original's, so the card shows whatever the real rules
 * do — including anything they get wrong. The copies are removed when the canvas is torn down.
 *
 * The specimens are `inert`: they are pictures of buttons, not controls, and must not take focus,
 * hover, or clicks of their own.
 * @param {(fn: () => void) => void} teardown
 * @returns {Node}
 */
function buttonStatesCard(teardown) {
  const table = h('table', { class: 'studio-states__table' },
    h('caption', { class: 'studio-states__caption' }, 'Button kinds by state'),
    h('thead', {}, h('tr', {},
      h('th', { scope: 'col' }, h('span', { class: 'studio-states__kind-head' }, 'Kind')),
      BUTTON_STATES.map((state) => h('th', { scope: 'col' }, state.label)))),
    h('tbody', {}, BUTTON_KINDS.map((kind) => h('tr', {},
      h('th', { scope: 'row' }, kind.label),
      BUTTON_STATES.map((state) => h('td', {}, stateSpecimen(kind.options, state.id)))))));
  const scroller = h('div', {
    class: 'studio-states', role: 'region', 'aria-label': 'Button states', tabindex: '0'
  }, table);

  let removeCopies = () => {};
  let disposed = false;
  // The copies are matched against the specimens where they will render, which needs the card in
  // the document; the canvas inserts every card in one go straight after this returns.
  queueMicrotask(() => {
    if (disposed || !scroller.isConnected) return;
    removeCopies = mirrorStateRules(scroller);
  });
  teardown(() => {
    disposed = true;
    removeCopies();
  });

  return h('div', { class: 'studio-stack' },
    scroller,
    h('p', { class: 'studio-prose' },
      'Hover, active, and focus are drawn by copies of the live ', h('code', {}, ':hover'), ', ',
      h('code', {}, ':active'), ', and ', h('code', {}, ':focus-visible'), ' rules made when this '
      + 'page loads, so the matrix cannot drift from what an application renders. Loading is '
      + 'the busy button (', h('code', {}, 'setButtonBusy()'), '): a spinner in the label’s colour '
      + 'and activation ignored, while it keeps its focus.'));
}

/**
 * One specimen: a real `button()` with its state applied.
 * @param {import('../src/components/button/button.js').ButtonOptions} options
 * @param {string} state One of `BUTTON_STATES`.
 * @returns {HTMLButtonElement}
 */
function stateSpecimen(options, state) {
  const specimen = button({
    ...options,
    busy: state === 'loading',
    disabled: state === 'disabled'
  });
  // A pointer cannot press a button without also hovering it, so the pressed specimen is both.
  if (state === 'active') specimen.dataset.studioState = 'hover active';
  else if (['hover', 'focus'].includes(state)) specimen.dataset.studioState = state;
  specimen.inert = true;
  return specimen;
}

/**
 * Copies every stylesheet rule that draws a mirrored pseudo-class on a specimen inside `scope`.
 * @param {Element} scope The card's matrix; only its specimens carry `data-studio-state`.
 * @returns {() => void} Removes the copies again.
 */
function mirrorStateRules(scope) {
  const specimens = [...scope.querySelectorAll('[data-studio-state]')];
  /** @type {{parent: CSSStyleSheet|CSSGroupingRule, rule: CSSRule}[]} */
  const copies = [];

  /** @param {CSSStyleSheet|CSSGroupingRule} parent */
  const visit = (parent) => {
    let rules;
    try {
      rules = parent.cssRules;
    } catch {
      return; // A cross-origin stylesheet cannot be read, and holds no library rules.
    }
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      if (rule instanceof CSSImportRule) {
        if (rule.styleSheet) visit(rule.styleSheet);
      } else if (rule instanceof CSSStyleRule) {
        const selector = mirroredSelector(rule.selectorText, specimens);
        if (!selector) continue;
        try {
          parent.insertRule(`${selector} { ${rule.style.cssText} }`, index + 1);
        } catch {
          continue; // Unparseable as a copy: the matrix shows the default state for it instead.
        }
        copies.push({ parent, rule: rules[index + 1] });
        index += 1;
      } else if ('cssRules' in rule) {
        visit(/** @type {CSSGroupingRule} */ (rule));
      }
    }
  };
  for (const sheet of document.styleSheets) visit(sheet);

  return () => {
    for (const { parent, rule } of copies.reverse()) {
      const index = [...parent.cssRules].indexOf(rule);
      if (index >= 0) parent.deleteRule(index);
    }
    copies.length = 0;
  };
}

/**
 * The selector list a rule would have with its state pseudo-classes swapped for the studio
 * attribute, keeping only the selectors that then match a specimen.
 *
 * The swap keeps the specificity — an attribute selector weighs what a pseudo-class does — and a
 * zero-specificity `:where(.studio-states *)` beside it confines the copy to the matrix.
 * @param {string} selectorText
 * @param {Element[]} specimens
 * @returns {string} The mirrored list, or '' when nothing in it draws a specimen.
 */
function mirroredSelector(selectorText, specimens) {
  if (!STATE_PSEUDO.test(selectorText)) return '';
  const kept = [];
  for (const part of splitSelectorList(selectorText)) {
    const mirrored = part.replace(STATE_PSEUDOS, (pseudo) =>
      `[data-studio-state~="${STATE_OF[pseudo]}"]:where(.studio-states *)`);
    if (mirrored === part) continue;
    // Pseudo-elements never match an element, so test the element the rule decorates.
    const element = mirrored.replace(/::[\w-]+(?:\([^)]*\))?/g, '');
    try {
      if (specimens.some((specimen) => specimen.matches(element))) kept.push(mirrored);
    } catch {
      // A selector this browser cannot match is not one it renders either.
    }
  }
  return kept.join(', ');
}

/**
 * Splits a selector list at its top-level commas.
 * @param {string} list
 * @returns {string[]}
 */
function splitSelectorList(list) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < list.length; index += 1) {
    const char = list[index];
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(list.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(list.slice(start).trim());
  return parts;
}

/** @returns {Node} */
function badgesCard() {
  return h('div', { class: 'studio-stack' },
    ...['soft', 'solid', 'outline'].map((variant) => row(
      h('span', { class: 'studio-caption' }, variant),
      ...BADGE_KINDS.map((kind) => badge({ label: kind, kind, variant })))),
    row(
      badge({ label: 'Live', kind: 'success', dot: true }),
      badge({ label: 'Approved', icon: 'check', kind: 'accent' }),
      badge({ label: '3 issues', icon: 'warning', kind: 'warning', variant: 'solid' }),
      badge({ label: 'Locked', icon: 'lock', variant: 'outline', size: 'sm' })));
}

/** @returns {Node} */
function inputsCard() {
  return h('div', { class: 'studio-stack' },
    new Search(null, { placeholder: 'Search invoices…' }).toElement(),
    new CopyInput(null, { label: 'API endpoint', value: 'https://api.zeyos.com/v1' }).toElement(),
    row(
      field('Quantity', new NumberField(null, { value: 12, min: 0, max: 99 }).toElement()),
      field('Unit price', new NumberField(null, { value: 249.5, step: 0.5, min: 0 }).toElement())),
    field('Reference', h('input', { type: 'text', value: 'INV-26041', placeholder: 'Reference' })),
    field('Note', h('textarea', { rows: 2 }, 'A bare textarea inside .zx-scope, styled by base.css.')));
}

/** @returns {Node} */
function selectionCard() {
  return h('div', { class: 'studio-stack' },
    field('Owner', new Select(null, { items: PEOPLE, value: 2, filter: 'local' }).toElement()),
    field('Recipients', new TagPicker(null, { items: PEOPLE, values: [1, 3] }).toElement()),
    field('Visibility', Select.permission(null, { groups: PEOPLE }).toElement()),
    field('Columns', new Checklist(null, {
      hideLabel: true, msg: { 'checklist.label': 'Columns' },
      items: [{ ID: 'number', name: 'Number', on: true }, { ID: 'customer', name: 'Customer' },
        { ID: 'amount', name: 'Amount', on: true }],
      search: false
    }).toElement()));
}

/** @returns {Node} */
function rangesCard() {
  const progress = new ProgressBar(null, { label: 'Export', value: 62 });
  return h('div', { class: 'studio-stack' },
    new Slider(null, { label: 'Discount', value: 15, min: 0, max: 50, unit: '%' }).toElement(),
    field('Priority', new Rating(null, { value: 4 }).toElement()),
    progress.toElement(),
    row(
      new InlineLoading(null, { status: 'active', description: 'Posting…' }).toElement(),
      spinner({ label: 'Loading' })));
}

/** @returns {Node} */
function datesCard() {
  const today = new Date();
  const later = new Date(today.getTime() + 6 * 86_400_000);
  return h('div', { class: 'studio-stack' },
    field('Invoice date', new Datebox(null, { value: today }).toElement()),
    field('Service period', new DateRangeBox(null, { start: today, end: later }).toElement()),
    field('Time booked', new Timebox(null, { value: 135 }).toElement()));
}

/** @returns {Node} */
function calendarCard() {
  return new DatePicker(null, { value: new Date() }).toElement();
}

/** @returns {Node} */
function scheduleCard() {
  const first = new Date();
  first.setHours(9, 0, 0, 0);
  const second = new Date(first.getTime());
  second.setDate(second.getDate() + 1);
  second.setHours(13, 30, 0, 0);
  return new Calendar(null, {
    date: first,
    view: 'agenda',
    views: ['agenda', 'week'],
    agendaDays: 3,
    nowIndicator: false,
    events: [
      { id: 'studio-briefing', title: 'Team briefing', start: first, end: new Date(first.getTime() + 60 * 60_000), color: 'var(--zx-color-accent)' },
      { id: 'studio-review', title: 'Customer review', start: second, end: new Date(second.getTime() + 90 * 60_000), location: 'Video call', color: 'var(--zx-color-info)' }
    ]
  }).toElement();
}

/** @returns {Node} */
function formCard() {
  return new Form(null, {
    fieldsets: [{
      title: 'Customer',
      columns: 2,
      fields: {
        company: { type: 'text', label: 'Company', value: 'Alpine Works GmbH', required: true },
        vat: { type: 'text', label: 'VAT ID', value: 'ATU12345678' },
        country: {
          type: 'select', label: 'Country', value: 'AT',
          options: { AT: 'Austria', DE: 'Germany', CH: 'Switzerland' }
        },
        terms: {
          type: 'optionlist', label: 'Payment terms', value: '14',
          options: { 7: '7 days', 14: '14 days', 30: '30 days' }
        },
        reminders: { type: 'checkbox', label: 'Send payment reminders', value: true },
        notes: { type: 'textarea', label: 'Notes', props: { rows: 2 } }
      }
    }],
    actions: [
      { label: 'Cancel', type: 'reset' },
      { label: 'Save customer', type: 'submit', kind: 'primary' }
    ]
  }).toElement();
}

/** @returns {Node} */
function tableCard() {
  const table = new Table(null, {
    columns: [
      { id: 'number', label: 'Number', sortable: true, width: '1.2fr' },
      { id: 'customer', label: 'Customer', sortable: true, width: '2fr' },
      {
        id: 'state',
        label: 'State',
        width: '1fr',
        render: (row) => badge({ label: row.state, kind: STATE_KIND[row.state], size: 'sm' })
      },
      {
        id: 'amount',
        label: 'Amount',
        sortable: true,
        align: 'right',
        width: '1fr',
        render: (row) => currency.format(row.amount)
      }
    ],
    data: INVOICES,
    rowId: 'ID',
    sortMode: 'local',
    sort: { id: 'amount', dir: 'desc' },
    selectable: 'multi',
    zebra: true
  });
  table.setSelection([1]);
  const pagination = new Pagination(null, { total: 128, page: 2, pageSize: 25 });
  return h('div', { class: 'studio-stack' }, table.toElement(), pagination.toElement());
}

/** @returns {Node} */
function filterCard() {
  return new DataFilter(null, {
    filters: [
      { type: 'text', id: 'query', label: 'Search', fields: ['customer'] },
      {
        type: 'select',
        id: 'state',
        label: 'State',
        field: 'state',
        options: [{ value: 'Paid', label: 'Paid' }, { value: 'Open', label: 'Open' },
          { value: 'Overdue', label: 'Overdue' }, { value: 'Draft', label: 'Draft' }],
        emptyLabel: 'Any state'
      },
      // No `options`: the distinct values in the data become the list.
      { type: 'select', id: 'customer', label: 'Customer', field: 'customer', emptyLabel: 'Anyone' }
    ],
    data: INVOICES
  }).toElement();
}

/** @returns {Node} */
function tabsCard() {
  const tabs = ['divided', 'bracket', 'line', 'segmented'].map((variant) => h('div', { class: 'studio-stack' },
    h('code', { class: 'studio-caption' }, `variant: '${variant}'`),
    new Tabbox(null, {
      variant,
      tabs: [
        { name: 'overview', title: 'Overview', icon: 'list', content: tabBody('Overview') },
        { name: 'lines', title: 'Lines', content: tabBody('Lines') },
        { name: 'history', title: 'History', content: tabBody('History') }
      ]
    }).toElement()));
  return h('div', { class: 'studio-stack studio-stack--wide' }, ...tabs);
}

/** The modules every module bar on the canvas draws: tones, a host colour, badges, and menus. */
function studioModules() {
  return [
    // The studio draws with the bundled icon set alone, so each module is one it has a glyph for.
    { id: 'favourites', label: 'Favourites', icon: 'star', tone: 'slate' },
    { id: 'library', label: 'Library', icon: 'book', tone: 'blue', badge: 7, children: [
      { id: 'articles', label: 'Articles', badge: 7 }, { id: 'drafts', label: 'Drafts' }
    ] },
    { id: 'billing', label: 'Billing', icon: 'file', color: '#535494', children: [
      { id: 'invoices', label: 'Invoices' },
      { section: true, label: 'Payments', children: [{ id: 'incoming', label: 'Incoming' }, { id: 'dunning', label: 'Dunning' }] }
    ] },
    { id: 'tasks', label: 'Tasks', icon: 'check', tone: 'amber', badge: 12 },
    { id: 'calendar', label: 'Calendar', icon: 'calendar', tone: 'red' },
    { id: 'documents', label: 'Documents', icon: 'folder', tone: 'green' },
    { id: 'settings', label: 'Settings', icon: 'gear' }
  ];
}

/** @returns {Node} */
function modulesCard() {
  const strip = (options) => new ModuleBar(null, { items: studioModules(), active: 'invoices', ...options }).toElement();
  const sidebar = new AppSidebar(null, {
    layout: 'modules', items: studioModules(), active: 'invoices', label: 'Studio navigation'
  });
  return h('div', { class: 'studio-stack studio-stack--wide' },
    // The strips and the sidebar wrap onto two rows on a narrow screen, each keeping its height.
    h('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--zx-space-4)' },
      h('div', { style: 'display: flex; gap: var(--zx-space-4); block-size: 360px' },
        strip({ label: 'Tinted modules' }),
        strip({ label: 'Plain modules', appearance: 'plain' })),
      h('div', { style: 'display: flex; flex: 1 1 16rem; min-inline-size: 0; block-size: 360px' }, sidebar.toElement())),
    strip({ label: 'Solid modules', appearance: 'solid', orientation: 'horizontal', side: 'top' }));
}

/** @returns {Node} */
function navigationCard() {
  return h('div', { class: 'studio-stack' },
    new NavigationBar(null, {
      title: 'Billing',
      items: [
        { name: 'invoices', title: 'Invoices' },
        { name: 'credits', title: 'Credit notes', badge: '3' },
        { name: 'dunning', title: 'Dunning' }
      ],
      active: 'invoices'
    }).toElement(),
    new Breadcrumb(null, {
      items: [
        { name: 'home', label: 'Billing' },
        { name: 'invoices', label: 'Invoices' },
        { name: 'record', label: 'INV-26041' }
      ]
    }).toElement(),
    new Stepper(null, {
      steps: [
        { name: 'draft', title: 'Draft' },
        { name: 'review', title: 'Review' },
        { name: 'post', title: 'Post' }
      ],
      active: 'review'
    }).toElement(),
    new Toolbar(null, {
      items: [
        { name: 'new', label: 'New', icon: 'plus', kind: 'primary' },
        { name: 'edit', label: 'Edit', icon: 'file' },
        '-',
        { name: 'filter', label: 'Filter', icon: 'filter', active: true },
        { name: 'delete', label: 'Delete', icon: 'trash', kind: 'danger' }
      ]
    }).toElement());
}

/** @returns {Node} */
function containersCard() {
  return h('div', { class: 'studio-stack' },
    new Card(null, {
      title: 'Alpine Works GmbH',
      link: '#card-containers',
      content: 'Account · 3 open opportunities',
      footer: 'Last contact yesterday',
      actions: [{ icon: 'dots', title: 'Account actions', kind: 'ghost', size: 'sm' }]
    }).toElement(),
    new Panel(null, {
      title: 'Delivery address',
      content: h('p', { class: 'studio-prose' }, 'A raised surface with a header and an optional footer.'),
      buttons: [{ icon: 'reload', size: 'sm', kind: 'ghost', title: 'Refresh' }],
      footer: h('small', {}, 'Last edited 14:02')
    }).toElement(),
    new Groupbox(null, {
      title: 'Advanced options',
      content: h('p', { class: 'studio-prose' }, 'A flat collapsible section for secondary settings.')
    }).toElement(),
    h('div', { class: 'studio-frame' },
      new MasterPanel(null, {
        title: 'INV-26041',
        module: 'billing',
        content: h('p', { class: 'studio-prose' },
          'The module accent colours the header — a second, orthogonal colour axis that a theme '
          + 'preset leaves alone.'),
        buttons: [{ label: 'Post', kind: 'primary', size: 'sm' }]
      }).toElement()));
}

/**
 * @param {(fn: () => void) => void} teardown
 * @returns {Node}
 */
function overlaysCard(teardown) {
  const modal = new Modal(null, { width: 420 });
  modal.setContent(h('div', { class: 'studio-stack' },
    h('strong', {}, 'Post invoice'),
    h('p', { class: 'studio-prose' },
      'Posting locks the document and assigns the next number in the range.'),
    row(button({ label: 'Cancel', onclick: () => modal.close('cancel') }),
      button({ label: 'Post', kind: 'primary', onclick: () => modal.close('post') }))));

  const dialog = new Dialog(null, {
    title: 'Record payment',
    size: 'sm',
    content: h('p', { class: 'studio-prose' },
      'A dialog brings its own header, footer, and button row; a modal is the bare surface.'),
    buttons: [{ label: 'Close', kind: 'primary', action: 'close', autofocus: true }]
  });

  const sheet = new Sheet(null, {
    title: 'Invoice details',
    side: 'end',
    size: 360,
    content: h('p', { class: 'studio-prose' },
      'An overlay Sheet uses the quieter glass panel; docking the same Sheet makes it opaque.'),
    buttons: [{ label: 'Close', kind: 'primary', action: 'close' }]
  });

  const anchor = button({ label: 'Assign to', icon: 'chevron-down' });
  const dropdown = new Dropdown(anchor, {
    matchWidth: true,
    content: h('div', { class: 'studio-menu' },
      PEOPLE.map((person) => button({ label: person.name, kind: 'ghost', size: 'sm' })))
  });

  const toasts = new Set();
  const contextTarget = h('div', { class: 'studio-contextzone' }, 'Right-click anywhere in this area');
  const menu = new ContextMenu(contextTarget, {
    items: [{ label: 'Open', icon: 'eye', value: 'open' }, { label: 'Duplicate', icon: 'copy', value: 'copy' },
      '-', { label: 'Delete', icon: 'trash', value: 'delete', danger: true }]
  });
  const hinted = button({ label: 'Hover me' });
  const hint = tooltip(hinted, 'Tooltips inherit the raised surface and the overlay shadow.');

  teardown(() => {
    for (const handle of toasts) handle.close();
    hint.destroy();
    modal.destroy();
    dialog.destroy();
    sheet.destroy();
    menu.destroy();
    dropdown.destroy();
  });

  const toast = (kind) => toasts.add(Message[kind](`A ${kind} toast, themed like everything else.`));

  const canvas = h('div', { class: 'studio-overlay-canvas studio-stack' },
    row(
      button({ label: 'Modal', onclick: () => modal.open() }),
      button({ label: 'Dialog', onclick: () => dialog.open() }),
      button({ label: 'Sheet', onclick: () => sheet.open() }),
      hinted),
    row(anchor),
    row(
      button({ label: 'Info', size: 'sm', onclick: () => toast('info') }),
      button({ label: 'Success', size: 'sm', onclick: () => toast('success') }),
      button({ label: 'Warning', size: 'sm', onclick: () => toast('warning') }),
      button({ label: 'Error', size: 'sm', kind: 'danger', onclick: () => toast('error') })),
    contextTarget);
  new Aurora(canvas, {
    preset: 'confluence',
    colors: ['#21cc75', '#2b7fff', '#9a67ff', '#f05a8a'],
    intensity: 'vivid'
  });
  return canvas;
}

/** @returns {Node} */
function hierarchyCard() {
  const tree = new TreeView(null, { items: TREE, expanded: ['accounts'], selected: ['alpine'] });
  return h('div', { class: 'studio-stack' },
    h('div', { class: 'studio-frame studio-frame--short' }, tree.toElement()),
    h('div', { class: 'studio-frame studio-frame--short' },
      new Finder(null, { items: TREE }).toElement()));
}

/** @returns {Node} */
function listsCard() {
  return h('div', { class: 'studio-stack' },
    field('Tags', new ValueList(null, { values: ['recurring', 'net-14'], placeholder: 'Add a tag…' }).toElement()),
    field('Contact e-mail', new MultiValueEditor(null, {
      values: ['billing@alpineworks.example', 'ap@alpineworks.example']
    }).toElement()));
}

/** @returns {Node} */
function statesCard() {
  return h('div', { class: 'studio-stack' },
    emptyState({
      icon: 'file',
      title: 'No credit notes yet',
      description: 'Credit notes raised against this invoice will appear here.',
      actions: [{ label: 'New credit note', kind: 'primary', icon: 'plus' }],
      size: 'sm'
    }),
    h('div', { class: 'studio-frame studio-frame--short' }, skeletonText({ lines: 3 })));
}

/** @returns {Node} */
function iconsCard() {
  return h('div', { class: 'studio-icons' },
    iconNames().map((name) => h('span', { class: 'studio-icons__cell', title: name }, icon(name))));
}

/* -------------------------------------------------------------------- helpers -- */

/** @param {...(Node|string)} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { class: 'studio-row' }, ...children);
}

/** @param {string} label @param {Node} control @returns {HTMLElement} */
function field(label, control) {
  return h('label', { class: 'studio-field' },
    h('span', { class: 'studio-field__label' }, label), control);
}

/** @param {string} name @returns {HTMLElement} */
function tabBody(name) {
  return h('p', { class: 'studio-prose' }, `${name} panel.`);
}
