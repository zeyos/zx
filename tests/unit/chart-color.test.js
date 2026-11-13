import assert from 'node:assert/strict';
import test from 'node:test';

import {
  engineColor, formatLegacyColor, legacyColor, paintedColor, parseCssColor, withAlpha
} from '../../src/components/chart/color.js';

const LEGACY = /^(?:#[\da-f]{6}|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0?\.\d+)\))$/;

test('opaque colours become #rrggbb and translucent ones rgba()', () => {
  assert.equal(legacyColor('rgb(15, 23, 42)'), '#0f172a');
  assert.equal(legacyColor('rgb(15 23 42)'), '#0f172a');
  assert.equal(legacyColor('rgba(0, 0, 0, 0.5)'), 'rgba(0, 0, 0, 0.5)');
  assert.equal(legacyColor('rgb(1 2 3 / 50%)'), 'rgba(1, 2, 3, 0.5)');
  assert.equal(legacyColor('rgb(100% 0% 50%)'), '#ff0080');
  assert.equal(legacyColor('#abc'), '#aabbcc');
  assert.equal(legacyColor('#ABCDEF'), '#abcdef');
  assert.equal(legacyColor('#11223380'), 'rgba(17, 34, 51, 0.502)');
  assert.equal(legacyColor('transparent'), 'rgba(0, 0, 0, 0)');
});

test('the computed form of a color-mix() in srgb is read, alpha included', () => {
  // What Chrome reports for the dark theme border token.
  assert.equal(legacyColor('color(srgb 1 1 1 / 0.09)'), 'rgba(255, 255, 255, 0.09)');
  assert.equal(legacyColor('color(srgb 0.2 0.4 0.6)'), '#336699');
  assert.equal(legacyColor('color(srgb none 0.5 1)'), '#0080ff');
  assert.equal(legacyColor('color(srgb 50% 50% 50% / 25%)'), 'rgba(128, 128, 128, 0.25)');
  assert.equal(legacyColor('color(srgb-linear 0.5 0.5 0.5)'), '#bcbcbc');
});

test('every colour space a computed value can be written in converts to the same sRGB red', () => {
  for (const red of [
    'oklch(0.627955 0.257683 29.2339)',
    'oklch(62.7955% 0.257683 29.2339deg)',
    'oklab(0.627955 0.224863 0.125846)',
    'lab(54.29 80.8 69.89)',
    'lch(54.29 106.84 40.86)',
    'color(xyz 0.4124 0.2126 0.0193)',
    'color(xyz-d65 0.4124 0.2126 0.0193)',
    'color(xyz-d50 0.4361 0.2225 0.0139)',
    'hsl(0 100% 50%)',
    'hsl(1turn 100% 50%)',
    'hwb(0 0% 0%)'
  ]) assert.equal(legacyColor(red), '#ff0000', red);
  assert.equal(legacyColor('oklab(0.5 0 0)'), '#636363');
  assert.equal(legacyColor('oklch(70% 0.1 200 / 0.5)'), 'rgba(64, 177, 183, 0.5)');
  assert.equal(legacyColor('hsl(120 100% 25%)'), '#008000');
  assert.equal(legacyColor('hsla(120, 100%, 25%, 0.5)'), 'rgba(0, 128, 0, 0.5)');
  assert.equal(legacyColor('hwb(120 0% 50%)'), '#008000');
});

test('a colour outside sRGB is clipped per channel, never left out of range', () => {
  assert.equal(legacyColor('color(display-p3 1 0 0)'), '#ff0000');
  assert.equal(legacyColor('color(display-p3 0 1 0)'), '#00ff00');
  assert.equal(legacyColor('rgb(300 -5 0)'), '#ff0000');
  assert.equal(legacyColor('oklch(0.9 0.4 150)'), '#00ff00');
});

test('what only an element can resolve is refused rather than guessed', () => {
  for (const value of [
    'red', 'var(--zx-color-text)', 'color-mix(in srgb, #ffffff, #000000)', 'light-dark(#ffffff, #000000)',
    'color(rec2020 1 0 0)', 'rgb(1 2)', 'rgb(a b c)', '#12', '#12345', 'oklch(1 2 3 / 4 / 5)', '', null, undefined, 12
  ]) assert.equal(legacyColor(value), null, String(value));
  assert.equal(parseCssColor('currentcolor'), null);
});

test('withAlpha replaces the opacity and keeps the legacy syntax', () => {
  assert.equal(withAlpha('#336699', 0.5), 'rgba(51, 102, 153, 0.5)');
  assert.equal(withAlpha('rgba(51, 102, 153, 0.2)', 1), '#336699');
  assert.equal(withAlpha('color(srgb 1 1 1 / 0.09)', 0.25), 'rgba(255, 255, 255, 0.25)');
  assert.equal(withAlpha('nonsense', 0.5), null);
});

test('formatLegacyColor rounds channels and alpha into what a legacy parser accepts', () => {
  assert.equal(formatLegacyColor({ r: 254.6, g: -3, b: 12.4, a: 1 }), '#ff000c');
  assert.equal(formatLegacyColor({ r: 1, g: 2, b: 3, a: 0.9996 }), '#010203');
  assert.equal(formatLegacyColor({ r: 1, g: 2, b: 3, a: 0.12345 }), 'rgba(1, 2, 3, 0.123)');
  for (const value of ['#abc', 'rgb(1 2 3 / 0.3)', 'oklch(0.7 0.2 120 / 0.123456)', 'color(srgb 1 1 1 / 0.09)']) {
    assert.match(legacyColor(value), LEGACY, value);
  }
});

test('the painted fallback reads back what a canvas drew and reports an invalid colour as null', () => {
  const canvasDocument = (accepts) => ({
    createElement: () => ({
      getContext: () => {
        let style = '#000000';
        return {
          get fillStyle() { return style; },
          set fillStyle(value) { if (value.startsWith('#') || accepts(value)) style = value; },
          clearRect() {},
          fillRect() {},
          getImageData: () => ({ data: [16, 32, 48, 128] })
        };
      }
    })
  });
  assert.equal(paintedColor('color(rec2020 1 0 0)', canvasDocument(() => true)), 'rgba(16, 32, 48, 0.502)');
  assert.equal(paintedColor('#010203', canvasDocument(() => true)), 'rgba(16, 32, 48, 0.502)', 'a colour equal to the sentinel');
  assert.equal(paintedColor('nonsense', canvasDocument(() => false)), null);
  assert.equal(paintedColor('red', null), null, 'no document');
  assert.equal(paintedColor('red', { createElement: () => ({ getContext: () => null }) }), null, 'no 2D context');
  assert.equal(paintedColor('red', { createElement() { throw new Error('no canvas'); } }), null);
});

test('engineColor parses first, paints second, and otherwise hands over nothing', () => {
  assert.equal(engineColor('color(srgb 1 1 1 / 0.09)', null), 'rgba(255, 255, 255, 0.09)');
  assert.equal(engineColor('color(rec2020 1 0 0)', null), undefined);
});
