import assert from 'node:assert/strict';
import test from 'node:test';

import { htmlEscape, safeHref } from '../../src/core/dom.js';

test('htmlEscape escapes all HTML-significant characters', () => {
  assert.equal(
    htmlEscape(`<button title="'">A & B</button>`),
    '&lt;button title=&quot;&#39;&quot;&gt;A &amp; B&lt;/button&gt;'
  );
});

test('htmlEscape coerces non-string scalar values', () => {
  assert.equal(htmlEscape(42), '42');
});

test('safeHref preserves ordinary destinations and rejects executable or malformed schemes', () => {
  assert.equal(safeHref('  #invoices  '), '#invoices');
  assert.equal(safeHref('/records/42'), '/records/42');
  assert.equal(safeHref('mailto:help@example.test'), 'mailto:help@example.test');
  for (const href of [
    'javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)', '', 'http://['
  ]) assert.equal(safeHref(href), null, `accepted unsafe href: ${href}`);
});
