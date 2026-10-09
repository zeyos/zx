/*
 * Shared site chrome: theme persistence, the overlay-header scroll state, and nav highlighting.
 * Loaded as a classic script in <head> so the theme is applied before first paint.
 *
 * "The theme" here is three things, each in its own storage entry: the light/dark choice, the
 * standard preset, and the custom property overrides the theme studio produced (spacing, radius,
 * type, colour). They are applied together on every page, which is what lets a reader build a
 * theme in the studio and then read the documentation in it.
 *
 * Motion is stored beside them: `reduced` sets `data-zx-motion="reduced"` on <html>, here, before
 * first paint, so no page animates once before it learns the reader asked it not to. `system`
 * leaves the attribute off and defers to the operating system — there is no value that asks for
 * more motion than the system allows.
 *
 * The overrides come out of storage, so they are treated as untrusted: only `--zx-*` names get
 * through, and only values that cannot terminate the <style> element or start a rule of their
 * own. See `writeVars`.
 */
(function () {
  'use strict';

  const KEYS = {
    theme: 'zx-site-theme',
    preset: 'zx-site-preset',
    vars: 'zx-site-theme-vars',
    motion: 'zx-site-motion'
  };
  const THEMES = ['light', 'dark', 'auto'];
  const MOTIONS = ['system', 'reduced'];
  const root = document.documentElement;
  const preferredDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  /** @type {HTMLStyleElement|null} Holds the custom overrides; created on first use. */
  let varSheet = null;

  const state = {
    theme: readTheme(),
    preset: read(KEYS.preset) || 'zx',
    vars: readVars(),
    motion: MOTIONS.includes(read(KEYS.motion)) ? read(KEYS.motion) : 'system'
  };
  applyState();

  /**
   * The site-wide theme, for the pages that let a reader change it.
   * A classic-script global because this file has to run before the module graph does.
   */
  window.zxTheme = {
    /** @returns {{theme: string, preset: string, vars: object, motion: 'system'|'reduced'}} */
    get() {
      return { ...state, vars: { ...state.vars } };
    },
    /**
     * Merges a change in, applies it, persists it, and announces it. Fields it does not know are
     * ignored rather than rejected.
     * @param {{theme?: string, preset?: string, vars?: object, motion?: 'system'|'reduced'}} patch
     * @returns {void}
     */
    set(patch) {
      if (THEMES.includes(patch.theme)) state.theme = patch.theme;
      if (typeof patch.preset === 'string') state.preset = patch.preset;
      if (patch.vars) state.vars = safeVars(patch.vars);
      if (MOTIONS.includes(patch.motion)) state.motion = patch.motion;
      applyState();
      write(KEYS.theme, state.theme);
      write(KEYS.preset, state.preset);
      write(KEYS.vars, JSON.stringify(state.vars));
      write(KEYS.motion, state.motion);
      document.dispatchEvent(new CustomEvent('zx-theme-change', { detail: window.zxTheme.get() }));
    },
    /** Returns the theme actually being rendered, resolving `auto`. @returns {'light'|'dark'} */
    resolved() {
      if (state.theme !== 'auto') return state.theme;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  };

  /** @returns {void} */
  function applyState() {
    root.dataset.zxTheme = state.theme;
    if (state.preset && state.preset !== 'zx') root.dataset.zxPreset = state.preset;
    else delete root.dataset.zxPreset;
    if (state.motion === 'reduced') root.dataset.zxMotion = 'reduced';
    else delete root.dataset.zxMotion;
    writeVars();
  }

  /**
   * Writes the overrides into a single stylesheet.
   *
   * A stylesheet rather than inline styles on <html>: inline styles are the highest-priority
   * origin short of !important, so they would also beat a preset attribute and any override a
   * page sets for itself. A `:root` rule sits exactly where the stock tokens sit.
   * @returns {void}
   */
  function writeVars() {
    const names = Object.keys(state.vars);
    if (names.length === 0) {
      if (varSheet) varSheet.textContent = '';
      return;
    }
    if (!varSheet) {
      varSheet = document.createElement('style');
      varSheet.id = 'zx-theme-vars';
      document.head.append(varSheet);
    }
    varSheet.textContent = ':root{'
      + names.map((name) => name + ':' + state.vars[name] + ';').join('')
      + '}';
  }

  /**
   * Keeps only what the studio can legitimately have written. Everything here arrives from
   * storage, which any script on the origin can write, and it ends up inside a <style> element.
   * @param {object} input
   * @returns {object}
   */
  function safeVars(input) {
    const output = {};
    if (!input || typeof input !== 'object') return output;
    for (const name of Object.keys(input)) {
      if (!/^--zx-[a-z0-9-]+$/.test(name)) continue;
      const value = String(input[name]);
      if (value.length > 240 || /[<>{};@\\]/.test(value)) continue;
      output[name] = value;
    }
    return output;
  }

  /** @returns {string} */
  function readTheme() {
    const stored = read(KEYS.theme);
    if (THEMES.includes(stored)) return stored;
    return preferredDark ? 'dark' : 'light';
  }

  /** @returns {object} */
  function readVars() {
    try {
      return safeVars(JSON.parse(read(KEYS.vars) || '{}'));
    } catch {
      return {};
    }
  }

  /** @param {string} key @returns {string|null} */
  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Storage can be unavailable in privacy-restricted browsing modes.
      return null;
    }
  }

  /** @param {string} key @param {string} value @returns {void} */
  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The theme still works for the current page when persistence is blocked.
    }
  }

  function ready() {
    setUpThemeToggles();
    setUpOverlayHeader();
    markCurrentNavLink();
  }

  /**
   * Wires every `[data-theme-toggle]` button to flip and persist the site theme. The glyph itself
   * is a CSS mask keyed off `data-zx-theme`, so only the accessible name is set here.
   *
   * The flip is against what is on screen, not against the stored value, so a reader on `auto`
   * gets the opposite of what they are looking at rather than a button that appears to do
   * nothing on half of all machines.
   */
  function setUpThemeToggles() {
    const themeButtons = document.querySelectorAll('[data-theme-toggle]');
    const update = () => {
      const title = window.zxTheme.resolved() === 'dark'
        ? 'Switch to light theme'
        : 'Switch to dark theme';
      themeButtons.forEach((button) => {
        button.setAttribute('aria-label', title);
        button.setAttribute('title', title);
      });
    };

    themeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        window.zxTheme.set({ theme: window.zxTheme.resolved() === 'dark' ? 'light' : 'dark' });
      });
    });
    document.addEventListener('zx-theme-change', update);
    update();
  }

  /**
   * The home page header floats transparently over the dark hero and turns solid once the page
   * scrolls past it, the way the ZeyOS site behaves.
   */
  function setUpOverlayHeader() {
    const header = document.querySelector('.site-header--overlay');
    if (!header) return;
    const sync = () => {
      if (window.scrollY > 24) header.setAttribute('data-scrolled', '');
      else header.removeAttribute('data-scrolled');
    };
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  /**
   * Flags one nav entry as the current page: Documentation on docs.html, Layouts on the gallery in
   * layouts.html, Theming on the studio. Entries may also point into a page by hash, so an exact
   * page+hash match wins; otherwise the hash-less entry for this page does. Pages are compared
   * without their `.html`, so a host that serves `/layouts` for `/layouts.html` still matches.
   */
  function markCurrentNavLink() {
    const links = [...document.querySelectorAll('.site-nav a[href]')]
      .filter((link) => !link.getAttribute('href').startsWith('#'));
    if (links.length === 0) return;
    const pageName = (path) => (path.split('/').pop() || 'index').replace(/\.html$/, '');
    const page = pageName(window.location.pathname);
    const parts = (link) => {
      const [path, hash = ''] = link.getAttribute('href').split('#');
      return { page: pageName(path), hash };
    };

    const sync = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const here = links.filter((link) => parts(link).page === page);
      const current = here.find((link) => parts(link).hash && hash.startsWith(parts(link).hash))
        ?? here.find((link) => !parts(link).hash);
      links.forEach((link) => {
        if (link === current) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    };

    window.addEventListener('hashchange', sync);
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
}());
