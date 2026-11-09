import assert from 'node:assert/strict';
import test from 'node:test';
import { auditCss } from '../lint-tokens.js';

const dataUrl = (svg, encoding = 'url') => encoding === 'base64'
  ? `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  : `data:image/svg+xml,${encodeURIComponent(svg)}`;
const sheet = (svg, encoding) => `.example { background-image: url("${dataUrl(svg, encoding)}"); }`;

test('the CSS audit rejects raw SVG paints in quoted URL and base64 data', () => {
  assert.ok(auditCss(`.x { background: url('data:image/svg+xml,${encodeURIComponent('<svg fill="red"/>')}'); }`).length);
  assert.ok(auditCss(`.x { background: url("data:image/svg+xml,<svg fill='red'/>"); }`).length);
  assert.ok(auditCss('.x { background: url("data:image/svg+xml,<svg fill=\\"red\\"/>"); }').length);
  for (const encoding of ['url', 'base64']) {
    for (const paint of ['#abc', '#abcdef', 'rgb(1 2 3)', 'hsl(10 20% 30%)', 'oklch(40% .2 30)', 'red']) {
      for (const attr of ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color']) {
        const found = auditCss(sheet(`<svg xmlns="http://www.w3.org/2000/svg"><path ${attr}="${paint}"/></svg>`, encoding));
        assert.ok(found.some(({ message }) => message.startsWith('SVG ')), `${encoding} ${attr}=${paint}`);
      }
    }
    assert.ok(auditCss(sheet('<svg><path style="fill: red; stroke: #fff"/></svg>', encoding)).length >= 2);
    assert.ok(auditCss(sheet('<svg><style>.red { fill: #abcdef; }</style></svg>', encoding)).length);
    assert.ok(auditCss(sheet('<svg><path fill="&#35;abcdef" stroke="&#114;ed"/></svg>', encoding)).length >= 2);
    assert.ok(auditCss(sheet('<svg><path style="fill: &#35;abcdef; stroke: &#114;ed"/></svg>', encoding)).length >= 2);
  }
});

test('quoted strings, SVG ids and theme-neutral paints remain legitimate', () => {
  assert.deepEqual(auditCss('[data-tone="red"] { content: "#fff blue rgb(0 0 0)"; color: var(--zx-color-text); }'), []);
  for (const encoding of ['url', 'base64']) {
    const svg = '<svg id="red" data-fill="red" data-label=\'stroke="red"\'><defs><linearGradient id="abcdef"/></defs>'
      + '<path id="fff" fill="url(#abcdef)" stroke="currentColor"/>'
      + '<text fill="none">red #fff rgb(1 2 3) fill="red"</text>'
      + '<style>#abcdef { fill: currentColor; } .red { fill: url(#fff); font-family: red; content: "red"; }</style></svg>';
    assert.deepEqual(auditCss(sheet(svg, encoding)), [], encoding);
  }
  assert.deepEqual(auditCss('/* color: red */ .x { color: currentColor; background: transparent; }'), []);
});

test('ordinary CSS colours, fallbacks, tier-one reads and outline suppression stay checked', () => {
  const found = auditCss('.x { color: var(--missing, #abc); background: red; outline: none; color: var(--zx-gray-500); }', { checkTierOne: true });
  assert.ok(found.some(({ message }) => /hex color.*var\(\) fallback/.test(message)));
  assert.ok(found.some(({ message }) => /named color/.test(message)));
  assert.ok(found.some(({ message }) => /outline suppression/.test(message)));
  assert.ok(found.some(({ message }) => /tier-1/.test(message)));
  assert.deepEqual(auditCss('.x { outline: none; /* lint: outline-ok */ }'), []);
});
