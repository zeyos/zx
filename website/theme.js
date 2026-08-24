/*
 * The Zx theme studio.
 *
 * Two halves: a rail of controls, and a canvas showing the whole component library under whatever
 * those controls currently say. The canvas is the point — a theme is easy to judge one component
 * at a time and hard to judge as a set, which is the only way anyone actually sees it.
 *
 * Nothing here themes a preview in isolation. Every change goes through `window.zxTheme` in
 * site.js, which applies it to the document and stores it, so the studio's own chrome is themed by
 * the theme being edited, and the rest of the site keeps it when the reader navigates away. That
 * is a deliberate risk: a reader can make the documentation look strange. Reset is one click, and
 * the alternative — a preview that survives its own bad ideas — teaches nothing.
 *
 * Density is the only control that rebuilds the canvas. Colour and geometry are custom properties
 * and re-render themselves; density changes metrics some components read while they build.
 */

import {
  Dialog, Select, Slider, button, copyToClipboard, h, icon, rovingTabindex
} from '../src/index.js';
import {
  DEFAULTS, FONTS, PRESETS, STOPS, TINTS, accentRamp, contrast, presetById, resolvedAccent,
  themeCss, themeVars
} from './theme-presets.js';
import { CARDS, mountShowcase } from './theme-showcase.js';

/** Where the studio's own control positions live. The applied theme is site.js's business. */
const STORAGE_KEY = 'zx-theme-studio';

const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Auto' }
];
const DENSITIES = [
  { id: 'cozy', label: 'Cozy' },
  { id: 'compact', label: 'Compact' }
];

const state = restore();

const app = document.querySelector('#theme-app');
const rail = h('aside', { class: 'studio-rail' });
const canvas = h('div', { class: 'studio-canvas' });
const main = h('main', { class: 'studio-main' },
  h('div', { class: 'studio-intro' },
    h('h1', { class: 'studio-intro__title' }, 'Theme studio'),
    h('p', { class: 'studio-intro__blurb' },
      'Every Xenon component family on one page. Pick one of the standard themes, or change a few '
      + 'properties to build your own — then copy the result as CSS. Whatever you choose applies '
      + 'to the whole site until you reset it.')),
  // A short index, so the rail is not the only way to reach a family far down a very long page.
  h('nav', { class: 'studio-index', 'aria-label': 'Components on this page' },
    CARDS.map((card) => h('a', { class: 'studio-index__link', href: `#card-${card.id}` }, card.title))),
  canvas);

/** @type {(() => void)|null} Teardown for whatever the canvas last mounted. */
let disposeCanvas = null;
/** Controls that have to follow changes made outside their own widget. */
const sync = [];

// Every change — the rail's own controls and the header's theme toggle alike — reaches the
// controls through this one event, so there is a single path from "the theme moved" to "the rail
// says so". It is registered before the first apply() so that path is live from the first render.
document.addEventListener('zx-theme-change', () => {
  state.theme = window.zxTheme.get().theme;
  for (const update of sync) update();
});

app.replaceChildren(h('div', { class: 'studio' }, rail, main));
buildRail();
rebuildCanvas();
apply();

// `[` and `]` cycle the preset — the fastest way to see what a theme does to a whole screen is to
// flip between two of them without moving the pointer to the rail.
window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key !== '[' && event.key !== ']') return;
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    || (active instanceof HTMLElement && active.isContentEditable)) return;
  event.preventDefault();
  cyclePreset(event.key === ']' ? 1 : -1);
});

/* ----------------------------------------------------------------------- rail -- */

/** Builds the control rail. @returns {void} */
function buildRail() {
  const inner = h('div', { class: 'studio-rail__inner' },
    presetSection(),
    section('Appearance', segmented('Appearance', THEMES, () => state.theme, (value) => {
      state.theme = value;
      apply();
    })),
    section('Density', segmented('Density', DENSITIES, () => state.density, (value) => {
      state.density = value;
      apply({ rebuild: true });
    })),
    accentSection(),
    section('Neutral tint', choice(TINTS, () => state.tint, (value) => {
      state.tint = value;
      apply();
    }), 'The grey ramp every surface and border is mixed from.'),
    section('Typeface', choice(FONTS, () => state.font, (value) => {
      state.font = value;
      apply();
    })),
    section('Radius', slider({
      label: 'Corner radius', min: 0, max: 1.2, step: 0.05, unit: 'rem',
      get: () => state.radius,
      set: (value) => { state.radius = value; }
    })),
    section('Control height', slider({
      label: 'Control height', min: 24, max: 44, step: 1, unit: 'px',
      get: () => state.controlHeight,
      set: (value) => { state.controlHeight = value; }
    })),
    section('Text size', slider({
      label: 'Base text size', min: 12, max: 17, step: 1, unit: 'px',
      get: () => state.textSize,
      set: (value) => { state.textSize = value; }
    })),
    h('p', { class: 'studio-rail__note' },
      'Presets ship as ', h('code', {}, 'data-zx-preset'),
      ' in ', h('code', {}, 'styles/tokens/themes.css'), '. Everything else is a custom property '
      + 'you can paste into your own stylesheet.'),
    // Last in the rail, and pinned to the bottom of it by the stylesheet.
    h('div', { class: 'studio-rail__actions' },
      button({ label: 'Reset', icon: 'reload', onclick: reset }),
      button({ label: 'Copy CSS', icon: 'code', kind: 'primary', onclick: showCss })));

  rail.replaceChildren(inner);
}

/**
 * The preset list: a vertical radiogroup, plus the two buttons that cycle it.
 * @returns {HTMLElement}
 */
function presetSection() {
  const list = h('div', { class: 'studio-presets', role: 'radiogroup', 'aria-label': 'Theme preset' });
  const buttons = new Map();

  for (const preset of PRESETS) {
    const option = h('button', {
      type: 'button',
      class: 'studio-preset',
      role: 'radio',
      'data-preset': preset.id,
      onclick: () => selectPreset(preset.id)
    },
    h('span', { class: 'studio-preset__ramp' },
      [400, 500, 600].map((stop) =>
        h('span', { class: 'studio-preset__stop', style: { background: preset.ramp[stop] } }))),
    h('span', { class: 'studio-preset__text' },
      h('span', { class: 'studio-preset__name' }, preset.label),
      h('span', { class: 'studio-preset__note' }, preset.note)));
    buttons.set(preset.id, option);
    list.append(option);
  }
  rovingTabindex(list, '[role="radio"]');

  const update = () => {
    for (const [id, option] of buttons) {
      option.setAttribute('aria-checked', String(id === state.preset && !state.accent));
    }
  };
  sync.push(update);
  update();

  const header = h('div', { class: 'studio-section__head' },
    h('h2', { class: 'studio-section__title' }, 'Theme'),
    h('span', { class: 'studio-cycle' },
      button({ icon: 'chevron-left', size: 'sm', kind: 'ghost', title: 'Previous theme ([)', onclick: () => cyclePreset(-1) }),
      button({ icon: 'chevron-right', size: 'sm', kind: 'ghost', title: 'Next theme (])', onclick: () => cyclePreset(1) })));

  return h('section', { class: 'studio-section' }, header, list);
}

/**
 * The custom accent: a colour well, the ramp it derives, and what that ramp guarantees.
 * @returns {HTMLElement}
 */
function accentSection() {
  const well = h('input', { type: 'color', class: 'studio-color', 'aria-label': 'Accent colour' });
  const ramp = h('div', { class: 'studio-ramp' });
  const readout = h('p', { class: 'studio-readout' });
  const clear = button({
    label: 'Use the preset',
    size: 'sm',
    kind: 'ghost',
    onclick: () => {
      state.accent = null;
      apply();
    }
  });

  well.addEventListener('input', () => {
    state.accent = well.value;
    apply();
  });

  const update = () => {
    const dark = window.zxTheme.resolved() === 'dark';
    const stops = state.accent ? accentRamp(state.accent) : presetById(state.preset).ramp;
    const shown = resolvedAccent(state, dark);
    well.value = state.accent ?? shown;
    clear.hidden = !state.accent;

    ramp.replaceChildren(...STOPS.map((stop) => h('span', {
      class: 'studio-ramp__stop',
      style: { background: stops[stop] },
      title: `--zx-accent-${stop}: ${stops[stop]}`,
      'data-current': String(stop === (dark ? 400 : 600))
    })));

    // The ink on an accent-filled button is white on light surfaces and near-black on dark ones.
    // Reporting the ratio makes the guarantee checkable rather than merely claimed.
    const ink = dark ? '#09090b' : '#ffffff';
    const ratio = contrast(shown, ink);
    readout.replaceChildren(
      h('code', {}, dark ? '--zx-accent-400' : '--zx-accent-600'),
      ` ${shown} · ${ratio.toFixed(2)}:1 against the label on it (${ratio >= 4.5 ? 'AA' : 'below AA'})`);
  };
  sync.push(update);
  update();

  return section('Accent',
    h('div', { class: 'studio-stack' }, h('div', { class: 'studio-row' }, well, clear), ramp, readout),
    'Any colour becomes a five-stop ramp: the hue and chroma are yours, the lightness is fixed so '
    + 'both themes stay legible.');
}

/**
 * @param {string} title
 * @param {Node} control
 * @param {string} [hint]
 * @returns {HTMLElement}
 */
function section(title, control, hint) {
  return h('section', { class: 'studio-section' },
    h('div', { class: 'studio-section__head' }, h('h2', { class: 'studio-section__title' }, title)),
    control,
    hint ? h('p', { class: 'studio-section__hint' }, hint) : null);
}

/**
 * An APG radiogroup rendered as a segmented control.
 * @param {string} label Accessible group name.
 * @param {{id: string, label: string}[]} options
 * @param {() => string} get Current value.
 * @param {(value: string) => void} set
 * @returns {HTMLElement}
 */
function segmented(label, options, get, set) {
  const group = h('div', { class: 'studio-segmented', role: 'radiogroup', 'aria-label': label });
  const buttons = options.map((option) => {
    const node = h('button', {
      type: 'button',
      class: 'studio-segment',
      role: 'radio',
      onclick: () => set(option.id)
    }, option.label);
    group.append(node);
    return { id: option.id, node };
  });
  rovingTabindex(group, '[role="radio"]', { orientation: 'horizontal' });

  const update = () => {
    for (const { id, node } of buttons) node.setAttribute('aria-checked', String(id === get()));
  };
  sync.push(update);
  update();
  return group;
}

/**
 * A Select over a list of `{id, label}` records.
 * @param {{id: string, label: string}[]} options
 * @param {() => string} get
 * @param {(value: string) => void} set
 * @returns {Node}
 */
function choice(options, get, set) {
  const select = new Select(null, {
    items: options.map((option) => ({ ID: option.id, name: option.label })),
    value: get(),
    filter: false,
    onchange: (event) => set(String(event.detail.value))
  });
  sync.push(() => {
    if (select.value !== get()) select.set(get(), { silent: true });
  });
  return select.toElement();
}

/**
 * A Slider bound to one numeric field of the state.
 * @param {{label: string, min: number, max: number, step: number, unit: string,
 *   get: () => number, set: (value: number) => void}} spec
 * @returns {Node}
 */
function slider(spec) {
  const control = new Slider(null, {
    label: spec.label,
    hideLabel: true,
    min: spec.min,
    max: spec.max,
    step: spec.step,
    value: spec.get(),
    unit: spec.unit,
    showBounds: true,
    // Dragging repaints through custom properties only, so following `input` costs nothing and
    // makes the canvas move with the thumb.
    oninput: (event) => {
      spec.set(event.detail.value);
      apply();
    }
  });
  sync.push(() => {
    if (control.get() !== spec.get()) control.set(spec.get());
  });
  return control.toElement();
}

/* ---------------------------------------------------------------------- state -- */

/**
 * Pushes the state at the document, stores it, and refreshes the controls that display it.
 * @param {{rebuild?: boolean}} [options]
 * @returns {void}
 */
function apply({ rebuild = false } = {}) {
  window.zxTheme.set({
    theme: state.theme,
    preset: state.accent ? 'zx' : state.preset,
    density: state.density,
    vars: themeVars(state)
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The studio still works for this page when persistence is blocked.
  }
  if (rebuild) rebuildCanvas();
}

/** @param {number} step @returns {void} */
function cyclePreset(step) {
  const index = PRESETS.findIndex((preset) => preset.id === state.preset);
  selectPreset(PRESETS[(index + step + PRESETS.length) % PRESETS.length].id);
}

/** @param {string} id @returns {void} */
function selectPreset(id) {
  state.preset = id;
  // Picking a standard theme means picking its ramp, so a custom accent gets out of the way.
  state.accent = null;
  apply();
}

/** @returns {void} */
function reset() {
  Object.assign(state, DEFAULTS, { theme: state.theme });
  apply({ rebuild: true });
}

/** @returns {void} */
function rebuildCanvas() {
  disposeCanvas?.();
  disposeCanvas = mountShowcase(canvas);
}

/**
 * Restores the control positions, keeping only fields this version still understands.
 *
 * Storage outlives the code that wrote it: an entry left by an older studio can name a preset that
 * no longer ships or a slider that has since been removed, and a value copied straight into the
 * state would come back out as `--zx-radius: undefinedrem`. Every field is therefore checked
 * against what the control can actually show, and anything else falls back to the default.
 * @returns {object}
 */
function restore() {
  const applied = window.zxTheme.get();
  const state = {
    ...DEFAULTS,
    theme: applied.theme,
    preset: PRESETS.some((preset) => preset.id === applied.preset) ? applied.preset : DEFAULTS.preset,
    density: DENSITIES.some((density) => density.id === applied.density) ? applied.density : DEFAULTS.density
  };

  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    // A malformed entry is no worse than no entry.
  }
  if (!stored || typeof stored !== 'object') return state;

  if (PRESETS.some((preset) => preset.id === stored.preset)) state.preset = stored.preset;
  if (DENSITIES.some((density) => density.id === stored.density)) state.density = stored.density;
  if (TINTS.some((tint) => tint.id === stored.tint)) state.tint = stored.tint;
  if (FONTS.some((font) => font.id === stored.font)) state.font = stored.font;
  if (typeof stored.accent === 'string' && /^#[\da-f]{6}$/i.test(stored.accent)) {
    state.accent = stored.accent;
  }
  for (const [field, min, max] of [['radius', 0, 1.2], ['controlHeight', 24, 44], ['textSize', 12, 17]]) {
    if (Number.isFinite(stored[field])) state[field] = Math.min(max, Math.max(min, stored[field]));
  }
  return state;
}

/* ----------------------------------------------------------------------- code -- */

/** @type {Dialog|null} Built on first use and refilled on each open. */
let cssDialog = null;

/** Shows the current theme as the stylesheet an application would paste in. @returns {void} */
function showCss() {
  const css = themeCss(state);
  const copy = button({
    label: 'Copy',
    icon: 'copy',
    kind: 'primary',
    onclick: async () => {
      const done = await copyToClipboard(css);
      copy.replaceChildren(icon(done ? 'check' : 'error'),
        h('span', { class: 'zx-btn__label' }, done ? 'Copied' : 'Copy failed'));
    }
  });

  cssDialog ??= new Dialog(null, {
    title: 'Your theme, as CSS',
    size: 'lg',
    buttons: [{ label: 'Close', action: 'close' }]
  });
  cssDialog.setContent(h('div', { class: 'studio-stack' },
    h('p', { class: 'studio-prose' },
      'Load this after ', h('code', {}, 'zx.css'), '. Only what you changed is listed — the rest '
      + 'of the theme keeps the stock values.'),
    h('pre', { class: 'studio-code' }, h('code', {}, css)),
    h('div', { class: 'studio-row' }, copy)));
  cssDialog.open();
}
