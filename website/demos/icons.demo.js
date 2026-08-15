import {
  Search, Toggle, button, getIconConfig, h, icon, iconNames, useBuiltinIcons, useFontAwesome
} from '../../src/index.js';
import {
  ZEYOS_ICON_KIT, moduleChip, moduleInfo, moduleKeys, useZeyosIcons
} from '../../src/zeyos/index.js';

/** Font Awesome styles offered by the style switcher. Kits carry the ones their licence allows. */
const STYLES = ['solid', 'regular', 'light', 'thin', 'duotone'];

/** Spec forms understood by `icon()`, shown side by side with what they render. */
const SPECS = [
  ['check', 'the active renderer decides'],
  ['builtin:check', 'always the bundled inline SVG'],
  ['fa:user', 'Font Awesome, default style'],
  ['duotone:user', 'Font Awesome, named style'],
  ['kit:zeyos-notes', 'custom icon from the kit'],
  ['fa-sharp fa-solid fa-user', 'a literal class list']
];

export default {
  title: 'Icons',
  group: 'Core',
  blurb: 'One icon() call, two renderers: the inline SVG glyphs Zx bundles, or Font Awesome once '
    + 'an application loads a kit. Plus the ZeyOS module icons and the colour each module is '
    + 'drawn in.',

  /**
   * Mounts the icon layer examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    container.append(
      fontAwesomeSection(),
      moduleSection(),
      builtinSection(),
      configSection()
    );

    // The provider is global: put it back when this demo leaves the stage.
    new MutationObserver((records, observer) => {
      if (container.isConnected) return;
      useBuiltinIcons();
      observer.disconnect();
    }).observe(document.body, { childList: true, subtree: true });
  }
};

/* -------------------------------------------------------------- Font Awesome -- */

/** @returns {HTMLElement} */
function fontAwesomeSection() {
  const status = note('The kit is not loaded yet — the icons below are the bundled inline SVGs.');
  const samples = h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)'
  } });
  const specs = h('div', { style: {
    display: 'grid', gap: 'var(--zx-space-2)',
    gridTemplateColumns: 'auto auto 1fr', alignItems: 'center'
  } });

  const styleSelect = h('select', { disabled: true, onchange: () => {
    useFontAwesome({ style: styleSelect.value });
    redraw();
  } }, STYLES.map((style) => h('option', { value: style }, style)));

  const provider = new Toggle(null, {
    label: 'Render every Zx icon with Font Awesome',
    disabled: true,
    onchange: (event) => {
      if (event.detail.checked) useFontAwesome({ style: styleSelect.value });
      else useBuiltinIcons();
      styleSelect.disabled = !event.detail.checked;
      redraw();
    }
  });

  const load = button({
    label: 'Load the ZeyOS kit', kind: 'primary', icon: 'upload',
    onclick: async () => {
      load.disabled = true;
      status.textContent = 'Loading the kit…';
      try {
        await useZeyosIcons({ style: styleSelect.value });
        provider.enable();
        provider.set(true);
        status.textContent = 'Kit loaded. Every bare icon name now resolves to Font Awesome, and '
          + 'the ZeyOS module glyphs below are available.';
      } catch (error) {
        load.disabled = false;
        status.textContent = `${error.message} — kits are locked to the domains configured in `
          + 'the Font Awesome account, so a kit may refuse to load on an unlisted host.';
        redraw();
      }
    }
  });

  /** @type {Search|null} The sample search, rebuilt on every redraw so its glyphs follow. */
  let sampleSearch = null;

  /** Re-renders the samples: icons already in the DOM keep whatever rendered them. */
  function redraw() {
    sampleSearch?.destroy();
    sampleSearch = new Search(null, { placeholder: 'Search…' });
    samples.replaceChildren(
      button({ label: 'Save', icon: 'check', kind: 'primary' }),
      button({ label: 'Delete', icon: 'trash', kind: 'danger' }),
      button({ label: 'Filter', icon: 'filter' }),
      sampleSearch.toElement(),
      ...['calendar', 'gear', 'star', 'lock', 'reload', 'warning'].map(
        (name) => icon(name, { size: 20 })
      )
    );
    specs.replaceChildren(...SPECS.flatMap(([spec, description]) => [
      icon(spec, { size: 18 }),
      h('code', { style: { fontSize: 'var(--zx-text-sm)' } }, `'${spec}'`),
      h('span', { style: { color: 'var(--zx-color-text-muted)' } }, description)
    ]));
  }

  redraw();
  return section('Font Awesome',
    note('Zx renders the inline SVG set by default and never fetches anything on its own. An '
      + 'application opts in with loadFontAwesome(kit) — which injects the kit script once and '
      + 'switches the renderer — or with useFontAwesome() when the page already carries Font '
      + 'Awesome. Component code does not change: the same icon(\'check\') call renders either.'),
    code(`import { loadFontAwesome } from '/assets/zx.esm.js';\n`
      + `await loadFontAwesome({ kit: '${ZEYOS_ICON_KIT}', style: 'solid' });\n\n`
      + '// or, from the ZeyOS binding, the same kit by name:\n'
      + "import { useZeyosIcons } from '/assets/zx-zeyos.esm.js';\n"
      + "await useZeyosIcons({ style: 'duotone' });"),
    row(load, styleSelect, provider.toElement()),
    status,
    samples,
    note('Names carry their own renderer when they need to. A bare name follows the active '
      + 'provider; a prefixed name or a literal class list does not:'),
    specs
  );
}

/* ------------------------------------------------------------- ZeyOS modules -- */

/** @returns {HTMLElement} */
function moduleSection() {
  const grid = h('div', { style: {
    display: 'grid', gap: 'var(--zx-space-3)',
    gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))'
  } });
  let query = '';
  let standard = false;

  const filter = new Search(null, {
    placeholder: 'Filter modules…',
    oninput: (event) => { query = event.detail.value.trim().toLowerCase(); draw(); }
  });
  const fallback = new Toggle(null, {
    label: 'Use the stock Font Awesome fallbacks',
    onchange: (event) => { standard = event.detail.checked; draw(); }
  });

  /** Redraws the module gallery. */
  function draw() {
    const keys = moduleKeys().filter((key) => !query
      || key.includes(query) || moduleInfo(key).label.toLowerCase().includes(query));
    grid.replaceChildren(...keys.map((key) => {
      const info = moduleInfo(key);
      return h('div', { style: {
        display: 'flex', alignItems: 'center', gap: 'var(--zx-space-3)',
        padding: 'var(--zx-space-2)', border: '1px solid var(--zx-color-border)',
        borderRadius: 'var(--zx-radius-md)', background: 'var(--zx-color-bg-surface)'
      } },
      moduleChip(key, { size: 32, standard }),
      h('div', { style: { display: 'grid', minWidth: '0' } },
        h('span', { style: { fontSize: 'var(--zx-text-sm)' } }, info.label),
        h('code', { style: {
          overflow: 'hidden', color: 'var(--zx-color-text-muted)',
          fontSize: 'var(--zx-text-xs)', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        } }, `${key} · ${info.color}`)));
    }));
  }

  draw();
  return section('ZeyOS modules',
    note('Every ZeyOS module has an icon in the kit and an identity colour. moduleChip() draws '
      + 'the pair the way ZeyOS draws module icons in navigation; moduleIcon() gives the bare '
      + 'glyph. Both accept module, entity, and API resource names — moduleChip(\'invoices\') and '
      + "moduleChip('transactions.billing') land on the same module — and unknown names fall back "
      + 'to the ZeyOS default glyph rather than throwing. The glyphs stay blank until the kit '
      + 'above is loaded; the chip colour does not depend on it.'),
    code("import { moduleChip, moduleColor } from '/assets/zx-zeyos.esm.js';\n\n"
      + "nav.append(moduleChip('tickets', { size: 24, title: true }));\n"
      + "moduleColor('invoices');  // '#535494'"),
    row(filter.toElement(), fallback.toElement()),
    grid
  );
}

/* ------------------------------------------------------------ bundled glyphs -- */

/** @returns {HTMLElement} */
function builtinSection() {
  const grid = h('div', { style: {
    display: 'grid', gap: 'var(--zx-space-3)',
    gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))'
  } }, iconNames().map((name) => h('div', { style: {
    display: 'flex', alignItems: 'center', gap: 'var(--zx-space-2)',
    color: 'var(--zx-color-text-muted)', fontSize: 'var(--zx-text-xs)'
  } },
  icon(`builtin:${name}`, { size: 18 }),
  h('code', null, name))));

  return section('The bundled set',
    note(`The ${iconNames().length} inline SVG glyphs Zx ships, from Font Awesome Free 6 solid. `
      + 'They cover what the components need, carry no webfont or stylesheet, and stay available '
      + 'after Font Awesome is switched on — prefix a name with builtin: to force one. Add your '
      + 'own with registerIcons({ name: [viewBox, path] }).'),
    grid
  );
}

/* -------------------------------------------------------------- configuration -- */

/** @returns {HTMLElement} */
function configSection() {
  const config = output(JSON.stringify(getIconConfig(), null, 2));
  return section('Configuration',
    note('src/zeyos/modules.js is the configuration file behind the gallery: one entry per '
      + 'module, holding the kit icon name, the identity colour, a display label, and a stock '
      + 'Font Awesome fallback. The --zx-module-* CSS custom properties are generated from it, so '
      + 'CSS and JavaScript can never disagree about a module colour.'),
    code("notes: { label: 'Notes', icon: 'zeyos-notes', color: '#008853', fa: 'note-sticky' }\n\n"
      + '// A ZeyOS menu payload is authoritative — feed its colours in at startup:\n'
      + "registerModules({ tickets: '#f04639', 'my-fork': { label: 'My Fork', icon: 'zeyos-weblets' } });"),
    note('The active icon configuration, as getIconConfig() reports it:'),
    config
  );
}

/* --------------------------------------------------------------- small helpers -- */

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: {
    display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
    border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
    background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-5)'
  } }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-4)'
  } }, children);
}

/** @param {string} [text=''] @returns {HTMLElement} */
function output(text = '') {
  return h('pre', { style: {
    margin: '0', padding: 'var(--zx-space-4)', overflowX: 'auto',
    borderRadius: 'var(--zx-radius-md)', background: 'var(--zx-color-bg-muted)',
    fontFamily: 'var(--zx-font-mono)', fontSize: 'var(--zx-text-sm)', lineHeight: '1.7',
    whiteSpace: 'pre-wrap'
  } }, text);
}

/** @param {string} text @returns {HTMLElement} */
function code(text) {
  return output(text);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', { style: {
    margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
  } }, text);
}
