import assert from 'node:assert/strict';

/*
 * Agent components: the activity dot's notch follows the writing direction, an idle animated face
 * keeps moving, an agent keeps its face through updates and wherever it is drawn, and the
 * Composer's queue and questions survive busy, disabled and unmount.
 */

/** Waits for the next two frames. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

export const cases = [
  {
    name: 'A1 the activity dot’s notch is cut where the dot sits, in both writing directions',
    async run({ page }) {
      const result = await page.evaluate(() => {
        document.body.replaceChildren();
        const measure = (dir) => {
          const host = zx.h('div', { dir });
          document.body.append(host);
          const avatar = new zx.AgentAvatar(null, { seed: 'agt-1', name: 'Ledger', size: 40, activity: 'working' });
          host.append(avatar.toElement());
          const root = avatar.el.getBoundingClientRect();
          const dot = avatar.el.querySelector('.zx-agent-avatar__activity').getBoundingClientRect();
          const face = avatar.el.querySelector('.zx-agent-avatar__face');
          const mask = getComputedStyle(face).maskImage || getComputedStyle(face).webkitMaskImage;
          // Where the notch is centred, read from the gradient's position.
          const at = /at\s+([\d.]+)px/.exec(mask)?.[1] ?? /at\s+calc\(([^)]*)\)/.exec(mask)?.[1] ?? mask;
          const result = { dotLeft: dot.left - root.left, width: root.width, mask, at };
          avatar.destroy();
          host.remove();
          return result;
        };
        return { ltr: measure('ltr'), rtl: measure('rtl') };
      });
      assert.ok(result.ltr.dotLeft > result.ltr.width / 2, 'the dot sits at the right in left-to-right');
      assert.ok(result.rtl.dotLeft < result.rtl.width / 2, 'the dot sits at the left in right-to-left');
      assert.notEqual(result.ltr.mask, result.rtl.mask, `the notch did not move with the dot: ${result.rtl.mask}`);
      const notchX = (mask) => Number(/at\s+([\d.]+)px/.exec(mask)?.[1]);
      const ltr = notchX(result.ltr.mask);
      const rtl = notchX(result.rtl.mask);
      if (Number.isFinite(ltr) && Number.isFinite(rtl)) {
        assert.ok(ltr > result.ltr.width / 2 && rtl < result.rtl.width / 2, `notch at ${ltr}px / ${rtl}px`);
      }
    }
  },
  {
    name: 'A2 an idle animated avatar keeps breathing in the presence loop',
    async run({ page }) {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(() => {
        document.body.replaceChildren();
        window.avatar = new zx.AgentAvatar(null, { seed: 'agt-1', name: 'Ledger', size: 48, activity: 'idle', animate: true, phase: 0 });
        document.body.append(window.avatar.toElement());
      });
      const scales = await page.evaluate(() => new Promise((resolve) => {
        const seen = [];
        const started = performance.now();
        const sample = () => {
          const match = /scale\(([\d.]+)/.exec(window.avatar.el.style.transform);
          seen.push(match ? Number(match[1]) : null);
          if (performance.now() - started < 3000) requestAnimationFrame(sample);
          else resolve(seen);
        };
        requestAnimationFrame(sample);
      }));
      const late = scales.slice(-20);
      assert.ok(late.every((value) => value !== null), 'the loop stopped writing the avatar’s transform');
      assert.ok(Math.max(...late) > 1.005, `the avatar is no longer breathing: ${late.join(', ')}`);
      await page.evaluate(() => {
        window.avatar.destroy();
        delete window.avatar;
      });
    }
  },
  {
    name: 'A3 an agent keeps its face through updates and has one face wherever it is drawn',
    async run({ page }) {
      const result = await page.evaluate(() => {
        document.body.replaceChildren();
        const traits = (element) => JSON.stringify(zx.Component.from(element.querySelector('.zx-agent-avatar')).getTraits());
        const run = new zx.RunStatus(null, { state: 'running', summary: 'Step 3 of 6', agent: true, ticking: false });
        document.body.append(run.el);
        const before = traits(run.el);
        const face = run.el.querySelector('.zx-agent-avatar');
        run.update({ summary: 'Step 4 of 6' });
        const afterSummary = traits(run.el);
        const kept = run.el.querySelector('.zx-agent-avatar') === face;

        const card = new zx.ApprovalCard(null, { title: 'Send 3 reminders?', agent: true });
        document.body.append(card.el);
        const cardBefore = traits(card.el);
        card.update({ title: 'Send 4 reminders?' });
        card.update({ tone: 'warning' });
        const cardAfter = traits(card.el);

        // One agent, described by a number seed, a string seed and a navigation item.
        const seeded = new zx.RunStatus(null, { state: 'running', summary: 'Matching', agent: { seed: 42 }, ticking: false });
        const empty = zx.emptyState({ agent: { seed: '42' }, title: 'Nothing yet' });
        const sidebar = new zx.AppSidebar(null, { items: [{ id: 'a', label: 'Ledger', agent: { seed: 42 } }] });
        document.body.append(seeded.el, empty, sidebar.toElement());
        const faces = [traits(seeded.el), traits(empty), traits(sidebar.el)];
        for (const component of [run, card, seeded, sidebar]) component.destroy();
        empty.remove();
        return { before, afterSummary, kept, cardBefore, cardAfter, faces };
      });
      assert.equal(result.afterSummary, result.before, 'a new summary changed the run’s face');
      assert.ok(result.kept, 'a new summary re-created the run’s face');
      assert.equal(result.cardAfter, result.cardBefore, 'a new title changed the request’s face');
      assert.equal(new Set(result.faces).size, 1, `{seed: 42} drew different faces: ${result.faces.join(' / ')}`);
    }
  },
  {
    name: 'A4 the Composer sends a queued message owed while it was disabled, and closes its question on destroy',
    async run({ page }) {
      const sent = await page.evaluate(async () => {
        document.body.replaceChildren();
        const composer = new zx.Composer(null, { queue: true, busy: true });
        document.body.append(composer.toElement());
        const sends = [];
        composer.on('send', (event) => sends.push({ text: event.detail.text, queued: Boolean(event.detail.queued) }));
        composer.setValue('First');
        composer.el.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        const queued = composer.getQueue().length;
        composer.update({ busy: false, disabled: true });
        const whileDisabled = sends.length;
        composer.setDisabled(false);
        const result = { queued, whileDisabled, sends: [...sends], left: composer.getQueue().length };
        composer.destroy();
        return result;
      });
      assert.equal(sent.queued, 1, 'the message was not queued');
      assert.equal(sent.whileDisabled, 0, 'a disabled composer sent');
      assert.deepEqual(sent.sends, [{ text: 'First', queued: true }], 'the owed message was not sent when enabled');
      assert.equal(sent.left, 0);

      await page.evaluate(() => {
        document.body.replaceChildren();
        window.composer = new zx.Composer(null, { queue: true, busy: true });
        document.body.append(window.composer.toElement());
        window.composer.setValue('Queued');
        window.composer.el.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        window.composer.setValue('Being written');
      });
      await page.locator('.zx-composer [data-queue-action="edit"]').click();
      await settle(page);
      assert.equal(await page.evaluate(() => document.querySelectorAll('dialog[open]').length), 1, 'the question did not open');
      await page.evaluate(() => window.composer.destroy());
      await settle(page);
      assert.equal(await page.evaluate(() => document.querySelectorAll('dialog[open]').length), 0,
        'the question stayed open after the composer went');
      await page.evaluate(() => { delete window.composer; });
    }
  },
  {
    name: 'A5 the thread marks only whole mentions',
    async run({ page }) {
      const marked = await page.evaluate(() => {
        document.body.replaceChildren();
        const thread = new zx.AgentThread(null, {});
        document.body.append(thread.toElement());
        thread.upsert({ id: 'u1', type: 'user', text: 'Mail ann@Ledger.example, ask @Annabel, then @Ledger and @Ann.', mentions: ['Ledger', 'Ann'] });
        const result = [...thread.el.querySelectorAll('.zx-agent-thread__mention')].map((element) => element.textContent);
        thread.destroy();
        return result;
      });
      assert.deepEqual(marked, ['@Ledger', '@Ann']);
    }
  }
];
