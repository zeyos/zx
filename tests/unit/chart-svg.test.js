import assert from 'node:assert/strict';
import test from 'node:test';
import { Worker } from 'node:worker_threads';

import {
  arcPath, arcSlices, barSlots, labelStep, linePath, linearScale, niceScale, niceStep, polar,
  ringRadii, tickPrecision
} from '../../src/components/chart/svg-geometry.js';
import { SvgChartAdapter } from '../../src/components/chart/svg-adapter.js';

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);

test('a nice step is 1, 2 or 5 × 10ⁿ, chosen at the geometric midpoints', () => {
  assert.equal(niceStep(16.8), 20);
  assert.equal(niceStep(10), 10);
  assert.equal(niceStep(1.4), 1);
  assert.equal(niceStep(1.5), 2);
  assert.equal(niceStep(3.2), 5);
  assert.equal(niceStep(7.5), 10);
  assert.equal(niceStep(0.2), 0.2);
  assert.equal(niceStep(0.03), 0.02);
  assert.equal(niceStep(25000), 20000);
  assert.equal(niceStep(0), 1, 'no span falls back to 1');
  assert.equal(niceStep(Number.NaN), 1);
});

test('a nice scale widens the values outwards to round ticks', () => {
  assert.deepEqual(niceScale(0, 84, 5), { min: 0, max: 100, step: 20, ticks: [0, 20, 40, 60, 80, 100] });
  assert.deepEqual(niceScale(-12, 30, 4), { min: -20, max: 30, step: 10, ticks: [-20, -10, 0, 10, 20, 30] });
  assert.deepEqual(niceScale(34680, 70100, 4).ticks, [30000, 40000, 50000, 60000, 70000, 80000]);
  assert.deepEqual(niceScale(30, 10, 2).ticks, [10, 20, 30], 'reversed bounds are put in order');
});

test('ticks carry no float noise', () => {
  assert.deepEqual(niceScale(0, 1, 5).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceScale(0.1, 0.3, 2).ticks, [0.1, 0.2, 0.3]);
  assert.deepEqual(niceScale(0, 0.25, 5).ticks, [0, 0.05, 0.1, 0.15, 0.2, 0.25]);
});

test('a flat or empty range still has an axis', () => {
  assert.deepEqual(niceScale(5, 5).ticks, [0, 1, 2, 3, 4, 5], 'a positive value is drawn from zero');
  assert.deepEqual(niceScale(-4, -4, 4).ticks, [-4, -3, -2, -1, 0], 'a negative value up to zero');
  assert.deepEqual(niceScale(0, 0).ticks.slice(0, 2), [0, 0.2], 'zero alone spans zero to one');
  assert.equal(niceScale(0, 0).max, 1);
  assert.deepEqual(niceScale(Number.NaN, Number.POSITIVE_INFINITY), niceScale(0, 0), 'non-finite bounds count as zero');
});

/** A scale's ticks are finite, distinct, ascending, few, and enclose the values. */
const assertSound = (scale, low, high, message) => {
  assert.ok(scale.ticks.length >= 2 && scale.ticks.length <= 100, `${message}: ${scale.ticks.length} ticks`);
  assert.ok(scale.ticks.every(Number.isFinite), `${message}: finite ticks`);
  assert.ok(scale.ticks.every((tick, index) => index === 0 || tick > scale.ticks[index - 1]), `${message}: distinct, ascending ticks`);
  assert.equal(scale.min, scale.ticks[0]);
  assert.equal(scale.max, scale.ticks[scale.ticks.length - 1]);
  assert.ok(scale.min <= Math.min(low, high) && scale.max >= Math.max(low, high), `${message}: ${scale.min}…${scale.max} encloses the values`);
  return scale;
};

/**
 * Scales computed in a worker, so that one that never finishes fails the test after a second
 * instead of stalling the whole run.
 * @param {Array<[number, number, number]>} cases
 * @returns {Promise<Array<import('../../src/components/chart/svg-geometry.js').NiceScale>>}
 */
const scalesInWorker = (cases) => new Promise((resolve, reject) => {
  const worker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    import(workerData.module).then(({ niceScale }) => parentPort.postMessage(workerData.cases.map((args) => niceScale(...args))));
  `, { eval: true, workerData: { module: new URL('../../src/components/chart/svg-geometry.js', import.meta.url).href, cases } });
  const timer = setTimeout(() => {
    void worker.terminate();
    reject(new Error('niceScale did not finish within a second'));
  }, 1000);
  worker.once('message', (scales) => { clearTimeout(timer); void worker.terminate(); resolve(scales); });
  worker.once('error', (error) => { clearTimeout(timer); reject(error); });
});

test('any finite values give a few distinct ticks, and never hang', async () => {
  // Each of the first four looped forever once: an index of 2e16 that adding one no longer
  // changes, a step finer than the values can tell apart, a span wider than a double.
  const cases = [
    [1e16, 1e16 + 2, 5, 'a step below the values’ precision'],
    [2 ** 53, 2 ** 53 + 2, 5, 'past the safe integers'],
    [-1e308, 1e308, 5, 'a span wider than a double'],
    [-Number.MAX_VALUE, Number.MAX_VALUE, 1, 'the whole range in one interval'],
    [Number.MAX_VALUE, Number.MAX_VALUE, 5, 'the largest double alone'],
    [0, Number.MIN_VALUE, 5, 'the smallest double'],
    [1e300, 1.0000000001e300, 8, 'a narrow range of huge values'],
    [-1e-310, 1e-310, 5, 'subnormal values'],
    [0, 1, 1e9, 'a billion intervals asked for'],
    [0, 1, Number.POSITIVE_INFINITY, 'infinitely many asked for']
  ];
  const scales = await scalesInWorker(cases.map(([low, high, count]) => [low, high, count]));
  cases.forEach(([low, high, , message], index) => assertSound(scales[index], low, high, message));
  assert.deepEqual(scales[2].ticks, [-1e308, -5e307, 0, 5e307, 1e308]);
  assert.equal(scales[8].ticks.length, 51, 'the interval count is capped');
  assert.equal(scales[9].ticks.length, 51);
});

test('ticks keep the digits their step has', () => {
  const scale = assertSound(niceScale(1e12, 1e12 + 1, 5), 1e12, 1e12 + 1, 'a fraction of a trillion');
  assert.deepEqual(scale.ticks, [1e12, 1e12 + 0.2, 1e12 + 0.4, 1e12 + 0.6, 1e12 + 0.8, 1e12 + 1]);
  const fine = assertSound(niceScale(123456789.123, 123456789.124, 5), 123456789.123, 123456789.124, 'thousandths');
  assert.deepEqual(fine.ticks.slice(0, 2), [123456789.123, 123456789.1232]);
});

test('a linear scale maps the domain onto a range that may run backwards', () => {
  const y = linearScale(0, 100, 200, 0);
  assert.equal(y(0), 200);
  assert.equal(y(100), 0);
  assert.equal(y(25), 150);
  assert.equal(linearScale(5, 5, 0, 10)(5), 0, 'an empty domain does not divide by zero');
  const wide = linearScale(-Number.MAX_VALUE, Number.MAX_VALUE, 100, 0);
  assert.deepEqual([wide(-Number.MAX_VALUE), wide(0), wide(Number.MAX_VALUE)], [100, 50, 0], 'a domain wider than a double');
});

test('bars of a category sit side by side in the middle of the band', () => {
  const [first, second] = barSlots(100, 100, 2);
  close(first.x, 112, 'first bar starts 10% plus half its slot margin in');
  close(first.width, 36, 'each bar is 90% of a 40-wide slot');
  close(second.x, 152, 'the second bar follows its slot');
  const [capped] = barSlots(0, 400, 1, 50);
  close(capped.width, 50, 'a bar is never wider than the cap');
  close(capped.x, 175, 'a capped bar stays centred');
  close(barSlots(0, 1.3, 1)[0].width, 1, 'a bar is at least one unit wide where its slot has room');
});

test('bars never leave their slot, however narrow the band', () => {
  for (const [band, count] of [[5, 12], [0.5, 3], [1.2, 2], [100, 2], [3, 1]]) {
    const slots = barSlots(10, band, count);
    const slot = (band * 0.8) / count;
    slots.forEach((bar, index) => {
      assert.ok(bar.width > 0 && bar.width <= slot + 1e-9, `${band}/${count}: bar ${index} is ${bar.width} wide in a ${slot} slot`);
      assert.ok(bar.x >= 10 && bar.x + bar.width <= 10 + band + 1e-9, `${band}/${count}: bar ${index} stays in the band`);
      if (index > 0) {
        const previous = slots[index - 1];
        assert.ok(previous.x + previous.width <= bar.x + 1e-9, `${band}/${count}: bar ${index} does not cover bar ${index - 1}`);
      }
    });
  }
});

test('labels are thinned to every n-th category when they would overlap', () => {
  assert.equal(labelStep(40, 60, 12), 1);
  assert.equal(labelStep(40, 20, 12), 3);
  assert.equal(labelStep(40, 26, 12), 2);
  assert.equal(labelStep(40, 0), 1, 'no band, no thinning');
});

test('a line breaks where a value is missing', () => {
  assert.equal(linePath([[0, 10], [10, 20.004], null, [30, 5], [40, 6]]), 'M0 10L10 20M30 5L40 6');
  assert.equal(linePath([null, [1, 1], null]), 'M1 1', 'a lone point is a move only; the adapter draws its dot');
  assert.equal(linePath([]), '');
});

test('pie slices start at twelve o’clock and skip what is not a positive number', () => {
  const slices = arcSlices([1, 0, null, -3, 1, 2]);
  assert.deepEqual(slices.map((slice) => slice.index), [0, 4, 5]);
  close(slices[0].start, 0, 'first slice starts at the top');
  close(slices[0].end, Math.PI / 2, 'a quarter');
  close(slices[1].end, Math.PI, 'a second quarter');
  close(slices[2].end, Math.PI * 2, 'a half closes the circle');
  assert.deepEqual(arcSlices([0, null, Number.NaN]), [], 'nothing positive, no slices');
  assert.deepEqual(slices.map((slice) => slice.share), [0.25, 0.25, 0.5], 'each slice knows its share');
});

test('values whose sum a double cannot hold still divide the circle', () => {
  const [first, second] = arcSlices([1e308, 1e308]);
  close(first.end, Math.PI, 'half');
  close(second.end, Math.PI * 2, 'and half');
  assert.deepEqual([first.share, second.share], [0.5, 0.5]);
  const shares = arcSlices([Number.MAX_VALUE, Number.MAX_VALUE / 2, Number.MAX_VALUE / 2]).map((slice) => slice.share);
  assert.deepEqual(shares, [0.5, 0.25, 0.25]);
});

test('slices give up a pad angle only when there are neighbours, never more than half each', () => {
  const [single] = arcSlices([5], 0.1);
  close(single.end - single.start, Math.PI * 2, 'a single slice is a whole circle');
  const [big, tiny] = arcSlices([99, 1], 0.1);
  close(big.start, 0.05, 'half the pad at the start');
  close(big.end, (99 / 100) * Math.PI * 2 - 0.05, 'and half at the end');
  const sweep = (1 / 100) * Math.PI * 2;
  close(tiny.end - tiny.start, sweep - Math.min(0.1, sweep / 2), 'a thin slice keeps at least half its sweep');
});

test('rings divide the radius outermost first, the doughnut hole left empty', () => {
  assert.deepEqual(ringRadii(1, 100), [{ outer: 100, inner: 0 }]);
  assert.deepEqual(ringRadii(2, 100, 0.5, 2), [{ outer: 100, inner: 77 }, { outer: 75, inner: 50 }]);
  assert.deepEqual(ringRadii(2, 100, 0, 2), [{ outer: 100, inner: 52 }, { outer: 50, inner: 0 }]);
});

test('every dataset keeps a ring when the gap is wider than the rings are thick', () => {
  for (const [count, radius, hole, gap] of [[12, 50, 0.5, 3], [40, 60, 0, 4], [3, 10, 0.5, 20]]) {
    const rings = ringRadii(count, radius, hole, gap);
    assert.equal(rings.length, count);
    rings.forEach((ring, index) => {
      assert.ok(ring.outer - ring.inner > 0, `${count} rings: ring ${index} is ${ring.outer - ring.inner} thick`);
      if (index > 0) assert.ok(rings[index - 1].inner >= ring.outer, `${count} rings: ring ${index} does not overlap the one outside it`);
    });
  }
});

test('arc paths: a wedge, a ring band, a large arc, and a whole circle', () => {
  const [x, y] = polar(50, 50, 10, Math.PI / 2);
  close(x, 60, 'a quarter turn points right');
  close(y, 50, 'at the centre height');
  assert.equal(arcPath(50, 50, 10, 0, 0, Math.PI / 2), 'M50 40A10 10 0 0 1 60 50L50 50Z');
  assert.equal(arcPath(50, 50, 10, 5, 0, Math.PI / 2), 'M50 40A10 10 0 0 1 60 50L55 50A5 5 0 0 0 50 45Z');
  assert.match(arcPath(50, 50, 10, 0, 0, Math.PI * 1.5), /^M50 40A10 10 0 1 1 40 50/, 'more than half a turn is a large arc');
  assert.equal(arcPath(50, 50, 10, 0, 0, Math.PI * 2), 'M50 40A10 10 0 1 1 50 60A10 10 0 1 1 50 40Z');
  assert.equal(arcPath(50, 50, 10, 4, 0, Math.PI * 2),
    'M50 40A10 10 0 1 1 50 60A10 10 0 1 1 50 40ZM50 46A4 4 0 1 0 50 54A4 4 0 1 0 50 46Z',
    'the hole of a whole ring runs the other way round');
  assert.equal(arcPath(50, 50, 10, 0, 1, 1), '', 'no sweep, no path');
  assert.equal(arcPath(50, 50, 0, 0, 0, 1), '', 'no radius, no path');
});

test('tick labels keep exactly the digits that tell the ticks apart', () => {
  assert.equal(tickPrecision([0, 20, 40, 60, 80, 100], 20), 2);
  assert.equal(tickPrecision([0, 200, 400, 600, 800, 1000, 1200], 200), 2, '1.2K, not 1K');
  assert.equal(tickPrecision([0, 0.05, 0.1, 0.15, 0.2, 0.25], 0.05), 2, '0.15, not 0.2');
  assert.equal(tickPrecision([1000000, 1050000, 1100000], 50000), 3, '1.05M');
  assert.equal(tickPrecision([0], 1), 1);
  const format = new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: tickPrecision([0, 0.05, 0.1, 0.15], 0.05) });
  assert.deepEqual([0, 0.05, 0.1, 0.15].map((tick) => format.format(tick)), ['0', '0.05', '0.1', '0.15']);
});

test('SvgChartAdapter draws the four surface kinds and freezes its options', () => {
  assert.deepEqual(['bar', 'line', 'pie', 'doughnut', 'radar', 'scatter'].map((type) => SvgChartAdapter.supports(type)),
    [true, true, true, true, false, false]);
  const options = { animation: false };
  const adapter = new SvgChartAdapter(options);
  assert.deepEqual({ ...adapter.options }, { animation: false, legend: null });
  assert.ok(Object.isFrozen(adapter.options));
  assert.deepEqual(options, { animation: false }, 'the options passed in are not changed');
  assert.equal(typeof adapter.mount, 'function');
  assert.equal('create' in adapter, false, 'it mounts an element; it does not paint a canvas');
});
