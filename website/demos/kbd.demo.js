import { button, h, kbd } from '../../src/index.js';

/** Shortcuts as an application's shortcut reference lists them: what the key does, and the key. */
const SHORTCUTS = [
  { action: 'Search everything', keys: 'Mod+K' },
  { action: 'New record', keys: 'N' },
  { action: 'Save and close', keys: 'Mod+Enter' },
  { action: 'Toggle the sidebar', keys: 'Mod+B' },
  { action: 'Go to inbox', keys: ['g', 'i'] },
  { action: 'Show all shortcuts', keys: '?' }
];

export default {
  title: 'Kbd',
  group: 'Helpers',
  blurb: 'Keycaps for every key hint: one construction in buttons, menus, the launcher, and help.',

  examples: [
    {
      title: 'Chords and sequences',
      blurb: 'kbd() takes a chord written the way aria-keyshortcuts is — "Mod+Shift+K" — or a list '
        + 'of keys for a sequence. Mod is ⌘ on Apple platforms and Ctrl elsewhere; the other '
        + 'modifiers and named keys become their glyphs. Each key is one keycap; a single '
        + 'character is square, so a column of hints lines up.',
      layout: 'stack',
      render: () => h('div', { class: 'zx-prose', 'data-size': 'sm' },
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Action'), h('th', { scope: 'col' }, 'Keys'))),
          h('tbody', {}, SHORTCUTS.map(({ action, keys }) => h('tr', {},
            h('td', {}, action),
            h('td', {}, kbd(keys)))))))
    },
    {
      title: 'Inside controls',
      blurb: 'A button with a shortcut draws it with the small keycaps, quieter than its label; on a '
        + 'solid button the keycaps take the button\'s own ink. tone: \'inherit\' does the same '
        + 'anywhere the surrounding text colour should carry through.',
      layout: 'stack',
      render: () => [
        h('div', { class: 'demo-row' },
          button({ label: 'New company', icon: 'plus', kind: 'primary', shortcut: { label: 'N', keys: 'N' } }),
          button({ label: 'Import', shortcut: { label: 'I', keys: 'I' } })),
        h('div', { class: 'demo-row' },
          kbd('Mod+K', { size: 'sm' }),
          kbd('Escape', { size: 'sm' }),
          kbd(['↑', '↓'], { size: 'sm' }))
      ]
    }
  ]
};
