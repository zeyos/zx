/*
 * The theme model behind the Theme studio: the standard presets, and the colour maths that turns
 * one picked colour into a ramp the semantic tier can use.
 *
 * Zx maps accent roles onto a five-stop ramp (`--zx-accent-300` … `-700`) and lets each theme
 * pick its own stop: light surfaces take 600 and 700, dark ones take 300, 400, and 500. So a
 * theme is a ramp, not a colour — and a custom theme means deriving a well-formed ramp from
 * whatever the reader picked.
 *
 * The derivation works in OKLab, where lightness is perceptual: each stop is placed at a fixed
 * lightness and takes its hue and chroma from the picked colour, with the chroma pulled back
 * until the result fits in sRGB. Fixing the lightness is what makes the result safe rather than
 * merely pretty — at these targets the 600 stop clears 4.5:1 against white and the 400 stop
 * clears it against the dark page for every hue on the circle, which is exactly the promise
 * `--zx-color-on-accent-solid` makes on the primary button (600, white ink, both themes) and
 * `--zx-color-on-accent` makes on an accent fill.
 *
 * Every hex here is duplicated in `styles/tokens/themes.css`, which is what an application
 * actually loads; `tests/unit/theme-presets.test.js` fails if the two drift apart.
 */

/** The stops a preset defines, in the order the exported CSS lists them. */
export const STOPS = [300, 400, 500, 600, 700];

/**
 * Where each stop sits, and how much of the picked colour's chroma it carries.
 *
 * The lightness targets are the median of the six shipped ramps; the chroma factors follow the
 * shape those ramps have, most saturated around the middle where sRGB has the most room.
 */
const STOP_SHAPE = {
  300: { lightness: 0.845, chroma: 0.70 },
  400: { lightness: 0.745, chroma: 1.00 },
  500: { lightness: 0.630, chroma: 1.15 },
  600: { lightness: 0.545, chroma: 1.25 },
  700: { lightness: 0.465, chroma: 1.20 }
};

/**
 * @typedef {Object} ThemePreset
 * @property {string} id Value of the `data-zx-preset` attribute.
 * @property {string} label Display name.
 * @property {string} note One line on what the preset is for.
 * @property {Record<number, string>} ramp The five accent stops.
 * @property {Omit<ThemeState,'preset'|'theme'|'accent'>} recipe Complete studio recipe.
 */

/** The standard themes, in the order the studio cycles through them. */
export const PRESETS = [
  {
    id: 'zx',
    label: 'ZeyOS',
    note: 'The ZeyOS green with balanced type, geometry, spacing, and glass. The default.',
    ramp: { 300: '#5ee9b5', 400: '#21cc75', 500: '#009966', 600: '#007a55', 700: '#006045' },
    recipe: { spacing: 4, tint: 'zinc', radius: 4, controlHeight: 30, textSize: 14, font: 'inter', glass: 'subtle' }
  },
  {
    id: 'zeyos',
    label: 'Marque Gold',
    note: 'The gold of the ZeyOS product marque, anchored at 400.',
    ramp: { 300: '#ffd9a8', 400: '#f7bc60', 500: '#d0952f', 600: '#916510', 700: '#6f4e0b' },
    recipe: { spacing: 4.5, tint: 'warm', radius: 6, controlHeight: 32, textSize: 14, font: 'humanist', glass: 'strong' }
  },
  {
    id: 'ocean',
    label: 'Ocean',
    note: 'A utility blue, for tools that should read as infrastructure.',
    ramp: { 300: '#8ec5ff', 400: '#51a2ff', 500: '#2b7fff', 600: '#155dfc', 700: '#1447e6' },
    recipe: { spacing: 3.5, tint: 'cool', radius: 3, controlHeight: 28, textSize: 14, font: 'system', glass: 'subtle' }
  },
  {
    id: 'violet',
    label: 'Violet',
    note: 'The most saturated of the six — it carries a small accent a long way.',
    ramp: { 300: '#c4b4ff', 400: '#a684ff', 500: '#8e51ff', 600: '#7f22fe', 700: '#7008e7' },
    recipe: { spacing: 4.5, tint: 'accent', radius: 7, controlHeight: 34, textSize: 15, font: 'geometric', glass: 'strong' }
  },
  {
    id: 'rose',
    label: 'Rose',
    note: 'Warm and loud. Watch how it sits beside the danger colour.',
    ramp: { 300: '#ffa1ad', 400: '#ff637e', 500: '#ff2056', 600: '#dc0039', 700: '#a80030' },
    recipe: { spacing: 4.5, tint: 'warm', radius: 8, controlHeight: 32, textSize: 15, font: 'humanist', glass: 'strong' }
  },
  {
    id: 'slate',
    label: 'Slate',
    note: 'A near-neutral accent, for screens where the data carries the colour.',
    ramp: { 300: '#cad5e2', 400: '#90a1b9', 500: '#62748e', 600: '#45556c', 700: '#314158' },
    recipe: { spacing: 3.5, tint: 'zinc', radius: 2, controlHeight: 26, textSize: 13, font: 'mono', glass: 'none' }
  }
];

/** The neutral ramp's stops, and the lightness Zinc places each one at. */
const NEUTRAL_STOPS = {
  50: 0.9851, 100: 0.9674, 150: 0.9437, 200: 0.9197, 300: 0.8711, 400: 0.7057,
  500: 0.5520, 600: 0.4422, 700: 0.3707, 800: 0.2739, 900: 0.2103, 950: 0.1408
};

/**
 * Tints for the neutral ramp. `chroma` is the peak, reached in the middle of the ramp and faded
 * out towards both ends — which is how Zinc itself is built, and why a tinted ramp still reads as
 * grey rather than as a pale colour. A null hue follows the accent.
 *
 * The order runs from the two near-greys round the hue circle, so neighbours in the picker are
 * neighbours in colour. Every entry is a peak low enough that, even at twice its strength, the
 * text roles keep their contrast on every surface; `theme-presets.test.js` checks that.
 */
export const TINTS = [
  { id: 'neutral', label: 'Neutral', hue: 0, chroma: 0 },
  { id: 'zinc', label: 'Zinc', hue: 286, chroma: 0.017 },
  { id: 'stone', label: 'Stone', hue: 62, chroma: 0.014 },
  { id: 'cool', label: 'Cool', hue: 255, chroma: 0.038 },
  { id: 'mist', label: 'Mist', hue: 215, chroma: 0.030 },
  { id: 'sage', label: 'Sage', hue: 155, chroma: 0.028 },
  { id: 'olive', label: 'Olive', hue: 112, chroma: 0.030 },
  { id: 'warm', label: 'Warm', hue: 75, chroma: 0.030 },
  { id: 'taupe', label: 'Taupe', hue: 42, chroma: 0.024 },
  { id: 'mauve', label: 'Mauve', hue: 325, chroma: 0.030 },
  { id: 'accent', label: 'Accent', hue: null, chroma: 0.030 }
];

/**
 * Type stacks offered as `--zx-font-sans`. Each keeps a full fallback chain.
 *
 * Apart from Inter, which this site self-hosts, every stack names typefaces that ship with an
 * operating system or are commonly installed, so a choice costs no font request — and an
 * application that copies one gets the same behaviour. The first name a machine has wins, so a
 * stack is a style rather than a promise of one particular font.
 */
export const FONTS = [
  {
    id: 'inter',
    label: 'Inter',
    stack: 'Inter, "Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, '
      + '"Helvetica Neue", Arial, sans-serif'
  },
  {
    id: 'system',
    label: 'System',
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  {
    id: 'grotesque',
    label: 'Neo-grotesque',
    stack: '"Helvetica Neue", Helvetica, "Arial Nova", "Nimbus Sans", Arial, system-ui, sans-serif'
  },
  {
    id: 'geometric',
    label: 'Geometric',
    stack: '"Avenir Next", Avenir, "Century Gothic", "URW Gothic", ui-rounded, system-ui, sans-serif'
  },
  {
    id: 'humanist',
    label: 'Humanist',
    stack: 'Optima, Candara, "Gill Sans", "Gill Sans MT", "Trebuchet MS", system-ui, sans-serif'
  },
  {
    id: 'rounded',
    label: 'Rounded',
    stack: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, '
      + '"Arial Rounded MT", Calibri, system-ui, sans-serif'
  },
  {
    id: 'industrial',
    label: 'Industrial',
    stack: 'Bahnschrift, "DIN Alternate", "DIN Next", "Franklin Gothic Medium", "Nimbus Sans Narrow", '
      + 'system-ui, sans-serif'
  },
  {
    id: 'transitional',
    label: 'Transitional serif',
    stack: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, ui-serif, serif'
  },
  {
    id: 'serif',
    label: 'Old-style serif',
    stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, ui-serif, serif'
  },
  {
    id: 'slab',
    label: 'Slab serif',
    stack: 'Rockwell, "Rockwell Nova", "Roboto Slab", "DejaVu Serif", "Sitka Small", ui-serif, serif'
  },
  {
    id: 'mono',
    label: 'Mono',
    stack: '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
  }
];

/** The `font` value that means "use `fontStack`", a stack the reader typed. */
export const CUSTOM_FONT = 'custom';

/**
 * Type stacks offered as `--zx-font-mono`: code, keyboard hints, and figures that must align.
 * The first is the stock stack from `tokens/global.css`.
 */
export const MONO_FONTS = [
  {
    id: 'geist',
    label: 'Geist Mono',
    stack: '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace'
  },
  {
    id: 'editor',
    label: 'Editor',
    stack: '"Cascadia Code", "JetBrains Mono", "Fira Code", "Source Code Pro", Menlo, Consolas, '
      + '"DejaVu Sans Mono", monospace'
  },
  {
    id: 'terminal',
    label: 'Terminal',
    stack: 'Monaco, "Lucida Console", "Andale Mono", "DejaVu Sans Mono", ui-monospace, monospace'
  },
  {
    id: 'typewriter',
    label: 'Typewriter',
    stack: '"Courier Prime", "Nimbus Mono PS", "Courier New", Courier, monospace'
  }
];

/**
 * Surface materials. `subtle` is the stylesheet's own recipe; every other id is a complete set of
 * material-token overrides (`MATERIAL_RECIPES`). The recipes are written against the theme's glass
 * ingredients — rim, ring, lift, shade, edge, tint — so one recipe serves light and dark alike.
 */
export const MATERIALS = [
  { id: 'none', label: 'Flat', note: 'Opaque surfaces, no filters.' },
  { id: 'subtle', label: 'Glass', note: 'A thin lit pane: light on its edge, colour through it.' },
  { id: 'strong', label: 'Deep glass', note: 'A thick pane: double rim, inner glow, grain, more refraction.' },
  { id: 'frost', label: 'Frost', note: 'Milk glass: heavy diffusion, almost no reflection.' },
  { id: 'smoke', label: 'Smoke', note: 'Tinted glass that darkens what is behind it.' },
  { id: 'paper', label: 'Paper', note: 'Opaque and matte: layered soft shadows, a fine tooth, no blur.' },
  { id: 'satin', label: 'Satin', note: 'Brushed and opaque: a sheen on controls and chrome.' },
  { id: 'enamel', label: 'Enamel', note: 'Opaque and glazed: a solid body under a glossy coat.' }
];

/**
 * The range each geometry control offers, and the step it moves in. The studio's sliders and its
 * restore path both read these, so a stored value can never land somewhere a slider cannot show.
 * `spacing` is `--zx-space-unit` and `radius` is `--zx-radius`, both in pixels; `tintStrength` is
 * a percentage of the tint's own chroma.
 */
export const RANGES = {
  tintStrength: { min: 0, max: 200, step: 10 },
  spacing: { min: 3, max: 6, step: 0.5 },
  radius: { min: 0, max: 10, step: 0.5 },
  controlHeight: { min: 24, max: 44, step: 1 },
  textSize: { min: 12, max: 17, step: 1 }
};

/** The studio's starting point, and what Reset returns to. */
export const DEFAULTS = {
  preset: 'zx',
  theme: 'light',
  accent: null,
  tint: 'zinc',
  tintStrength: 100,
  spacing: 4,
  radius: 4,
  controlHeight: 30,
  textSize: 14,
  font: 'inter',
  fontStack: '',
  monoFont: 'geist',
  glass: 'subtle'
};

/* --------------------------------------------------------------------- colour -- */

/**
 * Converts a hex colour to OKLCH.
 * @param {string} hex `#rgb` or `#rrggbb`.
 * @returns {{l: number, c: number, h: number}} Lightness 0–1, chroma, hue in degrees.
 */
export function toOklch(hex) {
  const [red, green, blue] = parseHex(hex).map(toLinear);
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  const l = 0.2104542553 * long + 0.7936177850 * medium - 0.0040720468 * short;
  const a = 1.9779984951 * long - 2.4285922050 * medium + 0.4505937099 * short;
  const b = 0.0259040371 * long + 0.7827717662 * medium - 0.8086757660 * short;
  return { l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

/**
 * Converts OKLCH back to a hex colour, reducing chroma until the result fits in sRGB.
 *
 * Clamping the channels instead would shift the hue — a green pushed past the gamut clips its
 * blue channel to zero and comes back a different colour. Halving the chroma keeps hue and
 * lightness and gives up only the saturation that could not be shown anyway.
 * @param {{l: number, c: number, h: number}} colour
 * @returns {string} `#rrggbb`
 */
export function toHex({ l, c, h }) {
  let fitted = c;
  if (!inGamut(l, c, h)) {
    let low = 0;
    let high = c;
    for (let step = 0; step < 24; step += 1) {
      const middle = (low + high) / 2;
      if (inGamut(l, middle, h)) low = middle;
      else high = middle;
    }
    fitted = low;
  }
  return '#' + toRgb(l, fitted, h)
    .map((channel) => Math.round(clamp01(toGamma(clamp01(channel))) * 255).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derives a full accent ramp from one colour.
 *
 * Only the hue and chroma are taken from it: the stops keep their fixed lightness, because that
 * is what holds the contrast promise in both themes. A colour picked very dark or very pale
 * therefore comes back as a usable ramp in the same hue rather than as an unusable one.
 * @param {string} hex The picked colour.
 * @returns {Record<number, string>} The five stops.
 */
export function accentRamp(hex) {
  const { c, h } = toOklch(hex);
  // A colour with essentially no chroma is a deliberate grey accent; anything else gets enough
  // chroma to survive the gamut fit at the darker stops.
  const chroma = c < 0.012 ? c : Math.max(c, 0.035);
  const ramp = {};
  for (const stop of STOPS) {
    const shape = STOP_SHAPE[stop];
    ramp[stop] = toHex({ l: shape.lightness, c: chroma * shape.chroma, h });
  }
  return ramp;
}

/**
 * Builds a tinted neutral ramp at Zinc's lightness steps.
 * @param {{hue: number|null, chroma: number}} tint
 * @param {string} accent Accent colour, used when the tint follows the accent's hue.
 * @returns {Record<string, string>} Custom property name to hex, `--zx-gray-50` upwards.
 */
export function neutralRamp(tint, accent) {
  const hue = tint.hue ?? toOklch(accent).h;
  const ramp = {};
  for (const [stop, lightness] of Object.entries(NEUTRAL_STOPS)) {
    // The tint peaks in the middle of the ramp and fades to nothing at both ends, so the near-white
    // and near-black stops stay neutral and only the greys that carry area pick up the colour.
    const chroma = tint.chroma * (1 - Math.abs(2 * lightness - 1));
    ramp[`--zx-gray-${stop}`] = toHex({ l: lightness, c: chroma, h: hue });
  }
  return ramp;
}

/**
 * The neutral ramp a state produces for one tint, at the state's tint strength.
 * @param {ThemeState} state
 * @param {string} [id] Tint id; the state's own tint when omitted.
 * @returns {Record<string, string>} Custom property name to hex, `--zx-gray-50` upwards.
 */
export function tintRamp(state, id = state.tint) {
  const tint = tintById(id);
  const strength = (state.tintStrength ?? DEFAULTS.tintStrength) / 100;
  return neutralRamp({ hue: tint.hue, chroma: tint.chroma * strength },
    state.accent ?? presetById(state.preset).ramp[500]);
}

/**
 * Relative luminance contrast between two colours, as WCAG defines it.
 * @param {string} one
 * @param {string} two
 * @returns {number} Ratio between 1 and 21.
 */
export function contrast(one, two) {
  const luminance = (hex) => {
    const [red, green, blue] = parseHex(hex).map(toLinear);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [light, dark] = [luminance(one), luminance(two)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/* ----------------------------------------------------------------------- type -- */

/** Generic families, which CSS reads as keywords and which must therefore stay unquoted. */
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'math', 'emoji', 'fangsong',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', '-apple-system'
]);

/**
 * Turns a typed `font-family` list into one that is safe to write as a custom property.
 *
 * Every family is either a generic keyword, written bare, or a name, written in double quotes —
 * so the result is always valid CSS whatever quoting the reader used, and a stray quote can never
 * run on into the rest of the stylesheet. A name may hold letters, digits, spaces, dots, hyphens,
 * and underscores; anything else rejects the whole list rather than guessing at what was meant.
 * @param {unknown} text
 * @returns {string} The cleaned list, or an empty string when it is empty or not usable.
 */
export function cleanFontStack(text) {
  if (typeof text !== 'string' || text.length > 200) return '';
  const families = [];
  for (const part of text.split(',')) {
    const name = part.trim().replace(/^(["'])(.*)\1$/s, '$2').trim().replace(/\s+/g, ' ');
    if (name === '') continue;
    if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) return '';
    families.push(GENERIC_FAMILIES.has(name.toLowerCase()) ? name.toLowerCase() : `"${name}"`);
  }
  return families.join(', ');
}

/**
 * The interface stack a state asks for. A custom stack that is empty or unusable falls back to
 * the stock stack, so a half-typed entry never leaves the page without a typeface.
 * @param {ThemeState} state
 * @returns {string}
 */
export function fontStackOf(state) {
  if (state.font === CUSTOM_FONT) return cleanFontStack(state.fontStack) || fontById(DEFAULTS.font).stack;
  return fontById(state.font).stack;
}

/**
 * @param {string} id
 * @returns {{id: string, label: string, stack: string}} The stack, or the stock one.
 */
export function fontById(id) {
  return FONTS.find((font) => font.id === id) ?? FONTS[0];
}

/**
 * @param {string} id
 * @returns {{id: string, label: string, hue: number|null, chroma: number}} The tint, or Zinc.
 */
export function tintById(id) {
  return TINTS.find((tint) => tint.id === id) ?? TINTS.find((tint) => tint.id === DEFAULTS.tint);
}

/* ---------------------------------------------------------------------- state -- */

/**
 * @typedef {Object} ThemeState
 * @property {string} preset Preset id.
 * @property {'light'|'dark'|'auto'} theme
 * @property {string|null} accent Custom accent, or null to use the preset's ramp.
 * @property {string} tint Neutral tint id.
 * @property {number} tintStrength Tint chroma as a percentage of the tint's own.
 * @property {number} spacing Spacing unit in pixels — every `--zx-space-*` step is a multiple.
 * @property {number} radius Base corner radius in pixels — the radius steps scale from it.
 * @property {number} controlHeight Control height in pixels.
 * @property {number} textSize Base control text size in pixels.
 * @property {string} font Font stack id, or `CUSTOM_FONT` to use `fontStack`.
 * @property {string} fontStack A typed `font-family` list, used when `font` is `CUSTOM_FONT`.
 * @property {string} monoFont Monospace stack id.
 * @property {'none'|'subtle'|'strong'|'frost'|'smoke'|'paper'|'satin'|'enamel'} glass Surface material.
 */

/**
 * Resolves a state into the custom properties that express it.
 *
 * Only what differs from the stock theme is returned. That keeps the exported CSS to the lines
 * that matter, and it means a reader who changed nothing gets an empty override rather than a
 * verbose restatement of the defaults.
 * @param {ThemeState} state
 * @returns {Record<string, string>}
 */
export function themeVars(state) {
  const vars = {};

  if (state.accent) {
    const ramp = accentRamp(state.accent);
    for (const stop of STOPS) vars[`--zx-accent-${stop}`] = ramp[stop];
  }
  if (state.tint !== DEFAULTS.tint || (state.tintStrength ?? DEFAULTS.tintStrength) !== DEFAULTS.tintStrength) {
    Object.assign(vars, tintRamp(state));
  }
  if (state.spacing !== DEFAULTS.spacing) vars['--zx-space-unit'] = `${state.spacing}px`;
  if (state.radius !== DEFAULTS.radius) vars['--zx-radius'] = `${state.radius}px`;
  if (state.controlHeight !== DEFAULTS.controlHeight) {
    vars['--zx-control-height'] = `${state.controlHeight}px`;
  }
  if (state.textSize !== DEFAULTS.textSize) vars['--zx-text-md'] = `${state.textSize}px`;
  const sans = fontStackOf(state);
  if (sans !== fontById(DEFAULTS.font).stack) vars['--zx-font-sans'] = sans;
  const mono = MONO_FONTS.find((entry) => entry.id === state.monoFont) ?? MONO_FONTS[0];
  if (mono.id !== DEFAULTS.monoFont) vars['--zx-font-mono'] = mono.stack;
  Object.assign(vars, MATERIAL_RECIPES[state.glass] ?? {});
  return vars;
}

/* ------------------------------------------------------------------ materials -- */

/** The ingredient roles every recipe composes; the stylesheet restates them per theme. */
const RIM = 'var(--zx-color-glass-rim)';
const RING = 'var(--zx-color-glass-ring)';
const LIFT = 'var(--zx-color-glass-lift)';
const SHADE = 'var(--zx-color-glass-shade)';
const EDGE = 'var(--zx-color-glass-edge)';
const TINT = 'var(--zx-color-glass-tint)';
const INK = 'var(--zx-gray-950)';
const GRAIN = 'var(--zx-glass-grain)';

/** @param {string} colour @param {number} share @returns {string} */
const mix = (colour, share) => `color-mix(in srgb, ${colour} ${share}%, transparent)`;
/** The shade layer: the pane's body, a flat veil painted over the base colour and under the
 * other image layers — white in light, black in dark. */
const shade = `linear-gradient(${SHADE}, ${SHADE})`;
/** A faint accent caustic at the far corner of a pane. */
const caustic = (share, extent = '120% 70%') =>
  `radial-gradient(${extent} at 100% 100%, ${mix('var(--zx-color-accent)', share)}, transparent 62%)`;
/** A lift from the top edge: `top` of the lift colour, fading out by `fade`. */
const lift = (top, mid, fade) =>
  `linear-gradient(180deg, ${top === 100 ? LIFT : mix(LIFT, top)} 0%, ${mix(LIFT, mid)} ${Math.round(fade * 0.55)}%, transparent ${fade}%)`;
/** Flat fills for an opaque body. */
const solid = (colour) => `linear-gradient(${colour}, ${colour})`;

/** AppIcon with no glass at all. */
const ICON_FLAT = {
  '--zx-color-app-icon-depth': 'transparent',
  '--zx-app-icon-core-strength': '72%',
  '--zx-app-icon-rim-strength': '62%',
  '--zx-app-icon-bloom-strength': '0%',
  '--zx-app-icon-specular-strength': '0%',
  '--zx-app-icon-rim-base': 'var(--zx-color-border)',
  '--zx-app-icon-halo-size': '0px',
  '--zx-app-icon-halo-strength': '0%',
  '--zx-app-icon-shadow': 'none',
  '--zx-app-icon-shadow-hover': '0 0 0 transparent'
};

/** No backdrop filtering anywhere. */
const FILTERS_OFF = {
  '--zx-glass-blur': '0px',
  '--zx-glass-saturation': '100%',
  '--zx-glass-color-strength': '100%',
  '--zx-glass-filter-icon': 'none',
  '--zx-glass-filter-control': 'none',
  '--zx-glass-filter-raised': 'none',
  '--zx-glass-filter-chrome': 'none',
  '--zx-glass-filter-overlay': 'none',
  '--zx-glass-filter-panel': 'none'
};

/** The opaque overlay roles every solid material shares. */
const OPAQUE_OVERLAYS = {
  '--zx-color-overlay-surface': 'var(--zx-color-bg-raised)',
  '--zx-color-overlay-panel': 'var(--zx-color-bg-raised)',
  '--zx-color-overlay-backdrop': 'var(--zx-color-bg-backdrop)',
  '--zx-color-overlay-hover': 'var(--zx-color-bg-hover)',
  '--zx-color-overlay-selected': 'var(--zx-color-bg-selected)',
  '--zx-color-overlay-divider': 'var(--zx-color-border)',
  '--zx-color-overlay-scrim': 'var(--zx-color-bg-raised)',
  '--zx-overlay-specular-strength': '0%'
};

/**
 * Every material other than the stylesheet's own Glass, as the token overrides that express it.
 * A recipe names every shared material consumer — the ingredients, the surfaces, the overlay
 * tiers, the filters, the shadows, and AppIcon — so switching materials never leaves a role on
 * the previous one.
 * @type {Record<string, Record<string, string>>}
 */
export const MATERIAL_RECIPES = {
  /* Flat: the opaque semantic surfaces, exactly as the preference fallbacks paint them. A resting
     card keeps a resting shadow; only floating panes take the overlay's. */
  none: {
    ...FILTERS_OFF,
    ...ICON_FLAT,
    ...OPAQUE_OVERLAYS,
    '--zx-color-glass-border': 'var(--zx-color-border)',
    '--zx-color-glass-highlight': 'transparent',
    '--zx-color-glass-highlight-strong': 'transparent',
    '--zx-color-glass-rim': 'transparent',
    '--zx-color-glass-ring': 'transparent',
    '--zx-color-glass-lift': 'transparent',
    '--zx-color-glass-shade': 'transparent',
    '--zx-color-glass-edge': 'transparent',
    '--zx-color-glass-surface': 'var(--zx-color-bg-raised)',
    '--zx-color-glass-chrome': 'var(--zx-color-bg-surface)',
    '--zx-color-glass-control': 'var(--zx-color-bg-control)',
    '--zx-color-glass-control-hover': 'var(--zx-color-bg-hover)',
    '--zx-color-overlay-border': 'var(--zx-color-border)',
    '--zx-overlay-surface-image': 'none',
    '--zx-overlay-toast-image': 'none',
    '--zx-overlay-panel-image': 'none',
    '--zx-glass-control-shadow': 'none',
    '--zx-glass-chrome-shadow': 'none',
    '--zx-glass-raised-shadow': 'var(--zx-surface-shadow)',
    '--zx-glass-overlay-shadow': 'var(--zx-overlay-shadow)',
    '--zx-glass-panel-shadow': 'var(--zx-overlay-shadow)'
  },

  /* Glass is the stylesheet: nothing to override. */
  subtle: {},

  /*
   * Deep glass: a thick pane, drawn by what thickness does to light — not a luminous bevel. A
   * thinner base under a wider blur so more of the scene comes through; the cut edge shown by a
   * bright top line, a darker foot and a narrow inner glow; one faint diagonal band; a grain
   * under the reflection so the diffusion stops looking like a plastic sheet.
   */
  strong: {
    '--zx-glass-blur': '18px',
    '--zx-glass-saturation': '150%',
    '--zx-glass-color-strength': '68%',
    '--zx-color-glass-border': mix(RIM, 80),
    '--zx-color-glass-highlight': 'color-mix(in srgb, var(--zx-color-app-icon-glyph) 32%, transparent)',
    '--zx-color-glass-highlight-strong': 'color-mix(in srgb, var(--zx-color-app-icon-glyph) 54%, transparent)',
    '--zx-color-app-icon-depth': 'color-mix(in srgb, var(--zx-color-app-icon-shade) 34%, transparent)',
    '--zx-app-icon-core-strength': '46%',
    '--zx-app-icon-rim-strength': '72%',
    '--zx-app-icon-bloom-strength': '80%',
    '--zx-app-icon-specular-strength': '84%',
    '--zx-app-icon-rim-base': 'var(--zx-color-glass-highlight-strong)',
    '--zx-app-icon-halo-size': '18px',
    '--zx-app-icon-halo-strength': '30%',
    '--zx-color-glass-surface': 'color-mix(in srgb, var(--zx-color-bg-raised) 42%, transparent)',
    '--zx-color-glass-chrome': 'color-mix(in srgb, var(--zx-color-bg-surface) 58%, transparent)',
    '--zx-color-glass-control': 'color-mix(in srgb, var(--zx-color-glass-lift) 60%, var(--zx-color-glass-surface))',
    '--zx-color-glass-control-hover': 'color-mix(in srgb, var(--zx-color-bg-hover) 50%, var(--zx-color-glass-surface))',
    '--zx-color-overlay-surface': 'color-mix(in srgb, var(--zx-color-overlay-base) 44%, transparent)',
    '--zx-color-overlay-panel': 'color-mix(in srgb, var(--zx-color-overlay-base) 52%, transparent)',
    '--zx-color-overlay-backdrop': 'color-mix(in srgb, var(--zx-color-bg-backdrop) 36%, transparent)',
    '--zx-color-overlay-border': 'color-mix(in srgb, var(--zx-color-text) 14%, transparent)',
    '--zx-color-overlay-hover': 'color-mix(in srgb, var(--zx-color-text) 10%, transparent)',
    '--zx-color-overlay-selected': 'color-mix(in srgb, var(--zx-color-accent) 22%, transparent)',
    '--zx-color-overlay-divider': 'color-mix(in srgb, var(--zx-color-text) 13%, transparent)',
    '--zx-color-overlay-scrim': 'color-mix(in srgb, var(--zx-color-overlay-base) 24%, transparent)',
    '--zx-overlay-specular-strength': '0%',
    '--zx-overlay-surface-image': `linear-gradient(112deg, transparent 43%, ${mix(RIM, 10)} 47%, ${mix(RIM, 2)} 50%, transparent 54%), ${lift(100, 20, 45)}, ${GRAIN}, ${caustic(5, '120% 80%')}, ${shade}`,
    '--zx-overlay-panel-image': `linear-gradient(112deg, transparent 45%, ${mix(RIM, 9)} 48%, ${mix(RIM, 2)} 51%, transparent 54%), ${lift(100, 20, 40)}, ${GRAIN}, ${caustic(5, '90% 70%')}, ${shade}`,
    '--zx-overlay-toast-image': `${lift(100, 20, 45)}, ${GRAIN}, ${caustic(5, '120% 80%')}, ${shade}`,
    '--zx-glass-filter-icon': 'blur(10px) saturate(150%)',
    '--zx-glass-filter-control': 'blur(14px) saturate(145%)',
    '--zx-glass-filter-raised': 'blur(22px) saturate(150%)',
    '--zx-glass-filter-chrome': 'blur(24px) saturate(145%)',
    '--zx-glass-filter-overlay': 'blur(32px) saturate(150%)',
    '--zx-glass-filter-panel': 'blur(36px) saturate(140%)',
    '--zx-app-icon-shadow': 'inset 0 1px 0 color-mix(in srgb, var(--zx-color-app-icon-glyph) 20%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--zx-color-app-icon-shade) 34%, transparent), 0 3px 9px color-mix(in srgb, var(--zx-color-app-icon-shade) 30%, transparent)',
    '--zx-app-icon-shadow-hover': 'inset 0 1px 0 color-mix(in srgb, var(--zx-color-app-icon-glyph) 26%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--zx-color-app-icon-shade) 38%, transparent), 0 5px 13px color-mix(in srgb, var(--zx-color-app-icon-shade) 36%, transparent)',
    '--zx-glass-control-shadow': `inset 0 1px 0 ${RIM}, inset 0 -1px 0 ${mix(INK, 8)}, 0 1px 2px ${mix(INK, 8)}`,
    '--zx-glass-chrome-shadow': `inset -1px 0 0 ${mix(RIM, 70)}, inset 0 1px 0 ${RIM}`,
    '--zx-glass-raised-shadow': `inset 0 1px 0 ${RIM}, inset 0 -2px 0 ${mix(EDGE, 60)}, inset 0 0 8px ${mix(RIM, 18)}, 0 0 0 1px ${EDGE}, 0 2px 4px ${mix(INK, 5)}, 0 12px 32px -12px ${mix(INK, 16)}`,
    '--zx-glass-overlay-shadow': `inset 0 1px 0 ${RIM}, inset 0 -2px 0 ${mix(EDGE, 60)}, inset 0 0 8px ${mix(RIM, 18)}, 0 0 0 1px ${EDGE}, var(--zx-overlay-shadow)`,
    '--zx-glass-panel-shadow': `inset 0 1px 0 ${RIM}, inset 0 -2px 0 ${mix(EDGE, 60)}, inset 0 0 8px ${mix(RIM, 18)}, 0 0 0 1px ${EDGE}, var(--zx-overlay-shadow)`
  },

  /*
   * Frost: milk glass. Heavy diffusion and no coherent reflection — the scene becomes a soft
   * wash, the boundary is subdued, text on the pane reads as on paper. Depth without sparkle.
   */
  frost: {
    '--zx-glass-blur': '24px',
    '--zx-glass-saturation': '115%',
    '--zx-glass-color-strength': '80%',
    '--zx-color-glass-border': 'color-mix(in srgb, var(--zx-color-text) 8%, transparent)',
    '--zx-app-icon-bloom-strength': '30%',
    '--zx-app-icon-specular-strength': '30%',
    '--zx-color-glass-surface': 'color-mix(in srgb, var(--zx-color-bg-raised) 70%, transparent)',
    '--zx-color-glass-chrome': 'color-mix(in srgb, var(--zx-color-bg-surface) 80%, transparent)',
    '--zx-color-glass-control': 'color-mix(in srgb, var(--zx-color-glass-lift) 50%, var(--zx-color-glass-surface))',
    '--zx-color-glass-control-hover': 'color-mix(in srgb, var(--zx-color-bg-hover) 60%, var(--zx-color-glass-surface))',
    '--zx-color-overlay-surface': 'color-mix(in srgb, var(--zx-color-overlay-base) 72%, transparent)',
    '--zx-color-overlay-panel': 'color-mix(in srgb, var(--zx-color-overlay-base) 78%, transparent)',
    '--zx-color-overlay-backdrop': 'color-mix(in srgb, var(--zx-color-bg-backdrop) 50%, transparent)',
    '--zx-color-overlay-border': 'color-mix(in srgb, var(--zx-color-text) 9%, transparent)',
    '--zx-overlay-specular-strength': '0%',
    '--zx-overlay-surface-image': `${GRAIN}, ${shade}`,
    '--zx-overlay-panel-image': `${GRAIN}, ${shade}`,
    '--zx-overlay-toast-image': `${GRAIN}, ${shade}`,
    '--zx-glass-filter-icon': 'blur(8px) saturate(110%)',
    '--zx-glass-filter-control': 'blur(10px) saturate(110%)',
    '--zx-glass-filter-raised': 'blur(24px) saturate(115%)',
    '--zx-glass-filter-chrome': 'blur(28px) saturate(112%)',
    '--zx-glass-filter-overlay': 'blur(34px) saturate(120%)',
    '--zx-glass-filter-panel': 'blur(40px) saturate(115%)',
    '--zx-glass-control-shadow': `inset 0 1px 0 ${mix(RIM, 35)}, 0 1px 2px ${mix(INK, 5)}`,
    '--zx-glass-chrome-shadow': 'none',
    '--zx-glass-raised-shadow': `inset 0 1px 0 ${mix(RIM, 30)}, 0 0 0 1px ${mix(EDGE, 40)}, 0 1px 2px ${mix(INK, 4)}, 0 8px 24px -12px ${mix(INK, 12)}`,
    '--zx-glass-overlay-shadow': `inset 0 1px 0 ${mix(RIM, 30)}, 0 0 0 1px ${mix(EDGE, 40)}, var(--zx-overlay-shadow)`,
    '--zx-glass-panel-shadow': `inset 0 1px 0 ${mix(RIM, 30)}, 0 0 0 1px ${mix(EDGE, 40)}, var(--zx-overlay-shadow)`
  },

  /*
   * Smoke: tinted glass that absorbs rather than whitens. The body is the smoked tint mixed into
   * the overlay base, so the pane has a real backing in both themes (a translucent tint alone is
   * only 12–38% opaque); the scene comes through dimmed, with a faint cold rim and no lift.
   */
  smoke: {
    '--zx-glass-blur': '16px',
    '--zx-glass-saturation': '120%',
    '--zx-glass-color-strength': '70%',
    '--zx-color-glass-border': mix(RING, 90),
    '--zx-color-glass-surface': `color-mix(in srgb, ${TINT} 45%, var(--zx-color-bg-raised))`,
    '--zx-color-glass-chrome': `color-mix(in srgb, ${TINT} 35%, var(--zx-color-bg-surface))`,
    '--zx-color-glass-control': `color-mix(in srgb, ${TINT} 40%, var(--zx-color-bg-control))`,
    '--zx-color-glass-control-hover': 'color-mix(in srgb, var(--zx-color-text) 6%, var(--zx-color-glass-control))',
    '--zx-color-overlay-surface': `color-mix(in srgb, ${TINT} 50%, var(--zx-color-overlay-base))`,
    '--zx-color-overlay-panel': `color-mix(in srgb, ${TINT} 40%, var(--zx-color-overlay-base))`,
    '--zx-color-overlay-backdrop': 'color-mix(in srgb, var(--zx-color-bg-backdrop) 40%, transparent)',
    '--zx-color-overlay-border': 'color-mix(in srgb, var(--zx-color-text) 16%, transparent)',
    '--zx-color-overlay-hover': 'color-mix(in srgb, var(--zx-color-text) 10%, transparent)',
    '--zx-color-overlay-selected': 'color-mix(in srgb, var(--zx-color-accent) 22%, transparent)',
    '--zx-color-overlay-divider': 'color-mix(in srgb, var(--zx-color-text) 13%, transparent)',
    '--zx-overlay-specular-strength': '0%',
    '--zx-overlay-surface-image': shade,
    '--zx-overlay-panel-image': shade,
    '--zx-overlay-toast-image': shade,
    '--zx-glass-filter-icon': 'blur(8px) saturate(120%)',
    '--zx-glass-filter-control': 'blur(10px) saturate(120%)',
    '--zx-glass-filter-raised': 'blur(16px) saturate(120%)',
    '--zx-glass-filter-chrome': 'blur(18px) saturate(115%)',
    '--zx-glass-filter-overlay': 'blur(20px) saturate(120%)',
    '--zx-glass-filter-panel': 'blur(24px) saturate(115%)',
    '--zx-glass-control-shadow': `inset 0 1px 0 ${mix(RIM, 60)}, 0 1px 2px ${mix(INK, 10)}`,
    '--zx-glass-chrome-shadow': `inset -1px 0 0 ${mix(INK, 8)}`,
    '--zx-glass-raised-shadow': `inset 0 1px 0 ${mix(RIM, 60)}, 0 0 0 1px ${EDGE}, 0 1px 2px ${mix(INK, 8)}, 0 10px 28px -12px ${mix(INK, 20)}`,
    '--zx-glass-overlay-shadow': `inset 0 1px 0 ${mix(RIM, 60)}, inset 0 0 0 1px ${mix(RING, 60)}, 0 0 0 1px ${EDGE}, var(--zx-overlay-shadow)`,
    '--zx-glass-panel-shadow': `inset 0 1px 0 ${mix(RIM, 60)}, inset 0 0 0 1px ${mix(RING, 50)}, 0 0 0 1px ${EDGE}, var(--zx-overlay-shadow)`
  },

  /*
   * Paper: opaque, matte, layered. No blur anywhere, depth from a tight contact shadow and a
   * modest cast — stacked sheets, not a floating slab — and a fine tooth on the overlays.
   */
  paper: {
    ...FILTERS_OFF,
    ...ICON_FLAT,
    ...OPAQUE_OVERLAYS,
    '--zx-color-glass-border': 'color-mix(in srgb, var(--zx-color-text) 7%, transparent)',
    '--zx-color-glass-highlight': 'transparent',
    '--zx-color-glass-highlight-strong': 'transparent',
    '--zx-app-icon-rim-strength': '50%',
    '--zx-app-icon-shadow': `0 1px 2px ${mix(INK, 14)}`,
    '--zx-app-icon-shadow-hover': `0 2px 6px ${mix(INK, 18)}`,
    '--zx-color-glass-surface': 'var(--zx-color-bg-raised)',
    '--zx-color-glass-chrome': 'var(--zx-color-bg-surface)',
    '--zx-color-glass-control': 'var(--zx-color-bg-control)',
    '--zx-color-glass-control-hover': 'var(--zx-color-bg-hover)',
    '--zx-color-overlay-backdrop': 'color-mix(in srgb, var(--zx-color-bg-backdrop) 60%, transparent)',
    '--zx-color-overlay-border': 'color-mix(in srgb, var(--zx-color-text) 8%, transparent)',
    '--zx-overlay-surface-image': GRAIN,
    '--zx-overlay-panel-image': GRAIN,
    '--zx-overlay-toast-image': GRAIN,
    '--zx-glass-control-shadow': `0 1px 1px ${mix(INK, 6)}, 0 1px 3px ${mix(INK, 4)}`,
    '--zx-glass-chrome-shadow': 'none',
    '--zx-glass-raised-shadow': `0 0 0 1px ${EDGE}, 0 1px 2px ${mix(INK, 7)}, 0 6px 16px -8px ${mix(INK, 12)}`,
    '--zx-glass-overlay-shadow': `0 0 0 1px ${EDGE}, 0 1px 2px ${mix(INK, 9)}, 0 12px 28px -10px ${mix(INK, 16)}`,
    '--zx-glass-panel-shadow': `0 0 0 1px ${EDGE}, 0 2px 5px ${mix(INK, 8)}, 0 16px 32px -12px ${mix(INK, 18)}`
  },

  /*
   * Satin: brushed, opaque. No blur; a slightly toned substrate so the sheen has somewhere to
   * appear, a broad soft sheen across raised surfaces (the only finish a card can carry is its
   * shadow), a narrow directional highlight on overlays, a bright top rim and a darker foot on
   * controls — anodised metal, which makes controls read as pressable without transparency.
   */
  satin: {
    ...FILTERS_OFF,
    ...OPAQUE_OVERLAYS,
    '--zx-color-glass-border': 'color-mix(in srgb, var(--zx-color-text) 12%, transparent)',
    '--zx-app-icon-bloom-strength': '20%',
    '--zx-app-icon-specular-strength': '45%',
    '--zx-color-glass-surface': 'color-mix(in srgb, var(--zx-color-bg-raised) 70%, var(--zx-color-bg-chrome))',
    '--zx-color-glass-chrome': 'var(--zx-color-bg-surface)',
    '--zx-color-glass-control': `color-mix(in srgb, var(--zx-color-bg-control) 96%, ${INK})`,
    '--zx-color-glass-control-hover': 'var(--zx-color-bg-hover)',
    '--zx-color-overlay-backdrop': 'color-mix(in srgb, var(--zx-color-bg-backdrop) 64%, transparent)',
    '--zx-color-overlay-border': 'color-mix(in srgb, var(--zx-color-text) 14%, transparent)',
    '--zx-overlay-surface-image': `linear-gradient(105deg, transparent 32%, ${mix(RIM, 18)} 42%, transparent 54%), linear-gradient(180deg, transparent 80%, ${mix(INK, 3)})`,
    '--zx-overlay-panel-image': `linear-gradient(105deg, transparent 32%, ${mix(RIM, 18)} 42%, transparent 54%), linear-gradient(180deg, transparent 80%, ${mix(INK, 3)})`,
    '--zx-overlay-toast-image': `linear-gradient(105deg, transparent 32%, ${mix(RIM, 18)} 42%, transparent 54%)`,
    '--zx-glass-control-shadow': `inset 0 1px 0 ${RIM}, inset 0 -1px 0 ${mix(INK, 8)}, inset 0 -14px 14px -12px ${mix(INK, 14)}, inset 0 14px 14px -12px ${mix(RIM, 90)}, 0 1px 1px ${mix(INK, 10)}`,
    '--zx-glass-chrome-shadow': `inset -1px 0 0 ${mix(INK, 5)}, inset 1px 0 0 ${mix(RIM, 60)}`,
    '--zx-glass-raised-shadow': `inset 0 12px 20px -16px ${mix(RIM, 55)}, inset 0 -12px 20px -16px ${mix(INK, 8)}, 0 0 0 1px ${EDGE}, 0 1px 2px ${mix(INK, 8)}, var(--zx-surface-shadow)`,
    '--zx-glass-overlay-shadow': `inset 0 1px 0 ${RIM}, inset 0 -1px 0 ${mix(INK, 6)}, 0 0 0 1px ${EDGE}, 0 1px 2px ${mix(INK, 8)}, var(--zx-overlay-shadow)`,
    '--zx-glass-panel-shadow': `inset 0 1px 0 ${RIM}, inset 0 -1px 0 ${mix(INK, 6)}, 0 0 0 1px ${EDGE}, 0 2px 4px ${mix(INK, 8)}, var(--zx-overlay-shadow)`
  },

  /*
   * Enamel: an opaque pigmented body under a clear glossy coat. Strong, coherent surface
   * reflection — a narrow highlight along the top edge and a darker foot — with no transmission
   * at all: the surface's identity never depends on what is behind it. For touch terminals,
   * dispatch consoles and kiosks, where controls must read as pressable and text backing must be
   * certain.
   */
  enamel: {
    ...FILTERS_OFF,
    ...OPAQUE_OVERLAYS,
    '--zx-color-glass-border': 'color-mix(in srgb, var(--zx-color-text) 12%, transparent)',
    '--zx-color-app-icon-depth': 'color-mix(in srgb, var(--zx-color-app-icon-shade) 20%, transparent)',
    '--zx-app-icon-core-strength': '70%',
    '--zx-app-icon-rim-strength': '60%',
    '--zx-app-icon-bloom-strength': '0%',
    '--zx-app-icon-specular-strength': '70%',
    '--zx-app-icon-rim-base': 'var(--zx-color-glass-highlight-strong)',
    '--zx-app-icon-halo-size': '0px',
    '--zx-app-icon-halo-strength': '0%',
    '--zx-app-icon-shadow': `inset 0 1px 0 color-mix(in srgb, var(--zx-color-app-icon-glyph) 24%, transparent), 0 1px 2px ${mix(INK, 16)}`,
    '--zx-app-icon-shadow-hover': `inset 0 1px 0 color-mix(in srgb, var(--zx-color-app-icon-glyph) 30%, transparent), 0 2px 6px ${mix(INK, 20)}`,
    '--zx-color-glass-surface': 'color-mix(in srgb, var(--zx-color-accent) 3%, var(--zx-color-bg-raised))',
    '--zx-color-glass-chrome': 'var(--zx-color-bg-surface)',
    /* The body is opaque everywhere a glaze is promised: a dark theme's `bg-control` is a 5% wash. */
    '--zx-color-glass-control': 'color-mix(in srgb, var(--zx-color-accent) 2%, var(--zx-color-bg-raised))',
    '--zx-color-glass-control-hover': 'color-mix(in srgb, var(--zx-color-text) 5%, var(--zx-color-glass-control))',
    '--zx-color-overlay-surface': 'color-mix(in srgb, var(--zx-color-accent) 3%, var(--zx-color-bg-raised))',
    '--zx-color-overlay-panel': 'color-mix(in srgb, var(--zx-color-accent) 3%, var(--zx-color-bg-raised))',
    '--zx-color-overlay-backdrop': 'color-mix(in srgb, var(--zx-color-bg-backdrop) 64%, transparent)',
    '--zx-color-overlay-border': 'color-mix(in srgb, var(--zx-color-text) 12%, transparent)',
    '--zx-overlay-surface-image': `linear-gradient(180deg, ${RIM}, ${mix(RIM, 15)} 2px, transparent 5px), linear-gradient(180deg, transparent 72%, ${mix(INK, 5)})`,
    '--zx-overlay-panel-image': `linear-gradient(180deg, ${RIM}, ${mix(RIM, 15)} 2px, transparent 5px), linear-gradient(180deg, transparent 72%, ${mix(INK, 5)})`,
    '--zx-overlay-toast-image': `linear-gradient(180deg, ${RIM}, ${mix(RIM, 15)} 2px, transparent 5px)`,
    '--zx-glass-control-shadow': `inset 0 1px 0 ${RIM}, inset 0 -1px 0 ${mix(INK, 10)}, 0 1px 1px ${mix(INK, 8)}`,
    '--zx-glass-chrome-shadow': `inset -1px 0 0 ${mix(INK, 6)}`,
    /* A card carries no image, so its coat is a short reflective shoulder in the shadow. */
    '--zx-glass-raised-shadow': `inset 0 3px 2px -1px ${RIM}, inset 0 -2px 0 ${mix(INK, 7)}, 0 0 0 1px ${EDGE}, var(--zx-surface-shadow)`,
    '--zx-glass-overlay-shadow': `inset 0 1px 0 ${RIM}, inset 0 -2px 0 ${mix(INK, 8)}, 0 0 0 1px ${EDGE}, var(--zx-overlay-shadow)`,
    '--zx-glass-panel-shadow': `inset 0 1px 0 ${RIM}, inset 0 -2px 0 ${mix(INK, 8)}, 0 0 0 1px ${EDGE}, var(--zx-overlay-shadow)`
  }
};

/**
 * The accent the reader is actually looking at, which is the stop the current theme uses.
 * @param {ThemeState} state
 * @param {boolean} dark Whether the dark theme is showing.
 * @returns {string} `#rrggbb`
 */
export function resolvedAccent(state, dark) {
  const ramp = state.accent ? accentRamp(state.accent) : presetById(state.preset).ramp;
  return ramp[dark ? 400 : 600];
}

/**
 * @param {string} id
 * @returns {ThemePreset}
 */
export function presetById(id) {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}

/**
 * Renders a state as the stylesheet an application would paste in.
 * @param {ThemeState} state
 * @returns {string} CSS, or a comment explaining that nothing was changed.
 */
export function themeCss(state) {
  const vars = themeVars(state);
  const preset = presetById(state.preset);
  // A custom accent replaces the preset's ramp outright, so naming the preset here would credit a
  // theme none of these values came from.
  const origin = state.accent
    ? `a custom ${state.accent} accent`
    : `the ${preset.label} preset`;
  const lines = [
    '/*',
    ` * A Xenon theme, built from ${origin}.`,
    ' * Load it after zx.css. Wrap the block in [data-zx-preset="mytheme"] instead of :root to',
    ' * keep it switchable, and set the attribute on <html>.',
    ' */'
  ];

  if (Object.keys(vars).length === 0 && state.preset === DEFAULTS.preset) {
    return `${lines.join('\n')}\n\n/* Nothing overridden — this is the stock ZeyOS theme. */`;
  }

  lines.push('', ':root {');
  if (state.preset !== DEFAULTS.preset && !state.accent) {
    lines.push(`  /* ${preset.label} — the same five values as [data-zx-preset="${preset.id}"]. */`);
    for (const stop of STOPS) lines.push(`  --zx-accent-${stop}: ${preset.ramp[stop]};`);
  }
  for (const [name, value] of Object.entries(vars)) lines.push(`  ${name}: ${value};`);
  lines.push('}');

  if (state.theme !== DEFAULTS.theme) {
    lines.push('', `/* Appearance is an attribute, not a token: <html data-zx-theme="${state.theme}"> */`);
  }
  return lines.join('\n');
}

/* ----------------------------------------------------------------------- json -- */

/** The `format` every theme file declares. */
export const THEME_FORMAT = 'zx-theme';

/** The theme file version this studio writes; a later one is read leniently. */
export const THEME_VERSION = 1;

/**
 * The settings a theme file carries, in the order it lists them. Appearance is not among them:
 * light or dark is the reader's choice, and every theme has to work in both.
 */
export const SETTING_FIELDS = [
  'preset', 'accent', 'tint', 'tintStrength', 'font', 'fontStack', 'monoFont', 'textSize',
  'spacing', 'radius', 'controlHeight', 'glass'
];

/** What a setting is called in a warning. */
const SETTING_NAMES = {
  preset: 'preset', accent: 'accent', tint: 'tint', tintStrength: 'tint strength',
  font: 'typeface', fontStack: 'custom font stack', monoFont: 'code font', textSize: 'text size',
  spacing: 'spacing unit', radius: 'corner radius', controlHeight: 'control height', glass: 'material'
};

/** Envelope fields a flat theme file may carry beside its settings. */
const ENVELOPE_FIELDS = ['format', 'version', 'name', 'tokens', 'theme'];

/**
 * Every custom property the theme sets, preset ramp included — the complete list an application
 * would apply to `:root` without the `data-zx-preset` attribute.
 * @param {ThemeState} state
 * @returns {Record<string, string>}
 */
export function themeTokens(state) {
  const tokens = {};
  if (state.preset !== DEFAULTS.preset && !state.accent) {
    const { ramp } = presetById(state.preset);
    for (const stop of STOPS) tokens[`--zx-accent-${stop}`] = ramp[stop];
  }
  return Object.assign(tokens, themeVars(state));
}

/**
 * Serialises a state as a theme file.
 *
 * `settings` is what the studio reads back; `tokens` is the result, for tooling that wants the
 * custom properties without re-deriving them. Import ignores `tokens`, so a file can never carry
 * a value the controls could not have produced.
 * @param {ThemeState} state
 * @returns {string} Pretty-printed JSON with a trailing newline.
 */
export function themeJson(state) {
  // A custom typeface is written out as the stack it actually renders: cleaned, or — when there
  // is nothing usable in it — as the stock typeface the page fell back to.
  const custom = state.font === CUSTOM_FONT ? cleanFontStack(state.fontStack) : '';
  const settings = {};
  for (const field of SETTING_FIELDS) settings[field] = state[field] ?? DEFAULTS[field];
  if (custom) settings.fontStack = custom;
  else {
    delete settings.fontStack;
    if (state.font === CUSTOM_FONT) settings.font = DEFAULTS.font;
  }
  const file = { format: THEME_FORMAT, version: THEME_VERSION, settings, tokens: themeTokens(state) };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * @typedef {Object} ThemeFileResult
 * @property {Omit<ThemeState, 'theme'>} settings A complete set of settings: whatever the file
 *   leaves out is the stock value.
 * @property {string[]} warnings One sentence per value that was adjusted or skipped.
 */

/**
 * Reads a theme file.
 *
 * Strict about what it is reading and lenient about what is in it: something that is not a theme
 * file at all throws, but a theme file with one bad value still loads, with that value at its
 * default and a warning that says so. Both the envelope `{format, version, settings}` and a bare
 * settings object are accepted, so a hand-written file can be as short as `{"accent": "#e11d48"}`.
 * @param {string} text
 * @returns {ThemeFileResult}
 * @throws {Error} When the text is not JSON, not an object, of another format, or holds no settings.
 */
export function readThemeJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`This is not valid JSON: ${error.message}`);
  }
  if (!isRecord(data)) throw new Error('A theme file is a JSON object, not a list or a single value.');
  if ('format' in data && data.format !== THEME_FORMAT) {
    throw new Error(`This is not a Zx theme file: its format is ${JSON.stringify(data.format)}, `
      + `not "${THEME_FORMAT}".`);
  }

  const nested = isRecord(data.settings);
  const source = nested ? data.settings : data;
  if (!SETTING_FIELDS.some((field) => field in source)) {
    throw new Error('This file holds no theme settings. Export a theme to see the shape it expects.');
  }

  const warnings = [];
  if (Number.isFinite(data.version) && data.version > THEME_VERSION) {
    warnings.push(`The file was written by a newer theme studio (version ${data.version}); `
      + 'anything this one does not know was skipped.');
  }
  const { settings, warnings: adjusted } = normalizeSettings(source, DEFAULTS);
  const unknown = Object.keys(source).filter((key) => !SETTING_FIELDS.includes(key)
    && !(nested ? key === 'theme' : ENVELOPE_FIELDS.includes(key)));
  if (unknown.length) warnings.push(`Skipped unknown settings: ${unknown.join(', ')}.`);
  return { settings, warnings: [...warnings, ...adjusted] };
}

/**
 * Checks every setting against what its control can show, falling back to `base` for anything
 * missing or invalid. The studio's restore path and the theme file reader share it, so a value
 * from either can never reach the page in a form a control could not have produced.
 * @param {Record<string, unknown>} input
 * @param {ThemeState} [base] Values to keep for missing or invalid fields.
 * @returns {ThemeFileResult}
 */
export function normalizeSettings(input, base = DEFAULTS) {
  const source = isRecord(input) ? input : {};
  const settings = {};
  const warnings = [];
  const reject = (field, fallback) => {
    warnings.push(`The ${SETTING_NAMES[field]} ${JSON.stringify(source[field])} is not one this `
      + `studio offers; kept ${fallback}.`);
  };

  const choices = {
    preset: PRESETS, tint: TINTS, font: [...FONTS, { id: CUSTOM_FONT, label: 'Custom' }],
    monoFont: MONO_FONTS, glass: MATERIALS
  };
  for (const [field, options] of Object.entries(choices)) {
    settings[field] = base[field];
    if (!(field in source)) continue;
    const option = options.find((entry) => entry.id === source[field]);
    if (option) settings[field] = option.id;
    else reject(field, options.find((entry) => entry.id === base[field])?.label ?? base[field]);
  }

  settings.accent = base.accent;
  if ('accent' in source) {
    const accent = source.accent;
    if (accent === null || accent === '') settings.accent = null;
    else if (typeof accent === 'string' && /^#([\da-f]{3}|[\da-f]{6})$/i.test(accent.trim())) {
      const hex = accent.trim().slice(1).toLowerCase();
      settings.accent = `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex}`;
    } else {
      reject('accent', settings.accent ?? 'the preset accent');
    }
  }

  settings.fontStack = typeof base.fontStack === 'string' ? base.fontStack : '';
  if ('fontStack' in source) {
    const cleaned = cleanFontStack(source.fontStack);
    if (cleaned) settings.fontStack = cleaned;
    else if (source.fontStack !== '' && source.fontStack !== null) {
      warnings.push(`The custom font stack ${JSON.stringify(source.fontStack)} is not a usable `
        + 'font-family list; it was skipped.');
    }
  }
  if (settings.font === CUSTOM_FONT && !cleanFontStack(settings.fontStack)) {
    settings.font = base.font === CUSTOM_FONT ? DEFAULTS.font : base.font;
    warnings.push(`The custom typeface has no usable font stack; kept ${fontById(settings.font).label}.`);
  }

  for (const [field, { min, max, step }] of Object.entries(RANGES)) {
    settings[field] = base[field];
    if (!(field in source)) continue;
    const value = source[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      reject(field, String(base[field]));
      continue;
    }
    const snapped = Math.round(value / step) * step;
    settings[field] = Math.min(max, Math.max(min, snapped));
    if (snapped < min || snapped > max) {
      warnings.push(`The ${SETTING_NAMES[field]} ${value} is outside ${min}–${max}; `
        + `it was set to ${settings[field]}.`);
    }
  }
  return { settings, warnings };
}

/* -------------------------------------------------------------------- private -- */

/** @param {string} hex @returns {number[]} Three channels, 0–1, gamma-encoded. */
function parseHex(hex) {
  const value = hex.trim().replace(/^#/, '');
  const full = value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value;
  return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255);
}

/** @param {number} channel @returns {number} */
function toLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** @param {number} channel @returns {number} */
function toGamma(channel) {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {number} value @returns {number} */
function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** @param {number} l @param {number} c @param {number} h @returns {number[]} Linear sRGB. */
function toRgb(l, c, h) {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.7076147010 * short
  ];
}

/** @param {number} l @param {number} c @param {number} h @returns {boolean} */
function inGamut(l, c, h) {
  return toRgb(l, c, h).every((channel) => channel >= -0.0005 && channel <= 1.0005);
}
