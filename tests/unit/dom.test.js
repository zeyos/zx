import assert from 'node:assert/strict';
import test from 'node:test';

import { htmlEscape } from '../../src/core/dom.js';

test('htmlEscape escapes all HTML-significant characters', () => {
  assert.equal(
    htmlEscape(`<button title="'">A & B</button>`),
    '&lt;button title=&quot;&#39;&quot;&gt;A &amp; B&lt;/button&gt;'
  );
});

test('htmlEscape coerces non-string scalar values', () => {
  assert.equal(htmlEscape(42), '42');
});
