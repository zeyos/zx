/**
 * Colours for chart engines.
 *
 * A browser reports a computed colour in the syntax it was authored in: a token mixed with
 * `color-mix()` reads back as `color(srgb 1 1 1 / 0.09)` or `oklab(…)`, a wide-gamut one as
 * `oklch(…)` or `color(display-p3 …)`. Chart engines usually bring their own colour parser, and
 * most of those stop at CSS Color 3. `legacyColor()` rewrites a computed colour as `#rrggbb`, or as
 * `rgba(r, g, b, a)` when it is translucent — the two forms every parser reads.
 *
 * The conversion is arithmetic and needs no DOM. Its limits: it reads the syntaxes a computed
 * value can take (hex, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, and
 * `color()` in srgb, srgb-linear, display-p3, xyz, xyz-d65 and xyz-d50) — no colour names except
 * `transparent`, no `color-mix()`, `light-dark()` or `var()`, which only an element can resolve;
 * and a colour outside the sRGB gamut is clipped per channel rather than gamut-mapped.
 * `paintedColor()` covers what the parser does not, by painting the colour on a canvas.
 * @module zx/components/chart/color
 */

/** @typedef {{r: number, g: number, b: number, a: number}} RgbaColor Red, green, blue 0–255 and alpha 0–1, unrounded. */

const LINEAR_P3_TO_XYZ = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976]
];
const XYZ_TO_LINEAR_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786]
];
/** Bradford chromatic adaptation from the D50 white `lab()` uses to the D65 white of sRGB. */
const D50_TO_D65 = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753]
];
const D50_WHITE = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

/**
 * Parses a computed CSS colour into sRGB channels.
 * @param {unknown} value Colour text.
 * @returns {RgbaColor|null} Null when the text is not one of the supported syntaxes.
 */
export function parseCssColor(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (text.startsWith('#')) return parseHex(text.slice(1));

  const call = /^([a-z][a-z0-9-]*)\(\s*(.*?)\s*\)$/s.exec(text);
  if (!call) return null;
  const [, name, body] = call;
  const [channelText, alphaText, ...extra] = body.split('/');
  if (extra.length) return null;
  const parts = channelText.split(/[\s,]+/).filter(Boolean);
  // The legacy comma syntax carries alpha as a fourth argument.
  let alphaPart = alphaText?.trim();
  if (alphaPart === undefined && name !== 'color' && parts.length === 4) alphaPart = parts.pop();
  const alpha = alphaPart === undefined ? 1 : clamp(number(alphaPart, 1), 0, 1);
  if (Number.isNaN(alpha)) return null;

  const rgb = channels(name, parts);
  if (!rgb || rgb.some(Number.isNaN)) return null;
  return { r: clamp(rgb[0], 0, 1) * 255, g: clamp(rgb[1], 0, 1) * 255, b: clamp(rgb[2], 0, 1) * 255, a: alpha };
}

/**
 * Rewrites a computed CSS colour in a syntax every colour parser reads.
 * @param {unknown} value Colour text, in any syntax `parseCssColor()` supports.
 * @returns {string|null} `#rrggbb` for an opaque colour, `rgba(r, g, b, a)` for a translucent one,
 *   null when the text could not be read.
 */
export function legacyColor(value) {
  const color = parseCssColor(value);
  return color ? formatLegacyColor(color) : null;
}

/**
 * The same colour at another opacity, for the fill under a line or inside a point.
 * @param {unknown} value Colour text.
 * @param {number} alpha Opacity from 0 to 1; it replaces the colour's own.
 * @returns {string|null} `rgba(r, g, b, a)` (or `#rrggbb` at full opacity), null for unreadable text.
 */
export function withAlpha(value, alpha) {
  const color = parseCssColor(value);
  return color ? formatLegacyColor({ ...color, a: clamp(Number(alpha), 0, 1) }) : null;
}

/**
 * Serialises channels in the legacy syntax.
 * @param {RgbaColor} color Channels.
 * @returns {string}
 */
export function formatLegacyColor({ r, g, b, a }) {
  const bytes = [r, g, b].map((channel) => clamp(Math.round(channel), 0, 255));
  const alpha = Math.round(clamp(a, 0, 1) * 1000) / 1000;
  if (alpha === 1) return `#${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${bytes.join(', ')}, ${alpha})`;
}

/**
 * Reads a colour by painting it: whatever the browser can paint comes back as 8-bit sRGB, so this
 * covers syntaxes `legacyColor()` does not parse. It needs a 2D canvas, and a faint colour loses
 * precision to the canvas's premultiplied 8-bit storage — which is why the parser goes first.
 * @param {unknown} value Colour text.
 * @param {Document|null} [ownerDocument] Document that creates the canvas.
 * @returns {string|null} A legacy colour string, or null when the colour is invalid or no canvas is
 *   available.
 */
export function paintedColor(value, ownerDocument = globalThis.document ?? null) {
  if (typeof value !== 'string' || !value.trim() || !ownerDocument) return null;
  try {
    const canvas = ownerDocument.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    // An invalid colour leaves the previous fill style in place; a second sentinel tells
    // "rejected" from "happens to equal the first one".
    const accepted = ['#010203', '#040506'].some((sentinel) => {
      context.fillStyle = sentinel;
      context.fillStyle = value;
      return context.fillStyle !== sentinel;
    });
    if (!accepted) return null;
    context.clearRect(0, 0, 1, 1);
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return formatLegacyColor({ r, g, b, a: a / 255 });
  } catch {
    return null;
  }
}

/**
 * A colour as an engine can read it: parsed where possible, painted otherwise.
 * @param {unknown} value Computed colour text.
 * @param {Document|null} [ownerDocument] Document for the canvas fallback.
 * @returns {string|undefined} Undefined when neither route could read it.
 */
export function engineColor(value, ownerDocument) {
  return legacyColor(value) ?? paintedColor(value, ownerDocument) ?? undefined;
}

/** @param {string} hex @returns {RgbaColor|null} */
function parseHex(hex) {
  if (!/^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.test(hex)) return null;
  const digits = hex.length <= 4 ? Array.from(hex, (digit) => digit + digit) : hex.match(/../g) ?? [];
  const [r, g, b, a = 255] = digits.map((pair) => Number.parseInt(pair, 16));
  return { r, g, b, a: a / 255 };
}

/**
 * @param {string} name Function name.
 * @param {string[]} parts Channel tokens.
 * @returns {number[]|null} Gamma-encoded sRGB channels, 0–1 but not yet clipped.
 */
function channels(name, parts) {
  if (name === 'color') {
    if (parts.length !== 4) return null;
    const [space, ...rest] = parts;
    const [x, y, z] = rest.map((part) => number(part, 1));
    if (space === 'srgb') return [x, y, z];
    if (space === 'srgb-linear') return [x, y, z].map(encode);
    if (space === 'display-p3') return fromXyz(multiply(LINEAR_P3_TO_XYZ, [x, y, z].map(decode)));
    if (space === 'xyz' || space === 'xyz-d65') return fromXyz([x, y, z]);
    if (space === 'xyz-d50') return fromXyz(multiply(D50_TO_D65, [x, y, z]));
    return null;
  }
  if (parts.length !== 3) return null;
  const [first, second, third] = parts;
  switch (name) {
    case 'rgb':
    case 'rgba':
      return parts.map((part) => number(part, 255) / 255);
    case 'hsl':
    case 'hsla':
      return hslToRgb(angle(first), number(second, 100) / 100, number(third, 100) / 100);
    case 'hwb':
      return hwbToRgb(angle(first), number(second, 100) / 100, number(third, 100) / 100);
    case 'oklab':
      return oklabToRgb(number(first, 1), number(second, 0.4), number(third, 0.4));
    case 'oklch':
      return oklabToRgb(number(first, 1), ...polar(number(second, 0.4), angle(third)));
    case 'lab':
      return labToRgb(number(first, 100), number(second, 125), number(third, 125));
    case 'lch':
      return labToRgb(number(first, 100), ...polar(number(second, 150), angle(third)));
    default:
      return null;
  }
}

/**
 * @param {string} token A number, a percentage, or `none`.
 * @param {number} whole What 100% stands for.
 * @returns {number} NaN for anything else.
 */
function number(token, whole) {
  if (token === 'none') return 0;
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)$/.exec(token);
  if (!match) return Number.NaN;
  return match[2] ? Number(match[1]) / 100 * whole : Number(match[1]);
}

/** @param {string} token A hue with an optional unit. @returns {number} Degrees, NaN when unreadable. */
function angle(token) {
  if (token === 'none') return 0;
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/.exec(token);
  if (!match) return Number.NaN;
  const factor = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 }[match[2] ?? 'deg'];
  return Number(match[1]) * factor;
}

/** @param {number} chroma @param {number} hue Degrees. @returns {[number, number]} */
function polar(chroma, hue) {
  const radians = hue * Math.PI / 180;
  return [chroma * Math.cos(radians), chroma * Math.sin(radians)];
}

/** @param {number} hue @param {number} saturation @param {number} lightness @returns {number[]} */
function hslToRgb(hue, saturation, lightness) {
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const h = ((hue % 360) + 360) % 360;
  const amount = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    return l - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

/** @param {number} hue @param {number} white @param {number} black @returns {number[]} */
function hwbToRgb(hue, white, black) {
  const w = clamp(white, 0, 1);
  const b = clamp(black, 0, 1);
  if (w + b >= 1) return Array(3).fill(w / (w + b));
  return hslToRgb(hue, 1, 0.5).map((channel) => channel * (1 - w - b) + w);
}

/** @param {number} lightness @param {number} a @param {number} b @returns {number[]} */
function oklabToRgb(lightness, a, b) {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ].map(encode);
}

/** @param {number} lightness @param {number} a @param {number} b @returns {number[]} */
function labToRgb(lightness, a, b) {
  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const fy = (lightness + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const xyz = [
    fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa,
    lightness > kappa * epsilon ? fy ** 3 : lightness / kappa,
    fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa
  ].map((component, index) => component * D50_WHITE[index]);
  return fromXyz(multiply(D50_TO_D65, xyz));
}

/** @param {number[]} xyz D65 XYZ. @returns {number[]} */
function fromXyz(xyz) {
  return multiply(XYZ_TO_LINEAR_SRGB, xyz).map(encode);
}

/** @param {number[][]} matrix @param {number[]} vector @returns {number[]} */
function multiply(matrix, vector) {
  return matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
}

/** Linear light to the sRGB transfer curve. @param {number} value @returns {number} */
function encode(value) {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  return absolute <= 0.0031308 ? value * 12.92 : sign * (1.055 * absolute ** (1 / 2.4) - 0.055);
}

/** The sRGB transfer curve to linear light. @param {number} value @returns {number} */
function decode(value) {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  return absolute <= 0.04045 ? value / 12.92 : sign * ((absolute + 0.055) / 1.055) ** 2.4;
}

/** @param {number} value @param {number} min @param {number} max @returns {number} NaN stays NaN. */
function clamp(value, min, max) {
  return Number.isNaN(value) ? value : Math.min(max, Math.max(min, value));
}
