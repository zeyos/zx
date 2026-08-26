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
 * `--zx-color-on-accent` makes on an accent-filled button.
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
    note: 'The ZeyOS green with balanced type, geometry, density, and glass. The default.',
    ramp: { 300: '#5ee9b5', 400: '#21cc75', 500: '#009966', 600: '#007a55', 700: '#006045' },
    recipe: { density: 'cozy', tint: 'zinc', radius: 0.45, controlHeight: 32, textSize: 14, font: 'inter', glass: 'subtle' }
  },
  {
    id: 'zeyos',
    label: 'Marque Gold',
    note: 'The gold of the ZeyOS product marque, anchored at 400.',
    ramp: { 300: '#ffd9a8', 400: '#f7bc60', 500: '#d0952f', 600: '#96690f', 700: '#6f4e0b' },
    recipe: { density: 'cozy', tint: 'warm', radius: 0.65, controlHeight: 34, textSize: 14, font: 'humanist', glass: 'strong' }
  },
  {
    id: 'ocean',
    label: 'Ocean',
    note: 'A utility blue, for tools that should read as infrastructure.',
    ramp: { 300: '#8ec5ff', 400: '#51a2ff', 500: '#2b7fff', 600: '#155dfc', 700: '#1447e6' },
    recipe: { density: 'compact', tint: 'cool', radius: 0.35, controlHeight: 30, textSize: 14, font: 'system', glass: 'subtle' }
  },
  {
    id: 'violet',
    label: 'Violet',
    note: 'The most saturated of the six — it carries a small accent a long way.',
    ramp: { 300: '#c4b4ff', 400: '#a684ff', 500: '#8e51ff', 600: '#7f22fe', 700: '#7008e7' },
    recipe: { density: 'cozy', tint: 'accent', radius: 0.8, controlHeight: 36, textSize: 15, font: 'geometric', glass: 'strong' }
  },
  {
    id: 'rose',
    label: 'Rose',
    note: 'Warm and loud. Watch how it sits beside the danger colour.',
    ramp: { 300: '#ffa1ad', 400: '#ff637e', 500: '#ff2056', 600: '#dc0039', 700: '#a80030' },
    recipe: { density: 'cozy', tint: 'warm', radius: 1, controlHeight: 34, textSize: 15, font: 'humanist', glass: 'strong' }
  },
  {
    id: 'slate',
    label: 'Slate',
    note: 'A near-neutral accent, for screens where the data carries the colour.',
    ramp: { 300: '#cad5e2', 400: '#90a1b9', 500: '#62748e', 600: '#45556c', 700: '#314158' },
    recipe: { density: 'compact', tint: 'zinc', radius: 0.2, controlHeight: 28, textSize: 13, font: 'mono', glass: 'none' }
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
 * grey rather than as a pale colour.
 */
export const TINTS = [
  { id: 'zinc', label: 'Zinc', hue: 286, chroma: 0.017 },
  { id: 'cool', label: 'Cool', hue: 255, chroma: 0.038 },
  { id: 'warm', label: 'Warm', hue: 75, chroma: 0.030 },
  { id: 'accent', label: 'Accent', hue: null, chroma: 0.030 }
];

/** Type stacks offered as `--zx-font-sans`. Each keeps a full fallback chain. */
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
    id: 'serif',
    label: 'Serif',
    stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, ui-serif, serif'
  },
  {
    id: 'mono',
    label: 'Mono',
    stack: '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
  }
];

/** The studio's starting point, and what Reset returns to. */
export const DEFAULTS = {
  preset: 'zx',
  theme: 'light',
  density: 'cozy',
  accent: null,
  tint: 'zinc',
  radius: 0.45,
  controlHeight: 32,
  textSize: 14,
  font: 'inter',
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

/* ---------------------------------------------------------------------- state -- */

/**
 * @typedef {Object} ThemeState
 * @property {string} preset Preset id.
 * @property {'light'|'dark'|'auto'} theme
 * @property {'cozy'|'compact'} density
 * @property {string|null} accent Custom accent, or null to use the preset's ramp.
 * @property {string} tint Neutral tint id.
 * @property {number} radius Corner radius in rem.
 * @property {number} controlHeight Control height in pixels.
 * @property {number} textSize Base control text size in pixels.
 * @property {string} font Font stack id.
 * @property {'none'|'subtle'|'strong'} glass Surface material strength.
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
  const preset = presetById(state.preset);

  if (state.accent) {
    const ramp = accentRamp(state.accent);
    for (const stop of STOPS) vars[`--zx-accent-${stop}`] = ramp[stop];
  }
  if (state.tint !== DEFAULTS.tint) {
    const tint = TINTS.find((entry) => entry.id === state.tint) ?? TINTS[0];
    Object.assign(vars, neutralRamp(tint, state.accent ?? preset.ramp[500]));
  }
  if (state.radius !== DEFAULTS.radius) vars['--zx-radius'] = `${state.radius}rem`;
  if (state.controlHeight !== DEFAULTS.controlHeight) {
    vars['--zx-control-height'] = `${state.controlHeight}px`;
  }
  if (state.textSize !== DEFAULTS.textSize) vars['--zx-text-md'] = `${state.textSize}px`;
  if (state.font !== DEFAULTS.font) {
    vars['--zx-font-sans'] = (FONTS.find((entry) => entry.id === state.font) ?? FONTS[0]).stack;
  }
  if (state.glass === 'none') {
    vars['--zx-glass-blur'] = '0px';
    vars['--zx-glass-saturation'] = '100%';
    vars['--zx-glass-color-strength'] = '100%';
    vars['--zx-color-glass-border'] = 'var(--zx-color-border)';
    vars['--zx-color-glass-highlight'] = 'transparent';
    vars['--zx-color-glass-highlight-strong'] = 'transparent';
    vars['--zx-color-app-icon-depth'] = 'transparent';
    vars['--zx-app-icon-core-strength'] = '72%';
    vars['--zx-app-icon-rim-strength'] = '62%';
    vars['--zx-app-icon-bloom-strength'] = '0%';
    vars['--zx-app-icon-specular-strength'] = '0%';
    vars['--zx-app-icon-rim-base'] = 'var(--zx-color-border)';
    vars['--zx-app-icon-halo-size'] = '0px';
    vars['--zx-app-icon-halo-strength'] = '0%';
    vars['--zx-color-glass-surface'] = 'var(--zx-color-bg-raised)';
    vars['--zx-color-glass-chrome'] = 'var(--zx-color-bg-surface)';
    vars['--zx-color-glass-control'] = 'var(--zx-color-bg-control)';
    vars['--zx-color-glass-control-hover'] = 'var(--zx-color-bg-hover)';
    vars['--zx-color-overlay-surface'] = 'var(--zx-color-bg-raised)';
    vars['--zx-color-overlay-panel'] = 'var(--zx-color-bg-raised)';
    vars['--zx-color-overlay-backdrop'] = 'var(--zx-color-bg-backdrop)';
    vars['--zx-color-overlay-border'] = 'var(--zx-color-border)';
    vars['--zx-color-overlay-hover'] = 'var(--zx-color-bg-hover)';
    vars['--zx-color-overlay-selected'] = 'var(--zx-color-bg-selected)';
    vars['--zx-color-overlay-divider'] = 'var(--zx-color-border)';
    vars['--zx-color-overlay-scrim'] = 'var(--zx-color-bg-raised)';
    vars['--zx-overlay-specular-strength'] = '0%';
    vars['--zx-overlay-surface-image'] = 'none';
    vars['--zx-overlay-toast-image'] = 'none';
    vars['--zx-overlay-panel-image'] = 'none';
    vars['--zx-glass-filter-icon'] = 'none';
    vars['--zx-glass-filter-control'] = 'none';
    vars['--zx-glass-filter-raised'] = 'none';
    vars['--zx-glass-filter-chrome'] = 'none';
    vars['--zx-glass-filter-overlay'] = 'none';
    vars['--zx-glass-filter-panel'] = 'none';
    vars['--zx-app-icon-shadow'] = 'none';
    vars['--zx-app-icon-shadow-hover'] = '0 0 0 transparent';
    vars['--zx-glass-control-shadow'] = 'none';
    vars['--zx-glass-chrome-shadow'] = 'none';
    vars['--zx-glass-raised-shadow'] = 'var(--zx-overlay-shadow)';
    vars['--zx-glass-overlay-shadow'] = 'var(--zx-overlay-shadow)';
    vars['--zx-glass-panel-shadow'] = 'var(--zx-overlay-shadow)';
  } else if (state.glass === 'strong') {
    vars['--zx-glass-blur'] = '18px';
    vars['--zx-glass-saturation'] = '165%';
    vars['--zx-glass-color-strength'] = '68%';
    vars['--zx-color-glass-border'] = 'color-mix(in srgb, var(--zx-color-app-icon-glyph) 34%, transparent)';
    vars['--zx-color-glass-highlight'] = 'color-mix(in srgb, var(--zx-color-app-icon-glyph) 32%, transparent)';
    vars['--zx-color-glass-highlight-strong'] = 'color-mix(in srgb, var(--zx-color-app-icon-glyph) 54%, transparent)';
    vars['--zx-color-app-icon-depth'] = 'color-mix(in srgb, var(--zx-color-app-icon-shade) 34%, transparent)';
    vars['--zx-app-icon-core-strength'] = '48%';
    vars['--zx-app-icon-rim-strength'] = '70%';
    vars['--zx-app-icon-bloom-strength'] = '78%';
    vars['--zx-app-icon-specular-strength'] = '82%';
    vars['--zx-app-icon-rim-base'] = 'var(--zx-color-glass-highlight-strong)';
    vars['--zx-app-icon-halo-size'] = '18px';
    vars['--zx-app-icon-halo-strength'] = '28%';
    vars['--zx-color-glass-surface'] = 'color-mix(in srgb, var(--zx-color-bg-raised) 62%, transparent)';
    vars['--zx-color-glass-chrome'] = 'color-mix(in srgb, var(--zx-color-bg-surface) 74%, transparent)';
    vars['--zx-color-glass-control'] = 'color-mix(in srgb, var(--zx-color-bg-control) 62%, transparent)';
    vars['--zx-color-glass-control-hover'] = 'color-mix(in srgb, var(--zx-color-bg-hover) 52%, var(--zx-color-glass-surface))';
    vars['--zx-color-overlay-surface'] = 'color-mix(in srgb, var(--zx-color-overlay-base) 62%, transparent)';
    vars['--zx-color-overlay-panel'] = 'color-mix(in srgb, var(--zx-color-overlay-base) 68%, transparent)';
    vars['--zx-color-overlay-backdrop'] = 'color-mix(in srgb, var(--zx-gray-950) 18%, transparent)';
    vars['--zx-color-overlay-border'] = 'color-mix(in srgb, var(--zx-color-text) 18%, transparent)';
    vars['--zx-color-overlay-hover'] = 'color-mix(in srgb, var(--zx-color-text) 10%, transparent)';
    vars['--zx-color-overlay-selected'] = 'color-mix(in srgb, var(--zx-color-accent) 22%, transparent)';
    vars['--zx-color-overlay-divider'] = 'color-mix(in srgb, var(--zx-color-text) 13%, transparent)';
    vars['--zx-color-overlay-scrim'] = 'color-mix(in srgb, var(--zx-color-overlay-base) 24%, transparent)';
    vars['--zx-overlay-specular-strength'] = '58%';
    vars['--zx-glass-filter-icon'] = 'blur(9px) saturate(148%)';
    vars['--zx-glass-filter-control'] = 'blur(12px) saturate(146%)';
    vars['--zx-glass-filter-raised'] = 'blur(15px) saturate(152%)';
    vars['--zx-glass-filter-chrome'] = 'blur(18px) saturate(158%)';
    vars['--zx-glass-filter-overlay'] = 'blur(22px) saturate(165%)';
    vars['--zx-glass-filter-panel'] = 'blur(20px) saturate(152%)';
    vars['--zx-app-icon-shadow'] = 'inset 0 1px 0 color-mix(in srgb, var(--zx-color-app-icon-glyph) 20%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--zx-color-app-icon-shade) 34%, transparent), 0 3px 9px color-mix(in srgb, var(--zx-color-app-icon-shade) 30%, transparent)';
    vars['--zx-app-icon-shadow-hover'] = 'inset 0 1px 0 color-mix(in srgb, var(--zx-color-app-icon-glyph) 26%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--zx-color-app-icon-shade) 38%, transparent), 0 5px 13px color-mix(in srgb, var(--zx-color-app-icon-shade) 36%, transparent)';
    vars['--zx-glass-control-shadow'] = 'inset 0 1px 0 var(--zx-color-glass-highlight), var(--zx-shadow-1)';
    vars['--zx-glass-chrome-shadow'] = 'inset 0 1px 0 var(--zx-color-glass-highlight-strong), var(--zx-shadow-2)';
    vars['--zx-glass-raised-shadow'] = 'inset 0 1px 0 var(--zx-color-glass-highlight-strong), var(--zx-overlay-shadow)';
    vars['--zx-glass-overlay-shadow'] = 'inset 0 1px 0 color-mix(in srgb, var(--zx-color-glass-highlight-strong) 44%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--zx-color-glass-highlight) 22%, transparent), var(--zx-overlay-shadow)';
    vars['--zx-glass-panel-shadow'] = 'inset 0 1px 0 color-mix(in srgb, var(--zx-color-glass-highlight-strong) 36%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--zx-color-glass-highlight) 16%, transparent), var(--zx-overlay-shadow)';
  }
  return vars;
}

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

  if (state.density !== DEFAULTS.density || state.theme !== DEFAULTS.theme) {
    const attributes = [
      state.theme !== DEFAULTS.theme ? `data-zx-theme="${state.theme}"` : '',
      state.density !== DEFAULTS.density ? `data-zx-density="${state.density}"` : ''
    ].filter(Boolean).join(' ');
    lines.push('', `/* Appearance and density are attributes, not tokens: <html ${attributes}> */`);
  }
  return lines.join('\n');
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
