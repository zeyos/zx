import { Tabbox, h } from '../../src/index.js';

/** @param {string} title @param {string} text @returns {HTMLElement} */
function panelContent(title, text) {
  return h('div', {},
    h('h3', { style: { marginBlockStart: '0' } }, title),
    h('p', { style: { marginBlockEnd: '0' } }, text));
}

export default {
  title: 'Tabbox',
  group: 'Layout',
  blurb: 'Manual-activation tabs following the APG pattern: arrow keys move focus, Enter or Space '
    + 'selects, and panels can be built lazily.',

  examples: [
    {
      title: 'Tabs, badges, and lazy panels',
      blurb: 'Arrow keys move focus without selecting — the reader commits with Enter or Space. A '
        + 'content function instead of a node defers building the panel until its first '
        + 'activation; open the Lazy audit tab and watch the log.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const tabbox = new Tabbox(null, {
          active: 'overview',
          tabs: [
            {
              name: 'overview',
              title: 'Overview',
              icon: 'list',
              content: panelContent('Overview', 'Arrow keys move focus without selecting another tab.')
            },
            {
              name: 'records',
              title: 'Closable records',
              icon: 'file',
              closable: true,
              content: panelContent('Records', 'Focus this tab and press Delete to close it.')
            },
            {
              name: 'audit',
              title: 'Lazy audit',
              icon: 'eye',
              content: () => {
                log('lazy build: audit content created');
                return panelContent('Audit', 'This node was created only on first activation.');
              }
            },
            {
              name: 'disabled',
              title: 'Disabled',
              icon: 'lock',
              disabled: true,
              content: panelContent('Disabled', 'This content cannot be selected until enabled.')
            }
          ]
        });
        tabbox.setBadge('records', '2');
        tabbox.on('change', ({ detail }) => log(`change: ${detail.previous} → ${detail.name}`));
        tabbox.on('close', ({ detail }) => log(`close: ${detail.name}`));
        cleanup(() => tabbox.destroy());
        return [
          tabbox.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => tabbox.enableTab('disabled') }, 'enableTab("disabled")'),
            h('button', { type: 'button', onclick: () => tabbox.setBadge('records', '9') }, 'setBadge("records", "9")'))
        ];
      }
    },
    {
      title: 'Vetoing a change',
      blurb: 'The change event is cancelable. Calling preventDefault() keeps the current tab '
        + 'selected — the hook for "you have unsaved edits". Tick the box, then try another tab.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const veto = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox' }));
        const tabbox = new Tabbox(null, {
          tabs: [
            { name: 'edit', title: 'Edit', content: panelContent('Edit', 'Pretend this form has unsaved changes.') },
            { name: 'preview', title: 'Preview', content: panelContent('Preview', 'You only get here when the veto is off.') }
          ]
        });
        tabbox.on('change', (event) => {
          if (!veto.checked) return log(`change: ${event.detail.previous} → ${event.detail.name}`);
          event.preventDefault();
          log(`vetoed: ${event.detail.previous} → ${event.detail.name}`);
        });
        cleanup(() => tabbox.destroy());
        return [
          h('label', { class: 'demo-row' }, veto, 'Veto tab changes'),
          tabbox.toElement()
        ];
      }
    },
    {
      title: 'The four variants',
      blurb: 'Same component, same keyboard map, four tab rows. "divided" is the default: flat '
        + 'blocks on a muted track above a bordered panel. "bracket" outlines folder tabs that '
        + 'fuse into that panel. "line" underlines the active tab across a full-width rule, for '
        + 'page-level navigation. "segmented" is a compact group that reads as one control, for a '
        + 'toolbar or card header.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const variants = [
          ['divided', 'flat blocks on a muted track — the default'],
          ['bracket', 'folder tabs fused into the panel'],
          ['line', 'underlined, for page-level navigation'],
          ['segmented', 'one compact control, for a toolbar']
        ];
        return variants.map(([variant, note]) => {
          const tabbox = new Tabbox(null, {
            variant,
            tabs: [
              { name: 'chart', title: 'Chart', icon: 'filter', content: panelContent('Chart', note) },
              { name: 'table', title: 'Table', icon: 'list', content: panelContent('Table', 'Same component, different tab row.') },
              { name: 'raw', title: 'Raw', icon: 'code', content: panelContent('Raw', `variant: '${variant}'`) }
            ]
          });
          cleanup(() => tabbox.destroy());
          return h('div', { class: 'demo-field' },
            h('code', { class: 'demo-caption' }, `variant: '${variant}'`),
            tabbox.toElement());
        });
      }
    },
    {
      title: 'Bringing back rounded corners',
      blurb: 'Every variant is square-cornered. The boxed ones read --zx-tabbox-radius from the '
        + 'component root, so an application that wants the rounded pill group sets one property '
        + 'rather than forking the stylesheet.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const tabbox = new Tabbox(null, {
          variant: 'segmented',
          tabs: [
            { name: 'chart', title: 'Chart', icon: 'filter', content: panelContent('Chart', 'Rounded again, through the token.') },
            { name: 'table', title: 'Table', icon: 'list', content: panelContent('Table', 'No stylesheet fork needed.') }
          ]
        });
        tabbox.el.style.setProperty('--zx-tabbox-radius', 'var(--zx-radius-lg)');
        cleanup(() => tabbox.destroy());
        return tabbox.toElement();
      }
    }
  ]
};
