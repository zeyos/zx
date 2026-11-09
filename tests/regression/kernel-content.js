import assert from 'node:assert/strict';

const blocks = (page, id = 'answer') => page.evaluate((key) => thread.get(key).blocks, id);

export const cases = [
  {
    name: 'K3 metadata redraws preserve live text and appended blocks with zero, one or several versions',
    async run({ page }) {
      for (const versionCount of [0, 1, 2]) {
        await page.evaluate((count) => {
          window.thread = new zx.AgentThread(null, { followOutput: false });
          document.body.append(thread.el);
          const item = { id: 'answer', type: 'answer', author: 'agent', streaming: true,
            blocks: [{ type: 'p', text: 'Seed' }] };
          if (count) item.versions = Array.from({ length: count }, (_, index) => ({
            blocks: [{ type: 'p', text: index === count - 1 ? 'Seed' : 'Earlier version' }]
          }));
          thread.upsert(item);
          thread.appendText('answer', '\n\nLive **text**');
          thread.appendBlock('answer', { type: 'code', language: 'js', code: 'const keep = true;' });
        }, versionCount);
        const expected = await blocks(page);
        assert.equal(expected.length, 3);
        for (const partial of [
          { model: 'Updated metadata', sources: [{ n: 1, title: 'Source', url: 'https://example.test/' }] },
          { at: '2026-11-09T08:00:00Z' },
          { author: 'reviewer', rating: 'up' },
          { stepsOpen: true, steps: [{ id: 'step', label: 'Checked', status: 'done' }] }
        ]) {
          await page.evaluate((partial) => thread.patch('answer', partial), partial);
          assert.deepEqual(await blocks(page), expected, `version count ${versionCount}: ${Object.keys(partial)}`);
          assert.deepEqual(await page.evaluate(() => thread.getComponent('answer').getBlocks()), expected);
        }
        if (versionCount > 1) {
          assert.deepEqual(await page.evaluate(() => thread.get('answer').versions[1].blocks), expected);
          await page.evaluate(() => thread.patch('answer', { streaming: false }));
          await page.locator('[data-thread-dir="previous"]').click();
          assert.deepEqual(await blocks(page), [{ type: 'p', text: 'Earlier version' }]);
          await page.locator('[data-thread-dir="next"]').click();
          assert.deepEqual(await blocks(page), expected);
        }
        await page.evaluate(() => { thread.destroy(); thread.destroy(); });
        assert.equal(await page.locator('.zx-agent-thread, .zx-block-view').count(), 0);
      }
    }
  },
  {
    name: 'K3 explicit blocks, versions and complete item replacements remain authoritative',
    async run({ page }) {
      await page.evaluate(() => {
        window.thread = new zx.AgentThread(null, { followOutput: false });
        document.body.append(thread.el);
        thread.appendText('answer', 'Live text');
        thread.patch('answer', { blocks: [] });
      });
      assert.deepEqual(await blocks(page), []);
      await page.evaluate(() => {
        thread.appendText('answer', 'Discard this stream');
        thread.patch('answer', { versions: [
          { blocks: [{ type: 'p', text: 'First explicit version' }] },
          { blocks: [{ type: 'p', text: 'Second explicit version' }] }
        ], version: 1 });
      });
      assert.deepEqual(await blocks(page), [{ type: 'p', text: 'Second explicit version' }]);
      await page.evaluate(() => {
        thread.appendText('answer', ' + streamed');
        thread.patch('answer', { blocks: [{ type: 'p', text: 'Explicit block replacement' }] });
      });
      assert.deepEqual(await blocks(page), [{ type: 'p', text: 'Explicit block replacement' }]);
      await page.evaluate(() => thread.patch('answer', { versions: [
        { blocks: [{ type: 'p', text: 'Replacement version zero' }] },
        { blocks: [{ type: 'p', text: 'Replacement version one' }] }
      ] }));
      assert.deepEqual(await blocks(page), [{ type: 'p', text: 'Replacement version one' }]);
      await page.evaluate(() => {
        thread.upsert({ id: 'answer', type: 'answer', blocks: [{ type: 'p', text: 'Complete replacement' }] });
      });
      assert.deepEqual(await blocks(page), [{ type: 'p', text: 'Complete replacement' }]);
      await page.evaluate(() => thread.destroy());
      assert.equal(await page.locator('.zx-agent-thread').count(), 0);
    }
  },
  {
    name: 'K3 real UI-message stream metadata and replay retain the exact authoritative text',
    async run({ page }) {
      await page.evaluate(() => {
        window.thread = new zx.AgentThread(null, { followOutput: false });
        document.body.append(thread.el);
        window.stream = zx.connectUiMessageStream(thread, {
          onmetadata(metadata) { thread.patch('replay', metadata); }
        });
        window.parts = [
          { type: 'start', messageId: 'replay' },
          { type: 'text-start', id: 'text' },
          { type: 'text-delta', id: 'text', delta: 'Before metadata. ' },
          { type: 'message-metadata', messageMetadata: { model: 'Recorded model' } },
          { type: 'text-delta', id: 'text', delta: 'After metadata.' },
          { type: 'text-end', id: 'text' },
          { type: 'finish', finishReason: 'stop' }
        ];
        for (const part of parts) stream.handle(part);
      });
      const expected = [{ type: 'p', text: 'Before metadata. After metadata.' }];
      assert.deepEqual(await blocks(page, 'replay'), expected);
      for (let cycle = 0; cycle < 2; cycle++) {
        await page.evaluate(() => {
          stream.replay('replay');
          for (const part of parts) stream.handle(part);
        });
        assert.deepEqual(await blocks(page, 'replay'), expected);
        assert.equal(await page.locator('article[data-id="replay"]').count(), 1);
      }
      await page.evaluate(() => { stream.destroy(); thread.destroy(); });
      assert.equal(await page.locator('.zx-agent-thread').count(), 0);
    }
  },
  {
    name: 'K4 h rejects HTML sinks before DOM mutation, including property and attribute spellings',
    async run({ page }) {
      const result = await page.evaluate(() => {
        window.sinkExecutions = 0;
        const names = ['innerHTML', 'innerhtml', 'InnerHTML', 'INNERHTML',
          'outerHTML', 'outerhtml', 'OuterHtml', 'srcdoc', 'srcDoc', 'SRCDOC'];
        const failures = [];
        const created = [];
        const create = document.createElement.bind(document);
        document.createElement = (...args) => { const element = create(...args); created.push(element); return element; };
        try {
          for (const key of names) {
            let rejected = false;
            try {
              zx.h(key.toLowerCase() === 'srcdoc' ? 'iframe' : 'div', {
                id: 'must-not-mutate', [key]: '<img src="invalid" onerror="window.sinkExecutions++">'
              });
            } catch (error) { rejected = error instanceof TypeError; }
            if (!rejected) failures.push(key);
          }
        } finally { document.createElement = create; }
        return { failures, created: created.length, executed: sinkExecutions };
      });
      assert.deepEqual(result, { failures: [], created: 0, executed: 0 });
    }
  },
  {
    name: 'K4 h filters href in native and fallback paths while preserving normal properties and trusted content',
    async run({ page }) {
      const result = await page.evaluate(() => {
        const safe = ['/records/42', '../files', '#details', 'https://example.test/',
          'http://example.test/', 'mailto:help@example.test', 'tel:+431234'];
        const unsafe = ['javascript:window.hrefExecuted=true', 'java\nscript:alert(1)',
          'data:text/html,unsafe', 'vbscript:msgbox(1)', 'http://['];
        const failures = [];
        for (const tag of ['a', 'div']) {
          for (const key of ['href', 'HREF', 'Href']) {
            for (const value of safe) {
              const node = zx.h(tag, { [key]: ` ${value} ` });
              if (node.getAttribute('href') !== value) failures.push(`${tag}.${key} rejected ${value}`);
            }
            for (const value of unsafe) {
              const node = zx.h(tag, { [key]: value });
              if (node.hasAttribute('href')) failures.push(`${tag}.${key} accepted ${value}`);
            }
          }
        }
        window.clicks = 0;
        const refs = {};
        const button = zx.h.scope(refs, () => zx.h('button', {
          id: 'normal', ref: 'button', type: 'button', class: ['first', 'second'],
          title: 'Normal properties', ariaLabel: 'Normal button', 'aria-pressed': false,
          dataset: { marker: 42, empty: null }, style: { '--custom-value': 'kept', paddingInline: '10px' },
          onclick: () => clicks++
        }, 'Safe <text>', zx.h.raw('<strong>Trusted</strong>')));
        const compact = zx.__('span.compact', { Dkind: 'plain' }, '<b>Literal text</b>');
        const field = zx.h('input', { id: 'field', value: 'Value', checked: true, disabled: false });
        document.body.append(button, compact, field);
        return { failures, ref: refs.button === button, className: button.className,
          label: button.getAttribute('aria-label'), pressed: button.getAttribute('aria-pressed'),
          data: button.dataset.marker, empty: button.hasAttribute('data-empty'),
          style: button.style.getPropertyValue('--custom-value'),
          trusted: button.querySelector('strong')?.textContent,
          compact: compact.textContent, compactMarkup: compact.querySelector('b') !== null,
          value: field.value, checked: field.checked, disabled: field.disabled };
      });
      assert.deepEqual(result, { failures: [], ref: true, className: 'first second',
        label: 'Normal button', pressed: 'false', data: '42', empty: false, style: 'kept',
        trusted: 'Trusted', compact: '<b>Literal text</b>', compactMarkup: false,
        value: 'Value', checked: true, disabled: false });
      await page.locator('#normal').click();
      assert.equal(await page.evaluate(() => clicks), 1);
    }
  }
];
