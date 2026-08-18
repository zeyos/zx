import {
  Groupbox as ZxGroupbox,
  MasterPanel as ZxMasterPanel,
  NavigationBar as ZxNavigationBar,
  Panel as ZxPanel,
  Search as ZxSearch,
  Tabbox as ZxTabbox
} from '../../index.js';
import { GxWrapper } from '../base.js';
import { legacyContent, targetElement } from './helpers.js';
import { LEGACY_EVENT_ARGS, translateTabboxOptions } from './options.js';

/** Legacy ZeyOS collapsible groupbox. */
export class Groupbox extends GxWrapper {
  static legacyName = 'gx.zeyos.Groupbox';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { title: '', open: true });
    const component = new ZxGroupbox(targetElement(display), {
      title: String(options.title ?? ''), open: options.open !== false
    });
    this._attach(component, {
      events: {
        open: { type: 'open', args: () => [this] },
        close: { type: 'close', args: () => [this] }
      },
      ui: { title: 'summary', inner: 'content' },
      setters: { title: 'setTitle', open: (value) => value ? this.open() : this.close() }
    });
    if (Object.hasOwn(options, 'content')) component.setContent(legacyContent(options.content));
    this._syncAct();
  }

  /** @returns {this} */
  toggle() { this._zx.toggle(); this._syncAct(); return this; }
  /** @returns {this} */
  open() { this._zx.open(); this._syncAct(); return this; }
  /** @returns {this} */
  close() { this._zx.close(); this._syncAct(); return this; }
  /** @returns {boolean} */
  isOpen() { return this._zx.isOpen(); }
  /** @param {string} title @returns {this} */
  setTitle(title) { this._zx.setTitle(title); return this; }
  /** @returns {void} */
  _syncAct() { this._mirrorAct(this.display('title'), this.isOpen()); }
}

/** Legacy positional panel wrapper. */
export class Panel extends GxWrapper {
  static legacyName = 'gx.zeyos.Panel';

  /** @param {Element|string|null} display @param {string} title @param {unknown} content @param {boolean} [open=true] */
  constructor(display, title = '', content = null, open = true) {
    super({ title, content, open });
    const component = new ZxPanel(targetElement(display), {
      title: String(title ?? ''), content: legacyContent(content), open: open !== false
    });
    this._attach(component, {
      events: { open: 'open', close: 'close' },
      // `title` is the clickable header: the Zx panel splits that into a toggle plus an action
      // area, and the toggle is what the legacy display key stood for.
      ui: { title: 'toggle', header: 'header', inner: 'content', content: 'content' },
      setters: { title: 'setTitle', content: 'setContent', open: (value) => value ? this.open() : this.close() }
    });
  }

  /** @returns {this} */
  toggle() { this._zx.toggle(); return this; }
  /** @returns {this} */
  open() { this._zx.open(); return this; }
  /** @returns {this} */
  close() { this._zx.close(); return this; }
  /** @returns {boolean} */
  isOpen() { return this._zx.isOpen(); }
  /** @param {unknown} content @returns {this} */
  setContent(content) { this._zx.setContent(legacyContent(content)); return this; }
  /** @param {string} title @returns {this} */
  setTitle(title) { this._zx.setTitle(title); return this; }
}

/** Legacy positional master panel wrapper. */
export class MasterPanel extends GxWrapper {
  static legacyName = 'gx.zeyos.MasterPanel';

  /** @param {Element|string|null} display @param {string} title @param {unknown} content @param {unknown[]} [buttons=[]] */
  constructor(display, title = '', content = null, buttons = []) {
    super({ title, content, buttons });
    const component = new ZxMasterPanel(targetElement(display), {
      title: String(title ?? ''), content: legacyContent(content), buttons: normalizeButtons(buttons)
    });
    this._attach(component, {
      ui: { title: 'title', inner: 'content', content: 'content', buttons: 'buttons' },
      setters: { title: 'setTitle', content: 'setContent', buttons: (value) => component.setButtons(normalizeButtons(value)) }
    });
  }

  /** @param {unknown} content @returns {this} */
  setContent(content) { this._zx.setContent(legacyContent(content)); return this; }
  /** @param {string} title @returns {this} */
  setTitle(title) { this._zx.setTitle(title); return this; }
}

/** Shared legacy tabbox implementation; subclasses only change warning identity. */
export class Tabbox extends GxWrapper {
  static legacyName = 'gx.zeyos.Tabbox';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { frames: [], show: 1 });
    const translated = translateTabboxOptions(options);
    const component = new ZxTabbox(targetElement(display), {
      tabs: translated.tabs.map(normalizeTab), active: translated.active
    });
    this._attach(component, {
      events: {
        change: { type: 'change', args: (detail) => LEGACY_EVENT_ARGS.tabChange(detail) },
        close: { type: 'close', args: (detail) => [detail.name] }
      },
      ui: { tablist: 'tablist', content: 'panels', div: 'tablist' },
      setters: { show: 'openTab', height: (value) => this.setStyle('height', value) }
    });
    if (translated.height != null) this.setStyle('height', translated.height);
    component.on('change', () => queueMicrotask(() => this._syncAct()));
    this._syncAct();
  }

  /** @param {Record<string, any>|string} frame @param {string} [title] @param {unknown} [content] @returns {this} */
  addTab(frame, title, content) {
    const definition = typeof frame === 'object' ? frame : { name: frame, title, content };
    this._zx.addTab(normalizeTab(definition));
    this._syncAct();
    return this;
  }

  /** @param {string} name @returns {this} */
  closeTab(name) { this._zx.removeTab(String(name)); this._syncAct(); return this; }
  /** @param {string|number} name @returns {this} */
  openTab(name) {
    const resolved = typeof name === 'number' ? this._zx._tabs?.[name - 1]?.definition.name : String(name);
    if (resolved) this._zx.openTab(resolved);
    this._syncAct();
    return this;
  }
  /** @param {string} name @param {string} title @returns {this} */
  setTabTitle(name, title) { this._zx.setTitle(String(name), title); return this; }
  /** @param {string} name @param {unknown} content @param {string} [_style] @returns {this} */
  setHighlight(name, content, _style) { this._zx.setBadge(String(name), content == null || content === '' ? null : String(content)); return this; }
  /** @returns {string|null} */
  getActive() { return this._zx.getActive(); }
  /** @returns {void} */
  _syncAct() {
    for (const tab of this.display('tablist')?.querySelectorAll?.('[role="tab"]') ?? []) {
      this._mirrorAct(tab, tab.getAttribute('aria-selected') === 'true');
    }
  }
}

/** Bootstrap-flavoured tabbox with the same behavior. */
export class BootstrapTabbox extends Tabbox {
  static legacyName = 'gx.bootstrap.Tabbox';
}

/** Legacy bootstrap navigation bar. */
export class NavigationBar extends GxWrapper {
  static legacyName = 'gx.bootstrap.NavigationBar';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { frames: [], title: '', buttons: [] });
    const frames = Array.isArray(options.frames) ? options.frames : [];
    this._frames = frames.map((frame) => ({ ...frame }));
    const active = typeof options.show === 'number' ? frames[options.show - 1]?.name : options.show;
    const component = new ZxNavigationBar(targetElement(display), {
      title: String(options.title ?? ''),
      items: frames.map(normalizeTab),
      active: active == null ? null : String(active),
      actions: normalizeButtons(options.buttons ?? [])
    });
    this._attach(component, {
      events: { change: { type: 'change', args: (detail) => [detail.name] } },
      ui: { title: 'title', tablist: 'items', content: 'panels', buttons: 'actions' },
      setters: { title: 'setTitle' }
    });
    component.on('change', () => queueMicrotask(() => this._syncAct()));
    this._syncAct();
  }

  /** @param {Record<string, any>|string} frame @param {string} [title] @param {unknown} [content] @returns {this} */
  addTab(frame, title, content) {
    const definition = typeof frame === 'object' ? { ...frame } : { name: frame, title, content };
    this._frames.push(definition); this._rebuild(); return this;
  }
  /** @param {string} name @returns {this} */
  closeTab(name) { this._frames = this._frames.filter((frame) => String(frame.name) !== String(name)); this._rebuild(); return this; }
  /** @param {string} name @returns {this} */
  openTab(name) { this._zx.setActive(String(name)); this._syncAct(); return this; }
  /** @param {string|Element} title @returns {this} */
  setTitle(title) { this._zx.setTitle(typeof title === 'string' ? title : title?.textContent ?? ''); return this; }
  /** @param {string} name @param {string} title @returns {this} */
  setTabTitle(name, title) { const frame = this._frames.find((item) => String(item.name) === String(name)); if (frame) frame.title = title; this._rebuild(); return this; }
  /** @param {unknown[]} buttons @returns {this} */
  setNavigationButtons(buttons) { this._zx.setActions(normalizeButtons(buttons)); return this; }
  /** @param {string} name @param {unknown} content @param {string} [_style] @returns {this} */
  setHighlight(name, content, _style) { this._zx.setBadge(String(name), content == null || content === '' ? null : String(content)); return this; }
  /** @returns {void} */
  _rebuild() { const active = this._zx._activeName; this._zx.setItems(this._frames.map(normalizeTab)); if (active && this._frames.some((frame) => String(frame.name) === String(active))) this._zx.setActive(active); this._syncAct(); }
  /** @returns {void} */
  _syncAct() { for (const item of this.display('tablist')?.querySelectorAll?.('[role="tab"]') ?? []) this._mirrorAct(item, item.getAttribute('aria-selected') === 'true'); }
}

/** Legacy standalone search control. */
export class Search extends GxWrapper {
  static legacyName = 'gx.zeyos.Search';

  /** @param {Record<string, any>} [options={}] */
  constructor(options = {}) {
    super(options);
    const component = new ZxSearch(null, { placeholder: options.placeholder ?? '', debounce: options.debounce ?? 0 });
    this._attach(component, {
      events: {
        input: { type: 'input', args: (_detail, event) => [this, component.refs.input, event] }
      },
      ui: { input: 'input', submit: 'submit', button: 'submit' }
    });
    this._listen(component.refs.input, 'keydown', (event) => {
      if (event.key === 'Enter') this.fireEvent('keypress', [this, component.refs.input, event]);
    });
    this._listen(component.refs.submit, 'click', (event) => this.fireEvent('click', [this, component.refs.input, event]));
  }

  /** @returns {string} */
  get() { return this._zx.get(); }
  /** @param {string} value @returns {this} */
  set(value) { this._zx.set(value); return this; }
}

/** @param {Record<string, any>} frame @returns {Record<string, any>} */
function normalizeTab(frame) {
  let content = legacyContent(frame.content);
  if (typeof content === 'string' || typeof content === 'number' || content == null) {
    content = document.createTextNode(content == null ? '' : String(content));
  }
  return {
    name: String(frame.name ?? ''),
    title: String(frame.title ?? ''),
    content,
    closable: Boolean(frame.closable),
    disabled: Boolean(frame.disabled)
  };
}

/** @param {unknown} list @returns {Element[]} */
function normalizeButtons(list) {
  return (Array.isArray(list) ? list : [list]).filter(Boolean).map((item) => item?.toElement?.() ?? item).filter((item) => item?.nodeType === 1);
}
