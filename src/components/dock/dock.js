import { Component } from '../../core/component.js';
import { STEP, STEP_LARGE, dragAxis } from '../../core/drag-axis.js';
import { matchBreakpoint, onBreakpoint } from '../../core/breakpoint.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { rovingTabindex } from '../../core/keyboard.js';
import { storage } from '../../core/storage.js';
import { clamp, uid } from '../../core/util.js';

/** Storage namespace shared by every dock that opted into persistence. */
const STORAGE_NAMESPACE = 'dock';

/** @typedef {string|Node|Component|null} DockContentValue */
/** @typedef {DockContentValue|(() => DockContentValue)} DockContent */

/**
 * @typedef {Object} DockTab
 * @property {string} name Stable tab name.
 * @property {string} title Visible tab label.
 * @property {DockContent} [content] Panel content, or a factory called on first reveal.
 */

/**
 * @typedef {Object} DockPane
 * @property {string} name Stable pane name.
 * @property {string} [title=''] Header title. For a tab group it names the collapse control only.
 * @property {DockContent} [content] Body content, or a factory called on first reveal. Ignored
 *   when `tabs` is given.
 * @property {DockTab[]} [tabs] Tabs whose strip replaces the pane's title in the header.
 * @property {string} [active] Initially active tab name; defaults to the first tab.
 * @property {number|string} [size] Initial size along the dock's axis. A number is pixels.
 * @property {number} [min=0] Smallest the pane may be dragged to, in pixels. Never smaller than
 *   its own header.
 * @property {boolean} [grow=false] Whether this pane absorbs leftover space. At most one pane
 *   does; with `content` present the content absorbs it instead.
 * @property {boolean} [collapsed=false] Whether the pane starts collapsed to its header.
 * @property {boolean} [collapsible=true] Whether the pane may be collapsed at all.
 * @property {'start'|'end'} [side='start'] Which side of `content` the pane sits on. Ignored when
 *   the dock has no `content`.
 */

/**
 * @typedef {Object} DockState
 * @property {Record<string, number>} sizes Pane sizes in pixels, by pane name.
 * @property {string[]} collapsed Names of collapsed panes.
 * @property {Record<string, string>} active Active tab name, by pane name.
 */

/**
 * @typedef {Object} DockOptions
 * @property {'vertical'|'horizontal'} [orientation='vertical'] Axis the panes stack along.
 *   `vertical` stacks them top to bottom behind horizontal dividers.
 * @property {DockContent} [content=null] Optional flexible middle. With it the dock is a region
 *   and panes sit on either `side` of it; without it the panes fill the dock.
 * @property {DockPane[]} [panes=[]] Panes, in order.
 * @property {boolean} [resizable=true] Whether dividers may be dragged.
 * @property {boolean} [collapsible=true] Default for `pane.collapsible`.
 * @property {boolean} [lazy=true] Whether content factories run on first reveal rather than up
 *   front.
 * @property {string|null} [storageKey=null] Key under which sizes, collapsed panes, and active
 *   tabs are remembered. Storage failures degrade to memory rather than throwing.
 * @property {string} [label='Resize panes'] Accessible name given to every divider.
 * @property {(event: CustomEvent<{name: string}>) => void} [oncollapse] Collapse listener.
 * @property {(event: CustomEvent<{name: string}>) => void} [onexpand] Expand listener.
 * @property {(event: CustomEvent<{name: string, size: number}>) => void} [onresize] Resize listener.
 * @property {(event: CustomEvent<{pane: string, tab: string, previous: string|null}>) => void} [ontabchange] Tab listener.
 * @property {(event: CustomEvent<{name: string}>) => void} [onreveal] Reveal listener.
 */

/**
 * A stack of collapsible, resizable panes — the docked inspector column of a design tool, and the
 * detail side of an ERP master–detail screen.
 *
 * The sizing model is one custom property per pane and one flex rule: a sized pane is
 * `flex: 0 0 var(--zx-pane-size)`, a collapsed one falls to `flex: 0 0 auto` with its body hidden,
 * and exactly one pane (or the `content`, when there is one) grows to absorb the slack. That is
 * what keeps a drag local — it rewrites two properties and nothing else moves — and what makes
 * collapsing feed the grower rather than redistributing across every pane.
 *
 * A pane is either titled or a tab group. A tab group puts its strip where the title would go,
 * which is the pattern every panel dock uses and the reason `tabs` is a key on a pane rather than
 * a separate component nested inside one.
 * @fires Dock#collapse
 * @fires Dock#expand
 * @fires Dock#resize
 * @fires Dock#tabchange
 * @fires Dock#reveal
 * @extends {Component<DockOptions>}
 */
export class Dock extends Component {
  static cssName = 'dock';

  /** @type {Readonly<DockOptions>} */
  static defaults = {
    orientation: 'vertical',
    content: null,
    panes: [],
    resizable: true,
    collapsible: true,
    lazy: true,
    storageKey: null,
    label: 'Resize panes'
  };

  /**
   * Creates a dock, or turns an existing element into one.
   * @param {Element|string|null} [target=null] Existing container, selector, or null.
   * @param {DockOptions} [options={}] Dock options.
   */
  constructor(target = null, options = {}) {
    super(target, options);

    const key = this.options.storageKey;
    if (key !== null && key !== undefined && key !== '') {
      this._store = storage(STORAGE_NAMESPACE);
      const stored = this._store.get(String(key));
      if (stored && typeof stored === 'object') this.setState(stored);
    }
    this._syncGrow();
    this._syncDividers();
  }

  /**
   * Builds the panes, dividers, and optional content region. Runs inside the base constructor,
   * before any class field would exist, so all state is assigned here as plain properties.
   * @returns {HTMLElement}
   */
  render() {
    const options = /** @type {DockOptions} */ (this.options);
    this._orientation = options.orientation === 'horizontal' ? 'horizontal' : 'vertical';
    this._resizable = options.resizable !== false;
    this._lazy = options.lazy !== false;
    this._destroyed = false;
    /** @type {Map<string, Record<string, any>>} */
    this._panes = new Map();
    /** @type {ReturnType<typeof storage>|null} */
    this._store = null;
    /** @type {Record<string, any>|null} */
    this._drag = null;
    /**
     * One controller per divider. Dividers are rebuilt on every relayout, so the old controllers
     * have to come down with them or each relayout would leave a set behind.
     * @type {ReturnType<typeof dragAxis>[]}
     */
    this._dividerDrags = [];

    this._createdRoot = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    root.dataset.orientation = this._orientation;
    root.replaceChildren();

    this._content = options.content == null ? null : h('div', {
      class: 'zx-dock__content', ref: 'content'
    });
    if (this._content) appendContent(this._content, options.content, false);

    for (const definition of Array.isArray(options.panes) ? options.panes : []) {
      this._panes.set(String(definition.name), this._buildPane(definition));
    }
    this._layout();
    return root;
  }

  /**
   * Returns a pane's record.
   * @param {string} name Pane name.
   * @returns {Record<string, any>|null}
   */
  pane(name) {
    return this._panes.get(String(name)) ?? null;
  }

  /**
   * Lists pane names in visual order.
   * @returns {string[]}
   */
  names() {
    return [...this._panes.keys()];
  }

  /**
   * Adds a pane.
   * @param {DockPane} definition Pane definition.
   * @param {{index?: number}} [options={}] Insertion index; omitted appends.
   * @returns {Record<string, any>}
   */
  add(definition, options = {}) {
    const name = String(definition?.name ?? '');
    if (!name) throw new TypeError('Dock pane requires a name');
    if (this._panes.has(name)) this.remove(name);
    const record = this._buildPane(definition);
    const entries = [...this._panes.entries()];
    const index = Number.isInteger(options.index)
      ? clamp(Number(options.index), 0, entries.length)
      : entries.length;
    entries.splice(index, 0, [name, record]);
    this._panes = new Map(entries);
    this._layout();
    this._syncGrow();
    this._syncDividers();
    return record;
  }

  /**
   * Removes a pane and its element.
   * @param {string} name Pane name.
   * @returns {this}
   */
  remove(name) {
    const record = this._panes.get(String(name));
    if (!record) return this;
    if (record.kind === 'sheet') return this.release(record.sheet);
    record.roving?.destroy();
    record.element.remove();
    this._panes.delete(String(name));
    this._layout();
    this._syncGrow();
    this._syncDividers();
    return this;
  }

  /**
   * Collapses a pane to its header.
   * @param {string} name Pane name.
   * @returns {this}
   * @fires Dock#collapse
   */
  collapse(name) {
    const record = this._panes.get(String(name));
    if (!record || !record.collapsible || record.collapsed) return this;
    record.collapsed = true;
    this._syncPaneState(record);
    this._syncGrow();
    this._syncDividers();
    this._persist();
    this.emit('collapse', { name: record.name });
    return this;
  }

  /**
   * Expands a pane.
   * @param {string} name Pane name.
   * @returns {this}
   * @fires Dock#expand
   */
  expand(name) {
    const record = this._panes.get(String(name));
    if (!record || !record.collapsed) return this;
    record.collapsed = false;
    this._syncPaneState(record);
    this._materialize(record);
    this._syncGrow();
    this._syncDividers();
    this._persist();
    this.emit('expand', { name: record.name });
    return this;
  }

  /**
   * Toggles a pane's collapsed state.
   * @param {string} name Pane name.
   * @returns {this}
   */
  toggle(name) {
    const record = this._panes.get(String(name));
    if (!record) return this;
    return record.collapsed ? this.expand(name) : this.collapse(name);
  }

  /**
   * Reports whether a pane is collapsed.
   * @param {string} name Pane name.
   * @returns {boolean}
   */
  isCollapsed(name) {
    return Boolean(this._panes.get(String(name))?.collapsed);
  }

  /**
   * Brings something into view by name — a pane, or a tab in one of them. Expands the pane,
   * activates the tab where the name is a tab's, and scrolls the pane into view.
   * @param {string} name Pane or tab name.
   * @returns {this}
   * @fires Dock#reveal
   */
  reveal(name) {
    const key = String(name);
    let record = this._panes.get(key);
    if (record) this.expand(key);
    else {
      for (const candidate of this._panes.values()) {
        if (!candidate.tabs?.has(key)) continue;
        record = candidate;
        this.expand(candidate.name);
        this.activate(candidate.name, key);
        break;
      }
    }
    if (!record) return this;
    record.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.emit('reveal', { name: record.name });
    return this;
  }

  /**
   * Sets a pane's size along the dock's axis.
   * @param {string} name Pane name.
   * @param {number|string} size Pixels, or any CSS length.
   * @returns {this}
   */
  setSize(name, size) {
    const record = this._panes.get(String(name));
    if (!record) return this;
    const value = normalizeSize(size);
    if (value === null) record.element.style.removeProperty('--zx-pane-size');
    else record.element.style.setProperty('--zx-pane-size', value);
    this._syncDividers();
    this._persist();
    return this;
  }

  /**
   * Returns a pane's current size in pixels.
   * @param {string} name Pane name.
   * @returns {number}
   */
  getSize(name) {
    const record = this._panes.get(String(name));
    return record ? this._axisSize(record.element) : 0;
  }

  /**
   * Activates a tab inside a tab-group pane.
   * @param {string} paneName Pane name.
   * @param {string} tabName Tab name.
   * @returns {this}
   * @fires Dock#tabchange
   */
  activate(paneName, tabName) {
    const record = this._panes.get(String(paneName));
    const tab = record?.tabs?.get(String(tabName));
    if (!tab || record.active === tab.name) return this;
    const previous = record.active;
    record.active = tab.name;
    for (const candidate of record.tabs.values()) {
      const selected = candidate === tab;
      candidate.tab.setAttribute('aria-selected', String(selected));
      candidate.tab.tabIndex = selected ? 0 : -1;
      candidate.panel.hidden = !selected;
    }
    this._materialize(record);
    this._persist();
    this.emit('tabchange', { pane: record.name, tab: tab.name, previous });
    return this;
  }

  /**
   * Returns the active tab name of a tab-group pane.
   * @param {string} paneName Pane name.
   * @returns {string|null}
   */
  getActive(paneName) {
    return this._panes.get(String(paneName))?.active ?? null;
  }

  /**
   * Captures the layout as a serialisable object.
   * @returns {DockState}
   */
  state() {
    /** @type {DockState} */
    const state = { sizes: {}, collapsed: [], active: {} };
    for (const record of this._panes.values()) {
      if (record.kind === 'sheet') continue;
      if (record.collapsed) state.collapsed.push(record.name);
      else if (!record.grow) {
        const size = this._axisSize(record.element);
        if (size > 0) state.sizes[record.name] = size;
      }
      if (record.active) state.active[record.name] = record.active;
    }
    return state;
  }

  /**
   * Restores a layout captured by `state()`. Unknown pane names are ignored, so a stored layout
   * survives a release that added or removed panes.
   * @param {DockState} state Layout state.
   * @returns {this}
   */
  setState(state) {
    if (!state || typeof state !== 'object') return this;
    const collapsed = new Set(Array.isArray(state.collapsed) ? state.collapsed.map(String) : []);
    for (const record of this._panes.values()) {
      if (record.kind === 'sheet') continue;
      const size = state.sizes?.[record.name];
      if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
        record.element.style.setProperty('--zx-pane-size', `${size}px`);
      }
      const active = state.active?.[record.name];
      if (active && record.tabs?.has(String(active))) this.activate(record.name, String(active));
      const shouldCollapse = collapsed.has(record.name);
      if (shouldCollapse !== record.collapsed && record.collapsible) {
        record.collapsed = shouldCollapse;
        this._syncPaneState(record);
      }
    }
    this._syncGrow();
    this._syncDividers();
    return this;
  }

  /**
   * Removes created nodes and restores an enhanced target.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const controller of this._dividerDrags) controller.destroy();
    this._dividerDrags = [];
    for (const record of this._panes.values()) {
      record.roving?.destroy();
      record.breakpoint?.destroy();
      // The dock never owned the sheet, so it hands it back rather than taking it down with it.
      if (record.kind === 'sheet') record.sheet._setDock(null);
    }
    super.destroy();
    if (!this._createdRoot && this._snapshot) restoreTarget(this.el, this._snapshot);
  }

  /**
   * Builds one pane, titled or tabbed.
   * @param {DockPane} definition Pane definition.
   * @returns {Record<string, any>}
   */
  _buildPane(definition) {
    const name = String(definition.name);
    const title = String(definition.title ?? '');
    const collapsible = definition.collapsible ?? this.options.collapsible !== false;
    const bodyId = uid('zx-dock-body');
    const hasTabs = Array.isArray(definition.tabs) && definition.tabs.length > 0;

    const chevron = h('span', { class: 'zx-dock__chevron', ariaHidden: 'true' },
      icon('chevron-right', { size: 14 }));
    const toggle = h('button', {
      class: 'zx-dock__toggle',
      type: 'button',
      ariaControls: bodyId,
      ariaExpanded: 'true',
      // A tabbed pane's visible text belongs to its tabs, so the control names itself.
      ariaLabel: hasTabs ? (title || name) : null
    }, chevron, hasTabs ? null : h('span', { class: 'zx-dock__title' }, title));
    if (!collapsible) toggle.disabled = true;

    const header = h('div', { class: 'zx-dock__header' }, toggle);
    const body = h('div', { class: 'zx-dock__body', id: bodyId });
    const element = h('section', {
      class: 'zx-dock__pane',
      dataset: { name, state: 'open' }
    }, header, body);

    const record = {
      name,
      title,
      element,
      header,
      body,
      toggle,
      collapsible,
      collapsed: false,
      grow: Boolean(definition.grow),
      side: definition.side === 'end' ? 'end' : 'start',
      min: Number.isFinite(definition.min) ? Math.max(0, Number(definition.min)) : 0,
      /** @type {Map<string, Record<string, any>>|null} */
      tabs: null,
      /** @type {string|null} */
      active: null,
      content: null,
      built: false,
      roving: null
    };

    if (hasTabs) {
      record.tabs = new Map();
      const list = h('div', {
        class: 'zx-dock__tabs',
        role: 'tablist',
        ariaOrientation: 'horizontal',
        ariaLabel: title || name
      });
      for (const tabDefinition of definition.tabs) {
        const tabName = String(tabDefinition.name);
        const tabId = uid('zx-dock-tab');
        const panelId = uid('zx-dock-panel');
        const tab = h('button', {
          class: 'zx-dock__tab',
          type: 'button',
          role: 'tab',
          id: tabId,
          ariaControls: panelId,
          ariaSelected: 'false',
          tabindex: -1
        }, String(tabDefinition.title ?? tabName));
        const panel = h('div', {
          class: 'zx-dock__panel',
          role: 'tabpanel',
          id: panelId,
          ariaLabelledby: tabId,
          tabindex: 0,
          hidden: true
        });
        list.append(tab);
        body.append(panel);
        record.tabs.set(tabName, { name: tabName, tab, panel, content: tabDefinition.content, built: false });
      }
      header.append(list);
      record.roving = rovingTabindex(list, '.zx-dock__tab', { orientation: 'horizontal' });
      this.listen(list, 'click', (event) => {
        const button = /** @type {Element} */ (event.target).closest?.('.zx-dock__tab');
        if (!button || !list.contains(button)) return;
        const found = [...record.tabs.values()].find((candidate) => candidate.tab === button);
        if (found) this.activate(record.name, found.name);
      });
      const first = String(definition.active ?? '');
      const initial = record.tabs.has(first) ? first : [...record.tabs.keys()][0];
      // Assigned directly rather than through activate(), which would emit before construction ends.
      record.active = initial;
      for (const candidate of record.tabs.values()) {
        const selected = candidate.name === initial;
        candidate.tab.setAttribute('aria-selected', String(selected));
        candidate.tab.tabIndex = selected ? 0 : -1;
        candidate.panel.hidden = !selected;
      }
    } else {
      record.content = h('div', { class: 'zx-dock__pane-content' });
      body.append(record.content);
      record.factory = definition.content;
    }

    const size = normalizeSize(definition.size);
    if (size !== null) element.style.setProperty('--zx-pane-size', size);
    if (collapsible) this.listen(toggle, 'click', () => this.toggle(record.name));
    if (definition.collapsed && collapsible) {
      record.collapsed = true;
      this._syncPaneState(record);
    }
    if (!this._lazy || !record.collapsed) this._materialize(record);
    return record;
  }

  /**
   * Runs any not-yet-run content factory for whatever the pane currently shows.
   * @param {Record<string, any>} record Pane record.
   * @returns {void}
   */
  _materialize(record) {
    if (record.collapsed) return;
    if (record.tabs) {
      const active = record.tabs.get(record.active);
      if (!active || active.built) return;
      active.built = true;
      appendContent(active.panel, active.content, true);
      return;
    }
    if (record.built) return;
    record.built = true;
    appendContent(record.content, record.factory, true);
  }

  /**
   * Re-inserts panes, dividers, and the content region in visual order.
   * @returns {void}
   */
  _layout() {
    const records = [...this._panes.values()]
      // A sheet the breakpoint floated back to an overlay is still registered, but it is the
      // document's child now and must not claim a track.
      .filter((record) => record.kind !== 'sheet' || record.sheet.isDocked());
    const order = this._content
      ? [...records.filter((record) => record.side === 'start'), this._content,
        ...records.filter((record) => record.side === 'end')]
      : records;
    for (const controller of this._dividerDrags) controller.destroy();
    this._dividerDrags = [];
    /** @type {Node[]} */
    const children = [];
    order.forEach((entry, index) => {
      if (index > 0) children.push(this._divider());
      children.push(entry instanceof Element ? entry : entry.element);
    });
    /** @type {HTMLElement} */ (this.el).replaceChildren(...children);
  }

  /**
   * Creates one divider with its separator semantics and drag wiring.
   * @returns {HTMLElement}
   */
  _divider() {
    const divider = h('div', {
      class: 'zx-dock__divider',
      role: 'separator',
      tabindex: this._resizable ? 0 : -1,
      // A separator's aria-orientation describes the separator, not the stack: panes stacked
      // vertically are parted by horizontal lines.
      ariaOrientation: this._orientation === 'vertical' ? 'horizontal' : 'vertical',
      ariaLabel: String(this.options.label ?? 'Resize panes')
    });
    this._dividerDrags.push(dragAxis(divider, {
      orientation: this._orientation,
      disabled: () => !this._resizable,
      onStart: () => {
        const { before, after } = this._neighbours(divider);
        const subject = this._resizeSubject(before, after);
        if (!subject) return false;
        this._drag = {
          subject,
          startSize: this._axisSize(subject.element),
          oppositeStart: subject.opposite ? this._axisSize(subject.opposite.element) : 0
        };
        /** @type {HTMLElement} */ (this.el).dataset.dragging = 'true';
        return true;
      },
      onMove: (delta) => this._trackDelta(delta),
      onEnd: (delta, moved) => {
        if (moved) this._trackDelta(delta);
        this._drag = null;
        delete /** @type {HTMLElement} */ (this.el).dataset.dragging;
        if (moved) this._persist();
      },
      onStep: (direction, large) => this._stepDivider(divider, direction * (large ? STEP_LARGE : STEP)),
      onActivate: () => {
        const { before } = this._neighbours(divider);
        if (before?.collapsible) this.toggle(before.name);
      }
    }));
    return divider;
  }

  /**
   * Whether a record currently occupies no usable space: a collapsed pane, or a closed sheet.
   * A closed sheet differs from a collapsed pane in that it leaves nothing at all behind, not
   * even a header — which is why the two cannot share one flag.
   * @param {Record<string, any>} record Pane or sheet record.
   * @returns {boolean}
   */
  _isHidden(record) {
    return record.kind === 'sheet' ? !record.sheet.isOpen() : Boolean(record.collapsed);
  }

  /**
   * Hands a Sheet's positioning to this dock. The sheet becomes a track in the dock's flow: the
   * dock owns its side, size, and resizing, while the sheet keeps its own content and lifecycle.
   *
   * Nothing about the sheet is rebuilt — adoption moves the element and reopens it in place, so
   * listeners and DOM state survive the handoff.
   * @param {Object} sheet Sheet to adopt.
   * @param {{name?: string, side?: 'start'|'end', index?: number, size?: number|string,
   *   min?: number, dockAt?: 'sm'|'md'|'lg'|'xl'|null}} [options={}] Placement options.
   *   `dockAt` floats the sheet back to a free overlay below that breakpoint, measured on the
   *   dock's own width.
   * @returns {Record<string, any>}
   */
  adopt(sheet, options = {}) {
    if (!sheet || typeof sheet._setDock !== 'function' || !sheet.el) {
      throw new TypeError('Dock.adopt expects a Sheet');
    }
    const name = String(options.name ?? sheet.el.id ?? '') || uid('zx-dock-sheet');
    const record = {
      kind: 'sheet',
      name,
      sheet,
      element: sheet.el,
      side: options.side === 'end' ? 'end' : 'start',
      min: Number.isFinite(options.min) ? Math.max(0, Number(options.min)) : 0,
      grow: false,
      collapsed: false,
      collapsible: false,
      breakpoint: null,
      resync: null
    };
    const entries = [...this._panes.entries()];
    const index = Number.isInteger(options.index)
      ? clamp(Number(options.index), 0, entries.length)
      : entries.length;
    entries.splice(index, 0, [name, record]);
    this._panes = new Map(entries);

    const size = normalizeSize(options.size);
    if (size !== null) sheet.el.style.setProperty('--zx-pane-size', size);

    // A docked sheet opening or closing changes what the stack has to absorb.
    record.resync = () => {
      this._syncGrow();
      this._syncDividers();
    };
    sheet.on('open', record.resync);
    sheet.on('close', record.resync);

    const dockAt = options.dockAt ?? null;
    if (dockAt) {
      /*
       * Measured on the dock itself rather than the viewport: a dock inside a split pane knows
       * nothing about the window, and docking does not change the dock's own width, so there is
       * no feedback loop between the observer and what it triggers.
       */
      record.breakpoint = onBreakpoint((_name, width) => {
        this._applyDockAt(record, matchBreakpoint(dockAt, width));
      }, { target: this.el });
    } else {
      this._applyDockAt(record, true);
    }
    return record;
  }

  /**
   * Hands a sheet back. It becomes a free overlay again, still open if it was open.
   * @param {Object} sheet Sheet to release.
   * @returns {this}
   */
  release(sheet) {
    const record = [...this._panes.values()].find((candidate) => candidate.sheet === sheet);
    if (!record) return this;
    record.breakpoint?.destroy();
    record.breakpoint = null;
    this._panes.delete(record.name);
    sheet.off('open', record.resync);
    sheet.off('close', record.resync);
    sheet.el.style.removeProperty('--zx-pane-size');
    sheet._setDock(null);
    this._layout();
    this._syncGrow();
    this._syncDividers();
    return this;
  }

  /**
   * Drops a sheet that destroyed itself while adopted, without re-hosting a dead element.
   * @param {Object} sheet Sheet being destroyed.
   * @returns {void}
   */
  _forget(sheet) {
    const record = [...this._panes.values()].find((candidate) => candidate.sheet === sheet);
    if (!record) return;
    record.breakpoint?.destroy();
    this._panes.delete(record.name);
    if (this._destroyed) return;
    this._layout();
    this._syncGrow();
    this._syncDividers();
  }

  /**
   * Docks or floats one adopted sheet, per its breakpoint.
   * @param {Record<string, any>} record Sheet record.
   * @param {boolean} docked Whether the dock is wide enough to hold it.
   * @returns {void}
   */
  _applyDockAt(record, docked) {
    if (record.sheet.isDocked() === docked) return;
    record.sheet._setDock(docked ? this : null);
    this._layout();
    this._syncGrow();
    this._syncDividers();
  }

  /**
   * Picks which element absorbs leftover space. The content always wins where there is one;
   * otherwise the declared `grow` pane, or the last expanded pane so the stack still fills.
   * @returns {void}
   */
  _syncGrow() {
    const records = [...this._panes.values()];
    for (const record of records) record.element.removeAttribute('data-grow');
    if (this._content) return;
    const expanded = records.filter((record) => !this._isHidden(record));
    if (expanded.length === 0) return;
    const declared = expanded.find((record) => record.grow);
    (declared ?? expanded[expanded.length - 1]).element.dataset.grow = 'true';
  }

  /**
   * Refreshes every divider's live separator values and disables the ones with nothing to resize.
   * @returns {void}
   */
  _syncDividers() {
    for (const divider of this._dividers()) {
      const { before, after } = this._neighbours(divider);
      const subject = this._resizeSubject(before, after);
      const enabled = this._resizable && subject !== null;
      divider.toggleAttribute('data-disabled', !enabled);
      divider.tabIndex = enabled ? 0 : -1;
      if (!enabled) {
        divider.removeAttribute('aria-valuenow');
        continue;
      }
      const total = this._axisSize(/** @type {HTMLElement} */ (this.el));
      divider.setAttribute('aria-valuenow', String(Math.round(this._axisSize(subject.element))));
      divider.setAttribute('aria-valuemin', String(Math.round(this._minSize(subject))));
      divider.setAttribute('aria-valuemax', String(Math.round(total)));
      divider.setAttribute('aria-controls', subject.element.id || setId(subject.element));
    }
  }

  /**
   * Applies the collapsed flag to the DOM.
   * @param {Record<string, any>} record Pane record.
   * @returns {void}
   */
  _syncPaneState(record) {
    record.element.dataset.state = record.collapsed ? 'collapsed' : 'open';
    record.toggle.setAttribute('aria-expanded', String(!record.collapsed));
  }

  /** @returns {HTMLElement[]} */
  _dividers() {
    return [.../** @type {HTMLElement} */ (this.el).querySelectorAll(':scope > .zx-dock__divider')];
  }

  /**
   * @param {HTMLElement} divider
   * @returns {{before: Record<string, any>|null, after: Record<string, any>|null}}
   */
  _neighbours(divider) {
    const find = (/** @type {Element|null} */ element) => {
      if (!element) return null;
      for (const record of this._panes.values()) if (record.element === element) return record;
      return null;
    };
    return { before: find(divider.previousElementSibling), after: find(divider.nextElementSibling) };
  }

  /**
   * Decides which pane a divider actually resizes. A pane that grows or is collapsed is not a
   * candidate, and neither is the content region — dragging beside those resizes the other side.
   * @param {Record<string, any>|null} before
   * @param {Record<string, any>|null} after
   * @returns {{element: HTMLElement, record: Record<string, any>, sign: number, opposite: Record<string, any>|null}|null}
   */
  _resizeSubject(before, after) {
    const sizable = (/** @type {Record<string, any>|null} */ record) =>
      Boolean(record) && !this._isHidden(record) && record.element.dataset.grow !== 'true';
    if (sizable(before)) {
      return { element: before.element, record: before, sign: 1, opposite: sizable(after) ? after : null };
    }
    if (sizable(after)) return { element: after.element, record: after, sign: -1, opposite: null };
    return null;
  }

  /** @param {Record<string, any>} subject @returns {number} */
  _minSize(subject) {
    const element = subject.record.header
      ?? subject.record.element.querySelector('.zx-dialog__header')
      ?? subject.record.element;
    const header = element.getBoundingClientRect();
    const headerSize = this._orientation === 'vertical' ? header.height : header.width;
    return Math.max(subject.record.min, headerSize);
  }

  /** @param {Element} element @returns {number} */
  _axisSize(element) {
    const rect = element.getBoundingClientRect();
    return this._orientation === 'vertical' ? rect.height : rect.width;
  }

  /**
   * Applies a pointer delta to the pane the divider resizes, and to its neighbour where the pair
   * shares a fixed budget.
   * @param {number} delta Pixels travelled along the axis since the drag began.
   * @returns {void}
   */
  _trackDelta(delta) {
    if (!this._drag || this._destroyed) return;
    const { subject, startSize, oppositeStart } = this._drag;
    const min = this._minSize(subject);
    let next = Math.max(min, startSize + delta * subject.sign);
    /*
     * With a sizable pane on both sides the pair shares a fixed budget, so the neighbour's own
     * minimum caps how far this one may grow — otherwise the stack would push past its own end.
     */
    if (subject.opposite) {
      const oppositeMin = this._minSize({ record: subject.opposite, element: subject.opposite.element });
      next = Math.max(min, Math.min(next, startSize + oppositeStart - oppositeMin));
      subject.opposite.element.style.setProperty('--zx-pane-size', `${startSize + oppositeStart - next}px`);
    }
    subject.element.style.setProperty('--zx-pane-size', `${next}px`);
    this._syncDividers();
    this.emit('resize', { name: subject.record.name, size: next });
  }

  /**
   * Moves a divider by a keyboard step.
   * @param {HTMLElement} divider Divider being driven.
   * @param {number} amount Signed pixels.
   * @returns {void}
   */
  _stepDivider(divider, amount) {
    const { before, after } = this._neighbours(divider);
    const subject = this._resizeSubject(before, after);
    if (!subject) return;
    const next = Math.max(this._minSize(subject), this._axisSize(subject.element) + amount * subject.sign);
    subject.element.style.setProperty('--zx-pane-size', `${next}px`);
    this._syncDividers();
    this._persist();
    this.emit('resize', { name: subject.record.name, size: next });
  }

  /** @returns {void} */
  _persist() {
    const key = this.options.storageKey;
    if (!this._store || key === null || key === undefined || key === '') return;
    this._store.set(String(key), this.state());
  }
}

/**
 * Emitted after a pane collapses.
 * @event Dock#collapse
 * @type {CustomEvent<{name: string}>}
 */

/**
 * Emitted after a pane expands.
 * @event Dock#expand
 * @type {CustomEvent<{name: string}>}
 */

/**
 * Emitted while a divider changes a pane's size.
 * @event Dock#resize
 * @type {CustomEvent<{name: string, size: number}>}
 */

/**
 * Emitted after a tab group switches tabs.
 * @event Dock#tabchange
 * @type {CustomEvent<{pane: string, tab: string, previous: string|null}>}
 */

/**
 * Emitted after `reveal()` brings a pane into view.
 * @event Dock#reveal
 * @type {CustomEvent<{name: string}>}
 */

/** @param {Element} element @returns {string} */
function setId(element) {
  const id = uid('zx-dock-pane');
  element.id = id;
  return id;
}

/** @param {number|string|null|undefined} size @returns {string|null} */
function normalizeSize(size) {
  if (size === null || size === undefined || size === '') return null;
  if (typeof size === 'number') return Number.isFinite(size) ? `${Math.max(0, size)}px` : null;
  return String(size);
}

/**
 * @param {Element} target
 * @param {DockContent} content
 * @param {boolean} callFactory Whether a function is a lazy content factory rather than a value.
 * @returns {void}
 */
function appendContent(target, content, callFactory) {
  const value = callFactory && typeof content === 'function' ? content() : content;
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number') {
    target.append(document.createTextNode(String(value)));
    return;
  }
  const node = value instanceof Component ? value.toElement() : value;
  if (node && typeof (/** @type {Node} */ (node).nodeType) === 'number') target.append(node);
}
