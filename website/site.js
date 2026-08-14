/*
 * Shared site chrome: theme persistence, the overlay-header scroll state, and nav highlighting.
 * Loaded as a classic script in <head> so the theme is applied before first paint.
 */
(function () {
  'use strict';

  const storageKey = 'zx-site-theme';
  const root = document.documentElement;
  const preferredDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  let storedTheme = null;

  try {
    storedTheme = window.localStorage.getItem(storageKey);
  } catch {
    // Storage can be unavailable in privacy-restricted browsing modes.
  }

  root.dataset.zxTheme = storedTheme === 'dark' || storedTheme === 'light'
    ? storedTheme
    : (preferredDark ? 'dark' : 'light');

  function ready() {
    setUpThemeToggles();
    setUpOverlayHeader();
    markCurrentNavLink();

    document.querySelectorAll('[data-placeholder-link]').forEach((link) => {
      link.addEventListener('click', (event) => event.preventDefault());
    });
  }

  /**
   * Wires every `[data-theme-toggle]` button to flip and persist the site theme. The glyph itself
   * is a CSS mask keyed off `data-zx-theme`, so only the accessible name is set here.
   */
  function setUpThemeToggles() {
    const themeButtons = document.querySelectorAll('[data-theme-toggle]');
    const update = () => {
      const title = root.dataset.zxTheme === 'dark'
        ? 'Switch to light theme'
        : 'Switch to dark theme';
      themeButtons.forEach((button) => {
        button.setAttribute('aria-label', title);
        button.setAttribute('title', title);
      });
    };

    themeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        root.dataset.zxTheme = root.dataset.zxTheme === 'dark' ? 'light' : 'dark';
        try {
          window.localStorage.setItem(storageKey, root.dataset.zxTheme);
        } catch {
          // The theme still works for the current page when persistence is blocked.
        }
        update();
      });
    });
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
   * Flags one nav entry as the current page. Several entries can point at the same document with
   * different hashes (Documentation / Components / Layouts all live in docs.html), so an exact
   * path+hash match wins; otherwise the hash-less entry for this document does.
   */
  function markCurrentNavLink() {
    const links = [...document.querySelectorAll('.site-nav a[href]')]
      .filter((link) => !link.getAttribute('href').startsWith('#'));
    if (links.length === 0) return;
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const parts = (link) => {
      const [path, hash = ''] = link.getAttribute('href').split('#');
      return { page: path.split('/').pop() || 'index.html', hash };
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
