import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNumber, snapNumber } from '../../src/components/number-field/number-field.js';

test('parseNumber accepts both decimal separators and ignores grouping', () => {
  assert.equal(parseNumber('42'), 42);
  assert.equal(parseNumber('42.5'), 42.5);
  assert.equal(parseNumber('42,5'), 42.5);
  assert.equal(parseNumber('1.234,56'), 1234.56);
  assert.equal(parseNumber('1,234.56'), 1234.56);
  assert.equal(parseNumber('1 234'), 1234);
  assert.equal(parseNumber('  -8 '), -8);
  assert.equal(parseNumber('€ 1.200,00'), 1200);
});

test('parseNumber returns null for empty and unparseable input', () => {
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('   '), null);
  assert.equal(parseNumber(null), null);
  assert.equal(parseNumber(undefined), null);
  assert.equal(parseNumber('abc'), null);
  assert.equal(parseNumber(Number.NaN), null);
  assert.equal(parseNumber(Number.POSITIVE_INFINITY), null);
});

test('parseNumber passes finite numbers through unchanged', () => {
  assert.equal(parseNumber(3.14), 3.14);
  assert.equal(parseNumber(0), 0);
  assert.equal(parseNumber(-0.5), -0.5);
});

test('snapNumber rounds onto the step grid relative to min', () => {
  const spec = { min: 0, max: 100, step: 5, precision: 0 };
  assert.equal(snapNumber(7, spec), 5);
  assert.equal(snapNumber(8, spec), 10);
  assert.equal(snapNumber(0, spec), 0);
  // A grid anchored at a non-zero minimum yields 5, 15, 25 rather than 10, 20, 30.
  assert.equal(snapNumber(12, { min: 5, max: 95, step: 10, precision: 0 }), 15);
  assert.equal(snapNumber(9, { min: 5, max: 95, step: 10, precision: 0 }), 5);
});

test('snapNumber clamps to the hard bounds', () => {
  const spec = { min: 1, max: 9, step: 2, precision: 0 };
  assert.equal(snapNumber(-40, spec), 1);
  assert.equal(snapNumber(40, spec), 9);
  assert.equal(snapNumber(1000, { min: null, max: 7, step: 1, precision: 0 }), 7);
  assert.equal(snapNumber(-1000, { min: -3, max: null, step: 1, precision: 0 }), -3);
});

test('snapNumber keeps fractional steps free of floating-point drift', () => {
  const spec = { min: 0, max: 1, step: 0.1, precision: 1 };
  assert.equal(snapNumber(0.1 + 0.2, spec), 0.3);
  assert.equal(snapNumber(0.7000000000000001, spec), 0.7);
  assert.equal(snapNumber(0.25, { min: 0, max: 10, step: 0.25, precision: 2 }), 0.25);
  // Repeated accumulation must stay exact rather than drifting to 0.9999999999999999.
  let value = 0;
  for (let index = 0; index < 10; index += 1) value = snapNumber(value + 0.1, spec);
  assert.equal(value, 1);
});

test('snapNumber leaves values untouched when stepping is disabled', () => {
  assert.equal(snapNumber(3.14159, { min: null, max: null, step: 0, precision: 5 }), 3.14159);
});

test('snapNumber never returns a value outside the hard bounds', () => {
  // Rounding used to run after clamping, so a fractional max could round back out of range.
  assert.equal(snapNumber(100, { min: 0, max: 9.5, step: 1, precision: 0 }), 9.5);
  assert.equal(snapNumber(-100, { min: 0.5, max: 10, step: 1, precision: 0 }), 0.5);
  assert.equal(snapNumber(8, { min: 0, max: 7.25, step: 0.5, precision: 1 }), 7.25);
});

test('parseNumber uses the locale separators when they are known', () => {
  const enUS = { group: ',', decimal: '.' };
  const deDE = { group: '.', decimal: ',' };
  // Without separators, a lone comma reads as a decimal point — the best guess for free typing.
  assert.equal(parseNumber('1,234'), 1.234);
  // With them, the displayed grouped value round-trips exactly.
  assert.equal(parseNumber('1,234', enUS), 1234);
  assert.equal(parseNumber('1,234,567.50', enUS), 1234567.5);
  assert.equal(parseNumber('1.234', deDE), 1234);
  assert.equal(parseNumber('1.234.567,50', deDE), 1234567.5);
  assert.equal(parseNumber('€ 1.234,00', deDE), 1234);
  assert.equal(parseNumber('', enUS), null);
  assert.equal(parseNumber('abc', enUS), null);
});

test('a grouped field can always read back what it displayed', () => {
  // The field renders through Intl in the configured locale and parses with that locale's
  // separators, so every value it shows survives an untouched focus/blur round-trip.
  for (const [locale, separators] of [
    ['en-US', { group: ',', decimal: '.' }],
    ['de-DE', { group: '.', decimal: ',' }],
    ['fr-FR', null]
  ]) {
    const resolved = separators ?? readSeparators(locale);
    for (const value of [0, 7, 1234, 9876543.25, -4200.5]) {
      for (const grouping of [true, false]) {
        const shown = new Intl.NumberFormat(locale, {
          minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: grouping
        }).format(value);
        assert.equal(parseNumber(shown, resolved), value, `${locale} ${value} grouped=${grouping}`);
      }
    }
  }
});

/** @param {string} locale @returns {{group: string, decimal: string}} */
function readSeparators(locale) {
  const parts = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).formatToParts(1234.5);
  return {
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.'
  };
}
