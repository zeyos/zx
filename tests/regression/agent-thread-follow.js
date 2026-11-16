import assert from 'node:assert/strict';

/*
 * Operations streamed into `thread.surface(id)` are followed as the thread's own updates are: the
 * end stays in view while the reader is at it, and "Jump to latest" is offered once they have
 * scrolled away. `apply()`, `write()` and `end()` all count; growth after the surface's `end` is
 * the reader's own doing and moves nothing.
 */

/** Waits for the next two frames, past resize observations and scroll events. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

/** One surface, as an agent streams it: a begin, nodes that grow it, words appended, an end. */
const LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'notes', intent: 'show', title: 'Quarter notes', root: ['intro', 'list', 'note', 'code'] },
  { op: 'node', surface: 'notes', id: 'intro', type: 'text', text: 'The quarter closed above plan, with collections a week behind invoicing.' },
  { op: 'node', surface: 'notes', id: 'list', type: 'list', items: ['Invoiced', 'Collected', 'Overdue', 'Credited', 'Written off'] },
  { op: 'append', surface: 'notes', id: 'intro', text: ' Three customers account for most of what is overdue, and each has been reminded once.' },
  { op: 'node', surface: 'notes', id: 'note', type: 'callout', tone: 'info', title: 'Next', text: 'Second reminders go out on Monday.' },
  { op: 'node', surface: 'notes', id: 'code', type: 'code', language: 'js', code: Array.from({ length: 8 }, (_, n) => `book(${n});`).join('\n') },
  { op: 'end', surface: 'notes' }
];

/**
 * A thread in a short scroller, already longer than it, ending in a surface item that waits for
 * its operations.
 */
const mount = (page, options = {}) => page.evaluate((options) => {
  document.body.replaceChildren();
  const scroller = zx.h('div', { id: 'scroller', style: { blockSize: '360px', inlineSize: '640px', overflowY: 'auto' } });
  document.body.append(scroller);
  window.thread = new zx.AgentThread(null, { scroller, ...options });
  scroller.append(window.thread.toElement());
  for (let n = 0; n < 6; n += 1) {
    window.thread.upsert({ id: `m${n}`, type: 'user', text: `Message ${n}: what did the quarter look like, and what is still open?` });
  }
  window.thread.upsert({ id: 'notes', type: 'surface' });
}, options);

/** Where the reader stands: how far the end is, and whether "Jump to latest" is offered. */
const read = (page) => page.evaluate(() => {
  const scroller = document.querySelector('#scroller');
  return {
    top: Math.round(scroller.scrollTop),
    gap: Math.round(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight),
    latest: !document.querySelector('.zx-agent-thread__latest').hidden
  };
});

/** Streams one line the way the case asks: `write()` a line, `apply()` an operation, or the last line through `end()`. */
const stream = (page, index, how) => page.evaluate(({ line, how }) => {
  const surface = window.thread.surface('notes');
  if (how === 'apply') surface.apply(line);
  else if (how === 'end') surface.write(JSON.stringify(line)).end();
  else surface.write(`${JSON.stringify(line)}\n`);
}, { line: LINES[index], how });

const HOW = ['write', 'write', 'apply', 'apply', 'write', 'apply', 'end'];

export const cases = [
  {
    name: 'a surface streamed through apply(), write() and end() keeps the end in view while the reader is there',
    async run({ page }) {
      await mount(page);
      await settle(page);
      assert.equal((await read(page)).gap <= 48, true, 'the thread starts at its end');
      const heights = [];
      for (const [index, how] of HOW.entries()) {
        await stream(page, index, how);
        await settle(page);
        const where = await read(page);
        heights.push(await page.evaluate(() => document.querySelector('#scroller').scrollHeight));
        assert.ok(where.gap <= 48, `after line ${index} (${how}) the end is ${where.gap}px out of view`);
        assert.equal(where.latest, false, `after line ${index} (${how}) "Jump to latest" is offered`);
      }
      assert.ok(heights.at(-1) > heights[0] + 150, `the surface grew by ${heights.at(-1) - heights[0]}px only`);
      assert.equal(await page.evaluate(() => window.thread.surface('notes').toElement().dataset.state), 'open');
      await page.evaluate(() => window.thread.destroy());
    }
  },
  {
    name: 'a reader who scrolled away stays where they are and is offered "Jump to latest", which follows again',
    async run({ page }) {
      await mount(page);
      await stream(page, 0, 'write');
      await settle(page);
      await page.evaluate(() => { document.querySelector('#scroller').scrollTop = 0; });
      await settle(page);
      for (const index of [1, 2, 3]) {
        await stream(page, index, HOW[index]);
        await settle(page);
        const where = await read(page);
        assert.equal(where.top, 0, `line ${index} moved the reader to ${where.top}`);
        assert.equal(where.latest, true, `line ${index} offered no way back to the end`);
      }
      await page.locator('.zx-agent-thread__latest').click();
      await settle(page);
      assert.deepEqual(await read(page).then(({ gap, latest }) => ({ atEnd: gap <= 48, latest })), { atEnd: true, latest: false });
      for (const index of [4, 5, 6]) {
        await stream(page, index, HOW[index]);
        await settle(page);
        const where = await read(page);
        assert.ok(where.gap <= 48, `after "Jump to latest", line ${index} left the end ${where.gap}px out of view`);
      }
      await page.evaluate(() => window.thread.destroy());
    }
  },
  {
    name: 'growth after the surface ended is the reader\'s, and followOutput: false never moves or offers anything',
    async run({ page }) {
      await mount(page);
      for (const [index, how] of HOW.entries()) await stream(page, index, how);
      await settle(page);
      const ended = await read(page);
      assert.ok(ended.gap <= 48, `the whole surface written at once left the end ${ended.gap}px out of view`);
      // Something the reader opens inside the ended surface grows it: nothing scrolls.
      await page.evaluate(() => {
        window.thread.surface('notes').toElement().querySelector('.zx-surface__body').append(zx.h('div', { style: { blockSize: '300px' } }));
      });
      await settle(page);
      const after = await read(page);
      assert.equal(after.top, ended.top, 'growth after the end scrolled the thread');
      await page.evaluate(() => window.thread.destroy());

      await mount(page, { followOutput: false });
      await page.evaluate(() => { document.querySelector('#scroller').scrollTop = 0; });
      await settle(page);
      for (const [index, how] of HOW.entries()) {
        await stream(page, index, how);
        await settle(page);
        const where = await read(page);
        assert.deepEqual({ top: where.top, latest: where.latest }, { top: 0, latest: false }, `line ${index} with followOutput: false`);
      }
      await page.evaluate(() => window.thread.destroy());
      assert.equal(await page.evaluate(() => document.querySelector('#scroller').childElementCount), 0, 'destroy left the thread behind');
    }
  }
];
