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
    const themeButtons = document.querySelectorAll('[data-theme-toggle]');
    const updateThemeButtons = () => {
      const dark = root.dataset.zxTheme === 'dark';
      themeButtons.forEach((button) => {
        const icon = button.querySelector('[data-theme-icon]');
        const label = button.querySelector('[data-theme-label]');
        button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
        button.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
        if (icon) icon.textContent = dark ? '☀' : '☾';
        if (label) label.textContent = dark ? 'Light' : 'Dark';
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
        updateThemeButtons();
      });
    });
    updateThemeButtons();

    const kitchenLink = document.querySelector('[data-nav-kitchen]');
    if (kitchenLink && window.location.pathname.endsWith('/kitchen-sink.html')) {
      kitchenLink.setAttribute('aria-current', 'page');
    }

    document.querySelectorAll('[data-placeholder-link]').forEach((link) => {
      link.addEventListener('click', (event) => event.preventDefault());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
}());
