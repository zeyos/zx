/**
 * Geometry for `SvgChartAdapter`: a value scale with round ticks, the bars of a category, how
 * often a category label fits, a line with gaps, and the slices and rings of a pie.
 *
 * Plain numbers in, plain numbers and SVG path strings out — no DOM — so the arithmetic is tested
 * on its own (`tests/unit/chart-svg.test.js`). Angles are radians clockwise from twelve o'clock,
 * the way a pie is read; coordinates are SVG user units, y growing downwards. Path coordinates are
 * rounded to two decimals, which is finer than any screen draws and keeps the markup short.
 * @module zx/components/chart/svg-geometry
 */

const TAU = Math.PI * 2;
/** Tolerance for a quotient that should be a whole number but is not, by float noise. */
const EPSILON = 1e-9;

/**
 * @typedef {Object} NiceScale
 * @property {number} min The lowest tick, at or below the lowest value.
 * @property {number} max The highest tick, at or above the highest value.
 * @property {number} step The distance between ticks: 1, 2 or 5 × 10ⁿ.
 * @property {number[]} ticks Every tick from `min` to `max`, free of float noise (0.3, not
 *   0.30000000000000004).
 */

/**
 * A linear scale over `[min, max]`, widened outwards to round ticks. A range of one value is
 * widened to zero (or to one when the value is zero), so a flat series still sits on an axis;
 * values that are not finite count as zero.
 * @param {number} min Lowest value.
 * @param {number} max Highest value.
 * @param {number} [count=5] About how many intervals the scale should have, at least 1.
 * @returns {NiceScale}
 */
export function niceScale(min, max, count = 5) {
  let low = Number.isFinite(min) ? min : 0;
  let high = Number.isFinite(max) ? max : 0;
  if (low > high) [low, high] = [high, low];
  if (low === high) {
    if (low > 0) low = 0;
    else if (low < 0) high = 0;
    else high = 1;
  }
  const step = niceStep((high - low) / Math.max(1, Math.round(count) || 1));
  const first = Math.floor(low / step + EPSILON);
  const last = Math.ceil(high / step - EPSILON);
  const ticks = [];
  for (let index = first; index <= last; index += 1) ticks.push(clean(index * step));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

/**
 * The round step nearest `raw`: 1, 2 or 5 × 10ⁿ, choosing at the geometric midpoints between
 * them, as most axis libraries do.
 * @param {number} raw Unrounded step, positive.
 * @returns {number}
 */
export function niceStep(raw) {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const factor = fraction >= Math.SQRT2 * 5 ? 10 : fraction >= Math.sqrt(10) ? 5 : fraction >= Math.SQRT2 ? 2 : 1;
  return clean(factor * power);
}

/**
 * Maps a value of `[min, max]` to a position of `[from, to]`; the range may run backwards, as a
 * vertical axis does.
 * @param {number} min Domain start.
 * @param {number} max Domain end.
 * @param {number} from Position of `min`.
 * @param {number} to Position of `max`.
 * @returns {(value: number) => number}
 */
export function linearScale(min, max, from, to) {
  const span = max - min || 1;
  return (value) => from + ((value - min) / span) * (to - from);
}

/**
 * @typedef {Object} BarSlot
 * @property {number} x Left edge.
 * @property {number} width Width, at least 1.
 */

/**
 * Where the bars of one category go: `count` series side by side across the middle 80% of the
 * band, each bar 90% of its slot and at most `maxWidth` wide, the group centred in the band.
 * @param {number} start Left edge of the band.
 * @param {number} band Width of the band.
 * @param {number} count Series in the group, at least 1.
 * @param {number} [maxWidth=Infinity] Widest a bar may be.
 * @returns {BarSlot[]}
 */
export function barSlots(start, band, count, maxWidth = Infinity) {
  const series = Math.max(1, Math.floor(count) || 1);
  const slot = Math.min((band * 0.8) / series, maxWidth / 0.9);
  const width = Math.max(1, slot * 0.9);
  const left = start + (band - slot * series) / 2;
  return Array.from({ length: series }, (_, index) => ({ x: left + index * slot + (slot - width) / 2, width }));
}

/**
 * Every how many categories a label is written so that none overlaps the next: 1 when the
 * widest label and a gap fit in one band, more as bands get narrow.
 * @param {number} widest Width of the widest label.
 * @param {number} band Width of one category.
 * @param {number} [gap=0] Least space between two labels.
 * @returns {number} A whole number, at least 1.
 */
export function labelStep(widest, band, gap = 0) {
  if (!(band > 0)) return 1;
  return Math.max(1, Math.ceil((Math.max(0, widest) + Math.max(0, gap)) / band - EPSILON));
}

/**
 * A polyline through the points, broken where a point is missing: each run of points starts a
 * new subpath, so a gap in the data is a gap in the line.
 * @param {Array<[number, number]|null>} points Positions in order; null where there is no value.
 * @returns {string} SVG path data; empty for no points.
 */
export function linePath(points) {
  let path = '';
  let open = false;
  for (const point of points) {
    if (!point) {
      open = false;
      continue;
    }
    path += `${open ? 'L' : 'M'}${num(point[0])} ${num(point[1])}`;
    open = true;
  }
  return path;
}

/**
 * @typedef {Object} ArcSlice
 * @property {number} index Position of the value in the list.
 * @property {number} value The value.
 * @property {number} start Start angle.
 * @property {number} end End angle.
 */

/**
 * The slices of a pie: one per positive value, in order clockwise from twelve o'clock, each
 * sweeping its share of the circle. Zero, negative and non-finite values have no slice. With two
 * slices or more, each gives up `padAngle` (half at either edge, never more than half its sweep)
 * so neighbours stand apart whatever lies behind the chart.
 * @param {unknown[]} values Values.
 * @param {number} [padAngle=0] Gap between slices.
 * @returns {ArcSlice[]} Empty when no value is positive.
 */
export function arcSlices(values, padAngle = 0) {
  const shown = values
    .map((value, index) => ({ index, value: typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0 }))
    .filter((entry) => entry.value > 0);
  const total = shown.reduce((sum, entry) => sum + entry.value, 0);
  if (!(total > 0)) return [];
  const pad = shown.length > 1 ? Math.max(0, padAngle) : 0;
  let angle = 0;
  return shown.map(({ index, value }) => {
    const sweep = (value / total) * TAU;
    const start = angle;
    angle += sweep;
    const inset = Math.min(pad, sweep / 2) / 2;
    return { index, value, start: start + inset, end: angle - inset };
  });
}

/**
 * @typedef {Object} Ring
 * @property {number} outer Outer radius.
 * @property {number} inner Inner radius; 0 for the centre of a pie.
 */

/**
 * The rings of a pie or doughnut with several datasets, outermost first: equal thickness between
 * `radius` and the hole, `gap` apart.
 * @param {number} count Rings, at least 1.
 * @param {number} radius Outer radius of the outermost ring.
 * @param {number} [hole=0] Radius of the hole as a fraction of `radius`: 0 for a pie.
 * @param {number} [gap=0] Space between neighbouring rings.
 * @returns {Ring[]}
 */
export function ringRadii(count, radius, hole = 0, gap = 0) {
  const rings = Math.max(1, Math.floor(count) || 1);
  const outermost = Math.max(0, radius);
  const innermost = outermost * Math.min(1, Math.max(0, hole));
  const thickness = (outermost - innermost) / rings;
  return Array.from({ length: rings }, (_, index) => {
    const outer = outermost - index * thickness;
    const inner = index === rings - 1 ? innermost : Math.min(outer, outer - thickness + Math.max(0, gap));
    return { outer, inner };
  });
}

/**
 * The outline of a slice: a wedge from the centre when `inner` is 0, a band of a ring otherwise.
 * A sweep of the whole circle is drawn as two half circles (an arc command cannot close on its
 * own start), the hole of a ring the other way round so the default fill rule leaves it empty.
 * @param {number} cx Centre x.
 * @param {number} cy Centre y.
 * @param {number} outer Outer radius.
 * @param {number} inner Inner radius.
 * @param {number} start Start angle.
 * @param {number} end End angle.
 * @returns {string} SVG path data; empty when there is nothing to draw.
 */
export function arcPath(cx, cy, outer, inner, start, end) {
  const sweep = end - start;
  if (!(sweep > 0) || !(outer > 0)) return '';
  const hole = Math.max(0, Math.min(inner, outer));
  if (sweep >= TAU - EPSILON) {
    const circle = (radius, clockwise) => {
      const r = num(radius);
      return `M${num(cx)} ${num(cy - radius)}A${r} ${r} 0 1 ${clockwise} ${num(cx)} ${num(cy + radius)}`
        + `A${r} ${r} 0 1 ${clockwise} ${num(cx)} ${num(cy - radius)}Z`;
    };
    return circle(outer, 1) + (hole > 0 ? circle(hole, 0) : '');
  }
  const large = sweep > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, outer, start);
  const [x1, y1] = polar(cx, cy, outer, end);
  let path = `M${num(x0)} ${num(y0)}A${num(outer)} ${num(outer)} 0 ${large} 1 ${num(x1)} ${num(y1)}`;
  if (hole > 0) {
    const [x2, y2] = polar(cx, cy, hole, end);
    const [x3, y3] = polar(cx, cy, hole, start);
    path += `L${num(x2)} ${num(y2)}A${num(hole)} ${num(hole)} 0 ${large} 0 ${num(x3)} ${num(y3)}`;
  } else {
    path += `L${num(cx)} ${num(cy)}`;
  }
  return `${path}Z`;
}

/**
 * The point at `radius` from the centre, `angle` clockwise from twelve o'clock.
 * @param {number} cx @param {number} cy @param {number} radius @param {number} angle
 * @returns {[number, number]}
 */
export function polar(cx, cy, radius, angle) {
  return [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];
}

/**
 * Significant digits a tick label needs so that no two ticks read alike: enough for the largest
 * tick's magnitude down to the step's, whatever unit a compact number format abbreviates to.
 * @param {number[]} ticks Ticks of a `niceScale()`.
 * @param {number} step Its step.
 * @returns {number} 1 to 21.
 */
export function tickPrecision(ticks, step) {
  const largest = ticks.reduce((most, tick) => Math.max(most, Math.abs(tick)), 0);
  if (!(largest > 0) || !(step > 0)) return 1;
  const digits = Math.floor(Math.log10(largest) + EPSILON) - Math.floor(Math.log10(step) + EPSILON) + 1;
  return Math.min(21, Math.max(1, digits));
}

/** @param {number} value @returns {number} The value without float noise. */
function clean(value) {
  return Number(value.toPrecision(12));
}

/** @param {number} value @returns {string} The value to two decimals, as short as it goes. */
function num(value) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded === 0 ? 0 : rounded);
}
