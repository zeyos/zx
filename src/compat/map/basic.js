import {
  CheckButton as ZxCheckButton,
  Dialog as ZxDialog,
  MenuButton as ZxMenuButton,
  Message as ZxMessage,
  Toggle as ZxToggle
} from '../../index.js';
import { GxWrapper } from '../base.js';
import { legacyContent, messageKind, targetElement, textLabel, warnFunctionOnce, warnMethodOnce } from './helpers.js';

/** Legacy ZeyOS switch. */
export class Toggle extends GxWrapper {
  static legacyName = 'gx.zeyos.Toggle';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { on: false, value: true });
    const { target, host } = buttonTarget(display);
    const component = new ZxToggle(target, {
      checked: Boolean(options.on), value: options.value ?? true,
      label: options.label ?? null, disabled: Boolean(options.disabled)
    });
    if (host) host.append(component.toElement());
    this._attach(component, {
      events: {
        check: { type: 'change', filter: (detail) => detail.checked, args: () => [this] },
        uncheck: { type: 'change', filter: (detail) => !detail.checked, args: () => [this] },
        change: { type: 'change', args: (detail) => [detail.checked] }
      },
      setters: { on: (value) => value ? this.setChecked() : this.setUnchecked(), value: (value) => { component.options.value = value; } }
    });
    component.on('change', () => this._syncAct());
    this._syncAct();
  }

  /** @returns {boolean} */
  getState() { return this._zx.get(); }
  /** @returns {unknown} */
  getValue() { return this._zx.getValue(); }
  /** @returns {this} */
  toggle() { this._zx.toggle(); this._syncAct(); return this; }
  /** @param {boolean} [suppress=false] @returns {this} */
  setChecked(suppress = false) { this._zx.set(true, { silent: Boolean(suppress) }); this._syncAct(); return this; }
  /** @param {boolean} [suppress=false] @returns {this} */
  setUnchecked(suppress = false) { this._zx.set(false, { silent: Boolean(suppress) }); this._syncAct(); return this; }
  /** @returns {void} */
  _syncAct() { this._mirrorAct(this.toElement(), this.getState()); }
}

/** Legacy ZeyOS floating message box. */
export class Msgbox extends GxWrapper {
  static legacyName = 'gx.zeyos.Msgbox';

  /** @param {Record<string, any>} [options={}] */
  constructor(options = {}) {
    super(options, { closable: true, content: false });
    const component = new ZxMessage(null, { timeout: 0, closable: options.closable !== false, maxVisible: 1 });
    document.body.append(component.toElement());
    this._handle = null;
    this._content = options.content || '';
    this._attach(component, { ui: { frame: 'root', content: 'root', img: 'root' } });
  }

  /** @param {unknown} content @returns {this} */
  setContent(content) { this._content = legacyContent(content); return this; }
  /** @param {unknown} [message] @param {string} [className='info'] @returns {this} */
  show(message, className = 'info') {
    if (message != null) this.setContent(message);
    this._handle?.close();
    this._handle = this._zx.show(this._content, { kind: messageKind(className), timeout: 0, closable: this.options.closable !== false });
    this._mirrorAct(this.toElement(), true);
    return this;
  }
  /** @returns {this} */
  hide() { this._handle?.close(); this._handle = null; this._mirrorAct(this.toElement(), false); return this; }
}

/** Legacy bootstrap message/status service. */
export class BootstrapMessage extends GxWrapper {
  static legacyName = 'gx.bootstrap.Message';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { duration: 3000 });
    const component = new ZxMessage(targetElement(display), {
      timeout: Number(options.duration) || 0, closable: true, maxVisible: options.maxVisible ?? 5
    });
    if (!targetElement(display)) document.body.append(component.toElement());
    this._handles = new Map();
    this._progress = null;
    this._progressValue = 0;
    this._attach(component, { ui: { windows: 'root', status: 'root' } });
  }

  /** @param {unknown} message @param {string} [iconClass='info'] @param {boolean} [closable=true] @param {boolean} [_blend=false] @param {boolean} [autoclose=true] @returns {Element} */
  addMessage(message, iconClass = 'info', closable = true, _blend = false, autoclose = true) {
    const marker = document.createElement('span');
    marker.hidden = true;
    const handle = this._zx.show(legacyContent(message), {
      kind: messageKind(iconClass), closable: closable !== false,
      timeout: autoclose === false ? 0 : Number(this.options.duration) || 0
    });
    this._handles.set(marker, handle);
    return marker;
  }
  /** @param {Element} marker @returns {this} */
  closeMessage(marker) { this._handles.get(marker)?.close(); this._handles.delete(marker); return this; }
  /** @returns {this} */
  clear() { for (const handle of this._handles.values()) handle.close(); this._handles.clear(); return this; }
  /** @param {number} progress @param {string} [message=''] @param {boolean} [_blend=false] @returns {this} */
  showStatus(progress, message = '', _blend = false) {
    if (!this._progress) this._progress = ZxMessage.progress(String(message));
    this._progressValue = Number(progress) || 0;
    this._progress.update(this._progressValue, String(message));
    return this;
  }
  /** @param {number} progress @param {string} [message] @returns {this} */
  incProgress(progress, message) { return this.setProgress(this._progressValue + (Number(progress) || 0), message); }
  /** @param {number} progress @param {string} [message] @param {unknown} [_tween] @returns {this} */
  setProgress(progress, message, _tween) {
    if (!this._progress) this._progress = ZxMessage.progress(String(message ?? ''));
    this._progressValue = Number(progress) || 0;
    this._progress.update(this._progressValue, message == null ? undefined : String(message));
    return this;
  }
  /** @returns {this} */
  hideStatus() { this._progress?.done(); this._progress = null; this._progressValue = 0; return this; }
}

/** Shared Dialog-backed popup behavior. */
class PopupBase extends GxWrapper {
  /** @param {Record<string, any>} options */
  constructor(options = {}) {
    super(options, { width: 600, closable: true, content: null });
    const component = new ZxDialog(null, {
      title: String(options.title ?? ''), size: numericWidth(options.width),
      closable: options.closable !== false,
      lightDismiss: Boolean(options.overlayDismiss ?? options.clickable),
      content: legacyContent(options.content)
    });
    this._attach(component, {
      events: {
        show: { type: 'open', args: () => [this] },
        hide: { type: 'close', args: (detail) => [detail.result, this] },
        open: { type: 'open', args: () => [this] }
      },
      ui: { modal: 'root', aside: 'content', body: 'content', content: 'content', title: 'title', footer: 'footer', cross: 'close' },
      setters: { content: 'setContent', title: 'setTitle', open: (value) => value ? this.show() : this.hide() }
    });
    this.isOpen = false;
    if (options.footer) component.setButtons(footerButtons(options.footer));
    if (options.open) this.show();
  }

  /** @param {unknown} [argument] @returns {this} */
  show(argument) { this.isOpen = true; this._showArgument = argument; this._zx.open(); return this; }
  /** @param {unknown} [argument] @returns {this} */
  hide(argument) { this.isOpen = false; this._zx.close(argument); return this; }
  /** @param {unknown} content @returns {this} */
  setContent(content) { this._zx.setContent(legacyContent(content)); return this; }
  /** @param {string} title @returns {this} */
  setTitle(title) { this._zx.setTitle(title); return this; }
  /** @returns {Element} */
  getContent() { return this._zx.refs.content; }
  /** @param {unknown} [_x] @param {unknown} [_y] @returns {this} */
  setPosition(_x, _y) { warnMethodOnce(this.constructor, 'setPosition', 'CSS dialog positioning'); return this; }
}

/** Legacy ZeyOS popup. */
export class Popup extends PopupBase {
  static legacyName = 'gx.zeyos.Popup';
}

/** Legacy bootstrap popup. */
export class BootstrapPopup extends PopupBase {
  static legacyName = 'gx.bootstrap.Popup';
}

/** Sentinel returned when a legacy confirmation is canceled. */
export const PopupConfirmCanceled = Object.freeze({});

/** @param {string} title @param {unknown} message @param {Record<string, any>|string} [options={}] @returns {Promise<void>} */
export function PopupAlert(title, message, options = {}) {
  warnFunctionOnce(PopupAlert, 'gx.bootstrap.PopupAlert', 'Dialog.alert');
  const settings = typeof options === 'string' ? { type: options } : options;
  return new Promise((resolve) => {
    const popup = new BootstrapPopup({ ...settings, title, content: message, width: settings.width ?? 400 });
    popup._zx.setButtons([{ label: settings.okLabel ?? 'Ok', kind: 'primary', autofocus: true, action: () => {
      if (typeof settings.onOk === 'function' && settings.onOk() === false) return;
      popup.hide(); resolve();
    } }]);
    popup._zx.once('close', () => popup.destroy());
    popup.show();
  });
}

/** @param {string} title @param {unknown} message @param {Record<string, any>|string} [options={}] @returns {Promise<void|typeof PopupConfirmCanceled>} */
export function PopupConfirm(title, message, options = {}) {
  warnFunctionOnce(PopupConfirm, 'gx.bootstrap.PopupConfirm', 'Dialog.confirm');
  const settings = typeof options === 'string' ? { type: options } : options;
  return new Promise((resolve) => {
    const popup = new BootstrapPopup({ ...settings, title, content: message, width: settings.width ?? 400, closable: false });
    popup._zx.setButtons([
      { label: settings.cancelLabel ?? 'Cancel', action: () => { popup.hide(); resolve(PopupConfirmCanceled); } },
      { label: settings.okLabel ?? 'Ok', kind: 'primary', action: () => {
        if (typeof settings.onOk === 'function' && settings.onOk() === false) return;
        popup.hide(); resolve();
      } }
    ]);
    popup._zx.once('close', () => popup.destroy());
    popup.show();
  });
}

/** Legacy multi-frame ZeyOS dialog. */
export class Dialog extends GxWrapper {
  static legacyName = 'gx.zeyos.Dialog';

  /** @param {Element|string|null} _display @param {Record<string, any>} [options={}] */
  constructor(_display, options = {}) {
    super(options, { title: '', height: 400 });
    const component = new ZxDialog(null, { title: String(options.title ?? ''), content: null });
    this._frames = {};
    this._current = null;
    this._attach(component, { ui: { title: 'title', content: 'content', footer: 'footer' }, setters: { title: 'setTitle' } });
  }

  /** @param {string} title @returns {this} */
  setTitle(title) { this._zx.setTitle(textLabel(title)); return this; }
  /** @param {string} key @param {Record<string, any>} options @param {boolean} [open] @returns {this} */
  addFrame(key, options, open) {
    const buttons = footerButtons(options?.footer);
    const view = this._zx.addView(String(key), {
      title: options?.title == null ? undefined : textLabel(options.title),
      content: legacyContent(options?.content), buttons
    });
    this._frames[key] = { title: options?.title ?? null, content: view.content, footer: buttons, view };
    if ((!this._current && open !== false) || open === true) this.openFrame(key);
    return this;
  }
  /** @param {string} key @returns {Record<string, any>} */
  openFrame(key) { this._zx.showView(String(key)); this._current = this._frames[key]; return this._current; }
  /** @param {string} key @returns {Record<string, any>|null} */
  getFrame(key) { return this._frames[key] ?? null; }
  /** @param {string} key @param {unknown} content @param {Function} onSubmit @param {boolean} [open] @returns {unknown} */
  addSubmitFrame(key, content, onSubmit, open) {
    this.addFrame(key, { title: this.options.title, content: containerFor(content), footer: {
      close: { label: 'Close', click: () => this._zx.close() },
      ok: { label: 'OK', primary: true, click: () => onSubmit?.() }
    } }, open);
    return content;
  }
  /** @param {string} key @param {Record<string, [unknown, unknown]>} form @param {Function} onSubmit @param {boolean} [open] @returns {Record<string, unknown>} */
  addFormFrame(key, form, onSubmit, open) {
    const fields = {};
    const container = document.createElement('div');
    for (const [name, definition] of Object.entries(form ?? {})) {
      const label = document.createElement('p');
      label.textContent = definition?.[0] == null ? '' : String(definition[0]);
      container.append(label);
      const field = definition?.[1];
      const node = legacyContent(field);
      if (node?.nodeType) container.append(node); else if (node?.toElement?.()) container.append(node.toElement());
      fields[name] = field;
    }
    this.addSubmitFrame(key, container, onSubmit, open);
    return fields;
  }
  /** @param {string} key @param {unknown} message @param {string} [link] @param {boolean} [open] @returns {this} */
  addSuccessFrame(key, message, link, open) {
    const container = containerFor(message);
    if (link) {
      const anchor = document.createElement('a'); anchor.href = link; anchor.textContent = 'Open'; container.append(anchor);
    }
    return this.addFrame(key, { title: this.options.title, content: container }, open);
  }
  /** @param {Record<string, any>} form @returns {Record<string, unknown>} */
  getFormValues(form) {
    const values = {};
    for (const [key, field] of Object.entries(form ?? {})) {
      if (field?.value != null) values[key] = field.value;
      else if (typeof field?.getValue === 'function') values[key] = field.getValue();
      else if (typeof field?.getValues === 'function') values[key] = field.getValues();
      else if (typeof field?.getId === 'function') values[key] = field.getId();
      else if (typeof field?.get === 'function') values[key] = field.get();
    }
    return values;
  }
}

/** Legacy object-backed dropdown. */
export class Dropdown extends GxWrapper {
  static legacyName = 'gx.zeyos.Dropdown';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { items: {}, label: '', resettable: false, compact: false, upside: false });
    const { target, host } = buttonTarget(display);
    this._items = normalizeDropdownItems(options.items, options.resettable, options.emptyCaption);
    this._selected = null;
    const component = new ZxMenuButton(target, {
      label: String(options.label ?? ''), items: this._items,
      placement: options.upside ? 'top-start' : 'bottom-start'
    });
    if (host) host.append(component.toElement());
    this._attach(component, {
      events: {
        change: { type: 'select', args: (detail) => {
          this._selected = detail.value == null ? null : detail.item;
          component.setLabel(detail.value == null ? String(options.label ?? '') : String(detail.item.label));
          return [detail.value, detail.item.label, this];
        } }
      },
      ui: { frame: 'root', button: 'root', section: () => document.querySelector(`[aria-labelledby="${component.el.id}"]`) },
      setters: { items: 'setItems' }
    });
  }
  /** @param {Record<string, unknown>} items @returns {this} */
  setItems(items) { this._items = normalizeDropdownItems(items, this.options.resettable, this.options.emptyCaption); this._zx.setItems(this._items); return this; }
  /** @param {unknown} value @param {string} [text] @returns {this} */
  selectItem(value, text) {
    const item = this._items.find((entry) => entry !== '-' && entry.value == value);
    this._selected = item ?? { value, label: text ?? String(value) };
    this._zx.setLabel(text ?? this._selected.label); this.fireEvent('change', [value, text ?? this._selected.label, this]); this._zx.close(); return this;
  }
  /** @returns {this} */
  reset() { this._selected = null; this._zx.setLabel(String(this.options.label ?? '')); this.fireEvent('change', [null, this.options.emptyCaption, this]); this._zx.close(); return this; }
  /** @returns {{value: unknown, label: string}|null} */
  getSelected() { return this._selected ? { value: this._selected.value, label: this._selected.label } : null; }
  /** @returns {unknown} */
  getValue() { return this._selected?.value ?? ''; }
  /** @returns {this} */
  show() { this._zx.open(); return this; }
  /** @returns {this} */
  close() { this._zx.close(); return this; }
  /** @returns {this} */
  toggle() { this._zx.isOpen() ? this._zx.close() : this._zx.open(); return this; }
}

/** Legacy bootstrap menu button. */
export class MenuButton extends GxWrapper {
  static legacyName = 'gx.bootstrap.MenuButton';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { entries: [], label: '', orientation: 'left', direction: 'down' });
    const { target, host } = buttonTarget(display);
    this._entries = [];
    const component = new ZxMenuButton(target, {
      label: String(options.label ?? ''), items: [], kind: styleKind(options.style),
      placement: `${options.direction === 'up' ? 'top' : 'bottom'}-${options.orientation === 'right' ? 'end' : 'start'}`
    });
    if (host) host.append(component.toElement());
    this._attach(component, { events: { change: { type: 'select', args: (detail) => [detail.value, detail.item, this] } }, ui: { button: 'root', frame: 'root', menu: 'root' } });
    for (const entry of options.entries ?? []) this.add(entry);
  }
  /** @param {string|false|null} label @param {string} [icon] @returns {Element|null} */
  add(label, icon) {
    if (!label) { this._entries.push('-'); this._zx.setItems(this._entries); return null; }
    const item = { label: String(label), icon, value: this._entries.length };
    this._entries.push(item); this._zx.setItems(this._entries);
    return this.toElement();
  }
  /** @returns {this} */
  divider() { this.add(false); return this; }
  /** @returns {this} */
  toggle() { this._zx.isOpen() ? this._zx.close() : this._zx.open(); return this; }
  /** @returns {this} */
  open() { this._zx.open(); return this; }
  /** @returns {this} */
  close() { this._zx.close(); return this; }
  /** @param {string} label @returns {this} */
  setLabel(label) { this._zx.setLabel(label); return this; }
  /** @param {string} style @returns {this} */
  setStyle(style) { this.toElement().setAttribute('data-kind', styleKind(style)); return this; }
}

/** Legacy bootstrap two-state check button. */
export class CheckButton extends GxWrapper {
  static legacyName = 'gx.bootstrap.CheckButton';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { label: '', value: false });
    const { target, host } = buttonTarget(display);
    const component = new ZxCheckButton(target, { label: options.label, checked: Boolean(options.value), disabled: Boolean(options.disabled) });
    if (host) host.append(component.toElement());
    this._attach(component, {
      events: {
        change: { type: 'change', args: (detail) => [detail.checked] },
        check: { type: 'change', filter: (detail) => detail.checked, args: () => [] },
        uncheck: { type: 'change', filter: (detail) => !detail.checked, args: () => [] }
      },
      ui: { button: 'root', indicator: 'root', group: 'root' },
      setters: { value: 'set', disabled: 'setDisabled', label: 'setLabel' }
    });
  }
  /** @returns {boolean} */ get() { return this._zx.get(); }
  /** @param {boolean} [suppress=false] @returns {false} */ toggle(suppress = false) { this._zx.set(!this.get(), { silent: Boolean(suppress) }); return false; }
  /** @param {boolean} [suppress=false] @returns {this} */ check(suppress = false) { this._zx.set(true, { silent: Boolean(suppress) }); return this; }
  /** @param {boolean} [suppress=false] @returns {this} */ uncheck(suppress = false) { this._zx.set(false, { silent: Boolean(suppress) }); return this; }
  /** @param {boolean} value @returns {this} */ set(value) { return value ? this.check() : this.uncheck(); }
  /** @param {boolean} disabled @returns {this} */ setDisabled(disabled) { disabled ? this._zx.disable() : this._zx.enable(); return this; }
  /** @param {string|string[]} label @returns {this} */ setLabel(label) { this._zx.setLabel(label); return this; }
}

/** @param {Element|string|null|undefined} display @returns {{target: HTMLButtonElement|null, host: Element|null}} */
function buttonTarget(display) {
  const element = targetElement(display);
  if (element?.localName === 'button') return { target: element, host: null };
  return { target: null, host: element };
}

/** @param {unknown} width @returns {'sm'|'md'|'lg'|number} */
function numericWidth(width) {
  if (typeof width === 'number' && Number.isFinite(width)) return width;
  const number = Number.parseFloat(String(width ?? ''));
  return Number.isFinite(number) ? number : 'md';
}

/** @param {unknown} footer @returns {Array<Record<string, any>>} */
function footerButtons(footer) {
  if (!footer) return [];
  const entries = Array.isArray(footer) ? footer : (footer?.nodeType ? [footer] : Object.values(footer));
  return entries.map((entry) => {
    if (entry?.nodeType) return { label: entry.textContent ?? '', action: () => entry.click?.() };
    return { label: String(entry?.label ?? ''), kind: entry?.primary ? 'primary' : 'default', action: () => entry?.click?.() };
  });
}

/** @param {unknown} content @returns {HTMLElement} */
function containerFor(content) {
  const container = document.createElement('div');
  const values = Array.isArray(content) ? content : [content];
  for (const value of values) {
    const node = legacyContent(value);
    if (node?.nodeType) container.append(node);
    else if (node != null) container.append(document.createTextNode(String(node)));
  }
  return container;
}

/** @param {Record<string, unknown>} items @param {boolean} resettable @param {unknown} emptyCaption @returns {Array<Record<string, any>>} */
function normalizeDropdownItems(items = {}, resettable = false, emptyCaption = null) {
  const list = [];
  if (resettable) list.push({ label: String(emptyCaption ?? 'Empty'), value: null });
  for (const [value, source] of Object.entries(items ?? {})) {
    const object = source && typeof source === 'object' ? source : null;
    list.push({
      label: String(object?.text ?? object?.label ?? source), value,
      onselect: typeof object?.onClick === 'function' ? object.onClick : undefined
    });
  }
  return list;
}

/** @param {unknown} style @returns {'default'|'primary'|'danger'|'ghost'} */
function styleKind(style) {
  const value = String(style ?? '').toLowerCase();
  if (value.includes('danger') || value.includes('error')) return 'danger';
  if (value.includes('primary') || value.includes('success')) return 'primary';
  if (value.includes('link') || value.includes('ghost')) return 'ghost';
  return 'default';
}
