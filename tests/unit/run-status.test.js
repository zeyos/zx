import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compactMode, costLevel, currentTime, formatCompactNumber, formatRunCost, formatTokens, runDate, runTimeKeys,
  stepProgress, tokenMeter, tokenTotal
} from '../../src/components/run-status/run-status.js';

test('the cost turns to warning from 80% of the budget and to danger at 100%', () => {
  assert.equal(costLevel(0.14, 2), 'normal');
  assert.equal(costLevel(1.59, 2), 'normal');
  assert.equal(costLevel(1.6, 2), 'warning');
  assert.equal(costLevel(1.99, 2), 'warning');
  assert.equal(costLevel(2, 2), 'danger');
  assert.equal(costLevel(3.5, 2), 'danger');
});

test('a cost without a usable budget is never a warning', () => {
  for (const budget of [null, undefined, 0, -1, Number.NaN, 'none']) {
    assert.equal(costLevel(5, /** @type {any} */ (budget)), 'normal', String(budget));
  }
  assert.equal(costLevel(Number.NaN, 2), 'normal');
});

test('steps keep whole numbers, and the done count within the total', () => {
  assert.deepEqual(stepProgress({ done: 3, total: 6 }), { done: 3, total: 6, percent: 50 });
  assert.deepEqual(stepProgress({ done: 2, total: 3 }), { done: 2, total: 3, percent: 67 });
  assert.deepEqual(stepProgress({ done: 9, total: 6 }), { done: 6, total: 6, percent: 100 });
  assert.deepEqual(stepProgress({ done: -2, total: 6 }), { done: 0, total: 6, percent: 0 });
  assert.deepEqual(stepProgress({ done: 2.7, total: '4' }), { done: 2, total: 4, percent: 50 });
});

test('no steps, or none to take, draws no progressbar', () => {
  assert.equal(stepProgress(null), null);
  assert.equal(stepProgress(undefined), null);
  assert.equal(stepProgress({ done: 0, total: 0 }), null);
  assert.equal(stepProgress({}), null);
});

test('tokens read as input and output counts', () => {
  assert.equal(formatTokens([18420, 1236], { locale: 'en' }), '18,420 in · 1,236 out');
  assert.equal(formatTokens([5480, 301], { locale: 'de' }), '5.480 in · 301 out');
  assert.equal(formatTokens([12, 3], { template: '%1 → %2', locale: 'en' }), '12 → 3');
  assert.equal(formatTokens(null), '');
  assert.equal(formatTokens([12]), '');
});

test('tokens may be a single total', () => {
  assert.equal(formatTokens(22840, { locale: 'en' }), '22,840');
  assert.equal(formatTokens(22840, { locale: 'de' }), '22.840');
  assert.equal(formatTokens(-5, { locale: 'en' }), '0');
  assert.equal(formatTokens(Number.NaN), '');
  assert.equal(tokenTotal(22840), 22840);
  assert.equal(tokenTotal([18420, 1236]), 19656);
  assert.equal(tokenTotal([-3, 'x']), 0);
  for (const value of [null, undefined, [], [1], 'many', Number.POSITIVE_INFINITY]) {
    assert.equal(tokenTotal(value), null, String(value));
  }
});

test('counts read in compact figures with at most one decimal', () => {
  assert.equal(formatCompactNumber(22840, { locale: 'en' }), '22.8K');
  assert.equal(formatCompactNumber(60000, { locale: 'en' }), '60K');
  assert.equal(formatCompactNumber(1_234_567, { locale: 'en' }), '1.2M');
  assert.equal(formatCompactNumber(912, { locale: 'en' }), '912');
  assert.equal(formatCompactNumber(22840, { locale: 'de' }), '22.840', 'German has no compact thousands');
  assert.equal(formatCompactNumber(22840, { locale: 'not a locale!' }).length > 0, true, 'a bad locale falls back');
  assert.equal(formatCompactNumber(Number.NaN), '');
  assert.equal(formatCompactNumber(/** @type {any} */ ('22840')), '');
});

test('tokens against a budget are a meter with words and a level', () => {
  assert.deepEqual(tokenMeter(22840, 60000, { locale: 'en' }),
    { total: 22840, budget: 60000, level: 'normal', text: '22.8K of 60K tokens' });
  assert.deepEqual(tokenMeter([40000, 8000], 60000, { locale: 'en' }),
    { total: 48000, budget: 60000, level: 'warning', text: '48K of 60K tokens' });
  assert.equal(tokenMeter(60000, 60000, { locale: 'en' }).level, 'danger');
  assert.equal(tokenMeter(75000, 60000, { locale: 'en' }).level, 'danger');
  assert.equal(tokenMeter(47999, 60000, { locale: 'en' }).level, 'normal');
  assert.equal(tokenMeter(1200, 4000, { locale: 'en', template: '%1 / %2' }).text, '1.2K / 4K');
});

test('tokens without a usable budget, or without counts, stay text', () => {
  for (const budget of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, '60000']) {
    assert.equal(tokenMeter(22840, budget), null, String(budget));
  }
  assert.equal(tokenMeter(null, 60000), null);
  assert.equal(tokenMeter([12], 60000), null);
});

test('compact draws the glyph and word, or the glyph alone', () => {
  assert.equal(compactMode(true), 'word');
  assert.equal(compactMode('icon'), 'icon');
  for (const value of [false, null, undefined, 0, '']) assert.equal(compactMode(value), null, String(value));
});

test('a blocked run shows since when it is blocked, and never a finished time', () => {
  assert.deepEqual(runTimeKeys('blocked'), { since: 'runStatus.blockedSince', finished: null });
  assert.deepEqual(runTimeKeys('waiting'), { since: 'runStatus.waitingSince', finished: null });
  assert.deepEqual(runTimeKeys('running'), { since: null, finished: null });
  assert.deepEqual(runTimeKeys('queued'), { since: null, finished: null });
  assert.deepEqual(runTimeKeys('paused'), { since: null, finished: null });
  assert.deepEqual(runTimeKeys('done'), { since: null, finished: 'runStatus.finished' });
  assert.deepEqual(runTimeKeys('failed'), { since: null, finished: 'runStatus.failedAt' });
  assert.deepEqual(runTimeKeys('stopped'), { since: null, finished: 'runStatus.stoppedAt' });
  assert.deepEqual(runTimeKeys('mystery'), runTimeKeys('done'), 'an unknown state reads as done');
});

test('the clock is the now option when it gives a usable time, and real time otherwise', () => {
  const fixed = new Date(2026, 8, 29, 11, 20);
  assert.equal(currentTime(() => fixed).getTime(), fixed.getTime());
  assert.notEqual(currentTime(() => fixed), fixed, 'the date is copied, never shared');
  assert.equal(currentTime(() => fixed.getTime()).getTime(), fixed.getTime());
  for (const now of [null, undefined, () => null, () => 'today', () => new Date(Number.NaN)]) {
    const before = Date.now();
    const time = currentTime(now).getTime();
    assert.ok(time >= before && time <= Date.now(), String(now));
  }
});

test('the cost reads against its budget, or alone without one', () => {
  assert.equal(formatRunCost({ amount: 0.14, budget: 2, currency: 'EUR' }, { locale: 'en' }), '€0.14 of €2.00');
  assert.equal(formatRunCost({ amount: 0.14, currency: 'EUR' }, { locale: 'en' }), '€0.14');
  assert.equal(formatRunCost({ amount: 1.2, budget: 0, currency: 'USD' }, { locale: 'en' }), '$1.20');
  assert.equal(formatRunCost({ amount: 1, budget: 2, currency: 'EUR' }, { locale: 'en', template: '%1 / %2' }), '€1.00 / €2.00');
  assert.equal(formatRunCost(null), '');
  assert.equal(formatRunCost({ amount: 'lots' }), '');
});

test('run times read local ISO strings and dates, and nothing else', () => {
  const date = runDate('2026-09-29T11:20:04');
  assert.ok(date instanceof Date);
  assert.deepEqual([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()],
    [2026, 8, 29, 11, 20], 'a string without an offset is local time');
  assert.equal(runDate('2026-09-29').getHours(), 0, 'a bare date is local midnight');
  const given = new Date(2026, 0, 2, 3, 4);
  assert.notEqual(runDate(given), given, 'a date is copied, never shared');
  assert.equal(runDate(given).getTime(), given.getTime());
  for (const value of [null, undefined, '', 'yesterday', 1_700_000_000_000, new Date(Number.NaN)]) {
    assert.equal(runDate(value), null, String(value));
  }
});
