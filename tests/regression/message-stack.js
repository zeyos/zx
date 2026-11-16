import assert from 'node:assert/strict';

/*
 * Message as a plain card with highlights, and stacked — inline and floating. The runner emulates
 * reduced motion, so every place a stack gives a message is in effect at once.
 */

/** Waits for the next two frames, past resize observations and focus work. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

/** Builds an inline area in a fixed-width host, with a line of content after it. */
const inline = (page, options) => page.evaluate((options) => {
  document.body.replaceChildren();
  const before = document.createElement('button');
  before.id = 'before';
  before.textContent = 'Before';
  const host = document.createElement('div');
  host.id = 'host';
  host.style.cssText = 'inline-size: 400px; margin: 40px';
  const after = document.createElement('p');
  after.id = 'after';
  after.textContent = 'After';
  document.body.append(before, host, after);
  window.events = [];
  window.area = new zx.Message(host, options);
  window.area.on('expand', () => window.events.push('expand'));
  window.area.on('collapse', () => window.events.push('collapse'));
}, options);

/** Shows messages in the inline area, oldest first. */
const show = (page, texts, options = {}) => page.evaluate(({ texts, options }) => {
  for (const text of texts) window.area.show(text, options);
}, { texts, options });

/** The root's state and each message's text, depth, and box, in document order. */
const read = (page, selector = '#host') => page.evaluate((selector) => {
  const root = document.querySelector(selector);
  const box = (node) => {
    const rect = node.getBoundingClientRect();
    return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) };
  };
  return {
    state: root.dataset.state ?? null,
    stack: root.hasAttribute('data-stack'),
    root: box(root),
    after: document.querySelector('#after') ? box(document.querySelector('#after')) : null,
    messages: Array.from(root.querySelectorAll(':scope > .zx-message__toast'), (node) => ({
      text: node.querySelector('.zx-message__content').textContent,
      depth: node.dataset.depth ?? null,
      opacity: getComputedStyle(node).opacity,
      content: getComputedStyle(node.querySelector('.zx-message__content')).opacity,
      natural: node.offsetHeight,
      ...box(node)
    }))
  };
}, selector);

const LONG = 'The connection to the mail server was lost, and the outbox will retry every few minutes '
  + 'until it is back.';

export const cases = [
  {
    name: 'M1 a message is a plain card; a highlight draws its border in the kind colour',
    async run({ page }) {
      await inline(page, { timeout: 0 });
      await show(page, ['Plain']);
      await page.evaluate(() => {
        window.area.show('Border', { kind: 'warning', highlight: true });
        window.area.show('Animated', { kind: 'error', highlight: 'animated' });
      });
      const styles = await page.evaluate(() => {
        const probe = document.createElement('span');
        document.body.append(probe);
        const colour = (token) => {
          probe.style.color = `var(${token})`;
          return getComputedStyle(probe).color;
        };
        const kinds = { warning: colour('--zx-color-warning'), danger: colour('--zx-color-danger') };
        probe.remove();
        return {
          kinds,
          messages: Array.from(document.querySelectorAll('.zx-message__toast'), (node) => ({
            highlight: node.dataset.highlight ?? null,
            border: getComputedStyle(node).borderTopColor,
            image: getComputedStyle(node).backgroundImage,
            light: getComputedStyle(node, '::before').content
          }))
        };
      });
      const [plain, border, animated] = styles.messages;
      assert.equal(plain.highlight, null);
      assert.notEqual(plain.border, styles.kinds.warning);
      // Every kind paints the same body: the theme's toast image, untinted.
      assert.equal(new Set(styles.messages.map((message) => message.image)).size, 1, 'a message is tinted for its kind');
      assert.equal(border.highlight, 'border');
      assert.equal(border.border, styles.kinds.warning);
      // Reduced motion: the animated highlight is the still kind-coloured border, with no light.
      assert.equal(animated.highlight, 'animated');
      assert.equal(animated.border, styles.kinds.danger);
      assert.equal(animated.light, 'none');
      await page.evaluate(() => window.area.destroy());
    }
  },
  {
    name: 'M2 an inline stack piles the newest in front and opens under the pointer',
    async run({ page }) {
      await inline(page, { stack: true, timeout: 0 });
      await show(page, ['First', 'Second', LONG, 'Fourth']);
      await settle(page);
      let found = await read(page);
      assert.equal(found.stack, true);
      assert.equal(found.state, 'collapsed');
      // Document order is visual order: the newest, in front, comes first.
      assert.deepEqual(found.messages.map((message) => message.text), ['Fourth', LONG, 'Second', 'First']);
      assert.deepEqual(found.messages.map((message) => message.depth), ['0', '1', '2', 'hidden']);
      const [front, second, third, fourth] = found.messages;
      assert.equal(front.top, found.root.top, 'the front message sits at the edge');
      assert.equal(front.content, '1');
      assert.equal(second.content, '0', 'a message behind the front one shows no content');
      assert.equal(fourth.opacity, '0', 'a fourth message waits out of sight');
      // Each one behind peeks out one peek further than the one in front of it.
      const peek = second.bottom - front.bottom;
      assert.ok(peek > 0, 'the second message does not peek out');
      assert.equal(third.bottom - second.bottom, peek);
      assert.equal(found.root.height, front.height + (2 * peek), 'the stack is the front message and two peeks');
      assert.ok(second.natural > front.natural, 'the long message is taller than the front one');
      // Taller than the front one, it is cut down to its strip: nothing of it shows above the front
      // one, nor under the front one's face, only below it.
      const hits = await page.evaluate(({ front, second }) => {
        const x = document.querySelector('#host').getBoundingClientRect().left + 200;
        const at = (y) => document.elementFromPoint(x, y)?.closest('.zx-message__toast')
          ?.querySelector('.zx-message__content').textContent ?? null;
        return { above: at(second.top + 2), face: at(front.bottom - 4), strip: at(second.bottom - 3) };
      }, { front, second });
      assert.ok(second.top < front.top, 'the long message reaches past the front one unclipped');
      assert.deepEqual(hits, { above: null, face: 'Fourth', strip: LONG });

      await page.hover('#host .zx-message__toast >> nth=0');
      await settle(page);
      found = await read(page);
      assert.equal(found.state, 'expanded');
      const gap = found.messages[1].top - found.messages[0].bottom;
      assert.ok(gap > 0, 'an open stack keeps a gap between messages');
      for (let index = 1; index < found.messages.length; index += 1) {
        const [above, below] = [found.messages[index - 1], found.messages[index]];
        assert.equal(below.top - above.bottom, gap, `message ${index + 1} follows the one above it`);
        assert.equal(below.height, below.natural, `message ${index + 1} has its own height`);
        assert.equal(below.content, '1');
      }
      assert.equal(found.root.height, found.messages.reduce((sum, message) => sum + message.natural, 0) + (3 * gap));
      assert.ok(found.after.top >= found.root.bottom, 'the content after an open stack moves down');

      await page.mouse.move(1000, 800);
      await settle(page);
      assert.equal((await read(page)).state, 'collapsed');
      assert.deepEqual(await page.evaluate(() => window.events), ['expand', 'collapse']);
      await page.evaluate(() => window.area.destroy());
    }
  },
  {
    name: 'M3 focus opens a stack; Escape folds it and returns focus to where it came from',
    async run({ page }) {
      await inline(page, { stack: true, timeout: 0 });
      await show(page, ['First', 'Second', 'Third']);
      await page.focus('#before');
      await page.keyboard.press('Tab');
      await settle(page);
      let found = await read(page);
      assert.equal(found.state, 'expanded', 'Tab into the stack opens it');
      assert.equal(await page.evaluate(() => document.activeElement.closest('.zx-message__toast')
        ?.querySelector('.zx-message__content').textContent), 'Third', 'Tab meets the front message first');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.closest('.zx-message__toast')
        ?.querySelector('.zx-message__content').textContent), 'Second');
      await page.keyboard.press('Escape');
      await settle(page);
      found = await read(page);
      assert.equal(found.state, 'collapsed');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'before');
      assert.equal(found.messages.length, 3, 'Escape closes no message');
      await page.evaluate(() => window.area.destroy());
    }
  },
  {
    name: 'M4 a press keeps a stack open until a press outside; no message times out meanwhile',
    async run({ page }) {
      await inline(page, { stack: true, timeout: 500 });
      await show(page, ['First', 'Second']);
      // A tap: a touch press on the front message, off its buttons.
      await page.evaluate(() => {
        const content = document.querySelector('#host .zx-message__content');
        content.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
      });
      await settle(page);
      assert.equal((await read(page)).state, 'expanded');
      await page.waitForTimeout(900);
      assert.equal((await read(page)).messages.length, 2, 'a message timed out in an open stack');
      // A tap outside: the press and the click it ends in.
      await page.evaluate(() => {
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
        document.body.click();
      });
      await page.waitForFunction(() => document.querySelector('#host').dataset.state === 'collapsed');
      await page.waitForFunction(() => document.querySelectorAll('#host .zx-message__toast').length === 0);
      // Emptied, the stack starts over closed.
      assert.equal(await page.evaluate(() => window.area.isExpanded()), false);
      await page.evaluate(() => window.area.destroy());
    }
  },
  {
    name: 'M5 expand(), collapse(), expanded: true, setStack(), and a clean destroy',
    async run({ page }) {
      await inline(page, { stack: true, timeout: 0 });
      await show(page, ['First', 'Second']);
      assert.equal(await page.evaluate(() => window.area.expand().isExpanded()), true);
      assert.equal((await read(page)).state, 'expanded');
      assert.equal(await page.evaluate(() => window.area.collapse().isExpanded()), false);
      assert.deepEqual(await page.evaluate(() => window.events), ['expand', 'collapse']);

      // Back to a list: oldest first, no stack styling left on the messages.
      await page.evaluate(() => window.area.setStack(false));
      let found = await read(page);
      assert.equal(found.stack, false);
      assert.equal(found.state, null);
      assert.deepEqual(found.messages.map((message) => message.text), ['First', 'Second']);
      assert.ok(found.messages.every((message) => message.depth === null));
      assert.equal(await page.evaluate(() => document.querySelector('#host .zx-message__toast').getAttribute('style')), '');
      assert.equal(await page.evaluate(() => window.area.expand().isExpanded()), false, 'a list does not open');
      await page.evaluate(() => window.area.setStack(true));
      found = await read(page);
      assert.deepEqual(found.messages.map((message) => message.text), ['Second', 'First']);

      // The host is left as it was found, twice over.
      const left = await page.evaluate(() => {
        window.area.destroy();
        window.area.destroy();
        const host = document.querySelector('#host');
        return { attributes: host.getAttributeNames().sort(), children: host.childElementCount };
      });
      assert.deepEqual(left, { attributes: ['id', 'style'], children: 0 });

      // Always open, the messages still time out.
      await inline(page, { stack: true, expanded: true, timeout: 400 });
      await show(page, ['First', 'Second']);
      assert.equal((await read(page)).state, 'expanded');
      await page.waitForFunction(() => document.querySelectorAll('#host .zx-message__toast').length === 0);
      await page.evaluate(() => window.area.destroy());
    }
  },
  {
    name: 'M6 floating regions stack by default, at the top downwards and at the foot upwards',
    async run({ page }) {
      assert.equal(await page.evaluate(() => zx.Message.getStack()), true, 'floating messages stack by default');
      // Listed first, then stacked at once: the switch reaches regions already on screen.
      assert.equal(await page.evaluate(() => zx.Message.setStack(false)), false);
      await page.evaluate(() => {
        window.handles = [];
        for (const text of ['Top one', 'Top two']) window.handles.push(zx.Message.info(text, { timeout: 0 }));
        for (const text of ['Foot one', 'Foot two', 'Foot three']) {
          window.handles.push(zx.Message.info(text, { timeout: 0, placement: 'bottom-end' }));
        }
      });
      assert.equal(await page.locator('.zx-message-region[data-stack]').count(), 0);
      assert.equal(await page.evaluate(() => zx.Message.setStack(true)), true);
      assert.equal(await page.evaluate(() => zx.Message.getStack()), true);
      await settle(page);
      const top = await read(page, '.zx-message-region[data-placement="top-end"]');
      const foot = await read(page, '.zx-message-region[data-placement="bottom-end"]');
      assert.equal(top.stack, true, 'a region on screen did not start stacking');
      assert.deepEqual(top.messages.map((message) => message.text), ['Top two', 'Top one']);
      assert.equal(top.messages[0].top, top.root.top);
      assert.ok(top.messages[1].bottom > top.messages[0].bottom, 'at the top the stack piles downwards');
      // At the foot the newest sits at the edge, last in document order, and the rest peek above it.
      assert.deepEqual(foot.messages.map((message) => message.text), ['Foot one', 'Foot two', 'Foot three']);
      const [oldest, middle, newest] = foot.messages;
      assert.equal(newest.bottom, foot.root.bottom);
      assert.ok(middle.top < newest.top && oldest.top < middle.top, 'at the foot the stack piles upwards');
      assert.equal(newest.top - middle.top, middle.top - oldest.top);

      // A new region stacks from the start; turning it off returns every region to a list.
      await page.evaluate(() => window.handles.push(zx.Message.info('Centre', { timeout: 0, placement: 'top' })));
      assert.equal(await page.locator('.zx-message-region[data-placement="top"][data-stack]').count(), 1);
      assert.equal(await page.evaluate(() => zx.Message.setStack(false)), false);
      assert.equal(await page.locator('.zx-message-region[data-stack]').count(), 0);
      const list = await read(page, '.zx-message-region[data-placement="top-end"]');
      assert.deepEqual(list.messages.map((message) => message.text), ['Top one', 'Top two']);
      await page.evaluate(() => {
        window.handles.forEach((handle) => handle.close());
        zx.Message.disposeRegion(document.body);
      });
      assert.equal(await page.locator('.zx-message-region').count(), 0);
    }
  },
  {
    name: 'M7 on a phone every floating stack piles up from the foot',
    async run({ page }) {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.evaluate(() => {
        window.handles = ['One', 'Two', 'Three'].map((text) => zx.Message.info(text, { timeout: 0 }));
      });
      await settle(page);
      const found = await read(page, '.zx-message-region');
      assert.deepEqual(found.messages.map((message) => message.text), ['One', 'Two', 'Three']);
      assert.equal(found.messages[2].bottom, found.root.bottom);
      assert.ok(found.messages[0].top < found.messages[1].top);
      assert.ok(found.root.bottom <= 800 - 16);
      await page.evaluate(() => {
        window.handles.forEach((handle) => handle.close());
        zx.Message.disposeRegion(document.body);
      });
    }
  },
  {
    name: 'M8 a mouse press pins the stack, and a toggle button outside can open and close it',
    async run({ page }) {
      await inline(page, { stack: true, timeout: 500 });
      await show(page, ['First', 'Second']);
      await page.click('#host .zx-message__content >> nth=0');
      await page.mouse.move(1000, 800);
      await settle(page);
      assert.equal((await read(page)).state, 'expanded', 'the stack folded when the pointer left after a press');
      await page.waitForTimeout(800);
      assert.equal((await read(page)).messages.length, 2, 'a message timed out in a pinned stack');
      await page.evaluate(() => {
        const toggle = document.querySelector('#before');
        toggle.onclick = () => (window.area.isExpanded() ? window.area.collapse() : window.area.expand());
      });
      await page.click('#before');
      await page.waitForTimeout(50);
      assert.equal((await read(page)).state, 'collapsed', 'the toggle did not close the pinned stack');
      await page.click('#before');
      await page.waitForTimeout(50);
      assert.equal((await read(page)).state, 'expanded', 'the toggle did not open the stack');
      await page.mouse.click(1000, 800);
      await page.waitForFunction(() => document.querySelector('#host').dataset.state === 'collapsed');
      assert.deepEqual(await page.evaluate(() => window.events), ['expand', 'collapse', 'expand', 'collapse']);
      await page.evaluate(() => window.area.destroy());
    }
  },
  {
    name: 'M9 closing a message from the keyboard moves on through the stack',
    async run({ page }) {
      await inline(page, { stack: true, timeout: 0 });
      await show(page, ['First', 'Second', 'Third']);
      await page.focus('#before');
      const focused = () => page.evaluate(() => {
        const active = document.activeElement;
        const toast = active.closest('.zx-message__toast');
        return toast ? `${toast.querySelector('.zx-message__content').textContent}:${active.className}` : active.id;
      });
      await page.keyboard.press('Tab');
      assert.match(await focused(), /^Third:.*zx-message__close/);
      await page.keyboard.press('Enter');
      await settle(page);
      assert.match(await focused(), /^Second:.*zx-message__close/, 'focus left the stack');
      assert.equal((await read(page)).state, 'expanded');
      await page.keyboard.press('Enter');
      await settle(page);
      assert.match(await focused(), /^First:.*zx-message__close/);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelectorAll('#host .zx-message__toast').length === 0);
      assert.equal(await focused(), 'before', 'the last message did not hand focus back');
      await page.evaluate(() => window.area.destroy());
    }
  },
  {
    name: 'M10 a stack that stops stacking reports it closed; an emptied one does not open',
    async run({ page }) {
      await inline(page, { stack: true, timeout: 0 });
      await show(page, ['First', 'Second']);
      await page.evaluate(() => {
        window.area.expand();
        window.area.setStack(false);
      });
      assert.deepEqual(await page.evaluate(() => window.events), ['expand', 'collapse']);
      await page.evaluate(() => {
        window.area.setStack(true);
        window.events.length = 0;
      });
      // Close every message with the pointer resting on the stack.
      await page.hover('#host .zx-message__toast >> nth=0');
      for (let count = 2; count > 0; count -= 1) {
        await page.click('#host .zx-message__toast >> nth=0 >> .zx-message__close');
        await page.waitForFunction((count) => document.querySelectorAll('#host .zx-message__toast').length === count - 1, count);
      }
      await settle(page);
      const found = await read(page);
      assert.equal(found.state, 'collapsed');
      assert.equal(found.root.height, 0, 'an emptied stack keeps its space');
      assert.equal(await page.evaluate(() => window.area.isExpanded()), false);
      assert.equal((await page.evaluate(() => window.events)).at(-1), 'collapse');
      await page.evaluate(() => window.area.destroy());
    }
  },
  {
    name: 'M11 crossing the phone breakpoint keeps Tab in visual order; a tall open stack scrolls',
    async run({ page }) {
      await page.evaluate(() => {
        window.handles = ['One', 'Two', 'Three'].map((text) => zx.Message.info(text, { timeout: 0 }));
      });
      await settle(page);
      const order = () => read(page, '.zx-message-region').then((found) => found.messages.map((message) => message.text));
      assert.deepEqual(await order(), ['Three', 'Two', 'One'], 'at the top the newest comes first');
      await page.setViewportSize({ width: 390, height: 600 });
      await page.waitForFunction(() => document.querySelector('.zx-message-region .zx-message__toast')
        ?.querySelector('.zx-message__content').textContent === 'One');
      assert.deepEqual(await order(), ['One', 'Two', 'Three'], 'at the foot the newest comes last');

      // Five long messages with actions do not fit a 600px screen open: the stack scrolls.
      await page.evaluate(() => {
        window.handles.forEach((handle) => handle.close());
        const long = 'The connection to the mail server was lost, and the outbox will retry every few '
          + 'minutes until it is back. Nothing you wrote is lost.';
        window.handles = [1, 2, 3, 4, 5].map((index) => zx.Message.warning(`${index}. ${long}`, {
          timeout: 0, action: { label: 'Retry' }
        }));
      });
      await page.waitForFunction(() => document.querySelectorAll('.zx-message-region .zx-message__toast').length === 5);
      await page.focus('.zx-message-region .zx-message__action');
      await settle(page);
      const region = await page.evaluate(() => {
        const node = document.querySelector('.zx-message-region');
        const rect = node.getBoundingClientRect();
        const toasts = Array.from(node.querySelectorAll('.zx-message__toast'), (toast) => toast.getBoundingClientRect());
        return {
          overflow: node.hasAttribute('data-overflow'), top: rect.top, bottom: rect.bottom,
          scrolls: node.scrollHeight > node.clientHeight,
          newestInView: toasts.at(-1).bottom <= rect.bottom + 1 && toasts.at(-1).top >= rect.top - 1
        };
      });
      assert.equal(region.overflow, true);
      assert.ok(region.top >= 0 && region.bottom <= 600, 'the open stack runs off the screen');
      assert.equal(region.scrolls, true);
      assert.equal(region.newestInView, true, 'the newest message is not in view');
      await page.evaluate(() => {
        window.handles.forEach((handle) => handle.close());
        zx.Message.disposeRegion(document.body);
      });
    }
  }
];
