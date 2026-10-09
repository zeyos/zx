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
 * Colour, spacing, and geometry are all custom properties, so the sliders repaint the canvas
 * without rebuilding it. Picking a preset or resetting rebuilds it anyway: those move every token
 * at once, and a fresh build is the honest picture of what an application would render.
 */

import {
  Dialog, Message, Select, Slider, button, copyToClipboard, downloadBlob, h, icon, rovingTabindex
} from '../src/index.js';
import {
  CUSTOM_FONT, DEFAULTS, FONTS, MATERIALS, MONO_FONTS, PRESETS, RANGES, STOPS, TINTS, accentRamp,
  cleanFontStack, contrast, fontById, normalizeSettings, presetById, readThemeJson, resolvedAccent,
  themeCss, themeJson, themeVars, tintById, tintRamp
} from './theme-presets.js';
import { CARDS, mountShowcase } from './theme-showcase.js';

/** Where the studio's own control positions live. The applied theme is site.js's business. */
const STORAGE_KEY = 'zx-theme-studio';

const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Auto' }
];
/** Motion is a viewer preference like Appearance, never part of an exported theme. */
const MOTIONS = [
  { id: 'system', label: 'System' },
  { id: 'reduced', label: 'Reduced' }
];

/** The largest theme file the importer reads; an exported one is a few kilobytes. */
const MAX_IMPORT_BYTES = 256 * 1024;

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
  state.motion = window.zxTheme.get().motion ?? 'system';
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
    section('Motion', segmented('Motion', MOTIONS, () => state.motion, (value) => {
      state.motion = value;
      apply();
    }), 'System follows your operating system. Reduced stops animation and transitions on every '
      + 'page of this site. Nothing here adds motion your system has turned off.'),
    section('Material', segmented('Material', MATERIALS, () => state.glass, (value) => {
      state.glass = value;
      apply();
    }), 'Aurora supplies ambient light; material controls how surfaces respond to it. Flat is opaque. Glass and Deep glass progressively increase translucency, blur, colour response, and specular light across AppIcons, controls, persistent chrome, raised cards, and every transient overlay. Menus, pickers, tooltips, column menus, and Toast use compact glass. Launcher, Modal, Dialog, and floating Sheet use a calmer reading panel. Docked Sheets and dense data surfaces stay opaque.'),
    accentSection(),
    tintSection(),
    typefaceSection(),
    section('Spacing', slider({
      label: 'Spacing unit', ...RANGES.spacing, unit: 'px',
      get: () => state.spacing,
      set: (value) => { state.spacing = value; }
    }), 'Every spacing step is a multiple of this unit, so padding, gaps, and indents move '
      + 'together. Tighten an application here rather than shrinking its type.'),
    section('Radius', slider({
      label: 'Corner radius', ...RANGES.radius, unit: 'px',
      get: () => state.radius,
      set: (value) => { state.radius = value; }
    }), 'The base radius. Menu items, controls, and panels take fixed fractions of it, so their '
      + 'corners stay in proportion at any setting.'),
    section('Control height', slider({
      label: 'Control height', ...RANGES.controlHeight, unit: 'px',
      get: () => state.controlHeight,
      set: (value) => { state.controlHeight = value; }
    })),
    section('Text size', slider({
      label: 'Base text size', ...RANGES.textSize, unit: 'px',
      get: () => state.textSize,
      set: (value) => { state.textSize = value; }
    })),
    h('p', { class: 'studio-rail__note' },
      'Preset accent ramps ship as ', h('code', {}, 'data-zx-preset'),
      ' in ', h('code', {}, 'styles/tokens/themes.css'), '. The studio also applies each preset’s '
      + 'complete type, geometry, spacing, tint, and material recipe; Copy CSS exports those '
      + 'choices for an application. Export saves the settings as a JSON theme file, and Import '
      + 'loads one back.'),
    // Last in the rail, and pinned to the bottom of it by the stylesheet.
    h('div', { class: 'studio-rail__actions' },
      button({ label: 'Import', icon: 'upload', title: 'Load a JSON theme file', onclick: showImport }),
      button({ label: 'Export', icon: 'file', title: 'Save the theme as a JSON file', onclick: showJson }),
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

    // The primary button is the 600 stop with white ink in both themes. On dark surfaces the
    // accent text and accent-filled marks take the 400 stop, with near-black ink on a fill.
    // Reporting the ratios makes the guarantee checkable rather than merely claimed.
    const grade = (ratio) => `${ratio.toFixed(2)}:1 (${ratio >= 4.5 ? 'AA' : 'below AA'})`;
    const solid = contrast(stops[600], '#ffffff');
    readout.replaceChildren(
      h('code', {}, '--zx-accent-600'),
      ` ${stops[600]} · ${grade(solid)} against the primary button's label`,
      ...(dark
        ? [h('br'), h('code', {}, '--zx-accent-400'),
          ` ${shown} · ${grade(contrast(shown, '#09090b'))} against the ink on an accent fill`]
        : []));
  };
  sync.push(update);
  update();

  return section('Accent',
    h('div', { class: 'studio-stack' }, h('div', { class: 'studio-row' }, well, clear), ramp, readout),
    'Any colour becomes a five-stop ramp: the hue and chroma are yours, the lightness is fixed so '
    + 'both themes stay legible.');
}

/**
 * The neutral tint: a radiogroup of swatches, each drawn from the ramp it would produce, and the
 * strength every tint is scaled by.
 *
 * Swatches rather than a list of names, because "Mist" and "Sage" mean nothing until they are
 * seen — and they are drawn at the current strength and accent, so the picker shows what picking
 * would do rather than what the tint looks like in the abstract.
 * @returns {HTMLElement}
 */
function tintSection() {
  const group = h('div', { class: 'studio-tints', role: 'radiogroup', 'aria-label': 'Neutral tint' });
  const options = TINTS.map((tint) => {
    const stops = [300, 500, 700].map(() => h('span', { class: 'studio-tint__stop' }));
    const node = h('button', {
      type: 'button',
      class: 'studio-tint',
      role: 'radio',
      'data-tint': tint.id,
      onclick: () => selectTint(tint.id)
    },
    h('span', { class: 'studio-tint__chip', 'aria-hidden': 'true' }, stops),
    h('span', { class: 'studio-tint__name' }, tint.label));
    group.append(node);
    return { tint, node, stops };
  });

  // The APG radio group: one tab stop on the checked swatch, and the arrow keys move the choice
  // through the list in reading order — left and up back, right and down on — so the grid can be
  // walked either way without the reader having to know where it wraps.
  group.addEventListener('keydown', (event) => {
    const moves = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
    const index = TINTS.findIndex((tint) => tint.id === state.tint);
    let next = null;
    if (event.key in moves) next = (index + moves[event.key] + TINTS.length) % TINTS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TINTS.length - 1;
    if (next === null) return;
    event.preventDefault();
    selectTint(TINTS[next].id);
    options[next].node.focus();
  });

  const strength = slider({
    label: 'Tint strength', ...RANGES.tintStrength, unit: '%',
    get: () => state.tintStrength,
    set: (value) => { state.tintStrength = value; },
    // A tint with no colour of its own has nothing to scale.
    disabled: () => tintById(state.tint).chroma === 0
  });

  const update = () => {
    for (const { tint, node, stops } of options) {
      const checked = tint.id === state.tint;
      node.setAttribute('aria-checked', String(checked));
      node.tabIndex = checked ? 0 : -1;
      const ramp = tintRamp(state, tint.id);
      [300, 500, 700].forEach((stop, index) => {
        stops[index].style.background = ramp[`--zx-gray-${stop}`];
      });
    }
  };
  sync.push(update);
  update();

  return section('Neutral tint',
    h('div', { class: 'studio-stack' }, group, field('Strength', strength)),
    'The grey ramp every surface and border is mixed from. The tint peaks in the mid greys and '
    + 'fades out at both ends, so the page stays white and the text stays near-black.');
}

/** @param {string} id @returns {void} */
function selectTint(id) {
  state.tint = id;
  apply();
}

/**
 * The two type stacks: the interface typeface, with a stack of the reader's own, and the code
 * font. Both lists draw each entry in its own stack, which shows at a glance which of them this
 * machine actually has.
 * @returns {HTMLElement}
 */
function typefaceSection() {
  const fonts = [...FONTS, { id: CUSTOM_FONT, label: 'Custom stack…', stack: null }];
  const sans = choice(fonts, () => state.font, (value) => {
    // Starting a custom stack from the one just in use is easier than starting from nothing.
    if (value === CUSTOM_FONT && !cleanFontStack(state.fontStack)) {
      state.fontStack = fontById(state.font).stack;
    }
    state.font = value;
    apply();
  }, { label: 'Interface typeface', preview: true });

  const hint = h('p', { class: 'studio-section__hint', id: 'studio-font-stack-hint' },
    'Font names, separated by commas. Fonts this machine does not have are skipped.');
  const custom = h('input', {
    type: 'text',
    class: 'studio-input',
    'aria-label': 'Custom font stack',
    'aria-describedby': 'studio-font-stack-hint',
    placeholder: '"Brand Sans", system-ui, sans-serif',
    spellcheck: 'false',
    autocomplete: 'off',
    oninput: () => {
      state.fontStack = custom.value;
      apply();
    }
  });
  const customRow = h('div', { class: 'studio-stack studio-stack--tight' }, custom, hint);

  const mono = choice(MONO_FONTS, () => state.monoFont, (value) => {
    state.monoFont = value;
    apply();
  }, { label: 'Code typeface', preview: true });

  sync.push(() => {
    customRow.hidden = state.font !== CUSTOM_FONT;
    // Never rewrite the field under the reader's caret: what they typed is the state, and the
    // cleaned form is only what gets applied.
    if (document.activeElement !== custom) custom.value = state.fontStack;
    const usable = Boolean(cleanFontStack(state.fontStack));
    custom.setAttribute('aria-invalid', String(!usable && state.fontStack.trim() !== ''));
    hint.textContent = usable || state.fontStack.trim() === ''
      ? 'Font names, separated by commas. Fonts this machine does not have are skipped.'
      : 'Not usable yet: font names may hold letters, digits, spaces, dots, and hyphens. '
        + 'The stock typeface is showing meanwhile.';
  });

  return section('Typeface',
    h('div', { class: 'studio-stack' }, field('Interface', sans), customRow, field('Code', mono)),
    'A custom stack is applied as typed, so it can name your brand font; the studio cannot load '
    + 'one, but a page that already does will pick it up.');
}

/**
 * A visible label above a control that names itself for assistive technology.
 * @param {string} label
 * @param {Node} control
 * @returns {HTMLElement}
 */
function field(label, control) {
  return h('div', { class: 'studio-field' },
    h('span', { class: 'studio-field__label', 'aria-hidden': 'true' }, label), control);
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
 * @param {{id: string, label: string, stack?: string|null}[]} options
 * @param {() => string} get
 * @param {(value: string) => void} set
 * @param {{label?: string, preview?: boolean}} [settings] `label` names the control;
 *   `preview` draws each option in its own `stack`.
 * @returns {Node}
 */
function choice(options, get, set, { label = '', preview = false } = {}) {
  const select = new Select(null, {
    items: options.map((option) => ({ ID: option.id, name: option.label, stack: option.stack ?? null })),
    value: get(),
    filter: false,
    label,
    renderItem: preview
      ? (item) => h('span', { style: { fontFamily: item.stack ?? 'inherit' } }, item.name)
      : null,
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
 *   get: () => number, set: (value: number) => void, disabled?: () => boolean}} spec
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
    if (spec.disabled) {
      if (spec.disabled()) control.disable();
      else control.enable();
    }
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
    motion: state.motion,
    preset: state.accent ? 'zx' : state.preset,
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
  const preset = presetById(id);
  // A preset is a complete theme: whatever its recipe does not name — the custom accent, the tint
  // strength, the code font — goes back to stock rather than leaking in from the last one.
  Object.assign(state, DEFAULTS,
    { theme: state.theme, motion: state.motion, fontStack: state.fontStack }, preset.recipe,
    { preset: preset.id });
  apply({ rebuild: true });
}

/** @returns {void} */
function reset() {
  Object.assign(state, DEFAULTS, { theme: state.theme, motion: state.motion });
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
 * state would come back out as `--zx-radius: undefinedpx`. Every field is therefore checked
 * against what the control can actually show — by the same check a theme file goes through — and
 * anything else falls back to the default.
 *
 * An entry from before the spacing setting has no `spacing` field. Its radius was in rem on the
 * old scale and its control height was measured against a 32px default, so both are carried over
 * to where they sit on the current scale rather than read as if they had always been pixels.
 * @returns {object}
 */
function restore() {
  const applied = window.zxTheme.get();
  const base = {
    ...DEFAULTS,
    theme: applied.theme,
    motion: applied.motion ?? 'system',
    preset: PRESETS.some((preset) => preset.id === applied.preset) ? applied.preset : DEFAULTS.preset
  };

  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    // A malformed entry is no worse than no entry.
  }
  if (!stored || typeof stored !== 'object') return base;

  const values = { ...stored };
  if (!('spacing' in stored)) {
    // 0.45rem was the old default and 4px is the new one; the old control default was 32px.
    if (Number.isFinite(stored.radius)) values.radius = (stored.radius / 0.45) * DEFAULTS.radius;
    if (Number.isFinite(stored.controlHeight)) values.controlHeight = stored.controlHeight - 2;
  }
  // A typed stack is kept as typed, half-finished or not; only what is applied gets cleaned.
  const fontStack = typeof stored.fontStack === 'string' ? stored.fontStack.slice(0, 200) : '';
  const { settings } = normalizeSettings(values, base);
  return { ...base, ...settings, fontStack };
}

/* ----------------------------------------------------------------------- code -- */

/** @type {Dialog|null} Shows exported CSS or JSON; built on first use and refilled on each open. */
let codeDialog = null;
/** @type {Dialog|null} Built on first use and refilled on each open. */
let importDialog = null;

/** Shows the current theme as the stylesheet an application would paste in. @returns {void} */
function showCss() {
  showCode({
    title: 'Your theme, as CSS',
    intro: ['Load this after ', h('code', {}, 'zx.css'), '. Only what you changed is listed — the '
      + 'rest of the theme keeps the stock values.'],
    code: themeCss(state)
  });
}

/** Shows the current theme as a theme file, to copy or to save. @returns {void} */
function showJson() {
  const json = themeJson(state);
  showCode({
    title: 'Your theme, as JSON',
    intro: ['A theme file: keep it, share it, or check it in, and bring it back with Import. ',
      h('code', {}, 'settings'), ' is what Import reads; ', h('code', {}, 'tokens'), ' are the '
      + 'custom properties those settings produce, for tools that want the values themselves.'],
    code: json,
    actions: [button({
      label: 'Download',
      icon: 'file',
      onclick: () => downloadBlob(themeFileName(), json, { type: 'application/json' })
    })]
  });
}

/**
 * Fills and opens the code dialog.
 * @param {{title: string, intro: (Node|string)[], code: string, actions?: Node[]}} spec
 * @returns {void}
 */
function showCode({ title, intro, code, actions = [] }) {
  const copy = button({
    label: 'Copy',
    icon: 'copy',
    kind: 'primary',
    onclick: async () => {
      const done = await copyToClipboard(code);
      copy.replaceChildren(icon(done ? 'check' : 'error'),
        h('span', { class: 'zx-btn__label' }, done ? 'Copied' : 'Copy failed'));
    }
  });

  codeDialog ??= new Dialog(null, {
    size: 'lg',
    buttons: [{ label: 'Close', action: 'close' }]
  });
  codeDialog.setTitle(title);
  codeDialog.setContent(h('div', { class: 'studio-stack' },
    h('p', { class: 'studio-prose' }, intro),
    h('pre', { class: 'studio-code' }, h('code', {}, code)),
    h('div', { class: 'studio-row' }, copy, actions)));
  codeDialog.open();
}

/** @returns {string} A file name that says which theme it holds. */
function themeFileName() {
  const origin = state.accent ? `custom-${state.accent.slice(1)}` : presetById(state.preset).id;
  return `zx-theme-${origin}.json`;
}

/**
 * Asks for a theme file — pasted, chosen, or dropped — and applies it.
 *
 * The file is checked before anything changes: a file that cannot be read leaves the theme as it
 * was and says why, in the dialog, next to the text that caused it. One that loads with values
 * adjusted says what was adjusted once it has been applied.
 * @returns {void}
 */
function showImport() {
  const text = h('textarea', {
    class: 'studio-import__text',
    rows: 12,
    spellcheck: 'false',
    autocomplete: 'off',
    'aria-label': 'Theme JSON',
    'aria-describedby': 'studio-import-error',
    placeholder: '{\n  "format": "zx-theme",\n  "version": 1,\n  "settings": { "accent": "#e11d48" }\n}'
  });
  const error = h('p', { class: 'studio-error', id: 'studio-import-error', role: 'alert', hidden: true });
  const fail = (message) => {
    error.textContent = message;
    error.hidden = false;
    text.setAttribute('aria-invalid', 'true');
  };
  const clear = () => {
    error.hidden = true;
    text.removeAttribute('aria-invalid');
  };

  /** @param {File|undefined} file @returns {Promise<void>} */
  const load = async (file) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      fail(`${file.name} is ${Math.round(file.size / 1024)} KB — too large to be a theme file.`);
      return;
    }
    try {
      text.value = await file.text();
      clear();
      text.focus();
    } catch {
      fail(`${file.name} could not be read.`);
    }
  };

  const picker = h('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onchange: () => {
      load(picker.files?.[0]);
      picker.value = '';
    }
  });
  text.addEventListener('input', clear);
  text.addEventListener('dragover', (event) => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  });
  text.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    event.preventDefault();
    load(file);
  });

  const run = (dialog) => {
    let result;
    try {
      result = readThemeJson(text.value);
    } catch (problem) {
      fail(problem instanceof Error ? problem.message : String(problem));
      text.focus();
      return;
    }
    Object.assign(state, result.settings);
    apply({ rebuild: true });
    dialog.close();
    if (result.warnings.length === 0) {
      Message.success('Theme imported.');
    } else {
      Message.warning(`Theme imported with ${result.warnings.length === 1 ? 'one change' : `${result.warnings.length} changes`}: `
        + result.warnings.join(' '), { timeout: 12000 });
    }
  };

  importDialog ??= new Dialog(null, { title: 'Import a theme', size: 'lg' });
  importDialog.setButtons([
    { label: 'Cancel', action: 'cancel' },
    { label: 'Import', kind: 'primary', action: run }
  ]);
  importDialog.setContent(h('div', { class: 'studio-stack' },
    h('p', { class: 'studio-prose' },
      'Paste a theme file exported from this studio, drop one on the field, or choose one. Every '
      + 'setting it leaves out takes the stock value; your light or dark choice stays as it is.'),
    h('div', { class: 'studio-row' },
      button({ label: 'Choose file…', icon: 'folder-open', onclick: () => picker.click() }), picker),
    text,
    error));
  importDialog.open();
}
