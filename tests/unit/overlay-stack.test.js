import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OverlayStack,
  containsNode,
  escapeCandidates,
  findParent,
  insideChain,
  outsideTargets
} from '../../src/core/overlay-stack.js';

/*
 * The stack's decisions need nothing from a document but parent links, so plain objects stand in
 * for elements, and a stack built with `target: null` installs no listeners and is driven through
 * its dispatch methods directly.
 */
class Node {
  constructor(name, parent = null) {
    this.name = name;
    this.parentNode = parent;
    this.isConnected = true;
  }

  matches() {
    return true;
  }
}

const node = (name, parent) => new Node(name, parent);

/** A keydown stand-in whose cancellation the test can read back. */
function key(name, target = null, prevented = false) {
  return {
    key: name,
    target,
    defaultPrevented: prevented,
    isComposing: false,
    preventDefault() { this.defaultPrevented = true; }
  };
}

/** A pointerdown stand-in. */
function press(target) {
  return { target, composedPath: () => [target] };
}

/**
 * The page the scenarios share: a body holding a sheet with a menu trigger in it, a theme scope the
 * popups are hosted in (outside the sheet, as overlay panels are), and a plain button.
 */
function page() {
  const body = node('body');
  const sheet = node('sheet', body);
  const trigger = node('trigger', sheet);
  const field = node('field', sheet);
  const host = node('host', body);
  const panel = node('panel', host);
  const item = node('item', panel);
  const outside = node('outside', body);
  return { body, sheet, trigger, field, host, panel, item, outside };
}

test('containsNode follows parent links and crosses shadow roots', () => {
  const root = node('root');
  const child = node('child', root);
  const shadow = { parentNode: null, host: child };
  const inner = node('inner', /** @type {any} */ (shadow));
  assert.equal(containsNode(root, root), true);
  assert.equal(containsNode(root, child), true);
  assert.equal(containsNode(root, inner), true);
  assert.equal(containsNode(child, root), false);
  assert.equal(containsNode(root, null), false);
});

test('order rises with every push and is never reused', () => {
  const stack = new OverlayStack({ target: null });
  const { sheet, panel } = page();
  const first = stack.push({ kind: 'non-modal', root: sheet });
  const second = stack.push({ kind: 'popup', root: panel });
  assert.ok(second.order > first.order);
  second.release();
  const third = stack.push({ kind: 'popup', root: panel });
  assert.ok(third.order > second.order, 'a released order came back');
  assert.deepEqual(stack.entries().map((entry) => entry.order), [first.order, third.order]);
});

test('topmost skips toasts, and isTopmost follows releases', () => {
  const stack = new OverlayStack({ target: null });
  const { sheet, panel, host } = page();
  const drawer = stack.push({ kind: 'non-modal', root: sheet });
  const menu = stack.push({ kind: 'popup', root: panel });
  stack.push({ kind: 'toast', root: node('region', host) });
  assert.equal(stack.topmost(), menu.entry);
  assert.equal(menu.isTopmost(), true);
  assert.equal(drawer.isTopmost(), false);
  menu.release();
  assert.equal(drawer.isTopmost(), true);
  assert.equal(stack.topmost((entry) => entry.kind === 'popup'), null);
});

test('a popup anchored inside a sheet takes the sheet as its parent', () => {
  const stack = new OverlayStack({ target: null });
  const { sheet, trigger, panel, outside } = page();
  const drawer = stack.push({ kind: 'non-modal', root: sheet });
  const menu = stack.push({ kind: 'popup', root: panel, anchor: trigger, inside: [trigger] });
  assert.equal(menu.entry.parent, drawer.entry);
  const loose = stack.push({ kind: 'popup', root: node('other'), anchor: outside });
  assert.equal(loose.entry.parent, null);
});

test('findParent prefers the topmost containing layer and never a tooltip or toast', () => {
  const { sheet, trigger, panel, item } = page();
  const entry = (kind, root, order) => ({ kind, root, order, anchors: [], inside: [], parent: null, owner: null });
  const drawer = entry('non-modal', sheet, 1);
  const menu = entry('popup', panel, 2);
  const bubble = entry('tooltip', panel, 3);
  assert.equal(findParent([drawer, menu, bubble], [item]), menu);
  assert.equal(findParent([drawer, menu, bubble], [trigger]), drawer);
  assert.equal(findParent([entry('toast', sheet, 1)], [trigger]), null);
});

test('the inside test follows the opener chain, not the DOM', () => {
  const stack = new OverlayStack({ target: null });
  const { sheet, trigger, panel, item, outside } = page();
  const drawer = stack.push({ kind: 'non-modal', root: sheet });
  const menu = stack.push({ kind: 'popup', root: panel, anchor: trigger, inside: [trigger] });
  // The panel is hosted outside the sheet, yet an item in it is inside the sheet's chain.
  assert.equal(containsNode(sheet, item), false);
  assert.equal(drawer.contains(item), true);
  assert.equal(insideChain(stack.entries(), drawer.entry, item), true);
  assert.equal(menu.contains(trigger), true, 'the trigger is part of its popup');
  assert.equal(drawer.contains(outside), false);
  menu.release();
  assert.equal(drawer.contains(item), false, 'a closed popup is no longer part of the chain');
});

test('Escape goes to the topmost layer that takes it, and only to it', () => {
  const stack = new OverlayStack({ target: null });
  const { sheet, trigger, field, panel, item } = page();
  const log = [];
  stack.push({ kind: 'non-modal', root: sheet, onEscape: () => { log.push('sheet'); } });
  const menu = stack.push({
    kind: 'popup', root: panel, anchor: trigger, inside: [trigger],
    onEscape: () => { log.push('menu'); menu.release(); }
  });
  const first = key('Escape', item);
  assert.equal(stack.handleKeydown(/** @type {any} */ (first)), menu.entry);
  assert.deepEqual(log, ['menu']);
  assert.equal(first.defaultPrevented, true);
  stack.handleKeydown(/** @type {any} */ (key('Escape', field)));
  assert.deepEqual(log, ['menu', 'sheet']);
});

test('an Escape already spent inside reaches no overlay, nor does another key', () => {
  const stack = new OverlayStack({ target: null });
  const { sheet, field } = page();
  let calls = 0;
  stack.push({ kind: 'non-modal', root: sheet, onEscape: () => { calls += 1; } });
  assert.equal(stack.handleKeydown(/** @type {any} */ (key('Escape', field, true))), null);
  assert.equal(stack.handleKeydown(/** @type {any} */ (key('Enter', field))), null);
  assert.equal(calls, 0);
});

test('a layer that declines Escape passes it down; a modal stops the search untouched', () => {
  const stack = new OverlayStack({ target: null });
  const { sheet, panel, host } = page();
  const log = [];
  stack.push({ kind: 'popup', root: node('below', host), onEscape: () => { log.push('below'); } });
  stack.push({ kind: 'modal', root: sheet });
  stack.push({ kind: 'popup', root: panel, onEscape: () => { log.push('declined'); return false; } });
  stack.push({ kind: 'tooltip', root: node('bubble', host) });
  assert.deepEqual(escapeCandidates(stack.entries()).map((entry) => entry.root.name), ['panel']);
  const event = key('Escape', sheet);
  assert.equal(stack.handleKeydown(/** @type {any} */ (event)), null);
  assert.deepEqual(log, ['declined']);
  assert.equal(event.defaultPrevented, false, 'the modal\'s own Escape must stay the browser\'s');
});

test('choosing an item in a menu opened from a sheet dismisses neither', () => {
  const stack = new OverlayStack({ target: null });
  const { sheet, trigger, panel, item } = page();
  const log = [];
  stack.push({ kind: 'non-modal', root: sheet, onOutsidePointer: () => log.push('sheet') });
  stack.push({ kind: 'popup', root: panel, anchor: trigger, inside: [trigger], onOutsidePointer: () => log.push('menu') });
  assert.deepEqual(stack.handlePointerdown(/** @type {any} */ (press(item))), []);
  assert.deepEqual(log, []);
});

test('a press in the sheet closes its menu only; a press outside closes both, topmost first', () => {
  const { sheet, trigger, field, panel, outside } = page();
  const stack = new OverlayStack({ target: null });
  const log = [];
  stack.push({ kind: 'non-modal', root: sheet, onOutsidePointer: () => log.push('sheet') });
  stack.push({ kind: 'popup', root: panel, anchor: trigger, inside: [trigger], onOutsidePointer: () => log.push('menu') });
  stack.handlePointerdown(/** @type {any} */ (press(field)));
  assert.deepEqual(log, ['menu']);
  log.length = 0;
  assert.deepEqual(outsideTargets(stack.entries(), outside).map((entry) => entry.root.name), ['panel', 'sheet']);
  stack.handlePointerdown(/** @type {any} */ (press(outside)));
  assert.deepEqual(log, ['menu', 'sheet']);
});

test('a press on a popup trigger is inside the popup; a press on a toast dismisses nothing', () => {
  const { trigger, panel, host, outside } = page();
  const region = node('region', host);
  const toast = node('toast', region);
  const stack = new OverlayStack({ target: null });
  const log = [];
  stack.push({ kind: 'popup', root: panel, anchor: trigger, inside: [trigger], onOutsidePointer: () => log.push('menu') });
  stack.push({ kind: 'tooltip', root: node('bubble', host), onOutsidePointer: () => log.push('tooltip') });
  stack.push({ kind: 'toast', root: region });
  stack.handlePointerdown(/** @type {any} */ (press(toast)));
  assert.deepEqual(log, []);
  stack.handlePointerdown(/** @type {any} */ (press(trigger)));
  assert.deepEqual(log, ['tooltip'], 'a tooltip goes on any press outside it');
  stack.handlePointerdown(/** @type {any} */ (press(outside)));
  assert.deepEqual(log, ['tooltip', 'tooltip', 'menu']);
});

test('nothing below a modal reacts to a press', () => {
  const { sheet, panel, host, outside } = page();
  const stack = new OverlayStack({ target: null });
  const log = [];
  stack.push({ kind: 'popup', root: node('below', host), onOutsidePointer: () => log.push('below') });
  stack.push({ kind: 'modal', root: sheet });
  stack.push({ kind: 'popup', root: panel, onOutsidePointer: () => log.push('menu') });
  stack.handlePointerdown(/** @type {any} */ (press(outside)));
  assert.deepEqual(log, ['menu']);
});

test('closing a parent closes the children that follow it and re-parents the rest', () => {
  const stack = new OverlayStack({ target: null });
  const { sheet, trigger, panel, item } = page();
  const nested = node('nested');
  const log = [];
  const drawer = stack.push({ kind: 'non-modal', root: sheet });
  const menu = stack.push({
    kind: 'popup', root: panel, anchor: trigger,
    onParentClose: (handle) => { log.push('menu'); handle.release(); }
  });
  const flyout = stack.push({
    kind: 'popup', root: nested, anchor: item,
    onParentClose: (handle) => { log.push('flyout'); handle.release(); }
  });
  const dialog = stack.push({ kind: 'modal', root: node('dialog'), anchor: item });
  assert.equal(flyout.entry.parent, menu.entry);
  drawer.release();
  assert.deepEqual(log, ['menu', 'flyout']);
  assert.equal(flyout.isOpen(), false);
  assert.equal(dialog.isOpen(), true, 'an entry without onParentClose outlives its parent');
  assert.equal(dialog.entry.parent, null);
  drawer.release();
  assert.deepEqual(log, ['menu', 'flyout'], 'release is idempotent');
});

test('focus leaving an overlay chain reaches the entries that watch it', () => {
  const stack = new OverlayStack({ target: null });
  const { trigger, host, outside } = page();
  let hidden = 0;
  stack.push({ kind: 'tooltip', root: node('bubble', host), anchor: trigger, inside: [trigger], onFocusOutside: () => { hidden += 1; } });
  stack.handleFocusin(/** @type {any} */ (press(trigger)));
  assert.equal(hidden, 0);
  stack.handleFocusin(/** @type {any} */ (press(outside)));
  assert.equal(hidden, 1);
});

test('subscribers hear every push and release; document listeners live only while open', () => {
  const added = [];
  const target = {
    addEventListener(type, listener, options) {
      added.push(type);
      options.signal.addEventListener('abort', () => added.splice(added.indexOf(type), 1));
    }
  };
  const stack = new OverlayStack({ target: /** @type {any} */ (target) });
  const seen = [];
  const stop = stack.subscribe((entries) => seen.push(entries.length));
  const { sheet, panel } = page();
  const first = stack.push({ kind: 'non-modal', root: sheet });
  const second = stack.push({ kind: 'popup', root: panel });
  assert.deepEqual(added.sort(), ['focusin', 'keydown', 'pointerdown']);
  second.release();
  first.release();
  assert.deepEqual(seen, [1, 2, 1, 0]);
  assert.deepEqual(added, [], 'the last release removes the document listeners');
  stop();
  stack.push({ kind: 'popup', root: panel }).release();
  assert.deepEqual(seen, [1, 2, 1, 0]);
});

test('topmostModal answers the topmost registered modal', () => {
  const stack = new OverlayStack({ target: null });
  const lower = node('lower');
  const upper = node('upper');
  stack.push({ kind: 'modal', root: lower });
  const top = stack.push({ kind: 'modal', root: upper });
  stack.push({ kind: 'popup', root: node('menu', upper) });
  assert.equal(stack.topmostModal(), upper);
  top.release();
  assert.equal(stack.topmostModal(), lower);
});
